# SVG Asset Import Improvement Plan

## 1. Background

The current MCP can create Figma vector primitives and simple Vector nodes through `figma_create_vector`. This is useful for simple icons and decorative shapes, but it is not enough for a production workflow where SVG assets are generated locally and then imported into Figma.

The proposed workflow is:

```text
Local SVG source
  -> local validation / normalization / optimization
  -> MCP import into Figma
  -> Figma node placement
  -> optional style binding
  -> optional component creation
  -> audit and repeatable delivery
```

This path is valuable because local code is better at generating, linting, optimizing, versioning, and batch-processing SVG assets, while Figma is better at visual inspection, layout, componentization, and design handoff.

The product goal is to turn SVG import into a reliable design-system asset pipeline rather than a one-off drawing trick.

## 2. Current Capability Assessment

### 2.1 What Works Today

The MCP currently supports:

- Creating basic vector primitives:
  - line
  - polygon
  - star
  - vector path
- Creating a Figma `VECTOR` node from `vectorPaths`.
- Applying node-level visual styling:
  - fills
  - strokes
  - stroke weight
  - effects
  - opacity
- Creating image rectangles for raster assets.
- Creating components and component instances.
- Creating native Local Styles and binding nodes to styles.

### 2.2 What Is Missing

The MCP does not yet support a full SVG asset pipeline:

- No direct full SVG string import.
- No local SVG file import tool.
- No batch SVG asset import.
- No SVG path normalization.
- No SVG structure parsing fallback.
- No SVG-to-Figma import audit.
- No component packaging for imported SVG assets.
- No style extraction or style binding for imported SVG nodes.
- No delivery report describing which SVG features were preserved, simplified, or dropped.

### 2.3 Important Product Distinction

There are three different SVG-related workflows:

| Workflow | Best for | Current support | Target support |
|---|---|---:|---:|
| Vector path creation | simple icon paths | partial | strong |
| Full SVG import | editable SVG assets | missing | strong |
| Raster fallback | complex non-editable illustrations | partial | strong |

The product should support all three and choose the safest path based on SVG complexity.

## 3. Product Vision

Designers and AI agents should be able to generate SVG assets locally and reliably place them into Figma as named, organized, reusable design assets.

The ideal experience:

1. The user or AI generates SVG files under a local asset directory.
2. The MCP validates the SVG files before touching Figma.
3. The MCP imports each SVG into Figma with correct name, size, position, and parent frame.
4. Imported assets can optionally become Figma components.
5. Local Styles or Variables can optionally be applied after import.
6. Re-running the import updates or replaces known assets without creating uncontrolled duplicates.
7. The MCP returns a clear delivery report.

## 4. Target Users

### 4.1 Primary Users

- AI agents generating interface prototypes in Figma.
- Designers building component libraries from generated icons and illustrations.
- Product builders creating design-system assets from local code.
- Engineers maintaining repeatable asset pipelines.

### 4.2 Example Use Cases

- Import AR game icons into a mobile app component library.
- Generate toy/avatar badges locally and convert them into Figma components.
- Import empty-state illustrations into product screens.
- Batch-import tab bar icons and bind them to color styles.
- Convert generated SVG interaction hints into reusable components.

## 5. Product Improvement Method

This improvement should be delivered through staged product increments, not as one large unverified feature.

### 5.1 Stage 1: Native Full SVG Import MVP

Goal: prove that the MCP can import complete SVG strings into Figma.

Scope:

- Add `figma_create_from_svg`.
- Accept an SVG string.
- Use Figma's native SVG parsing in the companion plugin.
- Place the result on the current page or inside a parent node.
- Set name, x, y, width, and height when possible.
- Return created node id, type, dimensions, and warnings.

Out of scope:

- Batch import.
- Style extraction.
- Local file reading from MCP client.
- Component packaging.
- SVG parser fallback.

### 5.2 Stage 2: Local File and Batch Import

Goal: make the path useful for actual asset libraries.

Scope:

- Add local file import support.
- Add batch import support.
- Add duplicate handling by asset key or name.
- Add import report.
- Add cleanup-safe test prefix behavior.

Out of scope:

- Advanced SVG feature conversion.
- Pixel-perfect guarantee for every SVG feature.

### 5.3 Stage 3: Design-System Packaging

Goal: turn imported SVG assets into production design assets.

Scope:

- Optional component creation.
- Optional component set creation for icon states.
- Optional style binding.
- Optional naming convention enforcement.
- Optional asset board generation.
- Optional audit tool for imported SVG libraries.

### 5.4 Stage 4: Robust SVG Processing

Goal: handle messy real-world SVGs.

Scope:

- Local normalization.
- SVGO integration guidance.
- Path command normalization.
- Unsupported feature detection.
- Raster fallback option.
- Import diff report.

## 6. Proposed Tools

### 6.1 `figma_create_from_svg`

Create a Figma node from a complete SVG string.

Input:

```json
{
  "name": "Icon/Scan",
  "svg": "<svg viewBox=\"0 0 24 24\">...</svg>",
  "parentId": "123:456",
  "x": 0,
  "y": 0,
  "width": 24,
  "height": 24,
  "component": false,
  "replaceExistingByName": false
}
```

Behavior:

- Validate that `svg` is a non-empty string.
- Reject SVG payloads above the configured size limit.
- Create a Figma node from the SVG.
- Append it to `parentId` when provided; otherwise append to the current page.
- Set position.
- Resize proportionally when width or height is provided.
- Rename the imported node.
- If `component: true`, wrap or convert the imported node into a component.
- If `replaceExistingByName: true`, remove or replace an existing local node with the same name under the same parent.
- Return created node metadata.

