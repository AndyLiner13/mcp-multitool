# Changelog

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

---

## [Unreleased]

### Fixed

- **`readLogFile` — passthrough on negative compression:** When the Drain tokenizer produces a larger output than the input (e.g. JSON/structured logs where spacing between tokens bloats the result), the tool now returns raw lines instead of the template-formatted body. The header stats are always emitted so the agent can see the template count and compression ratios. Previously the tool returned the bloated template list unconditionally, wasting context.

---

## [0.1.19]

### Fixed

- **`ripgrepSearch` — agent parameter misuse:** Redesigned `args` from `z.array(z.string())` to a flat `z.string()`. The agent now writes the full ripgrep command as a single string (e.g. `"rg -i TODO src/"`). Previously the array schema caused the MCP SDK to silently strip unknown fields, so only flags like `["-n"]` reached the handler, always producing `"rg requires at least one pattern"`. Spawn now uses `shell: true` — pure CLI passthrough, no binary injection. Removed `@vscode/ripgrep` dependency.

- **All file-op tools — relative path resolution:** All tools (`checkFileOrDir`, `cloneFileOrDir`, `deleteFileOrDir`, `moveFileOrDir`, `renameFileOrDir`, `readLogFile`, `ripgrepSearch`) now resolve relative paths against `roots[0]` from the MCP client's roots capability, falling back to `process.cwd()`. Previously relative paths depended on how the server was launched, not the user's workspace.

- **All tools — `additionalProperties: false` schema contradiction:** Migrated all tool files from `import { z } from "zod"` to `import * as z from "zod/v4"`. The MCP SDK routes Zod v4 schemas through `z4mini.toJSONSchema()`, which does not emit `additionalProperties: false`. Zod v3 (via `zod-to-json-schema`) emitted this on every `z.object()`, creating a JSON Schema contradiction where required fields were simultaneously required and forbidden by some strict clients.

### Added

- **README — Working Directory section:** Documents roots resolution and explains how relative vs absolute paths are handled.
- **README — `ripgrepSearchTimeoutMs` env var:** Added to the Environment Variables reference table.
