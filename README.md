# mcp-multitool

[![npm version](https://img.shields.io/npm/v/mcp-multitool)](https://www.npmjs.com/package/mcp-multitool)
[![npm downloads](https://img.shields.io/npm/dm/mcp-multitool)](https://www.npmjs.com/package/mcp-multitool)
[![license](https://img.shields.io/npm/l/mcp-multitool)](./LICENSE)

A minimal [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server. Currently ships one tool: `wait`.

## Why

Some tasks genuinely need a pause — rate limits, eventual consistency, animations completing, or simply giving a background process time to settle. `mcp-multitool` gives any MCP-compatible client a reliable, configurable `wait` tool without pulling in a larger server.

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

| Variable            | Default  | Description                                                                                               |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `waitMaxDurationMs` | `300000` | Override the maximum allowed `durationMs`. Must be a positive number. Server refuses to start if invalid. |
| `wait`              | _(on)_   | Set to `"false"` to disable the `wait` tool at startup.                                                   |

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
