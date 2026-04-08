# mcp-multitool

[![npm version](https://img.shields.io/npm/v/mcp-multitool)](https://www.npmjs.com/package/mcp-multitool)
[![npm downloads](https://img.shields.io/npm/dm/mcp-multitool)](https://www.npmjs.com/package/mcp-multitool)
[![license](https://img.shields.io/npm/l/mcp-multitool)](./LICENSE)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server with **file operations**, **log compression**, and **timing utilities**.

## Tools

| Tool              | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `checkFileOrDir`  | Check if a file or directory exists and return metadata |
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

Compress a log file using semantic pattern extraction (60-90% token reduction). Creates stateful drains for incremental reads. Use `flushLogFile` to release.

**Stateful drains:** On first call for a file, creates a stateful drain. Subsequent calls append only new lines to the existing drain, preserving template IDs. This enables incremental log analysis as files grow. When any drain is active, a dynamic `flushLogFile` tool appears to release drains.

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
readLogFile  path="/var/log/app.log"  format="summary"  depth=4  simThreshold=0.4
readLogFile  path="./logs/server.log"  format="detailed"  depth=4  simThreshold=0.4  tail=1000
readLogFile  path="app.log"  format="json"  depth=6  simThreshold=0.3  grep="ERROR|WARN"
```

---

### `flushLogFile` (dynamic)

Release a log drain to free memory. Next `readLogFile` creates fresh drain. **This tool only appears when at least one drain is active.** When the last drain is flushed, the tool is automatically removed.

| Parameter | Type     | Required | Description                    |
| --------- | -------- | -------- | ------------------------------ |
| `path`    | `string` | ✅       | Path to the log file to flush. |

**Response:** `"Flushed {filename}. Released N templates from M lines."`

**Example:**

```
flushLogFile  path="/var/log/app.log"
```

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

| Variable                 | Default | Description                                                                                                    |
| ------------------------ | ------- | -------------------------------------------------------------------------------------------------------------- |
| `waitMaxDurationSeconds` | `300`   | Override the maximum allowed `durationSeconds`. Must be a positive number. Server refuses to start if invalid. |
| `readLogFileTimeoutMs`   | `5000`  | Override the timeout for `readLogFile` processing in milliseconds. Server refuses to start if invalid.         |
| `checkFileOrDir`         | _(on)_  | Set to `"false"` to disable the `checkFileOrDir` tool at startup.                                              |
| `deleteFileOrDir`        | _(on)_  | Set to `"false"` to disable the `deleteFileOrDir` tool at startup.                                             |
| `moveFileOrDir`          | _(on)_  | Set to `"false"` to disable the `moveFileOrDir` tool at startup.                                               |
| `readLogFile`            | _(on)_  | Set to `"false"` to disable the `readLogFile` tool at startup.                                                 |
| `renameFileOrDir`        | _(on)_  | Set to `"false"` to disable the `renameFileOrDir` tool at startup.                                             |
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
