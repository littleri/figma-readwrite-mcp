# Task: Hybrid Read Mode

## Objective

Add a hybrid read model that supports both:

- REST API reads for remote, file-key-based Figma access.
- Local plugin reads for the currently open Figma file, current page, current selection, and freshly modified canvas state.

The implementation should keep both read sources explicit, then add a small automatic selection layer so MCP clients can ask for context without manually choosing REST versus plugin every time.

## Current baseline

The project currently has:

- REST read tools in `src/mcp/tools/read.ts`.
- Plugin write tools and `figma_get_selection` in `src/mcp/tools/write.ts`.
- A WebSocket bridge in `src/pluginBridge.ts`.
- Figma plugin command handling in `plugin/code.ts`.

REST reads can access a Figma file by `fileKey`, but require `FIGMA_TOKEN`.

Plugin reads can access the currently open Figma file, but require the companion plugin to be open and connected.

## Desired behavior

Use this default strategy:

| Request shape | Read source |
|---|---|
| Request includes `fileKey` or Figma file URL | REST API |
| Request asks for comments, versions, or image export URLs | REST API |
| Request asks for current selection, current page, or current open file | Plugin |
| Request includes `nodeId` without `fileKey` and plugin is connected | Plugin |
| Request needs state immediately after a write operation | Plugin |
| Plugin is not connected and `fileKey` is available | REST API |
| `FIGMA_TOKEN` is missing and plugin is connected | Plugin |
| Neither source can satisfy the request | Return a clear error explaining the missing requirement |

Do not silently guess between different files. If both a `fileKey` and a plugin-connected current file are present, `fileKey` means REST unless the tool is explicitly plugin-scoped.

## Tool naming

Keep source-specific tools explicit.

### REST tools

Rename existing REST tools or add aliases with these names:

- `figma_rest_get_file`
- `figma_rest_get_node`
- `figma_rest_get_images`
- `figma_rest_get_comments`
- `figma_rest_get_versions`

Compatibility option: keep the current names as aliases during transition:

- `figma_get_file`
- `figma_get_node`
- `figma_get_images`
- `figma_get_comments`
- `figma_get_versions`

If aliases are kept, document that they are REST-backed.

### Plugin read tools

Add plugin-backed read tools:

- `figma_plugin_get_current_file_summary`
- `figma_plugin_get_current_page`
- `figma_plugin_get_page_tree`
- `figma_plugin_get_node`
- `figma_plugin_get_node_tree`
- `figma_plugin_get_selection`

Move or alias the current `figma_get_selection` so the source is clear.

### Automatic tools

Add a small source-selection layer:

- `figma_read_context`
- `figma_read_node`

These tools should choose REST or plugin using the default strategy above.

## Proposed schemas

Add these schemas in `src/schemas.ts`.

```ts
export const readDepthSchema = z.number().int().min(0).max(20).optional();

export const pluginNodeReadSchema = z.object({
  nodeId: z.string().min(1),
  depth: readDepthSchema,
  includeInvisible: z.boolean().optional(),
});

export const pluginPageTreeReadSchema = z.object({
  depth: readDepthSchema,
  includeInvisible: z.boolean().optional(),
});

export const autoReadContextSchema = z.object({
  fileKey: z.string().min(1).optional(),
  figmaUrl: z.string().url().optional(),
  scope: z.enum(["file", "currentFile", "currentPage", "selection"]).optional(),
  depth: readDepthSchema,
  includeInvisible: z.boolean().optional(),
});

export const autoReadNodeSchema = z.object({
  fileKey: z.string().min(1).optional(),
  figmaUrl: z.string().url().optional(),
  nodeId: z.string().min(1),
  depth: readDepthSchema,
  geometry: z.enum(["paths"]).optional(),
  includeInvisible: z.boolean().optional(),
});
```

Use `depth` to prevent accidental huge payloads. Default plugin tree depth should be small, such as `2` or `3`.

## Plugin serialization requirements

Add reusable serialization helpers in `plugin/code.ts`.

The serialized node should include only safe, useful fields by default:

- `id`
- `name`
- `type`
- `visible`
- `locked`
- `x`
- `y`
- `width`
- `height`
- `rotation`
- `opacity`
- `fills`
- `strokes`
- `strokeWeight`
- `cornerRadius`
- `characters` for text nodes
- `fontSize`, `fontName`, `lineHeight`, `letterSpacing`, and text alignment for text nodes where available
- `layoutMode`, padding, spacing, alignment, and sizing fields for auto-layout-capable nodes
- `children` only when requested by depth

Avoid returning plugin-specific circular structures or huge fields by default.

Suggested helper shape:

```ts
function serializeSceneNode(node: SceneNode, options: SerializeOptions): SerializedNode {
  // Include common geometry and style fields.
  // Recurse into children only when options.depth > 0.
}
```

For page-level reads, serialize top-level children of `figma.currentPage`.

## Plugin command additions

Extend `PluginCommand` in `src/schemas.ts` with:

```ts
| { type: "getCurrentFileSummary" }
| { type: "getCurrentPage"; payload?: { depth?: number; includeInvisible?: boolean } }
| { type: "getPageTree"; payload?: { depth?: number; includeInvisible?: boolean } }
| { type: "getNode"; payload: { nodeId: string; depth?: number; includeInvisible?: boolean } }
| { type: "getNodeTree"; payload: { nodeId: string; depth?: number; includeInvisible?: boolean } }
```

