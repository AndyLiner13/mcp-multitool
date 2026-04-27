import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { access, cp, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod/v4";

const schema = z.object({
  from: z
    .union([z.string(), z.array(z.string())])
    .describe("Source path(s) to clone."),
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
    "cloneFileOrDir",
    {
      description:
        "Copy one or more files or directories to a destination directory. Relative paths are resolved against the first MCP root (typically the workspace folder).",
      inputSchema: schema,
      annotations: {
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const cwd = await resolveCwd(server);
        const sources = Array.isArray(input.from) ? input.from : [input.from];
        const destDir = resolve(cwd, input.to);
        await mkdir(destDir, { recursive: true });
        const results: { source: string; destination: string }[] = [];

        for (const src of sources) {
          const srcPath = resolve(cwd, src);
          const destPath = join(destDir, basename(src));

          if (!input.overwrite && (await exists(destPath))) {
            throw new Error(
              `Destination exists: ${destPath}. Set overwrite=true to replace.`,
            );
          }

          await cp(srcPath, destPath, {
            recursive: true,
            force: input.overwrite,
          });
          results.push({ source: srcPath, destination: destPath });
        }

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
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
