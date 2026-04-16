/**
 * Log metadata extractor using patterns from VS Code's log grammar.
 * Source: https://github.com/microsoft/vscode/tree/main/extensions/log
 *
 * Extracts structured metadata from log lines for filtering:
 * - Log level (trace, debug, info, warn, error)
 * - Timestamps (ISO dates, times with milliseconds)
 * - HTTP status codes
 * - UUIDs
 * - Exception indicators
 */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export interface LineMetadata {
  level?: LogLevel;
  timestamp?: Date;
  statusCode?: number;
  hasException: boolean;
  uuids: string[];
}

// Log level patterns from VS Code's log grammar + tsserver-specific additions
const LEVEL_PATTERNS: { level: LogLevel; patterns: RegExp[] }[] = [
  {
    level: "trace",
    patterns: [
      /\b([Tt]race|TRACE)\b:?/,
      /\[(verbose|verb|vrb|vb|v)\]/i,
      /\bPerf\b/, // tsserver performance logs treated as trace
    ],
  },
  {
    level: "debug",
    patterns: [/\b(DEBUG|Debug)\b|\b(debug):/i, /\[(debug|dbug|dbg|de|d)\]/i],
  },
  {
    level: "info",
    patterns: [
      /\b(HINT|INFO|INFORMATION|Info|NOTICE|II)\b|\b(info|information):/i,
      /\[(information|info|inf|in|i)\]/i,
    ],
  },
  {
    level: "warn",
    patterns: [
      /\b(WARNING|WARN|Warn|WW)\b|\b(warning):/i,
      /\[(warning|warn|wrn|wn|w)\]/i,
    ],
  },
  {
    level: "error",
    patterns: [
      /\b(ALERT|CRITICAL|EMERGENCY|ERROR|FAILURE|FAIL|Fatal|FATAL|Error|EE)\b|\b(error):/i,
      /\[(error|eror|err|er|e|fatal|fatl|ftl|fa|f)\]/i,
      /\bErr\b/, // tsserver error prefix
    ],
  },
];

// Timestamp patterns - combined date and time detection
const DATE_PATTERNS = [
  // ISO date: 2026-04-13
  /\b(\d{4})-(\d{2})-(\d{2})\b/,
  // European date: 13/04/2026 or 13-04-2026
  /\b(\d{2})[/\-](\d{2})[/\-](\d{4})\b/,
];

const TIME_PATTERNS = [
  // Time with optional milliseconds and timezone: 18:47:00.538 or 18:47:00,538Z
  /\b(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,3}))?)?(?:Z| ?[+-]\d{1,2}:\d{2})?\b/,
  // Bracketed time common in logs: [18:47:00.538]
  /\[(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/,
];

// UUID pattern
const UUID_PATTERN =
  /\b[0-9a-fA-F]{8}-?([0-9a-fA-F]{4}-?){3}[0-9a-fA-F]{12}\b/g;

// HTTP status code pattern - typically appears as "status: 200" or "HTTP/1.1 200" or just 3-digit codes
const STATUS_PATTERNS = [
  /\bstatus[:\s=]+(\d{3})\b/i,
  /\bHTTP\/[\d.]+ (\d{3})\b/,
  /\b(1\d{2}|2\d{2}|3\d{2}|4\d{2}|5\d{2})\b/, // Fallback: any 1xx-5xx
];

// Exception patterns
const EXCEPTION_PATTERNS = [
  /\b[a-zA-Z.]*Exception\b/,
  /^\s*at\s+/m, // Stack trace line
  /\bError:\s/,
  /\bstack\s*:/i,
  /\bthrown\b/i,
];

/**
 * Extract the log level from a line.
 */
function extractLevel(line: string): LogLevel | undefined {
  for (const { level, patterns } of LEVEL_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        return level;
      }
    }
  }
  return undefined;
}

/**
 * Extract timestamp from a line.
 * Attempts to parse date and time components into a Date object.
 */
