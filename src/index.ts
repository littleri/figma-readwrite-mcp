import http from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { config } from "./config.js";
import { FigmaRestClient } from "./figma/rest.js";
import { createFigmaMcpServer } from "./mcp/server.js";
import { PluginBridge } from "./pluginBridge.js";

function isAuthorized(req: express.Request) {
  if (!config.mcpAuthToken) return true;
  return req.header("authorization") === `Bearer ${config.mcpAuthToken}`;
}

const app = express();
app.use(express.json({ limit: "10mb" }));

const httpServer = http.createServer(app);
const bridge = new PluginBridge();
bridge.attach(httpServer, config.pluginWsPath);

app.get("/health", (_req, res) => {
  res.json({ ok: true, plugin: bridge.getStatus() });
});

app.all("/mcp", async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const mcpServer = createFigmaMcpServer(new FigmaRestClient(config.figmaToken), bridge);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  } finally {
    res.on("close", () => {
      void transport.close();
      void mcpServer.close();
    });
  }
});

httpServer.listen(config.port, config.host, () => {
  console.log(`Figma read/write MCP listening at http://${config.host}:${config.port}/mcp`);
  console.log(`Figma plugin bridge listening at ws://${config.host}:${config.port}${config.pluginWsPath}`);
});