Output:

```json
{
  "id": "123:789",
  "name": "Icon/Scan",
  "type": "FRAME",
  "width": 24,
  "height": 24,
  "componentId": null,
  "warnings": []
}
```

Implementation target:

- Add schema in `src/schemas.ts`.
- Register tool in `src/mcp/tools/write.ts`.
- Add plugin command in `plugin/code.ts`.
- Prefer the Figma Plugin API's native SVG import method.

### 6.2 `figma_import_svg_file`

Import one SVG file by local path.

Input:

```json
{
  "name": "Icon/Invite",
  "svgPath": "assets/svg/invite.svg",
  "parentId": "123:456",
  "x": 40,
  "y": 0,
  "width": 24,
  "height": 24,
  "component": true,
  "optimize": true,
  "replaceExistingByName": true
}
```

Behavior:

- Server reads the local SVG file.
- Path must resolve inside an allowed workspace root unless an explicit unsafe flag is introduced later.
- Optional optimization runs before import.
- Delegates the final SVG string to `figma_create_from_svg`.
- Returns both file metadata and Figma node metadata.

Output:

```json
{
  "sourcePath": "assets/svg/invite.svg",
  "bytes": 1240,
  "optimizedBytes": 980,
  "node": {
    "id": "123:800",
    "name": "Icon/Invite",
    "type": "COMPONENT"
  },
  "warnings": []
}
```

### 6.3 `figma_import_svg_assets`

Batch-import multiple SVG files or SVG strings.

Input:

```json
{
  "parentId": "123:456",
  "layout": {
    "direction": "HORIZONTAL",
    "gap": 24,
    "columns": 8
  },
  "component": true,
  "replaceExistingByName": true,
  "assets": [
    {
      "name": "Icon/Scan",
      "svgPath": "assets/svg/scan.svg",
      "width": 24,
      "height": 24
    },
    {
      "name": "Icon/Invite",
      "svg": "<svg viewBox=\"0 0 24 24\">...</svg>",
      "width": 24,
      "height": 24
    }
  ]
}
```

Behavior:

- Import assets sequentially to reduce plugin bridge instability.
- Continue on per-asset failures unless `failFast: true`.
- Apply deterministic layout when requested.
- Return a summary and per-asset results.
- Avoid uncontrolled duplicates when `replaceExistingByName` is true.

Output:

```json
{
  "summary": {
    "created": 18,
    "updated": 2,
    "failed": 1,
    "skipped": 0
  },
  "assets": [
    {
      "name": "Icon/Scan",
      "status": "created",
      "nodeId": "123:801",
      "warnings": []
    }
  ]
}
```

### 6.4 `figma_audit_svg_assets`

Audit imported SVG assets by prefix or parent frame.

Input:

```json
{
  "parentId": "123:456",
  "prefix": "Icon/",
  "expected": ["Icon/Scan", "Icon/Invite", "Icon/Chat"]
}
```

Behavior:

- Count imported SVG asset nodes.
- Detect duplicate names.
- Detect missing expected assets.
- Detect non-component assets when component mode is required.
- Optionally detect unbound fills/strokes later.

Output:

```json
{
  "total": 24,
  "duplicates": [],
  "missingExpected": [],
  "nonComponents": [],
  "warnings": []
}
```

### 6.5 Optional `figma_create_svg_group`

Create a grouped editable SVG-like structure from individual paths.

This is useful when full SVG import is not desirable and the caller wants each path to have explicit style control.

Input:

```json
{
  "name": "Icon/MultiColor",
  "x": 0,
  "y": 0,
  "paths": [
    {
      "name": "Base",
      "data": "M 0 0 L 24 0 L 24 24 L 0 24 Z",
      "windingRule": "NONZERO",
      "fills": [{ "type": "SOLID", "color": { "r": 0, "g": 0, "b": 0 } }]
    }
  ]
}
```

## 7. Local SVG Processing Requirements

### 7.1 Recommended Local Folder Structure

```text
assets/
  svg/
    source/
      scan.svg
      invite.svg
    optimized/
      scan.svg
      invite.svg
    manifest.json
```

### 7.2 Manifest Format

```json
{
  "collection": "TableDoll Icons",
  "prefix": "TableDoll/Icon/",
  "defaultSize": 24,
  "component": true,
  "assets": [
    {
      "name": "Scan",
      "path": "assets/svg/optimized/scan.svg",
      "tags": ["ar", "camera"]
    }
  ]
}
```

### 7.3 SVG Validation

Before import, the MCP or helper script should validate:

- File exists.
- File extension is `.svg`.
- File size is below limit.
- Content starts with or contains `<svg`.
- SVG has a `viewBox` or explicit width and height.
- SVG does not contain script tags.
- SVG does not contain external network references.
- SVG does not contain unsupported data payloads unless explicitly allowed.

### 7.4 SVG Optimization

Recommended optimization:

- Remove metadata and comments.
- Preserve `viewBox`.
- Convert style attributes to explicit attributes when practical.
- Expand or simplify transforms when safe.
- Keep ids only when needed by gradients, masks, or clips.
- Do not blindly remove fills/strokes if the asset depends on them.

### 7.5 Path Normalization

The current `figma_create_vector` path flow is sensitive to SVG path formatting. For path-level imports:

- Convert compact commands like `M64` to `M 64`.
- Normalize comma separators.
- Expand relative commands if needed.
- Preserve curve commands.
- Validate each path by creating a temporary node in test mode.

Full SVG import should rely on Figma's native SVG parser when available, reducing the need for manual path normalization.

## 8. Styling and Design-System Integration

### 8.1 Import-Time Styling

The first version should preserve styles embedded in SVG.

