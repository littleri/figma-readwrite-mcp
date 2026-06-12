# Figma Local Styles Improvement Plan

## 1. Background

This project can currently create Figma nodes, auto layout frames, variables, Light/Dark variable modes, components, variants, and component properties. In the TableDoll AR component-library generation task, the MCP successfully generated:

- Figma Variables for Light/Dark color tokens.
- Auto-layout component boards.
- Component sets with variants such as `Mode`, `State`, `Tab`, `Active`.
- Component properties such as `Label` and `Show Icon`.
- Foundation boards that visually document color, typography, and effects.

However, the generated Figma file still shows an empty right-side `Styles` panel. This is expected with the current implementation because the MCP only applies visual properties directly to nodes or binds variables to node paints. It does not create native Figma Local Styles.

This is a product-level gap. For a design system workflow, designers expect reusable assets to appear under Figma's native `Styles` panel:

- Paint Styles
- Text Styles
- Effect Styles
- Optionally Grid Styles later

The goal of this improvement is to make the MCP capable of creating, reading, updating, binding, auditing, and batch-generating native Figma Local Styles.

## 2. Current Capability Assessment

### 2.1 What Works Today

Current MCP strengths:

- Creates and updates visual node attributes:
  - `fills`
  - `strokes`
  - `strokeWeight`
  - `strokeAlign`
  - `effects`
  - `opacity`
  - `cornerRadius`
  - `cornerSmoothing`
- Creates text nodes with typographic attributes:
  - `fontFamily`
  - `fontStyle`
  - `fontSize`
  - `lineHeight`
  - `letterSpacing`
  - alignment
  - auto resize
- Creates Figma Variables and variable collections.
- Supports Light/Dark modes through variable collections.
- Binds variables to fills, strokes, text fills, effect fields, and node fields.
- Creates component sets and component properties.
- Audits component properties and verifies instance overrides.

### 2.2 What Is Missing

The MCP does not currently support:

- `figma.createPaintStyle()`
- `figma.createTextStyle()`
- `figma.createEffectStyle()`
- `figma.getLocalPaintStylesAsync()`
- `figma.getLocalTextStylesAsync()`
- `figma.getLocalEffectStylesAsync()`
- Binding a node to a style through:
  - `setFillStyleIdAsync`
  - `setStrokeStyleIdAsync`
  - `setTextStyleIdAsync`
  - `setEffectStyleIdAsync`
- Updating existing Local Styles.
- Deleting existing Local Styles.
- Upserting styles by name to avoid duplicates.
- Auditing whether generated components use Local Styles.

### 2.3 Important Distinction

Variables and Styles are not interchangeable in Figma:

- Variables are best for themeable tokens and mode switching.
- Styles are best for reusable designer-facing assets in the right-side Styles panel.
- A mature design-system MCP should support both.

The target architecture is:

```text
Primitive tokens
  -> Semantic variables with Light/Dark modes
  -> Native Figma Local Styles
  -> Components that bind styles and variables
```

## 3. Goals

### 3.1 Primary Goal

Add first-class Local Styles support so generated design systems appear in Figma's native `Styles` panel and can be reused by designers without relying only on generated reference boards.

### 3.2 Required Outcomes

After this improvement, an AI or script must be able to:

1. Create Paint Styles, Text Styles, and Effect Styles.
2. Read all existing local styles.
3. Upsert styles by name.
4. Bind styles to existing nodes.
5. Generate a full design-system style set from a structured payload.
6. Audit whether a node or component tree uses the expected styles.
7. Run repeatably without producing uncontrolled duplicates.

## 4. Non-Goals

This improvement should not attempt to implement:

- Prototype interactions.
- Dev Mode write APIs.
- Remote library publishing.
- Team library import/sync.
- Complex rich text mixed-style editing beyond basic style binding.
- Grid styles unless the core Paint/Text/Effect implementation is already stable.

## 5. Proposed MCP Tool Additions

### 5.1 `figma_get_local_styles`

Read all local styles from the current Figma file.

Input:

```json
{
  "type": "all"
}
```

