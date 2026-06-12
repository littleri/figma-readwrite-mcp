import { z } from "zod";

export const fileKeySchema = z.string().min(1);
export const nodeIdSchema = z.string().min(1);
export const parentIdSchema = z.string().min(1).optional();

// --- Hybrid read mode schemas ---

export const readDepthSchema = z.number().int().min(0).max(20).optional();
export const readMaxChildrenSchema = z.number().int().min(1).max(500).optional();
export const readMaxTextLengthSchema = z.number().int().min(0).max(10_000).optional();

export const pluginNodeReadSchema = z.object({
  nodeId: z.string().min(1),
  depth: readDepthSchema,
  includeInvisible: z.boolean().optional(),
  maxChildren: readMaxChildrenSchema,
  maxTextLength: readMaxTextLengthSchema,
  compact: z.boolean().optional(),
});

export const pluginPageTreeReadSchema = z.object({
  depth: readDepthSchema,
  includeInvisible: z.boolean().optional(),
  maxChildren: readMaxChildrenSchema,
  maxTextLength: readMaxTextLengthSchema,
  compact: z.boolean().optional(),
});

export const autoReadContextSchema = z.object({
  fileKey: z.string().min(1).optional(),
  figmaUrl: z.string().url().optional(),
  scope: z.enum(["file", "currentFile", "currentPage", "selection"]).optional(),
  depth: readDepthSchema,
  includeInvisible: z.boolean().optional(),
  maxChildren: readMaxChildrenSchema,
  maxTextLength: readMaxTextLengthSchema,
  compact: z.boolean().optional(),
});

export const autoReadNodeSchema = z.object({
  fileKey: z.string().min(1).optional(),
  figmaUrl: z.string().url().optional(),
  nodeId: z.string().min(1).optional(),
  depth: readDepthSchema,
  geometry: z.enum(["paths"]).optional(),
  includeInvisible: z.boolean().optional(),
  maxChildren: readMaxChildrenSchema,
  maxTextLength: readMaxTextLengthSchema,
  compact: z.boolean().optional(),
});

const colorSchema = z.object({
  r: z.number().min(0).max(1),
  g: z.number().min(0).max(1),
  b: z.number().min(0).max(1),
});

const matrixSchema = z.array(
  z.array(z.number()).min(3).max(3),
).min(2).max(2);

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

const blendModeEnum = z.enum([
  "NORMAL", "MULTIPLY", "SCREEN", "OVERLAY", "DARKEN", "LIGHTEN",
  "COLOR_DODGE", "COLOR_BURN", "HARD_LIGHT", "SOFT_LIGHT",
  "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY",
]);

