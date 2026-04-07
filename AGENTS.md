# mcp-multitool Codebase Instructions

## Philosophy

This is a **minimal** MCP server. The core principles are:

### 1. One File Per Tool

Each tool lives in `tools/{toolName}.ts` and exports a single `register(server)` function. No tool logic bleeds into `index.ts`.

### 2. Minimal Shared Infrastructure

`index.ts` only imports tools and registers them. No shared utilities unless two or more tools genuinely need the same code.

### 3. Validation At Startup

Environment variable parsing and validation happens at module load time. If configuration is invalid, the process exits immediately with a clear error — never fail silently at call time.

## Tool Definitions (MCP Best Practices)

Follow the [MCP tool best practices](https://modelcontextprotocol.io/legacy/concepts/tools#best-practices) for all tool definitions.

### Tool Name (`name`)

- camelCase, describing the action performed (e.g. `wait`, `fetchUrl`, `readFile`)
- Short, unambiguous, and unique within the server

### Tool Description (`description`)

Write for LLMs, not protocol developers. The description must help the model know:

1. **What the tool does** — lead with a clear, concise statement
2. **When to use it** — include context that helps the model choose this tool over alternatives
3. **What it returns** — describe the response shape

### Input Schema

- Use `zod` to define all schemas
- Every parameter gets a `.describe()` with a concise description
- Validation constraints (`.min()`, `.max()`, `.int()`) must match documented behaviour

### Annotations

| Annotation              | When to use                                     |
| ----------------------- | ----------------------------------------------- |
| `readOnlyHint: true`    | Tools that only read/query, no side effects     |
| `destructiveHint: true` | Tools that modify external state or files       |
| `idempotentHint: true`  | Tools where repeated calls have no extra effect |
| `openWorldHint: false`  | Tools that operate only on local resources      |

### Error Handling

Every tool handler **must** wrap its entire body in `try/catch` and return errors as tool results with `isError: true`. Never throw at the MCP protocol level — the LLM must always receive a structured error it can reason about.

```typescript
try {
  // implementation
} catch (err: unknown) {
  return {
    isError: true,
    content: [{ type: "text", text: String(err) }],
  };
}
```

## Project Structure

```
mcp-multitool/
├── index.ts        # Entry point — imports and registers all tools
├── tools/          # One file per tool, each exports register(server)
│   └── wait.ts
└── README.md
```

## Adding a New Tool

1. **Create `tools/{toolName}.ts`** — camelCase, matching the action performed
2. **Define a zod schema** for the input
3. **Export a `register(server: McpServer): void` function** that calls `server.registerTool(...)`
4. **Add `if (isEnabled("{toolName}")) register{ToolName}(server);`** in `index.ts`
5. **Document the tool** in the Tool Reference section of `README.md`, including its env disable key

### Minimal tool template

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const schema = z.object({
  // parameters here
});

export function register(server: McpServer): void {
  server.registerTool(
    "toolName",
    {
      description: "Description for the LLM.",
      inputSchema: schema,
    },
    async (input) => {
      try {
        // implementation
        return { content: [{ type: "text", text: "result" }] };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: String(err) }],
        };
      }
    },
  );
}
```