`type` values:

- `all`
- `paint`
- `text`
- `effect`

Output:

```json
{
  "paintStyles": [
    {
      "id": "...",
      "key": "...",
      "name": "TableDoll/Color/Accent/Primary",
      "description": "",
      "paints": []
    }
  ],
  "textStyles": [
    {
      "id": "...",
      "key": "...",
      "name": "TableDoll/Typography/Body",
      "fontName": { "family": "SF Pro", "style": "Regular" },
      "fontSize": 17,
      "lineHeight": { "unit": "PIXELS", "value": 24 },
      "letterSpacing": { "unit": "PIXELS", "value": 0 }
    }
  ],
  "effectStyles": [
    {
      "id": "...",
      "key": "...",
      "name": "TableDoll/Effect/HUD Shadow",
      "effects": []
    }
  ]
}
```

Notes:

- Use async APIs:
  - `figma.getLocalPaintStylesAsync()`
  - `figma.getLocalTextStylesAsync()`
  - `figma.getLocalEffectStylesAsync()`

### 5.2 `figma_create_paint_style`

Create a native Paint Style.

Input:

```json
{
  "name": "TableDoll/Color/Accent/Primary",
  "description": "Primary action blue",
  "paints": [
    {
      "type": "SOLID",
      "color": { "r": 0.039, "g": 0.518, "b": 1 },
      "opacity": 1
    }
  ],
  "upsert": true
}
```

Behavior:

- If `upsert` is true and a local paint style with the same name exists, update it instead of creating a duplicate.
- If `upsert` is false and the style exists, return a clear error.
- Return the style id, name, and whether the operation was `created` or `updated`.

Implementation API:

```ts
const style = figma.createPaintStyle();
style.name = payload.name;
style.description = payload.description ?? "";
style.paints = payload.paints;
```

### 5.3 `figma_create_text_style`

Create a native Text Style.

Input:

```json
{
  "name": "TableDoll/Typography/Body",
  "description": "iOS body text",
  "fontFamily": "SF Pro",
  "fontStyle": "Regular",
  "fontSize": 17,
  "lineHeight": { "unit": "PIXELS", "value": 24 },
  "letterSpacing": { "unit": "PIXELS", "value": 0 },
  "paragraphSpacing": 0,
  "paragraphIndent": 0,
  "upsert": true
}
```

Behavior:

- Load the font before applying it.
- If `SF Pro` is unavailable, return a clear font loading error instead of silently falling back.
- If `upsert` is true, update the existing text style by name.

Implementation API:

```ts
const style = figma.createTextStyle();
style.name = payload.name;
await figma.loadFontAsync({ family: payload.fontFamily, style: payload.fontStyle });
style.fontName = { family: payload.fontFamily, style: payload.fontStyle };
style.fontSize = payload.fontSize;
style.lineHeight = payload.lineHeight;
style.letterSpacing = payload.letterSpacing;
```

### 5.4 `figma_create_effect_style`

Create a native Effect Style.

Input:

```json
{
  "name": "TableDoll/Effect/HUD Shadow",
  "description": "Floating AR HUD shadow",
  "effects": [
    {
      "type": "DROP_SHADOW",
      "color": { "r": 0, "g": 0, "b": 0, "a": 0.16 },
      "offset": { "x": 0, "y": 6 },
      "radius": 18,
      "visible": true
    }
  ],
  "upsert": true
}
```

Implementation API:

```ts
const style = figma.createEffectStyle();
style.name = payload.name;
style.description = payload.description ?? "";
style.effects = payload.effects;
```

### 5.5 `figma_update_style`

Update an existing style by id.

Input:

```json
{
  "styleId": "...",
  "styleType": "paint",
  "name": "TableDoll/Color/Accent/Primary",
  "description": "Updated description",
  "paints": []
}
```

`styleType` values:

- `paint`
- `text`
- `effect`

The payload should validate fields according to style type.

### 5.6 `figma_delete_style`

Delete a local style by id.

Input:

```json
{
  "styleId": "...",
  "styleType": "paint"
}
```

