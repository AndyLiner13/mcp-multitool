import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const DEFAULT_MAX_MS = 300_000;
const maxMs = parseMaxDuration();

function parseMaxDuration(): number {
  const env = process.env.waitMaxDurationMs;
  if (!env) return DEFAULT_MAX_MS;
  const parsed = Number(env);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    process.stderr.write(
      `Invalid waitMaxDurationMs: "${env}". Must be a positive number.\n`,
    );
    process.exit(1);
  }
  return parsed;
}

const schema = z.object({
  durationMs: z
    .number()
    .int()
    .min(1)
    .max(maxMs)
    .describe(`Milliseconds to wait. Min: 1, max: ${maxMs}.`),
  reason: z
    .string()
    .min(1)
    .max(64)
    .describe("Why the wait is needed. Max 64 characters."),
});

export function register(server: McpServer): void {
  server.registerTool(
    "wait",
    {
      description: "Wait for a specified duration before continuing.",
      inputSchema: schema,
    },
    async (input) => {
      try {
        await new Promise((r) => setTimeout(r, input.durationMs));
        return {
          content: [
            { type: "text", text: `${input.durationMs}ms have passed.` },
          ],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: "text", text: String(err) }],
          isError: true,
        };
      }
    },
  );
}
