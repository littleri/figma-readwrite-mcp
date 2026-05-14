import { z } from "zod";

import { FigmaRestClient } from "../../figma/rest.js";

function asJsonText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

export function registerReadTools(server: { registerTool: Function }, figma: FigmaRestClient) {
  server.registerTool(
    "figma_get_file",
    {
      title: "Get Figma file",
      description: "Read a Figma file through the Figma REST API.",
      inputSchema: {
        fileKey: z.string().min(1),
        depth: z.number().int().positive().optional(),
        geometry: z.enum(["paths"]).optional(),
        version: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args: { fileKey: string; depth?: number; geometry?: "paths"; version?: string }) => {
      return asJsonText(await figma.getFile(args.fileKey, args));
    },
  );

  server.registerTool(
    "figma_get_node",
    {
      title: "Get Figma node",
      description: "Read a single Figma node through the Figma REST API.",
      inputSchema: {
        fileKey: z.string().min(1),
        nodeId: z.string().min(1),
        depth: z.number().int().positive().optional(),
        geometry: z.enum(["paths"]).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args: { fileKey: string; nodeId: string; depth?: number; geometry?: "paths" }) => {
      return asJsonText(await figma.getNode(args.fileKey, args.nodeId, args));
    },
  );

  server.registerTool(
    "figma_get_images",
    {
      title: "Get Figma images",
      description: "Export image URLs for one or more Figma nodes.",
      inputSchema: {
        fileKey: z.string().min(1),
        nodeIds: z.array(z.string().min(1)).min(1),
        format: z.enum(["jpg", "png", "svg", "pdf"]).optional(),
        scale: z.number().positive().max(4).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args: { fileKey: string; nodeIds: string[]; format?: string; scale?: number }) => {
      return asJsonText(await figma.getImages(args.fileKey, args.nodeIds, args));
    },
  );

  server.registerTool(
    "figma_get_comments",
    {
      title: "Get Figma comments",
      description: "Read comments for a Figma file if the token has access.",
      inputSchema: { fileKey: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async (args: { fileKey: string }) => asJsonText(await figma.getComments(args.fileKey)),
  );

  server.registerTool(
    "figma_get_versions",
    {
      title: "Get Figma versions",
      description: "Read version history for a Figma file if the token has access.",
      inputSchema: { fileKey: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async (args: { fileKey: string }) => asJsonText(await figma.getVersions(args.fileKey)),
  );
}