Behavior:

- Return a clear error if the style does not exist.
- Do not delete remote library styles.
- Return `{ ok: true, deleted: true }` on success.

### 5.7 `figma_bind_style`

Bind a native style to a node.

Input:

```json
{
  "nodeId": "...",
  "styleId": "...",
  "target": "fill"
}
```

`target` values:

- `fill`
- `stroke`
- `text`
- `effect`

Implementation:

Use async setters where available to support dynamic-page access:

```ts
if (target === "fill") await node.setFillStyleIdAsync(styleId);
if (target === "stroke") await node.setStrokeStyleIdAsync(styleId);
if (target === "text") await textNode.setTextStyleIdAsync(styleId);
if (target === "effect") await node.setEffectStyleIdAsync(styleId);
```

Fallbacks can use direct properties only if typings and runtime allow:

```ts
node.fillStyleId = styleId;
node.strokeStyleId = styleId;
textNode.textStyleId = styleId;
node.effectStyleId = styleId;
```

Validation:

- `fill` requires node supports fills.
- `stroke` requires node supports strokes.
- `text` requires node type is `TEXT`.
- `effect` requires node supports effects.
- Return clear, typed errors for unsupported node/target combinations.

### 5.8 `figma_create_design_system_styles`

Batch create/upsert a style set.

Input:

```json
{
  "upsert": true,
  "paintStyles": [
    {
      "name": "TableDoll/Color/Accent/Primary",
      "description": "Primary action color",
      "paints": [
        { "type": "SOLID", "color": { "r": 0.039, "g": 0.518, "b": 1 }, "opacity": 1 }
      ]
    }
  ],
  "textStyles": [
    {
      "name": "TableDoll/Typography/Body",
      "fontFamily": "SF Pro",
      "fontStyle": "Regular",
      "fontSize": 17,
      "lineHeight": { "unit": "PIXELS", "value": 24 },
      "letterSpacing": { "unit": "PIXELS", "value": 0 }
    }
  ],
  "effectStyles": [
    {
      "name": "TableDoll/Effect/HUD Shadow",
      "effects": [
        {
          "type": "DROP_SHADOW",
          "color": { "r": 0, "g": 0, "b": 0, "a": 0.16 },
          "offset": { "x": 0, "y": 6 },
          "radius": 18,
          "visible": true
        }
      ]
    }
  ]
}
```

Output:

```json
{
  "paintStyles": [
    { "id": "...", "name": "...", "operation": "created" }
  ],
  "textStyles": [
    { "id": "...", "name": "...", "operation": "updated" }
  ],
  "effectStyles": [
    { "id": "...", "name": "...", "operation": "created" }
  ],
  "summary": {
    "created": 12,
    "updated": 4,
    "skipped": 0,
    "failed": 0
  }
}
```

Behavior:

- This should be transactional enough for practical use.
- If one style fails because of font loading, return a per-item failure report.
- Do not leave partially created duplicate styles when `upsert` is true.

### 5.9 `figma_audit_styles`

Audit local style inventory.

Input:

```json
{
  "prefix": "TableDoll/"
}
```

Output:

```json
{
  "paintStyles": 18,
  "textStyles": 9,
  "effectStyles": 4,
  "duplicates": [],
  "missingExpected": []
}
```

Optional input:

```json
{
  "prefix": "TableDoll/",
  "expected": {
    "paintStyles": ["TableDoll/Color/Accent/Primary"],
    "textStyles": ["TableDoll/Typography/Body"],
    "effectStyles": ["TableDoll/Effect/HUD Shadow"]
  }
}
```

### 5.10 `figma_audit_node_style_binding`

Audit whether a node tree uses expected Local Styles.

Input:

```json
{
  "nodeId": "...",
  "depth": 4,
  "expectedPrefix": "TableDoll/"
}
```

Output:

