# mcp-multitool

[![npm version](https://img.shields.io/npm/v/mcp-multitool)](https://www.npmjs.com/package/mcp-multitool)
[![npm downloads](https://img.shields.io/npm/dm/mcp-multitool)](https://www.npmjs.com/package/mcp-multitool)
[![license](https://img.shields.io/npm/l/mcp-multitool)](./LICENSE)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server with **file operations**, **log compression**, and **timing utilities**.

## Tools

| Tool              | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `astGrepSearch`   | Search code using AST patterns                          |
| `checkFileOrDir`  | Check if a file or directory exists and return metadata |
| `cloneFileOrDir`  | Copy one or more files or directories to a destination  |
| `deleteFileOrDir` | Delete one or more files or directories                 |
| `moveFileOrDir`   | Move one or more files or directories to a new location |
| `readLogFile`     | Read and compress logs with 60-90% token reduction      |
| `renameFileOrDir` | Rename a single file or directory                       |
| `wait`            | Pause execution for rate limits or timing               |

## Why

Some tasks need simple utilities that don't warrant a larger server — cleaning up temp files, compressing verbose logs before analysis, pausing for rate limits. `mcp-multitool` gives any MCP-compatible client a small set of reliable tools.

## Quick Start

### Install

```bash
npx mcp-multitool
```

### Configure Your MCP Client

**VS Code** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "mcp-multitool": {
      "command": "npx",
      "args": ["mcp-multitool"]
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mcp-multitool": {
      "command": "npx",
      "args": ["mcp-multitool"]
    }
  }
}
```

**Cursor, Windsurf, Continue** — follow each client's MCP server documentation using the same `npx mcp-multitool` command.

## Tool Reference

### `astGrepSearch`

Search code using AST patterns. Matches code structure, not text. Use `$VAR` for single-node wildcards (e.g., `console.log($ARG)`), `$$$VAR` for multiple nodes. More precise than regex for code search.

| Parameter | Type                 | Required | Description                                                                      |
| --------- | -------------------- | -------- | -------------------------------------------------------------------------------- |
| `pattern` | `string`             | ✅       | AST pattern to match. Use `$VAR` for metavariables, `$$$VAR` for multiple nodes. |
| `paths`   | `string \| string[]` | ✅       | File or directory path(s) to search. Directories are searched recursively.       |
| `lang`    | `string`             | ✅       | Language to parse. Built-in: `javascript`, `typescript`, `tsx`, `html`, `css`.   |

**Response:** JSON object with `results` array (each with `file`, `range`, `text`) and `errors` array.

**Examples:**

```
astGrepSearch  pattern="console.log($ARG)"  paths="src"  lang="typescript"
astGrepSearch  pattern="function $NAME($$$PARAMS) { $$$BODY }"  paths=["lib", "src"]  lang="javascript"
astGrepSearch  pattern="<div $$$ATTRS>$$$CHILDREN</div>"  paths="components"  lang="tsx"
```

---

### `checkFileOrDir`

Check if a file or directory exists and return its metadata (type, size, timestamps, permissions). Returns an error if the path does not exist.

| Parameter | Type     | Required | Description                             |
| --------- | -------- | -------- | --------------------------------------- |
| `path`    | `string` | ✅       | Path to the file or directory to check. |

**Response:** JSON object with raw `fs.Stats` properties plus computed `name`, `path`, and `type` fields.

**Examples:**

```
checkFileOrDir  path="config.json"
checkFileOrDir  path="/var/log/"
checkFileOrDir  path="./src/index.ts"
```

---

### `cloneFileOrDir`

Copy one or more files or directories to a destination directory.

| Parameter   | Type                 | Required | Description                        |
| ----------- | -------------------- | -------- | ---------------------------------- |
| `from`      | `string \| string[]` | ✅       | Source path(s) to clone.           |
| `to`        | `string`             | ✅       | Destination directory.             |
| `overwrite` | `boolean`            | ✅       | If true, overwrite existing files. |

**Response:** JSON array of `{source, destination}` objects showing each cloned path.

**Examples:**

```
cloneFileOrDir  from="config.json"  to="backup/"  overwrite=false
cloneFileOrDir  from=["a.txt", "b.txt"]  to="copies/"  overwrite=false
cloneFileOrDir  from="src/"  to="archive/"  overwrite=true
```

---

### `deleteFileOrDir`

Delete one or more files or directories.

| Parameter   | Type                 | Required | Description                                           |
| ----------- | -------------------- | -------- | ----------------------------------------------------- |
| `paths`     | `string \| string[]` | ✅       | File or directory path(s) to delete.                  |
| `recursive` | `boolean`            | ✅       | If true, delete directories and contents recursively. |

**Response:** `"Deleted N path(s)."`

**Examples:**

```
deleteFileOrDir  paths="temp.txt"  recursive=false
deleteFileOrDir  paths=["a.txt", "b.txt"]  recursive=false
deleteFileOrDir  paths="build/"  recursive=true
```

---

### `moveFileOrDir`

Move one or more files or directories to a destination directory.

| Parameter   | Type                 | Required | Description                        |
| ----------- | -------------------- | -------- | ---------------------------------- |
| `from`      | `string \| string[]` | ✅       | Source path(s) to move.            |
| `to`        | `string`             | ✅       | Destination directory.             |
| `overwrite` | `boolean`            | ✅       | If true, overwrite existing files. |

**Response:** `"Moved N path(s)."`

**Examples:**

```
moveFileOrDir  from="old.txt"  to="archive/"  overwrite=false
moveFileOrDir  from=["a.txt", "b.txt"]  to="backup/"  overwrite=false
moveFileOrDir  from="config.json"  to="dest/"  overwrite=true
```

---

### `readLogFile`

Compress a log file using semantic pattern extraction. Groups similar lines into templates with `<*>` wildcards for variable parts. **Stateless** — each call processes the file fresh.

**Content-hashed template IDs:** Template IDs are 12-character base64URL hashes derived from the pattern itself. The same pattern **always** gets the same ID, regardless of file order or when you call the tool. This means drill-down always works if the pattern still exists.

| Parameter      | Type      | Required | Description                                                        |
| -------------- | --------- | -------- | ------------------------------------------------------------------ |
| `path`         | `string`  | ✅       | Path to the log file.                                              |
| `simThreshold` | `number`  | ✅       | Similarity threshold (0-1). Lower values group more aggressively.  |
| `tail`         | `integer` | —        | Last N lines.                                                      |
| `head`         | `integer` | —        | First N lines.                                                     |
| `grep`         | `string`  | —        | Regex filter for lines before compression.                         |
| `templateId`   | `string`  | —        | Drill into a specific template by its hash ID for sample captures. |

**Response:** Compressed log summary showing template IDs, occurrence counts, and patterns with `<*>` wildcards.

**Examples:**

```
readLogFile  path="/var/log/app.log"  simThreshold=0.4
readLogFile  path="./logs/server.log"  simThreshold=0.4  tail=1000
readLogFile  path="app.log"  simThreshold=0.3  grep="ERROR|WARN"
readLogFile  path="app.log"  simThreshold=0.4  templateId="aB3x_Yz7Q2Kf"
```

<details>
<summary><strong>Algorithm Notes</strong></summary>

This tool implements the [Drain algorithm](https://jiemingzhu.github.io/pub/pjhe_icws2017.pdf) (He et al., ICWS 2017) for online log parsing with content-hashed template IDs:

**Tree routing:** Lines are routed by token count → first N tokens (default N=2, configurable via `readLogFileRoutingDepth`). This deterministic routing ensures lines with different prefixes are never compared, preventing "cross-contamination" between unrelated patterns.

**Content-hashed template IDs:** Template IDs are 12-character base64URL hashes derived from the pattern itself. The same pattern always produces the same ID, enabling stateless drill-down across calls.

**Wildcard matching:** Variable tokens (timestamps, IDs, numbers) are replaced with `<*>` wildcards. Tokens starting with digits or matching hex patterns are automatically routed to wildcard buckets.

**Tuning:** If you see all-wildcard templates (e.g., `<*> <*> <*> <*>`), try increasing `readLogFileRoutingDepth` to 3 or 4. If you hit memory issues on very large logs, reduce it to 1.

</details>

---

### `renameFileOrDir`

Rename a single file or directory. Only the name can change — the parent directory must stay the same. Use `moveFileOrDir` to change directories.

| Parameter | Type     | Required | Description                                  |
| --------- | -------- | -------- | -------------------------------------------- |
| `oldPath` | `string` | ✅       | Current path to the file or directory.       |
| `newPath` | `string` | ✅       | New path with the renamed file or directory. |

**Response:** `"Renamed "{oldName}" to "{newName}"."`

**Examples:**

```
renameFileOrDir  oldPath="config.json"  newPath="config.backup.json"
renameFileOrDir  oldPath="/app/src"  newPath="/app/source"
```

---

### `wait`

Wait for a specified duration before continuing.

| Parameter         | Type      | Required | Description                                                                               |
| ----------------- | --------- | -------- | ----------------------------------------------------------------------------------------- |
| `durationSeconds` | `integer` | ✅       | How long to wait in seconds. Must be ≥ 1 and ≤ the configured max (default: 300 / 5 min). |
| `reason`          | `string`  | ✅       | Why the wait is needed. Max 64 characters.                                                |

**Response:** `"Ns have passed."`

**Examples:**

```
wait  durationSeconds=2  reason="settling after write"
wait  durationSeconds=5  reason="rate limit cooldown"
wait  durationSeconds=1  reason="animation to complete"
```

## Environment Variables

| Variable                  | Default | Description                                                                                                                     |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `waitMaxDurationSeconds`  | `300`   | Override the maximum allowed `durationSeconds`. Must be a positive number. Server refuses to start if invalid.                  |
| `readLogFileTimeoutMs`    | `5000`  | Override the timeout for `readLogFile` processing in milliseconds. Server refuses to start if invalid.                          |
| `readLogFileRoutingDepth` | `2`     | Tree routing depth (1-5). Higher values isolate more but increase memory. Tune if you see all-wildcard templates or OOM errors. |
| `astGrepSearch`           | _(on)_  | Set to `"false"` to disable the `astGrepSearch` tool at startup.                                                                |
| `checkFileOrDir`          | _(on)_  | Set to `"false"` to disable the `checkFileOrDir` tool at startup.                                                               |
| `cloneFileOrDir`          | _(on)_  | Set to `"false"` to disable the `cloneFileOrDir` tool at startup.                                                               |
| `deleteFileOrDir`         | _(on)_  | Set to `"false"` to disable the `deleteFileOrDir` tool at startup.                                                              |
| `moveFileOrDir`           | _(on)_  | Set to `"false"` to disable the `moveFileOrDir` tool at startup.                                                                |
| `readLogFile`             | _(on)_  | Set to `"false"` to disable the `readLogFile` tool at startup.                                                                  |
| `renameFileOrDir`         | _(on)_  | Set to `"false"` to disable the `renameFileOrDir` tool at startup.                                                              |
| `wait`                    | _(on)_  | Set to `"false"` to disable the `wait` tool at startup.                                                                         |

### Disabling Individual Tools

Every tool can be disabled by setting its name to `"false"` in the `env` block of your MCP config.

**VS Code** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "mcp-multitool": {
      "command": "npx",
      "args": ["mcp-multitool"],
      "env": {
        "wait": "false"
      }
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mcp-multitool": {
      "command": "npx",
      "args": ["mcp-multitool"],
      "env": {
        "wait": "false"
      }
    }
  }
}
```

Tools are enabled by default. Only tools explicitly set to `"false"` are skipped at startup.

## Requirements

- Node.js >= 20
