# Task: Visual Styling Support

## Objective

Expand the MCP write tools so created and updated nodes can use common visual styling: strokes, stroke weight, shadows, blur, opacity, corner smoothing, and richer fills.

## New capabilities

- Apply strokes to rectangles, frames, ellipses, and vectors.
- Configure stroke weight and alignment.
- Apply drop shadows and inner shadows.
- Apply layer blur or background blur.
- Support linear and radial gradient fills.
- Update visual styles on existing nodes.

## Proposed tool changes

Extend existing tools:

- `figma_create_frame`
- `figma_create_rectangle`
- `figma_update_node`

Add shared style fields:

- `strokes?: Paint[]`
- `strokeWeight?: number`
- `strokeAlign?: "INSIDE" | "OUTSIDE" | "CENTER"`
- `effects?: Effect[]`
- `opacity?: number`
- `cornerSmoothing?: number`

Extend `paintSchema` to support:

- `SOLID`
- `GRADIENT_LINEAR`
- `GRADIENT_RADIAL`

## Implementation approach

1. Replace the current narrow `paintSchema` with a discriminated union.
2. Add `effectSchema` for `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, and `BACKGROUND_BLUR`.
3. Add `visualStyleSchema` for shared style fields.
4. In `plugin/code.ts`, add `applyVisualStyle(node, payload)`.
5. Call `applyVisualStyle` from create and update command handlers.
6. Keep effect and paint schemas explicit; do not accept arbitrary object shapes.

## Task phases

### Phase 1: Paint schema expansion

- Keep existing `SOLID` support unchanged.
- Add gradient stop schemas.
- Add transform matrix validation for gradient paints if needed.

### Phase 2: Effects schema

- Add color, offset, radius, spread, and visibility fields.
- Clamp or validate numeric fields.
- Keep defaults simple for omitted fields.

### Phase 3: Plugin style application

- Implement guards for `fills`, `strokes`, `effects`, and opacity.
- Apply only fields supported by the target node.
- Return clear errors for unsupported style operations.

### Phase 4: Documentation and examples

- Add examples for button shadows, card borders, and gradient thumbnails.

## Testing after change

### Build tests

```bash
npm run typecheck
npm run build
```

### Functional tests

1. Create a card rectangle with white fill, gray stroke, and drop shadow.
2. Create a button with a blue gradient fill.
3. Update an existing rectangle from no stroke to a visible stroke.
4. Apply opacity to a node.
5. Apply layer blur to a decorative shape.
6. Verify invalid gradient stop values fail validation.
7. Verify unsupported target nodes return clear errors.

### Visual tests

- Use Figma screenshot or manual inspection to confirm shadows and strokes render correctly.
- Verify generated styles match expected colors and dimensions.

## Acceptance criteria

- Basic cards, buttons, badges, and thumbnails can be styled without manual Figma editing.
- Visual style fields work during both creation and update.
- Invalid style payloads fail before reaching the plugin.