```json
{
  "nodeId": "...",
  "checkedNodes": 120,
  "styleBindings": [
    {
      "nodeId": "...",
      "nodeName": "Label",
      "target": "text",
      "styleId": "...",
      "styleName": "TableDoll/Typography/Body"
    }
  ],
  "unboundStyledNodes": [
    {
      "nodeId": "...",
      "nodeName": "Button Background",
      "reason": "has raw fill but no fillStyleId"
    }
  ]
}
```

## 6. Schema Changes

Modify:

- `src/schemas.ts`

Add exported schemas:

- `paintStyleSchema`
- `textLocalStyleSchema`
- `effectLocalStyleSchema`
- `createPaintStyleSchema`
- `createTextStyleSchema`
- `createEffectStyleSchema`
- `getLocalStylesSchema`
- `updateStyleSchema`
- `deleteStyleSchema`
- `bindStyleSchema`
- `createDesignSystemStylesSchema`
- `auditStylesSchema`
- `auditNodeStyleBindingSchema`

Recommended style target enums:

```ts
export const localStyleTypeSchema = z.enum(["paint", "text", "effect"]);
export const styleBindTargetSchema = z.enum(["fill", "stroke", "text", "effect"]);
```

Reuse existing schemas:

- `paintSchema`
- `effectSchema`
- `textStyleSchema`

Extend text style schema for Local Styles:

```ts
export const localTextStylePayloadSchema = textStyleSchema.extend({
  name: z.string().min(1),
  description: z.string().optional(),
  fontFamily: z.string().min(1),
  fontStyle: z.string().min(1),
  fontSize: z.number().positive(),
  upsert: z.boolean().optional(),
});
```

Update `PluginCommand` union with new command types.

## 7. Server Tool Registration

Modify:

- `src/mcp/tools/write.ts`

Register tools near Variables or create a new section named `Local Styles`.

Required tool names:

- `figma_get_local_styles`
- `figma_create_paint_style`
- `figma_create_text_style`
- `figma_create_effect_style`
- `figma_update_style`
- `figma_delete_style`
- `figma_bind_style`
- `figma_create_design_system_styles`
- `figma_audit_styles`
- `figma_audit_node_style_binding`

Use `callPluginTool` for write tools and `asJsonText` for read-only tools where appropriate.

Annotate read-only tools:

```ts
annotations: { readOnlyHint: true }
```

## 8. Plugin Implementation

Modify:

- `plugin/code.ts`

Add helper functions:

```ts
async function getLocalStylesByType(type: "paint" | "text" | "effect" | "all") {}
async function findPaintStyleByName(name: string) {}
async function findTextStyleByName(name: string) {}
async function findEffectStyleByName(name: string) {}
function serializePaintStyle(style: PaintStyle) {}
function serializeTextStyle(style: TextStyle) {}
function serializeEffectStyle(style: EffectStyle) {}
async function createOrUpdatePaintStyle(payload: Record<string, unknown>) {}
async function createOrUpdateTextStyle(payload: Record<string, unknown>) {}
async function createOrUpdateEffectStyle(payload: Record<string, unknown>) {}
async function bindStyleToNode(payload: Record<string, unknown>) {}
```

Add command handlers:

```ts
if (command.type === "getLocalStyles") {}
if (command.type === "createPaintStyle") {}
if (command.type === "createTextStyle") {}
if (command.type === "createEffectStyle") {}
if (command.type === "updateStyle") {}
if (command.type === "deleteStyle") {}
if (command.type === "bindStyle") {}
if (command.type === "createDesignSystemStyles") {}
if (command.type === "auditStyles") {}
if (command.type === "auditNodeStyleBinding") {}
```

### 8.1 Style Serialization Requirements

Paint style serialization should include:

- `id`
- `key`
- `name`
- `description`
- `paints`
- `remote`

Text style serialization should include:

- `id`
- `key`
- `name`
- `description`
- `fontName`
- `fontSize`
- `lineHeight`
- `letterSpacing`
- `paragraphSpacing`
- `paragraphIndent`
- `remote`

Effect style serialization should include:

- `id`
- `key`
- `name`
- `description`
- `effects`
- `remote`

### 8.2 Upsert Rules

Use exact style name matching.

If duplicate local styles already exist with the same name:

