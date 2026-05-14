import { randomUUID } from "crypto";

const BASE = "http://localhost:8787/mcp";
const PARENT = "1:2";

const ink = [{ type: "SOLID", color: { r: 0.08, g: 0.08, b: 0.1 } }];
const muted = [{ type: "SOLID", color: { r: 0.36, g: 0.38, b: 0.43 } }];
const accent = [{ type: "SOLID", color: { r: 0.17, g: 0.28, b: 0.95 } }];
const white = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
const soft = [{ type: "SOLID", color: { r: 0.94, g: 0.96, b: 1.0 } }];

function parseSse(text) {
  const m = text.match(/data: (\{.*\})/s);
  if (m) { try { return JSON.parse(m[1]); } catch {} }
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
await rpc("initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "hero-writer", version: "1.0" },
});

const steps = [
  // Greeting
  ["figma_create_text", { parentId: PARENT, name: "Greeting", text: "Hello, I'm", x: 48, y: 140, fontSize: 14, fills: muted }],
  // Name
  ["figma_create_text", { parentId: PARENT, name: "Hero name", text: "REN XINGYU", x: 48, y: 160, fontSize: 32, fontFamily: "Inter", fontStyle: "Bold", fills: ink }],
  // Role subtitle
  ["figma_create_text", { parentId: PARENT, name: "Hero role", text: "产品设计学生 · Product Design", x: 48, y: 198, fontSize: 16, fills: muted }],
  // Description
  ["figma_create_text", { parentId: PARENT, name: "Hero desc", text: "专注于创造直观、有影响力的数字体验，\n热衷于将复杂问题转化为简洁优雅的设计解决方案。", x: 48, y: 228, fontSize: 13, fills: muted }],
  // Primary CTA button bg
  ["figma_create_rectangle", { parentId: PARENT, name: "CTA primary bg", x: 48, y: 290, width: 100, height: 36, cornerRadius: 18, fills: accent }],
  // Primary CTA text
  ["figma_create_text", { parentId: PARENT, name: "CTA primary text", text: "查看作品", x: 72, y: 300, fontSize: 14, fontFamily: "Inter", fontStyle: "Regular", fills: white }],
  // Secondary CTA button bg
  ["figma_create_rectangle", { parentId: PARENT, name: "CTA secondary bg", x: 158, y: 290, width: 100, height: 36, cornerRadius: 18, fills: soft }],
  // Secondary CTA text
  ["figma_create_text", { parentId: PARENT, name: "CTA secondary text", text: "关于我", x: 184, y: 300, fontSize: 14, fills: accent }],
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
