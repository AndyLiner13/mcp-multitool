# CRITICAL: Tool Usage Requirements

This MCP server provides specialized tools that MUST be used instead of CLI commands. Using CLI equivalents causes problems with error handling, cross-platform compatibility, and consistent behavior.

---

## File Operations

**NEVER use CLI commands for file operations.** Use the dedicated MCP tools instead:

| Operation         | CLI (NEVER use)                     | MCP Tool (ALWAYS use) |
| ----------------- | ----------------------------------- | --------------------- |
| Delete files/dirs | `rm`, `Remove-Item`, `del`, `rmdir` | `deleteFileOrDir`     |
| Move files/dirs   | `mv`, `Move-Item`, `move`           | `moveFileOrDir`       |
| Copy files/dirs   | `cp`, `Copy-Item`, `copy`, `xcopy`  | `cloneFileOrDir`      |
| Rename files/dirs | `mv`, `Move-Item`, `ren`, `rename`  | `renameFileOrDir`     |

**Why:** The MCP tools provide:

- Consistent error handling and reporting
- Auto-creation of destination directories (move/clone)
- Cross-platform compatibility (Windows/Linux/macOS)
- Structured JSON responses for verification
- Proper handling of recursive operations

---

## Log File Handling

**NEVER use CLI commands (cat, tail, head, grep, Get-Content, Select-String, etc.) to read .log files.**

Always use `readLogFile` for ALL log file operations. This is non-negotiable.

## Why This Rule Exists

Log files are extremely data-heavy. A single verbose log can contain millions of lines and gigabytes of text. CLI commands dump raw content with no compression or filtering, which causes:

1. **Context window overflow** — Raw log output can exceed your entire context limit, causing results to be truncated or disappear entirely
2. **Memory overload** — Large log dumps can crash the user's system or cause the application to become unresponsive
3. **Agent memory loss** — When context overflows, you lose track of the conversation, the task, and all prior reasoning — becoming a "rogue agent" that has forgotten what it was doing
4. **Ineffective analysis** — Simple grep/regex searches miss semantic patterns and return too much noise

The `readLogFile` tool was built specifically to solve these problems. It:

- Compresses logs by 60-90% through semantic pattern extraction
- Groups similar lines into templates so you see patterns, not noise
- Provides structured filtering (level, time, status, exceptions, UUIDs) that grep cannot match
- Returns content-hashed template IDs for stateless drill-down
- Protects your context window and the user's system

**Use `readLogFile` for any file ending in `.log`, regardless of size.** Even small logs benefit from the semantic compression.

---

## readLogFile — Structured Log Filtering

The readLogFile tool supports structured filtering via these parameters:

### Log Level (level)

Filter by severity: "error", "warn", "info", "debug", "trace"

Recognized patterns:

- error: ERROR, Error, Err, FAIL, FATAL, CRITICAL, [error], [err], [e]
- warn: WARNING, WARN, Warn, [warning], [warn], [w]
- info: INFO, Info, INFORMATION, HINT, [info], [i]
- debug: DEBUG, Debug, [debug], [d]
- trace: TRACE, Trace, Perf, [verbose], [v]

Format-specific: tsserver uses "Info", "Err", "Perf" prefixes.

### Timestamps (startTime, endTime)

Filter by time range. Accepts ISO format or time-only:

- "2026-04-13T10:00:00" (ISO datetime)
- "10:00:00" (time only, uses today)
- "[09:22:25.450]" (bracketed format)

### HTTP Status (status)

Filter by status code. Accepts single code or array: status=[500,502,503]

### Exception Detection (hasException)

Set hasException=true to filter to lines with exception indicators, stack traces, or error prefixes.

### UUID Matching (matchUuid)

Filter to lines containing specific UUID(s). Accepts single UUID or array for OR logic: matchUuid=["uuid1", "uuid2"]. Case-insensitive, ignores dashes.

### Regex Filtering (grep)

Filter lines by regex pattern(s). Accepts single pattern or array for OR logic: grep=["pattern1", "pattern2"]. Smart case: all-lowercase = case-insensitive.

### Filter Logic

- **Between filter types:** AND logic — a line must match ALL specified filter criteria
- **Within arrays:** OR logic — a line matches if ANY item in the array matches

### Example Queries

```
# Errors and warnings in a time window
readLogFile path="server.log" simThreshold=0.5 startTime="10:00:00" endTime="10:30:00" level=["error","warn"]

# 5xx errors with exceptions
readLogFile path="api.log" simThreshold=0.5 status=[500,502,503] hasException=true

# tsserver errors (uses Err prefix)
readLogFile path="tsserver.log" simThreshold=0.5 lineStart="^(Info|Err|Perf)\\s+\\d+" level="error"

# Multiple grep patterns (OR logic)
readLogFile path="app.log" simThreshold=0.5 grep=["timeout", "connection refused", "ECONNRESET"]

# Track multiple request UUIDs
readLogFile path="api.log" simThreshold=0.5 matchUuid=["abc-123", "def-456"]
```
