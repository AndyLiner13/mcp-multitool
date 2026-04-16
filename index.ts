#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { register as registerAstGrepSearch } from "./tools/astGrepSearch.js";
import { register as registerCheckFileOrDir } from "./tools/checkFileOrDir.js";
import { register as registerCloneFileOrDir } from "./tools/cloneFileOrDir.js";
import { register as registerDeleteFileOrDir } from "./tools/deleteFileOrDir.js";
import { register as registerMoveFileOrDir } from "./tools/moveFileOrDir.js";
import { register as registerReadLogFile } from "./tools/readLogFile.js";
import { register as registerRenameFileOrDir } from "./tools/renameFileOrDir.js";
import { register as registerWait } from "./tools/wait.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const isEnabled = (name: string): boolean => process.env[name] !== "false";

const instructions = readFileSync(
  join(__dirname, "..", "system.instructions.md"),
  "utf-8",
);

const server = new McpServer(
  { name: "mcp-multitool", version },
  { instructions },
);

if (isEnabled("astGrepSearch")) registerAstGrepSearch(server);
if (isEnabled("checkFileOrDir")) registerCheckFileOrDir(server);
if (isEnabled("cloneFileOrDir")) registerCloneFileOrDir(server);
if (isEnabled("deleteFileOrDir")) registerDeleteFileOrDir(server);
if (isEnabled("moveFileOrDir")) registerMoveFileOrDir(server);
if (isEnabled("readLogFile")) registerReadLogFile(server);
if (isEnabled("renameFileOrDir")) registerRenameFileOrDir(server);
if (isEnabled("wait")) registerWait(server);

await server.connect(new StdioServerTransport());
