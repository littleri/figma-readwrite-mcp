import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = process.env.FIGMA_MCP_URL || "http://127.0.0.1:8787/mcp";
const HEALTH_URL = BASE.replace(/\/mcp\/?$/, "/health");

function readDotEnv() {
  try {
    const env = {};
    const text = readFileSync(".env", "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
    }
    return env;
  } catch {
    return {};
  }
}

function parseMcpResponse(text) {
  const match = text.match(/data: (\{.*\})/s);
  return JSON.parse(match ? match[1] : text);
}

async function rpc(method, params = {}) {
  const response = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: randomUUID(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP HTTP ${response.status}: ${await response.text()}`);
  }

  return parseMcpResponse(await response.text());
}

async function callTool(name, args = {}) {
  const response = await rpc("tools/call", { name, arguments: args });
  const text = response?.result?.content?.[0]?.text ?? "";
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Keep text.
  }
  return {
    isError: response?.result?.isError === true,
    data,
  };
}

function pass(message) {
  console.log(`[OK] ${message}`);
}

function warn(message) {
  console.log(`[WARN] ${message}`);
}

function fail(message) {
  console.log(`[FAIL] ${message}`);
  process.exitCode = 1;
}

const env = readDotEnv();
const hasFigmaToken = Boolean((process.env.FIGMA_TOKEN || env.FIGMA_TOKEN || "").trim());

console.log(`Checking Figma MCP at ${BASE}`);

let health;
try {
  const response = await fetch(HEALTH_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  health = await response.json();
  pass(`/health is reachable`);
} catch (error) {
  fail(`/health is not reachable: ${error instanceof Error ? error.message : String(error)}`);
  process.exit();
}

await rpc("initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "codex-ready-check", version: "1.0" },
});

const toolsResponse = await rpc("tools/list");
const toolNames = new Set(toolsResponse?.result?.tools?.map((tool) => tool.name) ?? []);
const requiredTools = [
  "figma_read_context",
  "figma_read_node",
  "figma_plugin_status",
  "figma_plugin_get_current_file_summary",
  "figma_create_frame",
];

for (const tool of requiredTools) {
  if (toolNames.has(tool)) pass(`tool available: ${tool}`);
  else fail(`tool missing: ${tool}`);
}

if (hasFigmaToken) {
  pass("FIGMA_TOKEN is configured in environment or .env");
} else {
  warn("FIGMA_TOKEN is not configured; REST reads will fail unless the plugin path is used");
}

const pluginConnected = health?.plugin?.connected === true;
if (pluginConnected) {
  pass(`plugin connected: ${health.plugin.metadata?.fileName ?? "unknown file"} / ${health.plugin.metadata?.pageName ?? "unknown page"}`);

  const summary = await callTool("figma_plugin_get_current_file_summary");
  if (summary.isError) {
    fail(`plugin summary failed: ${summary.data}`);
  } else {
    pass(`plugin summary works: ${summary.data.fileName} / ${summary.data.pageName}`);
  }

  const context = await callTool("figma_read_context", {
    depth: 0,
    maxChildren: 20,
    compact: true,
  });
  if (context.isError) {
    fail(`automatic plugin context read failed: ${context.data}`);
  } else {
    pass(`automatic context read source: ${context.data.source}`);
  }
} else {
  warn("plugin is not connected; open the Figma development plugin before using plugin reads or writes");
}

if (process.exitCode) {
  console.log("Codex setup is incomplete.");
} else {
  console.log("Codex setup is ready.");
}
