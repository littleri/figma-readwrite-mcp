import { randomUUID } from "crypto";

const BASE = "http://localhost:8787/mcp";
const PARENT = "1:2";

const white = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
const ink = [{ type: "SOLID", color: { r: 0.08, g: 0.08, b: 0.1 } }];
const muted = [{ type: "SOLID", color: { r: 0.36, g: 0.38, b: 0.43 } }];
const accent = [{ type: "SOLID", color: { r: 0.17, g: 0.28, b: 0.95 } }];
const soft = [{ type: "SOLID", color: { r: 0.94, g: 0.96, b: 1.0 } }];
const line = [{ type: "SOLID", color: { r: 0.9, g: 0.91, b: 0.94 } }];

function parseSse(text) {
  const m = text.match(/data: (\{.*\})/s);
  if (m) {
    try { return JSON.parse(m[1]); } catch {}
  }
  try { return JSON.parse(text); } catch {}
  return text;
}

async function rpc(method, params) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params });
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body,
  });
  return parseSse(await res.text());
}

async function callTool(name, args) {
  const r = await rpc("tools/call", { name, arguments: args });
  if (r.error) throw new Error(`${name}: ${r.error.message}`);
  return r;
}

// init
const init = await rpc("initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "navbar-writer", version: "1.0" },
});
console.log("init:", init?.result?.serverInfo?.name ?? JSON.stringify(init).slice(0, 80));

const steps = [
  ["figma_create_frame", { parentId: PARENT, name: "Navbar", x: 24, y: 24, width: 578, height: 64, fills: white }],
  ["figma_create_rectangle", { parentId: PARENT, name: "Navbar bg", x: 24, y: 24, width: 578, height: 64, cornerRadius: 24, fills: white }],
  ["figma_create_rectangle", { parentId: PARENT, name: "Navbar line", x: 44, y: 87, width: 538, height: 1, fills: line }],
  ["figma_create_text", { parentId: PARENT, name: "Logo", text: "REN XINGYU", x: 48, y: 45, fontSize: 16, fontFamily: "Inter", fontStyle: "Bold", fills: ink }],
  ["figma_create_text", { parentId: PARENT, name: "Nav Work", text: "Work", x: 260, y: 47, fontSize: 14, fills: muted }],
  ["figma_create_text", { parentId: PARENT, name: "Nav About", text: "About", x: 330, y: 47, fontSize: 14, fills: muted }],
  ["figma_create_text", { parentId: PARENT, name: "Nav Resume", text: "Resume", x: 400, y: 47, fontSize: 14, fills: muted }],
  ["figma_create_rectangle", { parentId: PARENT, name: "Contact btn bg", x: 484, y: 38, width: 94, height: 36, cornerRadius: 18, fills: soft }],
  ["figma_create_text", { parentId: PARENT, name: "Contact btn text", text: "Contact", x: 506, y: 48, fontSize: 14, fontFamily: "Inter", fontStyle: "Regular", fills: accent }],
];

for (const [tool, args] of steps) {
  const r = await callTool(tool, args);
  const c = r?.result?.content;
  if (c && c[0]) {
    const d = JSON.parse(c[0].text);
    console.log("OK", tool, args.name, "->", d.id);
  } else {
    console.log("ERR", tool, JSON.stringify(r).slice(0, 200));
  }
}

console.log("Done!");
