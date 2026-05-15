import { z } from "zod";

import { PluginBridge } from "../../pluginBridge.js";
import {
  autoLayoutSchema,
  baseCreateSchema,
  nodePatchSchema,
  paintSchema,
  parentIdSchema,
  textStyleSchema,
  vectorPathSchema,
  visualStyleSchema,
} from "../../schemas.js";

function asJsonText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
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
      description: "Report whether the companion Figma plugin is connected.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => asJsonText(bridge.getStatus()),
  );

  server.registerTool(
    "figma_get_selection",
    {
      title: "Get Figma selection",
      description: "Read the current selection through the connected Figma plugin.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => asJsonText(await bridge.send({ type: "getSelection" })),
  );

  server.registerTool(
    "figma_create_frame",
    {
      title: "Create Figma frame",
      description: "Create a frame on the current Figma page through the companion plugin.",
      inputSchema: baseCreateSchema.shape,
    },
    async (payload: z.infer<typeof baseCreateSchema>) => asJsonText(await bridge.send({ type: "createFrame", payload })),
  );

  server.registerTool(
    "figma_create_rectangle",
    {
      title: "Create Figma rectangle",
      description: "Create a rectangle on the current Figma page through the companion plugin.",
      inputSchema: baseCreateSchema.shape,
    },
    async (payload: z.infer<typeof baseCreateSchema>) => asJsonText(await bridge.send({ type: "createRectangle", payload })),
  );

  server.registerTool(
    "figma_create_text",
    {
      title: "Create Figma text",
      description: "Create a text node on the current Figma page through the companion plugin.",
      inputSchema: positionedTextSchema.shape,
    },
    async (payload: z.infer<typeof positionedTextSchema>) => asJsonText(await bridge.send({ type: "createText", payload })),
  );

  const autoLayoutCreateSchema = baseCreateSchema.merge(autoLayoutSchema);
  server.registerTool(
    "figma_create_auto_layout_frame",
    {
      title: "Create auto-layout frame",
      description: "Create a frame with Figma auto layout properties.",
      inputSchema: autoLayoutCreateSchema.shape,
    },
    async (payload: z.infer<typeof autoLayoutCreateSchema>) => asJsonText(await bridge.send({ type: "createAutoLayoutFrame", payload })),
  );

  server.registerTool(
    "figma_update_auto_layout",
    {
      title: "Update auto layout",
      description: "Apply or update auto layout properties on an existing frame.",
      inputSchema: z.object({ nodeId: z.string().min(1) }).merge(autoLayoutSchema).shape,
    },
    async (payload: { nodeId: string } & z.infer<typeof autoLayoutSchema>) => asJsonText(await bridge.send({ type: "updateAutoLayout", payload })),
  );

  server.registerTool(
    "figma_create_ellipse",
    {
      title: "Create Figma ellipse",
      description: "Create an ellipse on the current Figma page through the companion plugin.",
      inputSchema: baseCreateSchema.shape,
    },
    async (payload: z.infer<typeof baseCreateSchema>) => asJsonText(await bridge.send({ type: "createEllipse", payload })),
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
      description: "Create a line on the current Figma page through the companion plugin.",
      inputSchema: lineSchema.shape,
    },
    async (payload: z.infer<typeof lineSchema>) => asJsonText(await bridge.send({ type: "createLine", payload })),
  );

  const polygonSchema = baseCreateSchema.extend({ pointCount: z.number().int().min(3).max(60) });
  server.registerTool(
    "figma_create_polygon",
    {
      title: "Create Figma polygon",
      description: "Create a polygon on the current Figma page through the companion plugin.",
      inputSchema: polygonSchema.shape,
    },
    async (payload: z.infer<typeof polygonSchema>) => asJsonText(await bridge.send({ type: "createPolygon", payload })),
  );

  const starSchema = baseCreateSchema.extend({
    pointCount: z.number().int().min(3).max(60).optional(),
    innerRadius: z.number().min(0).max(1).optional(),
  });
  server.registerTool(
    "figma_create_star",
    {
      title: "Create Figma star",
      description: "Create a star on the current Figma page through the companion plugin.",
      inputSchema: starSchema.shape,
    },
    async (payload: z.infer<typeof starSchema>) => asJsonText(await bridge.send({ type: "createStar", payload })),
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
      description: "Create a vector node from path data through the companion plugin.",
      inputSchema: vectorSchema.shape,
    },
    async (payload: z.infer<typeof vectorSchema>) => asJsonText(await bridge.send({ type: "createVector", payload })),
  );

  server.registerTool(
    "figma_create_component",
    {
      title: "Create Figma component",
      description: "Create a reusable Figma component.",
      inputSchema: autoLayoutCreateSchema.shape,
    },
    async (payload: z.infer<typeof autoLayoutCreateSchema>) => asJsonText(await bridge.send({ type: "createComponent", payload })),
  );

  server.registerTool(
    "figma_create_component_from_node",
    {
      title: "Create component from node",
      description: "Convert an existing node into a Figma component where supported.",
      inputSchema: { nodeId: z.string().min(1), name: z.string().min(1).optional() },
    },
    async (payload: { nodeId: string; name?: string }) => asJsonText(await bridge.send({ type: "createComponentFromNode", payload })),
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
    async (payload: { componentId: string; name?: string; parentId?: string; x: number; y: number }) => asJsonText(await bridge.send({ type: "createInstance", payload })),
  );

  server.registerTool(
    "figma_detach_instance",
    {
      title: "Detach component instance",
      description: "Detach a component instance into normal Figma nodes.",
      inputSchema: { nodeId: z.string().min(1) },
    },
    async (payload: { nodeId: string }) => asJsonText(await bridge.send({ type: "detachInstance", payload })),
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
      description: "Create a rectangle with an image fill from an explicit URL.",
      inputSchema: imageRectSchema.shape,
    },
    async (payload: z.infer<typeof imageRectSchema>) => asJsonText(await bridge.send({ type: "createImageRectangle", payload }, 30_000)),
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
      asJsonText(await bridge.send({ type: "updateImageFill", payload }, 30_000)),
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
    async (args: { nodeId: string; patch: z.infer<typeof nodePatchSchema> }) => asJsonText(await bridge.send({ type: "updateNode", payload: args })),
  );

  server.registerTool(
    "figma_delete_node",
    {
      title: "Delete Figma node",
      description: "Delete a node through the companion plugin.",
      inputSchema: { nodeId: z.string().min(1) },
    },
    async (payload: { nodeId: string }) => asJsonText(await bridge.send({ type: "deleteNode", payload })),
  );

  server.registerTool(
    "figma_select_node",
    {
      title: "Select Figma node",
      description: "Select a node in Figma through the companion plugin.",
      inputSchema: { nodeId: z.string().min(1) },
    },
    async (payload: { nodeId: string }) => asJsonText(await bridge.send({ type: "selectNode", payload })),
  );
}
