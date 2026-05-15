# Task: Component Support

## Objective

Add MCP support for creating reusable Figma components and inserting component instances. This enables Claude to build repeatable UI systems such as buttons, cards, nav items, and badges.

## New capabilities

- Create a component from scratch.
- Convert an existing node into a component where supported.
- Create an instance of a component.
- Detach an instance if needed.
- Read basic component or instance metadata through the plugin.

## Proposed tools

### `figma_create_component`

Inputs:

- `parentId?: string`
- `name: string`
- `x: number`
- `y: number`
- `width: number`
- `height: number`
- optional auto-layout fields
- optional visual style fields

### `figma_create_component_from_node`

Inputs:

- `nodeId: string`
- `name?: string`

### `figma_create_instance`

Inputs:

- `componentId: string`
- `parentId?: string`
- `name?: string`
- `x: number`
- `y: number`

### `figma_detach_instance`

Inputs:

- `nodeId: string`

## Implementation approach

1. Add component command schemas in `src/schemas.ts`.
2. Register component tools in `src/mcp/tools/write.ts`.
3. Add plugin handlers using:
   - `figma.createComponent()`
   - `component.createInstance()`
   - `instance.detachInstance()`
4. Reuse style and layout helpers so components can be styled.
5. Serialize component-specific fields such as `componentPropertyReferences` only if needed.

## Task phases

### Phase 1: Basic component creation

- Create empty styled components.
- Insert instances by component node id.

### Phase 2: Convert existing nodes

- Support creating a component from a selected or referenced node.
- Define how to preserve child order and visual properties.

### Phase 3: Instance updates

- Support name, position, size, and style updates on instances where Figma allows it.
- Consider exposing instance detach only when required.

## Testing after change

### Build tests

```bash
npm run typecheck
npm run build
```

### Functional tests

1. Create a button component.
2. Create three instances of that component in a frame.
3. Update the source component and verify instances reflect the change.
4. Detach one instance and verify it becomes normal nodes.
5. Attempt to create an instance from a non-component node and verify clear error.
6. Restart plugin and verify component creation still works.

### Visual tests

- Manually inspect source component and instances in Figma.
- Verify duplicated instances retain styling and size.

## Acceptance criteria

- Claude can create a reusable component and place multiple instances.
- Invalid component operations return clear errors.
- Basic component creation does not break existing frame, rectangle, and text tools.
