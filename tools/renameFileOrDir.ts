import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rename, stat } from "node:fs/promises";
import { dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const schema = z.object({
  oldPath: z.string().min(1).describe("Current path to the file or directory."),
  newPath: z
    .string()
    .min(1)
    .describe("New path with the renamed file or directory."),
});

export function register(server: McpServer): void {
  server.registerTool(
    "renameFileOrDir",
    {
      description:
        "Rename a single file or directory. Only the name can change — the parent directory must stay the same. Use moveFileOrDir to change directories. Relative paths are resolved against the first MCP root (typically the workspace folder).",
      inputSchema: schema,
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const cwd = await resolveCwd(server);
        const oldPath = resolve(cwd, input.oldPath);
        const newPath = resolve(cwd, input.newPath);

        if (dirname(oldPath) !== dirname(newPath)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Parent directory must match. Use moveFileOrDir to change directories.",
              },
            ],
          };
        }

        const oldName = basename(oldPath);
        const newName = basename(newPath);

        if (oldName === newName) {
          return {
            content: [
              {
                type: "text",
                text: `Nothing to rename — names are identical.`,
              },
            ],
          };
        }

        await stat(oldPath); // Verify exists
        await rename(oldPath, newPath);

        return {
          content: [
            { type: "text", text: `Renamed "${oldName}" to "${newName}".` },
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
