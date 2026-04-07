import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  compressText as logpareCompressText,
  type CompressOptions,
} from "logpare";
import { z } from "zod";

const schema = z.object({
  text: z.string().min(1).describe("Multi-line log text to compress."),
  format: z
    .enum(["summary", "detailed", "json"])
    .default("summary")
    .describe(
      "Output format: summary (compact), detailed (full metadata), json (machine-readable).",
    ),
  depth: z
    .number()
    .int()
    .min(2)
    .max(8)
    .default(4)
    .describe("Parse tree depth for pattern matching (2-8)."),
  simThreshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.4)
    .describe("Similarity threshold for template matching (0.0-1.0)."),
  maxTemplates: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(50)
    .describe("Maximum templates to include in output."),
});

export function register(server: McpServer): void {
  server.registerTool(
    "compressText",
    {
      description:
        "Compress a multi-line log text string. Automatically splits on newlines " +
        "and processes as individual log lines.",
      inputSchema: schema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (input) => {
      try {
        const options: CompressOptions = {
          format: input.format,
          maxTemplates: input.maxTemplates,
          drain: {
            depth: input.depth,
            simThreshold: input.simThreshold,
          },
        };

        const result = logpareCompressText(input.text, options);
        return {
          content: [{ type: "text", text: result.formatted }],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: String(err) }],
        };
      }
    },
  );
}
