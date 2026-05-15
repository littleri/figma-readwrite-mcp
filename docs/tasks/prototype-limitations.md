# Task: Prototype Interaction Limitations

## Objective

Document what can and cannot be done for Figma prototype interactions through this custom MCP, so future implementation work does not target unsupported Plugin API capabilities.

## User-facing goal

The user wants functionality such as:

- Click image to navigate to a project detail page.
- Hover image to scale up.
- Animated transitions between states.
- Page-to-page prototype flows.

## Current API reality

Figma Plugin API does not expose a stable API for creating or editing prototype connections, hover triggers, navigation actions, or transition settings.

Therefore, this MCP cannot programmatically create:

- `On click` navigation links.
- `While hovering` interactions.
- `Mouse enter` or `Mouse leave` prototype events.
- Smart animate transitions.
- Prototype starting points.
- Flow names.

## What the MCP can still do

The MCP can create design structures that make manual prototyping easier:

1. Create the source card or button node.
2. Create the destination detail page frame.
3. Name nodes clearly, e.g. `Project Alpha card` and `Project Alpha Detail`.
4. Create hover-state component variants visually, if component support is added later.
5. Add visible labels such as `View Project ->`.

Then the user can manually connect them in Figma Prototype mode.

## Suggested workflow

### Click-to-detail page

1. MCP creates four project cards.
2. MCP creates four detail frames.
3. MCP names each source and destination clearly.
4. User opens Figma Prototype mode.
5. User selects the clickable image/card.
6. User drags prototype handle to the detail page.
7. User sets interaction: `On click -> Navigate to -> Project Detail`.

### Hover zoom

1. MCP creates card component default state.
2. MCP creates a visually enlarged hover version if component support exists.
3. User creates component variants in Figma UI.
4. User sets interaction: `While hovering -> Change to -> Hover variant`.

## Non-goals

Do not implement fake prototype automation by:

- Guessing undocumented internal Figma fields.
- Editing raw Figma document JSON and expecting it to sync.
- Using browser automation to click Figma UI unless the user explicitly requests a one-off automation experiment.

These approaches are fragile and likely to break.

## Task phases

This is a documentation-only task unless Figma exposes official prototype APIs in the future.

### Phase 1: Document limitation

- Keep this document linked from the main expansion plan.
- Explain manual workaround.

### Phase 2: Improve MCP-generated prototype readiness

- Add naming conventions.
- Add optional destination frame creation helpers.
- Add optional notes labels or annotations.

### Phase 3: Revisit when API changes

- Periodically check Figma Plugin API release notes if prototype automation becomes important.

## Testing after change

No code tests are needed for this limitation document.

Manual workflow test:

1. Generate project cards and detail frames.
2. Manually connect one card to one detail frame in Figma Prototype mode.
3. Present the prototype and verify navigation works.
4. Manually create a hover variant and verify hover behavior works.

## Acceptance criteria

- Users understand that prototype interactions require manual Figma Prototype mode setup.
- Future implementation tasks do not attempt unsupported prototype API automation.
- MCP-generated designs use clear node names that make manual prototyping fast.