Later versions can support:

- `replaceFillWithStyle`
- `replaceStrokeWithStyle`
- `bindToLocalStyle`
- `bindToVariable`
- `monochromeColor`
- `currentColor` replacement

### 8.2 Style Binding Example

Input:

```json
{
  "name": "Icon/Scan",
  "svgPath": "assets/svg/scan.svg",
  "component": true,
  "styleBindings": {
    "fills": "TableDoll/Color/Text/Primary"
  }
}
```

Expected behavior:

- Import the SVG.
- Traverse imported descendants.
- Bind eligible fills to the named Paint Style.
- Return nodes that could not be bound.

### 8.3 Component Packaging

When `component: true`:

- Imported asset should become a Figma Component.
- Component name should match the requested asset name.
- Re-runs should update or replace the component predictably.
- Component description can include source path and import timestamp.

### 8.4 Asset Board Generation

Batch imports should optionally create an asset board:

- Auto-layout frame.
- Section title.
- Icon preview grid.
- Name labels.
- Status labels for failed imports.

This makes the import visually inspectable in Figma.

## 9. Duplicate and Update Rules

### 9.1 Default Behavior

Default should be safe:

- Do not delete existing nodes unless explicitly requested.
- If a node with the same name exists, return a clear duplicate warning.
- Do not silently create many duplicate assets on repeated runs.

### 9.2 Replace Existing

When `replaceExistingByName: true`:

- Search within the specified parent when `parentId` is provided.
- Otherwise search on the current page.
- Replace only nodes whose name exactly matches the import name.
- Return replaced node ids.
- Do not replace remote library components.

### 9.3 Upsert by Asset Key

Later versions should support stable asset keys:

```json
{
  "assetKey": "tabledoll.icon.scan.v1"
}
```

The key should be stored in plugin data on the imported node or component. This is more reliable than name matching.

## 10. Error Handling and Warnings

### 10.1 Required Error Cases

The tools must return clear errors for:

- Missing SVG string or path.
- File not found.
- Path outside allowed workspace.
- Invalid SVG.
- SVG payload too large.
- Figma plugin not connected.
- Figma SVG parser failure.
- Parent node not found.
- Failed resize.
- Failed component conversion.

### 10.2 Warning Cases

The tools should return warnings for:

- SVG imported but unsupported features may have been flattened.
- SVG has no viewBox.
- SVG contains masks, clips, filters, or external references.
- Duplicate node name found but not replaced.
- Imported asset is not editable as expected.
- Style binding partially failed.

Example:

```json
{
  "warnings": [
    {
      "code": "UNSUPPORTED_FILTER",
      "message": "SVG contains filter elements. Visual result may differ after Figma import."
    }
  ]
}
```

## 11. Security and Safety

SVG import must be treated as file and markup ingestion.

Requirements:

- Strip or reject `<script>`.
- Reject event handler attributes such as `onclick`.
- Reject external network references by default.
- Restrict local file reads to workspace roots.
- Enforce payload size limits.
- Avoid recursive directory import unless explicitly requested.
- Avoid destructive replacement unless `replaceExistingByName` or future `confirm` is set.
- For batch import, report every deletion or replacement.

## 12. Performance Requirements

Initial target limits:

- Single SVG string: up to 256 KB.
- Single batch: up to 100 assets.
- Default timeout for batch import: 60 seconds, adjustable.
- Per-asset result reporting required.
- Sequential import for stability in MVP.

Future optimization:

- Hash unchanged SVG files and skip unchanged imports.
- Cache optimized SVG content.
- Use asset manifest diffing.

## 13. Proposed Implementation Plan

### Phase 1: Schema and Single SVG Import

Files:

- `src/schemas.ts`
- `src/mcp/tools/write.ts`
- `plugin/code.ts`
- `plugin/code.js` generated by build

Tasks:

1. Add `createFromSvgSchema`.
2. Register `figma_create_from_svg`.
3. Add plugin command `createFromSvg`.
4. Append imported node to parent/current page.
5. Set name, position, and size.
6. Return node metadata and warnings.
7. Add tests.

### Phase 2: Local File Import

Files:

- `src/mcp/tools/write.ts`
- possibly `src/svg/*`
- `scripts/test-svg-import.mjs`

Tasks:

1. Add local path validation helper.
2. Add file read logic on server side.
3. Add `figma_import_svg_file`.
4. Add optional optimization hook.
5. Add workspace-root safety tests.

### Phase 3: Batch Import and Audit

Tasks:

1. Add `figma_import_svg_assets`.
2. Add deterministic grid layout.
3. Add per-asset failure handling.
4. Add `figma_audit_svg_assets`.
5. Add duplicate detection.
6. Add import report.

### Phase 4: Component and Style Integration

Tasks:

1. Add `component: true`.
2. Add asset key plugin data.
3. Add replace/update by asset key.
4. Add optional style binding.
5. Add asset board generation.

### Phase 5: Documentation and Recipes

Tasks:

1. Update `docs/expanded-tools.md`.
2. Update `docs/product-usage-guide.md`.
3. Add a recipe for local SVG to Figma component library.
4. Add examples for icon import, illustration import, and raster fallback.

## 14. Test Plan

### 14.1 Static Tests

Required commands:

```bash
npm run typecheck
npm run build
node scripts/check-tools.mjs
```

Expected:

- All commands pass.
- New tools appear in tool list.
- No TypeScript errors.

### 14.2 Functional Tests

Create `scripts/test-svg-import.mjs`.

Test cases:

