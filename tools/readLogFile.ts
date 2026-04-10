import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

const timeoutMs = (() => {
  const env = process.env.readLogFileTimeoutMs;
  if (!env) return 5000;
  const n = Number(env);
  if (!Number.isFinite(n) || n <= 0) {
    process.stderr.write(`Invalid readLogFileTimeoutMs: "${env}".\n`);
    process.exit(1);
  }
  return n;
})();

const routingDepth = (() => {
  const env = process.env.readLogFileRoutingDepth;
  if (!env) return 2;
  const n = Number(env);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    process.stderr.write(
      `Invalid readLogFileRoutingDepth: "${env}". Must be 1-5.\n`,
    );
    process.exit(1);
  }
  return n;
})();

// --- Drain Algorithm Implementation (Tree-Based) ---

interface Template {
  tokens: string[];
  pattern: string;
  count: number;
  samples: string[][];
}

const WILDCARD = "<*>";
const WILDCARD_KEY = "<WILDCARD>";
const MAX_SAMPLES = 3;

function tokenize(line: string): string[] {
  return line.split(/(\s+|[{}()\[\],:;="'`<>])/g).filter((t) => t.trim());
}

function looksLikeVariable(token: string): boolean {
  if (token === WILDCARD) return true;
  const first = token.charAt(0);
  if (first >= "0" && first <= "9") return true;
  if (/^[0-9a-fA-F]+$/.test(token) && token.length > 8) return true;
  return false;
}

function similarity(tokens: string[], template: string[]): number {
  if (tokens.length !== template.length) return 0;
  let matches = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (template[i] === WILDCARD || tokens[i] === template[i]) matches++;
  }
  return matches / tokens.length;
}

function mergeTokens(tokens: string[], template: string[]): string[] {
  return template.map((t, i) =>
    t === WILDCARD || t !== tokens[i] ? WILDCARD : t,
  );
}

function extractVariables(tokens: string[], template: string[]): string[] {
  const vars: string[] = [];
  for (let i = 0; i < template.length; i++) {
    if (template[i] === WILDCARD && tokens[i]) vars.push(tokens[i]);
  }
  return vars;
}

function tokensToPattern(tokens: string[]): string {
  return tokens.join(" ");
}

function getRouteKey(token: string | undefined): string {
  if (!token) return WILDCARD_KEY;
  return looksLikeVariable(token) ? WILDCARD_KEY : token;
}

function getRouteKeys(tokens: string[], depth: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < depth; i++) {
    keys.push(getRouteKey(tokens[i]));
  }
  return keys;
}

interface TreeNode {
  children: Map<string, TreeNode>;
  templates: Template[];
}

function createNode(): TreeNode {
  return { children: new Map(), templates: [] };
}

/**
 * Tree-based Drain algorithm with configurable routing depth.
 * Structure: root → length → token[0] → token[1] → ... → token[depth-1] → templates[]
 * Deeper routing prevents cross-contamination but increases memory usage.
 */
class DrainTree {
  private root = new Map<number, TreeNode>();

  constructor(
    private simThreshold: number,
    private depth: number,
  ) {}

  private navigate(
    length: number,
    keys: string[],
    create: boolean,
  ): TreeNode | undefined {
    let lengthNode = this.root.get(length);
    if (!lengthNode) {
      if (!create) return undefined;
      lengthNode = createNode();
      this.root.set(length, lengthNode);
    }

    let current = lengthNode;
    for (const key of keys) {
      let child = current.children.get(key);
      if (!child) {
        if (!create) return undefined;
        child = createNode();
        current.children.set(key, child);
      }
      current = child;
    }

    return current;
  }

  addLine(line: string): void {
    const tokens = tokenize(line);
    if (!tokens.length) return;

    const length = tokens.length;
    const keys = getRouteKeys(tokens, this.depth);

    const node = this.navigate(length, keys, false);
    let bestMatch: Template | null = null;
    let bestSim = 0;

    if (node) {
      for (const template of node.templates) {
        const sim = similarity(tokens, template.tokens);
        if (sim >= this.simThreshold && sim > bestSim) {
          bestSim = sim;
          bestMatch = template;
        }
      }
    }

    if (bestMatch) {
      bestMatch.tokens = mergeTokens(tokens, bestMatch.tokens);
      bestMatch.pattern = tokensToPattern(bestMatch.tokens);
      bestMatch.count++;
      if (bestMatch.samples.length < MAX_SAMPLES) {
        bestMatch.samples.push(extractVariables(tokens, bestMatch.tokens));
      }
    } else {
      const targetNode = this.navigate(length, keys, true)!;
      targetNode.templates.push({
        tokens,
        pattern: tokensToPattern(tokens),
        count: 1,
        samples: [],
      });
    }
  }

  getTemplates(): Template[] {
    const result: Template[] = [];
    const collectFromNode = (node: TreeNode): void => {
      result.push(...node.templates);
      for (const child of node.children.values()) {
        collectFromNode(child);
      }
    };
    for (const lengthNode of this.root.values()) {
      collectFromNode(lengthNode);
    }
    return result;
  }
}

function compress(lines: string[], simThreshold: number): Template[] {
  const tree = new DrainTree(simThreshold, routingDepth);
  for (const line of lines) {
    tree.addLine(line);
  }
  return tree.getTemplates();
}

// --- MCP Tool ---

function hashTemplateId(pattern: string): string {
  return createHash("sha256").update(pattern).digest("base64url").slice(0, 12);
}

const CONTINUATION_MARKER = " \u23CE ";

function joinMultilineEntries(
  lines: string[],
  lineStartPattern: RegExp,
): string[] {
  const result: string[] = [];
  let current = "";

  for (const line of lines) {
    if (lineStartPattern.test(line)) {
      if (current) result.push(current);
      current = line;
    } else {
      current += CONTINUATION_MARKER + line;
    }
  }
  if (current) result.push(current);

  return result;
}

const schema = z.object({
  path: z.string().min(1).describe("Path to the log file."),
  simThreshold: z
    .number()
    .min(0)
    .max(1)
    .describe("Similarity threshold (0-1). Lower = more aggressive grouping."),
  tail: z.number().int().min(1).optional().describe("Last N lines."),
  head: z.number().int().min(1).optional().describe("First N lines."),
  grep: z
    .string()
    .optional()
    .describe(
      "Regex filter for lines. Smart case: all-lowercase pattern = case-insensitive, any uppercase = exact case.",
    ),
  lineStart: z
    .string()
    .optional()
    .describe(
      "Regex identifying log entry start lines. Lines not matching are joined to previous entry with \u23CE. For tsserver: ^(Info|Err|Perf)\\s+\\d+",
    ),
  templateId: z
    .string()
    .optional()
    .describe("Drill into a specific template by its hash ID."),
});

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const err = (text: string) => ({
  isError: true as const,
  content: [{ type: "text" as const, text }],
});

export function register(server: McpServer): void {
  server.registerTool(
    "readLogFile",
    {
      description:
        "Compress a log file using the Drain algorithm for semantic pattern extraction. Groups similar lines into templates. Stateless — each call processes the file fresh. Template IDs are content-hashed so the same pattern always has the same ID.",
      inputSchema: schema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => {
      try {
        return ok(await Promise.race([processLog(input), timeout()]));
      } catch (e) {
        return err(String(e));
      }
    },
  );
}

interface TemplateInfo {
  id: string;
  pattern: string;
  count: number;
  samples: string[][];
}

async function processLog(input: z.infer<typeof schema>): Promise<string> {
  const path = resolve(process.cwd(), input.path);

  if (input.head && input.tail) {
    return "Cannot use both head and tail.";
  }

  const content = await readFile(path, "utf-8");
  let lines = content.split(/\r?\n/).filter(Boolean);

  if (input.head) lines = lines.slice(0, input.head);
  else if (input.tail) lines = lines.slice(-input.tail);
  if (input.lineStart) {
    let lineStartRe: RegExp;
    try {
      lineStartRe = new RegExp(input.lineStart);
    } catch {
      return `Invalid lineStart regex: "${input.lineStart}"`;
    }
    lines = joinMultilineEntries(lines, lineStartRe);
  }

  if (input.grep) {
    let re: RegExp;
    try {
      // Smart case: all-lowercase pattern → case-insensitive (like ripgrep --smart-case)
      const flags = /[A-Z]/.test(input.grep) ? "" : "i";
      re = new RegExp(input.grep, flags);
    } catch {
      return `Invalid grep regex: "${input.grep}"`;
    }
    lines = lines.filter((l) => re.test(l));
  }
  if (!lines.length) return "No log lines to process.";

  const inputLength = lines.reduce((sum, l) => sum + l.length, 0);
  const templates = compress(lines, input.simThreshold);
  const templateMap = buildTemplateMap(templates);

  if (input.templateId) {
    const template = templateMap.get(input.templateId);
    if (!template) {
      const available = [...templateMap.keys()].slice(0, 10).join(", ");
      return `Template "${input.templateId}" not found. Available: ${available}${templateMap.size > 10 ? ` (+${templateMap.size - 10} more)` : ""}`;
    }
    return formatDrillDown(template);
  }

  return formatOverview(templateMap, lines.length, inputLength);
}

function buildTemplateMap(templates: Template[]): Map<string, TemplateInfo> {
  const map = new Map<string, TemplateInfo>();
  for (const t of templates) {
    const id = hashTemplateId(t.pattern);
    map.set(id, {
      id,
      pattern: t.pattern,
      count: t.count,
      samples: t.samples,
    });
  }
  return map;
}

function formatOverview(
  templateMap: Map<string, TemplateInfo>,
  lineCount: number,
  inputLength: number,
): string {
  const sorted = [...templateMap.values()].sort((a, b) => b.count - a.count);
  const lineReduction = Math.round((1 - templateMap.size / lineCount) * 100);

  const top20 = sorted.slice(0, 20);
  const topLines = top20
    .map((t) => `${t.id} [${t.count}x] ${t.pattern}`)
    .join("\n");

  const remaining = sorted.length - 20;
  const footer = remaining > 0 ? `\n... and ${remaining} more templates` : "";

  const body = `${topLines}${footer}`;
  const outputLength = body.length;
  const charReduction = Math.round((1 - outputLength / inputLength) * 100);

  const header =
    `=== Log Compression ===\n` +
    `${lineCount} lines → ${templateMap.size} templates (${lineReduction}% reduction)\n` +
    `${inputLength.toLocaleString()} chars → ${outputLength.toLocaleString()} chars (${charReduction}% reduction)\n`;

  return `${header}\n${body}`;
}

function formatDrillDown(template: TemplateInfo): string {
  const header = `Template: ${template.id}\nPattern: ${template.pattern}\nMatches: ${template.count}\n`;
  if (!template.samples.length) return header;

  const samples = template.samples
    .map((vars, i) => `  ${i + 1}. Variables: ${vars.join(", ")}`)
    .join("\n");
  return `${header}\nSample variable captures:\n${samples}`;
}

function timeout(): Promise<never> {
  return new Promise((_, rej) =>
    setTimeout(() => rej(new Error(`Timeout: ${timeoutMs}ms`)), timeoutMs),
  );
}
