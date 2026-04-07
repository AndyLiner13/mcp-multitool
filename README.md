# mcp-multitool

[![npm version](https://img.shields.io/npm/v/mcp-multitool)](https://www.npmjs.com/package/mcp-multitool)
[![npm downloads](https://img.shields.io/npm/dm/mcp-multitool)](https://www.npmjs.com/package/mcp-multitool)
[![license](https://img.shields.io/npm/l/mcp-multitool)](./LICENSE)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server with **file operations**, **log compression**, and **timing utilities**.

## Tools

| Tool                  | Description                                     |
| --------------------- | ----------------------------------------------- |
| `deleteFile`          | Delete files or directories (single or batch)   |
| `moveFile`            | Move/rename files or directories                |
| `compressLogs`        | Compress log arrays with 60-90% token reduction |
| `compressText`        | Compress multi-line log text                    |
| `analyzePatterns`     | Quick pattern extraction from logs              |
| `estimateCompression` | Estimate compression ratio before processing    |
| `wait`                | Pause execution for rate limits or timing       |

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

### `analyzePatterns`

Quick pattern analysis without full compression. Returns top N patterns found in logs, useful for rapid log triage.

| Parameter     | Type       | Required | Default | Description                 |
| ------------- | ---------- | -------- | ------- | --------------------------- |
| `lines`       | `string[]` | ✅       | —       | Log lines to analyze.       |
| `maxPatterns` | `integer`  | —        | `20`    | Maximum patterns to return. |

**Response:** JSON object with `patterns` array and `total` line count.

**Examples:**

```
analyzePatterns  lines=["INFO Starting server", "INFO Starting server", "ERROR Failed"]
analyzePatterns  lines=[...logs]  maxPatterns=10
```

---

### `compressLogs`

Compress an array of log lines using semantic pattern extraction. Achieves 60-90% token reduction while preserving diagnostic context.

| Parameter      | Type       | Required | Default   | Description                                                             |
| -------------- | ---------- | -------- | --------- | ----------------------------------------------------------------------- |
| `lines`        | `string[]` | ✅       | —         | Log lines to compress.                                                  |
| `format`       | `string`   | —        | `summary` | Output format: `summary` (compact), `detailed` (full metadata), `json`. |
| `depth`        | `integer`  | —        | `4`       | Parse tree depth for pattern matching (2-8).                            |
| `simThreshold` | `number`   | —        | `0.4`     | Similarity threshold for template matching (0.0-1.0).                   |
| `maxTemplates` | `integer`  | —        | `50`      | Maximum templates to include in output.                                 |

**Response:** Compressed log summary showing unique templates and occurrence counts.

**Examples:**

```
compressLogs  lines=["2026-04-07 INFO Starting on port 3000", "2026-04-07 INFO Starting on port 3001"]
compressLogs  lines=[...logs]  format="json"  maxTemplates=20
```

---

### `compressText`

Compress a multi-line log text string. Automatically splits on newlines and processes as individual log lines.

| Parameter      | Type      | Required | Default   | Description                                                             |
| -------------- | --------- | -------- | --------- | ----------------------------------------------------------------------- |
| `text`         | `string`  | ✅       | —         | Multi-line log text to compress.                                        |
| `format`       | `string`  | —        | `summary` | Output format: `summary` (compact), `detailed` (full metadata), `json`. |
| `depth`        | `integer` | —        | `4`       | Parse tree depth for pattern matching (2-8).                            |
| `simThreshold` | `number`  | —        | `0.4`     | Similarity threshold for template matching (0.0-1.0).                   |
| `maxTemplates` | `integer` | —        | `50`      | Maximum templates to include in output.                                 |

**Response:** Compressed log summary showing unique templates and occurrence counts.

**Examples:**

```
compressText  text="INFO Starting server\nINFO Starting server\nERROR Failed"
compressText  text="<paste logs here>"  format="detailed"
```

---

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

### `estimateCompression`

Estimate compression ratio without full processing. Samples a subset of logs to predict compression effectiveness.

| Parameter    | Type       | Required | Default | Description                               |
| ------------ | ---------- | -------- | ------- | ----------------------------------------- |
| `lines`      | `string[]` | ✅       | —       | Log lines to sample.                      |
| `sampleSize` | `integer`  | —        | `1000`  | Number of lines to sample for estimation. |

**Response:** JSON object with estimated compression ratio, token reduction, and recommendation.

**Examples:**

```
estimateCompression  lines=[...largeLogs]
estimateCompression  lines=[...logs]  sampleSize=500
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

### `wait`

Wait for a specified duration before continuing.

| Parameter    | Type      | Required | Description                                                                                       |
| ------------ | --------- | -------- | ------------------------------------------------------------------------------------------------- |
| `durationMs` | `integer` | ✅       | How long to wait in milliseconds. Must be ≥ 1 and ≤ the configured max (default: 300000 / 5 min). |
| `reason`     | `string`  | ✅       | Why the wait is needed. Max 64 characters.                                                        |

**Response:** `"Nms have passed."`

**Examples:**

```
wait  durationMs=2000  reason="settling after write"
wait  durationMs=5000  reason="rate limit cooldown"
wait  durationMs=500   reason="animation to complete"
```

## Environment Variables

| Variable              | Default  | Description                                                                                               |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `waitMaxDurationMs`   | `300000` | Override the maximum allowed `durationMs`. Must be a positive number. Server refuses to start if invalid. |
| `analyzePatterns`     | _(on)_   | Set to `"false"` to disable the `analyzePatterns` tool at startup.                                        |
| `compressLogs`        | _(on)_   | Set to `"false"` to disable the `compressLogs` tool at startup.                                           |
| `compressText`        | _(on)_   | Set to `"false"` to disable the `compressText` tool at startup.                                           |
| `deleteFile`          | _(on)_   | Set to `"false"` to disable the `deleteFile` tool at startup.                                             |
| `estimateCompression` | _(on)_   | Set to `"false"` to disable the `estimateCompression` tool at startup.                                    |
| `moveFile`            | _(on)_   | Set to `"false"` to disable the `moveFile` tool at startup.                                               |
| `wait`                | _(on)_   | Set to `"false"` to disable the `wait` tool at startup.                                                   |

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