1. Import a simple SVG string with one path.
2. Import a multi-path SVG string.
3. Import an SVG file from `assets/svg/source`.
4. Batch-import at least 3 SVG assets.
5. Re-run batch import with replacement enabled and verify no duplicates.
6. Import as components and verify component nodes exist.
7. Import into a specific parent frame.
8. Verify x/y/width/height are applied.
9. Verify unsupported SVG returns warnings, not silent success.
10. Verify invalid SVG fails clearly.
11. Verify file outside workspace is rejected.
12. Verify cleanup removes only test-prefixed nodes.

### 14.3 Visual Tests

Manual or automated Figma checks:

- Imported SVG appears in the expected page.
- Imported node has expected name.
- Imported node has expected size.
- Multi-path asset visually resembles source SVG.
- Batch grid is readable.
- Component mode creates reusable components.
- Re-run does not create uncontrolled duplicates.

### 14.4 Regression Tests

After implementation, rerun:

```bash
node scripts/test-local-styles.mjs
node scripts/test-component-properties.mjs
```

Expected:

- Existing Local Styles tools still pass.
- Existing component property tools still pass.

## 15. Acceptance Criteria

### P0 Acceptance

- `figma_create_from_svg` imports a valid full SVG string into Figma.
- Imported node returns a usable Figma node id.
- Imported node can be placed at requested x/y.
- Imported node can be resized to requested width/height.
- Invalid SVG returns a clear error.
- SVG payload size is validated.
- Existing vector, style, and component-property tests still pass.
- Documentation includes at least one complete example.

### P1 Acceptance

- `figma_import_svg_file` imports a local SVG file from the workspace.
- File path safety prevents reading outside allowed roots.
- `figma_import_svg_assets` batch-imports multiple assets.
- Batch import returns per-asset success/failure results.
- Re-running batch import with replacement enabled does not create duplicates.
- Import can create Figma components.
- `figma_audit_svg_assets` detects missing and duplicate assets.
- Test script covers string import, file import, batch import, and cleanup.

### P2 Acceptance

- Imported SVG components can be organized into an auto-layout asset board.
- Style binding can bind imported fills/strokes to Local Styles where possible.
- Asset key plugin data supports stable updates independent of node name.
- Warnings identify unsupported SVG features such as filters, masks, clips, or external references.
- A TableDoll icon or toy-asset manifest can be imported twice without duplicates.
- Complex SVGs can optionally fall back to raster image import with a clear warning.

## 16. Delivery Standards

### 16.1 Code Delivery

A delivery is not complete until:

- New schemas are added in `src/schemas.ts`.
- New MCP tools are registered in `src/mcp/tools/write.ts`.
- Plugin command handlers are implemented in `plugin/code.ts`.
- `plugin/code.js` is regenerated through `npm run build`.
- New tests are added under `scripts/`.
- Existing tests still pass.
- Documentation is updated.

### 16.2 Product Delivery

A delivery is not complete until a user can:

1. Put an SVG file in the local workspace.
2. Run one MCP command or script.
3. See the asset appear in Figma.
4. Re-run the same import without uncontrolled duplicates.
5. Understand from the response whether the import was exact, simplified, or failed.

### 16.3 Documentation Delivery

Docs must include:

- Tool list.
- Input/output examples.
- Recommended local folder structure.
- Known limitations.
- Safety rules.
- Troubleshooting guide.
- At least one end-to-end recipe.

### 16.4 Test Delivery

Required passing commands:

```bash
npm run typecheck
npm run build
npm run codex:check
node scripts/check-tools.mjs
node scripts/test-svg-import.mjs
node scripts/test-local-styles.mjs
node scripts/test-component-properties.mjs
```

The final review should report:

- Figma file name.
- Figma page name.
- Number of SVG assets imported.
- Number of components created.
- Duplicate count.
- Warning count.
- Cleanup result for test nodes.

### 16.5 Figma Delivery

For manual acceptance, the Figma file should contain:

- A frame named `SVG Import Test`.
- At least three imported SVG assets.
- At least one imported asset converted into a component.
- At least one batch-imported asset grid.
- No duplicate nodes after a second import run.
- Clear node names matching requested asset names.

## 17. Open Questions

- Should SVG optimization be built into the MCP or kept as a separate local script?
- Should `replaceExistingByName` delete and recreate nodes, or attempt in-place update?
- Should asset keys be required from the first batch-import version?
- Should component creation wrap the imported SVG or convert the imported node directly?
- How much SVG feature detection should happen before relying on Figma's importer?
- Should raster fallback be automatic or explicit?

## 18. Recommended MVP Decision

Build the smallest reliable version first:

1. `figma_create_from_svg`
2. `figma_import_svg_file`
3. `scripts/test-svg-import.mjs`
4. Documentation examples

Then add batch import and component packaging after the single-asset path is stable.

This keeps the product improvement focused: prove that local SVG assets can reliably cross the MCP boundary into Figma before building a full asset management layer.

## 19. Raster Image and AI-Generated Image Import Extension

### 19.1 Background

In addition to SVG assets, the MCP should support raster image assets generated locally or by third-party AI image-generation tools.

The preferred workflow is:

```text
Third-party image generation / local image source
  -> save original image locally
  -> MCP reads local image or receives base64/data URL
  -> Figma plugin creates an Image Paint
  -> Figma/MCP handles display treatment
  -> optional componentization, batch import, and audit
```

This workflow intentionally avoids complex local image editing. The original generated image should remain unchanged on disk, while Figma handles design-level presentation such as crop mode, corner radius, opacity, and effects.

### 19.2 Product Principle

Raster image handling should be split as follows:

