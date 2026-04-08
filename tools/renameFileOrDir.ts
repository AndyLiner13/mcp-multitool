import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rename, stat } from "node:fs/promises";
import { dirname, basename } from "node:path";

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
        "Rename a single file or directory. Only the name can change — the parent directory must stay the same. Use moveFileOrDir to change directories.",
      inputSchema: schema,
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        if (dirname(input.oldPath) !== dirname(input.newPath)) {
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

        const oldName = basename(input.oldPath);
        const newName = basename(input.newPath);

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

        await stat(input.oldPath); // Verify exists
        await rename(input.oldPath, input.newPath);

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
