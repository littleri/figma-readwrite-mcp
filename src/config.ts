import dotenv from "dotenv";

dotenv.config();

function optionalEnv(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

export const config = {
  figmaToken: optionalEnv("FIGMA_TOKEN"),
  mcpAuthToken: optionalEnv("MCP_AUTH_TOKEN"),
  host: optionalEnv("HOST", "127.0.0.1"),
  port: Number(optionalEnv("PORT", "8787")),
  pluginWsPath: optionalEnv("PLUGIN_WS_PATH", "/plugin"),
};

if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
  throw new Error("PORT must be a valid TCP port");
}