`getNode` may use depth `0` by default. `getNodeTree` may use depth `2` by default.

## MCP registration plan

Create a new file:

```text
src/mcp/tools/pluginRead.ts
```

Register plugin read tools there instead of mixing them into write tools.

Update `src/mcp/server.ts`:

```ts
registerReadTools(server, figma);
registerPluginReadTools(server, bridge);
registerAutoReadTools(server, figma, bridge);
registerWriteTools(server, bridge);
```

Create another file:

```text
src/mcp/tools/autoRead.ts
```

This file implements the default strategy and delegates to REST or plugin.

## URL parsing

Add a helper for Figma URLs, preferably in a small utility file:

```text
src/figma/url.ts
```

It should extract:

- `fileKey` from `/file/{fileKey}/...` and `/design/{fileKey}/...`.
- `nodeId` from `node-id=0-1`, converting it to Figma API/plugin format `0:1`.

Example:

```ts
export function parseFigmaUrl(input: string): {
  fileKey?: string;
  nodeId?: string;
};
```

Do not require URL parsing for the first implementation if direct `fileKey` and `nodeId` are already supplied, but include tests for the helper if it is added.

## Automatic read strategy

Implement a small resolver in `src/mcp/tools/autoRead.ts`.

Suggested decision logic:

```ts
function chooseReadSource(args, intent, bridge, figmaToken) {
  if (intent === "comments" || intent === "versions" || intent === "images") return "rest";
  if (args.fileKey || args.figmaUrl) return "rest";
  if (intent === "selection" || intent === "currentPage" || intent === "currentFile") return "plugin";
  if (args.nodeId && bridge.isConnected()) return "plugin";
  if (!figmaToken && bridge.isConnected()) return "plugin";
  return "rest";
}
```

Before executing REST, validate that a `fileKey` is available and `FIGMA_TOKEN` is configured.

Before executing plugin reads, validate that `bridge.isConnected()` is true.

Error messages should be explicit:

- `REST read requires fileKey or figmaUrl.`
- `REST read requires FIGMA_TOKEN.`
- `Plugin read requires the companion Figma plugin to be open and connected.`

## Implementation phases

### Phase 1: Separate read modules

- Keep existing REST behavior.
- Add REST-prefixed tool names.
- Keep existing tool names as compatibility aliases if desired.
- Move selection read to a plugin read module or add `figma_plugin_get_selection` alias.

### Phase 2: Add plugin read commands

- Add plugin command union cases.
- Implement plugin handlers in `plugin/code.ts`.
- Add safe node/page serialization.
- Add depth-limited traversal.
- Ensure large documents do not accidentally serialize unlimited children.

### Phase 3: Add automatic read tools

- Add `figma_read_context`.
- Add `figma_read_node`.
- Implement the default read source strategy.
- Parse Figma URLs if provided.
- Return the chosen source in the result, for example:

```json
{
  "source": "plugin",
  "data": {}
}
```

### Phase 4: Documentation

Update:

- `README.md`
- `docs/expanded-tools.md`

Document:

- Which tools are REST-backed.
- Which tools are plugin-backed.
- Which automatic tools choose a source.
- When users must open the Figma plugin.
- When users must configure `FIGMA_TOKEN`.

### Phase 5: Validation

Run:

```bash
npm run typecheck
npm run build
```

Then manually verify with Figma open:

1. Start the MCP server.
2. Open the companion Figma plugin.
3. Confirm `/health` returns `plugin.connected: true`.
4. Call `figma_plugin_get_selection`.
5. Call `figma_plugin_get_current_page`.
6. Call `figma_plugin_get_node_tree` for a selected frame.
7. Call `figma_read_context` without `fileKey` and verify it chooses plugin.
8. Call `figma_read_context` with `fileKey` and verify it chooses REST.
9. Call `figma_read_node` with `fileKey` and `nodeId` and verify it chooses REST.
10. Call `figma_read_node` with only `nodeId` and verify it chooses plugin when connected.

## Acceptance criteria

- REST and plugin read tools are clearly named and documented.
- Automatic tools implement the default strategy without silent cross-file ambiguity.
- Plugin reads work for current file summary, current page, selection, a single node, and a depth-limited node tree.
- REST reads still work exactly as before.
- Write tools still work exactly as before.
- Typecheck and build pass.
- Plugin serialization is depth-limited and does not return circular or unbounded Figma objects.
- Error messages clearly explain whether REST token, file key, or plugin connection is missing.

## Review checklist

Use this checklist when reviewing the implementation.

- Did the implementation preserve all existing REST read tools or provide compatibility aliases?
- Are plugin reads kept separate from write tools at the MCP registration level?
- Does the automatic strategy prefer REST whenever `fileKey` or `figmaUrl` is supplied?
- Does plugin reading require a live plugin connection?
- Are returned plugin node trees bounded by depth?
- Are Figma URLs parsed correctly for both `/file/` and `/design/` links?
- Is `node-id=0-1` converted to `0:1`?
- Are errors clear and actionable?
- Do `npm run typecheck` and `npm run build` pass?
- Was `plugin/code.js` regenerated after changing `plugin/code.ts`?
- Were no one-off task scripts added to `scripts/`?
