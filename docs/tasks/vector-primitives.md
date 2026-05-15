# Task: Vector Primitives Support

## Objective

Add support for common Figma vector and shape primitives so Claude can create richer illustrations, icons, dividers, and decorative elements.

## New capabilities

- Create ellipse.
- Create line.
- Create polygon.
- Create star.
- Create vector path nodes.
- Optionally support boolean operations after primitive creation.

## Proposed tools

### `figma_create_ellipse`

Inputs:

- `parentId?: string`
- `name?: string`
- `x: number`
- `y: number`
- `width: number`
- `height: number`
- style fields from visual styling task

### `figma_create_line`

Inputs:

- `parentId?: string`
- `name?: string`
- `x: number`
- `y: number`
- `width: number`
- `rotation?: number`
- `strokes?: Paint[]`
- `strokeWeight?: number`

### `figma_create_polygon`

Inputs:

- `parentId?: string`
- `name?: string`
- `x: number`
- `y: number`
- `width: number`
- `height: number`
- `pointCount: number`
- style fields

### `figma_create_star`

Inputs:

- `parentId?: string`
- `name?: string`
- `x: number`
- `y: number`
- `width: number`
- `height: number`
- `pointCount?: number`
- `innerRadius?: number`
- style fields

### `figma_create_vector`

Inputs:

- `parentId?: string`
- `name?: string`
- `x: number`
- `y: number`
- `width?: number`
- `height?: number`
- `vectorPaths: Array<{ windingRule: "NONZERO" | "EVENODD"; data: string }>`
- style fields

## Implementation approach

1. Add schemas for each primitive in `src/schemas.ts`.
2. Register new tools in `src/mcp/tools/write.ts`.
3. Add plugin command handlers using:
   - `figma.createEllipse()`
   - `figma.createLine()`
   - `figma.createPolygon()`
   - `figma.createStar()`
   - `figma.createVector()`
4. Reuse `appendNode`, `setGeometry`, and visual styling helpers.
5. For vector path data, validate string length to avoid huge payloads.

## Task phases

### Phase 1: Simple primitives

- Implement ellipse, line, polygon, and star.
- Reuse solid fills and strokes.

### Phase 2: Vector path support

- Add `figma_create_vector`.
- Add path-data validation.
- Test with a simple icon path.

### Phase 3: Boolean operation exploration

- Add only if needed after primitives are stable.
- Validate whether Figma Plugin API behavior is reliable enough for MCP automation.

## Testing after change

### Build tests

```bash
npm run typecheck
npm run build
```

### Functional tests

1. Create an ellipse avatar placeholder.
2. Create a line divider with stroke weight 2.
3. Create a 6-sided polygon badge.
4. Create a star decorative icon.
5. Create a vector path using a simple triangle or arrow path.
6. Verify each node can be parented into a target frame.
7. Verify each node can be updated with `figma_update_node` where supported.

### Visual tests

- Screenshot or manually inspect a test frame containing all primitive types.
- Confirm size, position, fill, stroke, and rotation match expected values.

## Acceptance criteria

- Claude can create common decorative and icon-like shapes without manual drawing.
- Every created primitive returns a node id.
- Invalid primitive parameters fail validation before plugin execution.
