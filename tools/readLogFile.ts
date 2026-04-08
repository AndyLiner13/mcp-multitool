import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { z } from "zod";
import { createDrain, type Drain, type OutputFormat } from "logpare";

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

interface DrainState {
  drain: Drain;
  lastLine: number;
  depth: number;
  simThreshold: number;
}

const drains = new Map<string, DrainState>();
let flushTool: { remove: () => void } | null = null;

const schema = z.object({
  path: z.string().min(1).describe("Path to the log file."),
  format: z.enum(["summary", "detailed", "json"]).describe("Output format."),
  depth: z.number().int().min(2).max(8).describe("Parse tree depth (2-8)."),
  simThreshold: z
    .number()
    .min(0)
    .max(1)
    .describe("Similarity threshold (0-1)."),
  tail: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Last N lines (first read only)."),
  head: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("First N lines (first read only)."),
  grep: z.string().optional().describe("Regex filter for lines."),
});

const flushSchema = z.object({
  path: z.string().min(1).describe("Path to the log file to flush."),
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
        "Compress a log file using semantic pattern extraction (60-90% reduction). Creates stateful drains for incremental reads. Use flushLogFile to release.",
      inputSchema: schema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => {
      try {
        return ok(await Promise.race([processLog(server, input), timeout()]));
      } catch (e) {
        return err(String(e));
      }
    },
  );
}

async function processLog(
  server: McpServer,
  input: z.infer<typeof schema>,
): Promise<string> {
  const path = resolve(process.cwd(), input.path);
  let state = drains.get(path);

  if (input.head && input.tail) {
    return "Cannot use both head and tail.";
  }

  if (
    state &&
    (state.depth !== input.depth || state.simThreshold !== input.simThreshold)
  ) {
    return `Error: Drain exists with depth=${state.depth}, simThreshold=${state.simThreshold}. Flush first.`;
  }

  const content = await readFile(path, "utf-8");
  let lines = content.split(/\r?\n/).filter(Boolean);

  if (!state) {
    const wasEmpty = drains.size === 0;
    if (input.head) lines = lines.slice(0, input.head);
    else if (input.tail) lines = lines.slice(-input.tail);
    if (input.grep)
      lines = lines.filter((l) => new RegExp(input.grep!).test(l));
    if (!lines.length) return "No log lines to process.";

    const drain = createDrain({
      depth: input.depth,
      simThreshold: input.simThreshold,
    });
    drain.addLogLines(lines);
    state = {
      drain,
      lastLine: lines.length,
      depth: input.depth,
      simThreshold: input.simThreshold,
    };
    drains.set(path, state);

    if (wasEmpty) registerFlush(server);
    return `${state.drain.getResult(input.format as OutputFormat).formatted}\n\n[New drain. ${state.lastLine} lines. Use flushLogFile when done.]`;
  }

  const newLines = lines.slice(state.lastLine);
  if (!newLines.length) {
    return `${state.drain.getResult(input.format as OutputFormat).formatted}\n\n[No new lines. Total: ${state.lastLine}]`;
  }

  const filtered =
    input.grep ?
      newLines.filter((l) => new RegExp(input.grep!).test(l))
    : newLines;
  if (filtered.length) state.drain.addLogLines(filtered);
  state.lastLine = lines.length;

  return `${state.drain.getResult(input.format as OutputFormat).formatted}\n\n[+${newLines.length} lines. Total: ${state.lastLine}]`;
}

function registerFlush(server: McpServer): void {
  if (flushTool) return;
  try {
    flushTool = server.registerTool(
      "flushLogFile",
      {
        description:
          "Release a log drain to free memory. Next readLogFile creates fresh drain.",
        inputSchema: flushSchema,
        annotations: { destructiveHint: true, idempotentHint: true },
      },
      async (input) => {
        try {
          const path = resolve(process.cwd(), input.path);
          const state = drains.get(path);
          if (!state) {
            if (!drains.size) return ok("No active drains.");
            return ok(
              `No drain for "${basename(path)}". Active: ${[...drains.keys()].map((p) => basename(p)).join(", ")}`,
            );
          }
          const { totalClusters, lastLine } = {
            totalClusters: state.drain.totalClusters,
            lastLine: state.lastLine,
          };
          drains.delete(path);
          if (!drains.size && flushTool) {
            flushTool.remove();
            flushTool = null;
          }
          return ok(
            `Flushed ${basename(path)}. Released ${totalClusters} templates from ${lastLine} lines.`,
          );
        } catch (e) {
          return err(String(e));
        }
      },
    ) as { remove: () => void };
    server.sendToolListChanged();
  } catch {}
}

function timeout(): Promise<never> {
  return new Promise((_, rej) =>
    setTimeout(() => rej(new Error(`Timeout: ${timeoutMs}ms`)), timeoutMs),
  );
}
