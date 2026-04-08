import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const DEFAULT_MAX_SECONDS = 300;
const maxSeconds = parseMaxDuration();

function parseMaxDuration(): number {
  const env = process.env.waitMaxDurationSeconds;
  if (!env) return DEFAULT_MAX_SECONDS;
  const parsed = Number(env);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    process.stderr.write(
      `Invalid waitMaxDurationSeconds: "${env}". Must be a positive number.\n`,
    );
    process.exit(1);
  }
  return parsed;
}

const schema = z.object({
  durationSeconds: z
    .number()
    .int()
    .min(1)
    .max(maxSeconds)
    .describe(`Seconds to wait. Min: 1, max: ${maxSeconds}.`),
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
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (input) => {
      try {
        const ms = Math.round(input.durationSeconds * 1000);
        await new Promise((r) => setTimeout(r, ms));
        return {
          content: [
            { type: "text", text: `${input.durationSeconds}s have passed.` },
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