| Responsibility | Owner |
|---|---|
| Image content generation | third-party image tool / local creator |
| Original file storage | local workspace |
| Prompt/model/seed metadata | local metadata file and optional Figma plugin data |
| Basic display treatment | Figma/MCP |
| Design layout | Figma/MCP |
| Component packaging | Figma/MCP |
| Asset audit | Figma/MCP |

The MCP should not attempt to become a full image editor. It should focus on importing, placing, lightly presenting, organizing, and auditing image assets.

### 19.3 Scope

In scope:

- Import PNG/JPG/GIF images supported by Figma.
- Import WebP only if local validation confirms the current Figma runtime accepts it; otherwise convert externally before import.
- Import from local file path.
- Import from base64 data URL.
- Import from explicit remote URL.
- Create image-filled rectangles.
- Update image fills on existing nodes.
- Apply basic display treatment:
  - width / height
  - scale mode
  - crop mode
  - corner radius
  - opacity
  - effects
- Batch-import image assets.
- Create components from imported images.
- Store AI generation metadata.
- Audit imported image assets.

Out of scope:

- Brightness adjustment.
- Contrast adjustment.
- Saturation adjustment.
- Temperature/tint adjustment.
- LUTs.
- Pixel-level editing.
- Background removal.
- Inpainting/outpainting.
- Local image filter pipelines.
- Sharp/Pillow-based image processing as a core dependency.

### 19.4 Why This Simpler Scope Is Better

This reduced scope is easier and safer because:

- Figma already supports image fills and visual effects.
- The current plugin already uses `figma.createImage(bytes)`.
- Design-level presentation should stay visible and editable in Figma.
- The original AI-generated image remains unchanged locally.
- No extra image-processing runtime is required.
- The MCP avoids becoming responsible for pixel-level correctness.
- Implementation can reuse existing `figma_create_image_rectangle` and `figma_update_image_fill`.

### 19.5 Existing Capability

The project already supports:

- `figma_create_image_rectangle`
- `figma_update_image_fill`
- URL image import
- base64 data URL import
- `scaleMode: "FILL" | "FIT" | "CROP" | "TILE"`
- `cornerRadius` on creation
- plugin-side byte conversion
- `figma.createImage(bytes)`

Current implementation foundation:

```ts
const image = figma.createImage(await bytesFromImageUrl(imageUrl));
return {
  type: "IMAGE",
  scaleMode,
  imageHash: image.hash,
};
```

This should remain the low-level foundation.

## 20. Proposed Raster Image Tools

### 20.1 `figma_create_image_from_file`

Create an image-filled node from a local file.

Input:

```json
{
  "name": "Generated/Toy Avatar 01",
  "imagePath": "assets/generated/toy-avatar-01.png",
  "parentId": "123:456",
  "x": 0,
  "y": 0,
  "width": 240,
  "height": 240,
  "scaleMode": "FILL",
  "cornerRadius": 24,
  "opacity": 1,
  "effects": [
    {
      "type": "DROP_SHADOW",
      "color": { "r": 0, "g": 0, "b": 0, "a": 0.16 },
      "offset": { "x": 0, "y": 8 },
      "radius": 24,
      "visible": true
    }
  ],
  "component": false,
  "replaceExistingByName": false,
  "metadataPath": "assets/generated/toy-avatar-01.json"
}
```

Behavior:

- Validate that `imagePath` exists.
- Restrict file reads to workspace roots.
- Validate file extension and MIME type.
- Enforce maximum file size.
- Read bytes on the MCP server side.
- Convert bytes to `data:image/...;base64,...`.
- Delegate image creation to the existing plugin image fill path.
- Create a rectangle by default.
- Apply x/y/width/height.
- Apply `scaleMode`.
- Apply `cornerRadius`.
- Apply `opacity`.
- Apply Figma effects.
- Optionally create a component.
- Optionally read metadata JSON and store it in plugin data.
- Return node metadata and warnings.

Output:

```json
{
  "id": "123:789",
  "name": "Generated/Toy Avatar 01",
  "type": "RECTANGLE",
  "imageHash": "abc123",
  "width": 240,
  "height": 240,
  "componentId": null,
  "metadataStored": true,
  "warnings": []
}
```

### 20.2 `figma_create_image_from_base64`

Create an image-filled node from raw base64 or data URL.

Input:

```json
{
  "name": "Generated/Toy Avatar 02",
  "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "mimeType": "image/png",
  "x": 280,
  "y": 0,
  "width": 240,
  "height": 240,
  "scaleMode": "FILL",
  "cornerRadius": 24
}
```

Behavior:

- Accept either raw base64 plus `mimeType`, or a complete data URL.
- Validate base64 length.
- Convert to data URL if needed.
- Delegate to plugin image fill creation.

This tool is useful for third-party image-generation APIs that return base64 directly.

### 20.3 `figma_update_image_paint`

Update display properties of an existing image-filled node.

Input:

```json
{
  "nodeId": "123:456",
  "imageUrl": "data:image/png;base64,...",
  "scaleMode": "CROP",
  "cornerRadius": 32,
  "opacity": 0.88,
  "effects": [
    {
      "type": "DROP_SHADOW",
      "color": { "r": 0, "g": 0, "b": 0, "a": 0.18 },
      "offset": { "x": 0, "y": 12 },
      "radius": 32,
      "visible": true
    }
  ]
}
```

Behavior:

- Find the target node.
- Confirm it supports fills.
- If a new image is provided, replace the image fill.
- If only display fields are provided, preserve the existing image hash.
- Update `scaleMode`.
- Update `cornerRadius`.
- Update `opacity`.
- Update `effects`.
- Return updated node metadata.

P0 should support:

- `scaleMode`
- `cornerRadius`
- `opacity`
- `effects`
- image replacement

P1 can support precise crop transforms.

