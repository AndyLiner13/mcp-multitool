#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { register as registerAnalyzePatterns } from "./tools/analyzePatterns.js";
import { register as registerCompressLogs } from "./tools/compressLogs.js";
import { register as registerCompressText } from "./tools/compressText.js";
import { register as registerDeleteFile } from "./tools/deleteFile.js";
import { register as registerEstimateCompression } from "./tools/estimateCompression.js";
import { register as registerMoveFile } from "./tools/moveFile.js";
import { register as registerWait } from "./tools/wait.js";

const isEnabled = (name: string): boolean => process.env[name] !== "false";

const server = new McpServer({ name: "mcp-multitool" });

if (isEnabled("analyzePatterns")) registerAnalyzePatterns(server);
if (isEnabled("compressLogs")) registerCompressLogs(server);
if (isEnabled("compressText")) registerCompressText(server);
if (isEnabled("deleteFile")) registerDeleteFile(server);
if (isEnabled("estimateCompression")) registerEstimateCompression(server);
if (isEnabled("moveFile")) registerMoveFile(server);
if (isEnabled("wait")) registerWait(server);

await server.connect(new StdioServerTransport());
