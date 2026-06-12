# Expanded Figma MCP Tools

After the expansion, the custom MCP supports the original read/write tools plus the following capabilities.

## Hybrid read mode

The MCP now supports three categories of read tools: REST-backed, plugin-backed, and automatic.

### REST-backed read tools (require FIGMA_TOKEN)

- `figma_rest_get_file` / `figma_get_file` (compatibility alias)
- `figma_rest_get_node` / `figma_get_node` (compatibility alias)
- `figma_rest_get_images` / `figma_get_images` (compatibility alias)
- `figma_rest_get_comments` / `figma_get_comments` (compatibility alias)
- `figma_rest_get_versions` / `figma_get_versions` (compatibility alias)

These tools read Figma files through the Figma REST API and require a configured `FIGMA_TOKEN`.

### Plugin-backed read tools (require companion plugin connected)

- `figma_plugin_get_current_file_summary` — summary of the currently open Figma file
- `figma_plugin_get_current_page` — flat list of nodes on the current page
- `figma_plugin_get_page_tree` — depth-limited tree of the current page's children
- `figma_plugin_get_node` — read a single node by id
- `figma_plugin_get_node_tree` — read a node and its children as a depth-limited tree
- `figma_plugin_get_selection` / `figma_get_selection` (compatibility alias)

Plugin reads require the companion Figma plugin to be open and connected. They read from the currently open Figma file.

Depth is configurable on tree reads (default: 2 for tree tools, 0 for single-node tools). Use `includeInvisible: true` to include hidden nodes.

### Automatic read tools

- `figma_read_context` — reads file, current page, or selection context; auto-chooses REST or plugin
- `figma_read_node` — reads a specific node; auto-chooses REST or plugin

These tools implement the default source selection strategy:
| Request shape | Read source |
|---|---|
| Includes `fileKey` or Figma file URL | REST API |
| Comments, versions, or image exports | REST API |
| Current selection, page, or open file | Plugin |
| `nodeId` without `fileKey`, plugin connected | Plugin |
| Plugin not connected, `fileKey` available | REST API |
| `FIGMA_TOKEN` missing, plugin connected | Plugin |
| Neither source available | Clear error message |

Both `fileKey` and `figmaUrl` (Figma design/file link) are accepted. Figma URLs are parsed to extract `fileKey` and `nodeId` automatically.

Results include a `source` field indicating which source was used:
```json
{
  "source": "plugin",
  "data": {}
}
```

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

### Basic

- `figma_create_component`
- `figma_create_component_from_node`
- `figma_create_instance`
- `figma_detach_instance`

### Variants

- `figma_combine_as_variants`

Variant workflow:

1. Create two or more components with names such as `Button / Primary, State=Default` and `Button / Primary, State=Pressed`.
2. Call `figma_combine_as_variants` with the component ids.
3. Create instances with `figma_create_instance_with_overrides` or `figma_create_instance_smart` and pass variant/property overrides, for example `{ "State": "Pressed" }`.

### Component properties (low-level)

- `figma_add_component_property`
- `figma_edit_component_property`
- `figma_set_component_property_reference`
- `figma_get_component_properties`
- `figma_create_instance_with_overrides`

### Smart component tools (P0 — recommended for AI use)

- `figma_create_instance_smart` — Create an instance with human-readable property names. Resolves display names to real Figma keys automatically. Supports INSTANCE_SWAP by component name. Rolls back on failure.
- `figma_audit_component_properties` — Audit a component or component set: lists variant dimensions, property definitions, references, and optional probe overrides. Returns issues and warnings for unbound properties or missing references.
- `figma_bind_component_property` — Bind a component property to a layer field using human-readable names. For component sets, binds to all variant children. Resolves property name to real key automatically.
- `figma_create_component_with_properties` — Create a reusable component with child layers, component properties, and automatic property-to-layer binding in one call. Rolls back entirely on any failure.

Smart property name resolution:

- You can pass `"Label"` instead of `"Label#149:123"`.
- The resolver matches by exact key, display name, or key prefix (before `#`).
- Case-insensitive matching is supported.
- Multiple ambiguous matches produce a clear error with candidates.

Example smart instance creation:

