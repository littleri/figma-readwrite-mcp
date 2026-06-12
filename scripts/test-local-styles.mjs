/**
 * Local Styles test suite.
 *
 * Run:
 *   node scripts/test-local-styles.mjs
 *
 * Prerequisites:
 *   - npm run dev is running
 *   - Figma plugin is connected
 *   - A test Figma file is open
 *
 * Exits with code 0 on full pass, code 1 on any failure.
 */

import { randomUUID } from "node:crypto";

const BASE = process.env.FIGMA_MCP_URL || "http://127.0.0.1:8787/mcp";
const HEALTH_URL = BASE.replace(/\/mcp\/?$/, "/health");

// ============================================================
// MCP protocol helpers
// ============================================================

function parseMcpResponse(text) {
  const match = text.match(/data: (\{.*\})/s);
  return JSON.parse(match ? match[1] : text);
}

async function rpc(method, params = {}) {
  const response = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
  });
  if (!response.ok) throw new Error(`MCP HTTP ${response.status}: ${await response.text()}`);
  return parseMcpResponse(await response.text());
}

async function callTool(name, args = {}) {
  const response = await rpc("tools/call", { name, arguments: args });
  const text = response?.result?.content?.[0]?.text ?? "";
  let data = text;
  try { data = JSON.parse(text); } catch { /* keep text */ }
  if (response?.result?.isError === true) throw new Error(typeof data === "object" ? JSON.stringify(data) : String(data));
  if (data && typeof data === "object" && data.ok === false) throw new Error(data.error || JSON.stringify(data));
  return data;
}

// callTool returns { ok: true, result: {...} } or { ok: false, error: "..." }
// unwrap extracts .result from the ok:true envelope
function u(r) {
  if (!r) return r;
  return r.result ?? r;
}

// ============================================================
// Test framework
// ============================================================

let failures = 0;
let tn = "";
function step(name) { tn = name; console.log(`\n${name}...`); }
function ok(label) { console.log(`   OK: ${label}`); }
function fail(msg) { console.error(`   FAIL [${tn}]: ${msg}`); failures++; }
function eq(a, e, label) {
  const as = JSON.stringify(a), es = JSON.stringify(e);
  if (as !== es) { console.error(`   FAIL [${tn}]: ${label || "mismatch"} — expected ${es}, got ${as}`); failures++; }
}

// ============================================================
// Main
// ============================================================

const PREFIX = "MCP Test";

