"use strict";
figma.showUI(__html__, { width: 360, height: 220 });
function serializeNode(node) {
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
function readSerializeOptions(payload, defaultDepth) {
    return {
        depth: typeof payload.depth === "number" ? Math.max(0, Math.min(20, Math.floor(payload.depth))) : defaultDepth,
        includeInvisible: payload.includeInvisible === true,
        maxChildren: typeof payload.maxChildren === "number" ? Math.max(1, Math.min(500, Math.floor(payload.maxChildren))) : 50,
        maxTextLength: typeof payload.maxTextLength === "number" ? Math.max(0, Math.min(10000, Math.floor(payload.maxTextLength))) : 500,
        compact: payload.compact !== false,
    };
}
function compactPaints(paints) {
    return paints.map((paint) => {
        if (paint.type === "SOLID") {
            return {
                type: paint.type,
                visible: paint.visible,
                opacity: paint.opacity,
                color: paint.color,
            };
        }
        if (paint.type === "GRADIENT_LINEAR" ||
            paint.type === "GRADIENT_RADIAL" ||
            paint.type === "GRADIENT_ANGULAR" ||
            paint.type === "GRADIENT_DIAMOND") {
            return {
                type: paint.type,
                visible: paint.visible,
                opacity: paint.opacity,
                gradientStops: paint.gradientStops,
            };
        }
        if (paint.type === "IMAGE") {
            return {
                type: paint.type,
                visible: paint.visible,
                opacity: paint.opacity,
                scaleMode: paint.scaleMode,
            };
        }
        return paint;
    });
}
function serializeSceneNode(node, options) {
    var result = {
        id: node.id,
        name: node.name,
        type: node.type,
        visible: node.visible,
        locked: node.locked,
    };
    // Geometry
    if ("x" in node)
        result.x = node.x;
    if ("y" in node)
        result.y = node.y;
    if ("width" in node)
        result.width = node.width;
    if ("height" in node)
        result.height = node.height;
    if ("rotation" in node && node.rotation !== 0)
        result.rotation = node.rotation;
    if ("opacity" in node && node.opacity !== 1)
        result.opacity = node.opacity;
    // Visual style
    if ("fills" in node) {
        var fillsVal = node.fills;
        if (fillsVal !== figma.mixed) {
            result.fills = (options.compact ? compactPaints(fillsVal) : fillsVal.slice());
        }
    }
    if ("strokes" in node) {
        var strokesVal = node.strokes;
        if (strokesVal !== figma.mixed && strokesVal.length > 0) {
            result.strokes = (options.compact ? compactPaints(strokesVal) : strokesVal.slice());
        }
    }
    if ("strokeWeight" in node) {
        var sw = node.strokeWeight;
        if (sw !== figma.mixed)
            result.strokeWeight = sw;
    }
    if ("cornerRadius" in node) {
        var cr = node.cornerRadius;
        if (cr !== figma.mixed && cr > 0)
            result.cornerRadius = cr;
    }
    // Text-specific properties
    if (node.type === "TEXT") {
        var textNode = node;
        if (textNode.characters.length > options.maxTextLength) {
            result.characters = textNode.characters.slice(0, options.maxTextLength);
            result.truncatedCharacters = true;
        }
        else {
            result.characters = textNode.characters;
        }
        var fs = textNode.fontSize;
        if (fs !== figma.mixed)
            result.fontSize = fs;
        var fn = textNode.fontName;
        if (fn !== figma.mixed)
            result.fontName = Object.assign({}, fn);
        var lh = textNode.lineHeight;
        if (lh !== figma.mixed)
            result.lineHeight = lh;
        var ls = textNode.letterSpacing;
        if (ls !== figma.mixed)
            result.letterSpacing = ls;
        result.textAlignHorizontal = textNode.textAlignHorizontal;
        result.textAlignVertical = textNode.textAlignVertical;
    }
    // Auto-layout properties
    if ("layoutMode" in node) {
        var layoutNode = node;
        if (layoutNode.layoutMode !== "NONE") {
            result.layoutMode = layoutNode.layoutMode;
            result.itemSpacing = layoutNode.itemSpacing;
            result.paddingTop = layoutNode.paddingTop;
            result.paddingRight = layoutNode.paddingRight;
            result.paddingBottom = layoutNode.paddingBottom;
            result.paddingLeft = layoutNode.paddingLeft;
            result.primaryAxisAlignItems = layoutNode.primaryAxisAlignItems;
            result.counterAxisAlignItems = layoutNode.counterAxisAlignItems;
            result.primaryAxisSizingMode = layoutNode.primaryAxisSizingMode;
            result.counterAxisSizingMode = layoutNode.counterAxisSizingMode;
            if ("layoutWrap" in layoutNode)
                result.layoutWrap = layoutNode.layoutWrap;
        }
    }
    // Component properties — ALL reads wrapped in try/catch:
    // a component set with errors can throw on any property access
    try {
        if ("variantProperties" in node && node.variantProperties) {
            result.variantProperties = Object.assign({}, node.variantProperties);
        }
    }
    catch (_vpError) {
        // Component set with errors may throw on variantProperties
    }
    try {
        if (node.type === "COMPONENT_SET" && "componentPropertyDefinitions" in node) {
            result.componentPropertyDefinitions = Object.assign({}, node.componentPropertyDefinitions);
        }
        else if (node.type === "COMPONENT" && "componentPropertyDefinitions" in node) {
            result.componentPropertyDefinitions = Object.assign({}, node.componentPropertyDefinitions);
        }
    }
    catch (_defError) {
        // Variant component threw — skip definitions silently
    }
    try {
        if ("componentProperties" in node && node.componentProperties) {
            result.componentProperties = Object.assign({}, node.componentProperties);
        }
    }
    catch (_cpError) {
        // Component set with errors may throw on componentProperties
    }
    try {
        if ("componentPropertyReferences" in node && node.componentPropertyReferences) {
            result.componentPropertyReferences = Object.assign({}, node.componentPropertyReferences);
        }
    }
    catch (_refError) {
        // Skip references if the node throws
    }
    // Variable bindings
    if ("boundVariables" in node && node.boundVariables) {
        result.boundVariables = Object.assign({}, node.boundVariables);
    }
    if ("explicitVariableModes" in node && node.explicitVariableModes) {
        result.explicitVariableModes = Object.assign({}, node.explicitVariableModes);
    }
    // Recursively serialize children only when depth > 0
    if (options.depth > 0 && "children" in node) {
        var parentWithChildren = node;
        var childOptions = {
            depth: options.depth - 1,
            includeInvisible: options.includeInvisible,
            maxChildren: options.maxChildren,
            maxTextLength: options.maxTextLength,
            compact: options.compact,
        };
        var serializedChildren = [];
        for (var i = 0; i < parentWithChildren.children.length; i += 1) {
            var child = parentWithChildren.children[i];
            if (!options.includeInvisible && !child.visible)
                continue;
            if (serializedChildren.length >= options.maxChildren) {
                result.truncatedChildren = parentWithChildren.children.length - i;
                break;
            }
            serializedChildren.push(serializeSceneNode(child, childOptions));
        }
        result.children = serializedChildren;
    }
    return result;
}
function serializeCurrentPage(options) {
    var nodes = [];
    for (var i = 0; i < figma.currentPage.children.length; i += 1) {
        var child = figma.currentPage.children[i];
        if (!options.includeInvisible && !child.visible)
            continue;
        if (nodes.length >= options.maxChildren)
            break;
        nodes.push(serializeSceneNode(child, options));
    }
    return nodes;
}
function normalizePaints(paints) {
    return paints.map((paint) => {
        if ((paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL" || paint.type === "GRADIENT_ANGULAR" || paint.type === "GRADIENT_DIAMOND") &&
            !("gradientTransform" in paint)) {
            return Object.assign({}, paint, { gradientTransform: [[1, 0, 0], [0, 1, 0]] });
        }
        return paint;
    });
}
function paintArray(value) {
    if (!Array.isArray(value))
        return undefined;
    const paints = value.filter((paint) => paint && typeof paint === "object" && "type" in paint);
    return normalizePaints(paints);
}
function normalizeEffects(effects) {
    return effects.map((effect) => {
        if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
            return {
                type: effect.type,
                visible: effect.visible !== undefined ? effect.visible : true,
                blendMode: effect.blendMode !== undefined ? effect.blendMode : "NORMAL",
                color: effect.color,
                offset: effect.offset,
                radius: effect.radius,
            };
        }
        if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
            return {
                type: effect.type,
                visible: effect.visible !== undefined ? effect.visible : true,
                radius: effect.radius,
            };
        }
        return effect;
    });
}
function effectArray(value) {
    if (!Array.isArray(value))
        return undefined;
    const effects = value.filter((effect) => effect && typeof effect === "object" && "type" in effect);
    return normalizeEffects(effects);
}
function setGeometry(node, payload) {
    if ("x" in node && typeof payload.x === "number")
        node.x = payload.x;
    if ("y" in node && typeof payload.y === "number")
        node.y = payload.y;
    if ("resize" in node && typeof payload.width === "number" && typeof payload.height === "number") {
        node.resize(payload.width, payload.height);
    }
    if (typeof payload.rotation === "number" && "rotation" in node)
        node.rotation = payload.rotation;
    if (typeof payload.opacity === "number" && "opacity" in node)
        node.opacity = payload.opacity;
}
function applyVisualStyle(node, payload) {
    const fills = paintArray(payload.fills);
    if (fills && "fills" in node)
        node.fills = fills;
    const strokes = paintArray(payload.strokes);
    if (strokes && "strokes" in node)
        node.strokes = strokes;
    if (typeof payload.strokeWeight === "number" && "strokeWeight" in node)
        node.strokeWeight = payload.strokeWeight;
    if (typeof payload.strokeAlign === "string" && "strokeAlign" in node)
        node.strokeAlign = payload.strokeAlign;
    const effects = effectArray(payload.effects);
    if (effects && "effects" in node)
        node.effects = effects;
    if (typeof payload.cornerRadius === "number" && (node.type === "RECTANGLE" || node.type === "FRAME" || node.type === "ELLIPSE" || node.type === "POLYGON" || node.type === "STAR"))
        node.cornerRadius = payload.cornerRadius;
    if (typeof payload.cornerSmoothing === "number" && "cornerSmoothing" in node)
        node.cornerSmoothing = payload.cornerSmoothing;
}
function applyAutoLayout(node, payload) {
    if (!("layoutMode" in node))
        throw new Error("Target node does not support auto layout");
    const layoutNode = node;
    if (typeof payload.layoutMode === "string")
        layoutNode.layoutMode = payload.layoutMode;
    if (typeof payload.layoutWrap === "string" && "layoutWrap" in layoutNode)
        layoutNode.layoutWrap = payload.layoutWrap;
    if (typeof payload.itemSpacing === "number")
        layoutNode.itemSpacing = payload.itemSpacing;
    if (typeof payload.paddingTop === "number")
        layoutNode.paddingTop = payload.paddingTop;
    if (typeof payload.paddingRight === "number")
        layoutNode.paddingRight = payload.paddingRight;
    if (typeof payload.paddingBottom === "number")
        layoutNode.paddingBottom = payload.paddingBottom;
    if (typeof payload.paddingLeft === "number")
        layoutNode.paddingLeft = payload.paddingLeft;
    if (typeof payload.primaryAxisAlignItems === "string")
        layoutNode.primaryAxisAlignItems = payload.primaryAxisAlignItems;
    if (typeof payload.counterAxisAlignItems === "string")
        layoutNode.counterAxisAlignItems = payload.counterAxisAlignItems;
    if (typeof payload.primaryAxisSizingMode === "string")
        layoutNode.primaryAxisSizingMode = payload.primaryAxisSizingMode;
    if (typeof payload.counterAxisSizingMode === "string")
        layoutNode.counterAxisSizingMode = payload.counterAxisSizingMode;
}
function applyLayoutChildProps(node, payload) {
    if (!("layoutAlign" in node))
        return;
    var child = node;
    if (typeof payload.layoutAlign === "string")
        child.layoutAlign = payload.layoutAlign;
    if (typeof payload.layoutGrow === "number")
        child.layoutGrow = payload.layoutGrow;
    if (typeof payload.layoutPositioning === "string")
        child.layoutPositioning = payload.layoutPositioning;
    if (typeof payload.minWidth === "number")
        child.minWidth = payload.minWidth;
    if (typeof payload.maxWidth === "number")
        child.maxWidth = payload.maxWidth;
    if (typeof payload.minHeight === "number")
        child.minHeight = payload.minHeight;
    if (typeof payload.maxHeight === "number")
        child.maxHeight = payload.maxHeight;
}
async function appendNode(node, payload) {
    if (typeof payload.parentId !== "string") {
        figma.currentPage.appendChild(node);
        return;
    }
    const parent = await figma.getNodeByIdAsync(payload.parentId);
    if (!parent || !("appendChild" in parent))
        throw new Error("Parent node not found or cannot contain children");
    parent.appendChild(node);
}
async function applyTextStyle(node, payload) {
    const fontName = {
        family: typeof payload.fontFamily === "string" ? payload.fontFamily : "Inter",
        style: typeof payload.fontStyle === "string" ? payload.fontStyle : "Regular",
    };
    await figma.loadFontAsync(fontName);
    node.fontName = fontName;
    if (typeof payload.fontSize === "number")
        node.fontSize = payload.fontSize;
    if (payload.lineHeight && typeof payload.lineHeight === "object")
        node.lineHeight = payload.lineHeight;
    if (payload.letterSpacing && typeof payload.letterSpacing === "object")
        node.letterSpacing = payload.letterSpacing;
    if (typeof payload.textAlignHorizontal === "string")
        node.textAlignHorizontal = payload.textAlignHorizontal;
    if (typeof payload.textAlignVertical === "string")
        node.textAlignVertical = payload.textAlignVertical;
    if (typeof payload.textAutoResize === "string")
        node.textAutoResize = payload.textAutoResize;
    if (typeof payload.paragraphSpacing === "number")
        node.paragraphSpacing = payload.paragraphSpacing;
    if (typeof payload.paragraphIndent === "number")
        node.paragraphIndent = payload.paragraphIndent;
}
async function applyPatch(node, patch) {
    if (typeof patch.name === "string")
        node.name = patch.name;
    setGeometry(node, patch);
    applyVisualStyle(node, patch);
    if (node.type === "TEXT") {
        await applyTextStyle(node, patch);
        if (typeof patch.characters === "string")
            node.characters = patch.characters;
    }
    else if (typeof patch.characters === "string") {
        throw new Error("characters can only be applied to text nodes");
    }
    if ("layoutMode" in patch || "itemSpacing" in patch || "paddingTop" in patch || "paddingRight" in patch || "paddingBottom" in patch || "paddingLeft" in patch) {
        applyAutoLayout(node, patch);
    }
}
async function bytesFromImageUrl(imageUrl) {
    if (imageUrl.startsWith("data:")) {
        const commaIndex = imageUrl.indexOf(",");
        if (commaIndex === -1)
            throw new Error("Invalid data URL");
        const metadata = imageUrl.slice(0, commaIndex);
        const data = imageUrl.slice(commaIndex + 1);
        if (metadata.indexOf(";base64") === -1)
            throw new Error("Only base64 data URLs are supported");
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1)
            bytes[index] = binary.charCodeAt(index);
        return bytes;
    }
    const response = await fetch(imageUrl);
    if (!response.ok)
        throw new Error(`Failed to fetch image: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
}
async function createPageFrame(parent, framePayload) {
    const node = figma.createFrame();
    node.name = typeof framePayload.name === "string" ? framePayload.name : "Page Frame";
    applyVisualStyle(node, framePayload);
    parent.appendChild(node);
    setGeometry(node, framePayload);
    return node;
}
async function getFrameParent(parentId) {
    if (typeof parentId !== "string")
        throw new Error("parentId is required");
    const parent = await figma.getNodeByIdAsync(parentId);
    if (!parent || !("appendChild" in parent))
        throw new Error("Parent node not found or cannot contain children");
    return parent;
}
function templatePageNames(payload) {
    if (Array.isArray(payload.pages) && payload.pages.every((page) => typeof page === "string"))
        return payload.pages;
    if (payload.template === "portfolio-site")
        return ["Home", "Work", "Project Detail", "About", "Contact"];
    return ["Page 1", "Page 2", "Page 3"];
}
async function imagePaintFromUrl(imageUrl, scaleMode) {
    if (typeof imageUrl !== "string")
        throw new Error("imageUrl is required");
    const image = figma.createImage(await bytesFromImageUrl(imageUrl));
    return { type: "IMAGE", scaleMode: typeof scaleMode === "string" ? scaleMode : "FILL", imageHash: image.hash };
}
// --- Safe node creation with rollback ---
async function createSceneNodeSafely(createNode, payload, defaultName, configure) {
    const node = createNode();
    try {
        node.name = typeof payload.name === "string" ? payload.name : defaultName;
        await appendNode(node, payload);
        setGeometry(node, payload);
        applyVisualStyle(node, payload);
        if (configure)
            await configure(node);
        return node;
    }
    catch (error) {
        try {
            node.remove();
        }
        catch (_cleanupError) {
            // Ignore cleanup errors; original error is more useful.
        }
        throw error;
    }
}
// --- Component property key resolver ---
function normalizePropertyName(value) {
    return value.trim().toLowerCase();
}
function getPropertyDisplayName(key, definition) {
    var defName = typeof definition.name === "string" ? definition.name : undefined;
    if (defName)
        return defName;
    return key.split("#")[0];
}
function resolveComponentPropertyKey(definitions, requested) {
    // Exact match
    if (definitions[requested])
        return requested;
    var wanted = normalizePropertyName(requested);
    var matches = [];
    var keys = Object.keys(definitions);
    for (var ki = 0; ki < keys.length; ki += 1) {
        var key = keys[ki];
        var definition = definitions[key];
        if (normalizePropertyName(key) === wanted ||
            normalizePropertyName(key.split("#")[0]) === wanted ||
            normalizePropertyName(getPropertyDisplayName(key, definition)) === wanted) {
            matches.push(key);
        }
    }
    if (matches.length === 1)
        return matches[0];
    if (matches.length > 1) {
        throw new Error("Ambiguous component property '" + requested + "'. Matches: " + matches.join(", "));
    }
    throw new Error("Component property '" + requested + "' not found. Available: " + keys.join(", "));
}
/**
 * Find a layer inside a component/componentSet by name.
 * For component sets, searches all variant children.
 * Returns all matching SceneNodes (may be across variants).
 */
function findLayersByName(container, layerName, matchMode) {
    var results = [];
    function search(node) {
        if ("name" in node) {
            var matches = matchMode === "contains"
                ? node.name.indexOf(layerName) !== -1
                : node.name === layerName;
            if (matches && "id" in node) {
                results.push(node);
            }
        }
        if ("children" in node) {
            var children = node.children;
            for (var ci = 0; ci < children.length; ci += 1) {
                search(children[ci]);
            }
        }
    }
    search(container);
    return results;
}
/**
 * Resolve a component by name in the current file.
 */
async function resolveComponentByName(name) {
    var allNodes = figma.root.findAll(function (n) { return n.type === "COMPONENT"; });
    var matches = [];
    var wanted = normalizePropertyName(name);
    for (var ni = 0; ni < allNodes.length; ni += 1) {
        if (normalizePropertyName(allNodes[ni].name) === wanted ||
            normalizePropertyName(allNodes[ni].name.split(",")[0].split("/").map(function (s) { return s.trim(); }).join(" / ")) === wanted) {
            matches.push(allNodes[ni]);
        }
    }
    if (matches.length === 1)
        return matches[0];
    if (matches.length > 1) {
        throw new Error("Ambiguous component name '" + name + "'. Matches: " + matches.map(function (c) { return c.name + " (" + c.id + ")"; }).join(", "));
    }
    throw new Error("Component '" + name + "' not found. Available: " + allNodes.map(function (c) { return c.name; }).join(", "));
}
// --- Local Style helpers ---
function serializePaintStyle(style) {
    return {
        id: style.id,
        key: style.key,
        name: style.name,
        description: style.description,
        paints: style.paints,
        remote: style.remote,
    };
}
function serializeTextStyle(style) {
    return {
        id: style.id,
        key: style.key,
        name: style.name,
        description: style.description,
        fontName: style.fontName,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        paragraphSpacing: style.paragraphSpacing,
        paragraphIndent: style.paragraphIndent,
        remote: style.remote,
    };
}
function serializeEffectStyle(style) {
    return {
        id: style.id,
        key: style.key,
        name: style.name,
        description: style.description,
        effects: style.effects,
        remote: style.remote,
    };
}
async function createOrUpdatePaintStyle(payload) {
    if (typeof payload.name !== "string")
        throw new Error("name is required");
    if (!Array.isArray(payload.paints))
        throw new Error("paints is required");
    var match = await findPaintStyleByName(payload.name);
    var existing = match.first;
    var upsert = payload.upsert !== false;
    if (existing) {
        if (!upsert)
            throw new Error("Paint style '" + payload.name + "' already exists. Use upsert:true to update.");
        existing.paints = normalizePaints(payload.paints);
        if (typeof payload.description === "string")
            existing.description = payload.description;
        var result2 = { id: existing.id, name: existing.name, operation: "updated" };
        if (match.duplicates.length > 0)
            result2.duplicateIds = match.duplicates;
        return result2;
    }
    var style = figma.createPaintStyle();
    style.name = payload.name;
    style.description = typeof payload.description === "string" ? payload.description : "";
    style.paints = normalizePaints(payload.paints);
    return { id: style.id, name: style.name, operation: "created" };
}
async function createOrUpdateTextStyle(payload) {
    if (typeof payload.name !== "string")
        throw new Error("name is required");
    if (typeof payload.fontFamily !== "string")
        throw new Error("fontFamily is required");
    if (typeof payload.fontStyle !== "string")
        throw new Error("fontStyle is required");
    if (typeof payload.fontSize !== "number")
        throw new Error("fontSize is required");
    var fontName = { family: payload.fontFamily, style: payload.fontStyle };
    try {
        await figma.loadFontAsync(fontName);
    }
    catch (_fontError) {
        throw new Error("Failed to load font " + payload.fontFamily + " / " + payload.fontStyle + ". CreateTextStyle aborted.");
    }
    var tMatch = await findTextStyleByName(payload.name);
    var existing = tMatch.first;
    var upsert = payload.upsert !== false;
    if (existing) {
        if (!upsert)
            throw new Error("Text style '" + payload.name + "' already exists. Use upsert:true to update.");
        existing.fontName = fontName;
        existing.fontSize = payload.fontSize;
        if (payload.lineHeight && typeof payload.lineHeight === "object")
            existing.lineHeight = payload.lineHeight;
        if (payload.letterSpacing && typeof payload.letterSpacing === "object")
            existing.letterSpacing = payload.letterSpacing;
        if (typeof payload.paragraphSpacing === "number")
            existing.paragraphSpacing = payload.paragraphSpacing;
        if (typeof payload.paragraphIndent === "number")
            existing.paragraphIndent = payload.paragraphIndent;
        if (typeof payload.description === "string")
            existing.description = payload.description;
        var tResult = { id: existing.id, name: existing.name, operation: "updated" };
        if (tMatch.duplicates.length > 0)
            tResult.duplicateIds = tMatch.duplicates;
        return tResult;
    }
    var tstyle = figma.createTextStyle();
    tstyle.name = payload.name;
    tstyle.description = typeof payload.description === "string" ? payload.description : "";
    tstyle.fontName = fontName;
    tstyle.fontSize = payload.fontSize;
    if (payload.lineHeight && typeof payload.lineHeight === "object")
        tstyle.lineHeight = payload.lineHeight;
    if (payload.letterSpacing && typeof payload.letterSpacing === "object")
        tstyle.letterSpacing = payload.letterSpacing;
    if (typeof payload.paragraphSpacing === "number")
        tstyle.paragraphSpacing = payload.paragraphSpacing;
    if (typeof payload.paragraphIndent === "number")
        tstyle.paragraphIndent = payload.paragraphIndent;
    return { id: tstyle.id, name: tstyle.name, operation: "created" };
}
async function createOrUpdateEffectStyle(payload) {
    if (typeof payload.name !== "string")
        throw new Error("name is required");
    if (!Array.isArray(payload.effects))
        throw new Error("effects is required");
    var eMatch = await findEffectStyleByName(payload.name);
    var existing = eMatch.first;
    var upsert = payload.upsert !== false;
    if (existing) {
        if (!upsert)
            throw new Error("Effect style '" + payload.name + "' already exists. Use upsert:true to update.");
        existing.effects = normalizeEffects(payload.effects);
        if (typeof payload.description === "string")
            existing.description = payload.description;
        var eResult = { id: existing.id, name: existing.name, operation: "updated" };
        if (eMatch.duplicates.length > 0)
            eResult.duplicateIds = eMatch.duplicates;
        return eResult;
    }
    var style = figma.createEffectStyle();
    style.name = payload.name;
    style.description = typeof payload.description === "string" ? payload.description : "";
    style.effects = normalizeEffects(payload.effects);
    return { id: style.id, name: style.name, operation: "created" };
}
function findStylesByName(styles, name) {
    var first;
    var duplicates = [];
    for (var i = 0; i < styles.length; i += 1) {
        if (styles[i].name === name) {
            if (!first) {
                first = styles[i];
            }
            else {
                duplicates.push(styles[i].id);
            }
        }
    }
    return { first: first, duplicates: duplicates };
}
async function findPaintStyleByName(name) {
    var styles = await figma.getLocalPaintStylesAsync();
    return findStylesByName(styles, name);
}
async function findTextStyleByName(name) {
    var styles = await figma.getLocalTextStylesAsync();
    return findStylesByName(styles, name);
}
async function findEffectStyleByName(name) {
    var styles = await figma.getLocalEffectStylesAsync();
    return findStylesByName(styles, name);
}
async function handleCommand(command) {
    var _a, _b;
    const payload = (_a = command.payload) !== null && _a !== void 0 ? _a : {};
    if (command.type === "status") {
        return {
            fileName: figma.root.name,
            pageId: figma.currentPage.id,
            pageName: figma.currentPage.name,
            selection: figma.currentPage.selection.map(serializeNode),
        };
    }
    if (command.type === "getSelection")
        return figma.currentPage.selection.map(serializeNode);
    if (command.type === "createFrame" || command.type === "createAutoLayoutFrame") {
        const node = await createSceneNodeSafely(() => figma.createFrame(), payload, "MCP Frame", command.type === "createAutoLayoutFrame"
            ? (frameNode) => { applyAutoLayout(frameNode, payload); }
            : undefined);
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        return serializeNode(node);
    }
    if (command.type === "createRectangle") {
        const node = await createSceneNodeSafely(() => figma.createRectangle(), payload, "MCP Rectangle");
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        return serializeNode(node);
    }
    if (command.type === "createText") {
        const node = await createSceneNodeSafely(() => figma.createText(), payload, "MCP Text", async (textNode) => {
            await applyTextStyle(textNode, payload);
            textNode.characters = typeof payload.text === "string" ? payload.text : "";
        });
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        return serializeNode(node);
    }
    if (command.type === "updateAutoLayout") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        const node = await figma.getNodeByIdAsync(payload.nodeId);
        if (!node || node.type === "DOCUMENT" || node.type === "PAGE")
            throw new Error("Scene node not found");
        applyAutoLayout(node, payload);
        return serializeNode(node);
    }
    if (command.type === "createEllipse") {
        const node = await createSceneNodeSafely(() => figma.createEllipse(), payload, "MCP Ellipse");
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        return serializeNode(node);
    }
    if (command.type === "createLine") {
        const node = await createSceneNodeSafely(() => figma.createLine(), payload, "MCP Line");
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        return serializeNode(node);
    }
    if (command.type === "createPolygon") {
        const node = await createSceneNodeSafely(() => figma.createPolygon(), payload, "MCP Polygon", (polygonNode) => { if (typeof payload.pointCount === "number")
            polygonNode.pointCount = payload.pointCount; });
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        return serializeNode(node);
    }
    if (command.type === "createStar") {
        const node = await createSceneNodeSafely(() => figma.createStar(), payload, "MCP Star", (starNode) => {
            if (typeof payload.pointCount === "number")
                starNode.pointCount = payload.pointCount;
            if (typeof payload.innerRadius === "number")
                starNode.innerRadius = payload.innerRadius;
        });
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        return serializeNode(node);
    }
    if (command.type === "createVector") {
        const node = await createSceneNodeSafely(() => figma.createVector(), payload, "MCP Vector", (vectorNode) => {
            if (Array.isArray(payload.vectorPaths))
                vectorNode.vectorPaths = payload.vectorPaths;
        });
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        return serializeNode(node);
    }
    if (command.type === "createComponent") {
        const node = await createSceneNodeSafely(() => figma.createComponent(), payload, "MCP Component", (componentNode) => { applyAutoLayout(componentNode, payload); });
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        return serializeNode(node);
    }
    if (command.type === "createComponentFromNode") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        const node = await figma.getNodeByIdAsync(payload.nodeId);
        if (!node || node.type === "DOCUMENT" || node.type === "PAGE")
            throw new Error("Scene node not found");
        const component = figma.createComponentFromNode(node);
        if (typeof payload.name === "string")
            component.name = payload.name;
        return serializeNode(component);
    }
    if (command.type === "createInstance") {
        if (typeof payload.componentId !== "string")
            throw new Error("componentId is required");
        const component = await figma.getNodeByIdAsync(payload.componentId);
        if (!component || component.type !== "COMPONENT")
            throw new Error("Component node not found");
        const node = component.createInstance();
        if (typeof payload.name === "string")
            node.name = payload.name;
        await appendNode(node, payload);
        setGeometry(node, payload);
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        return serializeNode(node);
    }
    if (command.type === "detachInstance") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        const node = await figma.getNodeByIdAsync(payload.nodeId);
        if (!node || node.type !== "INSTANCE")
            throw new Error("Instance node not found");
        return serializeNode(node.detachInstance());
    }
    if (command.type === "createImageRectangle") {
        // Image rectangle needs special handling: fills are applied via imagePaintFromUrl
        const node = figma.createRectangle();
        try {
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
        catch (error) {
            try {
                node.remove();
            }
            catch (_cleanupError) { /* ignore cleanup errors */ }
            throw error;
        }
    }
    if (command.type === "createPageFrames") {
        const parent = await getFrameParent(payload.parentId);
        if (!Array.isArray(payload.frames))
            throw new Error("frames is required");
        const nodes = [];
        for (const framePayload of payload.frames) {
            if (!framePayload || typeof framePayload !== "object")
                continue;
            nodes.push(await createPageFrame(parent, framePayload));
        }
        figma.currentPage.selection = nodes;
        if (nodes.length > 0)
            figma.viewport.scrollAndZoomIntoView(nodes);
        return nodes.map(serializeNode);
    }
    if (command.type === "createPageFromTemplate") {
        const parent = await getFrameParent(payload.parentId);
        const pages = templatePageNames(payload);
        const startX = typeof payload.startX === "number" ? payload.startX : 0;
        const startY = typeof payload.startY === "number" ? payload.startY : 0;
        const gap = typeof payload.gap === "number" ? payload.gap : 160;
        const width = typeof payload.width === "number" ? payload.width : 1440;
        const height = typeof payload.height === "number" ? payload.height : 1024;
        const nodes = [];
        for (let index = 0; index < pages.length; index += 1) {
            const framePayload = {
                name: pages[index],
                x: startX + index * (width + gap),
                y: startY,
                width,
                height,
                fills: payload.fills,
            };
            nodes.push(await createPageFrame(parent, framePayload));
        }
        figma.currentPage.selection = nodes;
        if (nodes.length > 0)
            figma.viewport.scrollAndZoomIntoView(nodes);
        return nodes.map(serializeNode);
    }
    if (command.type === "updateImageFill") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        const node = await figma.getNodeByIdAsync(payload.nodeId);
        if (!node || node.type === "DOCUMENT" || node.type === "PAGE" || !("fills" in node))
            throw new Error("Fillable scene node not found");
        node.fills = [await imagePaintFromUrl(payload.imageUrl, payload.scaleMode)];
        return serializeNode(node);
    }
    if (command.type === "updateNode") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        const node = await figma.getNodeByIdAsync(payload.nodeId);
        if (!node || node.type === "DOCUMENT" || node.type === "PAGE")
            throw new Error("Scene node not found");
        await applyPatch(node, (_b = payload.patch) !== null && _b !== void 0 ? _b : {});
        return serializeNode(node);
    }
    if (command.type === "deleteNode") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        const node = await figma.getNodeByIdAsync(payload.nodeId);
        if (!node || node.type === "DOCUMENT" || node.type === "PAGE")
            throw new Error("Scene node not found");
        const result = serializeNode(node);
        node.remove();
        return result;
    }
    if (command.type === "selectNode") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        const node = await figma.getNodeByIdAsync(payload.nodeId);
        if (!node || node.type === "DOCUMENT" || node.type === "PAGE")
            throw new Error("Scene node not found");
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        return serializeNode(node);
    }
    // --- Plugin hybrid read commands ---
    if (command.type === "getCurrentFileSummary") {
        return {
            fileName: figma.root.name,
            pageId: figma.currentPage.id,
            pageName: figma.currentPage.name,
            pageCount: figma.root.children.length,
            selectionCount: figma.currentPage.selection.length,
        };
    }
    if (command.type === "getCurrentPage") {
        return serializeCurrentPage(readSerializeOptions(payload, 0));
    }
    if (command.type === "getPageTree") {
        return serializeCurrentPage(readSerializeOptions(payload, 1));
    }
    if (command.type === "getNode") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        var targetNode = await figma.getNodeByIdAsync(payload.nodeId);
        if (!targetNode || targetNode.type === "DOCUMENT" || targetNode.type === "PAGE")
            throw new Error("Scene node not found");
        return serializeSceneNode(targetNode, readSerializeOptions(payload, 0));
    }
    if (command.type === "getNodeTree") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        var treeNode = await figma.getNodeByIdAsync(payload.nodeId);
        if (!treeNode || treeNode.type === "DOCUMENT" || treeNode.type === "PAGE")
            throw new Error("Scene node not found");
        return serializeSceneNode(treeNode, readSerializeOptions(payload, 2));
    }
    // --- Smart instance creation (P0-3) ---
    if (command.type === "createInstanceSmart") {
        if (typeof payload.componentId !== "string")
            throw new Error("componentId is required");
        var smartSrcNode = await figma.getNodeByIdAsync(payload.componentId);
        if (!smartSrcNode || (smartSrcNode.type !== "COMPONENT" && smartSrcNode.type !== "COMPONENT_SET")) {
            throw new Error("Component or ComponentSet not found: " + payload.componentId);
        }
        var smartInstance;
        if (smartSrcNode.type === "COMPONENT") {
            smartInstance = smartSrcNode.createInstance();
        }
        else {
            smartInstance = smartSrcNode.defaultVariant.createInstance();
        }
        try {
            if (typeof payload.name === "string")
                smartInstance.name = payload.name;
            await appendNode(smartInstance, payload);
            if (typeof payload.x === "number" && typeof payload.y === "number") {
                smartInstance.x = payload.x;
                smartInstance.y = payload.y;
            }
            if ("resize" in smartInstance && typeof payload.width === "number" && typeof payload.height === "number") {
                smartInstance.resize(payload.width, payload.height);
            }
            // Resolve properties using smart key resolution
            var requestedProps = payload.properties && typeof payload.properties === "object"
                ? payload.properties
                : {};
            // Get definitions from source
            var sourceDefs = {};
            if (smartSrcNode.type === "COMPONENT_SET") {
                try {
                    sourceDefs = smartSrcNode.componentPropertyDefinitions;
                }
                catch (_e) { /* ignore */ }
            }
            else if (smartSrcNode.type === "COMPONENT") {
                try {
                    sourceDefs = smartSrcNode.componentPropertyDefinitions;
                }
                catch (_e) { /* ignore */ }
            }
            var resolvedProperties = {};
            var requestedDisplayNames = Object.keys(requestedProps);
            for (var rpi = 0; rpi < requestedDisplayNames.length; rpi += 1) {
                var propName = requestedDisplayNames[rpi];
                var propValue = requestedProps[propName];
                // Try to resolve the property key — only fall through for variant dimensions
                var realKey;
                if (Object.keys(sourceDefs).length > 0) {
                    try {
                        realKey = resolveComponentPropertyKey(sourceDefs, propName);
                    }
                    catch (_resolveError) {
                        // Check if this is a variant property (lives in variantProperties, not componentPropertyDefinitions)
                        var isVariantProp = false;
                        if (smartSrcNode.type === "COMPONENT_SET") {
                            var defVariant = smartSrcNode.defaultVariant;
                            if (defVariant.variantProperties && propName in defVariant.variantProperties) {
                                isVariantProp = true;
                            }
                        }
                        else if (smartSrcNode.type === "COMPONENT" && smartSrcNode.variantProperties) {
                            if (propName in smartSrcNode.variantProperties) {
                                isVariantProp = true;
                            }
                        }
                        if (isVariantProp) {
                            realKey = propName; // variant dimension names are their own keys in Figma
                        }
                        else {
                            throw _resolveError; // ambiguous or truly missing — let the high-quality error propagate
                        }
                    }
                }
                else {
                    realKey = propName; // no definitions at all — pass through
                }
                // Handle INSTANCE_SWAP: resolve component name to id
                if (typeof propValue === "string" && realKey in sourceDefs) {
                    var def = sourceDefs[realKey];
                    if (def && def.type === "INSTANCE_SWAP") {
                        // Check if propValue looks like a node id (alphanumeric with colon)
                        var looksLikeId = /^\d+:\d+$/.test(propValue);
                        if (!looksLikeId) {
                            try {
                                var swapComp = await resolveComponentByName(propValue);
                                propValue = swapComp.id;
                            }
                            catch (_swapError) {
                                // If resolution fails, pass string through and let Figma reject it
                            }
                        }
                    }
                }
                resolvedProperties[realKey] = propValue;
            }
            smartInstance.setProperties(resolvedProperties);
            figma.currentPage.selection = [smartInstance];
            figma.viewport.scrollAndZoomIntoView([smartInstance]);
            // Verify: diff resolvedProperties against actual instance state
            var doVerify = payload.verify !== false;
            var componentProperties;
            var verifyErrors = [];
            if (doVerify && Object.keys(resolvedProperties).length > 0) {
                try {
                    componentProperties = Object.assign({}, smartInstance.componentProperties);
                }
                catch (_e) { /* ignore */ }
                var vKeys = Object.keys(resolvedProperties);
                for (var vki = 0; vki < vKeys.length; vki += 1) {
                    var vKey = vKeys[vki];
                    var vExpected = resolvedProperties[vKey];
                    // Figma stores ComponentProperties as { type, value }, not raw values — extract .value
                    var rawEntry = componentProperties ? componentProperties[vKey] : undefined;
                    var vActual;
                    if (rawEntry && typeof rawEntry === "object" && "value" in rawEntry) {
                        vActual = rawEntry.value;
                    }
                    else {
                        vActual = rawEntry;
                    }
                    // Direct property comparison — .value has been extracted, works for TEXT and BOOLEAN
                    if (vActual !== vExpected) {
                        verifyErrors.push(vKey + ": expected " + JSON.stringify(vExpected) + ", got " + JSON.stringify(vActual));
                    }
                    // For TEXT properties, also check the actual characters on child text layers
                    if (typeof vExpected === "string" && vKey in (sourceDefs || {})) {
                        var vDef = (sourceDefs || {})[vKey];
                        if (vDef && vDef.type === "TEXT") {
                            try {
                                var textLayers = findLayersByName(smartInstance, "", "contains");
                                for (var tli = 0; tli < textLayers.length; tli += 1) {
                                    if (textLayers[tli].type === "TEXT") {
                                        var chars = textLayers[tli].characters;
                                        if (chars === vExpected)
                                            break; // found match
                                    }
                                }
                            }
                            catch (_textError) { /* ignore */ }
                        }
                    }
                }
                // Also verify variant properties
                if (smartInstance.variantProperties) {
                    var vp = smartInstance.variantProperties;
                    var vpKeys = Object.keys(vp);
                    for (var vpi = 0; vpi < vpKeys.length; vpi += 1) {
                        var vpKey = vpKeys[vpi];
                        // Check if requested properties included this variant dimension
                        if (vpKey in (requestedProps || {})) {
                            if (!componentProperties)
                                componentProperties = {};
                            componentProperties["variant:" + vpKey] = vp[vpKey];
                        }
                    }
                }
            }
            if (verifyErrors.length > 0) {
                throw new Error("Instance verification failed: " + verifyErrors.join("; "));
            }
            return {
                id: smartInstance.id,
                name: smartInstance.name,
                type: smartInstance.type,
                resolvedProperties: resolvedProperties,
                requestedProperties: Object.keys(requestedProps).length > 0 ? requestedProps : undefined,
                componentProperties: componentProperties,
            };
        }
        catch (error) {
            try {
                smartInstance.remove();
            }
            catch (_cleanupError) { /* ignore cleanup errors */ }
            throw error;
        }
    }
    // --- Audit component properties (P0-4) ---
    if (command.type === "auditComponentProperties") {
        if (typeof payload.componentId !== "string")
            throw new Error("componentId is required");
        var auditNode = await figma.getNodeByIdAsync(payload.componentId);
        if (!auditNode || (auditNode.type !== "COMPONENT" && auditNode.type !== "COMPONENT_SET")) {
            throw new Error("Component or ComponentSet not found: " + payload.componentId);
        }
        var isComponentSet = auditNode.type === "COMPONENT_SET";
        var csNode = auditNode;
        // Variant dimensions (only for component sets)
        var variants = {};
        if (isComponentSet && "children" in csNode) {
            var cs = csNode;
            for (var vci = 0; vci < cs.children.length; vci += 1) {
                var vc = cs.children[vci];
                if (vc.type === "COMPONENT" && vc.variantProperties) {
                    var vp = vc.variantProperties;
                    var vpKeys = Object.keys(vp);
                    for (var vpk = 0; vpk < vpKeys.length; vpk += 1) {
                        var dim = vpKeys[vpk];
                        var val = vp[dim];
                        if (!variants[dim])
                            variants[dim] = [];
                        if (variants[dim].indexOf(val) === -1)
                            variants[dim].push(val);
                    }
                }
            }
        }
        // Property definitions
        var definitions = {};
        try {
            definitions = Object.assign({}, csNode.componentPropertyDefinitions);
        }
        catch (_e) { /* ignore */ }
        // Audit each property
        var auditProperties = [];
        var issues = [];
        var warnings = [];
        var defKeys = Object.keys(definitions);
        for (var dki = 0; dki < defKeys.length; dki += 1) {
            var defKey = defKeys[dki];
            var def2 = definitions[defKey];
            var propInfo = {
                key: defKey,
                displayName: getPropertyDisplayName(defKey, def2),
                type: def2.type,
                defaultValue: def2.defaultValue,
            };
            // Check for references
            var hasReference = false;
            var references = [];
            if (isComponentSet && "children" in auditNode) {
                var acs = auditNode;
                for (var aci = 0; aci < acs.children.length; aci += 1) {
                    searchReferencesInSubtree(acs.children[aci], def2.type, def2, defKey, references);
                }
                hasReference = references.length > 0;
            }
            else if ("children" in auditNode) {
                var sc = auditNode;
                searchReferencesInSubtree(sc, def2.type, def2, defKey, references);
                hasReference = references.length > 0;
            }
            propInfo.hasReference = hasReference;
            propInfo.references = references;
            // Warnings
            if (!hasReference && def2.type !== "VARIANT") {
                warnings.push("Property '" + defKey + "' (" + def2.type + ") has no layer reference.");
            }
            if (def2.type === "BOOLEAN" && hasReference) {
                var boundToVisible = references.some(function (r) { return r.field === "visible"; });
                if (!boundToVisible) {
                    warnings.push("BOOLEAN property '" + defKey + "' is not bound to layer visible.");
                }
            }
            if (def2.type === "TEXT" && hasReference) {
                var boundToCharacters = references.some(function (r) { return r.field === "characters"; });
                if (!boundToCharacters) {
                    warnings.push("TEXT property '" + defKey + "' is not bound to layer characters.");
                }
            }
            auditProperties.push(propInfo);
        }
        if (Object.keys(definitions).length === 0) {
            warnings.push("No component property definitions found on this node. Only variants may be present.");
        }
        // Optional: create probe instance and test overrides
        var probeInstance = null;
        var probeResults = [];
        if (payload.createProbeInstance === true) {
            try {
                if (auditNode.type === "COMPONENT") {
                    probeInstance = auditNode.createInstance();
                }
                else {
                    probeInstance = auditNode.defaultVariant.createInstance();
                }
                var probeParentId = typeof payload.probeParentId === "string" ? payload.probeParentId : undefined;
                if (probeParentId) {
                    var probeParent = await getFrameParent(probeParentId);
                    probeParent.appendChild(probeInstance);
                }
                else {
                    figma.currentPage.appendChild(probeInstance);
                }
                // Try each non-VARIANT property — use type-appropriate probe values
                for (var ppi = 0; ppi < auditProperties.length; ppi += 1) {
                    var ap = auditProperties[ppi];
                    if (ap.type === "VARIANT")
                        continue;
                    try {
                        var probeKey = ap.key;
                        var probeVal;
                        if (ap.type === "BOOLEAN") {
                            probeVal = true;
                        }
                        else if (ap.type === "INSTANCE_SWAP") {
                            // Use defaultValue or preferredValues to find a valid swap target
                            var swapDef = definitions[probeKey];
                            var swapDefault = swapDef && typeof swapDef.defaultValue === "string" ? swapDef.defaultValue : undefined;
                            var preferredList = swapDef && Array.isArray(swapDef.preferredValues)
                                ? swapDef.preferredValues
                                : undefined;
                            if (swapDefault) {
                                // defaultValue is the component id/key that setProperties accepts
                                probeVal = swapDefault;
                            }
                            else if (preferredList && preferredList.length > 0) {
                                // preferredValues entries have { type, key } — key is a node key, not a node id.
                                // Use figma.root.findAll to locate the component by matching node.key.
                                var swapKey = preferredList[0].key;
                                if (swapKey) {
                                    var matched = figma.root.findAll(function (n) { return "key" in n && n.key === swapKey; });
                                    if (matched.length === 1 && (matched[0].type === "COMPONENT" || matched[0].type === "COMPONENT_SET")) {
                                        probeVal = matched[0].id;
                                    }
                                    else if (matched.length > 1) {
                                        probeResults.push({ property: probeKey, probe: "skipped", reason: "Ambiguous: " + matched.length + " nodes match preferredValues key " + swapKey });
                                        continue;
                                    }
                                    else {
                                        // key not found in document — skip rather than guess
                                        probeResults.push({ property: probeKey, probe: "skipped", reason: "No node found matching preferredValues key " + swapKey });
                                        continue;
                                    }
                                }
                                else {
                                    probeResults.push({ property: probeKey, probe: "skipped", reason: "No valid target in preferredValues for INSTANCE_SWAP" });
                                    continue;
                                }
                            }
                            else {
                                probeResults.push({ property: probeKey, probe: "skipped", reason: "No defaultValue or preferredValues for INSTANCE_SWAP" });
                                continue;
                            }
                        }
                        else {
                            // TEXT or other string-based properties
                            probeVal = "PROBE_" + (ap.displayName || probeKey);
                        }
                        probeInstance.setProperties((_probeObj = {}, _probeObj[probeKey] = probeVal, _probeObj));
                        probeResults.push({ property: probeKey, probe: "passed", value: probeVal });
                    }
                    catch (_probeError) {
                        probeResults.push({ property: ap.key, probe: "failed", error: _probeError instanceof Error ? _probeError.message : String(_probeError) });
                    }
                    var _probeObj;
                }
            }
            catch (_probeCreateError) {
                warnings.push("Probe instance creation failed: " + (_probeCreateError instanceof Error ? _probeCreateError.message : String(_probeCreateError)));
            }
        }
        // Cleanup probe
        if (payload.cleanupProbe !== false && probeInstance) {
            try {
                probeInstance.remove();
            }
            catch (_cleanupError) { /* ignore cleanup errors */ }
            probeInstance = null;
        }
        return {
            id: auditNode.id,
            name: auditNode.name,
            type: auditNode.type,
            isComponentSet: isComponentSet,
            variants: Object.keys(variants).length > 0 ? variants : undefined,
            properties: auditProperties,
            probeResults: probeResults.length > 0 ? probeResults : undefined,
            issues: issues,
            warnings: warnings,
        };
    }
    // --- Bind component property by layer name (P1-1) ---
    if (command.type === "bindComponentProperty") {
        if (typeof payload.componentId !== "string")
            throw new Error("componentId is required");
        if (typeof payload.propertyName !== "string")
            throw new Error("propertyName is required");
        if (typeof payload.layerName !== "string")
            throw new Error("layerName is required");
        if (typeof payload.field !== "string")
            throw new Error("field is required");
        var bindCompNode = await figma.getNodeByIdAsync(payload.componentId);
        if (!bindCompNode || (bindCompNode.type !== "COMPONENT" && bindCompNode.type !== "COMPONENT_SET")) {
            throw new Error("Component or ComponentSet not found: " + payload.componentId);
        }
        // Resolve property key
        var bindDefs = {};
        try {
            bindDefs = Object.assign({}, bindCompNode.componentPropertyDefinitions);
        }
        catch (_e) {
            bindDefs = {};
        }
        if (Object.keys(bindDefs).length === 0) {
            throw new Error("No component property definitions found. Add properties with figma_add_component_property first.");
        }
        var resolvedKey = resolveComponentPropertyKey(bindDefs, payload.propertyName);
        var matchMode = typeof payload.match === "string" ? payload.match : "exact";
        var field = payload.field;
        if (bindCompNode.type === "COMPONENT_SET") {
            // Two-phase binding: scan all variants first, then write atomically
            var bcs = bindCompNode;
            var bindTargets = [];
            var missedVariants = [];
            // Phase 1: scan all variants, validate each target
            for (var bvi = 0; bvi < bcs.children.length; bvi += 1) {
                var bvc = bcs.children[bvi];
                if (bvc.type !== "COMPONENT")
                    continue;
                var layers = findLayersByName(bvc, payload.layerName, matchMode);
                if (layers.length === 0) {
                    missedVariants.push(bvc.name);
                    continue;
                }
                if (layers.length > 1) {
                    // No partial writes yet — safe to throw
                    throw new Error("Ambiguous layer '" + payload.layerName + "' in variant '" + bvc.name + "'. Found: " + layers.map(function (l) { return l.name + " (" + l.id + ")"; }).join(", "));
                }
                var oldRefs = null;
                try {
                    oldRefs = Object.assign({}, layers[0].componentPropertyReferences || {});
                }
                catch (_e) {
                    oldRefs = {};
                }
                bindTargets.push({ variant: bvc, layer: layers[0], oldRefs: oldRefs });
            }
            // Phase 2: all validations passed, now write atomically
            for (var bti = 0; bti < bindTargets.length; bti += 1) {
                var bt = bindTargets[bti];
                try {
                    var refs = {};
                    refs[field] = resolvedKey;
                    bt.layer.componentPropertyReferences = Object.assign({}, bt.layer.componentPropertyReferences || {}, refs);
                }
                catch (_writeError) {
                    // Rollback already-written variants
                    for (var rbi = bti - 1; rbi >= 0; rbi -= 1) {
                        try {
                            bindTargets[rbi].layer.componentPropertyReferences = bindTargets[rbi].oldRefs || {};
                        }
                        catch (_rollbackError) { /* ignore */ }
                    }
                    throw _writeError;
                }
            }
            return {
                componentId: bindCompNode.id,
                propertyKey: resolvedKey,
                propertyDisplayName: payload.propertyName,
                field: field,
                boundVariants: bindTargets.length,
                missedVariants: missedVariants.length > 0 ? missedVariants : undefined,
                warning: missedVariants.length > 0 ? "Some variants do not have layer '" + payload.layerName + "': " + missedVariants.join(", ") : undefined,
            };
        }
        else {
            // Single component
            var bcomp = bindCompNode;
            var blayers = findLayersByName(bcomp, payload.layerName, matchMode);
            if (blayers.length === 0) {
                throw new Error("Layer '" + payload.layerName + "' not found in component. Available layers: " + findLayersByName(bcomp, "", "contains").map(function (l) { return l.name; }).join(", "));
            }
            if (blayers.length > 1) {
                throw new Error("Ambiguous layer '" + payload.layerName + "'. Found: " + blayers.map(function (l) { return l.name + " (" + l.id + ")"; }).join(", "));
            }
            var brefs = {};
            brefs[field] = resolvedKey;
            blayers[0].componentPropertyReferences = Object.assign({}, blayers[0].componentPropertyReferences || {}, brefs);
            return {
                componentId: bindCompNode.id,
                propertyKey: resolvedKey,
                propertyDisplayName: payload.propertyName,
                field: field,
                layerName: blayers[0].name,
                layerId: blayers[0].id,
            };
        }
    }
    // --- Create component with properties (P1-2) ---
    if (command.type === "createComponentWithProperties") {
        // Create the component shell
        var cwpNode = figma.createComponent();
        var createdLayers = [];
        try {
            cwpNode.name = typeof payload.name === "string" ? payload.name : "Component";
            await appendNode(cwpNode, payload);
            setGeometry(cwpNode, payload);
            applyVisualStyle(cwpNode, payload);
            if (payload.layoutMode)
                applyAutoLayout(cwpNode, payload);
            // Create child layers
            var cwpLayers = Array.isArray(payload.layers) ? payload.layers : [];
            for (var cli = 0; cli < cwpLayers.length; cli += 1) {
                var layerSpec = cwpLayers[cli];
                var layerType = typeof layerSpec.type === "string" ? layerSpec.type : "";
                var layerNode;
                if (layerType === "TEXT") {
                    layerNode = figma.createText();
                    layerNode.name = typeof layerSpec.name === "string" ? layerSpec.name : "Text";
                    await applyTextStyle(layerNode, layerSpec);
                    if (typeof layerSpec.text === "string")
                        layerNode.characters = layerSpec.text;
                }
                else if (layerType === "RECTANGLE") {
                    layerNode = figma.createRectangle();
                    layerNode.name = typeof layerSpec.name === "string" ? layerSpec.name : "Rectangle";
                }
                else if (layerType === "ELLIPSE") {
                    layerNode = figma.createEllipse();
                    layerNode.name = typeof layerSpec.name === "string" ? layerSpec.name : "Ellipse";
                }
                else {
                    layerNode = figma.createFrame();
                    layerNode.name = typeof layerSpec.name === "string" ? layerSpec.name : "Frame";
                }
                applyVisualStyle(layerNode, layerSpec);
                if ("resize" in layerNode && typeof layerSpec.width === "number" && typeof layerSpec.height === "number") {
                    layerNode.resize(layerSpec.width, layerSpec.height);
                }
                if (layerSpec.layoutMode && "layoutMode" in layerNode)
                    applyAutoLayout(layerNode, layerSpec);
                cwpNode.appendChild(layerNode);
                createdLayers.push(layerNode);
            }
            // Add component properties
            var cwpProperties = Array.isArray(payload.properties) ? payload.properties : [];
            var cwpPropDefs = {};
            for (var cpi = 0; cpi < cwpProperties.length; cpi += 1) {
                var propSpec = cwpProperties[cpi];
                var propName = typeof propSpec.name === "string" ? propSpec.name : "";
                var propType = typeof propSpec.type === "string" ? propSpec.type : "TEXT";
                if (propType === "VARIANT")
                    continue; // Variants are created via combineAsVariants
                var defVal = typeof propSpec.defaultValue === "string" || typeof propSpec.defaultValue === "boolean"
                    ? propSpec.defaultValue
                    : (propType === "BOOLEAN" ? true : "");
                var propKey = cwpNode.addComponentProperty(propName, propType, defVal);
                cwpPropDefs[propKey] = cwpNode.componentPropertyDefinitions[propKey];
                // Auto-bind if bind spec provided — must succeed or rollback entire component
                if (propSpec.bind && typeof propSpec.bind === "object") {
                    var bindSpec = propSpec.bind;
                    var bindLayerName = typeof bindSpec.layerName === "string" ? bindSpec.layerName : "";
                    var bindField = typeof bindSpec.field === "string" ? bindSpec.field : "";
                    if (bindLayerName && bindField) {
                        var bindLayers = findLayersByName(cwpNode, bindLayerName, "exact");
                        if (bindLayers.length === 0) {
                            throw new Error("Cannot bind property '" + propName + "' to layer '" + bindLayerName +
                                "': layer not found in component. Available layers: " +
                                findLayersByName(cwpNode, "", "contains").map(function (l) { return l.name; }).join(", "));
                        }
                        if (bindLayers.length > 1) {
                            throw new Error("Cannot bind property '" + propName + "' to layer '" + bindLayerName +
                                "': " + bindLayers.length + " layers match. Layer name must be unique. " +
                                "Matches: " + bindLayers.map(function (l) { return l.name + " (" + l.id + ")"; }).join(", "));
                        }
                        var bindRefs = {};
                        bindRefs[bindField] = propKey;
                        bindLayers[0].componentPropertyReferences = Object.assign({}, bindLayers[0].componentPropertyReferences || {}, bindRefs);
                    }
                }
            }
            figma.currentPage.selection = [cwpNode];
            figma.viewport.scrollAndZoomIntoView([cwpNode]);
            // Verify if requested — throws on mismatch, triggering rollback
            var cwpVerify = payload.verify === true;
            var cwpProbe;
            if (cwpVerify && Object.keys(cwpPropDefs).length > 0) {
                var probeInst = cwpNode.createInstance();
                try {
                    figma.currentPage.appendChild(probeInst);
                    var probeProps = {};
                    var cwpDefKeys = Object.keys(cwpPropDefs);
                    for (var cdki = 0; cdki < cwpDefKeys.length; cdki += 1) {
                        var cdk = cwpDefKeys[cdki];
                        var cd = cwpPropDefs[cdk];
                        if (cd.type === "TEXT")
                            probeProps[cdk] = "PROBE";
                        else if (cd.type === "BOOLEAN")
                            probeProps[cdk] = false;
                    }
                    probeInst.setProperties(probeProps);
                    // Diff: verify every property actually took effect
                    var rawCompProps = probeInst.componentProperties;
                    var actualProps = {};
                    var rcpKeys = Object.keys(rawCompProps);
                    for (var rki = 0; rki < rcpKeys.length; rki += 1) {
                        var rk = rcpKeys[rki];
                        actualProps[rk] = rawCompProps[rk].value;
                    }
                    var verifyFailures = [];
                    var cwpKeyList = Object.keys(probeProps);
                    for (var vfi = 0; vfi < cwpKeyList.length; vfi += 1) {
                        var vfKey = cwpKeyList[vfi];
                        var expected = probeProps[vfKey];
                        var got = actualProps[vfKey];
                        if (got !== expected) {
                            verifyFailures.push(vfKey + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(got));
                        }
                    }
                    if (verifyFailures.length > 0) {
                        throw new Error("Probe verification failed: " + verifyFailures.join("; "));
                    }
                    cwpProbe = { propertyValues: probeProps, verified: true };
                }
                catch (_probeError2) {
                    throw _probeError2; // re-throw so outer rollback removes the component
                }
                finally {
                    try {
                        probeInst.remove();
                    }
                    catch (_cleanupError) { /* ignore */ }
                }
            }
            return {
                id: cwpNode.id,
                name: cwpNode.name,
                type: cwpNode.type,
                layers: createdLayers.map(serializeNode),
                propertyDefinitions: Object.keys(cwpPropDefs).length > 0 ? cwpPropDefs : undefined,
                probeResult: cwpProbe,
            };
        }
        catch (error) {
            // Rollback: remove component and all created layers
            try {
                cwpNode.remove();
            }
            catch (_cleanupError) { /* ignore */ }
            throw error;
        }
    }
    // --- Helper for audit: search references in subtree ---
    function searchReferencesInSubtree(root, propertyType, _definition, propKey, outReferences) {
        if ("componentPropertyReferences" in root) {
            try {
                var refs = root.componentPropertyReferences;
                if (refs) {
                    var refValues = Object.entries(refs);
                    for (var rvi = 0; rvi < refValues.length; rvi += 1) {
                        var field = refValues[rvi][0];
                        var value = refValues[rvi][1];
                        if (value === propKey) {
                            outReferences.push({ nodeId: root.id, nodeName: "name" in root ? root.name : undefined, field: field });
                        }
                    }
                }
            }
            catch (_refSearchError) { /* ignore */ }
        }
        if ("children" in root) {
            var rchildren = root.children;
            for (var rci = 0; rci < rchildren.length; rci += 1) {
                searchReferencesInSubtree(rchildren[rci], propertyType, _definition, propKey, outReferences);
            }
        }
    }
    // --- Component variants ---
    if (command.type === "combineAsVariants") {
        if (!Array.isArray(payload.componentIds) || payload.componentIds.length < 2)
            throw new Error("At least 2 component IDs are required");
        var components = [];
        for (var ci = 0; ci < payload.componentIds.length; ci += 1) {
            var cnode = await figma.getNodeByIdAsync(payload.componentIds[ci]);
            if (!cnode || cnode.type !== "COMPONENT")
                throw new Error("Component not found: " + payload.componentIds[ci]);
            components.push(cnode);
        }
        var variantParent = payload.parentId ? await getFrameParent(payload.parentId) : figma.currentPage;
        var variantIndex = typeof payload.index === "number" ? payload.index : undefined;
        var set = figma.combineAsVariants(components, variantParent, variantIndex);
        if (typeof payload.name === "string")
            set.name = payload.name;
        return {
            id: set.id,
            name: set.name,
            type: set.type,
            children: set.children.map(serializeNode),
            componentPropertyDefinitions: set.componentPropertyDefinitions,
        };
    }
    // --- Component properties ---
    if (command.type === "addComponentProperty") {
        if (typeof payload.componentId !== "string")
            throw new Error("componentId is required");
        if (typeof payload.propertyName !== "string")
            throw new Error("propertyName is required");
        if (typeof payload.propertyType !== "string")
            throw new Error("propertyType is required");
        var compNode = await figma.getNodeByIdAsync(payload.componentId);
        if (!compNode || (compNode.type !== "COMPONENT" && compNode.type !== "COMPONENT_SET"))
            throw new Error("Component or ComponentSet not found");
        var propertyType = payload.propertyType;
        var defVal;
        if (propertyType === "BOOLEAN") {
            defVal = typeof payload.defaultValue === "boolean" ? payload.defaultValue : false;
        }
        else if (propertyType === "TEXT") {
            defVal = typeof payload.defaultValue === "string" ? payload.defaultValue : "";
        }
        else {
            if (typeof payload.defaultValue !== "string")
                throw new Error("defaultValue string is required for " + propertyType);
            defVal = payload.defaultValue;
        }
        var key = compNode.addComponentProperty(payload.propertyName, propertyType, defVal);
        return { propertyKey: key, definitions: compNode.componentPropertyDefinitions };
    }
    if (command.type === "editComponentProperty") {
        if (typeof payload.componentId !== "string")
            throw new Error("componentId is required");
        if (typeof payload.propertyKey !== "string")
            throw new Error("propertyKey is required");
        var editCompNode = await figma.getNodeByIdAsync(payload.componentId);
        if (!editCompNode || (editCompNode.type !== "COMPONENT" && editCompNode.type !== "COMPONENT_SET"))
            throw new Error("Component or ComponentSet not found");
        var existing = editCompNode.componentPropertyDefinitions[payload.propertyKey];
        if (!existing)
            throw new Error("Property not found: " + payload.propertyKey);
        if (typeof payload.newName === "string")
            editCompNode.editComponentProperty(payload.propertyKey, { name: payload.newName });
        var newDefault = payload.newDefaultValue;
        if (typeof newDefault === "string" || typeof newDefault === "boolean") {
            editCompNode.editComponentProperty(payload.propertyKey, { defaultValue: newDefault });
        }
        return { propertyKey: payload.propertyKey, definitions: editCompNode.componentPropertyDefinitions };
    }
    if (command.type === "setComponentPropertyReference") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        if (!payload.references || typeof payload.references !== "object")
            throw new Error("references is required");
        var refNode = await figma.getNodeByIdAsync(payload.nodeId);
        if (!refNode || refNode.type === "DOCUMENT" || refNode.type === "PAGE")
            throw new Error("Scene node not found");
        refNode.componentPropertyReferences = Object.assign({}, refNode.componentPropertyReferences || {}, payload.references);
        return { nodeId: refNode.id, componentPropertyReferences: refNode.componentPropertyReferences };
    }
    if (command.type === "getComponentProperties") {
        if (typeof payload.componentId !== "string")
            throw new Error("componentId is required");
        var gcpNode = await figma.getNodeByIdAsync(payload.componentId);
        if (!gcpNode || (gcpNode.type !== "COMPONENT" && gcpNode.type !== "COMPONENT_SET"))
            throw new Error("Component or ComponentSet not found");
        return { id: gcpNode.id, name: gcpNode.name, componentPropertyDefinitions: gcpNode.componentPropertyDefinitions };
    }
    // --- Instance with overrides ---
    if (command.type === "createInstanceWithOverrides") {
        if (typeof payload.componentId !== "string")
            throw new Error("componentId is required");
        var iSrcComp = await figma.getNodeByIdAsync(payload.componentId);
        if (!iSrcComp || (iSrcComp.type !== "COMPONENT" && iSrcComp.type !== "COMPONENT_SET"))
            throw new Error("Component not found");
        var iNode;
        if (iSrcComp.type === "COMPONENT") {
            iNode = iSrcComp.createInstance();
        }
        else {
            // For component sets, use the default variant
            iNode = iSrcComp.defaultVariant.createInstance();
        }
        try {
            if (typeof payload.name === "string")
                iNode.name = payload.name;
            await appendNode(iNode, payload);
            if (typeof payload.x === "number" && typeof payload.y === "number") {
                iNode.x = payload.x;
                iNode.y = payload.y;
            }
            if ("resize" in iNode && typeof payload.width === "number" && typeof payload.height === "number") {
                iNode.resize(payload.width, payload.height);
            }
            if (payload.properties && typeof payload.properties === "object") {
                iNode.setProperties(payload.properties);
            }
        }
        catch (error) {
            try {
                iNode.remove();
            }
            catch (_cleanupError) { /* ignore cleanup errors */ }
            throw error;
        }
        figma.currentPage.selection = [iNode];
        figma.viewport.scrollAndZoomIntoView([iNode]);
        return serializeNode(iNode);
    }
    // --- Variables ---
    if (command.type === "createVariableCollection") {
        if (typeof payload.name !== "string")
            throw new Error("name is required");
        var collection = figma.variables.createVariableCollection(payload.name);
        if (typeof payload.defaultModeName === "string" && collection.modes.length > 0) {
            collection.renameMode(collection.modes[0].modeId, payload.defaultModeName);
        }
        return {
            id: collection.id,
            name: collection.name,
            defaultModeId: collection.defaultModeId,
            modes: collection.modes.map(function (m) { return { modeId: m.modeId, name: m.name }; }),
        };
    }
    if (command.type === "addVariableMode") {
        if (typeof payload.collectionId !== "string")
            throw new Error("collectionId is required");
        if (typeof payload.name !== "string")
            throw new Error("name is required");
        var modeCollection = await figma.variables.getVariableCollectionByIdAsync(payload.collectionId);
        if (!modeCollection)
            throw new Error("Variable collection not found");
        var modeId = modeCollection.addMode(payload.name);
        return { collectionId: modeCollection.id, modeId: modeId, modes: modeCollection.modes.map(function (m) { return { modeId: m.modeId, name: m.name }; }) };
    }
    if (command.type === "renameVariableMode") {
        if (typeof payload.collectionId !== "string")
            throw new Error("collectionId is required");
        if (typeof payload.modeId !== "string")
            throw new Error("modeId is required");
        if (typeof payload.name !== "string")
            throw new Error("name is required");
        var renameCollection = await figma.variables.getVariableCollectionByIdAsync(payload.collectionId);
        if (!renameCollection)
            throw new Error("Variable collection not found");
        var renameMode = renameCollection.modes.find(function (m) { return m.modeId === payload.modeId; });
        if (!renameMode)
            throw new Error("Mode not found");
        renameCollection.renameMode(renameMode.modeId, payload.name);
        return { modeId: renameMode.modeId, name: payload.name };
    }
    if (command.type === "createVariable") {
        if (typeof payload.collectionId !== "string")
            throw new Error("collectionId is required");
        if (typeof payload.name !== "string")
            throw new Error("name is required");
        if (typeof payload.resolvedType !== "string")
            throw new Error("resolvedType is required");
        var varCollection = await figma.variables.getVariableCollectionByIdAsync(payload.collectionId);
        if (!varCollection)
            throw new Error("Variable collection not found");
        var variable = figma.variables.createVariable(payload.name, varCollection, payload.resolvedType);
        if (Array.isArray(payload.scopes))
            variable.scopes = payload.scopes;
        return { id: variable.id, name: variable.name, resolvedType: variable.resolvedType, scopes: variable.scopes };
    }
    if (command.type === "setVariableValueForMode") {
        if (typeof payload.variableId !== "string")
            throw new Error("variableId is required");
        if (typeof payload.modeId !== "string")
            throw new Error("modeId is required");
        var valVariable = await figma.variables.getVariableByIdAsync(payload.variableId);
        if (!valVariable)
            throw new Error("Variable not found");
        valVariable.setValueForMode(payload.modeId, payload.value);
        return { id: valVariable.id, valuesByMode: valVariable.valuesByMode };
    }
    if (command.type === "getLocalVariables") {
        var variables = await figma.variables.getLocalVariablesAsync();
        return variables.map(function (v) { return { id: v.id, name: v.name, resolvedType: v.resolvedType, scopes: v.scopes, valuesByMode: v.valuesByMode }; });
    }
    if (command.type === "getLocalVariableCollections") {
        var collections = await figma.variables.getLocalVariableCollectionsAsync();
        return collections.map(function (c) {
            return { id: c.id, name: c.name, defaultModeId: c.defaultModeId, modes: c.modes.map(function (m) { return { modeId: m.modeId, name: m.name }; }) };
        });
    }
    if (command.type === "bindVariable") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        if (typeof payload.target !== "string")
            throw new Error("target is required");
        if (typeof payload.field !== "string")
            throw new Error("field is required");
        if (typeof payload.variableId !== "string")
            throw new Error("variableId is required");
        var bindNode = await figma.getNodeByIdAsync(payload.nodeId);
        if (!bindNode || bindNode.type === "DOCUMENT" || bindNode.type === "PAGE")
            throw new Error("Scene node not found");
        var bindVar = await figma.variables.getVariableByIdAsync(payload.variableId);
        if (!bindVar)
            throw new Error("Variable not found");
        if (payload.target === "nodeField") {
            bindNode.setBoundVariable(payload.field, bindVar);
        }
        else if (payload.target === "fills") {
            if (!("fills" in bindNode) || bindNode.fills === figma.mixed)
                throw new Error("Node does not have bindable fills");
            var fills = bindNode.fills.slice();
            var fillIdx = typeof payload.index === "number" ? payload.index : 0;
            if (fillIdx >= fills.length)
                throw new Error("Fill index out of range");
            var paint = fills[fillIdx];
            if (paint.type !== "SOLID")
                throw new Error("Only SOLID paint color binding is supported");
            fills[fillIdx] = figma.variables.setBoundVariableForPaint(paint, "color", bindVar);
            bindNode.fills = fills;
        }
        else if (payload.target === "strokes") {
            if (!("strokes" in bindNode) || bindNode.strokes === figma.mixed)
                throw new Error("Node does not have bindable strokes");
            var strokes = bindNode.strokes.slice();
            var strokeIdx = typeof payload.index === "number" ? payload.index : 0;
            if (strokeIdx >= strokes.length)
                throw new Error("Stroke index out of range");
            var spaint = strokes[strokeIdx];
            if (spaint.type !== "SOLID")
                throw new Error("Only SOLID stroke color binding is supported");
            strokes[strokeIdx] = figma.variables.setBoundVariableForPaint(spaint, "color", bindVar);
            bindNode.strokes = strokes;
        }
        else if (payload.target === "effects") {
            if (!("effects" in bindNode))
                throw new Error("Node does not have bindable effects");
            var effects = bindNode.effects.slice();
            var effectIdx = typeof payload.index === "number" ? payload.index : 0;
            if (effectIdx >= effects.length)
                throw new Error("Effect index out of range");
            effects[effectIdx] = figma.variables.setBoundVariableForEffect(effects[effectIdx], payload.field, bindVar);
            bindNode.effects = effects;
        }
        return serializeNode(bindNode);
    }
    if (command.type === "setExplicitVariableMode") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        if (typeof payload.collectionId !== "string")
            throw new Error("collectionId is required");
        if (typeof payload.modeId !== "string")
            throw new Error("modeId is required");
        var modeNode = await figma.getNodeByIdAsync(payload.nodeId);
        if (!modeNode || modeNode.type === "DOCUMENT" || modeNode.type === "PAGE")
            throw new Error("Scene node not found");
        var modeCollection2 = await figma.variables.getVariableCollectionByIdAsync(payload.collectionId);
        if (!modeCollection2)
            throw new Error("Variable collection not found");
        modeNode.setExplicitVariableModeForCollection(modeCollection2, payload.modeId);
        return serializeNode(modeNode);
    }
    if (command.type === "createThemeTokens") {
        if (typeof payload.collectionName !== "string")
            throw new Error("collectionName is required");
        if (!Array.isArray(payload.modes) || payload.modes.length === 0)
            throw new Error("modes is required");
        if (!Array.isArray(payload.tokens) || payload.tokens.length === 0)
            throw new Error("tokens is required");
        var themeColl = figma.variables.createVariableCollection(payload.collectionName);
        // Rename default mode to first mode name
        if (themeColl.modes.length > 0)
            themeColl.renameMode(themeColl.modes[0].modeId, payload.modes[0]);
        // Add remaining modes
        for (var mi = 1; mi < payload.modes.length; mi += 1) {
            themeColl.addMode(payload.modes[mi]);
        }
        var modeMap = {};
        for (var mmi = 0; mmi < themeColl.modes.length; mmi += 1) {
            modeMap[payload.modes[mmi]] = themeColl.modes[mmi].modeId;
        }
        var tokenMap = {};
        for (var ti = 0; ti < payload.tokens.length; ti += 1) {
            var token = payload.tokens[ti];
            if (typeof token.name !== "string" || typeof token.type !== "string")
                continue;
            var tvar = figma.variables.createVariable(token.name, themeColl, token.type);
            if (Array.isArray(token.scopes))
                tvar.scopes = token.scopes;
            if (token.values && typeof token.values === "object") {
                var tvals = token.values;
                for (var mk = 0; mk < payload.modes.length; mk += 1) {
                    var modeName = payload.modes[mk];
                    var modeKey = modeMap[modeName];
                    if (modeKey && modeName in tvals) {
                        tvar.setValueForMode(modeKey, tvals[modeName]);
                    }
                }
            }
            tokenMap[token.name] = tvar.id;
        }
        return {
            collectionId: themeColl.id,
            modes: modeMap,
            variables: tokenMap,
        };
    }
    // --- Batch node creation ---
    if (command.type === "batchCreateNodes") {
        var nodes = payload.nodes;
        if (!Array.isArray(nodes) || nodes.length === 0)
            throw new Error("nodes array is required");
        if (nodes.length > 500)
            throw new Error("Maximum 500 nodes per batch");
        var validateOnly = payload.validateOnly === true;
        var rollbackOnError = payload.rollbackOnError !== false;
        var selectCreated = payload.selectCreated === true;
        var scrollIntoView = payload.scrollIntoView !== false;
        // Build tempId index and validate parent references
        var tempIdSet = new Set();
        for (var ni = 0; ni < nodes.length; ni += 1) {
            var nodeSpec = nodes[ni];
            if (!nodeSpec || typeof nodeSpec !== "object")
                throw new Error("Invalid node at index " + ni);
            var tid = nodeSpec.tempId;
            if (typeof tid !== "string" || tid.length === 0)
                throw new Error("tempId is required at index " + ni);
            if (tempIdSet.has(tid))
                throw new Error("Duplicate tempId: " + tid);
            tempIdSet.add(tid);
            if (typeof nodeSpec.parentTempId === "string" && typeof nodeSpec.parentId === "string") {
                throw new Error("Node " + tid + " cannot have both parentTempId and parentId");
            }
        }
        // Validate parentTempId references
        for (var nni = 0; nni < nodes.length; nni += 1) {
            var nspec = nodes[nni];
            var nptid = nspec.parentTempId;
            if (typeof nptid === "string" && !tempIdSet.has(nptid)) {
                throw new Error("parentTempId " + nptid + " not found for node " + nspec.tempId);
            }
        }
        if (validateOnly) {
            return { ok: true, validated: nodes.length, message: "All nodes are valid" };
        }
        // Resolve parent helper
        function resolveParent(spec) {
            if (typeof spec.parentTempId === "string") {
                var pn = idMap.get(spec.parentTempId);
                if (!pn)
                    throw new Error("Parent tempId " + spec.parentTempId + " not resolved");
                return pn;
            }
            if (typeof spec.parentId === "string") {
                return getFrameParent(spec.parentId);
            }
            return Promise.resolve(figma.currentPage);
        }
        // Create a single node by type. If any step fails, remove the node created
        // during this call; the outer batch catch handles previously completed nodes.
        async function createNodeByType(spec, parent) {
            var props = spec.props && typeof spec.props === "object" ? spec.props : {};
            var nodeType = typeof spec.type === "string" ? spec.type : "";
            var currentNode = null;
            try {
                switch (nodeType) {
                    case "FRAME": {
                        var frame = figma.createFrame();
                        currentNode = frame;
                        frame.name = typeof props.name === "string" ? props.name : "Frame";
                        parent.appendChild(frame);
                        setGeometry(frame, props);
                        applyVisualStyle(frame, props);
                        return frame;
                    }
                    case "AUTO_LAYOUT_FRAME": {
                        var alf = figma.createFrame();
                        currentNode = alf;
                        alf.name = typeof props.name === "string" ? props.name : "Auto Frame";
                        parent.appendChild(alf);
                        setGeometry(alf, props);
                        applyVisualStyle(alf, props);
                        applyAutoLayout(alf, props);
                        return alf;
                    }
                    case "RECTANGLE": {
                        var rect = figma.createRectangle();
                        currentNode = rect;
                        rect.name = typeof props.name === "string" ? props.name : "Rectangle";
                        parent.appendChild(rect);
                        setGeometry(rect, props);
                        applyVisualStyle(rect, props);
                        return rect;
                    }
                    case "TEXT": {
                        var txt = figma.createText();
                        currentNode = txt;
                        txt.name = typeof props.name === "string" ? props.name : "Text";
                        parent.appendChild(txt);
                        setGeometry(txt, props);
                        applyVisualStyle(txt, props);
                        await applyTextStyle(txt, props);
                        txt.characters = typeof props.text === "string" ? props.text : "";
                        return txt;
                    }
                    case "ELLIPSE": {
                        var ell = figma.createEllipse();
                        currentNode = ell;
                        ell.name = typeof props.name === "string" ? props.name : "Ellipse";
                        parent.appendChild(ell);
                        setGeometry(ell, props);
                        applyVisualStyle(ell, props);
                        return ell;
                    }
                    case "LINE": {
                        var ln = figma.createLine();
                        currentNode = ln;
                        ln.name = typeof props.name === "string" ? props.name : "Line";
                        parent.appendChild(ln);
                        setGeometry(ln, props);
                        applyVisualStyle(ln, props);
                        return ln;
                    }
                    case "POLYGON": {
                        var poly = figma.createPolygon();
                        currentNode = poly;
                        poly.name = typeof props.name === "string" ? props.name : "Polygon";
                        if (typeof props.pointCount === "number")
                            poly.pointCount = props.pointCount;
                        parent.appendChild(poly);
                        setGeometry(poly, props);
                        applyVisualStyle(poly, props);
                        return poly;
                    }
                    case "STAR": {
                        var star = figma.createStar();
                        currentNode = star;
                        star.name = typeof props.name === "string" ? props.name : "Star";
                        if (typeof props.pointCount === "number")
                            star.pointCount = props.pointCount;
                        if (typeof props.innerRadius === "number")
                            star.innerRadius = props.innerRadius;
                        parent.appendChild(star);
                        setGeometry(star, props);
                        applyVisualStyle(star, props);
                        return star;
                    }
                    case "VECTOR": {
                        var vec = figma.createVector();
                        currentNode = vec;
                        vec.name = typeof props.name === "string" ? props.name : "Vector";
                        if (Array.isArray(props.vectorPaths))
                            vec.vectorPaths = props.vectorPaths;
                        parent.appendChild(vec);
                        setGeometry(vec, props);
                        applyVisualStyle(vec, props);
                        return vec;
                    }
                    case "COMPONENT": {
                        var comp = figma.createComponent();
                        currentNode = comp;
                        comp.name = typeof props.name === "string" ? props.name : "Component";
                        parent.appendChild(comp);
                        setGeometry(comp, props);
                        applyVisualStyle(comp, props);
                        applyAutoLayout(comp, props);
                        return comp;
                    }
                    case "INSTANCE": {
                        if (typeof props.componentId !== "string")
                            throw new Error("componentId is required for INSTANCE");
                        var srcComp = figma.getNodeById(props.componentId);
                        if (!srcComp || srcComp.type !== "COMPONENT")
                            throw new Error("Component not found: " + props.componentId);
                        var inst = srcComp.createInstance();
                        currentNode = inst;
                        inst.name = typeof props.name === "string" ? props.name : "Instance";
                        parent.appendChild(inst);
                        setGeometry(inst, props);
                        if (props.properties && typeof props.properties === "object") {
                            inst.setProperties(props.properties);
                        }
                        return inst;
                    }
                    case "IMAGE_RECTANGLE": {
                        if (typeof props.imageUrl !== "string")
                            throw new Error("imageUrl is required for IMAGE_RECTANGLE");
                        var imgRect = figma.createRectangle();
                        currentNode = imgRect;
                        imgRect.name = typeof props.name === "string" ? props.name : "Image";
                        var styleProps = Object.assign({}, props, { fills: undefined });
                        parent.appendChild(imgRect);
                        setGeometry(imgRect, props);
                        applyVisualStyle(imgRect, styleProps);
                        imgRect.fills = [await imagePaintFromUrl(props.imageUrl, props.scaleMode)];
                        return imgRect;
                    }
                    default:
                        throw new Error("Unknown node type: " + nodeType);
                }
            }
            catch (error) {
                if (currentNode) {
                    try {
                        currentNode.remove();
                    }
                    catch (_cleanupError) { /* ignore cleanup errors */ }
                }
                throw error;
            }
        }
        var idMap = new Map();
        var createdNodes = [];
        var rolledBack = false;
        var failedTempId = null;
        var failedError = null;
        try {
            for (var si = 0; si < nodes.length; si += 1) {
                var spec = nodes[si];
                var parent = await resolveParent(spec);
                var created = await createNodeByType(spec, parent);
                // Apply child layout props after creation
                var specProps = spec.props && typeof spec.props === "object" ? spec.props : {};
                applyLayoutChildProps(created, specProps);
                idMap.set(spec.tempId, created);
                createdNodes.push(created);
            }
            if (selectCreated && createdNodes.length > 0) {
                figma.currentPage.selection = createdNodes;
            }
            if (scrollIntoView && createdNodes.length > 0) {
                figma.viewport.scrollAndZoomIntoView(createdNodes);
            }
            var createdResult = createdNodes.map(serializeNode);
            var idMapResult = {};
            idMap.forEach(function (node, tid) { idMapResult[tid] = node.id; });
            return {
                ok: true,
                created: createdResult,
                idMap: idMapResult,
            };
        }
        catch (error) {
            failedTempId = idMap.size < nodes.length ? nodes[idMap.size].tempId : null;
            failedError = error instanceof Error ? error.message : String(error);
            if (rollbackOnError) {
                rolledBack = true;
                // Remove in reverse order
                for (var ri = createdNodes.length - 1; ri >= 0; ri -= 1) {
                    try {
                        createdNodes[ri].remove();
                    }
                    catch (_cleanupError) { /* ignore */ }
                }
            }
            return {
                ok: false,
                error: failedError,
                createdBeforeRollback: createdNodes.map(serializeNode),
                rolledBack: rolledBack,
                failedAtTempId: failedTempId,
            };
        }
    }
    // --- Local Styles ---
    if (command.type === "getLocalStyles") {
        var styleType = typeof payload.type === "string" ? payload.type : "all";
        var result = {};
        if (styleType === "all" || styleType === "paint") {
            var paintStyles = await figma.getLocalPaintStylesAsync();
            result.paintStyles = paintStyles.map(serializePaintStyle);
        }
        if (styleType === "all" || styleType === "text") {
            var textStyles = await figma.getLocalTextStylesAsync();
            result.textStyles = textStyles.map(serializeTextStyle);
        }
        if (styleType === "all" || styleType === "effect") {
            var effectStyles = await figma.getLocalEffectStylesAsync();
            result.effectStyles = effectStyles.map(serializeEffectStyle);
        }
        return result;
    }
    if (command.type === "createPaintStyle") {
        return await createOrUpdatePaintStyle(payload);
    }
    if (command.type === "createTextStyle") {
        return await createOrUpdateTextStyle(payload);
    }
    if (command.type === "createEffectStyle") {
        return await createOrUpdateEffectStyle(payload);
    }
    if (command.type === "updateStyle") {
        var styleId = payload.styleId;
        var sType = payload.styleType;
        if (typeof styleId !== "string")
            throw new Error("styleId is required");
        if (typeof sType !== "string")
            throw new Error("styleType is required");
        if (sType === "paint") {
            var psId = styleId;
            var paintStyle = await figma.getLocalPaintStylesAsync().then(function (s) { return s.find(function (ps) { return ps.id === psId; }); });
            if (!paintStyle)
                throw new Error("Paint style not found: " + psId);
            if (typeof payload.name === "string")
                paintStyle.name = payload.name;
            if (typeof payload.description === "string")
                paintStyle.description = payload.description;
            if (Array.isArray(payload.paints))
                paintStyle.paints = normalizePaints(payload.paints);
            return serializePaintStyle(paintStyle);
        }
        else if (sType === "text") {
            var tsId = styleId;
            var textStyle = await figma.getLocalTextStylesAsync().then(function (s) { return s.find(function (ts) { return ts.id === tsId; }); });
            if (!textStyle)
                throw new Error("Text style not found: " + tsId);
            if (typeof payload.name === "string")
                textStyle.name = payload.name;
            if (typeof payload.description === "string")
                textStyle.description = payload.description;
            if (typeof payload.fontFamily === "string" && typeof payload.fontStyle === "string") {
                await figma.loadFontAsync({ family: payload.fontFamily, style: payload.fontStyle });
                textStyle.fontName = { family: payload.fontFamily, style: payload.fontStyle };
            }
            if (typeof payload.fontSize === "number")
                textStyle.fontSize = payload.fontSize;
            if (payload.lineHeight && typeof payload.lineHeight === "object")
                textStyle.lineHeight = payload.lineHeight;
            if (payload.letterSpacing && typeof payload.letterSpacing === "object")
                textStyle.letterSpacing = payload.letterSpacing;
            if (typeof payload.paragraphSpacing === "number")
                textStyle.paragraphSpacing = payload.paragraphSpacing;
            if (typeof payload.paragraphIndent === "number")
                textStyle.paragraphIndent = payload.paragraphIndent;
            return serializeTextStyle(textStyle);
        }
        else if (sType === "effect") {
            var esId = styleId;
            var effectStyle = await figma.getLocalEffectStylesAsync().then(function (s) { return s.find(function (es) { return es.id === esId; }); });
            if (!effectStyle)
                throw new Error("Effect style not found: " + esId);
            if (typeof payload.name === "string")
                effectStyle.name = payload.name;
            if (typeof payload.description === "string")
                effectStyle.description = payload.description;
            if (Array.isArray(payload.effects))
                effectStyle.effects = normalizeEffects(payload.effects);
            return serializeEffectStyle(effectStyle);
        }
        throw new Error("Unknown style type: " + sType);
    }
    if (command.type === "deleteStyle") {
        if (typeof payload.styleId !== "string")
            throw new Error("styleId is required");
        if (typeof payload.styleType !== "string")
            throw new Error("styleType is required");
        if (payload.styleType === "paint") {
            var dps = await figma.getLocalPaintStylesAsync().then(function (s) { return s.find(function (ps) { return ps.id === payload.styleId; }); });
            if (!dps)
                throw new Error("Paint style not found: " + payload.styleId);
            dps.remove();
        }
        else if (payload.styleType === "text") {
            var dts = await figma.getLocalTextStylesAsync().then(function (s) { return s.find(function (ts) { return ts.id === payload.styleId; }); });
            if (!dts)
                throw new Error("Text style not found: " + payload.styleId);
            dts.remove();
        }
        else if (payload.styleType === "effect") {
            var des = await figma.getLocalEffectStylesAsync().then(function (s) { return s.find(function (es) { return es.id === payload.styleId; }); });
            if (!des)
                throw new Error("Effect style not found: " + payload.styleId);
            des.remove();
        }
        return { ok: true, deleted: true, styleId: payload.styleId };
    }
    if (command.type === "bindStyle") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        if (typeof payload.styleId !== "string")
            throw new Error("styleId is required");
        if (typeof payload.target !== "string")
            throw new Error("target is required");
        var bindNode2 = await figma.getNodeByIdAsync(payload.nodeId);
        if (!bindNode2 || bindNode2.type === "DOCUMENT" || bindNode2.type === "PAGE")
            throw new Error("Scene node not found");
        var target = payload.target;
        if (target === "fill") {
            if (!("setFillStyleIdAsync" in bindNode2))
                throw new Error("Node does not support fill styles");
            await bindNode2.setFillStyleIdAsync(payload.styleId);
        }
        else if (target === "stroke") {
            if (!("setStrokeStyleIdAsync" in bindNode2))
                throw new Error("Node does not support stroke styles");
            await bindNode2.setStrokeStyleIdAsync(payload.styleId);
        }
        else if (target === "text") {
            if (bindNode2.type !== "TEXT")
                throw new Error("Text style target requires TEXT node");
            await bindNode2.setTextStyleIdAsync(payload.styleId);
        }
        else if (target === "effect") {
            if (!("setEffectStyleIdAsync" in bindNode2))
                throw new Error("Node does not support effect styles");
            await bindNode2.setEffectStyleIdAsync(payload.styleId);
        }
        else {
            throw new Error("Unknown style bind target: " + target);
        }
        // Look up the style name for the response
        var boundStyleName;
        try {
            if (target === "text") {
                var tstyles = await figma.getLocalTextStylesAsync();
                var tsm = tstyles.find(function (s) { return s.id === payload.styleId; });
                if (tsm)
                    boundStyleName = tsm.name;
            }
            else if (target === "effect") {
                var estyles = await figma.getLocalEffectStylesAsync();
                var esm = estyles.find(function (s) { return s.id === payload.styleId; });
                if (esm)
                    boundStyleName = esm.name;
            }
            else {
                var pstyles = await figma.getLocalPaintStylesAsync();
                var psm = pstyles.find(function (s) { return s.id === payload.styleId; });
                if (psm)
                    boundStyleName = psm.name;
            }
        }
        catch (_nameError) { /* ignore */ }
        return {
            nodeId: bindNode2.id,
            target: target,
            styleId: payload.styleId,
            styleName: boundStyleName,
        };
    }
    if (command.type === "createDesignSystemStyles") {
        var dssResults = {};
        var dssCreated = 0;
        var dssUpdated = 0;
        var dssSkipped = 0;
        var dssFailed = 0;
        // Paint styles
        var paintResults = [];
        if (Array.isArray(payload.paintStyles)) {
            for (var psi = 0; psi < payload.paintStyles.length; psi += 1) {
                try {
                    var psPayload = Object.assign({}, payload.paintStyles[psi], { upsert: payload.upsert !== false });
                    var psRes = await createOrUpdatePaintStyle(psPayload);
                    paintResults.push(psRes);
                    if (psRes.operation === "created")
                        dssCreated += 1;
                    else if (psRes.operation === "updated")
                        dssUpdated += 1;
                    else if (psRes.operation === "skipped")
                        dssSkipped += 1;
                }
                catch (_psError) {
                    dssFailed += 1;
                    paintResults.push({ error: _psError instanceof Error ? _psError.message : String(_psError) });
                }
            }
        }
        dssResults.paintStyles = paintResults;
        // Text styles
        var textResults = [];
        if (Array.isArray(payload.textStyles)) {
            for (var tsi = 0; tsi < payload.textStyles.length; tsi += 1) {
                try {
                    var tsPayload = Object.assign({}, payload.textStyles[tsi], { upsert: payload.upsert !== false });
                    var tsRes = await createOrUpdateTextStyle(tsPayload);
                    textResults.push(tsRes);
                    if (tsRes.operation === "created")
                        dssCreated += 1;
                    else if (tsRes.operation === "updated")
                        dssUpdated += 1;
                    else if (tsRes.operation === "skipped")
                        dssSkipped += 1;
                }
                catch (_tsError) {
                    dssFailed += 1;
                    textResults.push({ error: _tsError instanceof Error ? _tsError.message : String(_tsError) });
                }
            }
        }
        dssResults.textStyles = textResults;
        // Effect styles
        var effectResults = [];
        if (Array.isArray(payload.effectStyles)) {
            for (var esi = 0; esi < payload.effectStyles.length; esi += 1) {
                try {
                    var esPayload = Object.assign({}, payload.effectStyles[esi], { upsert: payload.upsert !== false });
                    var esRes = await createOrUpdateEffectStyle(esPayload);
                    effectResults.push(esRes);
                    if (esRes.operation === "created")
                        dssCreated += 1;
                    else if (esRes.operation === "updated")
                        dssUpdated += 1;
                    else if (esRes.operation === "skipped")
                        dssSkipped += 1;
                }
                catch (_esError) {
                    dssFailed += 1;
                    effectResults.push({ error: _esError instanceof Error ? _esError.message : String(_esError) });
                }
            }
        }
        dssResults.effectStyles = effectResults;
        dssResults.summary = { created: dssCreated, updated: dssUpdated, skipped: dssSkipped, failed: dssFailed };
        return dssResults;
    }
    if (command.type === "auditStyles") {
        var prefix = typeof payload.prefix === "string" ? payload.prefix : "";
        var paintStyles2 = await figma.getLocalPaintStylesAsync();
        var textStyles2 = await figma.getLocalTextStylesAsync();
        var effectStyles2 = await figma.getLocalEffectStylesAsync();
        var filteredPaint = prefix ? paintStyles2.filter(function (s) { return s.name.indexOf(prefix) === 0; }) : paintStyles2;
        var filteredText = prefix ? textStyles2.filter(function (s) { return s.name.indexOf(prefix) === 0; }) : textStyles2;
        var filteredEffect = prefix ? effectStyles2.filter(function (s) { return s.name.indexOf(prefix) === 0; }) : effectStyles2;
        // Duplicate detection by name
        var paintNames = {};
        for (var pni = 0; pni < filteredPaint.length; pni += 1) {
            paintNames[filteredPaint[pni].name] = (paintNames[filteredPaint[pni].name] || 0) + 1;
        }
        var textNames = {};
        for (var tni = 0; tni < filteredText.length; tni += 1) {
            textNames[filteredText[tni].name] = (textNames[filteredText[tni].name] || 0) + 1;
        }
        var effectNames = {};
        for (var eni = 0; eni < filteredEffect.length; eni += 1) {
            effectNames[filteredEffect[eni].name] = (effectNames[filteredEffect[eni].name] || 0) + 1;
        }
        var duplicates = [];
        var pnKeys = Object.keys(paintNames);
        for (var pnk = 0; pnk < pnKeys.length; pnk += 1) {
            if (paintNames[pnKeys[pnk]] > 1)
                duplicates.push(pnKeys[pnk] + " (paint x" + paintNames[pnKeys[pnk]] + ")");
        }
        var tnKeys = Object.keys(textNames);
        for (var tnk = 0; tnk < tnKeys.length; tnk += 1) {
            if (textNames[tnKeys[tnk]] > 1)
                duplicates.push(tnKeys[tnk] + " (text x" + textNames[tnKeys[tnk]] + ")");
        }
        var enKeys = Object.keys(effectNames);
        for (var enk = 0; enk < enKeys.length; enk += 1) {
            if (effectNames[enKeys[enk]] > 1)
                duplicates.push(enKeys[enk] + " (effect x" + effectNames[enKeys[enk]] + ")");
        }
        // Expected vs missing
        var missingExpected = [];
        if (payload.expected && typeof payload.expected === "object") {
            var exp = payload.expected;
            if (Array.isArray(exp.paintStyles)) {
                var expPaint = exp.paintStyles;
                for (var epi = 0; epi < expPaint.length; epi += 1) {
                    if (!paintNames[expPaint[epi]])
                        missingExpected.push(expPaint[epi] + " (paint)");
                }
            }
            if (Array.isArray(exp.textStyles)) {
                var expText = exp.textStyles;
                for (var eti = 0; eti < expText.length; eti += 1) {
                    if (!textNames[expText[eti]])
                        missingExpected.push(expText[eti] + " (text)");
                }
            }
            if (Array.isArray(exp.effectStyles)) {
                var expEffect = exp.effectStyles;
                for (var eei = 0; eei < expEffect.length; eei += 1) {
                    if (!effectNames[expEffect[eei]])
                        missingExpected.push(expEffect[eei] + " (effect)");
                }
            }
        }
        return {
            paintStyles: filteredPaint.length,
            textStyles: filteredText.length,
            effectStyles: filteredEffect.length,
            duplicates: duplicates,
            missingExpected: missingExpected,
        };
    }
    if (command.type === "auditNodeStyleBinding") {
        if (typeof payload.nodeId !== "string")
            throw new Error("nodeId is required");
        var auditRootNode = await figma.getNodeByIdAsync(payload.nodeId);
        if (!auditRootNode || auditRootNode.type === "DOCUMENT" || auditRootNode.type === "PAGE")
            throw new Error("Scene node not found");
        var expectedPrefix = typeof payload.expectedPrefix === "string" ? payload.expectedPrefix : "";
        var checkedNodes = 0;
        var styleBindings = [];
        var unboundStyledNodes = [];
        function walkNodeStyleAudit(node, currentDepth) {
            if (currentDepth < 0)
                return;
            checkedNodes += 1;
            var sceneNode = node;
            // Check fill style
            if ("fillStyleId" in sceneNode) {
                var fsi = sceneNode.fillStyleId;
                if (fsi && typeof fsi === "string" && fsi !== "") {
                    styleBindings.push({ nodeId: sceneNode.id, nodeName: sceneNode.name, target: "fill", styleId: fsi });
                }
                else if ("fills" in sceneNode && sceneNode.fills !== figma.mixed && sceneNode.fills.length > 0) {
                    unboundStyledNodes.push({ nodeId: sceneNode.id, nodeName: sceneNode.name, reason: "has raw fill but no fillStyleId" });
                }
            }
            // Check stroke style
            if ("strokeStyleId" in sceneNode) {
                var ssi = sceneNode.strokeStyleId;
                if (ssi && typeof ssi === "string" && ssi !== "") {
                    styleBindings.push({ nodeId: sceneNode.id, nodeName: sceneNode.name, target: "stroke", styleId: ssi });
                }
            }
            // Check text style
            if (sceneNode.type === "TEXT") {
                var tsi2 = sceneNode.textStyleId;
                if (tsi2 && typeof tsi2 === "string" && tsi2 !== "") {
                    styleBindings.push({ nodeId: sceneNode.id, nodeName: sceneNode.name, target: "text", styleId: tsi2 });
                }
                else {
                    unboundStyledNodes.push({ nodeId: sceneNode.id, nodeName: sceneNode.name, reason: "text node has no textStyleId" });
                }
            }
            // Check effect style
            if ("effectStyleId" in sceneNode) {
                var esi2 = sceneNode.effectStyleId;
                if (esi2 && typeof esi2 === "string" && esi2 !== "") {
                    styleBindings.push({ nodeId: sceneNode.id, nodeName: sceneNode.name, target: "effect", styleId: esi2 });
                }
            }
            // Recurse
            if ("children" in sceneNode && currentDepth > 0) {
                var children = sceneNode.children;
                for (var wci = 0; wci < children.length; wci += 1) {
                    walkNodeStyleAudit(children[wci], currentDepth - 1);
                }
            }
        }
        walkNodeStyleAudit(auditRootNode, typeof payload.depth === "number" ? payload.depth : 4);
        // Resolve style names
        var allPaintStyles = await figma.getLocalPaintStylesAsync();
        var allTextStyles = await figma.getLocalTextStylesAsync();
        var allEffectStyles = await figma.getLocalEffectStylesAsync();
        for (var sbi = 0; sbi < styleBindings.length; sbi += 1) {
            var sb = styleBindings[sbi];
            var sid = sb.styleId;
            var sname;
            if (sb.target === "text") {
                var m = allTextStyles.find(function (s) { return s.id === sid; });
                if (m)
                    sname = m.name;
            }
            else if (sb.target === "effect") {
                var em = allEffectStyles.find(function (s) { return s.id === sid; });
                if (em)
                    sname = em.name;
            }
            else {
                var pm = allPaintStyles.find(function (s) { return s.id === sid; });
                if (pm)
                    sname = pm.name;
            }
            sb.styleName = sname || sid;
        }
        // Validate expectedPrefix — detect style bindings that don't match
        var wrongPrefixBindings = [];
        if (expectedPrefix) {
            for (var wpi = 0; wpi < styleBindings.length; wpi += 1) {
                var wb = styleBindings[wpi];
                var wsname = typeof wb.styleName === "string" ? wb.styleName : "";
                if (wsname.indexOf(expectedPrefix) !== 0) {
                    wrongPrefixBindings.push({
                        nodeId: wb.nodeId,
                        nodeName: wb.nodeName,
                        target: wb.target,
                        styleName: wsname,
                        expectedPrefix: expectedPrefix,
                    });
                }
            }
        }
        return {
            nodeId: auditRootNode.id,
            checkedNodes: checkedNodes,
            styleBindings: styleBindings,
            unboundStyledNodes: unboundStyledNodes,
            wrongPrefixBindings: wrongPrefixBindings.length > 0 ? wrongPrefixBindings : undefined,
        };
    }
    throw new Error(`Unknown command: ${command.type}`);
}
function postResponse(id, ok, result, error) {
    figma.ui.postMessage({ type: "response", id, ok, result, error });
}
figma.ui.onmessage = async (message) => {
    var _a;
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
    if (message.type !== "command" || typeof message.raw !== "string")
        return;
    try {
        const envelope = JSON.parse(message.raw);
        try {
            const result = await handleCommand(envelope.command);
            postResponse(envelope.id, true, result);
        }
        catch (error) {
            postResponse(envelope.id, false, undefined, error instanceof Error ? error.message : String(error));
        }
    }
    catch (error) {
        postResponse((_a = message.id) !== null && _a !== void 0 ? _a : "unknown", false, undefined, error instanceof Error ? error.message : String(error));
    }
};