```json
{
  "componentId": "ButtonComponentId",
  "x": 100,
  "y": 200,
  "properties": {
    "Label": "扫码加入",
    "Show Icon": false,
    "Leading Icon": "Icon / QR"
  }
}
```

Example one-stop component creation:

```json
{
  "name": "Button / Configurable",
  "x": 0,
  "y": 0,
  "width": 240,
  "height": 54,
  "layoutMode": "HORIZONTAL",
  "itemSpacing": 8,
  "paddingLeft": 16,
  "paddingRight": 16,
  "cornerRadius": 12,
  "fills": [{ "type": "SOLID", "color": { "r": 0.04, "g": 0.52, "b": 1 } }],
  "layers": [
    { "type": "TEXT", "name": "Label", "text": "Tap Me", "fontSize": 17 },
    { "type": "RECTANGLE", "name": "Icon", "width": 20, "height": 20 }
  ],
  "properties": [
    { "name": "Label", "type": "TEXT", "defaultValue": "Tap Me", "bind": { "layerName": "Label", "field": "characters" } },
    { "name": "Show Icon", "type": "BOOLEAN", "defaultValue": true, "bind": { "layerName": "Icon", "field": "visible" } }
  ],
  "verify": true
}
```

Example audit report:

```json
{
  "id": "...",
  "name": "Button / Configurable",
  "type": "COMPONENT",
  "isComponentSet": false,
  "properties": [
    {
      "key": "Label#149:123",
      "displayName": "Label",
      "type": "TEXT",
      "defaultValue": "Tap Me",
      "hasReference": true,
      "references": [{ "nodeId": "...", "nodeName": "Label", "field": "characters" }]
    }
  ],
  "probeResults": [{ "property": "Label#149:123", "probe": "passed" }],
  "issues": [],
  "warnings": []
}
```

## Variables and modes

- `figma_create_variable_collection`
- `figma_add_variable_mode`
- `figma_rename_variable_mode`
- `figma_create_variable`
- `figma_set_variable_value_for_mode`
- `figma_get_local_variables`
- `figma_get_local_variable_collections`
- `figma_bind_variable`
- `figma_set_explicit_variable_mode`
- `figma_create_theme_tokens`

Use variables for Light/Dark themes:

1. Create a `Theme` collection with `Light` and `Dark` modes.
2. Create semantic variables such as `color/bg/canvas`, `color/bg/elevated`, `color/text/primary`, and `color/accent/primary`.
3. Bind fills, strokes, text fills, or node fields with `figma_bind_variable`.
4. Switch a screen frame by calling `figma_set_explicit_variable_mode` with the Theme collection id and the target mode id.

Example theme token payload:

```json
{
  "collectionName": "Theme",
  "modes": ["Light", "Dark"],
  "tokens": [
    {
      "name": "color/bg/canvas",
      "type": "COLOR",
      "scopes": ["FRAME_FILL"],
      "values": {
        "Light": { "r": 0.98, "g": 0.98, "b": 1, "a": 1 },
        "Dark": { "r": 0.04, "g": 0.05, "b": 0.07, "a": 1 }
      }
    }
  ]
}
```

## Local Styles

Native Figma Local Styles appear in the right-side `Styles` panel. Variables handle theming and mode switching; Styles handle reusable designer-facing assets. A mature design system uses both.

### Variables vs Styles

| Feature | Variables | Local Styles |
|---|---|---|
| Light/Dark mode switching | Yes | No |
| Designer-facing `Styles` panel | No | Yes |
| Bind to fill/stroke/text/effect | Yes | Yes |
| Effect binding | Limited | Full |

### Tool list

- `figma_get_local_styles` — Read all local Paint/Text/Effect styles.
- `figma_create_paint_style` — Create or upsert a Paint Style.
- `figma_create_text_style` — Create or upsert a Text Style (requires font to be available).
- `figma_create_effect_style` — Create or upsert an Effect Style.
- `figma_update_style` — Update an existing style by id.
- `figma_delete_style` — Delete a local style by id.
- `figma_bind_style` — Bind a local style to a node (fill/stroke/text/effect).
- `figma_create_design_system_styles` — Batch create/upsert a full style set.
- `figma_audit_styles` — Audit style inventory: count, duplicates, missing expected styles.
- `figma_audit_node_style_binding` — Walk a node tree and report style bindings and unbound styled nodes.

### Usage

