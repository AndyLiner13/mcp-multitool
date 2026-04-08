#!/usr/bin/env node
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { register as registerCheckFileOrDir } from "./tools/checkFileOrDir.js";
import { register as registerDeleteFileOrDir } from "./tools/deleteFileOrDir.js";
import { register as registerMoveFileOrDir } from "./tools/moveFileOrDir.js";
import { register as registerReadLogFile } from "./tools/readLogFile.js";
import { register as registerRenameFileOrDir } from "./tools/renameFileOrDir.js";
import { register as registerWait } from "./tools/wait.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const isEnabled = (name: string): boolean => process.env[name] !== "false";

const server = new McpServer({ name: "mcp-multitool", version });

if (isEnabled("checkFileOrDir")) registerCheckFileOrDir(server);
if (isEnabled("deleteFileOrDir")) registerDeleteFileOrDir(server);
if (isEnabled("moveFileOrDir")) registerMoveFileOrDir(server);
if (isEnabled("readLogFile")) registerReadLogFile(server);
if (isEnabled("renameFileOrDir")) registerRenameFileOrDir(server);
if (isEnabled("wait")) registerWait(server);

await server.connect(new StdioServerTransport());
