import { randomUUID } from "crypto";

const BASE = "http://localhost:8787/mcp";
const PARENT = "20:74";

const white = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
const ink = [{ type: "SOLID", color: { r: 0.08, g: 0.08, b: 0.1 } }];
const muted = [{ type: "SOLID", color: { r: 0.36, g: 0.38, b: 0.43 } }];
const accent = [{ type: "SOLID", color: { r: 0.17, g: 0.28, b: 0.95 } }];
const soft = [{ type: "SOLID", color: { r: 0.94, g: 0.96, b: 1.0 } }];
const line = [{ type: "SOLID", color: { r: 0.9, g: 0.91, b: 0.94 } }];
const pageBg = [{ type: "SOLID", color: { r: 0.965, g: 0.965, b: 0.973 } }];

function sld(r, g, b) { return [{ type: "SOLID", color: { r, g, b } }]; }

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

async function create(name, args) {
  const r = await callTool(name, args);
  const c = r?.result?.content;
  if (c && c[0]) {
    const d = JSON.parse(c[0].text);
    console.log("OK", name, args.name ?? "", "->", d.id);
    return d.id;
  }
  console.log("ERR", name, JSON.stringify(r).slice(0, 150));
  return null;
}

async function update(nodeId, patch) {
  const r = await callTool("figma_update_node", { nodeId, patch });
  const c = r?.result?.content;
  if (c && c[0]) {
    const d = JSON.parse(c[0].text);
    return d.id;
  }
  return null;
}

// init
await rpc("initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "portfolio-writer", version: "1.0" },
});

// === PAGE BACKGROUND ===
console.log("--- Page BG ---");
await create("figma_create_rectangle", { parentId: PARENT, name: "Page bg", x: 0, y: 0, width: 1440, height: 1024, fills: pageBg });

// === NAVBAR ===
console.log("--- Navbar ---");
await create("figma_create_rectangle", { parentId: PARENT, name: "Navbar bg", x: 0, y: 0, width: 1440, height: 80, fills: white });
await create("figma_create_rectangle", { parentId: PARENT, name: "Navbar line", x: 80, y: 79, width: 1280, height: 1, fills: line });
await create("figma_create_text", { parentId: PARENT, name: "Logo", text: "REN XINGYU", x: 80, y: 30, fontSize: 16, fontFamily: "Inter", fontStyle: "Bold", fills: ink });
await create("figma_create_text", { parentId: PARENT, name: "Nav Work", text: "Work", x: 580, y: 32, fontSize: 14, fills: ink });
await create("figma_create_text", { parentId: PARENT, name: "Nav About", text: "About", x: 652, y: 32, fontSize: 14, fills: muted });
await create("figma_create_text", { parentId: PARENT, name: "Nav Resume", text: "Resume", x: 728, y: 32, fontSize: 14, fills: muted });
await create("figma_create_rectangle", { parentId: PARENT, name: "Contact btn", x: 1240, y: 22, width: 110, height: 36, cornerRadius: 18, fills: soft });
await create("figma_create_text", { parentId: PARENT, name: "Contact text", text: "Contact", x: 1268, y: 32, fontSize: 14, fills: accent });

// === PAGE TITLE ===
console.log("--- Page Title ---");
await create("figma_create_text", { parentId: PARENT, name: "Page title", text: "作品集", x: 80, y: 150, fontSize: 44, fontFamily: "Inter", fontStyle: "Bold", fills: ink });
await create("figma_create_text", { parentId: PARENT, name: "Page subtitle", text: "Selected Works / 精选项目展示", x: 80, y: 206, fontSize: 15, fills: muted });

// === PROJECT CARDS ===
const projects = [
  { name: "Project Alpha", cat: "UI/UX Design — Mobile", img: sld(0.89, 0.93, 1.0), x: 80, y: 280 },
  { name: "Project Beta", cat: "Brand Identity — Visual", img: sld(0.99, 0.89, 0.88), x: 760, y: 280 },
  { name: "Project Gamma", cat: "Web Development — Full Stack", img: sld(0.88, 0.95, 0.90), x: 80, y: 740 },
  { name: "Project Delta", cat: "Mobile App — iOS & Android", img: sld(1.0, 0.94, 0.85), x: 760, y: 740 },
];

const CW = 600, CH = 420, IMH = 300, CRAD = 16;
const CS = 28, CO = 11; // corner square size & offset

for (const proj of projects) {
  const { name, cat, img, x, y } = proj;
  console.log(`--- Card: ${name} ---`);

  // Card bg
  await create("figma_create_rectangle", { parentId: PARENT, name: `${name} card`, x, y, width: CW, height: CH, cornerRadius: CRAD, fills: white });

  // Image rectangle
  await create("figma_create_rectangle", { parentId: PARENT, name: `${name} image`, x, y, width: CW, height: IMH, cornerRadius: CRAD, fills: img });

  // Corner squares (to be rotated for slanted effect)
  const corners = [
    { n: "corner tl", cx: x - CO, cy: y - CO },
    { n: "corner tr", cx: x + CW - CO, cy: y - CO },
    { n: "corner bl", cx: x - CO, cy: y + IMH - CO },
    { n: "corner br", cx: x + CW - CO, cy: y + IMH - CO },
  ];

  for (const c of corners) {
    const nodeId = await create("figma_create_rectangle", {
      parentId: PARENT, name: `${name} ${c.n}`,
      x: c.cx, y: c.cy, width: CS, height: CS, cornerRadius: 0, fills: white,
    });
    if (nodeId) {
      await update(nodeId, { rotation: 45 });
    }
  }

  // Project title
  await create("figma_create_text", { parentId: PARENT, name: `${name} title`, text: name, x: x + 28, y: y + IMH + 32, fontSize: 18, fontFamily: "Inter", fontStyle: "Bold", fills: ink });
  // Category
  await create("figma_create_text", { parentId: PARENT, name: `${name} cat`, text: cat, x: x + 28, y: y + IMH + 58, fontSize: 13, fills: muted });
  // Link
  await create("figma_create_text", { parentId: PARENT, name: `${name} link`, text: "View Project →", x: x + 28, y: y + IMH + 82, fontSize: 13, fills: accent });
}

console.log("Done!");
