#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { register as registerWait } from "./tools/wait.js";

const isEnabled = (name: string): boolean => process.env[name] !== "false";

const server = new McpServer({ name: "mcp-multitool", version: "0.1.0" });

if (isEnabled("wait")) registerWait(server);

await server.connect(new StdioServerTransport());
