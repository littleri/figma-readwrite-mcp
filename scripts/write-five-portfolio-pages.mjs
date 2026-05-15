import { randomUUID } from "crypto";

const BASE = "http://localhost:8787/mcp";
const PAGE = "37:124";
const W = 1440;
const H = 1024;
const GAP = 180;

const white = solid(1, 1, 1);
const bg = solid(0.965, 0.968, 0.976);
const ink = solid(0.08, 0.08, 0.1);
const muted = solid(0.36, 0.38, 0.43);
const blue = solid(0.17, 0.28, 0.95);
const softBlue = solid(0.92, 0.95, 1);
const line = solid(0.9, 0.91, 0.94);
const pink = solid(0.99, 0.89, 0.9);
const green = solid(0.88, 0.95, 0.9);
const cream = solid(1, 0.94, 0.84);
const purple = solid(0.92, 0.88, 1);

function solid(r, g, b, opacity = 1) {
  return [{ type: "SOLID", color: { r, g, b }, opacity }];
}

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
  return content ? JSON.parse(content) : null;
}

async function create(tool, args) {
  const result = await callTool(tool, args);
  console.log("OK", tool, args.name ?? args.nodeId ?? "", "->", Array.isArray(result) ? result.map((r) => r.id).join(",") : result?.id ?? "");
  return result;
}

async function text(parentId, name, value, x, y, size, fills = ink, style = "Regular", extra = {}) {
  return create("figma_create_text", {
    parentId, name, text: value, x, y, fontSize: size, fontFamily: "Inter", fontStyle: style, fills,
    ...extra,
  });
}

async function rect(parentId, name, x, y, width, height, fills, cornerRadius = 0, extra = {}) {
  return create("figma_create_rectangle", { parentId, name, x, y, width, height, fills, cornerRadius, ...extra });
}

async function navbar(parentId, active) {
  await rect(parentId, "Navbar bg", 0, 0, W, 84, white);
  await rect(parentId, "Navbar line", 80, 83, 1280, 1, line);
  await text(parentId, "Logo", "REN XINGYU", 80, 32, 16, ink, "Bold");
  const items = [["Home", 565], ["Work", 640], ["Internship", 715], ["Hobbies", 830]];
  for (const [label, x] of items) await text(parentId, `Nav ${label}`, label, x, 34, 14, label === active ? blue : muted, label === active ? "Bold" : "Regular");
  await rect(parentId, "Contact button", 1240, 24, 110, 36, softBlue, 18);
  await text(parentId, "Contact text", "Contact", 1268, 34, 14, blue);
}

async function button(parentId, label, x, y, primary = true) {
  await rect(parentId, `${label} button bg`, x, y, 132, 44, primary ? blue : softBlue, 22);
  await text(parentId, `${label} button text`, label, x + 30, y + 13, 14, primary ? white : blue, "Bold");
}

async function projectCard(parentId, name, type, x, y, fill) {
  await rect(parentId, `${name} card`, x, y, 560, 360, white, 24, { strokes: line, strokeWeight: 1 });
  await rect(parentId, `${name} image`, x + 24, y + 24, 512, 220, fill, 18);
  await text(parentId, `${name} title`, name, x + 32, y + 274, 22, ink, "Bold");
  await text(parentId, `${name} type`, type, x + 32, y + 304, 14, muted);
  await text(parentId, `${name} link`, "View case study ->", x + 32, y + 328, 13, blue, "Bold");
}

