import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rm } from "node:fs/promises";
import { z } from "zod";

const schema = z.object({
  paths: z
    .union([z.string(), z.array(z.string())])
    .describe("File or directory path(s) to delete."),
  recursive: z
    .boolean()
    .describe("If true, delete directories and contents recursively."),
});

export function register(server: McpServer): void {
  server.registerTool(
    "deleteFileOrDir",
    {
      description: "Delete one or more files or directories.",
      inputSchema: schema,
      annotations: {
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const paths = Array.isArray(input.paths) ? input.paths : [input.paths];
        await Promise.all(
          paths.map((p) => rm(p, { recursive: input.recursive })),
        );
        return {
          content: [{ type: "text", text: `Deleted ${paths.length} path(s).` }],
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
