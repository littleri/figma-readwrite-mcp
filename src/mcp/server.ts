import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { FigmaRestClient } from "../figma/rest.js";
import { PluginBridge } from "../pluginBridge.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";

export function createFigmaMcpServer(figma: FigmaRestClient, bridge: PluginBridge) {
  const server = new McpServer({
    name: "figma-readwrite-mcp",
    version: "0.1.0",
  });

  registerReadTools(server, figma);
  registerWriteTools(server, bridge);

  return server;
}