### 20.4 Optional Precise Crop Support

Figma image paints can support more precise crop behavior through image transforms. Instead of exposing raw matrix math directly to users, the MCP should offer an ergonomic crop object.

Input:

```json
{
  "nodeId": "123:456",
  "crop": {
    "mode": "focalPoint",
    "zoom": 1.2,
    "x": 0.5,
    "y": 0.35
  }
}
```

Meaning:

- `zoom`: image zoom inside the container.
- `x`: focal point from left to right, `0` to `1`.
- `y`: focal point from top to bottom, `0` to `1`.

The MCP can convert this into Figma's `imageTransform`.

This should be P1, not P0. P0 can rely on `FILL`, `FIT`, `CROP`, and `TILE`.

### 20.5 `figma_import_image_assets`

Batch-import raster image assets.

Input:

```json
{
  "parentId": "123:456",
  "component": true,
  "replaceExistingByName": true,
  "layout": {
    "columns": 4,
    "gap": 24
  },
  "defaults": {
    "width": 240,
    "height": 240,
    "scaleMode": "FILL",
    "cornerRadius": 24,
    "opacity": 1,
    "effects": [
      {
        "type": "DROP_SHADOW",
        "color": { "r": 0, "g": 0, "b": 0, "a": 0.12 },
        "offset": { "x": 0, "y": 8 },
        "radius": 20,
        "visible": true
      }
    ]
  },
  "assets": [
    {
      "name": "Toy/Avatar/01",
      "imagePath": "assets/generated/avatar-01.png",
      "metadataPath": "assets/generated/avatar-01.json"
    },
    {
      "name": "Toy/Avatar/02",
      "imagePath": "assets/generated/avatar-02.png",
      "cornerRadius": 999
    }
  ]
}
```

Behavior:

- Import assets sequentially.
- Apply shared defaults.
- Allow per-asset overrides.
- Optionally create components.
- Optionally replace existing nodes by name.
- Optionally generate an asset board.
- Continue on failure unless `failFast: true`.
- Return a per-asset report.

Output:

```json
{
  "summary": {
    "created": 8,
    "updated": 2,
    "failed": 0,
    "skipped": 0
  },
  "assets": [
    {
      "name": "Toy/Avatar/01",
      "status": "created",
      "nodeId": "123:888",
      "componentId": "123:889",
      "metadataStored": true,
      "warnings": []
    }
  ]
}
```

### 20.6 `figma_audit_image_assets`

Audit imported image assets.

Input:

```json
{
  "parentId": "123:456",
  "prefix": "Toy/Avatar/",
  "expected": ["Toy/Avatar/01", "Toy/Avatar/02"],
  "requireComponents": true
}
```

Behavior:

- Count matching image assets.
- Detect duplicate names.
- Detect missing expected names.
- Detect assets that are not components when required.
- Detect nodes without image fills.
- Optionally check metadata presence.

Output:

```json
{
  "total": 12,
  "duplicates": [],
  "missingExpected": [],
  "nonComponents": [],
  "withoutImageFill": [],
  "missingMetadata": [],
  "warnings": []
}
```

## 21. AI-Generated Image Workflow

### 21.1 Recommended Local Structure

```text
assets/
  generated-images/
    source/
      toy-avatar-01.png
      toy-avatar-02.png
    metadata/
      toy-avatar-01.json
      toy-avatar-02.json
    manifest.json
```

### 21.2 Metadata Format

```json
{
  "name": "Toy Avatar 01",
  "prompt": "cute AR tabletop toy avatar, soft vinyl style...",
  "provider": "example-provider",
  "model": "example-model",
  "seed": "12345",
  "createdAt": "2026-06-13T01:00:00+08:00",
  "width": 1024,
  "height": 1024,
  "sourceImage": null
}
```

### 21.3 Manifest Format

```json
{
  "collection": "TableDoll Generated Avatars",
  "prefix": "TableDoll/Avatar/",
  "defaultSize": {
    "width": 240,
    "height": 240
  },
  "defaults": {
    "scaleMode": "FILL",
    "cornerRadius": 24
  },
  "assets": [
    {
      "name": "Toy Avatar 01",
      "imagePath": "assets/generated-images/source/toy-avatar-01.png",
      "metadataPath": "assets/generated-images/metadata/toy-avatar-01.json"
    }
  ]
}
```

### 21.4 Workflow

```text
Third-party image-generation API
  -> local file saved under assets/generated-images/source
  -> metadata JSON saved under assets/generated-images/metadata
  -> optional manifest updated
  -> figma_import_image_assets
  -> Figma image components and asset board
```

### 21.5 What Should Be Stored in Figma

When metadata is provided, the MCP should store lightweight plugin data on the imported node or component:

- source path
- prompt
- provider
- model
- seed
- createdAt
- original dimensions

This makes the Figma asset traceable without turning the canvas into a metadata dump.

## 22. Simplified Image Editing Strategy

### 22.1 Product Decision

The MCP should not implement full raster image editing.

The image editing scope should be limited to Figma-native presentation controls:

- scale mode
- optional crop transform
- corner radius
- opacity
- effects
- image replacement

### 22.2 Supported Display Treatments

| Treatment | P0/P1 | Implementation |
|---|---:|---|
| Fit/fill/crop/tile | P0 | ImagePaint `scaleMode` |
| Replace image | P0 | create new image hash and update fill |
| Corner radius | P0 | node `cornerRadius` |
| Opacity | P0 | node `opacity` |
| Drop shadow | P0 | node `effects` |
| Inner shadow | P0 | node `effects` |
| Layer blur | P0 | node `effects` |
| Background blur | P0 | node `effects` |
| Precise crop/focal point | P1 | ImagePaint transform |
| Brightness/contrast/saturation | Out of scope | use external tools manually if needed |
| Background removal | Out of scope | use external tools manually if needed |

