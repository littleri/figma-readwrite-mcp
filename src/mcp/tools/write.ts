import { z } from "zod";

import { PluginBridge } from "../../pluginBridge.js";
import type { PluginCommand } from "../../schemas.js";
import {
  autoLayoutSchema,
  baseCreateSchema,
  nodePatchSchema,
  pageFrameSchema,
  pageTemplateSchema,
  paintSchema,
  parentIdSchema,
  textStyleSchema,
  vectorPathSchema,
  visualStyleSchema,
  writableComponentPropertyTypeSchema,
} from "../../schemas.js";

function asJsonText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

/**
 * Structured wrapper for plugin tool calls.
 *
 * On success: { ok: true, result: ... }
 * On failure: { isError: true, content: [{ type: "text", text: "{ ok: false, error: ... }" }] }
 *
 * This ensures callers can distinguish success from failure without
 * parsing unstructured text.
 */
async function callPluginTool(bridge: PluginBridge, command: PluginCommand, timeoutMs?: number) {
  try {
    const result = await bridge.send(command, timeoutMs);
    if (result && typeof result === "object" && "ok" in result && (result as { ok?: unknown }).ok === false) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
    return asJsonText({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: message }, null, 2) }],
    };
  }
}

const positionedTextSchema = z.object({
  name: z.string().min(1).optional(),
  parentId: parentIdSchema,
  text: z.string(),
  x: z.number(),
  y: z.number(),
}).merge(visualStyleSchema).merge(textStyleSchema);

