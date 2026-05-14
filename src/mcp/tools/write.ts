import { z } from "zod";

import { PluginBridge } from "../../pluginBridge.js";
import { nodePatchSchema, paintSchema, parentIdSchema } from "../../schemas.js";

function asJsonText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

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
      inputSchema: {
        name: z.string().min(1).optional(),
        parentId: parentIdSchema,
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
        fills: z.array(paintSchema).optional(),
      },
    },
    async (payload: { name?: string; parentId?: string; x: number; y: number; width: number; height: number; fills?: z.infer<typeof paintSchema>[] }) =>
      asJsonText(await bridge.send({ type: "createFrame", payload })),
  );

  server.registerTool(
    "figma_create_rectangle",
    {
      title: "Create Figma rectangle",
      description: "Create a rectangle on the current Figma page through the companion plugin.",
      inputSchema: {
        name: z.string().min(1).optional(),
        parentId: parentIdSchema,
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
        fills: z.array(paintSchema).optional(),
        cornerRadius: z.number().min(0).optional(),
      },
    },
    async (payload: { name?: string; parentId?: string; x: number; y: number; width: number; height: number; fills?: z.infer<typeof paintSchema>[]; cornerRadius?: number }) =>
      asJsonText(await bridge.send({ type: "createRectangle", payload })),
  );

  server.registerTool(
    "figma_create_text",
    {
      title: "Create Figma text",
      description: "Create a text node on the current Figma page through the companion plugin.",
      inputSchema: {
        name: z.string().min(1).optional(),
        parentId: parentIdSchema,
        text: z.string(),
        x: z.number(),
        y: z.number(),
        fontSize: z.number().positive().optional(),
        fontFamily: z.string().min(1).optional(),
        fontStyle: z.string().min(1).optional(),
        fills: z.array(paintSchema).optional(),
      },
    },
    async (payload: { name?: string; parentId?: string; text: string; x: number; y: number; fontSize?: number; fontFamily?: string; fontStyle?: string; fills?: z.infer<typeof paintSchema>[] }) =>
      asJsonText(await bridge.send({ type: "createText", payload })),
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
    async (args: { nodeId: string; patch: z.infer<typeof nodePatchSchema> }) =>
      asJsonText(await bridge.send({ type: "updateNode", payload: args })),
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
