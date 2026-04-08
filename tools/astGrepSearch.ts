import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Lang, findInFiles } from "@ast-grep/napi";

const builtinLangs = [
  "javascript",
  "typescript",
  "tsx",
  "html",
  "css",
] as const;

const langMap: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  tsx: "Tsx",
  html: "Html",
  css: "Css",
};

const schema = z.object({
  pattern: z
    .string()
    .min(1)
    .describe(
      "AST pattern to match. Use $VAR for single-node metavariables, $$$VAR for multiple nodes. Example: 'console.log($ARG)' matches any console.log call.",
    ),
  paths: z
    .union([z.string(), z.array(z.string())])
    .describe(
      "File or directory path(s) to search. Directories are searched recursively.",
    ),
  lang: z
    .enum(builtinLangs)
    .describe(
      "Language to parse. Built-in: javascript, typescript, tsx, html, css",
    ),
});

export function register(server: McpServer): void {
  server.registerTool(
    "astGrepSearch",
    {
      description:
        "Search code using AST patterns. Matches code structure, not text. " +
        "Use $VAR for single-node wildcards (e.g., 'console.log($ARG)'), $$$VAR for multiple nodes. " +
        "More precise than regex for code search. " +
        "Languages: javascript, typescript, tsx, html, css.",
      inputSchema: schema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => {
      try {
        const lang = langMap[input.lang];
        const paths = Array.isArray(input.paths) ? input.paths : [input.paths];

        const results: Array<{
          file: string;
          range: {
            start: { line: number; column: number };
            end: { line: number; column: number };
          };
          text: string;
        }> = [];
        const errors: Error[] = [];

        await findInFiles(
          lang as Lang,
          {
            paths,
            matcher: { rule: { pattern: input.pattern } },
          },
          (err, nodes) => {
            if (err) {
              errors.push(err);
              return;
            }
            const file = nodes[0]?.getRoot().filename() ?? "";
            for (const node of nodes) {
              results.push({
                file,
                range: node.range(),
                text: node.text(),
              });
            }
          },
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { results, errors: errors.map(String) },
                null,
                2,
              ),
            },
          ],
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
