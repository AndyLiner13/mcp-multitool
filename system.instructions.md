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

## Content Search

**NEVER use CLI commands for content search.** Use `ripgrepSearch` for ALL searches across file contents.

| Operation                   | CLI (NEVER use)                        | MCP Tool (ALWAYS use)                           |
| --------------------------- | -------------------------------------- | ----------------------------------------------- |
| Search for text/regex       | `grep`, `egrep`, `fgrep`, `rg`         | `ripgrepSearch`                                 |
| Search on Windows           | `findstr`, `Select-String`, `sls`      | `ripgrepSearch`                                 |
| Search PowerShell pipelines | `... \| Select-String`, `... \| where` | `ripgrepSearch`                                 |
| Find files matching pattern | `find`, `Get-ChildItem -Recurse`       | `ripgrepSearch  args=["--files", "-g", "GLOB"]` |

**Why:** The `ripgrepSearch` tool ships a bundled ripgrep binary and provides:

- **Cross-platform consistency** — Same behavior on Windows, macOS, Linux. CLI alternatives are platform-specific (`findstr` is Windows-only, `grep` may not be installed, `Select-String` is PowerShell-only).
- **No PATH dependency** — The binary is bundled via `@vscode/ripgrep`. Never fails with "command not found."
- **No shell-quoting hell** — Arguments are passed as an array directly to the binary. Regex with `$`, `"`, `\`, etc. works identically on every platform without escape gymnastics.
- **Predictable exit codes** — `0` = matches, `1` = no matches (not an error), `2+` = real error surfaced as `isError: true` with stderr.
- **Verbatim native output** — Returns ripgrep's own output format. Pass `--json` for structured JSON Lines, `-c` for counts, `-l` for filenames-only, etc.
- **Workspace-aware** — Resolves working directory via the MCP roots protocol (typically the workspace root).

---

## ripgrepSearch — Native ripgrep CLI Pass-Through

The `ripgrepSearch` tool is a thin adapter — it spawns the bundled `rg` binary with whatever arguments you provide and returns its output verbatim. You use it exactly as you would use `rg` on the command line, except arguments are passed as an array of strings instead of being parsed by a shell.

### Discovering flags

```
ripgrepSearch  args=["--help"]
ripgrepSearch  args=["--type-list"]
```

### Common patterns

```
# Basic case-insensitive search across the workspace
ripgrepSearch  args=["-i", "TODO", "."]

# Search only TypeScript files, ignore .gitignore
ripgrepSearch  args=["-i", "--no-ignore", "-g", "*.ts", "console.log", "src/"]

# Show 3 lines of context before and after each match
ripgrepSearch  args=["-A", "3", "-B", "3", "function\\s+\\w+", "tools/"]

# Multiline regex (allow pattern to span lines)
ripgrepSearch  args=["--json", "-U", "export\\s+function", "."]

# Count matches per file
ripgrepSearch  args=["-c", "import", "src/"]

# List files matching a pattern (no content)
ripgrepSearch  args=["-l", "TODO", "."]

# Find files by name only (no content matching)
ripgrepSearch  args=["--files", "-g", "*.test.ts"]

# Search hidden files too
ripgrepSearch  args=["--hidden", "API_KEY", "."]
```

### Exit code behavior

- `exitCode === 0` — Matches found. Stdout returned verbatim.
- `exitCode === 1` — No matches found. Stdout (empty) returned verbatim. **Not an error.**
- `exitCode >= 2` — Real error (invalid regex, missing path, etc.). Stderr returned verbatim with `isError: true`.

### Timeout

By default `ripgrepSearch` has **no timeout** — it will run until ripgrep finishes. The deployment may set the `ripgrepSearchTimeoutMs` env var to bound execution time. If a call is killed by the timeout, the response will be `isError: true` with a message identifying the env var; rerun with a more selective query (narrower path, more specific pattern, `--max-count`, `-l`, etc.) rather than asking for the timeout to be raised.

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
