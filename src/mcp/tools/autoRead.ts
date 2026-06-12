import { z } from "zod";

import { FigmaRestClient } from "../../figma/rest.js";
import { parseFigmaUrl } from "../../figma/url.js";
import { PluginBridge } from "../../pluginBridge.js";
import { autoReadContextSchema, autoReadNodeSchema } from "../../schemas.js";

function asJsonText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

type ReadIntent =
  | "comments"
  | "versions"
  | "images"
  | "selection"
  | "currentPage"
  | "currentFile"
  | "node"
  | "file"
  | "context";

interface AutoArgs {
  fileKey?: string;
  figmaUrl?: string;
  nodeId?: string;
  scope?: string;
}

/**
 * Choose REST or plugin as the read source using the default strategy.
 *
 * - Explicit fileKey or figmaUrl -> REST (except explicit plugin intents)
 * - Comments, versions, images -> REST
 * - Selection, currentPage, currentFile -> Plugin
 * - nodeId without fileKey and plugin connected -> Plugin
 * - No FIGMA_TOKEN and plugin connected -> Plugin
 * - Otherwise -> REST
 */
function chooseReadSource(
  args: AutoArgs,
  intent: ReadIntent,
  bridge: PluginBridge,
  hasFigmaToken: boolean,
): "rest" | "plugin" {
  // Explicit plugin-scoped intents always use plugin
  if (intent === "selection" || intent === "currentPage" || intent === "currentFile") {
    return "plugin";
  }

  // Explicit REST-scoped intents always use REST
  if (intent === "comments" || intent === "versions" || intent === "images") {
    return "rest";
  }

  // If fileKey or figmaUrl is explicitly provided, use REST
  if (args.fileKey || args.figmaUrl) {
    return "rest";
  }

  // With no remote file target, prefer the currently open Figma file when
  // the companion plugin is connected.
  if (bridge.isConnected()) {
    return "plugin";
  }

  // If no FIGMA_TOKEN but plugin is connected, use plugin
  if (!hasFigmaToken && bridge.isConnected()) {
    return "plugin";
  }

  // Default to REST
  return "rest";
}

/**
 * Resolve fileKey from args - either directly or by parsing a Figma URL.
 */
function resolveFileKey(args: AutoArgs): string | undefined {
  if (args.fileKey) return args.fileKey;
  if (args.figmaUrl) return parseFigmaUrl(args.figmaUrl).fileKey;
  return undefined;
}

/**
 * Resolve nodeId from args - either directly or by parsing a Figma URL.
 */
function resolveNodeId(args: AutoArgs): string | undefined {
  if (args.nodeId) return args.nodeId;
  if (args.figmaUrl) return parseFigmaUrl(args.figmaUrl).nodeId;
  return undefined;
}

/**
 * Register automatic read tools that choose REST or plugin based on context.
 */
