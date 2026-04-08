# mcp-multitool

[![npm version](https://img.shields.io/npm/v/mcp-multitool)](https://www.npmjs.com/package/mcp-multitool)
[![npm downloads](https://img.shields.io/npm/dm/mcp-multitool)](https://www.npmjs.com/package/mcp-multitool)
[![license](https://img.shields.io/npm/l/mcp-multitool)](./LICENSE)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server with **file operations**, **log compression**, and **timing utilities**.

## Tools

| Tool         | Description                                          |
| ------------ | ---------------------------------------------------- |
| `checkFile`  | Check if a file or folder exists and return metadata |
| `deleteFile` | Delete files or directories (single or batch)        |
| `moveFile`   | Move files or directories to a new location          |
| `readLog`    | Read and compress logs with 60-90% token reduction   |
| `renameFile` | Rename a single file or folder                       |
| `wait`       | Pause execution for rate limits or timing            |

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

### `checkFile`

Check if a file or folder exists and return its metadata (type, size, timestamps, permissions). Returns an error if the path does not exist.

| Parameter | Type     | Required | Description                          |
| --------- | -------- | -------- | ------------------------------------ |
| `path`    | `string` | ✅       | Path to the file or folder to check. |

**Response:** JSON object with raw `fs.Stats` properties plus computed `name`, `path`, and `type` fields.

**Examples:**

```
checkFile  path="config.json"
checkFile  path="/var/log/"
checkFile  path="./src/index.ts"
```

---

### `deleteFile`

Delete one or more files or directories.

| Parameter   | Type                 | Required | Description                                           |
| ----------- | -------------------- | -------- | ----------------------------------------------------- |
| `paths`     | `string \| string[]` | ✅       | File or directory path(s) to delete.                  |
| `recursive` | `boolean`            | ✅       | If true, delete directories and contents recursively. |

**Response:** `"Deleted N path(s)."`

**Examples:**

```
deleteFile  paths="temp.txt"  recursive=false
deleteFile  paths=["a.txt", "b.txt"]  recursive=false
deleteFile  paths="build/"  recursive=true
```

---

### `moveFile`

Move one or more files or directories to a destination directory.

| Parameter   | Type                 | Required | Description                        |
| ----------- | -------------------- | -------- | ---------------------------------- |
| `from`      | `string \| string[]` | ✅       | Source path(s) to move.            |
| `to`        | `string`             | ✅       | Destination directory.             |
| `overwrite` | `boolean`            | ✅       | If true, overwrite existing files. |

**Response:** `"Moved N path(s)."`

**Examples:**

```
moveFile  from="old.txt"  to="archive/"  overwrite=false
moveFile  from=["a.txt", "b.txt"]  to="backup/"  overwrite=false
moveFile  from="config.json"  to="dest/"  overwrite=true
```

---

### `readLog`

Compress a log file using semantic pattern extraction (60-90% token reduction). Creates stateful drains for incremental reads. Use `flushLog` to release.

**Stateful drains:** On first call for a file, creates a stateful drain. Subsequent calls append only new lines to the existing drain, preserving template IDs. This enables incremental log analysis as files grow. When any drain is active, a dynamic `flushLog` tool appears to release drains.

| Parameter      | Type      | Required | Description                                      |
| -------------- | --------- | -------- | ------------------------------------------------ |
| `path`         | `string`  | ✅       | Path to the log file.                            |
| `format`       | `string`  | ✅       | Output format: `summary`, `detailed`, or `json`. |
| `depth`        | `integer` | ✅       | Parse tree depth (2-8).                          |
| `simThreshold` | `number`  | ✅       | Similarity threshold (0-1).                      |
| `tail`         | `integer` | —        | Last N lines (first read only).                  |
| `head`         | `integer` | —        | First N lines (first read only).                 |
| `grep`         | `string`  | —        | Regex filter for lines.                          |

**Response:** Compressed log summary showing unique templates and occurrence counts.

**Examples:**

```
readLog  path="/var/log/app.log"  format="summary"  depth=4  simThreshold=0.4
readLog  path="./logs/server.log"  format="detailed"  depth=4  simThreshold=0.4  tail=1000
readLog  path="app.log"  format="json"  depth=6  simThreshold=0.3  grep="ERROR|WARN"
```

---

### `flushLog` (dynamic)

Release a log drain to free memory. Next `readLog` creates fresh drain. **This tool only appears when at least one drain is active.** When the last drain is flushed, the tool is automatically removed.

| Parameter | Type     | Required | Description                    |
| --------- | -------- | -------- | ------------------------------ |
| `path`    | `string` | ✅       | Path to the log file to flush. |

**Response:** `"Flushed {filename}. Released N templates from M lines."`

**Example:**

```
flushLog  path="/var/log/app.log"
```

---

### `renameFile`

Rename a single file or folder. Only the name can change — the parent directory must stay the same. Use `moveFile` to change directories.

| Parameter | Type     | Required | Description                               |
| --------- | -------- | -------- | ----------------------------------------- |
| `oldPath` | `string` | ✅       | Current path to the file or folder.       |
| `newPath` | `string` | ✅       | New path with the renamed file or folder. |

**Response:** `"Renamed "{oldName}" to "{newName}"."`

**Examples:**

```
renameFile  oldPath="config.json"  newPath="config.backup.json"
renameFile  oldPath="/app/src"  newPath="/app/source"
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

| Variable                 | Default | Description                                                                                                    |
| ------------------------ | ------- | -------------------------------------------------------------------------------------------------------------- |
| `waitMaxDurationSeconds` | `300`   | Override the maximum allowed `durationSeconds`. Must be a positive number. Server refuses to start if invalid. |
| `readLogTimeoutMs`       | `5000`  | Override the timeout for `readLog` processing in milliseconds. Server refuses to start if invalid.             |
| `checkFile`              | _(on)_  | Set to `"false"` to disable the `checkFile` tool at startup.                                                   |
| `deleteFile`             | _(on)_  | Set to `"false"` to disable the `deleteFile` tool at startup.                                                  |
| `moveFile`               | _(on)_  | Set to `"false"` to disable the `moveFile` tool at startup.                                                    |
| `readLog`                | _(on)_  | Set to `"false"` to disable the `readLog` tool at startup.                                                     |
| `renameFile`             | _(on)_  | Set to `"false"` to disable the `renameFile` tool at startup.                                                  |
| `wait`                   | _(on)_  | Set to `"false"` to disable the `wait` tool at startup.                                                        |

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