const shadowEffectSchema = z.object({
  type: z.enum(["DROP_SHADOW", "INNER_SHADOW"]),
  color: colorSchema.extend({ a: z.number().min(0).max(1) }),
  offset: z.object({ x: z.number(), y: z.number() }),
  radius: z.number().min(0),
  visible: z.boolean().optional(),
  blendMode: blendModeEnum.optional(),
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

export const pageFrameSchema = z.object({
  name: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  fills: z.array(paintSchema).optional(),
});

export const pageTemplateSchema = z.enum(["portfolio-site", "blank-pages"]);

// --- Component variants & properties ---

export const combineAsVariantsSchema = z.object({
  componentIds: z.array(z.string().min(1)).min(2).max(100),
  parentId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  index: z.number().int().min(0).optional(),
});

// Full set for reading / auditing (VARIANT is read-only — created via combineAsVariants)
export const componentPropertyTypeSchema = z.enum(["TEXT", "BOOLEAN", "INSTANCE_SWAP", "VARIANT"]);

// Subset that can be created via addComponentProperty (VARIANT is not user-creatable)
export const writableComponentPropertyTypeSchema = z.enum(["TEXT", "BOOLEAN", "INSTANCE_SWAP"]);

export const addComponentPropertySchema = z.object({
  componentId: z.string().min(1),
  propertyName: z.string().min(1),
  propertyType: writableComponentPropertyTypeSchema,
  defaultValue: z.union([z.string(), z.boolean()]).optional(),
});

export const editComponentPropertySchema = z.object({
  componentId: z.string().min(1),
  propertyKey: z.string().min(1),
  newName: z.string().min(1).optional(),
  newDefaultValue: z.union([z.string(), z.boolean()]).optional(),
});

export const setComponentPropertyReferenceSchema = z.object({
  nodeId: z.string().min(1),
  references: z.record(z.string(), z.string()),
});

export const getComponentPropertiesSchema = z.object({
  componentId: z.string().min(1),
});

// --- P0: Smart instance & audit schemas ---

export const createInstanceSmartSchema = z.object({
  componentId: z.string().min(1),
  parentId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  properties: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  verify: z.boolean().optional(),
});

export const auditComponentPropertiesSchema = z.object({
  componentId: z.string().min(1),
  createProbeInstance: z.boolean().optional(),
  probeParentId: z.string().min(1).optional(),
  cleanupProbe: z.boolean().optional(),
});

export const bindComponentPropertySchema = z.object({
  componentId: z.string().min(1),
  propertyName: z.string().min(1),
  layerName: z.string().min(1),
  field: z.enum(["characters", "visible", "mainComponent"]),
  match: z.enum(["exact", "contains"]).optional(),
});

// --- P1: One-stop component creation ---

export const createComponentWithPropertiesSchema = z.object({
  name: z.string().min(1),
  parentId: parentIdSchema,
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
  fills: z.array(paintSchema).optional(),
  strokes: z.array(paintSchema).optional(),
  strokeWeight: z.number().min(0).optional(),
  effects: z.array(effectSchema).optional(),
  layers: z.array(z.object({
    type: z.enum(["TEXT", "FRAME", "RECTANGLE", "ELLIPSE"]),
    name: z.string().min(1),
    text: z.string().optional(),
    fontSize: z.number().positive().optional(),
    fontFamily: z.string().optional(),
    fontStyle: z.string().optional(),
    fills: z.array(paintSchema).optional(),
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
});

export const createInstanceWithOverridesSchema = z.object({
  componentId: z.string().min(1),
  parentId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  properties: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
});

// --- Variable schemas ---

const variableResolvedTypeSchema = z.enum(["BOOLEAN", "COLOR", "FLOAT", "STRING"]);

const rgbaVariableValueSchema = z.object({
  r: z.number().min(0).max(1),
  g: z.number().min(0).max(1),
  b: z.number().min(0).max(1),
  a: z.number().min(0).max(1).optional(),
});

const variableScopeSchema = z.enum([
  "ALL_SCOPES", "TEXT_CONTENT", "CORNER_RADIUS", "WIDTH_HEIGHT", "GAP",
  "ALL_FILLS", "FRAME_FILL", "SHAPE_FILL", "TEXT_FILL",
  "STROKE_COLOR", "STROKE_FLOAT", "EFFECT_FLOAT", "EFFECT_COLOR",
  "OPACITY", "FONT_FAMILY", "FONT_STYLE", "FONT_WEIGHT",
  "FONT_SIZE", "LINE_HEIGHT", "LETTER_SPACING",
  "PARAGRAPH_SPACING", "PARAGRAPH_INDENT",
]);

export const createVariableCollectionSchema = z.object({
  name: z.string().min(1),
  defaultModeName: z.string().min(1).optional(),
});

export const addVariableModeSchema = z.object({
  collectionId: z.string().min(1),
  name: z.string().min(1),
});

export const renameVariableModeSchema = z.object({
  collectionId: z.string().min(1),
  modeId: z.string().min(1),
  name: z.string().min(1),
});

export const createVariableSchema = z.object({
  collectionId: z.string().min(1),
  name: z.string().min(1),
  resolvedType: variableResolvedTypeSchema,
  scopes: z.array(variableScopeSchema).optional(),
});

export const setVariableValueForModeSchema = z.object({
  variableId: z.string().min(1),
  modeId: z.string().min(1),
  value: z.union([z.boolean(), z.string(), z.number(), rgbaVariableValueSchema]),
});

export const bindVariableSchema = z.object({
  nodeId: z.string().min(1),
  target: z.enum(["nodeField", "fills", "strokes", "effects"]),
  index: z.number().int().min(0).optional(),
  field: z.string().min(1),
  variableId: z.string().min(1),
});

export const setExplicitVariableModeSchema = z.object({
  nodeId: z.string().min(1),
  collectionId: z.string().min(1),
  modeId: z.string().min(1),
});

export const createThemeTokensSchema = z.object({
  collectionName: z.string().min(1),
  modes: z.array(z.string().min(1)).min(1).max(10),
  tokens: z.array(z.object({
    name: z.string().min(1),
    type: variableResolvedTypeSchema,
    scopes: z.array(variableScopeSchema).optional(),
    values: z.record(z.string(), z.union([z.boolean(), z.string(), z.number(), rgbaVariableValueSchema])),
  })).min(1).max(200),
});

// --- Batch write schemas ---

export const layoutChildSchema = z.object({
  layoutAlign: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "INHERIT"]).optional(),
  layoutGrow: z.number().min(0).optional(),
  layoutPositioning: z.enum(["AUTO", "ABSOLUTE"]).optional(),
  minWidth: z.number().min(0).optional(),
  maxWidth: z.number().min(0).optional(),
  minHeight: z.number().min(0).optional(),
  maxHeight: z.number().min(0).optional(),
});

const batchNodeTypeSchema = z.enum([
  "FRAME",
  "AUTO_LAYOUT_FRAME",
  "RECTANGLE",
  "TEXT",
  "ELLIPSE",
  "LINE",
  "POLYGON",
  "STAR",
  "VECTOR",
  "COMPONENT",
  "INSTANCE",
  "IMAGE_RECTANGLE",
]);

export const batchNodeSchema = z.object({
  tempId: z.string().min(1),
  type: batchNodeTypeSchema,
  parentTempId: z.string().min(1).optional(),
  parentId: z.string().min(1).optional(),
  props: z.record(z.string(), z.unknown()),
});

export const batchCreateNodesSchema = z.object({
  nodes: z.array(batchNodeSchema).min(1).max(500),
  rollbackOnError: z.boolean().optional(),
  validateOnly: z.boolean().optional(),
  selectCreated: z.boolean().optional(),
  scrollIntoView: z.boolean().optional(),
});

// --- Local Styles ---

export const localStyleTypeSchema = z.enum(["paint", "text", "effect"]);
export const styleBindTargetSchema = z.enum(["fill", "stroke", "text", "effect"]);

export const getLocalStylesSchema = z.object({
  type: z.enum(["all", "paint", "text", "effect"]).optional(),
});

export const createPaintStyleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  paints: z.array(paintSchema).min(1),
  upsert: z.boolean().optional(),
});

export const createTextStyleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  fontFamily: z.string().min(1),
  fontStyle: z.string().min(1),
  fontSize: z.number().positive(),
  lineHeight: lineHeightSchema.optional(),
  letterSpacing: letterSpacingSchema.optional(),
  paragraphSpacing: z.number().min(0).optional(),
  paragraphIndent: z.number().min(0).optional(),
  upsert: z.boolean().optional(),
});

