type BridgeCommand = {
  type: string;
  payload?: Record<string, unknown>;
};

type BridgeEnvelope = {
  type: "command";
  id: string;
  command: BridgeCommand;
};

figma.showUI(__html__, { width: 360, height: 220 });

function serializeNode(node: SceneNode) {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    x: "x" in node ? node.x : undefined,
    y: "y" in node ? node.y : undefined,
    width: "width" in node ? node.width : undefined,
    height: "height" in node ? node.height : undefined,
  };
}

function normalizePaints(paints: Paint[]) {
  return paints.map((paint) => {
    if (
      (paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL" || paint.type === "GRADIENT_ANGULAR" || paint.type === "GRADIENT_DIAMOND") &&
      !("gradientTransform" in paint)
    ) {
      return Object.assign({}, paint, { gradientTransform: [[1, 0, 0], [0, 1, 0]] }) as Paint;
    }
    return paint;
  });
}

function paintArray(value: unknown): Paint[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const paints = value.filter((paint): paint is Paint => paint && typeof paint === "object" && "type" in paint);
  return normalizePaints(paints);
}

function normalizeEffects(effects: Effect[]) {
  return effects.map((effect) => {
    if ((effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") && !("blendMode" in effect)) {
      return Object.assign({}, effect, { blendMode: "NORMAL" }) as Effect;
    }
    return effect;
  });
}

function effectArray(value: unknown): Effect[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const effects = value.filter((effect): effect is Effect => effect && typeof effect === "object" && "type" in effect);
  return normalizeEffects(effects);
}

function setGeometry(node: SceneNode, payload: Record<string, unknown>) {
  if ("x" in node && typeof payload.x === "number") node.x = payload.x;
  if ("y" in node && typeof payload.y === "number") node.y = payload.y;
  if ("resize" in node && typeof payload.width === "number" && typeof payload.height === "number") {
    node.resize(payload.width, payload.height);
  }
  if (typeof payload.rotation === "number" && "rotation" in node) node.rotation = payload.rotation;
  if (typeof payload.opacity === "number" && "opacity" in node) node.opacity = payload.opacity;
}

function applyVisualStyle(node: SceneNode, payload: Record<string, unknown>) {
  const fills = paintArray(payload.fills);
  if (fills && "fills" in node) node.fills = fills;

  const strokes = paintArray(payload.strokes);
  if (strokes && "strokes" in node) node.strokes = strokes;

  if (typeof payload.strokeWeight === "number" && "strokeWeight" in node) node.strokeWeight = payload.strokeWeight;
  if (typeof payload.strokeAlign === "string" && "strokeAlign" in node) node.strokeAlign = payload.strokeAlign as "INSIDE" | "OUTSIDE" | "CENTER";

  const effects = effectArray(payload.effects);
  if (effects && "effects" in node) node.effects = effects;

  if (typeof payload.cornerRadius === "number" && (node.type === "RECTANGLE" || node.type === "FRAME" || node.type === "ELLIPSE" || node.type === "POLYGON" || node.type === "STAR")) node.cornerRadius = payload.cornerRadius;
  if (typeof payload.cornerSmoothing === "number" && "cornerSmoothing" in node) node.cornerSmoothing = payload.cornerSmoothing;
}

function applyAutoLayout(node: SceneNode, payload: Record<string, unknown>) {
  if (!("layoutMode" in node)) throw new Error("Target node does not support auto layout");
  const layoutNode = node as FrameNode | ComponentNode | InstanceNode;

  if (typeof payload.layoutMode === "string") layoutNode.layoutMode = payload.layoutMode as "NONE" | "HORIZONTAL" | "VERTICAL";
  if (typeof payload.layoutWrap === "string" && "layoutWrap" in layoutNode) layoutNode.layoutWrap = payload.layoutWrap as "NO_WRAP" | "WRAP";
  if (typeof payload.itemSpacing === "number") layoutNode.itemSpacing = payload.itemSpacing;
  if (typeof payload.paddingTop === "number") layoutNode.paddingTop = payload.paddingTop;
  if (typeof payload.paddingRight === "number") layoutNode.paddingRight = payload.paddingRight;
  if (typeof payload.paddingBottom === "number") layoutNode.paddingBottom = payload.paddingBottom;
  if (typeof payload.paddingLeft === "number") layoutNode.paddingLeft = payload.paddingLeft;
  if (typeof payload.primaryAxisAlignItems === "string") layoutNode.primaryAxisAlignItems = payload.primaryAxisAlignItems as "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  if (typeof payload.counterAxisAlignItems === "string") layoutNode.counterAxisAlignItems = payload.counterAxisAlignItems as "MIN" | "CENTER" | "MAX" | "BASELINE";
  if (typeof payload.primaryAxisSizingMode === "string") layoutNode.primaryAxisSizingMode = payload.primaryAxisSizingMode as "FIXED" | "AUTO";
  if (typeof payload.counterAxisSizingMode === "string") layoutNode.counterAxisSizingMode = payload.counterAxisSizingMode as "FIXED" | "AUTO";
}

async function appendNode(node: SceneNode, payload: Record<string, unknown>) {
  if (typeof payload.parentId !== "string") {
    figma.currentPage.appendChild(node);
    return;
  }

  const parent = await figma.getNodeByIdAsync(payload.parentId);
  if (!parent || !("appendChild" in parent)) throw new Error("Parent node not found or cannot contain children");
  (parent as BaseNode & ChildrenMixin).appendChild(node);
}

async function applyTextStyle(node: TextNode, payload: Record<string, unknown>) {
  const fontName = {
    family: typeof payload.fontFamily === "string" ? payload.fontFamily : "Inter",
    style: typeof payload.fontStyle === "string" ? payload.fontStyle : "Regular",
  };
  await figma.loadFontAsync(fontName);
  node.fontName = fontName;

  if (typeof payload.fontSize === "number") node.fontSize = payload.fontSize;
  if (payload.lineHeight && typeof payload.lineHeight === "object") node.lineHeight = payload.lineHeight as LineHeight;
  if (payload.letterSpacing && typeof payload.letterSpacing === "object") node.letterSpacing = payload.letterSpacing as LetterSpacing;
  if (typeof payload.textAlignHorizontal === "string") node.textAlignHorizontal = payload.textAlignHorizontal as "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  if (typeof payload.textAlignVertical === "string") node.textAlignVertical = payload.textAlignVertical as "TOP" | "CENTER" | "BOTTOM";
  if (typeof payload.textAutoResize === "string") node.textAutoResize = payload.textAutoResize as "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT" | "TRUNCATE";
  if (typeof payload.paragraphSpacing === "number") node.paragraphSpacing = payload.paragraphSpacing;
  if (typeof payload.paragraphIndent === "number") node.paragraphIndent = payload.paragraphIndent;
}

async function applyPatch(node: SceneNode, patch: Record<string, unknown>) {
  if (typeof patch.name === "string") node.name = patch.name;
  setGeometry(node, patch);
  applyVisualStyle(node, patch);

  if (node.type === "TEXT") {
    await applyTextStyle(node, patch);
    if (typeof patch.characters === "string") node.characters = patch.characters;
  } else if (typeof patch.characters === "string") {
    throw new Error("characters can only be applied to text nodes");
  }

  if ("layoutMode" in patch || "itemSpacing" in patch || "paddingTop" in patch || "paddingRight" in patch || "paddingBottom" in patch || "paddingLeft" in patch) {
    applyAutoLayout(node, patch);
  }
}

async function bytesFromImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const commaIndex = imageUrl.indexOf(",");
    if (commaIndex === -1) throw new Error("Invalid data URL");
    const metadata = imageUrl.slice(0, commaIndex);
    const data = imageUrl.slice(commaIndex + 1);
    if (metadata.indexOf(";base64") === -1) throw new Error("Only base64 data URLs are supported");
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function imagePaintFromUrl(imageUrl: unknown, scaleMode: unknown): Promise<ImagePaint> {
  if (typeof imageUrl !== "string") throw new Error("imageUrl is required");
  const image = figma.createImage(await bytesFromImageUrl(imageUrl));
  return { type: "IMAGE", scaleMode: typeof scaleMode === "string" ? (scaleMode as ImagePaint["scaleMode"]) : "FILL", imageHash: image.hash };
}

async function handleCommand(command: BridgeCommand) {
  const payload = command.payload ?? {};

  if (command.type === "status") {
    return {
      fileName: figma.root.name,
      pageId: figma.currentPage.id,
      pageName: figma.currentPage.name,
      selection: figma.currentPage.selection.map(serializeNode),
    };
  }

  if (command.type === "getSelection") return figma.currentPage.selection.map(serializeNode);

  if (command.type === "createFrame" || command.type === "createAutoLayoutFrame") {
    const node = figma.createFrame();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Frame";
    applyVisualStyle(node, payload);
    await appendNode(node, payload);
    setGeometry(node, payload);
    if (command.type === "createAutoLayoutFrame") applyAutoLayout(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "createRectangle") {
    const node = figma.createRectangle();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Rectangle";
    applyVisualStyle(node, payload);
    await appendNode(node, payload);
    setGeometry(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "createText") {
    const node = figma.createText();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Text";
    await applyTextStyle(node, payload);
    node.characters = typeof payload.text === "string" ? payload.text : "";
    applyVisualStyle(node, payload);
    await appendNode(node, payload);
    setGeometry(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "updateAutoLayout") {
    if (typeof payload.nodeId !== "string") throw new Error("nodeId is required");
    const node = await figma.getNodeByIdAsync(payload.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") throw new Error("Scene node not found");
    applyAutoLayout(node, payload);
    return serializeNode(node);
  }

  if (command.type === "createEllipse") {
    const node = figma.createEllipse();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Ellipse";
    applyVisualStyle(node, payload);
    await appendNode(node, payload);
    setGeometry(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "createLine") {
    const node = figma.createLine();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Line";
    applyVisualStyle(node, payload);
    await appendNode(node, payload);
    setGeometry(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "createPolygon") {
    const node = figma.createPolygon();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Polygon";
    if (typeof payload.pointCount === "number") node.pointCount = payload.pointCount;
    applyVisualStyle(node, payload);
    await appendNode(node, payload);
    setGeometry(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "createStar") {
    const node = figma.createStar();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Star";
    if (typeof payload.pointCount === "number") node.pointCount = payload.pointCount;
    if (typeof payload.innerRadius === "number") node.innerRadius = payload.innerRadius;
    applyVisualStyle(node, payload);
    await appendNode(node, payload);
    setGeometry(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "createVector") {
    const node = figma.createVector();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Vector";
    if (Array.isArray(payload.vectorPaths)) node.vectorPaths = payload.vectorPaths as VectorPath[];
    applyVisualStyle(node, payload);
    await appendNode(node, payload);
    setGeometry(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "createComponent") {
    const node = figma.createComponent();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Component";
    applyVisualStyle(node, payload);
    await appendNode(node, payload);
    setGeometry(node, payload);
    applyAutoLayout(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "createComponentFromNode") {
    if (typeof payload.nodeId !== "string") throw new Error("nodeId is required");
    const node = await figma.getNodeByIdAsync(payload.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") throw new Error("Scene node not found");
    const component = figma.createComponentFromNode(node as SceneNode);
    if (typeof payload.name === "string") component.name = payload.name;
    return serializeNode(component);
  }

  if (command.type === "createInstance") {
    if (typeof payload.componentId !== "string") throw new Error("componentId is required");
    const component = await figma.getNodeByIdAsync(payload.componentId);
    if (!component || component.type !== "COMPONENT") throw new Error("Component node not found");
    const node = component.createInstance();
    if (typeof payload.name === "string") node.name = payload.name;
    await appendNode(node, payload);
    setGeometry(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "detachInstance") {
    if (typeof payload.nodeId !== "string") throw new Error("nodeId is required");
    const node = await figma.getNodeByIdAsync(payload.nodeId);
    if (!node || node.type !== "INSTANCE") throw new Error("Instance node not found");
    return serializeNode(node.detachInstance());
  }

  if (command.type === "createImageRectangle") {
    const node = figma.createRectangle();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Image Rectangle";
    node.fills = [await imagePaintFromUrl(payload.imageUrl, payload.scaleMode)];
    const stylePayload = Object.assign({}, payload, { fills: undefined });
    applyVisualStyle(node, stylePayload);
    await appendNode(node, payload);
    setGeometry(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "updateImageFill") {
    if (typeof payload.nodeId !== "string") throw new Error("nodeId is required");
    const node = await figma.getNodeByIdAsync(payload.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE" || !("fills" in node)) throw new Error("Fillable scene node not found");
    node.fills = [await imagePaintFromUrl(payload.imageUrl, payload.scaleMode)];
    return serializeNode(node as SceneNode);
  }

  if (command.type === "updateNode") {
    if (typeof payload.nodeId !== "string") throw new Error("nodeId is required");
    const node = await figma.getNodeByIdAsync(payload.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") throw new Error("Scene node not found");
    await applyPatch(node, (payload.patch as Record<string, unknown>) ?? {});
    return serializeNode(node);
  }

  if (command.type === "deleteNode") {
    if (typeof payload.nodeId !== "string") throw new Error("nodeId is required");
    const node = await figma.getNodeByIdAsync(payload.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") throw new Error("Scene node not found");
    const result = serializeNode(node);
    node.remove();
    return result;
  }

  if (command.type === "selectNode") {
    if (typeof payload.nodeId !== "string") throw new Error("nodeId is required");
    const node = await figma.getNodeByIdAsync(payload.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") throw new Error("Scene node not found");
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  throw new Error(`Unknown command: ${command.type}`);
}

function postResponse(id: string, ok: boolean, result?: unknown, error?: string) {
  figma.ui.postMessage({ type: "response", id, ok, result, error });
}

figma.ui.onmessage = async (message: { type?: string; raw?: string; id?: string }) => {
  if (message.type === "connected") {
    figma.ui.postMessage({
      type: "hello",
      payload: {
        fileName: figma.root.name,
        pageId: figma.currentPage.id,
        pageName: figma.currentPage.name,
      },
    });
    return;
  }

  if (message.type !== "command" || typeof message.raw !== "string") return;

  try {
    const envelope = JSON.parse(message.raw) as BridgeEnvelope;
    try {
      const result = await handleCommand(envelope.command);
      postResponse(envelope.id, true, result);
    } catch (error) {
      postResponse(envelope.id, false, undefined, error instanceof Error ? error.message : String(error));
    }
  } catch (error) {
    postResponse(message.id ?? "unknown", false, undefined, error instanceof Error ? error.message : String(error));
  }
};
