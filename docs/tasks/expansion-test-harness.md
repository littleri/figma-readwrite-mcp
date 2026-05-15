# Task: Expansion Test Harness

## Objective

Create a repeatable test workflow for validating all future Figma MCP write expansions.

## Proposed test assets

Use a disposable Figma page named `MCP Expansion Test` with one root frame:

- Name: `MCP Test Frame`
- Size: `1440 x 1024`
- Background: light gray

## Test script strategy

Add one script per feature under `scripts/`:

- `test-auto-layout.mjs`
- `test-visual-styling.mjs`
- `test-vector-primitives.mjs`
- `test-advanced-text.mjs`
- `test-components.mjs`
- `test-image-fills.mjs`

Each script should:

1. Initialize MCP.
2. Check `figma_plugin_status`.
3. Create or update nodes in the test frame.
4. Print created node ids.
5. Exit non-zero on MCP or plugin errors.

## Required checks

### Connection checks

- `/health` returns `ok: true`.
- `plugin.connected` is `true`.
- Plugin metadata contains expected file and page names.

### Build checks

```bash
npm run typecheck
npm run build
```

### Regression checks

For every new feature, verify existing tools still work:

- `figma_create_frame`
- `figma_create_rectangle`
- `figma_create_text`
- `figma_update_node`
- `figma_delete_node`
- `figma_select_node`
- `figma_get_selection`

### Visual checks

Use one of:

- Official Figma MCP screenshot tool.
- Manual Figma inspection.
- Node metadata and design context comparison.

## Task phases

### Phase 1: Shared script utilities

- Extract common MCP HTTP/SSE parsing helper.
- Extract `callTool` helper.
- Extract `assertPluginConnected` helper.

### Phase 2: Feature smoke scripts

- Create one script per feature.
- Keep scripts small and deterministic.

### Phase 3: Documentation

- Document how to run each script.
- Add expected visual output notes.

## Acceptance criteria

- Each expansion feature has a runnable smoke script.
- Failures are visible from terminal output.
- Test scripts do not require editing important production Figma files.
