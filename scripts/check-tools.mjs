import { randomUUID } from "crypto";

const BASE = "http://localhost:8787/mcp";

function parseSse(text) {
  const m = text.match(/data: (\{.*\})/s);
  if (m) {
    try { return JSON.parse(m[1]); } catch {}
  }
  try { return JSON.parse(text); } catch {}
  return text;
}

async function rpc(method, params = {}) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
  });
  return parseSse(await res.text());
}

await rpc("initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "tool-checker", version: "1.0" },
});

const result = await rpc("tools/list");
const names = result?.result?.tools?.map((tool) => tool.name) ?? [];
console.log(names.join("\n"));
