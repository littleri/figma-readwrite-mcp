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

function solidPaint(value: unknown): SolidPaint[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((paint): paint is SolidPaint => {
    return paint && typeof paint === "object" && (paint as Paint).type === "SOLID";
  });
}

function setGeometry(node: SceneNode, payload: Record<string, unknown>) {
  if ("x" in node && typeof payload.x === "number") node.x = payload.x;
  if ("y" in node && typeof payload.y === "number") node.y = payload.y;
  if ("resize" in node && typeof payload.width === "number" && typeof payload.height === "number") {
    node.resize(payload.width, payload.height);
  }
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

function applyPatch(node: SceneNode, patch: Record<string, unknown>) {
  if (typeof patch.name === "string") node.name = patch.name;
  setGeometry(node, patch);

  const fills = solidPaint(patch.fills);
  if (fills && "fills" in node) node.fills = fills;

  if (typeof patch.cornerRadius === "number" && node.type === "RECTANGLE") {
    node.cornerRadius = patch.cornerRadius;
  }

  if (typeof patch.characters === "string" && node.type === "TEXT") {
    node.characters = patch.characters;
  }
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

  if (command.type === "getSelection") {
    return figma.currentPage.selection.map(serializeNode);
  }

  if (command.type === "createFrame") {
    const node = figma.createFrame();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Frame";
    const fills = solidPaint(payload.fills);
    if (fills) node.fills = fills;
    await appendNode(node, payload);
    setGeometry(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "createRectangle") {
    const node = figma.createRectangle();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Rectangle";
    const fills = solidPaint(payload.fills);
    if (fills) node.fills = fills;
    if (typeof payload.cornerRadius === "number") node.cornerRadius = payload.cornerRadius;
    await appendNode(node, payload);
    setGeometry(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "createText") {
    const fontName = {
      family: typeof payload.fontFamily === "string" ? payload.fontFamily : "Inter",
      style: typeof payload.fontStyle === "string" ? payload.fontStyle : "Regular",
    };
    await figma.loadFontAsync(fontName);
    const node = figma.createText();
    node.name = typeof payload.name === "string" ? payload.name : "MCP Text";
    node.fontName = fontName;
    if (typeof payload.fontSize === "number") node.fontSize = payload.fontSize;
    node.characters = typeof payload.text === "string" ? payload.text : "";
    const fills = solidPaint(payload.fills);
    if (fills) node.fills = fills;
    await appendNode(node, payload);
    setGeometry(node, payload);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return serializeNode(node);
  }

  if (command.type === "updateNode") {
    if (typeof payload.nodeId !== "string") throw new Error("nodeId is required");
    const node = await figma.getNodeByIdAsync(payload.nodeId);
    if (!node || node.type === "DOCUMENT" || node.type === "PAGE") throw new Error("Scene node not found");
    applyPatch(node, (payload.patch as Record<string, unknown>) ?? {});
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