export function registerWriteTools(server: { registerTool: Function }, bridge: PluginBridge) {
  server.registerTool(
    "figma_plugin_status",
    {
      title: "Figma plugin status",
      description: "Report whether the companion Figma plugin is connected, plus recent command and error info.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => asJsonText(bridge.getStatus()),
  );

  // --- Bridge management tools ---

  server.registerTool(
    "figma_plugin_cancel_pending",
    {
      title: "Cancel pending plugin commands",
      description: "Cancel all pending requests to the Figma plugin without closing the connection.",
      inputSchema: {},
    },
    async () => {
      bridge.cancelAll();
      return asJsonText({ ok: true, pendingRequests: 0 });
    },
  );

  server.registerTool(
    "figma_plugin_reset_bridge",
    {
      title: "Reset plugin bridge",
      description:
        "Cancel all pending requests and close the plugin connection. " +
        "You must reopen the Figma plugin to reconnect.",
      inputSchema: {},
    },
    async () => {
      bridge.resetBridge();
      return asJsonText({ ok: true, message: "Bridge reset. Reopen the Figma plugin to reconnect." });
    },
  );

  // Compatibility alias for figma_plugin_get_selection
  server.registerTool(
    "figma_get_selection",
    {
      title: "Get Figma selection (plugin — compatibility alias)",
      description: "Read the current selection through the connected Figma plugin. Alias of figma_plugin_get_selection.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => asJsonText(await bridge.send({ type: "getSelection" })),
  );

  server.registerTool(
    "figma_create_frame",
    {
      title: "Create Figma frame",
      description: "Create a frame on the current Figma page through the companion plugin. Rolls back on failure.",
      inputSchema: baseCreateSchema.shape,
    },
    async (payload: z.infer<typeof baseCreateSchema>) => callPluginTool(bridge, { type: "createFrame", payload }),
  );

  server.registerTool(
    "figma_create_rectangle",
    {
      title: "Create Figma rectangle",
      description: "Create a rectangle on the current Figma page through the companion plugin. Rolls back on failure.",
      inputSchema: baseCreateSchema.shape,
    },
    async (payload: z.infer<typeof baseCreateSchema>) => callPluginTool(bridge, { type: "createRectangle", payload }),
  );

  server.registerTool(
    "figma_create_text",
    {
      title: "Create Figma text",
      description: "Create a text node on the current Figma page through the companion plugin. Rolls back on failure.",
      inputSchema: positionedTextSchema.shape,
    },
    async (payload: z.infer<typeof positionedTextSchema>) => callPluginTool(bridge, { type: "createText", payload }),
  );

  const autoLayoutCreateSchema = baseCreateSchema.merge(autoLayoutSchema);
  server.registerTool(
    "figma_create_auto_layout_frame",
    {
      title: "Create auto-layout frame",
      description: "Create a frame with Figma auto layout properties. Rolls back on failure.",
      inputSchema: autoLayoutCreateSchema.shape,
    },
    async (payload: z.infer<typeof autoLayoutCreateSchema>) => callPluginTool(bridge, { type: "createAutoLayoutFrame", payload }),
  );

  server.registerTool(
    "figma_update_auto_layout",
    {
      title: "Update auto layout",
      description: "Apply or update auto layout properties on an existing frame.",
      inputSchema: z.object({ nodeId: z.string().min(1) }).merge(autoLayoutSchema).shape,
    },
    async (payload: { nodeId: string } & z.infer<typeof autoLayoutSchema>) => callPluginTool(bridge, { type: "updateAutoLayout", payload }),
  );

  server.registerTool(
    "figma_create_ellipse",
    {
      title: "Create Figma ellipse",
      description: "Create an ellipse on the current Figma page through the companion plugin. Rolls back on failure.",
      inputSchema: baseCreateSchema.shape,
    },
    async (payload: z.infer<typeof baseCreateSchema>) => callPluginTool(bridge, { type: "createEllipse", payload }),
  );

  const lineSchema = z.object({
    name: z.string().min(1).optional(),
    parentId: parentIdSchema,
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    rotation: z.number().optional(),
  }).merge(visualStyleSchema);

  server.registerTool(
    "figma_create_line",
    {
      title: "Create Figma line",
      description: "Create a line on the current Figma page through the companion plugin. Rolls back on failure.",
      inputSchema: lineSchema.shape,
    },
    async (payload: z.infer<typeof lineSchema>) => callPluginTool(bridge, { type: "createLine", payload }),
  );

  const polygonSchema = baseCreateSchema.extend({ pointCount: z.number().int().min(3).max(60) });
  server.registerTool(
    "figma_create_polygon",
    {
      title: "Create Figma polygon",
      description: "Create a polygon on the current Figma page through the companion plugin. Rolls back on failure.",
      inputSchema: polygonSchema.shape,
    },
    async (payload: z.infer<typeof polygonSchema>) => callPluginTool(bridge, { type: "createPolygon", payload }),
  );

  const starSchema = baseCreateSchema.extend({
    pointCount: z.number().int().min(3).max(60).optional(),
    innerRadius: z.number().min(0).max(1).optional(),
  });
  server.registerTool(
    "figma_create_star",
    {
      title: "Create Figma star",
      description: "Create a star on the current Figma page through the companion plugin. Rolls back on failure.",
      inputSchema: starSchema.shape,
    },
    async (payload: z.infer<typeof starSchema>) => callPluginTool(bridge, { type: "createStar", payload }),
  );

  const vectorSchema = z.object({
    name: z.string().min(1).optional(),
    parentId: parentIdSchema,
    x: z.number(),
    y: z.number(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    vectorPaths: z.array(vectorPathSchema).min(1),
  }).merge(visualStyleSchema);
  server.registerTool(
    "figma_create_vector",
    {
      title: "Create Figma vector",
      description: "Create a vector node from path data through the companion plugin. Rolls back on failure.",
      inputSchema: vectorSchema.shape,
    },
    async (payload: z.infer<typeof vectorSchema>) => callPluginTool(bridge, { type: "createVector", payload }),
  );

  server.registerTool(
    "figma_create_component",
    {
      title: "Create Figma component",
      description: "Create a reusable Figma component. Rolls back on failure.",
      inputSchema: autoLayoutCreateSchema.shape,
    },
    async (payload: z.infer<typeof autoLayoutCreateSchema>) => callPluginTool(bridge, { type: "createComponent", payload }),
  );

  server.registerTool(
    "figma_create_component_from_node",
    {
      title: "Create component from node",
      description: "Convert an existing node into a Figma component where supported.",
      inputSchema: { nodeId: z.string().min(1), name: z.string().min(1).optional() },
    },
    async (payload: { nodeId: string; name?: string }) => callPluginTool(bridge, { type: "createComponentFromNode", payload }),
  );

  server.registerTool(
    "figma_create_instance",
    {
      title: "Create component instance",
      description: "Create an instance of an existing Figma component.",
      inputSchema: {
        componentId: z.string().min(1),
        name: z.string().min(1).optional(),
        parentId: parentIdSchema,
        x: z.number(),
        y: z.number(),
      },
    },
    async (payload: { componentId: string; name?: string; parentId?: string; x: number; y: number }) => callPluginTool(bridge, { type: "createInstance", payload }),
  );

  server.registerTool(
    "figma_detach_instance",
    {
      title: "Detach component instance",
      description: "Detach a component instance into normal Figma nodes.",
      inputSchema: { nodeId: z.string().min(1) },
    },
    async (payload: { nodeId: string }) => callPluginTool(bridge, { type: "detachInstance", payload }),
  );

  // --- Component variants & properties ---

  server.registerTool(
    "figma_combine_as_variants",
    {
      title: "Combine as variants",
      description: "Combine two or more components into a component set with variants.",
      inputSchema: {
        componentIds: z.array(z.string().min(1)).min(2).max(100),
        parentId: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        index: z.number().int().min(0).optional(),
      },
    },
    async (payload: { componentIds: string[]; parentId?: string; name?: string; index?: number }) =>
      callPluginTool(bridge, { type: "combineAsVariants", payload }),
  );

  server.registerTool(
    "figma_add_component_property",
    {
      title: "Add component property",
      description: "Add a component property (TEXT, BOOLEAN, INSTANCE_SWAP) to a component or component set.",
      inputSchema: {
        componentId: z.string().min(1),
        propertyName: z.string().min(1),
        propertyType: writableComponentPropertyTypeSchema,
        defaultValue: z.union([z.string(), z.boolean()]).optional(),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "addComponentProperty", payload }),
  );

  server.registerTool(
    "figma_edit_component_property",
    {
      title: "Edit component property",
      description: "Edit the name or default value of an existing component property.",
      inputSchema: {
        componentId: z.string().min(1),
        propertyKey: z.string().min(1),
        newName: z.string().min(1).optional(),
        newDefaultValue: z.union([z.string(), z.boolean()]).optional(),
      },
    },
    async (payload: { componentId: string; propertyKey: string; newName?: string; newDefaultValue?: string | boolean }) =>
      callPluginTool(bridge, { type: "editComponentProperty", payload }),
  );

  server.registerTool(
    "figma_set_component_property_reference",
    {
      title: "Set component property reference",
      description: "Bind component properties to internal layer fields (e.g., characters -> Label#0:1).",
      inputSchema: {
        nodeId: z.string().min(1),
        references: z.record(z.string(), z.string()),
      },
    },
    async (payload: { nodeId: string; references: Record<string, string> }) =>
      callPluginTool(bridge, { type: "setComponentPropertyReference", payload }),
  );

  server.registerTool(
    "figma_get_component_properties",
    {
      title: "Get component properties",
      description: "Read component property definitions for a component or component set.",
      inputSchema: { componentId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async (payload: { componentId: string }) =>
      asJsonText(await bridge.send({ type: "getComponentProperties", payload })),
  );

  server.registerTool(
    "figma_create_instance_with_overrides",
    {
      title: "Create instance with overrides",
      description: "Create a component instance and apply variant/property overrides in one call.",
      inputSchema: {
        componentId: z.string().min(1),
        parentId: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        x: z.number(),
        y: z.number(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
        properties: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
      },
    },
    async (payload: { componentId: string; parentId?: string; name?: string; x: number; y: number; width?: number; height?: number; properties?: Record<string, string | boolean> }) =>
      callPluginTool(bridge, { type: "createInstanceWithOverrides", payload }),
  );

  // --- P0: Smart instance creation ---

  server.registerTool(
    "figma_create_instance_smart",
    {
      title: "Create instance (smart)",
      description:
        "Create a component instance with human-readable property names. " +
        "Resolves display names to real Figma property keys automatically. " +
        "Supports INSTANCE_SWAP by component name. " +
        "Verifies property application when verify is true (default). " +
        "Rolls back the instance on any failure.",
      inputSchema: {
        componentId: z.string().min(1),
        parentId: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        x: z.number(),
        y: z.number(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
        properties: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
        verify: z.boolean().optional(),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "createInstanceSmart", payload }),
  );

  // --- P0: Audit component properties ---

  server.registerTool(
    "figma_audit_component_properties",
    {
      title: "Audit component properties",
      description:
        "Audit a component or component set: list variant dimensions, " +
        "property definitions, references, and optional probe overrides. " +
        "Returns issues and warnings for unbound properties or missing references. " +
        "Optionally creates and cleans up a probe instance to verify overrides.",
      inputSchema: {
        componentId: z.string().min(1),
        createProbeInstance: z.boolean().optional(),
        probeParentId: z.string().min(1).optional(),
        cleanupProbe: z.boolean().optional(),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "auditComponentProperties", payload }, 30_000),
  );

  // --- P1: Bind component property by layer name ---

  server.registerTool(
    "figma_bind_component_property",
    {
      title: "Bind component property by layer name",
      description:
        "Bind a component property to a layer field using human-readable names. " +
        "For component sets, binds to all variant children that have the named layer. " +
        "Resolves the property name to the real key automatically. " +
        "Use field: 'characters' for TEXT, 'visible' for BOOLEAN, 'mainComponent' for INSTANCE_SWAP.",
      inputSchema: {
        componentId: z.string().min(1),
        propertyName: z.string().min(1),
        layerName: z.string().min(1),
        field: z.enum(["characters", "visible", "mainComponent"]),
        match: z.enum(["exact", "contains"]).optional(),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "bindComponentProperty", payload }),
  );

  // --- P1: Create component with properties ---

  server.registerTool(
    "figma_create_component_with_properties",
    {
      title: "Create component with properties",
      description:
        "Create a reusable component with child layers, component properties, " +
        "and automatic property-to-layer binding in one call. " +
        "Rolls back the entire component on any failure. " +
        "Optionally creates a probe instance to verify properties work.",
      inputSchema: {
        name: z.string().min(1),
        parentId: z.string().min(1).optional(),
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
        layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional(),
        itemSpacing: z.number().optional(),
        paddingLeft: z.number().min(0).optional(),
        paddingRight: z.number().min(0).optional(),
        paddingTop: z.number().min(0).optional(),
        paddingBottom: z.number().min(0).optional(),
        cornerRadius: z.number().min(0).optional(),
        fills: z.array(z.object({
          type: z.literal("SOLID"),
          color: z.object({ r: z.number(), g: z.number(), b: z.number() }),
          opacity: z.number().optional(),
        })).optional(),
        strokes: z.array(z.object({
          type: z.literal("SOLID"),
          color: z.object({ r: z.number(), g: z.number(), b: z.number() }),
        })).optional(),
        strokeWeight: z.number().min(0).optional(),
        effects: z.array(z.object({
          type: z.enum(["DROP_SHADOW", "INNER_SHADOW"]),
          color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number() }),
          offset: z.object({ x: z.number(), y: z.number() }),
          radius: z.number().min(0),
        })).optional(),
        layers: z.array(z.object({
          type: z.enum(["TEXT", "FRAME", "RECTANGLE", "ELLIPSE"]),
          name: z.string().min(1),
          text: z.string().optional(),
          fontSize: z.number().positive().optional(),
          fontFamily: z.string().optional(),
          fontStyle: z.string().optional(),
          fills: z.array(z.object({
            type: z.literal("SOLID"),
            color: z.object({ r: z.number(), g: z.number(), b: z.number() }),
          })).optional(),
          width: z.number().positive().optional(),
          height: z.number().positive().optional(),
          cornerRadius: z.number().min(0).optional(),
          layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional(),
          itemSpacing: z.number().optional(),
          paddingLeft: z.number().min(0).optional(),
          paddingRight: z.number().min(0).optional(),
          paddingTop: z.number().min(0).optional(),
          paddingBottom: z.number().min(0).optional(),
        })).optional(),
        properties: z.array(z.object({
          name: z.string().min(1),
          type: z.enum(["TEXT", "BOOLEAN", "INSTANCE_SWAP"]),
          defaultValue: z.union([z.string(), z.boolean()]).optional(),
          bind: z.object({
            layerName: z.string().min(1),
            field: z.enum(["characters", "visible", "mainComponent"]),
          }).optional(),
        })).optional(),
        verify: z.boolean().optional(),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "createComponentWithProperties", payload }, 30_000),
  );

  // --- Variables ---

  server.registerTool(
    "figma_create_variable_collection",
    {
      title: "Create variable collection",
      description: "Create a Figma variable collection (e.g., 'Theme' for Light/Dark modes).",
      inputSchema: {
        name: z.string().min(1),
        defaultModeName: z.string().min(1).optional(),
      },
    },
    async (payload: { name: string; defaultModeName?: string }) =>
      callPluginTool(bridge, { type: "createVariableCollection", payload }),
  );

  server.registerTool(
    "figma_add_variable_mode",
    {
      title: "Add variable mode",
      description: "Add a mode (e.g., 'Dark') to an existing variable collection.",
      inputSchema: {
        collectionId: z.string().min(1),
        name: z.string().min(1),
      },
    },
    async (payload: { collectionId: string; name: string }) =>
      callPluginTool(bridge, { type: "addVariableMode", payload }),
  );

  server.registerTool(
    "figma_rename_variable_mode",
    {
      title: "Rename variable mode",
      description: "Rename an existing mode in a variable collection.",
      inputSchema: {
        collectionId: z.string().min(1),
        modeId: z.string().min(1),
        name: z.string().min(1),
      },
    },
    async (payload: { collectionId: string; modeId: string; name: string }) =>
      callPluginTool(bridge, { type: "renameVariableMode", payload }),
  );

  server.registerTool(
    "figma_create_variable",
    {
      title: "Create variable",
      description: "Create a variable in a collection (COLOR, FLOAT, STRING, BOOLEAN).",
      inputSchema: {
        collectionId: z.string().min(1),
        name: z.string().min(1),
        resolvedType: z.enum(["BOOLEAN", "COLOR", "FLOAT", "STRING"]),
        scopes: z.array(z.enum([
          "ALL_SCOPES", "TEXT_CONTENT", "CORNER_RADIUS", "WIDTH_HEIGHT", "GAP",
          "ALL_FILLS", "FRAME_FILL", "SHAPE_FILL", "TEXT_FILL",
          "STROKE_COLOR", "STROKE_FLOAT", "EFFECT_FLOAT", "EFFECT_COLOR",
          "OPACITY", "FONT_FAMILY", "FONT_STYLE", "FONT_WEIGHT",
          "FONT_SIZE", "LINE_HEIGHT", "LETTER_SPACING",
          "PARAGRAPH_SPACING", "PARAGRAPH_INDENT",
        ])).optional(),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "createVariable", payload }),
  );

  server.registerTool(
    "figma_set_variable_value_for_mode",
    {
      title: "Set variable value for mode",
      description: "Set the value of a variable for a specific mode.",
      inputSchema: {
        variableId: z.string().min(1),
        modeId: z.string().min(1),
        value: z.union([
          z.boolean(),
          z.string(),
          z.number(),
          z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() }),
        ]),
      },
    },
    async (payload: { variableId: string; modeId: string; value: boolean | string | number | { r: number; g: number; b: number; a?: number } }) =>
      callPluginTool(bridge, { type: "setVariableValueForMode", payload }),
  );

  server.registerTool(
    "figma_get_local_variables",
    {
      title: "Get local variables",
      description: "List all local variables in the current Figma file.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => asJsonText(await bridge.send({ type: "getLocalVariables" })),
  );

  server.registerTool(
    "figma_get_local_variable_collections",
    {
      title: "Get local variable collections",
      description: "List all local variable collections in the current Figma file.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => asJsonText(await bridge.send({ type: "getLocalVariableCollections" })),
  );

  server.registerTool(
    "figma_bind_variable",
    {
      title: "Bind variable to node",
      description: "Bind a variable to a node field (fill color, stroke, effect, or layout property).",
      inputSchema: {
        nodeId: z.string().min(1),
        target: z.enum(["nodeField", "fills", "strokes", "effects"]),
        index: z.number().int().min(0).optional(),
        field: z.string().min(1),
        variableId: z.string().min(1),
      },
    },
    async (payload: { nodeId: string; target: "nodeField" | "fills" | "strokes" | "effects"; index?: number; field: string; variableId: string }) =>
      callPluginTool(bridge, { type: "bindVariable", payload }),
  );

  server.registerTool(
    "figma_set_explicit_variable_mode",
    {
      title: "Set explicit variable mode",
      description: "Set the explicit variable mode on a node (e.g., switch a frame to Dark theme).",
      inputSchema: {
        nodeId: z.string().min(1),
        collectionId: z.string().min(1),
        modeId: z.string().min(1),
      },
    },
    async (payload: { nodeId: string; collectionId: string; modeId: string }) =>
      callPluginTool(bridge, { type: "setExplicitVariableMode", payload }),
  );

  server.registerTool(
    "figma_create_theme_tokens",
    {
      title: "Create theme tokens",
      description:
        "Create a complete theme variable collection with modes and tokens in one call. " +
        "Useful for quickly setting up Light/Dark design systems.",
      inputSchema: {
        collectionName: z.string().min(1),
        modes: z.array(z.string().min(1)).min(1).max(10),
        tokens: z.array(z.object({
          name: z.string().min(1),
          type: z.enum(["BOOLEAN", "COLOR", "FLOAT", "STRING"]),
          scopes: z.array(z.string()).optional(),
          values: z.record(z.string(), z.union([z.boolean(), z.string(), z.number(), z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() })])),
        })).min(1).max(200),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (payload: any) => callPluginTool(bridge, { type: "createThemeTokens", payload }, 60_000),
  );

  // --- Local Styles ---

  server.registerTool(
    "figma_get_local_styles",
    {
      title: "Get local styles",
      description:
        "Read all local Paint, Text, and Effect styles from the current Figma file. " +
        "Filter by type: 'all', 'paint', 'text', or 'effect'.",
      inputSchema: { type: z.enum(["all", "paint", "text", "effect"]).optional() },
      annotations: { readOnlyHint: true },
    },
    async (payload: any) => asJsonText(await bridge.send({ type: "getLocalStyles", payload })),
  );

  server.registerTool(
    "figma_create_paint_style",
    {
      title: "Create paint style",
      description:
        "Create or upsert a native Figma Paint Style. Visible in the right-side Styles panel. " +
        "Set upsert:true to update an existing style with the same name.",
      inputSchema: {
        name: z.string().min(1),
        description: z.string().optional(),
        paints: z.array(z.object({
          type: z.enum(["SOLID", "GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"]),
          color: z.object({ r: z.number(), g: z.number(), b: z.number() }).optional(),
          opacity: z.number().optional(),
          gradientStops: z.array(z.object({
            position: z.number(),
            color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number() }),
          })).optional(),
        })).min(1),
        upsert: z.boolean().optional(),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "createPaintStyle", payload }),
  );

  server.registerTool(
    "figma_create_text_style",
    {
      title: "Create text style",
      description:
        "Create or upsert a native Figma Text Style. Visible in the right-side Styles panel. " +
        "Font must be available in Figma. Set upsert:true to update an existing style.",
      inputSchema: {
        name: z.string().min(1),
        description: z.string().optional(),
        fontFamily: z.string().min(1),
        fontStyle: z.string().min(1),
        fontSize: z.number().positive(),
        lineHeight: z.union([z.object({ unit: z.literal("AUTO") }), z.object({ unit: z.enum(["PIXELS", "PERCENT"]), value: z.number().positive() })]).optional(),
        letterSpacing: z.object({ unit: z.enum(["PIXELS", "PERCENT"]), value: z.number() }).optional(),
        paragraphSpacing: z.number().min(0).optional(),
        paragraphIndent: z.number().min(0).optional(),
        upsert: z.boolean().optional(),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "createTextStyle", payload }, 20_000),
  );

  server.registerTool(
    "figma_create_effect_style",
    {
      title: "Create effect style",
      description:
        "Create or upsert a native Figma Effect Style. Visible in the right-side Styles panel. " +
        "Set upsert:true to update an existing style with the same name.",
      inputSchema: {
        name: z.string().min(1),
        description: z.string().optional(),
        effects: z.array(z.union([
          z.object({
            type: z.enum(["DROP_SHADOW", "INNER_SHADOW"]),
            color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number() }),
            offset: z.object({ x: z.number(), y: z.number() }),
            radius: z.number().min(0),
            visible: z.boolean().optional(),
          }),
          z.object({
            type: z.enum(["LAYER_BLUR", "BACKGROUND_BLUR"]),
            radius: z.number().min(0),
            visible: z.boolean().optional(),
          }),
        ])).min(1),
        upsert: z.boolean().optional(),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "createEffectStyle", payload }),
  );

  server.registerTool(
    "figma_update_style",
    {
      title: "Update style",
      description: "Update an existing local style by id. Specify styleType as 'paint', 'text', or 'effect'.",
      inputSchema: {
        styleId: z.string().min(1),
        styleType: z.enum(["paint", "text", "effect"]),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        paints: z.array(z.object({
          type: z.enum(["SOLID", "GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"]),
          color: z.object({ r: z.number(), g: z.number(), b: z.number() }).optional(),
          opacity: z.number().optional(),
          gradientStops: z.array(z.object({
            position: z.number(), color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number() }),
          })).optional(),
        })).optional(),
        fontFamily: z.string().min(1).optional(),
        fontStyle: z.string().min(1).optional(),
        fontSize: z.number().positive().optional(),
        lineHeight: z.union([z.object({ unit: z.literal("AUTO") }), z.object({ unit: z.enum(["PIXELS", "PERCENT"]), value: z.number().positive() })]).optional(),
        letterSpacing: z.object({ unit: z.enum(["PIXELS", "PERCENT"]), value: z.number() }).optional(),
        paragraphSpacing: z.number().min(0).optional(),
        paragraphIndent: z.number().min(0).optional(),
        effects: z.array(z.union([
          z.object({
            type: z.enum(["DROP_SHADOW", "INNER_SHADOW"]),
            color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number() }),
            offset: z.object({ x: z.number(), y: z.number() }),
            radius: z.number().min(0),
          }),
          z.object({
            type: z.enum(["LAYER_BLUR", "BACKGROUND_BLUR"]),
            radius: z.number().min(0),
          }),
        ])).optional(),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "updateStyle", payload }),
  );

  server.registerTool(
    "figma_delete_style",
    {
      title: "Delete style",
      description:
        "Delete a local style by id. Specify styleType as 'paint', 'text', or 'effect'. " +
        "Does not delete remote library styles.",
      inputSchema: {
        styleId: z.string().min(1),
        styleType: z.enum(["paint", "text", "effect"]),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "deleteStyle", payload }),
  );

  server.registerTool(
    "figma_bind_style",
    {
      title: "Bind style to node",
      description:
        "Bind a local style to a node. target: 'fill', 'stroke', 'text', or 'effect'. " +
        "Node must support the target type.",
      inputSchema: {
        nodeId: z.string().min(1),
        styleId: z.string().min(1),
        target: z.enum(["fill", "stroke", "text", "effect"]),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "bindStyle", payload }),
  );

  server.registerTool(
    "figma_create_design_system_styles",
    {
      title: "Create design system styles",
      description:
        "Batch create or upsert a full set of Paint, Text, and Effect styles in one call. " +
        "Per-item failure does not block other items. Returns summary with created/updated/skipped/failed counts.",
      inputSchema: {
        upsert: z.boolean().optional(),
        paintStyles: z.array(z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          paints: z.array(z.object({
            type: z.enum(["SOLID", "GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"]),
            color: z.object({ r: z.number(), g: z.number(), b: z.number() }).optional(),
            opacity: z.number().optional(),
            gradientStops: z.array(z.object({
              position: z.number(), color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number() }),
            })).optional(),
          })).min(1),
        })).optional(),
        textStyles: z.array(z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          fontFamily: z.string().min(1),
          fontStyle: z.string().min(1),
          fontSize: z.number().positive(),
          lineHeight: z.union([z.object({ unit: z.literal("AUTO") }), z.object({ unit: z.enum(["PIXELS", "PERCENT"]), value: z.number().positive() })]).optional(),
          letterSpacing: z.object({ unit: z.enum(["PIXELS", "PERCENT"]), value: z.number() }).optional(),
          paragraphSpacing: z.number().min(0).optional(),
          paragraphIndent: z.number().min(0).optional(),
        })).optional(),
        effectStyles: z.array(z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          effects: z.array(z.union([
            z.object({
              type: z.enum(["DROP_SHADOW", "INNER_SHADOW"]),
              color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number() }),
              offset: z.object({ x: z.number(), y: z.number() }),
              radius: z.number().min(0),
              visible: z.boolean().optional(),
            }),
            z.object({
              type: z.enum(["LAYER_BLUR", "BACKGROUND_BLUR"]),
              radius: z.number().min(0),
              visible: z.boolean().optional(),
            }),
          ])).min(1),
        })).optional(),
      },
    },
    async (payload: any) => callPluginTool(bridge, { type: "createDesignSystemStyles", payload }, 60_000),
  );

  server.registerTool(
    "figma_audit_styles",
    {
      title: "Audit local styles",
      description:
        "Audit the local style inventory. Detect duplicates by name. " +
        "Optionally check that expected style names exist (paintStyles, textStyles, effectStyles arrays).",
      inputSchema: {
        prefix: z.string().optional(),
        expected: z.object({
          paintStyles: z.array(z.string()).optional(),
          textStyles: z.array(z.string()).optional(),
          effectStyles: z.array(z.string()).optional(),
        }).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (payload: any) => asJsonText(await bridge.send({ type: "auditStyles", payload })),
  );

  server.registerTool(
    "figma_audit_node_style_binding",
    {
      title: "Audit node style binding",
      description:
        "Walk a node tree and report which nodes have style bindings (fillStyleId, textStyleId, etc.) " +
        "and which styled nodes are NOT bound to a Local Style.",
      inputSchema: {
        nodeId: z.string().min(1),
        depth: z.number().int().min(0).max(20).optional(),
        expectedPrefix: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (payload: any) => asJsonText(await bridge.send({ type: "auditNodeStyleBinding", payload })),
  );

  const imageRectSchema = z.object({
    name: z.string().min(1).optional(),
    parentId: parentIdSchema,
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    imageUrl: z.string().url(),
    scaleMode: z.enum(["FILL", "FIT", "CROP", "TILE"]).optional(),
    cornerRadius: z.number().min(0).optional(),
  });
  server.registerTool(
    "figma_create_image_rectangle",
    {
      title: "Create image rectangle",
      description: "Create a rectangle with an image fill from an explicit URL. Rolls back on failure.",
      inputSchema: imageRectSchema.shape,
    },
    async (payload: z.infer<typeof imageRectSchema>) => callPluginTool(bridge, { type: "createImageRectangle", payload }, 30_000),
  );

  server.registerTool(
    "figma_update_image_fill",
    {
      title: "Update image fill",
      description: "Apply an image fill from an explicit URL to an existing node.",
      inputSchema: {
        nodeId: z.string().min(1),
        imageUrl: z.string().url(),
        scaleMode: z.enum(["FILL", "FIT", "CROP", "TILE"]).optional(),
      },
    },
    async (payload: { nodeId: string; imageUrl: string; scaleMode?: "FILL" | "FIT" | "CROP" | "TILE" }) =>
      callPluginTool(bridge, { type: "updateImageFill", payload }, 30_000),
  );

  const createPageFramesSchema = z.object({
    parentId: z.string().min(1),
    frames: z.array(pageFrameSchema).min(1).max(50),
  });
  server.registerTool(
    "figma_create_page_frames",
    {
      title: "Create multiple page frames",
      description: "Create multiple top-level or nested frames under a Figma Page or Frame parent.",
      inputSchema: createPageFramesSchema.shape,
    },
    async (payload: z.infer<typeof createPageFramesSchema>) => callPluginTool(bridge, { type: "createPageFrames", payload }, 30_000),
  );

  const createPageFromTemplateSchema = z.object({
    parentId: z.string().min(1),
    template: pageTemplateSchema,
    pages: z.array(z.string().min(1)).min(1).max(30),
    startX: z.number().optional(),
    startY: z.number().optional(),
    gap: z.number().min(0).optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    fills: z.array(paintSchema).optional(),
  });
  server.registerTool(
    "figma_create_page_from_template",
    {
      title: "Create page frames from template",
      description: "Create a batch of website page frames from a named layout template.",
      inputSchema: createPageFromTemplateSchema.shape,
    },
    async (payload: z.infer<typeof createPageFromTemplateSchema>) => callPluginTool(bridge, { type: "createPageFromTemplate", payload }, 30_000),
  );
  server.registerTool(
    "figma_update_node",
    {
      title: "Update Figma node",
      description: "Update a constrained set of properties on a node through the companion plugin.",
      inputSchema: {
        nodeId: z.string().min(1),
        patch: nodePatchSchema,
      },
    },
    async (args: { nodeId: string; patch: z.infer<typeof nodePatchSchema> }) => callPluginTool(bridge, { type: "updateNode", payload: args }),
  );

  server.registerTool(
    "figma_delete_node",
    {
      title: "Delete Figma node",
      description: "Delete a node through the companion plugin.",
      inputSchema: { nodeId: z.string().min(1) },
    },
    async (payload: { nodeId: string }) => callPluginTool(bridge, { type: "deleteNode", payload }),
  );

  // --- Batch create ---

  server.registerTool(
    "figma_batch_create_nodes",
    {
      title: "Batch create Figma nodes",
      description:
        "Create multiple Figma nodes in a single transaction. " +
        "Nodes are created in order with tempId-to-real-id mapping. " +
        "Use rollbackOnError (default true) to remove all created nodes on any failure. " +
        "Use validateOnly to check the payload without modifying the canvas. " +
        "Supports parentTempId for parent-child relationships within the batch. " +
        "Max 500 nodes per batch. Returns idMap for subsequent operations.",
      inputSchema: {
        nodes: z.array(z.object({
          tempId: z.string().min(1),
          type: z.enum([
            "FRAME", "AUTO_LAYOUT_FRAME", "RECTANGLE", "TEXT",
            "ELLIPSE", "LINE", "POLYGON", "STAR", "VECTOR",
            "COMPONENT", "INSTANCE", "IMAGE_RECTANGLE",
          ]),
          parentTempId: z.string().min(1).optional(),
          parentId: z.string().min(1).optional(),
          props: z.record(z.string(), z.unknown()),
        })).min(1).max(500),
        rollbackOnError: z.boolean().optional(),
        validateOnly: z.boolean().optional(),
        selectCreated: z.boolean().optional(),
        scrollIntoView: z.boolean().optional(),
      },
    },
    async (payload: {
      nodes: { tempId: string; type: "FRAME" | "AUTO_LAYOUT_FRAME" | "RECTANGLE" | "TEXT" | "ELLIPSE" | "LINE" | "POLYGON" | "STAR" | "VECTOR" | "COMPONENT" | "INSTANCE" | "IMAGE_RECTANGLE"; parentTempId?: string; parentId?: string; props: Record<string, unknown> }[];
      rollbackOnError?: boolean;
      validateOnly?: boolean;
      selectCreated?: boolean;
      scrollIntoView?: boolean;
    }) => callPluginTool(bridge, { type: "batchCreateNodes", payload }, 60_000),
  );

  server.registerTool(
    "figma_select_node",
    {
      title: "Select Figma node",
      description: "Select a node in Figma through the companion plugin.",
      inputSchema: { nodeId: z.string().min(1) },
    },
    async (payload: { nodeId: string }) => callPluginTool(bridge, { type: "selectNode", payload }),
  );
}