function extractTimestamp(line: string): Date | undefined {
  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let milliseconds = 0;

  // Try to find a date
  for (const pattern of DATE_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      if (pattern.source.startsWith("\\b(\\d{4})")) {
        // ISO format: YYYY-MM-DD
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10) - 1;
        day = parseInt(match[3], 10);
      } else {
        // European format: DD/MM/YYYY
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10) - 1;
        year = parseInt(match[3], 10);
      }
      break;
    }
  }

  // Try to find a time
  for (const pattern of TIME_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      if (match[3]) seconds = parseInt(match[3], 10);
      if (match[4]) {
        // Normalize milliseconds (could be 1-3 digits)
        const msStr = match[4].padEnd(3, "0");
        milliseconds = parseInt(msStr, 10);
      }
      break;
    }
  }

  // If we found at least a time, create a Date
  if (hours !== undefined && minutes !== undefined) {
    // If no date was found, use today's date as a reference
    const now = new Date();
    return new Date(
      year ?? now.getFullYear(),
      month ?? now.getMonth(),
      day ?? now.getDate(),
      hours,
      minutes,
      seconds,
      milliseconds,
    );
  }

  return undefined;
}

/**
 * Extract HTTP status code from a line.
 * Returns the first valid 1xx-5xx status code found.
 */
function extractStatusCode(line: string): number | undefined {
  // Try specific patterns first (more reliable)
  for (let i = 0; i < STATUS_PATTERNS.length - 1; i++) {
    const match = line.match(STATUS_PATTERNS[i]);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  // Fallback pattern is too broad - only use if line looks HTTP-related
  if (
    /\b(http|request|response|status|GET|POST|PUT|DELETE|PATCH)\b/i.test(line)
  ) {
    const match = line.match(STATUS_PATTERNS[STATUS_PATTERNS.length - 1]);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return undefined;
}

/**
 * Extract all UUIDs from a line.
 */
function extractUuids(line: string): string[] {
  const matches = line.match(UUID_PATTERN);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Check if line contains exception/error indicators.
 */
function hasException(line: string): boolean {
  return EXCEPTION_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Extract all metadata from a log line.
 */
export function extractMetadata(line: string): LineMetadata {
  return {
    level: extractLevel(line),
    timestamp: extractTimestamp(line),
    statusCode: extractStatusCode(line),
    hasException: hasException(line),
    uuids: extractUuids(line),
  };
}

/**
 * Check if a line's metadata matches the given filter criteria.
 * All provided criteria must match (AND logic).
 * Within array criteria (levels, statusCodes, matchUuids), any match suffices (OR logic).
 */
export function matchesFilter(
  metadata: LineMetadata,
  filter: {
    levels?: LogLevel[];
    startTime?: Date;
    endTime?: Date;
    statusCodes?: number[];
    hasException?: boolean;
    matchUuids?: string[];
  },
): boolean {
  // Level filter
  if (filter.levels && filter.levels.length > 0) {
    if (!metadata.level || !filter.levels.includes(metadata.level)) {
      return false;
    }
  }

  // Time range filter
  if (filter.startTime || filter.endTime) {
    if (!metadata.timestamp) {
      return false;
    }
    if (filter.startTime && metadata.timestamp < filter.startTime) {
      return false;
    }
    if (filter.endTime && metadata.timestamp > filter.endTime) {
      return false;
    }
  }

  // Status code filter
  if (filter.statusCodes && filter.statusCodes.length > 0) {
    if (
      metadata.statusCode === undefined ||
      !filter.statusCodes.includes(metadata.statusCode)
    ) {
      return false;
    }
  }

  // Exception filter
  if (filter.hasException !== undefined) {
    if (metadata.hasException !== filter.hasException) {
      return false;
    }
  }

  // UUID filter (OR logic across array)
  if (filter.matchUuids && filter.matchUuids.length > 0) {
    const normalizedFilters = filter.matchUuids.map((u) =>
      u.toLowerCase().replace(/-/g, ""),
    );
    const hasMatch = metadata.uuids.some((uuid) => {
      const normalizedUuid = uuid.toLowerCase().replace(/-/g, "");
      return normalizedFilters.some((f) => normalizedUuid === f);
    });
    if (!hasMatch) {
      return false;
    }
  }

  return true;
}