export const createEffectStyleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  effects: z.array(effectSchema).min(1),
  upsert: z.boolean().optional(),
});

export const updateStyleSchema = z.object({
  styleId: z.string().min(1),
  styleType: localStyleTypeSchema,
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  paints: z.array(paintSchema).optional(),
  fontFamily: z.string().min(1).optional(),
  fontStyle: z.string().min(1).optional(),
  fontSize: z.number().positive().optional(),
  lineHeight: lineHeightSchema.optional(),
  letterSpacing: letterSpacingSchema.optional(),
  paragraphSpacing: z.number().min(0).optional(),
  paragraphIndent: z.number().min(0).optional(),
  effects: z.array(effectSchema).optional(),
});

export const deleteStyleSchema = z.object({
  styleId: z.string().min(1),
  styleType: localStyleTypeSchema,
});

export const bindStyleSchema = z.object({
  nodeId: z.string().min(1),
  styleId: z.string().min(1),
  target: styleBindTargetSchema,
});

export const createDesignSystemStylesSchema = z.object({
  upsert: z.boolean().optional(),
  paintStyles: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    paints: z.array(paintSchema).min(1),
  })).optional(),
  textStyles: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    fontFamily: z.string().min(1),
    fontStyle: z.string().min(1),
    fontSize: z.number().positive(),
    lineHeight: lineHeightSchema.optional(),
    letterSpacing: letterSpacingSchema.optional(),
    paragraphSpacing: z.number().min(0).optional(),
    paragraphIndent: z.number().min(0).optional(),
  })).optional(),
  effectStyles: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    effects: z.array(effectSchema).min(1),
  })).optional(),
});

export const auditStylesSchema = z.object({
  prefix: z.string().optional(),
  expected: z.object({
    paintStyles: z.array(z.string()).optional(),
    textStyles: z.array(z.string()).optional(),
    effectStyles: z.array(z.string()).optional(),
  }).optional(),
});

