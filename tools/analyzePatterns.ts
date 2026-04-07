import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { compress } from "logpare";
import { z } from "zod";

const schema = z.object({
  lines: z.array(z.string()).min(1).describe("Log lines to analyze."),
  maxPatterns: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum patterns to return."),
});

interface Template {
  pattern: string;
  occurrences: number;
  severity: string;
}

interface CompressResult {
  stats: {
    inputLines: number;
  };
  templates: Template[];
}

export function register(server: McpServer): void {
  server.registerTool(
    "analyzePatterns",
    {
      description:
        "Quick pattern analysis without full compression. Returns top N patterns " +
        "found in logs, useful for rapid log triage.",
      inputSchema: schema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (input) => {
      try {
        const result = compress(input.lines, {
          format: "json",
          maxTemplates: input.maxPatterns,
        }) as CompressResult;

        const patterns = result.templates.map((t) => ({
          pattern: t.pattern,
          count: t.occurrences,
          severity: t.severity,
        }));

        const output = {
          patterns,
          total: result.stats.inputLines,
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
