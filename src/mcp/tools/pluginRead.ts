import { z } from "zod";

import { PluginBridge } from "../../pluginBridge.js";
import { pluginNodeReadSchema, pluginPageTreeReadSchema } from "../../schemas.js";

function asJsonText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

/**
 * Register plugin-backed read tools.
 *
 * These tools read from the currently open Figma file through the
 * companion plugin. They require the plugin to be open and connected.
 */
export function registerPluginReadTools(server: { registerTool: Function }, bridge: PluginBridge) {
  type PluginReadArgs = {
    depth?: number;
    includeInvisible?: boolean;
    maxChildren?: number;
    maxTextLength?: number;
    compact?: boolean;
  };

  function readPayload(args: PluginReadArgs) {
    return {
      depth: args.depth,
      includeInvisible: args.includeInvisible,
      maxChildren: args.maxChildren,
      maxTextLength: args.maxTextLength,
      compact: args.compact,
    };
  }

  server.registerTool(
    "figma_plugin_get_current_file_summary",
    {
      title: "Get current Figma file summary (plugin)",
      description:
        "Read a summary of the currently open Figma file through the companion plugin. " +
        "Includes file name, current page name, and selection count. " +
        "Requires the companion Figma plugin to be open and connected.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => asJsonText(await bridge.send({ type: "getCurrentFileSummary" })),
  );

  server.registerTool(
    "figma_plugin_get_current_page",
    {
      title: "Get current Figma page (plugin)",
      description:
        "Read the current Figma page through the companion plugin. " +
        "Returns a compact flat node list by default. Use depth, maxChildren, maxTextLength, and compact to control output size. " +
        "Requires the companion Figma plugin to be open and connected.",
      inputSchema: pluginPageTreeReadSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (args: PluginReadArgs) =>
      asJsonText(
        await bridge.send({
          type: "getCurrentPage",
          payload: readPayload(args),
        }),
      ),
  );

  server.registerTool(
    "figma_plugin_get_page_tree",
    {
      title: "Get Figma page tree (plugin)",
      description:
        "Read the page-level children of the current Figma page as a tree with depth-limited traversal. " +
        "Use depth 1-2 with maxChildren for a usable overview without unbounded output. " +
        "Requires the companion Figma plugin to be open and connected.",
      inputSchema: pluginPageTreeReadSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (args: PluginReadArgs) =>
      asJsonText(
        await bridge.send({
          type: "getPageTree",
          payload: readPayload(args),
        }),
      ),
  );

  server.registerTool(
    "figma_plugin_get_node",
    {
      title: "Get Figma node (plugin)",
      description:
        "Read a single Figma node from the currently open file through the companion plugin. " +
        "Depth 0 returns only the node itself. Use compact output by default for Codex-friendly context. " +
        "Requires the companion Figma plugin to be open and connected.",
      inputSchema: pluginNodeReadSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (args: { nodeId: string } & PluginReadArgs) =>
      asJsonText(
        await bridge.send({
          type: "getNode",
          payload: Object.assign(readPayload(args), {
            nodeId: args.nodeId,
          }),
        }),
      ),
  );

  server.registerTool(
    "figma_plugin_get_node_tree",
    {
      title: "Get Figma node tree (plugin)",
      description:
        "Read a Figma node and its children as a depth-limited tree through the companion plugin. " +
        "Default depth is 2, with maxChildren and compact controls to avoid unbounded payloads. " +
        "Requires the companion Figma plugin to be open and connected.",
      inputSchema: pluginNodeReadSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (args: { nodeId: string } & PluginReadArgs) =>
      asJsonText(
        await bridge.send({
          type: "getNodeTree",
          payload: Object.assign(readPayload(args), {
            nodeId: args.nodeId,
          }),
        }),
      ),
  );

  // Plugin-backed selection read (also keep alias in write module for backward compat)
  server.registerTool(
    "figma_plugin_get_selection",
    {
      title: "Get Figma selection (plugin)",
      description:
        "Read the current selection from the connected Figma plugin. " +
        "Returns a flat list of selected nodes with basic properties. " +
        "Requires the companion Figma plugin to be open and connected.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => asJsonText(await bridge.send({ type: "getSelection" })),
  );

  // Component properties & variables read tools
  server.registerTool(
    "figma_plugin_get_component_properties",
    {
      title: "Get component properties (plugin)",
      description:
        "Read component property definitions for a component or component set " +
        "from the currently open Figma file through the companion plugin. " +
        "Requires the companion Figma plugin to be open and connected.",
      inputSchema: { componentId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async (args: { componentId: string }) =>
      asJsonText(await bridge.send({ type: "getComponentProperties", payload: args })),
  );

  server.registerTool(
    "figma_plugin_get_local_variables",
    {
      title: "Get local variables (plugin)",
      description:
        "List all local variables in the currently open Figma file through the companion plugin. " +
        "Requires the companion Figma plugin to be open and connected.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => asJsonText(await bridge.send({ type: "getLocalVariables" })),
  );

  server.registerTool(
    "figma_plugin_get_node_bindings",
    {
      title: "Get node bindings (plugin)",
      description:
        "Read variable bindings, explicit variable modes, component properties, " +
        "and variant properties for a specific node through the companion plugin. " +
        "Returns a focused summary useful for design system auditing. " +
        "Requires the companion Figma plugin to be open and connected.",
      inputSchema: { nodeId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async (args: { nodeId: string }) =>
      asJsonText(
        await bridge.send({
          type: "getNodeTree",
          payload: { nodeId: args.nodeId, depth: 0, compact: true },
        }),
      ),
  );
}