- `upsert: true` should update the first match and return a warning listing duplicate ids.
- `upsert: false` should return a clear duplicate error.

Do not modify remote styles.

### 8.3 Font Loading Rules

For text styles:

- Always call `figma.loadFontAsync(fontName)` before assigning `fontName`.
- If font loading fails, return a clear error:

```text
Failed to load font SF Pro / Regular. CreateTextStyle aborted.
```

Do not silently fallback from `SF Pro` to `Inter`.

## 9. Binding Styles to Nodes

Use async setters from Figma typings:

- `setFillStyleIdAsync`
- `setStrokeStyleIdAsync`
- `setTextStyleIdAsync`
- `setEffectStyleIdAsync`

Validation matrix:

| Target | Valid node capability | Error if invalid |
|---|---|---|
| `fill` | node has fills and `setFillStyleIdAsync` | `Node does not support fill styles` |
| `stroke` | node has strokes and `setStrokeStyleIdAsync` | `Node does not support stroke styles` |
| `text` | node type is `TEXT` | `Text style target requires TEXT node` |
| `effect` | node has effects and `setEffectStyleIdAsync` | `Node does not support effect styles` |

The result should return the node id and the bound style id:

```json
{
  "nodeId": "...",
  "target": "text",
  "styleId": "...",
  "styleName": "TableDoll/Typography/Body"
}
```

## 10. Integration With Variables

Variables should not be removed. They remain necessary for Light/Dark mode.

Recommended model:

- Variables represent themeable semantic token values.
- Paint Styles provide designer-facing reusable color/style assets.
- Components can bind either variables or styles depending on use case.

Important limitation:

- A Paint Style itself can hold paints.
- If the style's paints support bound variables through Figma's API, add a future enhancement to bind style paints to variables.
- Do not block this first implementation on variable-bound styles. First ship native Local Styles creation and node binding.

## 11. Documentation Updates

Update:

- `docs/expanded-tools.md`
- `docs/product-usage-guide.md`

Add:

- Tool list for Local Styles.
- Examples for creating Paint/Text/Effect Styles.
- Examples for binding styles to nodes.
- Explanation of Variables vs Styles.
- Known limitation if variable-bound styles are not implemented in phase 1.

## 12. Test Scripts

Add:

- `scripts/test-local-styles.mjs`

Test sequence:

1. Check MCP health and plugin connection.
2. Create/upsert a Paint Style:
   - `MCP Test/Color/Primary`
3. Create/upsert a Text Style:
   - `MCP Test/Typography/Body`
4. Create/upsert an Effect Style:
   - `MCP Test/Effect/Shadow`
5. Read local styles and assert all three exist.
6. Create a rectangle.
7. Bind paint style to rectangle fill.
8. Bind effect style to rectangle effect.
9. Create a text node.
10. Bind text style to text node.
11. Audit node style binding and assert bindings are visible.
12. Re-run upsert and assert no duplicate styles were created.
13. Optionally delete the `MCP Test/*` styles at the end if `cleanup: true`.

Expected command:

```powershell
node scripts/test-local-styles.mjs
```

## 13. TableDoll Acceptance Test

After implementing Local Styles, rerun a TableDoll component-library generation script updated to call `figma_create_design_system_styles`.

Expected visible result in Figma:

- Right-side `Styles` panel is not empty.
- Paint Styles include:
  - `TableDoll/Color/BG/Canvas`
  - `TableDoll/Color/BG/Elevated`
  - `TableDoll/Color/Text/Primary`
  - `TableDoll/Color/Accent/Primary`
  - `TableDoll/Color/Accent/Mint`
  - `TableDoll/Color/Accent/Coral`
  - `TableDoll/Color/Accent/Violet`
  - `TableDoll/Color/Accent/Red`
- Text Styles include:
  - `TableDoll/Typography/Large Title`
  - `TableDoll/Typography/Title 1`
  - `TableDoll/Typography/Title 2`
  - `TableDoll/Typography/Headline`
  - `TableDoll/Typography/Body`
  - `TableDoll/Typography/Callout`
  - `TableDoll/Typography/Subheadline`
  - `TableDoll/Typography/Footnote`
  - `TableDoll/Typography/Caption`