Create a paint style:

```json
{
  "name": "TableDoll/Color/Accent/Primary",
  "paints": [{ "type": "SOLID", "color": { "r": 0.04, "g": 0.52, "b": 1 }, "opacity": 1 }],
  "upsert": true
}
```

Bind a style to a node:

```json
{
  "nodeId": "12:34",
  "styleId": "S:...",
  "target": "fill"
}
```

Batch create a design system:

```json
{
  "upsert": true,
  "paintStyles": [{ "name": "MyApp/Color/Primary", "paints": [...] }],
  "textStyles": [{ "name": "MyApp/Typography/Body", "fontFamily": "Inter", "fontStyle": "Regular", "fontSize": 17 }],
  "effectStyles": [{ "name": "MyApp/Effect/Shadow", "effects": [...] }]
}
```

### Upsert rules

- `upsert: true` (default) — update the first style with matching name; no duplicates.
- `upsert: false` — throw if a style with the same name already exists.
- Text styles require `figma.loadFontAsync` before creation; font failure returns a clear error.

### Known limitations

- Paint Style paints do not yet support variable bindings (phase 2).
- Remote library styles are readable but not editable/deletable via this MCP.

## Image fills

- `figma_create_image_rectangle`
- `figma_update_image_fill`

Image fill tools fetch an explicit URL and create an image paint inside Figma.

## Batch page creation

- `figma_create_page_frames`
- `figma_create_page_from_template`
- `figma_batch_create_nodes`

These tools can create multiple page-level frames under a Figma Page or nested frames under an existing Frame. Use a Page node id such as `0:1` as `parentId` to generate multiple website pages on the same Figma page.

`figma_batch_create_nodes` creates a hierarchy of nodes in one transaction. Use `tempId` and `parentTempId` to express parent-child relationships, `validateOnly` to dry-run a payload, and `rollbackOnError` (default true) to remove created nodes if any node fails.

Example app screen batch:

```json
{
  "nodes": [
    {
      "tempId": "screen",
      "type": "AUTO_LAYOUT_FRAME",
      "props": {
        "name": "Home Screen",
        "x": 0,
        "y": 0,
        "width": 393,
        "height": 852,
        "layoutMode": "VERTICAL",
        "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 } }]
      }
    },
    {
      "tempId": "title",
      "type": "TEXT",
      "parentTempId": "screen",
      "props": {
        "text": "TableDoll",
        "x": 0,
        "y": 0,
        "fontSize": 28
      }
    }
  ],
  "rollbackOnError": true
}
```

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

## Plugin read command reference

The following plugin commands were added for hybrid read mode:

| Command | Description | Default depth |
|---|---|---|
| `getCurrentFileSummary` | File name, page count, selection count | N/A |
| `getCurrentPage` | Flat list of current page children | 0 |
| `getPageTree` | Depth-limited tree of current page | 2 |
| `getNode` | Single node by id | 0 |
| `getNodeTree` | Node and children as tree | 2 |

All plugin read commands support `depth` (0-20) and `includeInvisible` options.

## Serialized node shape

Plugin reads return nodes with a safe, concise shape:

- `id`, `name`, `type`, `visible`, `locked`
- Geometry: `x`, `y`, `width`, `height`, `rotation`, `opacity`
- Visual: `fills`, `strokes`, `strokeWeight`, `cornerRadius`
- Text: `characters`, `fontSize`, `fontName`, `lineHeight`, `letterSpacing`, `textAlignHorizontal`, `textAlignVertical`
- Auto-layout: `layoutMode`, `itemSpacing`, padding, axis alignment, sizing modes
- Components: `variantProperties`, `componentPropertyDefinitions`, `componentProperties`, `componentPropertyReferences`
- Variables: `boundVariables`, `explicitVariableModes`
- `children` (only when depth > 0)

Fields are omitted when at default values to keep payloads small.

## Still not supported

Prototype interactions are still not supported because Figma Plugin API does not expose prototype editing APIs. Click navigation, hover states, and prototype transitions must still be configured manually in Figma Prototype mode.

## Reload requirement

After pulling or building these changes:

1. Restart the MCP server.
2. Rebuild if needed with `npm run build`.
3. Close and reopen the Figma plugin.
4. Confirm `/health` returns `plugin.connected: true`.
