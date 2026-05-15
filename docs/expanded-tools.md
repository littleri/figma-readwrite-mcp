# Expanded Figma MCP Tools

After the expansion, the custom MCP supports the original read/write tools plus the following write capabilities.

## Layout

- `figma_create_auto_layout_frame`
- `figma_update_auto_layout`

Supported fields include `layoutMode`, `layoutWrap`, `itemSpacing`, padding, axis alignment, and sizing modes.

## Visual styling

Existing create/update tools now accept richer style fields:

- `fills`: solid and gradient paints
- `strokes`
- `strokeWeight`
- `strokeAlign`
- `effects`: drop shadow, inner shadow, layer blur, background blur
- `opacity`
- `cornerRadius`
- `cornerSmoothing`

## Vector primitives

- `figma_create_ellipse`
- `figma_create_line`
- `figma_create_polygon`
- `figma_create_star`
- `figma_create_vector`

## Advanced text

`figma_create_text` and `figma_update_node` support:

- `fontFamily`
- `fontStyle`
- `fontSize`
- `lineHeight`
- `letterSpacing`
- `textAlignHorizontal`
- `textAlignVertical`
- `textAutoResize`
- `paragraphSpacing`
- `paragraphIndent`

## Components

- `figma_create_component`
- `figma_create_component_from_node`
- `figma_create_instance`
- `figma_detach_instance`

## Image fills

- `figma_create_image_rectangle`
- `figma_update_image_fill`

Image fill tools fetch an explicit URL and create an image paint inside Figma.

## Batch page creation

- `figma_create_page_frames`
- `figma_create_page_from_template`

These tools can create multiple page-level frames under a Figma Page or nested frames under an existing Frame. Use a Page node id such as `0:1` as `parentId` to generate multiple website pages on the same Figma page.

Example page-frame layout:

```json
{
  "parentId": "0:1",
  "template": "portfolio-site",
  "pages": ["Home", "Work", "Project Detail", "About", "Contact"],
  "startX": 0,
  "startY": 0,
  "gap": 160,
  "width": 1440,
  "height": 1024
}
```

## Still not supported

Prototype interactions are still not supported because Figma Plugin API does not expose prototype editing APIs. Click navigation, hover states, and prototype transitions must still be configured manually in Figma Prototype mode.

## Reload requirement

After pulling or building these changes:

1. Restart the MCP server.
2. Rebuild if needed with `npm run build`.
3. Close and reopen the Figma plugin.
4. Confirm `/health` returns `plugin.connected: true`.
