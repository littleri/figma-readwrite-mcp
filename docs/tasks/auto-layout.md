# Task: Auto Layout Support

## Objective

Add MCP write support for Figma auto layout properties on frames so Claude can create structured page sections, navbars, cards, grids, and button groups without manually positioning every child.

## New capabilities

- Create an auto-layout frame.
- Update an existing frame to use auto layout.
- Configure direction, spacing, padding, alignment, wrapping, and sizing behavior.

## Proposed tools

### `figma_create_auto_layout_frame`

Creates a frame with auto layout enabled.

Suggested inputs:

- `parentId?: string`
- `name?: string`
- `x: number`
- `y: number`
- `width: number`
- `height: number`
- `layoutMode: "HORIZONTAL" | "VERTICAL"`
- `layoutWrap?: "NO_WRAP" | "WRAP"`
- `itemSpacing?: number`
- `paddingTop?: number`
- `paddingRight?: number`
- `paddingBottom?: number`
- `paddingLeft?: number`
- `primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN"`
- `counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE"`
- `fills?: Paint[]`
- `cornerRadius?: number`

### `figma_update_auto_layout`

Applies or updates auto layout properties on an existing frame.

Suggested inputs:

- `nodeId: string`
- `layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL"`
- same layout fields as above

## Implementation approach

1. Add `autoLayoutSchema` in `src/schemas.ts`.
2. Extend `PluginCommand` with `createAutoLayoutFrame` and `updateAutoLayout`.
3. Register the two MCP tools in `src/mcp/tools/write.ts`.
4. In `plugin/code.ts`, add helper `applyAutoLayout(node, payload)`.
5. Validate the target node is a frame-like node before applying layout properties.
6. Reuse existing `appendNode`, `setGeometry`, and `solidPaint` helpers.

Example plugin logic:

```ts
if (payload.layoutMode) node.layoutMode = payload.layoutMode;
if (typeof payload.itemSpacing === "number") node.itemSpacing = payload.itemSpacing;
if (typeof payload.paddingTop === "number") node.paddingTop = payload.paddingTop;
```

## Task phases

### Phase 1: Schema and command contract

- Define accepted layout enums and numeric fields.
- Keep optional fields optional so tools can update only one property.
- Reject unsupported layout modes before reaching the plugin.

### Phase 2: Plugin implementation

- Implement `applyAutoLayout`.
- Add create and update command cases.
- Return serialized node metadata after changes.

### Phase 3: MCP registration

- Add tool descriptions and input schemas.
- Ensure tool names and payloads are documented.

### Phase 4: Validation and cleanup

- Run typecheck and build.
- Reload plugin and test on a temporary frame.

## Testing after change

### Build tests

```bash
npm run typecheck
npm run build
```

### Functional tests

1. Create a horizontal auto-layout frame with three text nodes.
2. Verify children align horizontally and spacing is correct.
3. Update the frame to vertical layout.
4. Verify child order and spacing update correctly.
5. Test padding fields individually.
6. Test `SPACE_BETWEEN` alignment on a navbar.
7. Verify invalid `nodeId` returns a clear error.
8. Verify applying auto layout to a non-frame node returns a clear error.

### Regression tests

- Existing `figma_create_frame`, `figma_create_rectangle`, and `figma_create_text` still work.
- Parent insertion with `parentId` still works.
- Plugin reconnect flow still works.

## Acceptance criteria

- Claude can create a navbar or card row using auto layout without manually positioning each child.
- All layout-related inputs are schema-validated.
- Existing basic write tools remain functional.