- Effect Styles include:
  - `TableDoll/Effect/Shadow SM`
  - `TableDoll/Effect/Shadow MD`
  - `TableDoll/Effect/Sheet`
  - `TableDoll/Effect/HUD`

Expected MCP audit:

```json
{
  "paintStyles": 8,
  "textStyles": 9,
  "effectStyles": 4,
  "duplicates": []
}
```

Expected node binding audit:

- At least one button background is bound to a Paint Style or variable.
- At least one button label is bound to a Text Style.
- At least one HUD/sheet/card node is bound to an Effect Style.

## 14. Regression Tests

Run:

```powershell
npm run typecheck
npm run build
npm run codex:check
node scripts/test-component-properties.mjs
node scripts/test-local-styles.mjs
```

All must pass before handing the project back for review.

## 15. Acceptance Criteria

### P0 Acceptance

- `figma_get_local_styles` returns local Paint/Text/Effect Styles.
- `figma_create_paint_style` creates a style visible in Figma's right-side `Styles` panel.
- `figma_create_text_style` creates a style visible in Figma's right-side `Styles` panel.
- `figma_create_effect_style` creates a style visible in Figma's right-side `Styles` panel.
- `figma_bind_style` can bind:
  - paint style to fill
  - paint style to stroke
  - text style to text
  - effect style to effects
- `upsert: true` prevents duplicate local styles by exact name.
- Existing component-property tools continue to work.

### P1 Acceptance

- `figma_create_design_system_styles` can create a full style set in one call.
- `figma_audit_styles` detects missing and duplicate styles.
- `figma_audit_node_style_binding` identifies raw styled nodes that are not bound to Local Styles.
- Docs include clear Variables vs Styles guidance.

### P2 Acceptance

- Updated TableDoll generator uses native Local Styles.
- Figma right-side `Styles` panel contains TableDoll style groups.
- Running the generator twice does not create duplicate `TableDoll/*` styles.

## 16. Implementation Notes and Risks

### 16.1 Dynamic Page Access

Some style id properties are read-only under Figma's `documentAccess: "dynamic-page"` mode. Prefer async setters:

- `setFillStyleIdAsync`
- `setStrokeStyleIdAsync`
- `setTextStyleIdAsync`
- `setEffectStyleIdAsync`

### 16.2 Font Availability

Text style creation can fail if a font is unavailable. The test script should use a known available font such as `Inter` for MCP tests. Product generators can request `SF Pro`, but they must handle font loading errors clearly.

### 16.3 Existing Duplicate Pollution

Existing Figma files may already contain duplicate variables or generated boards from previous failed runs. Do not attempt automatic cleanup unless explicitly requested. Style creation should only prevent new duplicates under the same exact style name.

### 16.4 Style Deletion Safety

Deleting styles can affect existing nodes. Only test scripts should delete their own `MCP Test/*` styles. Production tools should require explicit `confirm: true` if bulk deletion is later added.

## 17. Recommended Work Order

1. Add schemas in `src/schemas.ts`.
2. Add tool registrations in `src/mcp/tools/write.ts`.
3. Add plugin command handlers in `plugin/code.ts`.
4. Add serialization helpers for Paint/Text/Effect Styles.
5. Add upsert helpers.
6. Add bind-style helper.
7. Add audit helpers.
8. Add `scripts/test-local-styles.mjs`.
9. Update docs.
10. Run full regression tests.

## 18. Review Checklist for Codex After Implementation

When this project returns for review, verify:

- `rg "createPaintStyle|createTextStyle|createEffectStyle" plugin src` finds real implementation.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run codex:check` passes with plugin connected.
- `node scripts/test-local-styles.mjs` passes.
- Figma right-side `Styles` panel visibly contains test styles or generated TableDoll styles.
- Re-running the local styles test does not create duplicates.
- Component-property tests still pass.
- Docs describe Variables vs Styles accurately.