### 22.3 Why No Local Image Processing Module

A local image processing module is intentionally excluded from the core plan because:

- It adds dependencies such as Sharp or Pillow.
- It expands the MCP from design automation into image editing.
- It creates more test and platform complexity.
- It is not necessary for the current product goal.
- Third-party image tools should produce the desired image content before import.
- Figma presentation controls are enough for prototype and design-system usage.

If future needs require local processing, it can be added as a separate optional helper, not a core MCP feature.

## 23. Raster Image Acceptance Criteria

### P0 Acceptance

- `figma_create_image_from_file` imports a local PNG/JPG/GIF from the workspace.
- WebP behavior is explicitly tested; WebP is experimental unless the active Figma runtime is proven to accept it.
- If WebP is unsupported, the tool returns a clear unsupported-format error and recommends converting to PNG or JPEG.
- File reads are restricted to workspace roots.
- `figma_create_image_from_base64` imports a base64 image.
- Base64 payloads above the configured size limit are rejected before plugin execution.
- `figma_update_image_paint` can replace an existing image fill.
- `figma_update_image_paint` can update:
  - `scaleMode`
  - `cornerRadius`
  - `opacity`
  - `effects`
- Existing `figma_create_image_rectangle` still works.
- Invalid image path returns a clear error.
- Oversized image returns a clear error.
- Image dimensions are detected before import where possible.
- Images wider than 4096px or taller than 4096px return a clear error by default.
- Plugin disconnected state returns a clear error.
- Tests clean up generated image nodes.

### P1 Acceptance

- `figma_import_image_assets` batch-imports multiple images.
- Batch import supports shared defaults and per-asset overrides.
- Batch import can create components.
- Re-running with `replaceExistingByName: true` does not create duplicates.
- Component assets are updated in place when possible instead of deleted and recreated.
- Asset identity can be tracked with `assetKey` stored in plugin data.
- `figma_audit_image_assets` detects:
  - duplicate names
  - missing expected assets
  - assets without image fills
  - non-component assets when components are required
- Metadata JSON can be read and stored as plugin data.
- A generated image manifest can import a full asset set.

### P2 Acceptance

- Precise crop/focal-point support works through an ergonomic crop API.
- Precise crop/focal-point support includes visual or readback tests for `imageTransform`.
- Imported generated-image components can be organized into an asset board.
- AI-generation metadata can be inspected through a read/audit tool.
- A TableDoll generated avatar set can be imported twice without duplicates.
- Documentation includes a complete third-party image-generation-to-Figma workflow.

## 24. Raster Image Delivery Standards

A raster image import delivery is complete only when:

### 24.1 Code

- Schemas are added in `src/schemas.ts`.
- Tools are registered in `src/mcp/tools/write.ts`.
- Plugin command handlers are implemented in `plugin/code.ts`.
- `plugin/code.js` is regenerated through `npm run build`.
- File path safety checks are implemented server-side.
- Image MIME/type validation is implemented.
- Size limits are enforced.
- Pixel-dimension limits are enforced before calling the Figma plugin when image dimensions can be detected.
- Manifest network access is reviewed for any remote URL workflows.
- Component replacement behavior is explicitly documented and protected by safe defaults.

### 24.2 Tests

Required commands:

```bash
npm run typecheck
npm run build
npm run codex:check
node scripts/check-tools.mjs
node scripts/test-image-import.mjs
node scripts/test-local-styles.mjs
node scripts/test-component-properties.mjs
```

`test-image-import.mjs` must cover:

- local image import
- base64 import
- image replacement
- scale mode update
- corner radius update
- opacity update
- effects update
- invalid path
- oversized file
- unsupported or oversized pixel dimensions
- WebP supported/unsupported behavior
- base64 payload size limit
- remote URL failure caused by manifest/network access
- component update without uncontrolled instance-breaking replacement
- batch import if P1 is implemented
- cleanup

### 24.3 Documentation

Docs must include:

- local file import example
- base64 import example
- generated-image workflow
- metadata JSON format
- manifest format
- known limitations
- clear statement that color grading is out of scope
- note about Figma-supported image formats and pixel limits
- note about manifest `networkAccess` when remote URLs are used
- note that WebP support is experimental until verified in the active Figma runtime
- note that component deletion/recreation can break instances and should not be the default update path

### 24.4 Figma Manual Acceptance

The Figma test file should contain:

- a frame named `Raster Image Import Test`
- at least three imported image assets
- at least one image asset with rounded corners
- at least one image asset with opacity below 1
- at least one image asset with drop shadow
- at least one replaced image fill
- no duplicate nodes after a second import run

## 25. Raster Image Risk Mitigation and Implementation Constraints

This section turns the main raster-image risks into explicit implementation constraints. These constraints are part of the delivery standard, not optional polish.

### 25.1 Figma Image Dimension Limit

Figma's plugin image pipeline has practical pixel-dimension limits. The implementation should assume a maximum supported image width and height of 4096px unless the active Figma runtime documents otherwise.

Implementation requirements:

- Read image dimensions before plugin execution when importing from local files or base64.
- Reject images with width greater than 4096px or height greater than 4096px by default.
- Return an actionable error that includes:
  - detected width
  - detected height
  - supported maximum
  - suggested next step
- Do not rely on Figma plugin failure as the first validation layer.

Recommended error shape:

```json
{
  "ok": false,
  "error": "Image dimensions exceed Figma limit: 6144x4096. Maximum supported dimension is 4096px. Resize or regenerate the image before import."
}
```

