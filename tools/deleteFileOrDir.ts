import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod/v4";

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
      description:
        "Delete one or more files or directories. Relative paths are resolved against the first MCP root (typically the workspace folder).",
      inputSchema: schema,
      annotations: {
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const cwd = await resolveCwd(server);
        const paths = Array.isArray(input.paths) ? input.paths : [input.paths];
        const resolved = paths.map((p) => resolve(cwd, p));
        await Promise.all(
          resolved.map((p) => rm(p, { recursive: input.recursive })),
        );
        return {
          content: [
            { type: "text", text: `Deleted ${resolved.length} path(s).` },
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

async function resolveCwd(server: McpServer): Promise<string> {
  try {
    const { roots } = await server.server.listRoots();
    const first = roots[0];
    if (first?.uri?.startsWith("file://")) {
      return fileURLToPath(first.uri);
    }
  } catch {
    // NOTE: Client doesn't support roots capability; fall back to process.cwd().
  }
  return process.cwd();
}
