import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { access, rename } from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";

const schema = z.object({
  from: z
    .union([z.string(), z.array(z.string())])
    .describe("Source path(s) to move."),
  to: z.string().describe("Destination directory."),
  overwrite: z.boolean().describe("If true, overwrite existing files."),
});

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function register(server: McpServer): void {
  server.registerTool(
    "moveFileOrDir",
    {
      description:
        "Move one or more files or directories to a destination directory.",
      inputSchema: schema,
      annotations: {
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const sources = Array.isArray(input.from) ? input.from : [input.from];
        for (const src of sources) {
          const dest = join(input.to, basename(src));
          if (!input.overwrite && (await exists(dest))) {
            throw new Error(
              `Destination exists: ${dest}. Set overwrite=true to replace.`,
            );
          }
          await rename(src, dest);
        }
        return {
          content: [{ type: "text", text: `Moved ${sources.length} path(s).` }],
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
