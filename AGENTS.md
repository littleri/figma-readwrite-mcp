# Project Instructions

## Script retention rule

Only keep scripts in `scripts/` when they are one of:

- General examples for using the MCP.
- Test scripts or smoke-test harnesses.
- Reusable template generators.

Do not save one-off Figma design task scripts in `scripts/`. For one-time design operations, run the MCP calls directly or use a temporary script outside the committed project files.

## Codex + Figma MCP usage

- Prefer `figma_read_context` for current open Figma file context.
- Prefer `figma_read_node` for a known node id.
- Use `figma_rest_*` tools only when a `fileKey` or Figma URL is provided.
- Before plugin reads or writes, call `figma_plugin_status` or check `/health`.
- Do not write to Figma unless the user explicitly asks for canvas changes.
- Use compact, depth-limited plugin reads first: `depth: 1`, `maxChildren: 30`, `compact: true`.
- Avoid full page trees unless the user needs broad inspection.
- After rebuilding plugin code, close and reopen the Figma plugin so Figma loads the regenerated `plugin/code.js`.

## Figma interface generation rule

When generating or recreating UI screens in Figma through the custom MCP, use Auto Layout and semantic grouping as the default structure.

- Create the root screen frame as an Auto Layout frame whenever the screen has clear rows, columns, toolbars, cards, panels, or navigation regions.
- Break the screen into named structural Auto Layout sections, such as status bar, command/header area, content row/grid, carousel/page indicators, and bottom controls.
- Build repeated UI objects, such as media cards, list items, toolbar controls, buttons, tabs, and climate controls, as nested Auto Layout frames rather than loose positioned layers.
- For each card or panel, group its internal content by responsibility: artwork/preview area, app or metadata row, title row, action row, and control row.
- Use fixed dimensions and spacing on Auto Layout containers to preserve the target HMI layout, then use nested Auto Layout for text/icon alignment inside those fixed regions.
- Use clear layer names that describe both role and layout behavior, for example `Media cards row / auto layout`, `Music card / auto layout`, `Music info controls / auto layout`.
- Free-positioned vector or shape layers are acceptable only inside a bounded visual group for artwork, cover illustrations, background effects, or other non-UI compositions. Put those layers inside a named frame such as `Cover artwork / grouped visual`.
- Do not leave major UI elements as ungrouped top-level shapes or text. If an element belongs to a toolbar, card, control cluster, or status group, place it inside that group.
- Prefer rebuilding a generated Figma screen with proper Auto Layout if the current structure is mostly loose absolute-positioned nodes.
