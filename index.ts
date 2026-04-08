#!/usr/bin/env node
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { register as registerDeleteFile } from "./tools/deleteFile.js";
import { register as registerMoveFile } from "./tools/moveFile.js";
import { register as registerReadLog } from "./tools/readLog.js";
import { register as registerWait } from "./tools/wait.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const isEnabled = (name: string): boolean => process.env[name] !== "false";

const server = new McpServer({ name: "mcp-multitool", version });

if (isEnabled("deleteFile")) registerDeleteFile(server);
if (isEnabled("moveFile")) registerMoveFile(server);
if (isEnabled("readLog")) registerReadLog(server);
if (isEnabled("wait")) registerWait(server);

await server.connect(new StdioServerTransport());
