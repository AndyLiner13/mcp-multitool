# Log Grammar

TextMate grammar for log file syntax highlighting, extracted from VS Code's [log extension](https://github.com/microsoft/vscode/tree/main/extensions/log).

## Origin

This grammar is sourced from [emilast/vscode-logfile-highlighter](https://github.com/emilast/vscode-logfile-highlighter) and is used by VS Code for `.log` file highlighting.

## Patterns Detected

| Category       | Scope               | Examples                                |
| -------------- | ------------------- | --------------------------------------- |
| **Log Levels** |                     |                                         |
| Verbose/Trace  | `log.verbose`       | `TRACE`, `[verbose]`, `[v]`             |
| Debug          | `log.debug`         | `DEBUG`, `[debug]`, `[d]`               |
| Info           | `log.info`          | `INFO`, `[info]`, `[i]`, `NOTICE`       |
| Warning        | `log.warning`       | `WARN`, `[warning]`, `[w]`              |
| Error          | `log.error`         | `ERROR`, `FATAL`, `[error]`, `[e]`      |
| **Timestamps** | `log.date`          |                                         |
| ISO date       |                     | `2024-01-15`                            |
| European date  |                     | `15/01/2024`                            |
| Time           |                     | `14:30:00`, `14:30:00.123`, `14:30:00Z` |
| **Constants**  | `log.constant`      |                                         |
| UUID           |                     | `550e8400-e29b-41d4-a716-446655440000`  |
| Git SHA        |                     | `a1b2c3d4e5f6g7h8i9j0`                  |
| Hex            |                     | `0xDEADBEEF`                            |
| MAC address    |                     | `00:1A:2B:3C:4D:5E`                     |
| Numbers        |                     | `123`, `true`, `false`, `null`          |
| URLs           |                     | `https://example.com`                   |
| **Strings**    | `log.string`        |                                         |
| Double-quoted  |                     | `"hello world"`                         |
| Single-quoted  |                     | `'hello world'`                         |
| **Exceptions** |                     |                                         |
| Exception type | `log.exceptiontype` | `NullPointerException`                  |
| Stack trace    | `log.exception`     | `    at com.example.Method`             |

## License

MIT (same as VS Code)
