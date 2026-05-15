import { z } from "zod";

export const fileKeySchema = z.string().min(1);
export const nodeIdSchema = z.string().min(1);
export const parentIdSchema = z.string().min(1).optional();

const colorSchema = z.object({
  r: z.number().min(0).max(1),
  g: z.number().min(0).max(1),
  b: z.number().min(0).max(1),
});

const matrixSchema = z.tuple([
  z.tuple([z.number(), z.number(), z.number()]),
  z.tuple([z.number(), z.number(), z.number()]),
]);

const solidPaintSchema = z.object({
  type: z.literal("SOLID"),
  color: colorSchema,
  opacity: z.number().min(0).max(1).optional(),
  visible: z.boolean().optional(),
});

const gradientPaintSchema = z.object({
  type: z.enum(["GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"]),
  gradientTransform: matrixSchema.optional(),
  gradientStops: z.array(z.object({ position: z.number().min(0).max(1), color: colorSchema.extend({ a: z.number().min(0).max(1) }) })).min(2),
  opacity: z.number().min(0).max(1).optional(),
  visible: z.boolean().optional(),
});

export const paintSchema = z.union([solidPaintSchema, gradientPaintSchema]);

const shadowEffectSchema = z.object({
  type: z.enum(["DROP_SHADOW", "INNER_SHADOW"]),
  color: colorSchema.extend({ a: z.number().min(0).max(1) }),
  offset: z.object({ x: z.number(), y: z.number() }),
  radius: z.number().min(0),
  spread: z.number().optional(),
  visible: z.boolean().optional(),
  blendMode: z.string().optional(),
});

const blurEffectSchema = z.object({
  type: z.enum(["LAYER_BLUR", "BACKGROUND_BLUR"]),
  radius: z.number().min(0),
  visible: z.boolean().optional(),
});

export const effectSchema = z.union([shadowEffectSchema, blurEffectSchema]);

export const visualStyleSchema = z.object({
  fills: z.array(paintSchema).optional(),
  strokes: z.array(paintSchema).optional(),
  strokeWeight: z.number().min(0).optional(),
  strokeAlign: z.enum(["INSIDE", "OUTSIDE", "CENTER"]).optional(),
  effects: z.array(effectSchema).optional(),
  opacity: z.number().min(0).max(1).optional(),
  cornerRadius: z.number().min(0).optional(),
  cornerSmoothing: z.number().min(0).max(1).optional(),
});

export const geometrySchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  rotation: z.number().optional(),
});

export const autoLayoutSchema = z.object({
  layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional(),
  layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional(),
  itemSpacing: z.number().optional(),
  paddingTop: z.number().min(0).optional(),
  paddingRight: z.number().min(0).optional(),
  paddingBottom: z.number().min(0).optional(),
  paddingLeft: z.number().min(0).optional(),
  primaryAxisAlignItems: z.enum(["MIN", "CENTER", "MAX", "SPACE_BETWEEN"]).optional(),
  counterAxisAlignItems: z.enum(["MIN", "CENTER", "MAX", "BASELINE"]).optional(),
  primaryAxisSizingMode: z.enum(["FIXED", "AUTO"]).optional(),
  counterAxisSizingMode: z.enum(["FIXED", "AUTO"]).optional(),
});

export const lineHeightSchema = z.union([
  z.object({ unit: z.literal("AUTO") }),
  z.object({ unit: z.enum(["PIXELS", "PERCENT"]), value: z.number().positive() }),
]);

export const letterSpacingSchema = z.object({
  unit: z.enum(["PIXELS", "PERCENT"]),
  value: z.number(),
});

export const textStyleSchema = z.object({
  fontFamily: z.string().min(1).optional(),
  fontStyle: z.string().min(1).optional(),
  fontSize: z.number().positive().optional(),
  lineHeight: lineHeightSchema.optional(),
  letterSpacing: letterSpacingSchema.optional(),
  textAlignHorizontal: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional(),
  textAlignVertical: z.enum(["TOP", "CENTER", "BOTTOM"]).optional(),
  textAutoResize: z.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).optional(),
  paragraphSpacing: z.number().min(0).optional(),
  paragraphIndent: z.number().min(0).optional(),
});

export const nodePatchSchema = z.object({
  name: z.string().min(1).optional(),
  characters: z.string().optional(),
}).merge(geometrySchema).merge(visualStyleSchema).merge(textStyleSchema).merge(autoLayoutSchema);

export const baseCreateSchema = z.object({
  name: z.string().min(1).optional(),
  parentId: parentIdSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
}).merge(visualStyleSchema);

export const vectorPathSchema = z.object({
  windingRule: z.enum(["NONZERO", "EVENODD"]),
  data: z.string().min(1).max(10_000),
});

export type PluginCommand =
  | { type: "status" }
  | { type: "getSelection" }
  | { type: "createFrame"; payload: z.infer<typeof baseCreateSchema> }
  | { type: "createRectangle"; payload: z.infer<typeof baseCreateSchema> }
  | { type: "createText"; payload: { name?: string; parentId?: string; text: string; x: number; y: number } & z.infer<typeof visualStyleSchema> & z.infer<typeof textStyleSchema> }
  | { type: "createAutoLayoutFrame"; payload: z.infer<typeof baseCreateSchema> & z.infer<typeof autoLayoutSchema> }
  | { type: "updateAutoLayout"; payload: { nodeId: string } & z.infer<typeof autoLayoutSchema> }
  | { type: "createEllipse"; payload: z.infer<typeof baseCreateSchema> }
  | { type: "createLine"; payload: { name?: string; parentId?: string; x: number; y: number; width: number; rotation?: number } & z.infer<typeof visualStyleSchema> }
  | { type: "createPolygon"; payload: z.infer<typeof baseCreateSchema> & { pointCount: number } }
  | { type: "createStar"; payload: z.infer<typeof baseCreateSchema> & { pointCount?: number; innerRadius?: number } }
  | { type: "createVector"; payload: { name?: string; parentId?: string; x: number; y: number; width?: number; height?: number; vectorPaths: z.infer<typeof vectorPathSchema>[] } & z.infer<typeof visualStyleSchema> }
  | { type: "createComponent"; payload: z.infer<typeof baseCreateSchema> & z.infer<typeof autoLayoutSchema> }
  | { type: "createComponentFromNode"; payload: { nodeId: string; name?: string } }
  | { type: "createInstance"; payload: { componentId: string; name?: string; parentId?: string; x: number; y: number } }
  | { type: "detachInstance"; payload: { nodeId: string } }
  | { type: "createImageRectangle"; payload: { name?: string; parentId?: string; x: number; y: number; width: number; height: number; imageUrl: string; scaleMode?: "FILL" | "FIT" | "CROP" | "TILE"; cornerRadius?: number } }
  | { type: "updateImageFill"; payload: { nodeId: string; imageUrl: string; scaleMode?: "FILL" | "FIT" | "CROP" | "TILE" } }
  | { type: "updateNode"; payload: { nodeId: string; patch: z.infer<typeof nodePatchSchema> } }
  | { type: "deleteNode"; payload: { nodeId: string } }
  | { type: "selectNode"; payload: { nodeId: string } };
