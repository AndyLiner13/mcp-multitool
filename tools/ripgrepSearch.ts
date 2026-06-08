import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as z from "zod/v4";

const timeoutMs = parseTimeoutMs();

function parseTimeoutMs(): number {
  const env = process.env.ripgrepSearchTimeoutMs;
  if (env === undefined || env === "") return 0;
  const parsed = Number(env);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    process.stderr.write(
      `Invalid ripgrepSearchTimeoutMs: "${env}". Must be a non-negative integer (0 = unlimited).\n`,
    );
    process.exit(1);
  }
  return parsed;
}

const schema = z.object({
  args: z
    .string()
    .describe(
      "The ripgrep command line exactly as you would type it in a terminal, starting with 'rg'. " +
        "Example: 'rg -i TODO .' or 'rg -A 3 myPattern src/'. " +
        "The 'rg' binary is resolved automatically — just write the command as you normally would. " +
        "For all available flags: 'rg --help'.",
    ),
});

export function register(server: McpServer): void {
  server.registerTool(
    "ripgrepSearch",
    {
      description:
        "Run a ripgrep search by passing the full command as a string, exactly as you would type it in a terminal. " +
        "The 'rg' binary is resolved to the bundled ripgrep automatically. " +
        "Returns rg's stdout verbatim on success (exit code 0 = matches found, exit code 1 = no matches). " +
        "Returns rg's stderr with isError=true on error (exit code 2+). " +
        "Working directory is the first MCP root (typically the workspace root); falls back to process.cwd() if no roots are available.",
      inputSchema: schema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const cwd = await resolveCwd(server);
        const { stdout, stderr, exitCode } = await runRg(input.args, cwd);
        // NOTE: exitCode 0 = matches found, 1 = no matches (not an error), 2+ = real error
        if (exitCode === 0 || exitCode === 1) {
          return { content: [{ type: "text", text: stdout }] };
        }
        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                stderr ||
                `rg exited with code ${exitCode} and produced no stderr output`,
            },
          ],
        };
      } catch (err: unknown) {
        if (err instanceof RipgrepTimeoutError) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `ripgrepSearch timed out after ${err.timeoutMs}ms (configured via ripgrepSearchTimeoutMs env var; set to 0 to disable).`,
              },
            ],
          };
        }
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

function runRg(
  args: string,
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(args, [], { cwd, shell: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer =
      timeoutMs > 0 ?
        setTimeout(() => {
          timedOut = true;
          child.kill();
        }, timeoutMs)
      : null;
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        reject(new RipgrepTimeoutError(timeoutMs));
        return;
      }
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });
  });
}

class RipgrepTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`ripgrepSearch timed out after ${timeoutMs}ms`);
    this.name = "RipgrepTimeoutError";
  }
}
