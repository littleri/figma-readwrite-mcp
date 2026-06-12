/**
 * Component property improvement test suite.
 *
 * Run:
 *   node scripts/test-component-properties.mjs
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
// MCP protocol helpers (same pattern as codex-ready-check.mjs)
// ============================================================

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
    // Keep as text.
  }
  // Treat isError as a throw so callers get a clean catch
  if (response?.result?.isError === true) {
    throw new Error(typeof data === "object" ? JSON.stringify(data) : String(data));
  }
  // Also treat ok:false in data as a throw
  if (data && typeof data === "object" && data.ok === false) {
    throw new Error(data.error || JSON.stringify(data));
  }
  return data;
}

function unwrap(response) {
  return response?.result || response;
}

// ============================================================
// Test framework
// ============================================================

let failures = 0;
let testName = "";

function step(name) {
  testName = name;
  console.log(`\n${name}...`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`   FAIL [${testName}]: ${message}`);
    failures++;
    return false;
  }
  return true;
}

function assertEq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`   FAIL [${testName}]: ${label || "value mismatch"} — expected ${e}, got ${a}`);
    failures++;
    return false;
  }
  return true;
}

function ok(label) {
  console.log(`   OK: ${label}`);
}

// ============================================================
// Main
// ============================================================

async function main() {
  // --- 1. Health check ---
  step("1. Health check");
  let health;
  try {
    const res = await fetch(HEALTH_URL);
    health = await res.json();
  } catch (e) {
    console.error("FATAL: Cannot reach /health:", e.message);
    process.exit(1);
  }
  if (!health?.plugin?.connected) {
    console.error("FATAL: Plugin not connected. Open the Figma plugin first.");
    process.exit(1);
  }
  ok("Plugin connected, file: " + (health.plugin.metadata?.fileName || "unknown"));

  // Initialize MCP session
  await rpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test-component-properties", version: "1.0" },
  });

  // --- 2. Get current page ---
  step("2. Getting current page");
  const context = await callTool("figma_read_context", { scope: "currentPage" });
  ok("Current file: " + (context?.data?.pageName || context?.source || "ok"));

  const prefix = `Test_${Date.now()}`;

  // --- 3. Create Button component with properties ---
  step(`3. Create component "${prefix}_Button"`);
  let buttonComp;
  let compId;
  try {
    buttonComp = await callTool("figma_create_component_with_properties", {
      name: `${prefix}_Button`,
      x: 0,
      y: 0,
      width: 240,
      height: 54,
      layoutMode: "HORIZONTAL",
      itemSpacing: 8,
      paddingLeft: 16,
      paddingRight: 16,
      cornerRadius: 12,
      fills: [{ type: "SOLID", color: { r: 0.04, g: 0.52, b: 1 } }],
      layers: [
        { type: "TEXT", name: "Label", text: "Tap Me", fontSize: 17, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] },
        { type: "RECTANGLE", name: "Icon", width: 20, height: 20, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] },
      ],
      properties: [
        { name: "Label", type: "TEXT", defaultValue: "Tap Me", bind: { layerName: "Label", field: "characters" } },
        { name: "Show Icon", type: "BOOLEAN", defaultValue: true, bind: { layerName: "Icon", field: "visible" } },
      ],
      verify: true,
    });
    compId = buttonComp?.result?.id || buttonComp?.id;
    assert(compId, "Component has id");
    assert(buttonComp?.result?.type === "COMPONENT" || buttonComp?.type === "COMPONENT", "Type is COMPONENT");
    assert(buttonComp?.result?.propertyDefinitions || buttonComp?.propertyDefinitions, "Has propertyDefinitions");
    assert(buttonComp?.result?.probeResult?.verified === true || buttonComp?.probeResult?.verified === true, "Probe verification passed");
    ok("Created: " + compId);
  } catch (e) {
    assert(false, "Unexpected error: " + e.message);
  }

  // --- 4. Create smart instance ---
  step(`4. Create smart instance of "${prefix}_Button"`);
  let instance;
  let instId;
  try {
    assert(compId, "Component id available");
    instance = await callTool("figma_create_instance_smart", {
      componentId: compId,
      x: 300,
      y: 0,
      properties: { Label: "扫码加入", "Show Icon": false },
      verify: true,
    });
    instId = instance?.result?.id || instance?.id;
    assert(instId, "Instance has id");

    const rp = instance?.result?.resolvedProperties || instance?.resolvedProperties || {};
    assert(Object.keys(rp).length >= 1, "Has resolved properties");

    const cp = instance?.result?.componentProperties || instance?.componentProperties || {};
    ok("Instance: " + instId + " resolved: " + JSON.stringify(rp) + " actual: " + JSON.stringify(cp));

    // Strong assertions: verify .value on both TEXT and BOOLEAN properties
    const cpKeys = Object.keys(cp);
    const labelKey = cpKeys.find(k => k.startsWith("Label"));
    const iconKey = cpKeys.find(k => k.startsWith("Show Icon"));

    assert(labelKey, "componentProperties has a Label key");
    if (labelKey) {
      const labelEntry = cp[labelKey];
      assertEq(labelEntry?.value, "扫码加入", "TEXT property 'Label' .value");
    }

    assert(iconKey, "componentProperties has a Show Icon key");
    if (iconKey) {
      const iconEntry = cp[iconKey];
      assertEq(iconEntry?.value, false, "BOOLEAN property 'Show Icon' .value");
    }
  } catch (e) {
    assert(false, "Unexpected error: " + e.message);
  }

  // --- 5. Audit component ---
  step(`5. Audit "${prefix}_Button"`);
  try {
    const audit = await callTool("figma_audit_component_properties", {
      componentId: compId,
      createProbeInstance: true,
      cleanupProbe: true,
    });
    const ar = audit?.result || audit;
    assert(ar?.type, "Audit has type");
    assertEq(ar?.isComponentSet, false, "isComponentSet");
    assert(Array.isArray(ar?.properties), "Audit has properties array");

    if (ar?.properties) {
      for (const p of ar.properties) {
        assert(p.hasReference === true, `Property '${p.displayName}' hasReference=true, got ${p.hasReference}`);
        ok(`Property: ${p.displayName} (${p.type}) hasReference=${p.hasReference}`);
      }
    }

    if (ar?.probeResults) {
      for (const pr of ar.probeResults) {
        if (pr.probe === "skipped") {
          ok(`Probe ${pr.property}: skipped (${pr.reason})`);
        } else {
          assertEq(pr.probe, "passed", `Probe ${pr.property}`);
        }
      }
    }

    assertEq(ar?.warnings?.length || 0, 0, "Audit warnings count");
  } catch (e) {
    assert(false, "Unexpected error: " + e.message);
  }

  // --- 6. Bind by layer name ---
  step("6. Bind property by layer name");
  try {
    const bind = await callTool("figma_bind_component_property", {
      componentId: compId,
      propertyName: "Label",
      layerName: "Label",
      field: "characters",
    });
    const br = bind?.result || bind;
    assert(br?.propertyKey, "Has propertyKey");
    ok("Bound: " + br?.propertyKey + " field=" + br?.field);
  } catch (e) {
    assert(false, "Unexpected error: " + e.message);
  }

  // --- 7. Error paths ---
  step("7. Error paths");

  // 7a. Non-existent property → must throw
  try {
    await callTool("figma_create_instance_smart", {
      componentId: compId,
      x: 600,
      y: 0,
      properties: { BOGUS: "test" },
    });
    assert(false, "Should have thrown for non-existent property");
  } catch (e) {
    ok("Non-existent property correctly throws: " + e.message.split("\n")[0]);
  }

  // 7b. Non-existent component → must throw
  try {
    await callTool("figma_audit_component_properties", { componentId: "999999:999999" });
    assert(false, "Should have thrown for bad componentId");
  } catch (e) {
    ok("Non-existent component correctly throws");
  }

  // 7c. Bind to non-existent layer → must throw
  try {
    await callTool("figma_bind_component_property", {
      componentId: compId,
      propertyName: "Label",
      layerName: "NonExistentLayerXYZ",
      field: "characters",
    });
    assert(false, "Should have thrown for missing layer");
  } catch (e) {
    ok("Missing layer correctly throws");
  }

  // --- 8. Cleanup ---
  step("8. Cleanup");
  try {
    if (compId) {
      await callTool("figma_delete_node", { nodeId: compId });
      ok("Deleted component: " + compId);
    }
    if (instId) {
      await callTool("figma_delete_node", { nodeId: instId });
      ok("Deleted instance: " + instId);
    }
  } catch (e) {
    console.error("   Cleanup warning:", e.message);
  }

  // --- Result ---
  console.log("\n" + "=".repeat(50));
  if (failures === 0) {
    console.log("ALL TESTS PASSED");
    process.exitCode = 0;
  } else {
    console.error(`${failures} TEST(S) FAILED`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Test suite crashed:", e.message);
  process.exit(1);
});