export const auditNodeStyleBindingSchema = z.object({
  nodeId: z.string().min(1),
  depth: z.number().int().min(0).max(20).optional(),
  expectedPrefix: z.string().optional(),
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
  | { type: "createPageFrames"; payload: { parentId: string; frames: z.infer<typeof pageFrameSchema>[] } }
  | { type: "createPageFromTemplate"; payload: { parentId: string; template: z.infer<typeof pageTemplateSchema>; pages: string[]; startX?: number; startY?: number; gap?: number; width?: number; height?: number; fills?: z.infer<typeof paintSchema>[] } }
  | { type: "updateNode"; payload: { nodeId: string; patch: z.infer<typeof nodePatchSchema> } }
  | { type: "deleteNode"; payload: { nodeId: string } }
  | { type: "selectNode"; payload: { nodeId: string } }
  // Plugin hybrid read commands
  | { type: "getCurrentFileSummary" }
  | { type: "getCurrentPage"; payload?: { depth?: number; includeInvisible?: boolean; maxChildren?: number; maxTextLength?: number; compact?: boolean } }
  | { type: "getPageTree"; payload?: { depth?: number; includeInvisible?: boolean; maxChildren?: number; maxTextLength?: number; compact?: boolean } }
  | { type: "getNode"; payload: { nodeId: string; depth?: number; includeInvisible?: boolean; maxChildren?: number; maxTextLength?: number; compact?: boolean } }
  | { type: "getNodeTree"; payload: { nodeId: string; depth?: number; includeInvisible?: boolean; maxChildren?: number; maxTextLength?: number; compact?: boolean } }
  // Batch write
  | { type: "batchCreateNodes"; payload: z.infer<typeof batchCreateNodesSchema> }
  // Component variants & properties
  | { type: "combineAsVariants"; payload: z.infer<typeof combineAsVariantsSchema> }
  | { type: "addComponentProperty"; payload: z.infer<typeof addComponentPropertySchema> }
  | { type: "editComponentProperty"; payload: z.infer<typeof editComponentPropertySchema> }
  | { type: "setComponentPropertyReference"; payload: z.infer<typeof setComponentPropertyReferenceSchema> }
  | { type: "getComponentProperties"; payload: z.infer<typeof getComponentPropertiesSchema> }
  | { type: "createInstanceWithOverrides"; payload: z.infer<typeof createInstanceWithOverridesSchema> }
  // Variables
  | { type: "createVariableCollection"; payload: z.infer<typeof createVariableCollectionSchema> }
  | { type: "addVariableMode"; payload: z.infer<typeof addVariableModeSchema> }
  | { type: "renameVariableMode"; payload: z.infer<typeof renameVariableModeSchema> }
  | { type: "createVariable"; payload: z.infer<typeof createVariableSchema> }
  | { type: "setVariableValueForMode"; payload: z.infer<typeof setVariableValueForModeSchema> }
  | { type: "getLocalVariables" }
  | { type: "getLocalVariableCollections" }
  | { type: "bindVariable"; payload: z.infer<typeof bindVariableSchema> }
  | { type: "setExplicitVariableMode"; payload: z.infer<typeof setExplicitVariableModeSchema> }
  | { type: "createThemeTokens"; payload: z.infer<typeof createThemeTokensSchema> }
  // Component property improvement (P0/P1)
  | { type: "createInstanceSmart"; payload: z.infer<typeof createInstanceSmartSchema> }
  | { type: "auditComponentProperties"; payload: z.infer<typeof auditComponentPropertiesSchema> }
  | { type: "bindComponentProperty"; payload: z.infer<typeof bindComponentPropertySchema> }
  | { type: "createComponentWithProperties"; payload: z.infer<typeof createComponentWithPropertiesSchema> }
  // Local Styles
  | { type: "getLocalStyles"; payload?: z.infer<typeof getLocalStylesSchema> }
  | { type: "createPaintStyle"; payload: z.infer<typeof createPaintStyleSchema> }
  | { type: "createTextStyle"; payload: z.infer<typeof createTextStyleSchema> }
  | { type: "createEffectStyle"; payload: z.infer<typeof createEffectStyleSchema> }
  | { type: "updateStyle"; payload: z.infer<typeof updateStyleSchema> }
  | { type: "deleteStyle"; payload: z.infer<typeof deleteStyleSchema> }
  | { type: "bindStyle"; payload: z.infer<typeof bindStyleSchema> }
  | { type: "createDesignSystemStyles"; payload: z.infer<typeof createDesignSystemStylesSchema> }
  | { type: "auditStyles"; payload?: z.infer<typeof auditStylesSchema> }
  | { type: "auditNodeStyleBinding"; payload: z.infer<typeof auditNodeStyleBindingSchema> };
