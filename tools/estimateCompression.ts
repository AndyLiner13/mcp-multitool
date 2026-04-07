import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { compress } from "logpare";
import { z } from "zod";

const schema = z.object({
  lines: z.array(z.string()).min(1).describe("Log lines to sample."),
  sampleSize: z
    .number()
    .int()
    .min(100)
    .max(10000)
    .default(1000)
    .describe("Number of lines to sample for estimation."),
});

interface CompressResult {
  stats: {
    uniqueTemplates: number;
    compressionRatio: number;
    estimatedTokenReduction: number;
  };
}

export function register(server: McpServer): void {
  server.registerTool(
    "estimateCompression",
    {
      description:
        "Estimate compression ratio without full processing. Samples a subset of " +
        "logs to predict compression effectiveness.",
      inputSchema: schema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (input) => {
      try {
        const sampleSize = Math.min(input.sampleSize, input.lines.length);
        const sample = input.lines.slice(0, sampleSize);

        const result = compress(sample, { format: "json" }) as CompressResult;

        const output = {
          sampleSize,
          totalLines: input.lines.length,
          estimatedTemplates: Math.round(
            result.stats.uniqueTemplates * (input.lines.length / sampleSize),
          ),
          estimatedCompressionRatio: result.stats.compressionRatio,
          estimatedTokenReduction: result.stats.estimatedTokenReduction,
          recommendation:
            result.stats.compressionRatio > 0.5 ?
              "Good compression expected"
            : "Limited compression - logs may be highly variable",
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
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
