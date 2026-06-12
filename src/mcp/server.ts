import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { FigmaRestClient } from "../figma/rest.js";
import { PluginBridge } from "../pluginBridge.js";
import { registerAutoReadTools } from "./tools/autoRead.js";
import { registerPluginReadTools } from "./tools/pluginRead.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";

export function createFigmaMcpServer(figma: FigmaRestClient, bridge: PluginBridge) {
  const server = new McpServer({
    name: "figma-readwrite-mcp",
    version: "0.2.0",
  });

  // REST-backed read tools (with compatibility aliases)
  registerReadTools(server, figma);
  // Plugin-backed read tools
  registerPluginReadTools(server, bridge);
  // Automatic read tools (choose REST or plugin based on context)
  registerAutoReadTools(server, figma, bridge);
  // Write tools (plugin-backed)
  registerWriteTools(server, bridge);

  return server;
}