Acceptance requirement:

- `test-image-import.mjs` includes one oversized-dimension fixture and verifies that it fails before a Figma node is created.

### 25.2 Supported Image Formats

P0 should only promise formats that are known to be supported by Figma's plugin image creation path:

- PNG
- JPEG/JPG
- GIF

WebP should be treated as experimental.

Implementation requirements:

- Validate MIME type and extension.
- For WebP, either:
  - run an explicit runtime probe and mark support as available for the session, or
  - reject with a clear unsupported-format message.
- Do not document WebP as guaranteed until it is verified in the active runtime.
- Do not silently rename WebP to PNG/JPEG.

Recommended error shape:

```json
{
  "ok": false,
  "error": "WebP import is not confirmed for this Figma runtime. Convert the image to PNG or JPEG, or enable an explicit WebP probe."
}
```

Acceptance requirement:

- The test suite covers PNG/JPEG/GIF happy paths and WebP supported/unsupported behavior.

### 25.3 Base64 Payload Size

Base64 is convenient but expands binary payloads and can make MCP requests large and slow. Large images should prefer local-file import over raw base64 import.

Recommended limits:

- `figma_create_image_from_base64`: default maximum encoded payload of 8 MB.
- `figma_create_image_from_file`: default maximum source file size of 20 MB.
- Both limits should be configurable through code constants or environment variables.

Implementation requirements:

- Validate base64 length before decoding.
- Validate decoded byte length before plugin execution.
- Return a clear error for oversized payloads.
- Recommend local-file import for large images.

Recommended error shape:

```json
{
  "ok": false,
  "error": "Base64 image payload exceeds 8 MB. Save the image locally and use figma_create_image_from_file, or reduce image size."
}
```

Acceptance requirement:

- `test-image-import.mjs` includes an oversized base64 payload test.

### 25.4 Remote URL and Manifest Network Access

Remote URL import is a compatibility path, not the preferred path for AI-generated assets. The preferred path is:

```text
remote generation result -> local file -> MCP local import -> Figma image paint
```

Remote URL import depends on Figma plugin network access. The plugin manifest must allow the requested remote domain through `networkAccess.allowedDomains`.

Implementation requirements:

- Keep local-file import as the recommended workflow.
- If remote URL import fails, return an error that mentions possible `networkAccess.allowedDomains` configuration.
- Do not send third-party API keys or auth headers to the Figma plugin.
- For third-party image-generation APIs, fetch with the local agent/server when authentication is needed, save the file locally, then import from file.
- Document every remote domain required by examples or tests.

Recommended error shape:

```json
{
  "ok": false,
  "error": "Failed to fetch image URL. Check networkAccess.allowedDomains in the plugin manifest, or save the image locally and import from file."
}
```

Acceptance requirement:

- The test plan includes a remote URL failure case or a documented manual test for manifest network-access behavior.

### 25.5 Precise Crop and `imageTransform`

P0 should avoid exposing low-level image-transform matrices. P0 uses:

- `FILL`
- `FIT`
- `CROP`
- `TILE`
- node width/height
- corner radius

P1 can add precise crop/focal-point support.

Implementation requirements for P1:

- Expose ergonomic crop input, not raw matrix-first UX.
- Suggested shape:

```json
{
  "crop": {
    "mode": "focalPoint",
    "zoom": 1.2,
    "x": 0.5,
    "y": 0.35
  }
}
```

- Convert the ergonomic crop object into Figma image transform internally.
- Clamp `x` and `y` to `0..1`.
- Require `zoom >= 1`.
- Preserve existing image hash when only crop changes.
- Include visual or readback tests before merging.

Acceptance requirement:

- P1 crop tests verify that updating crop changes the image paint transform without replacing the node.

### 25.6 Component Update Safety

Deleting and recreating components can break existing instances or disconnect design references. Componentized image assets need safer update rules than ordinary loose nodes.

Default behavior:

- Do not delete and recreate existing components by default.
- Prefer in-place image fill updates on the existing component or component child.
- Use `replaceExistingByName` only for loose nodes or explicitly safe replacement contexts.

P1 identity model:

- Add `assetKey` to image import inputs.
- Store `assetKey` in plugin data on the imported node or component.
- Use `assetKey` for future updates instead of name-only matching.
- Keep name matching as a fallback, not the primary identity model.

Destructive replacement:

- Require an explicit flag such as `forceReplaceComponent: true` before deleting/recreating component assets.
- Return replaced node/component ids in the result.
- Warn that existing instances may be affected.

Recommended update order:

1. Find by `assetKey` plugin data.
2. If not found and allowed, find by exact name under the specified parent.
3. If target is a component, update image fill in place when possible.
4. If in-place update is impossible, return a warning.
5. Only delete/recreate when `forceReplaceComponent: true`.

Acceptance requirement:

- Tests include a componentized image asset update that preserves the component id.
- Tests include a destructive replacement attempt that fails unless `forceReplaceComponent: true` is supplied.

### 25.7 Risk Summary

| Risk | Default mitigation | Acceptance signal |
|---|---|---|
| Image exceeds 4096px | reject before plugin execution | oversized fixture fails clearly |
| Unsupported WebP | experimental/probe or reject | WebP behavior is tested |
| Base64 payload too large | enforce encoded/decoded size limits | oversized base64 test fails clearly |
| Remote URL blocked | prefer local import, document `networkAccess` | remote failure message is actionable |
| Crop transform complexity | keep P0 simple, move precise crop to P1 | P1 crop tests required |
| Component instance breakage | update by `assetKey` in place, avoid delete/recreate | component id preserved in update test |