async function main() {
  await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "portfolio-pages-writer", version: "1.0" } });
  const status = await callTool("figma_plugin_status", {});
  if (!status.connected) throw new Error("Figma plugin is not connected");

  const frames = await create("figma_create_page_from_template", {
    parentId: PAGE,
    template: "portfolio-site",
    pages: ["01 Home", "02 Work", "03 Project Detail", "04 Internship", "05 Hobbies"],
    startX: 0,
    startY: 0,
    gap: GAP,
    width: W,
    height: H,
    fills: bg,
  });

  const [home, work, detail, intern, hobbies] = frames;

  await navbar(home.id, "Home");
  await text(home.id, "Hero eyebrow", "Product Design Portfolio", 80, 190, 16, blue, "Bold");
  await text(home.id, "Hero title", "设计以人为本的\n数字产品体验", 80, 226, 64, ink, "Bold", { lineHeight: { unit: "PIXELS", value: 76 }, letterSpacing: { unit: "PIXELS", value: -1.5 } });
  await text(home.id, "Hero desc", "我是一名产品设计学生，关注用户研究、交互体验与视觉表达，擅长将复杂问题转化为清晰、可落地的设计方案。", 80, 410, 18, muted, "Regular", { lineHeight: { unit: "PIXELS", value: 30 } });
  await button(home.id, "View Work", 80, 506, true);
  await button(home.id, "About Me", 228, 506, false);
  await rect(home.id, "Hero image block", 820, 190, 460, 520, purple, 36);
  await rect(home.id, "Hero floating card", 720, 620, 360, 160, white, 28, { effects: [{ type: "DROP_SHADOW", color: { r: 0.1, g: 0.12, b: 0.18, a: 0.16 }, offset: { x: 0, y: 16 }, radius: 32, spread: 0, visible: true, blendMode: "NORMAL" }] });
  await text(home.id, "Floating title", "Selected Works", 756, 658, 24, ink, "Bold");
  await text(home.id, "Floating desc", "4 case studies / internship / hobbies", 756, 694, 15, muted);

  await navbar(work.id, "Work");
  await text(work.id, "Work title", "作品集总页", 80, 150, 48, ink, "Bold");
  await text(work.id, "Work subtitle", "Selected Works / 四个项目案例陈列", 80, 210, 16, muted);
  await projectCard(work.id, "Project Alpha", "UX Research · App Design", 80, 280, softBlue);
  await projectCard(work.id, "Project Beta", "Brand Identity · Visual System", 800, 280, pink);
  await projectCard(work.id, "Project Gamma", "Web Experience · Portfolio", 80, 700, green);
  await projectCard(work.id, "Project Delta", "Service Design · Journey Map", 800, 700, cream);

  await navbar(detail.id, "Work");
  await text(detail.id, "Detail eyebrow", "Case Study", 80, 145, 16, blue, "Bold");
  await text(detail.id, "Detail title", "Project Alpha\n移动端学习体验设计", 80, 180, 52, ink, "Bold", { lineHeight: { unit: "PIXELS", value: 62 } });
  await text(detail.id, "Detail intro", "通过用户访谈、任务流程拆解和原型测试，优化学生在碎片化时间中的学习路径与反馈体验。", 80, 330, 18, muted, "Regular", { lineHeight: { unit: "PIXELS", value: 30 } });
  await rect(detail.id, "Detail hero visual", 680, 150, 600, 360, softBlue, 32);
  const sections = [["01 Research", "用户访谈 / 竞品分析 / 痛点归纳"], ["02 Design", "信息架构 / 关键流程 / 高保真界面"], ["03 Outcome", "可用性测试 / 迭代建议 / 设计总结"]];
  for (let i = 0; i < sections.length; i++) {
    const y = 590 + i * 110;
    await rect(detail.id, `Detail section ${i + 1}`, 80, y, 1200, 82, white, 22, { strokes: line, strokeWeight: 1 });
    await text(detail.id, `Detail section title ${i + 1}`, sections[i][0], 112, y + 24, 22, ink, "Bold");
    await text(detail.id, `Detail section desc ${i + 1}`, sections[i][1], 340, y + 28, 16, muted);
  }

  await navbar(intern.id, "Internship");
  await text(intern.id, "Intern title", "实习经历", 80, 150, 48, ink, "Bold");
  await text(intern.id, "Intern subtitle", "Internship Experience / 设计实践与团队协作", 80, 210, 16, muted);
  const exps = [["2025 · Product Design Intern", "参与 B 端产品信息架构梳理、组件规范整理与交互原型设计。"], ["2024 · UX Research Assistant", "协助用户访谈、问卷整理和洞察提炼，输出体验问题地图。"], ["Campus Project Lead", "带领小组完成从调研到高保真的完整产品设计项目。"]];
  for (let i = 0; i < exps.length; i++) {
    const y = 300 + i * 170;
    await rect(intern.id, `Experience card ${i + 1}`, 80, y, 920, 130, white, 28, { strokes: line, strokeWeight: 1 });
    await text(intern.id, `Experience title ${i + 1}`, exps[i][0], 124, y + 34, 24, ink, "Bold");
    await text(intern.id, `Experience desc ${i + 1}`, exps[i][1], 124, y + 72, 16, muted);
  }
  await rect(intern.id, "Intern side visual", 1080, 300, 240, 470, purple, 36);

  await navbar(hobbies.id, "Hobbies");
  await text(hobbies.id, "Hobby title", "兴趣爱好", 80, 150, 48, ink, "Bold");
  await text(hobbies.id, "Hobby subtitle", "Hobbies / 设计之外的灵感来源", 80, 210, 16, muted);
  const hobbyItems = [["摄影", softBlue], ["插画", pink], ["旅行", green], ["阅读", cream], ["展览", purple], ["音乐", solid(0.9, 0.93, 0.96)]];
  for (let i = 0; i < hobbyItems.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 80 + col * 420;
    const y = 300 + row * 260;
    await rect(hobbies.id, `Hobby card ${hobbyItems[i][0]}`, x, y, 340, 210, hobbyItems[i][1], 30);
    await text(hobbies.id, `Hobby ${hobbyItems[i][0]}`, hobbyItems[i][0], x + 32, y + 142, 28, ink, "Bold");
  }

  await create("figma_select_node", { nodeId: PAGE });
  console.log("Done. Created 5 portfolio site pages under", PAGE);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
