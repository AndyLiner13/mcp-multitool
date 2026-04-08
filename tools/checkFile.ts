import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { lstat } from "node:fs/promises";
import { basename, resolve } from "node:path";

const schema = z.object({
  path: z.string().min(1).describe("Path to the file or folder to check."),
});

export function register(server: McpServer): void {
  server.registerTool(
    "checkFile",
    {
      description:
        "Check if a file or folder exists and return its metadata (type, size, timestamps, permissions). Returns an error if the path does not exist.",
      inputSchema: schema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const fullPath = resolve(process.cwd(), input.path);
        const stats = await lstat(fullPath);

        const type =
          stats.isFile() ? "file"
          : stats.isDirectory() ? "directory"
          : stats.isSymbolicLink() ? "symlink"
          : stats.isBlockDevice() ? "block-device"
          : stats.isCharacterDevice() ? "character-device"
          : stats.isFIFO() ? "fifo"
          : stats.isSocket() ? "socket"
          : "unknown";

        // Build output from raw stats, adding computed fields
        const meta: Record<string, unknown> = {
          name: basename(fullPath),
          path: fullPath,
          type,
          ...stats,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(meta, null, 2) }],
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
