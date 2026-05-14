import { z } from "zod";

export const fileKeySchema = z.string().min(1);
export const nodeIdSchema = z.string().min(1);

export const paintSchema = z.object({
  type: z.literal("SOLID"),
  color: z.object({
    r: z.number().min(0).max(1),
    g: z.number().min(0).max(1),
    b: z.number().min(0).max(1),
  }),
  opacity: z.number().min(0).max(1).optional(),
});

export const nodePatchSchema = z.object({
  name: z.string().min(1).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  fills: z.array(paintSchema).optional(),
  cornerRadius: z.number().min(0).optional(),
  characters: z.string().optional(),
});

export const parentIdSchema = z.string().min(1).optional();

export type PluginCommand =
  | { type: "status" }
  | { type: "getSelection" }
  | { type: "createFrame"; payload: { name?: string; parentId?: string; x: number; y: number; width: number; height: number; fills?: z.infer<typeof paintSchema>[] } }
  | { type: "createRectangle"; payload: { name?: string; parentId?: string; x: number; y: number; width: number; height: number; fills?: z.infer<typeof paintSchema>[]; cornerRadius?: number } }
  | { type: "createText"; payload: { name?: string; parentId?: string; text: string; x: number; y: number; fontSize?: number; fontFamily?: string; fontStyle?: string; fills?: z.infer<typeof paintSchema>[] } }
  | { type: "updateNode"; payload: { nodeId: string; patch: z.infer<typeof nodePatchSchema> } }
  | { type: "deleteNode"; payload: { nodeId: string } }
  | { type: "selectNode"; payload: { nodeId: string } };
