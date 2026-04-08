# mcp-multitool

[![npm version](https://img.shields.io/npm/v/mcp-multitool)](https://www.npmjs.com/package/mcp-multitool)
[![npm downloads](https://img.shields.io/npm/dm/mcp-multitool)](https://www.npmjs.com/package/mcp-multitool)
[![license](https://img.shields.io/npm/l/mcp-multitool)](./LICENSE)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server with **file operations**, **log compression**, and **timing utilities**.

## Tools

| Tool         | Description                                        |
| ------------ | -------------------------------------------------- |
| `deleteFile` | Delete files or directories (single or batch)      |
| `moveFile`   | Move/rename files or directories                   |
| `readLog`    | Read and compress logs with 60-90% token reduction |
| `wait`       | Pause execution for rate limits or timing          |

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

### `deleteFile`

Delete one or more files or directories.

| Parameter   | Type                 | Required | Default | Description                                           |
| ----------- | -------------------- | -------- | ------- | ----------------------------------------------------- |
| `paths`     | `string \| string[]` | ✅       | —       | File or directory path(s) to delete.                  |
| `recursive` | `boolean`            | —        | `false` | If true, delete directories and contents recursively. |

**Response:** `"Deleted N path(s)."`

**Examples:**

```
deleteFile  paths="temp.txt"
deleteFile  paths=["a.txt", "b.txt"]
deleteFile  paths="build/"  recursive=true
```

---

### `moveFile`

Move one or more files or directories to a destination directory.

| Parameter   | Type                 | Required | Default | Description                        |
| ----------- | -------------------- | -------- | ------- | ---------------------------------- |
| `from`      | `string \| string[]` | ✅       | —       | Source path(s) to move.            |
| `to`        | `string`             | ✅       | —       | Destination directory.             |
| `overwrite` | `boolean`            | —        | `false` | If true, overwrite existing files. |

**Response:** `"Moved N path(s)."`

**Examples:**

```
moveFile  from="old.txt"  to="archive/"
moveFile  from=["a.txt", "b.txt"]  to="backup/"
moveFile  from="config.json"  to="dest/"  overwrite=true
```

---

### `readLog`

Read and compress a log file using semantic pattern extraction. Returns a compressed summary with 60-90% token reduction, ideal for analyzing logs without loading raw content into context.

| Parameter      | Type      | Required | Description                                                           |
| -------------- | --------- | -------- | --------------------------------------------------------------------- |
| `path`         | `string`  | ✅       | Path to the log file (absolute or relative to cwd).                   |
| `format`       | `string`  | ✅       | Output format: `summary`, `detailed`, or `json`.                      |
| `depth`        | `integer` | ✅       | Parse tree depth for pattern matching (2-8). Higher = more specific.  |
| `simThreshold` | `number`  | ✅       | Similarity threshold for grouping (0.0-1.0). Lower = more aggressive. |
| `tail`         | `integer` | —        | Only read the last N lines of the file.                               |
| `head`         | `integer` | —        | Only read the first N lines of the file.                              |
| `grep`         | `string`  | —        | Filter lines matching this regex before compression.                  |

**Response:** Compressed log summary showing unique templates and occurrence counts.

**Examples:**

```
readLog  path="/var/log/app.log"  format="summary"  depth=4  simThreshold=0.4
readLog  path="./logs/server.log"  format="detailed"  depth=4  simThreshold=0.4  tail=1000
readLog  path="app.log"  format="json"  depth=6  simThreshold=0.3  grep="ERROR|WARN"
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
| `deleteFile`             | _(on)_  | Set to `"false"` to disable the `deleteFile` tool at startup.                                                  |
| `moveFile`               | _(on)_  | Set to `"false"` to disable the `moveFile` tool at startup.                                                    |
| `readLog`                | _(on)_  | Set to `"false"` to disable the `readLog` tool at startup.                                                     |
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
