import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { compress } from "logpare";

const DEFAULT_TIMEOUT_MS = 5000;
const timeoutMs = parseTimeout();

function parseTimeout(): number {
  const env = process.env.readLogTimeoutMs;
  if (!env) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(env);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    process.stderr.write(
      `Invalid readLogTimeoutMs: "${env}". Must be a positive number.\n`,
    );
    process.exit(1);
  }
  return parsed;
}

const schema = z
  .object({
    path: z
      .string()
      .min(1)
      .describe("Path to the log file (absolute or relative to cwd)."),
    format: z
      .enum(["summary", "detailed", "json"])
      .describe("Output format: summary (compact), detailed (full), or json."),
    depth: z
      .number()
      .int()
      .min(2)
      .max(8)
      .describe(
        "Parse tree depth for pattern matching (2-8). Higher = more specific templates.",
      ),
    simThreshold: z
      .number()
      .min(0)
      .max(1)
      .describe(
        "Similarity threshold for grouping (0.0-1.0). Lower = more aggressive grouping.",
      ),
    tail: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Only read the last N lines of the file."),
    head: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Only read the first N lines of the file."),
    grep: z
      .string()
      .optional()
      .describe("Filter lines matching this regex before compression."),
  })
  .refine((data) => !(data.head && data.tail), {
    message: "Cannot use both head and tail at the same time.",
  });

export function register(server: McpServer): void {
  server.registerTool(
    "readLog",
    {
      description:
        "Read and compress a log file using semantic pattern extraction. Returns a compressed summary with 60-90% token reduction, ideal for analyzing logs without loading raw content into context.",
      inputSchema: schema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const result = await Promise.race([
          processLog(input),
          timeout(timeoutMs),
        ]);
        return { content: [{ type: "text", text: result }] };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: String(err) }],
        };
      }
    },
  );
}

async function processLog(input: z.infer<typeof schema>): Promise<string> {
  const filePath = resolve(process.cwd(), input.path);
  const content = await readFile(filePath, "utf-8");

  let lines = content.split(/\r?\n/).filter((line) => line.length > 0);

  // Apply head/tail
  if (input.head) {
    lines = lines.slice(0, input.head);
  } else if (input.tail) {
    lines = lines.slice(-input.tail);
  }

  // Apply grep filter
  if (input.grep) {
    const regex = new RegExp(input.grep);
    lines = lines.filter((line) => regex.test(line));
  }

  if (lines.length === 0) {
    return "No log lines to process (file empty or all lines filtered out).";
  }

  const result = compress(lines, {
    format: input.format,
    drain: {
      depth: input.depth,
      simThreshold: input.simThreshold,
    },
  });

  return result.formatted;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout: exceeded ${ms}ms`)), ms),
  );
}
