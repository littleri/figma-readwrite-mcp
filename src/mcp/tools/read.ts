import { z } from "zod";

import { FigmaRestClient } from "../../figma/rest.js";

function asJsonText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

/**
 * Register REST-backed read tools.
 *
 * Provides both prefixed names (figma_rest_*) and compatibility aliases
 * (figma_get_*) that are documented as REST-backed.
 */
export function registerReadTools(server: { registerTool: Function }, figma: FigmaRestClient) {
  const fileSchema = {
    fileKey: z.string().min(1),
    depth: z.number().int().positive().optional(),
    geometry: z.enum(["paths"]).optional(),
    version: z.string().optional(),
  };

  const nodeSchema = {
    fileKey: z.string().min(1),
    nodeId: z.string().min(1),
    depth: z.number().int().positive().optional(),
    geometry: z.enum(["paths"]).optional(),
  };

  const imagesSchema = {
    fileKey: z.string().min(1),
    nodeIds: z.array(z.string().min(1)).min(1),
    format: z.enum(["jpg", "png", "svg", "pdf"]).optional(),
    scale: z.number().positive().max(4).optional(),
  };

  const commentsSchema = { fileKey: z.string().min(1) };
  const versionsSchema = { fileKey: z.string().min(1) };

  // --- figma_rest_get_file ---
  const getFileHandler = async (args: { fileKey: string; depth?: number; geometry?: "paths"; version?: string }) =>
    asJsonText(await figma.getFile(args.fileKey, args));

  server.registerTool(
    "figma_rest_get_file",
    {
      title: "Get Figma file (REST)",
      description: "Read a Figma file through the Figma REST API. Requires FIGMA_TOKEN.",
      inputSchema: fileSchema,
      annotations: { readOnlyHint: true },
    },
    getFileHandler,
  );

  // Compatibility alias
  server.registerTool(
    "figma_get_file",
    {
      title: "Get Figma file (REST compatibility alias)",
      description: "Read a Figma file through the Figma REST API. Alias of figma_rest_get_file. Requires FIGMA_TOKEN.",
      inputSchema: fileSchema,
      annotations: { readOnlyHint: true },
    },
    getFileHandler,
  );

  // --- figma_rest_get_node ---
  const getNodeHandler = async (args: { fileKey: string; nodeId: string; depth?: number; geometry?: "paths" }) =>
    asJsonText(await figma.getNode(args.fileKey, args.nodeId, args));

  server.registerTool(
    "figma_rest_get_node",
    {
      title: "Get Figma node (REST)",
      description: "Read a single Figma node through the Figma REST API. Requires FIGMA_TOKEN.",
      inputSchema: nodeSchema,
      annotations: { readOnlyHint: true },
    },
    getNodeHandler,
  );

  // Compatibility alias
  server.registerTool(
    "figma_get_node",
    {
      title: "Get Figma node (REST compatibility alias)",
      description: "Read a single Figma node through the Figma REST API. Alias of figma_rest_get_node. Requires FIGMA_TOKEN.",
      inputSchema: nodeSchema,
      annotations: { readOnlyHint: true },
    },
    getNodeHandler,
  );

  // --- figma_rest_get_images ---
  const getImagesHandler = async (args: { fileKey: string; nodeIds: string[]; format?: string; scale?: number }) =>
    asJsonText(await figma.getImages(args.fileKey, args.nodeIds, args));

  server.registerTool(
    "figma_rest_get_images",
    {
      title: "Get Figma images (REST)",
      description: "Export image URLs for one or more Figma nodes through the Figma REST API. Requires FIGMA_TOKEN.",
      inputSchema: imagesSchema,
      annotations: { readOnlyHint: true },
    },
    getImagesHandler,
  );

  // Compatibility alias
  server.registerTool(
    "figma_get_images",
    {
      title: "Get Figma images (REST compatibility alias)",
      description: "Export image URLs for one or more Figma nodes. Alias of figma_rest_get_images. Requires FIGMA_TOKEN.",
      inputSchema: imagesSchema,
      annotations: { readOnlyHint: true },
    },
    getImagesHandler,
  );

  // --- figma_rest_get_comments ---
  const getCommentsHandler = async (args: { fileKey: string }) =>
    asJsonText(await figma.getComments(args.fileKey));

  server.registerTool(
    "figma_rest_get_comments",
    {
      title: "Get Figma comments (REST)",
      description: "Read comments for a Figma file through the Figma REST API. Requires FIGMA_TOKEN.",
      inputSchema: commentsSchema,
      annotations: { readOnlyHint: true },
    },
    getCommentsHandler,
  );

  // Compatibility alias
  server.registerTool(
    "figma_get_comments",
    {
      title: "Get Figma comments (REST compatibility alias)",
      description: "Read comments for a Figma file. Alias of figma_rest_get_comments. Requires FIGMA_TOKEN.",
      inputSchema: commentsSchema,
      annotations: { readOnlyHint: true },
    },
    getCommentsHandler,
  );

  // --- figma_rest_get_versions ---
  const getVersionsHandler = async (args: { fileKey: string }) =>
    asJsonText(await figma.getVersions(args.fileKey));

  server.registerTool(
    "figma_rest_get_versions",
    {
      title: "Get Figma versions (REST)",
      description: "Read version history for a Figma file through the Figma REST API. Requires FIGMA_TOKEN.",
      inputSchema: versionsSchema,
      annotations: { readOnlyHint: true },
    },
    getVersionsHandler,
  );

  // Compatibility alias
  server.registerTool(
    "figma_get_versions",
    {
      title: "Get Figma versions (REST compatibility alias)",
      description: "Read version history for a Figma file. Alias of figma_rest_get_versions. Requires FIGMA_TOKEN.",
      inputSchema: versionsSchema,
      annotations: { readOnlyHint: true },
    },
    getVersionsHandler,
  );
}