export function registerAutoReadTools(
  server: { registerTool: Function },
  figma: FigmaRestClient,
  bridge: PluginBridge,
) {
  const hasFigmaToken = Boolean(process.env["FIGMA_TOKEN"]?.trim());

  function pluginReadPayload(args: {
    depth?: number;
    includeInvisible?: boolean;
    maxChildren?: number;
    maxTextLength?: number;
    compact?: boolean;
  }) {
    return {
      depth: args.depth,
      includeInvisible: args.includeInvisible,
      maxChildren: args.maxChildren,
      maxTextLength: args.maxTextLength,
      compact: args.compact ?? true,
    };
  }

  server.registerTool(
    "figma_read_context",
    {
      title: "Read Figma context (auto)",
      description:
        "Read Figma design context, automatically choosing REST API or companion plugin. " +
        "Provide fileKey/figmaUrl for REST-backed reads (requires FIGMA_TOKEN). " +
        "Omit fileKey/figmaUrl to read from the currently open file via the plugin " +
        "(requires the companion Figma plugin to be open and connected). " +
        "Use scope to narrow: 'file', 'currentFile', 'currentPage', or 'selection'.",
      inputSchema: autoReadContextSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (args: z.infer<typeof autoReadContextSchema>) => {
      const intent: ReadIntent = args.scope === "selection"
        ? "selection"
        : args.scope === "currentPage"
        ? "currentPage"
        : args.scope === "currentFile"
        ? "currentFile"
        : "context";

      const source = chooseReadSource(args, intent, bridge, hasFigmaToken);

      if (source === "rest") {
        const fileKey = resolveFileKey(args);
        if (!fileKey) {
          throw new Error(
            "REST read requires fileKey or figmaUrl. Provide one of these, or connect the " +
            "companion Figma plugin to read from the currently open file.",
          );
        }
        if (!hasFigmaToken) {
          throw new Error(
            "REST read requires FIGMA_TOKEN. Set it in .env, or connect the companion " +
            "Figma plugin to read from the currently open file.",
          );
        }

        const data = await figma.getFile(fileKey, {
          depth: args.depth,
        });

        return asJsonText({ source: "rest", data });
      }

      // Plugin path
      if (!bridge.isConnected()) {
        throw new Error(
          "Plugin read requires the companion Figma plugin to be open and connected. " +
          "Open the Figma plugin and confirm it shows 'Connected', or provide a fileKey " +
          "with a configured FIGMA_TOKEN for REST reads.",
        );
      }

      let data: unknown;
      switch (args.scope) {
        case "selection":
          data = await bridge.send({ type: "getSelection" });
          break;
        case "currentPage":
          data = await bridge.send({
            type: "getCurrentPage",
            payload: pluginReadPayload(args),
          });
          break;
        case "currentFile":
        case "file":
          data = await bridge.send({ type: "getCurrentFileSummary" });
          break;
        default:
          // Default: get current page tree for a quick overview
          data = await bridge.send({
            type: "getPageTree",
            payload: pluginReadPayload({
              depth: args.depth ?? 1,
              includeInvisible: args.includeInvisible,
              maxChildren: args.maxChildren,
              maxTextLength: args.maxTextLength,
              compact: args.compact,
            }),
          });
      }

      return asJsonText({ source: "plugin", data });
    },
  );

  server.registerTool(
    "figma_read_node",
    {
      title: "Read Figma node (auto)",
      description:
        "Read a specific Figma node, automatically choosing REST API or companion plugin. " +
        "Provide fileKey/figmaUrl for REST-backed reads (requires FIGMA_TOKEN). " +
        "Provide only nodeId to read from the currently open file via the plugin " +
        "(requires the companion Figma plugin to be open and connected).",
      inputSchema: autoReadNodeSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (args: z.infer<typeof autoReadNodeSchema>) => {
      const intent: ReadIntent = "node";
      const source = chooseReadSource(args, intent, bridge, hasFigmaToken);

      if (source === "rest") {
        const fileKey = resolveFileKey(args);
        if (!fileKey) {
          throw new Error(
            "REST read requires fileKey or figmaUrl. Provide one of these, or connect the " +
            "companion Figma plugin to read from the currently open file.",
          );
        }
        if (!hasFigmaToken) {
          throw new Error(
            "REST read requires FIGMA_TOKEN. Set it in .env, or connect the companion " +
            "Figma plugin to read from the currently open file.",
          );
        }

        const nodeId = resolveNodeId(args);
        if (!nodeId) {
          throw new Error(
            "nodeId is required for REST node reads. Provide nodeId directly or a figmaUrl with node-id.",
          );
        }

        const data = await figma.getNode(fileKey, nodeId, {
          depth: args.depth,
          geometry: args.geometry,
        });
        return asJsonText({ source: "rest", data });
      }

      // Plugin path
      if (!bridge.isConnected()) {
        throw new Error(
          "Plugin read requires the companion Figma plugin to be open and connected. " +
          "Open the Figma plugin and confirm it shows 'Connected', or provide a fileKey " +
          "with a configured FIGMA_TOKEN for REST reads.",
        );
      }

      const nodeId = resolveNodeId(args);
      if (!nodeId) {
        throw new Error(
          "nodeId is required for plugin reads. Provide nodeId directly or via figmaUrl.",
        );
      }

      const data = await bridge.send({
        type: args.depth !== undefined ? "getNodeTree" : "getNode",
        payload: Object.assign(pluginReadPayload(args), { nodeId }),
      });

      return asJsonText({ source: "plugin", data });
    },
  );
}