async function main() {
  // 1. Health
  step("1. Health check");
  const health = await fetch(HEALTH_URL).then(r => r.json());
  if (!health?.plugin?.connected) { console.error("FATAL: Plugin not connected."); process.exit(1); }
  ok("Plugin: " + (health.plugin.metadata?.fileName || "connected"));

  await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test-local-styles", version: "1.0" } });

  // 2-4. Create styles
  const psRes = u(await callTool("figma_create_paint_style", {
    name: `${PREFIX}/Color/Primary`, description: "Test blue",
    paints: [{ type: "SOLID", color: { r: 0.04, g: 0.52, b: 1 }, opacity: 1 }], upsert: true,
  }));
  step("2. Create Paint Style");
  psRes?.id ? ok(`${psRes.operation}: ${psRes.name}`) : fail("No id: " + JSON.stringify(psRes));

  const tsRes = u(await callTool("figma_create_text_style", {
    name: `${PREFIX}/Typography/Body`, fontFamily: "Inter", fontStyle: "Regular", fontSize: 17,
    lineHeight: { unit: "PIXELS", value: 24 }, letterSpacing: { unit: "PIXELS", value: 0 }, upsert: true,
  }));
  step("3. Create Text Style");
  tsRes?.id ? ok(`${tsRes.operation}: ${tsRes.name}`) : fail("No id");

  const esRes = u(await callTool("figma_create_effect_style", {
    name: `${PREFIX}/Effect/Shadow`, description: "Test shadow",
    effects: [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.16 }, offset: { x: 0, y: 6 }, radius: 18, visible: true }],
    upsert: true,
  }));
  step("4. Create Effect Style");
  esRes?.id ? ok(`${esRes.operation}: ${esRes.name}`) : fail("No id");

  // 5. Read all
  step("5. Read local styles");
  const all = u(await callTool("figma_get_local_styles", { type: "all" }));
  all?.paintStyles?.some(s => s.name === `${PREFIX}/Color/Primary`) ? ok("Paint style found") : fail("Paint style not found");
  all?.textStyles?.some(s => s.name === `${PREFIX}/Typography/Body`) ? ok("Text style found") : fail("Text style not found");
  all?.effectStyles?.some(s => s.name === `${PREFIX}/Effect/Shadow`) ? ok("Effect style found") : fail("Effect style not found");

  // 6. Re-upsert — paint/text/effect all tested for no-duplicate
  step("6. Re-upsert (no duplicates)");
  const ps2 = u(await callTool("figma_create_paint_style", {
    name: `${PREFIX}/Color/Primary`, paints: [{ type: "SOLID", color: { r: 0.04, g: 0.52, b: 1 }, opacity: 1 }], upsert: true,
  }));
  eq(ps2?.operation, "updated", "Paint re-upsert operation");
  const ts2 = u(await callTool("figma_create_text_style", {
    name: `${PREFIX}/Typography/Body`, fontFamily: "Inter", fontStyle: "Regular", fontSize: 17, upsert: true,
  }));
  eq(ts2?.operation, "updated", "Text re-upsert operation");
  const es2 = u(await callTool("figma_create_effect_style", {
    name: `${PREFIX}/Effect/Shadow`, effects: [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.16 }, offset: { x: 0, y: 6 }, radius: 18 }], upsert: true,
  }));
  eq(es2?.operation, "updated", "Effect re-upsert operation");
  ok("Paint/Text/Effect re-upsert all returned 'updated' — no duplicates");

  // 7. Create nodes and bind all 4 target types
  step("7. Create nodes and bind styles (fill/stroke/text/effect)");
  const rectRaw = u(await callTool("figma_create_rectangle", { name: `${PREFIX} Bind Rect`, x: 0, y: 0, width: 100, height: 100 }));
  const rectId = rectRaw?.id || rectRaw?.result?.id;
  rectId ? ok("Rectangle created") : fail("No rect id");

  // Fill binding
  const bindFill = u(await callTool("figma_bind_style", { nodeId: rectId, styleId: psRes?.id, target: "fill" }));
  eq(bindFill?.target, "fill", "Fill bind target");
  ok("Fill binding OK");

  // Stroke binding
  const bindStroke = u(await callTool("figma_bind_style", { nodeId: rectId, styleId: psRes?.id, target: "stroke" }));
  eq(bindStroke?.target, "stroke", "Stroke bind target");
  ok("Stroke binding OK");

  // Effect binding
  const bindEffect = u(await callTool("figma_bind_style", { nodeId: rectId, styleId: esRes?.id, target: "effect" }));
  eq(bindEffect?.target, "effect", "Effect bind target");
  ok("Effect binding OK");

  // Text node + text binding
  const textRaw = u(await callTool("figma_create_text", { name: `${PREFIX} Bind Text`, text: "Hello", x: 120, y: 0 }));
  const textNodeId = textRaw?.id || textRaw?.result?.id;
  textNodeId ? ok("Text node created") : fail("No text node id");
  const bindText = u(await callTool("figma_bind_style", { nodeId: textNodeId, styleId: tsRes?.id, target: "text" }));
  eq(bindText?.target, "text", "Text bind target");
  ok("Text binding OK");

  // 8. Audit node style binding (with expectedPrefix check)
  step("8. Audit node style binding");
  const bindAudit = u(await callTool("figma_audit_node_style_binding", { nodeId: rectId, depth: 4, expectedPrefix: PREFIX + "/" }));
  typeof bindAudit?.checkedNodes === "number" ? ok(`Checked ${bindAudit.checkedNodes} nodes, ${bindAudit.styleBindings?.length || 0} bindings`) : fail("No checkedNodes");
  eq((bindAudit?.wrongPrefixBindings || []).length, 0, "No wrong-prefix bindings");

  // 9. Audit styles
  step("9. Audit styles");
  const styleAudit = u(await callTool("figma_audit_styles", {
    prefix: PREFIX + "/",
    expected: {
      paintStyles: [`${PREFIX}/Color/Primary`],
      textStyles: [`${PREFIX}/Typography/Body`],
      effectStyles: [`${PREFIX}/Effect/Shadow`],
    },
  }));
  eq((styleAudit?.missingExpected || []).length, 0, "Missing expected count");
  eq((styleAudit?.duplicates || []).length, 0, "Duplicate count");
  ok(`paint:${styleAudit?.paintStyles} text:${styleAudit?.textStyles} effect:${styleAudit?.effectStyles}`);

  // 10. Batch create styles via figma_create_design_system_styles
  step("10. Batch create design system styles");
  const batchRes = u(await callTool("figma_create_design_system_styles", {
    upsert: true,
    paintStyles: [
      { name: `${PREFIX}/Color/Second`, paints: [{ type: "SOLID", color: { r: 0.2, g: 0.8, b: 0.4 }, opacity: 1 }] },
      { name: `${PREFIX}/Color/Third`, paints: [{ type: "SOLID", color: { r: 1, g: 0.6, b: 0.2 }, opacity: 1 }] },
    ],
    textStyles: [
      { name: `${PREFIX}/Typography/Title`, fontFamily: "Inter", fontStyle: "Bold", fontSize: 28 },
      { name: `${PREFIX}/Typography/Caption`, fontFamily: "Inter", fontStyle: "Regular", fontSize: 12 },
    ],
    effectStyles: [
      { name: `${PREFIX}/Effect/Blur`, effects: [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 2 }, radius: 8 }] },
    ],
  }));
  eq(batchRes?.summary?.failed, 0, "Batch summary: 0 failed");
  batchRes?.summary?.created >= 3 ? ok(`Batch created/updated: ${JSON.stringify(batchRes.summary)}`) : fail("Batch created too few: " + JSON.stringify(batchRes.summary));

  // 11. Re-batch upsert — should update, not create duplicates
  step("11. Batch re-upsert");
  const batch2 = u(await callTool("figma_create_design_system_styles", {
    upsert: true,
    paintStyles: [{ name: `${PREFIX}/Color/Second`, paints: [{ type: "SOLID", color: { r: 0.2, g: 0.8, b: 0.4 }, opacity: 1 }] }],
  }));
  eq(batch2?.summary?.created, 0, "Second batch created 0 new styles");
  eq(batch2?.summary?.failed, 0, "Second batch 0 failed");
  ok("Re-batch upsert all updates, no new duplicates");

  // 12. Update style
  step("12. Update style");
  const updated = u(await callTool("figma_update_style", {
    styleId: psRes?.id, styleType: "paint", name: `${PREFIX}/Color/Primary Updated`,
  }));
  updated?.name ? ok(`Updated name: ${updated.name}`) : fail("Update failed: " + JSON.stringify(updated));

  // 13. Cleanup
  step("10. Cleanup");
  const cleanup = u(await callTool("figma_get_local_styles", { type: "all" }));
  let cleaned = 0;
  for (const s of [...(cleanup?.paintStyles || []), ...(cleanup?.textStyles || []), ...(cleanup?.effectStyles || [])]) {
    if (s.name.startsWith(PREFIX + "/")) {
      const st = s.paints ? "paint" : s.fontName ? "text" : "effect";
      await callTool("figma_delete_style", { styleId: s.id, styleType: st });
      cleaned++;
    }
  }
  ok(`Deleted ${cleaned} test styles`);
  try { if (rectId) await callTool("figma_delete_node", { nodeId: rectId }); } catch { /* ok */ }
  try { if (textNodeId) await callTool("figma_delete_node", { nodeId: textNodeId }); } catch { /* ok */ }

  // Result
  console.log("\n" + "=".repeat(50));
  if (failures === 0) { console.log("ALL TESTS PASSED"); process.exitCode = 0; }
  else { console.error(`${failures} TEST(S) FAILED`); process.exitCode = 1; }
}

main().catch(e => { console.error("Crashed:", e.message); process.exit(1); });
