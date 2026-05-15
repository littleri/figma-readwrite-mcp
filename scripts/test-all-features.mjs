import { randomUUID } from "crypto";

const BASE = "http://localhost:8787/mcp";
const PARENT = "34:30";

const white = solid(1, 1, 1);
const ink = solid(0.08, 0.08, 0.1);
const muted = solid(0.36, 0.38, 0.43);
const blue = solid(0.17, 0.28, 0.95);
const red = solid(0.94, 0.28, 0.24);
const green = solid(0.1, 0.65, 0.38);
const yellow = solid(1, 0.78, 0.28);
const softBlue = solid(0.9, 0.94, 1);
const gray = solid(0.9, 0.91, 0.94);

const TEST_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGP8z4AATAxEcogNqgEAV9kH+Qh5QdwAAAAASUVORK5CYII=";

function solid(r, g, b, opacity = 1) {
  return [{ type: "SOLID", color: { r, g, b }, opacity }];
}

const gradient = [{
  type: "GRADIENT_LINEAR",
  gradientTransform: [[1, 0, 0], [0, 1, 0]],
  gradientStops: [
    { position: 0, color: { r: 0.2, g: 0.35, b: 1, a: 1 } },
    { position: 1, color: { r: 0.7, g: 0.3, b: 1, a: 1 } },
  ],
}];

const shadow = [{
  type: "DROP_SHADOW",
  color: { r: 0.1, g: 0.12, b: 0.18, a: 0.16 },
  offset: { x: 0, y: 10 },
  radius: 24,
  spread: 0,
  visible: true,
  blendMode: "NORMAL",
}];

function parseSse(text) {
  const m = text.match(/data: (\{.*\})/s);
  if (m) { try { return JSON.parse(m[1]); } catch {} }
  try { return JSON.parse(text); } catch {}
  return text;
}

async function rpc(method, params) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
  });
  return parseSse(await res.text());
}

async function callTool(name, args) {
  const r = await rpc("tools/call", { name, arguments: args });
  const content = r?.result?.content?.[0]?.text;
  if (r?.error) throw new Error(`${name}: ${r.error.message}`);
  if (r?.result?.isError) throw new Error(`${name}: ${content}`);
  if (!content) return null;
  return JSON.parse(content);
}

async function create(tool, args) {
  const result = await callTool(tool, args);
  console.log("OK", tool, args.name ?? args.nodeId ?? "", "->", result?.id ?? "");
  return result;
}

