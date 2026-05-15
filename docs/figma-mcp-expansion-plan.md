# Figma Read/Write MCP Capability Expansion Plan

## Goal

Expand the custom Figma read/write MCP from basic frame, rectangle, and text operations into a more complete design-production bridge. The next phase should support richer drawing primitives, layout systems, visual styling, reusable components, image fills, and advanced text properties while keeping the bridge safe, explicit, and schema-validated.

Prototype interactions are intentionally excluded from the implementation roadmap because Figma Plugin API does not expose creation or editing of prototype connections, hover triggers, navigation actions, or animation transitions.

## Current baseline

The MCP currently supports:

- REST-based reads: file, node, images, comments, versions.
- Plugin bridge status and selection reads.
- Canvas writes: frame, rectangle, text.
- Node updates: name, position, size, rotation, opacity, fills, corner radius, text characters.
- Node deletion and selection.
- Parent insertion with `parentId`.

## Proposed feature groups

| Priority | Feature group | Value | Task document |
|---|---|---|---|
| P0 | Auto layout | Enables consistent page and component layout | [Auto Layout](tasks/auto-layout.md) |
| P0 | Visual styling | Adds strokes, shadows, blur, and richer paint support | [Visual Styling](tasks/visual-styling.md) |
| P1 | Vector primitives | Adds ellipse, line, polygon, star, and vector path support | [Vector Primitives](tasks/vector-primitives.md) |
| P1 | Advanced text | Enables line height, letter spacing, alignment, and paragraph behavior | [Advanced Text](tasks/advanced-text.md) |
| P2 | Components | Enables reusable components and instances | [Components](tasks/components.md) |
| P2 | Image fills | Enables project thumbnails and visual portfolio cards using real images | [Image Fills](tasks/image-fills.md) |
| Not planned | Prototype interactions | Not supported by Figma Plugin API | [Prototype Limitations](tasks/prototype-limitations.md) |

## Design principles

1. Keep each MCP tool narrow and explicit.
2. Validate all external input with Zod before sending commands to the plugin.
3. Avoid arbitrary code execution inside the plugin.
4. Prefer idempotent, inspectable operations.
5. Return node ids for every created or updated node.
6. Keep write tools available only through the connected Figma plugin in Design mode.
7. Keep read tools independent from the plugin when possible.

## Implementation pattern

Each feature should follow the same architecture:

1. Add or extend Zod schemas in `src/schemas.ts`.
2. Add MCP tool registration in `src/mcp/tools/write.ts`.
3. Extend `PluginCommand` union in `src/schemas.ts`.
4. Implement command handling in `plugin/code.ts`.
5. Rebuild plugin output with `npm run build:plugin`.
6. Run `npm run typecheck` and `npm run build`.
7. Reload the Figma plugin and verify via `/health`.
8. Exercise the new tool against a disposable Figma test frame.

## Suggested rollout order

### Phase 1: Layout and style foundation

- Auto layout.
- Visual styling.
- Advanced text.

This phase unlocks most page-building work: landing pages, portfolio grids, cards, buttons, and responsive-like frame structures.

### Phase 2: Drawing and media

- Vector primitives.
- Image fills.

This phase improves visual fidelity and allows more realistic project thumbnails, icons, and decorations.

### Phase 3: Reuse and design-system support

- Components.

This phase should come after layout and styles are stable because component creation benefits from mature layout and style support.

## Testing strategy

Use a dedicated Figma test file or test page. Do not test on important production designs first.

For each feature:

1. Unit-level validation: invalid schema inputs should fail before reaching Figma.
2. Plugin-level smoke test: command creates or updates the expected node type.
3. Visual test: use Figma screenshot or manual inspection.
4. Regression test: verify existing create frame, rectangle, text, update, delete, and select tools still work.
5. Reconnection test: restart MCP server and reload plugin, then repeat one create/update operation.

## Known limitations

- Prototype interactions cannot be created or modified through this MCP because Figma Plugin API does not provide prototype editing APIs.
- Dev Mode is not suitable for write operations. Writes require Design mode and an open connected plugin window.
- Z-order control is currently limited. If ordering becomes important, add explicit layer ordering tools before relying on complex overlapping designs.
- Rich image workflows require careful handling so the MCP does not upload sensitive local files accidentally.

## Definition of done for the expansion

The expansion is complete when:

- All P0 and P1 tasks are implemented and documented.
- `npm run typecheck` passes.
- `npm run build` passes.
- A test Figma page demonstrates auto layout, styled cards, vector primitives, advanced text, and image fills.
- Existing basic write tools continue to work.
- Documentation explains which operations require Design mode and plugin connection.