async function main() {
  await rpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "all-feature-test", version: "1.0" },
  });

  const status = await callTool("figma_plugin_status", {});
  if (!status.connected) throw new Error("Figma plugin is not connected");

  await create("figma_update_node", {
    nodeId: PARENT,
    patch: {
      name: "MCP All Features Test",
      fills: solid(0.965, 0.968, 0.976),
    },
  });

  await create("figma_create_text", {
    parentId: PARENT,
    name: "Test title",
    text: "MCP 全功能测试",
    x: 64,
    y: 48,
    fontSize: 40,
    fontFamily: "Inter",
    fontStyle: "Bold",
    fills: ink,
    lineHeight: { unit: "PIXELS", value: 48 },
    letterSpacing: { unit: "PIXELS", value: -0.8 },
  });

  await create("figma_create_text", {
    parentId: PARENT,
    name: "Test subtitle",
    text: "Auto layout · Visual styles · Vector primitives · Advanced text · Components · Image fills",
    x: 64,
    y: 102,
    fontSize: 15,
    fills: muted,
  });

  const autoFrame = await create("figma_create_auto_layout_frame", {
    parentId: PARENT,
    name: "Auto layout row",
    x: 64,
    y: 160,
    width: 760,
    height: 92,
    layoutMode: "HORIZONTAL",
    itemSpacing: 20,
    paddingTop: 18,
    paddingRight: 22,
    paddingBottom: 18,
    paddingLeft: 22,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "CENTER",
    fills: white,
    cornerRadius: 20,
    strokes: gray,
    strokeWeight: 1,
    effects: shadow,
  });

  await create("figma_create_rectangle", {
    parentId: autoFrame.id,
    name: "Gradient chip",
    x: 0,
    y: 0,
    width: 160,
    height: 56,
    cornerRadius: 16,
    fills: gradient,
  });
  await create("figma_create_text", {
    parentId: autoFrame.id,
    name: "Auto text 1",
    text: "Auto Layout",
    x: 0,
    y: 0,
    fontSize: 16,
    fontFamily: "Inter",
    fontStyle: "Bold",
    fills: ink,
  });
  await create("figma_create_text", {
    parentId: autoFrame.id,
    name: "Auto text 2",
    text: "20px spacing + padding",
    x: 0,
    y: 0,
    fontSize: 14,
    fills: muted,
  });

  await create("figma_create_rectangle", {
    parentId: PARENT,
    name: "Styled card",
    x: 64,
    y: 300,
    width: 320,
    height: 180,
    cornerRadius: 24,
    fills: white,
    strokes: gray,
    strokeWeight: 1,
    effects: shadow,
  });
  await create("figma_create_text", {
    parentId: PARENT,
    name: "Styled card label",
    text: "Visual Styling\nStroke + Shadow + Gradient",
    x: 92,
    y: 330,
    fontSize: 20,
    fontFamily: "Inter",
    fontStyle: "Bold",
    fills: ink,
    lineHeight: { unit: "PIXELS", value: 28 },
  });

  await create("figma_create_ellipse", {
    parentId: PARENT,
    name: "Ellipse",
    x: 440,
    y: 300,
    width: 120,
    height: 120,
    fills: blue,
    opacity: 0.9,
  });
  await create("figma_create_line", {
    parentId: PARENT,
    name: "Line",
    x: 600,
    y: 360,
    width: 160,
    rotation: 0,
    strokes: red,
    strokeWeight: 6,
  });
  await create("figma_create_polygon", {
    parentId: PARENT,
    name: "Polygon",
    x: 800,
    y: 300,
    width: 120,
    height: 120,
    pointCount: 6,
    fills: green,
  });
  await create("figma_create_star", {
    parentId: PARENT,
    name: "Star",
    x: 960,
    y: 300,
    width: 120,
    height: 120,
    pointCount: 5,
    innerRadius: 0.45,
    fills: yellow,
  });
  await create("figma_create_vector", {
    parentId: PARENT,
    name: "Vector triangle",
    x: 1120,
    y: 310,
    width: 120,
    height: 100,
    vectorPaths: [{ windingRule: "NONZERO", data: "M 60 0 L 120 100 L 0 100 Z" }],
    fills: solid(0.55, 0.35, 0.95),
  });

  await create("figma_create_text", {
    parentId: PARENT,
    name: "Advanced text sample",
    text: "Advanced Text\n行高、字距、对齐、自动高度",
    x: 64,
    y: 540,
    fontSize: 26,
    fontFamily: "Inter",
    fontStyle: "Bold",
    fills: ink,
    lineHeight: { unit: "PIXELS", value: 38 },
    letterSpacing: { unit: "PIXELS", value: -0.4 },
    textAutoResize: "HEIGHT",
  });

  const component = await create("figma_create_component", {
    parentId: PARENT,
    name: "Button Component",
    x: 520,
    y: 530,
    width: 180,
    height: 56,
    layoutMode: "HORIZONTAL",
    primaryAxisAlignItems: "CENTER",
    counterAxisAlignItems: "CENTER",
    fills: blue,
    cornerRadius: 28,
  });
  await create("figma_create_text", {
    parentId: component.id,
    name: "Button label",
    text: "Component",
    x: 0,
    y: 0,
    fontSize: 16,
    fontFamily: "Inter",
    fontStyle: "Bold",
    fills: white,
  });
  await create("figma_create_instance", {
    componentId: component.id,
    parentId: PARENT,
    name: "Button Instance",
    x: 740,
    y: 530,
  });

  await create("figma_create_image_rectangle", {
    parentId: PARENT,
    name: "Image fill rectangle",
    x: 64,
    y: 700,
    width: 320,
    height: 180,
    imageUrl: TEST_IMAGE,
    scaleMode: "FILL",
    cornerRadius: 24,
  });

  const updateRect = await create("figma_create_rectangle", {
    parentId: PARENT,
    name: "Update target",
    x: 440,
    y: 700,
    width: 220,
    height: 120,
    fills: softBlue,
    cornerRadius: 16,
  });
  await create("figma_update_node", {
    nodeId: updateRect.id,
    patch: {
      name: "Updated target: rotated + opacity",
      rotation: -6,
      opacity: 0.86,
      strokes: blue,
      strokeWeight: 2,
    },
  });

  await create("figma_select_node", { nodeId: PARENT });
  console.log("Done. All feature smoke tests created in frame", PARENT);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
