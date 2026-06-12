# Figma MCP 稳定性与设计系统能力改进文档

## 1. 文档目的

本文档用于指导另一个 AI 或开发者改造 `D:\code\codex figma mcp` 本地 Figma MCP 项目。目标不是重新实现一个 MCP，而是在当前项目基础上补齐以下能力：

1. 让大规模界面生成稳定、可回滚、可诊断。
2. 让 Figma 自动布局成为默认可靠能力，而不是偶发可用能力。
3. 扩展组件工程能力，支持 component set、variants、component properties、instance overrides。
4. 扩展 variables 能力，支持 Light/Dark 主题变量、变量绑定、模式切换。
5. 为后续生成 Apple 风格移动端 App 原型提供可复用的组件和 token 基础。

本文档面向实现者。请按优先级从 P0 到 P3 推进，不要先做外观能力而跳过错误处理和事务能力。

## 2. 当前项目概览

项目当前架构：

- `src/index.ts`：Express + Streamable HTTP MCP endpoint，暴露 `/mcp` 和 `/health`。
- `src/pluginBridge.ts`：WebSocket 桥，MCP server 通过它向 Figma plugin 发送命令。
- `src/schemas.ts`：Zod schema 与 `PluginCommand` union。
- `src/mcp/tools/write.ts`：注册写入类 MCP tools。
- `src/mcp/tools/read.ts`、`pluginRead.ts`、`autoRead.ts`：REST / plugin / auto read tools。
- `plugin/code.ts`：Figma 插件主逻辑，实际执行 `figma.createFrame()`、`figma.createText()` 等。
- `plugin/code.js`：构建产物。不要手写改它，应该改 `plugin/code.ts` 后运行构建。
- `package.json`：`npm run build` 会构建 server 并通过 `build:plugin` 生成 `plugin/code.js`。

当前已支持：

- REST read：file、node、images、comments、versions。
- Plugin read：current page、page tree、node tree、selection。
- Write：frame、rectangle、text、auto layout frame、update auto layout、ellipse、line、polygon、star、vector、component、component from node、instance、detach、image fill、批量 page frame。
- Visual style：fills、strokes、strokeWeight、strokeAlign、effects、opacity、cornerRadius、cornerSmoothing。

当前缺口：

- 没有批量事务写入工具。
- 创建节点失败时缺少统一回滚。
- `effects` payload 在真实 Figma 插件运行时可能校验失败。
- MCP tool 的失败对调用方仍表现为 text content，不利于脚本稳定判断。
- component 只支持基础组件和 instance，不支持 component set / variants / component properties。
- variables 完全未暴露，无法生成真正可切换 Light/Dark 的设计系统。

## 3. 失败复盘与根因

在一次移动端 AR 社交游戏 App 界面生成中，MCP 调用出现过以下问题：

### 3.1 effects 导致插件校验失败

最小测试中，创建带 `effects` 的 frame 失败，Figma 插件侧报错类似：

```text
in set_effects: Property "effects" failed validation
```

后续脚本试图把这个错误文本当 JSON 解析，导致调用脚本崩溃。移除 `effects` 后，同类生成流程成功。

可能原因：

- 当前 `src/schemas.ts` 允许 shadow effect 携带 `spread`，但 Figma 插件运行时或特定节点类型可能不接受该字段。
- `plugin/code.ts` 的 `normalizeEffects()` 只补了 `blendMode`，没有严格按 Figma runtime 可接受字段重建 effect。
- 对 effect 字段没有插件侧二次安全 normalize，schema 通过不代表 Figma runtime 必定接受。

### 3.2 节点创建非原子，失败后留下半成品

当前 `plugin/code.ts` 中常见流程类似：

```ts
const node = figma.createFrame();
node.name = typeof payload.name === "string" ? payload.name : "MCP Frame";
applyVisualStyle(node, payload);
await appendNode(node, payload);
setGeometry(node, payload);
```

如果 `applyVisualStyle()`、`appendNode()`、`setGeometry()`、`applyAutoLayout()` 中任一步失败，已经创建的 node 可能留在画布上，常见表现是默认 `100x100` 节点或位置错误节点。后续调用继续使用错误 parent 或继续创建，会造成大量顶层散落节点。

### 3.3 单节点多次调用不适合复杂 UI 生成

高保真移动端原型通常需要数百到上千个节点。当前模式是一次 MCP tool call 创建一个节点：

- 任意一次失败会导致局部状态不一致。
- 没有 temp id 到 Figma node id 的统一映射。
- 没有 dry-run / validate-only。
- 没有批量结束后的结构校验。
- 失败后需要人工清理 Figma 画布。

### 3.4 页面没有充分使用自动布局的直接原因

在上述失败后，生成脚本为了提高成功率绕开了 `effects`，并减少了复杂嵌套写入。结果是页面级自动布局使用有限，更多采用绝对定位。

这不是 Figma `parentId` 或 auto layout 基础能力完全不可用。最小测试显示 `parentId` 对 frame、rectangle、text、auto layout frame、component 均可用。真正问题是：

- 写入链路不具备事务安全。
- 样式失败会破坏后续结构。
- 没有批量创建时的父子依赖解析和失败回滚。
- 生成端为了避免半成品扩散，主动降低了 auto layout 嵌套复杂度。

## 4. 改造原则

1. 先稳定，再扩功能。P0 必须先解决结构化错误、回滚、effects normalize。
2. 所有外部输入必须由 Zod 校验，插件侧仍需二次防御。
3. 写入工具要返回机器可解析结果，失败要可区分、可定位、可恢复。
4. 新能力优先落在 `src/schemas.ts`、`src/mcp/tools/write.ts`、`plugin/code.ts` 三处。
5. 不要直接维护 `plugin/code.js`。修改 `plugin/code.ts` 后运行 `npm run build:plugin` 或 `npm run build`。
6. 对 Figma variables / variants 这类高级能力，先加最小可用闭环，再扩展便利工具。

## 5. P0：稳定性改造

### 5.1 结构化错误返回

当前 `PluginBridge.send()` 已经会在插件返回 `ok:false` 时 reject：

```ts
if (message.ok) {
  pending.resolve(message.result ?? null);
} else {
  pending.reject(new Error(message.error || "Figma plugin command failed"));
}
```

但 MCP tool wrapper 统一返回 `content[0].text`，调用脚本仍需要解析文本。建议新增统一 wrapper：

```ts
async function callPluginTool(bridge: PluginBridge, command: PluginCommand, timeoutMs?: number) {
  try {
    const result = await bridge.send(command, timeoutMs);
    return asJsonText({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: message }, null, 2) }],
    };
  }
}
```

后续所有 write tools 使用 `callPluginTool()`，不要直接：

```ts
asJsonText(await bridge.send(...))
```

验收标准：

- 插件失败时 MCP result 包含 `isError: true`。
- `content[0].text` 是稳定 JSON，格式为 `{ "ok": false, "error": "..." }`。
- 成功时格式为 `{ "ok": true, "result": ... }`。
- `scripts/test-all-features.mjs` 不再需要猜测 raw text 是否为 JSON。

兼容性说明：

- 这会改变现有成功返回的 shape。若要兼容旧调用方，可以新增 `asStructuredJsonText()` 并只给新批量工具使用；但推荐全量切换，因为当前脚本已经在解析 JSON，改造成本低。

### 5.2 插件侧安全创建 helper

在 `plugin/code.ts` 新增统一创建 helper，确保任何创建后失败都会 remove 节点：

```ts
async function createSceneNodeSafely<T extends SceneNode>(
  createNode: () => T,
  payload: Record<string, unknown>,
  defaultName: string,
  configure?: (node: T) => Promise<void> | void,
) {
  const node = createNode();
  try {
    node.name = typeof payload.name === "string" ? payload.name : defaultName;
    await appendNode(node, payload);
    setGeometry(node, payload);
    applyVisualStyle(node, payload);
    if (configure) await configure(node);
    return node;
  } catch (error) {
    try {
      node.remove();
    } catch {
      // Ignore cleanup errors; original error is more useful.
    }
    throw error;
  }
}
```

推荐顺序：

1. `appendNode`：先确定 parent 合法，避免设置大量属性后 parent 失败。
2. `setGeometry`：让节点尺寸先正确，便于 auto layout 和样式判断。
3. `applyVisualStyle`：最容易受 runtime 校验影响，放在可回滚范围内。
4. `configure`：处理 text、auto layout、vector paths、component 特有字段。

对文本节点建议特殊处理，因为需要 `loadFontAsync` 和 `characters`：

```ts
const node = await createSceneNodeSafely(
  () => figma.createText(),
  payload,
  "MCP Text",
  async (textNode) => {
    await applyTextStyle(textNode, payload);
    textNode.characters = typeof payload.text === "string" ? payload.text : "";
  },
);
```

验收标准：

- 任一 create tool 传入非法 `effects`、非法 parent 或非法 auto layout 字段时，不留下默认节点。
- `figma_create_frame`、`figma_create_rectangle`、`figma_create_text`、`figma_create_component` 均改用 helper。
- 失败时画布节点数量不增加。

### 5.3 effects schema 收窄与 normalize

优先修复 shadow effect。当前 schema：

```ts
const shadowEffectSchema = z.object({
  type: z.enum(["DROP_SHADOW", "INNER_SHADOW"]),
  color: colorSchema.extend({ a: z.number().min(0).max(1) }),
  offset: z.object({ x: z.number(), y: z.number() }),
  radius: z.number().min(0),
  spread: z.number().optional(),
  visible: z.boolean().optional(),
  blendMode: z.string().optional(),
});
```

建议：

- `blendMode` 收窄为 `z.enum(["NORMAL", "MULTIPLY", "SCREEN", "OVERLAY", "DARKEN", "LIGHTEN", "COLOR_DODGE", "COLOR_BURN", "HARD_LIGHT", "SOFT_LIGHT", "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY"]).optional()`，不要接受任意 string。
- `spread` 第一阶段从 MCP schema 中移除或默认不传入 Figma runtime。若仍保留 schema 字段，插件侧 normalize 时先 omit，等测试证明 runtime 支持再启用。
- 插件侧 `normalizeEffects()` 应重建对象，而不是透传原 object。

建议实现：

```ts
function normalizeEffects(effects: Effect[]) {
  return effects.map((effect) => {
    if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
      return {
        type: effect.type,
        visible: effect.visible ?? true,
        blendMode: effect.blendMode ?? "NORMAL",
        color: effect.color,
        offset: effect.offset,
        radius: effect.radius,
      } as Effect;
    }

    if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
      return {
        type: effect.type,
        visible: effect.visible ?? true,
        radius: effect.radius,
      } as Effect;
    }

    return effect;
  });
}
```

验收标准：

- 带 drop shadow 的 frame / rectangle 创建成功。
- 不传 `blendMode` 时自动补 `NORMAL`。
- 传 `spread` 不再导致失败；要么 schema 拒绝，要么插件侧忽略。
- `scripts/test-all-features.mjs` 中 `shadow` 用例恢复可运行。

### 5.4 桥接层可观测性

扩展 `PluginBridge` 状态：

```ts
type BridgeEvent = {
  commandId: string;
  commandType: string;
  startedAt: number;
  finishedAt?: number;
  ok?: boolean;
  error?: string;
};
```

在 `PluginBridge` 中维护：

- `lastCommand`
- `lastCommandAt`
- `lastResultAt`
- `lastError`
- `pendingRequests`
- `connectedSince`

`getStatus()` 返回：

```json
{
  "connected": true,
  "metadata": {},
  "pendingRequests": 0,
  "connectedSince": 1710000000000,
  "lastCommand": "createFrame",
  "lastCommandAt": 1710000001000,
  "lastResultAt": 1710000001200,
  "lastError": null
}
```

同步更新：

- `/health`
- `figma_plugin_status`
- `scripts/codex-ready-check.mjs`

验收标准：

- 失败后 `/health` 能看到最后失败命令和错误。
- 插件断开后 pending requests 全部 reject，状态里没有永久挂起请求。

### 5.5 pending request reset / cancel

新增桥接方法：

```ts
cancelAll(reason = "Canceled by MCP client") {
  for (const [id, pending] of this.pending) {
    clearTimeout(pending.timeout);
    pending.reject(new Error(reason));
    this.pending.delete(id);
  }
}
```

新增 MCP tools：

- `figma_plugin_cancel_pending`
- `figma_plugin_reset_bridge`

`reset_bridge` 行为：

- cancel all pending。
- close current socket。
- 清空 metadata。
- 要求用户重开 Figma plugin。

验收标准：

- 超时或异常后可通过 tool 清理 pending。
- `/health.plugin.pendingRequests` 回到 0。

## 6. P1：批量写入与事务

### 6.1 新增 `figma_batch_create_nodes`

目的：让复杂 UI 原型一次提交一棵结构树，插件内部解析父子关系和 temp id，失败时统一回滚。

建议 schema：

```ts
const batchNodeSchema = z.object({
  tempId: z.string().min(1),
  type: z.enum([
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
  ]),
  parentTempId: z.string().min(1).optional(),
  parentId: z.string().min(1).optional(),
  props: z.record(z.unknown()),
});

const batchCreateNodesSchema = z.object({
  nodes: z.array(batchNodeSchema).min(1).max(500),
  rollbackOnError: z.boolean().default(true),
  validateOnly: z.boolean().optional(),
  selectCreated: z.boolean().optional(),
  scrollIntoView: z.boolean().optional(),
});
```

工具：

- MCP tool name：`figma_batch_create_nodes`
- Plugin command：`batchCreateNodes`

返回：

```json
{
  "ok": true,
  "result": {
    "created": [
      { "tempId": "screen.home", "id": "12:34", "type": "FRAME", "name": "Home" }
    ],
    "idMap": {
      "screen.home": "12:34"
    }
  }
}
```

失败返回：

```json
{
  "ok": false,
  "error": "Node card.primary failed: Parent temp id not found",
  "createdBeforeRollback": [
    { "tempId": "screen.home", "id": "12:34" }
  ],
  "rolledBack": true
}
```

### 6.2 批量写入执行规则

插件侧流程：

1. 如果 `validateOnly` 为 true，只校验 type、parent 引用、必要 props，不创建节点。
2. 对 `nodes` 做拓扑顺序处理：
   - 若节点有 `parentTempId`，必须在前序节点中存在。
   - 若节点有 `parentId`，用真实 Figma parent。
   - 同时传 `parentTempId` 和 `parentId` 时拒绝。
3. 每个节点创建后记录：
   - `tempId -> node`
   - `createdNodes[]`
4. 任一节点失败：
   - 若 `rollbackOnError: true`，逆序 remove `createdNodes`。
   - 返回结构化错误，包含失败节点 tempId 和 command type。
5. 全部成功后可选 selection / scroll。

### 6.3 批量工具必须默认使用自动布局

为 Apple 移动端 UI 原型服务时，生成端应优先表达布局语义，而不是绝对定位。批量工具应允许：

- Frame / Component 设置 auto layout。
- Child 设置 layout sizing。
- 支持 `layoutGrow`、`layoutAlign`、`layoutPositioning`、`minWidth`、`maxWidth`、`minHeight`、`maxHeight`。

当前 `autoLayoutSchema` 只覆盖 container 属性，不覆盖 child layout 属性。新增：

```ts
const layoutChildSchema = z.object({
  layoutAlign: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "INHERIT"]).optional(),
  layoutGrow: z.number().min(0).optional(),
  layoutPositioning: z.enum(["AUTO", "ABSOLUTE"]).optional(),
  minWidth: z.number().min(0).optional(),
  maxWidth: z.number().min(0).optional(),
  minHeight: z.number().min(0).optional(),
  maxHeight: z.number().min(0).optional(),
});
```

插件侧新增 `applyLayoutChildProps(node, payload)`。

验收标准：

- 可以用一次 `figma_batch_create_nodes` 创建一个 iPhone screen frame，内部包含 status bar、nav bar、tab bar、card list，并且主要容器都是 auto layout。
- 任意一个深层 text 创建失败时，整个 screen 被回滚。
- `validateOnly` 不改变 Figma 画布。

## 7. P2：组件工程化能力

当前已有：

- `figma_create_component`
- `figma_create_component_from_node`
- `figma_create_instance`
- `figma_detach_instance`

这些只能支持“创建一个组件，然后放实例”。对于真实 iOS App 原型，需要支持：

- Component Set / Variants。
- Variant properties，例如 `Mode=Light|Dark`、`State=Default|Pressed|Disabled`、`Size=Small|Medium|Large`。
- Component properties，例如文本覆盖、图标显隐、实例替换。
- Instance overrides，例如创建按钮实例时直接传 `{ State: "Pressed", Label: "Start" }`。

### 7.1 新增 `figma_combine_as_variants`

Figma Plugin API 没有 `createComponentSet()`，因为空 component set 不被支持。应使用：

```ts
figma.combineAsVariants(nodes, parent, index?)
```

新增工具：

```ts
const combineAsVariantsSchema = z.object({
  componentIds: z.array(z.string().min(1)).min(2).max(100),
  parentId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  index: z.number().int().min(0).optional(),
});
```

MCP tool：

- `figma_combine_as_variants`

Plugin command：

- `combineAsVariants`

插件侧逻辑：

```ts
const components = [];
for (const id of componentIds) {
  const node = await figma.getNodeByIdAsync(id);
  if (!node || node.type !== "COMPONENT") throw new Error(`Component not found: ${id}`);
  components.push(node);
}
const parent = parentId ? await getFrameParent(parentId) : figma.currentPage;
const set = figma.combineAsVariants(components, parent, index);
if (typeof name === "string") set.name = name;
return serializeComponentSet(set);
```

验收标准：

- 两个及以上 component 可以合并成 component set。
- 返回 component set id、children ids、componentPropertyDefinitions、每个 child 的 variantProperties。

### 7.2 variant 属性命名规范

Figma variant properties 从 component 名称推导。生成前应命名 component：

```text
Button / Mode=Light, State=Default, Size=Medium
Button / Mode=Light, State=Pressed, Size=Medium
Button / Mode=Dark, State=Default, Size=Medium
Button / Mode=Dark, State=Pressed, Size=Medium
```

建议新增工具辅助重命名：

- `figma_set_variant_properties`

输入：

```json
{
  "componentId": "12:34",
  "baseName": "Button / Primary",
  "properties": {
    "Mode": "Light",
    "State": "Default",
    "Size": "Medium"
  }
}
```

插件侧最小实现可以先通过命名完成：

```ts
component.name = `${baseName}, ${Object.entries(properties).map(([k, v]) => `${k}=${v}`).join(", ")}`;
```

注意：

- 对已在 component set 内的 variant，`variantProperties` 是只读属性，不能直接赋值。
- 修改 variant 通常通过组件命名和 component set 定义来实现。
- 如果后续使用 `componentSet.addComponentProperty()` 编辑 VARIANT property，要先验证 Figma API 对 variant property 的限制。

验收标准：

- combine 后 `componentSet.componentPropertyDefinitions` 中能看到 `Mode`、`State`、`Size`。
- 每个 child 的 `variantProperties` 正确。

### 7.3 新增 `figma_create_instance_with_overrides`

当前 `figma_create_instance` 只能创建默认实例。新增工具：

```ts
const createInstanceWithOverridesSchema = z.object({
  componentId: z.string().min(1),
  parentId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  properties: z.record(z.union([z.string(), z.boolean()])).optional(),
});
```

对于 variants：

```json
{
  "componentId": "component-set-child-or-main-component-id",
  "properties": {
    "Mode": "Dark",
    "State": "Pressed"
  }
}
```

插件侧：

```ts
if (node.type === "INSTANCE" && payload.properties && typeof payload.properties === "object") {
  node.setProperties(payload.properties as { [propertyName: string]: string | boolean });
}
```

注意：

- `InstanceNode.setProperties()` 对 VARIANT 使用普通 property name，例如 `State`。
- 对 TEXT / BOOLEAN / INSTANCE_SWAP component property，property name 可能带 `#0:1` 后缀。工具应提供 `figma_get_component_properties` 方便调用方读取真实 key。

验收标准：

- 创建 button instance 时可以一次设置 `State=Pressed`。
- 对不存在的 property 返回清晰错误。
- 返回 instance 的 `componentProperties` 和 `variantProperties`。

### 7.4 新增 component properties 支持

新增工具：

1. `figma_add_component_property`
2. `figma_edit_component_property`
3. `figma_set_component_property_reference`
4. `figma_get_component_properties`

#### `figma_add_component_property`

输入：

```json
{
  "componentId": "12:34",
  "propertyName": "Label",
  "propertyType": "TEXT",
  "defaultValue": "Play"
}
```

支持类型：

- `TEXT`
- `BOOLEAN`
- `INSTANCE_SWAP`
- `VARIANT`

插件侧：

```ts
const key = component.addComponentProperty(propertyName, propertyType, defaultValue, options);
return { propertyName: key, definitions: component.componentPropertyDefinitions };
```

#### `figma_set_component_property_reference`

用于把 component property 绑定到组件内部某个 layer，例如：

- 文本内容：`characters -> Label#0:1`
- 图标显隐：`visible -> IconVisible#0:0`

输入：

```json
{
  "nodeId": "12:45",
  "references": {
    "characters": "Label#0:1",
    "visible": "IconVisible#0:0"
  }
}
```

插件侧：

```ts
node.componentPropertyReferences = {
  ...(node.componentPropertyReferences ?? {}),
  ...references,
};
```

注意：

- 只有 component 子层或 instance 子层支持 `componentPropertyReferences`。
- 对不支持的节点要返回清晰错误。

验收标准：

- Button component 暴露 `Label` 文本属性。
- 创建 instance 后可以 `setProperties({ "Label#...": "Invite" })` 改按钮文案。
- 图标 layer 可以通过 BOOLEAN property 控制 visible。

### 7.5 推荐组件命名与结构

组件库页面建议结构：

```text
_Components
  Button / Primary
    Mode=Light, State=Default, Size=Medium
    Mode=Light, State=Pressed, Size=Medium
    Mode=Light, State=Disabled, Size=Medium
    Mode=Dark, State=Default, Size=Medium
    Mode=Dark, State=Pressed, Size=Medium
    Mode=Dark, State=Disabled, Size=Medium
  Navigation / Tab Bar
  Card / Doll
  Control / AR Action
```

移动端 AR 游戏原型的最小组件集：

- `Button / Primary`
- `Button / Secondary`
- `Button / Icon`
- `Navigation / Top Bar`
- `Navigation / Tab Bar`
- `Card / Friend`
- `Card / Doll`
- `AR / Action Chip`
- `AR / Placement Hint`
- `Room / Session Pill`
- `Modal / Share Invite`

每个核心组件至少支持：

- `Mode=Light|Dark`
- `State=Default|Pressed|Disabled`

如果使用 variables 做主题，`Mode=Light|Dark` variant 可以降级为可选；更推荐用 variables 控制色彩，用 variants 控制交互状态和尺寸。

## 8. P2/P3：Variables 与 Light/Dark 主题能力

用户明确需要组件能切换 Light/Dark 模式。仅做两套静态组件不够，应该引入 Figma variables。

Figma Plugin API 当前支持：

- `figma.variables.createVariableCollection(name)`
- `collection.addMode(name)`
- `figma.variables.createVariable(name, collection, resolvedType)`
- `variable.setValueForMode(modeId, value)`
- `figma.variables.getLocalVariablesAsync(type?)`
- `figma.variables.getLocalVariableCollectionsAsync()`
- `node.setBoundVariable(field, variable)`
- `figma.variables.setBoundVariableForPaint(paint, "color", variable)`
- `figma.variables.setBoundVariableForEffect(effect, field, variable)`
- `node.setExplicitVariableModeForCollection(collection, modeId)`

### 8.1 新增 variable schemas

在 `src/schemas.ts` 中新增：

```ts
const variableResolvedTypeSchema = z.enum(["BOOLEAN", "COLOR", "FLOAT", "STRING"]);

const rgbaVariableValueSchema = z.object({
  r: z.number().min(0).max(1),
  g: z.number().min(0).max(1),
  b: z.number().min(0).max(1),
  a: z.number().min(0).max(1).optional(),
});

const variableValueSchema = z.union([
  z.boolean(),
  z.string(),
  z.number(),
  rgbaVariableValueSchema,
  z.object({ type: z.literal("VARIABLE_ALIAS"), id: z.string().min(1) }),
]);

const variableScopeSchema = z.enum([
  "ALL_SCOPES",
  "TEXT_CONTENT",
  "CORNER_RADIUS",
  "WIDTH_HEIGHT",
  "GAP",
  "ALL_FILLS",
  "FRAME_FILL",
  "SHAPE_FILL",
  "TEXT_FILL",
  "STROKE_COLOR",
  "STROKE_FLOAT",
  "EFFECT_FLOAT",
  "EFFECT_COLOR",
  "OPACITY",
  "FONT_FAMILY",
  "FONT_STYLE",
  "FONT_WEIGHT",
  "FONT_SIZE",
  "LINE_HEIGHT",
  "LETTER_SPACING",
  "PARAGRAPH_SPACING",
  "PARAGRAPH_INDENT",
]);
```

### 8.2 新增 variable MCP tools

第一阶段必须实现：

- `figma_create_variable_collection`
- `figma_add_variable_mode`
- `figma_create_variable`
- `figma_set_variable_value_for_mode`
- `figma_get_local_variables`
- `figma_get_local_variable_collections`
- `figma_bind_variable`
- `figma_set_explicit_variable_mode`

#### `figma_create_variable_collection`

输入：

```json
{
  "name": "Theme"
}
```

返回：

```json
{
  "id": "VariableCollectionId:...",
  "name": "Theme",
  "defaultModeId": "...",
  "modes": [
    { "modeId": "...", "name": "Mode 1" }
  ]
}
```

#### `figma_add_variable_mode`

输入：

```json
{
  "collectionId": "VariableCollectionId:...",
  "name": "Dark"
}
```

实现：

```ts
const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
const modeId = collection.addMode(name);
```

注意：

- 默认 collection 创建后已有一个 mode，建议把默认 mode rename 为 `Light`。
- 需要新增 `figma_rename_variable_mode`，或者 `create_collection` 支持 `defaultModeName`。

#### `figma_create_variable`

输入：

```json
{
  "collectionId": "VariableCollectionId:...",
  "name": "color/bg/canvas",
  "resolvedType": "COLOR",
  "scopes": ["FRAME_FILL", "SHAPE_FILL"]
}
```

实现：

```ts
const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
const variable = figma.variables.createVariable(name, collection, resolvedType);
if (Array.isArray(scopes)) variable.scopes = scopes;
```

#### `figma_set_variable_value_for_mode`

输入：

```json
{
  "variableId": "VariableID:...",
  "modeId": "...",
  "value": { "r": 0.98, "g": 0.98, "b": 1, "a": 1 }
}
```

实现：

```ts
const variable = await figma.variables.getVariableByIdAsync(variableId);
variable.setValueForMode(modeId, normalizeVariableValue(value));
```

#### `figma_bind_variable`

用于把变量绑定到节点字段或 paint/effect 字段。

输入建议：

```json
{
  "nodeId": "12:34",
  "target": "fills",
  "index": 0,
  "field": "color",
  "variableId": "VariableID:..."
}
```

支持 target：

- `nodeField`
- `fills`
- `strokes`
- `effects`
- `textRangeFills`

对于节点字段：

```json
{
  "nodeId": "12:34",
  "target": "nodeField",
  "field": "itemSpacing",
  "variableId": "VariableID:..."
}
```

插件侧实现：

```ts
const variable = await figma.variables.getVariableByIdAsync(variableId);

if (target === "nodeField") {
  node.setBoundVariable(field as VariableBindableNodeField, variable);
}

if (target === "fills") {
  if (!("fills" in node) || node.fills === figma.mixed) throw new Error("Node does not have bindable fills");
  const fills = node.fills.slice();
  const paint = fills[index];
  if (!paint || paint.type !== "SOLID") throw new Error("Only SOLID paint color binding is supported in phase 1");
  fills[index] = figma.variables.setBoundVariableForPaint(paint, "color", variable);
  node.fills = fills;
}

if (target === "strokes") {
  // Same as fills.
}

if (target === "effects") {
  const effects = node.effects.slice();
  effects[index] = figma.variables.setBoundVariableForEffect(effects[index], field, variable);
  node.effects = effects;
}
```

第一阶段只要求：

- SOLID fill color 绑定。
- SOLID stroke color 绑定。
- node field 绑定 `width`、`height`、`itemSpacing`、padding、corner radius、opacity、fontSize、lineHeight 等。

第二阶段再支持：

- effect color / radius / offset。
- text range fills。
- component property alias。

#### `figma_set_explicit_variable_mode`

输入：

```json
{
  "nodeId": "12:34",
  "collectionId": "VariableCollectionId:...",
  "modeId": "..."
}
```

实现：

```ts
const node = await figma.getNodeByIdAsync(nodeId);
const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
node.setExplicitVariableModeForCollection(collection, modeId);
```

验收标准：

- 在一个 screen frame 上设置 `Theme=Dark` 后，绑定了 Theme variables 的子节点自动显示 dark 值。
- 清除或切换 mode 后颜色正确更新。

### 8.3 主题 token 设计

推荐创建 collection：

```text
Theme
  Modes:
    Light
    Dark
```

颜色变量：

```text
color/bg/canvas
color/bg/elevated
color/bg/subtle
color/text/primary
color/text/secondary
color/text/tertiary
color/text/inverse
color/accent/primary
color/accent/secondary
color/status/success
color/status/warning
color/status/error
color/border/default
color/border/strong
color/ar/placement
color/ar/session
```

尺寸变量：

```text
space/2
space/4
space/8
space/12
space/16
space/20
space/24
space/32
radius/8
radius/12
radius/16
radius/20
radius/full
font/size/caption
font/size/body
font/size/title
```

变量 scope 建议：

- `color/bg/*`：`FRAME_FILL`、`SHAPE_FILL`
- `color/text/*`：`TEXT_FILL`
- `color/border/*`：`STROKE_COLOR`
- `space/*`：`GAP`
- `radius/*`：`CORNER_RADIUS`
- `font/size/*`：`FONT_SIZE`

### 8.4 一次性创建主题变量工具

为了让 AI 生成原型时更稳定，建议额外提供高层工具：

- `figma_create_theme_tokens`

输入：

```json
{
  "collectionName": "Theme",
  "modes": ["Light", "Dark"],
  "tokens": [
    {
      "name": "color/bg/canvas",
      "type": "COLOR",
      "scopes": ["FRAME_FILL"],
      "values": {
        "Light": { "r": 0.98, "g": 0.98, "b": 1, "a": 1 },
        "Dark": { "r": 0.04, "g": 0.05, "b": 0.07, "a": 1 }
      }
    },
    {
      "name": "space/16",
      "type": "FLOAT",
      "scopes": ["GAP"],
      "values": {
        "Light": 16,
        "Dark": 16
      }
    }
  ]
}
```

返回：

```json
{
  "collectionId": "...",
  "modes": {
    "Light": "...",
    "Dark": "..."
  },
  "variables": {
    "color/bg/canvas": "VariableID:...",
    "space/16": "VariableID:..."
  }
}
```

这个工具不是必须的底层能力，但对 AI 使用体验很重要。它能避免一次创建几十个变量时出现中间失败、modeId 对不上、变量 id 丢失。

### 8.5 使用 variables 生成 Light/Dark 组件的推荐方式

不要为 Light 和 Dark 各复制一套组件并手写颜色。推荐：

1. 创建 `Theme` collection，包含 `Light` 和 `Dark` mode。
2. 创建语义变量，例如 `color/bg/elevated`、`color/text/primary`。
3. 在组件主层和子层上使用 `figma_bind_variable` 绑定 fill、stroke、text fill。
4. 在页面 frame 上使用 `figma_set_explicit_variable_mode` 指定 Light 或 Dark。
5. 组件 variants 只表达状态，例如 `State=Default|Pressed|Disabled`、`Size=Medium|Large`。

例外：

- 如果某些 dark 模式布局或图形完全不同，可以保留 `Mode=Light|Dark` variant。
- 但颜色、字号、间距优先用 variables，不要用 variants 重复维护。

## 9. P3：读能力扩展

为了审阅和自动修复，需要让 read tools 能读到新增能力。

扩展 `serializeSceneNode()`：

- `variantProperties`
- `componentPropertyDefinitions`
- `componentProperties`
- `componentPropertyReferences`
- `boundVariables`
- `explicitVariableModes`
- `resolvedVariableModes`

新增工具：

- `figma_plugin_get_local_variables`
- `figma_plugin_get_component_properties`
- `figma_plugin_get_node_bindings`

验收标准：

- 生成后可以通过 plugin read 判断某个 button instance 当前 `State` 是否为 `Pressed`。
- 可以读到某个 frame 是否设置了 Theme collection 的 Dark mode。
- 可以读到某个 text fill 是否绑定到 `color/text/primary`。

## 10. Apple 移动端 UI 原型生成规范落地

这个 MCP 后续会用于生成符合 Apple 原则的移动端界面。工具层应支持以下约束：

### 10.1 默认尺寸与布局

- iPhone 15/16 系列常用 frame：`393x852` 或 `390x844`。
- 根 screen frame 使用 vertical auto layout。
- 顶部安全区、导航栏、内容区、底部 tab bar 分层清晰。
- 内容区使用 scroll-like vertical auto layout。
- 组件内部使用 auto layout，不使用绝对定位堆文本。

### 10.2 设计 token

使用变量而不是硬编码颜色：

- 背景：`color/bg/canvas`
- 卡片：`color/bg/elevated`
- 主文本：`color/text/primary`
- 次文本：`color/text/secondary`
- 主按钮：`color/accent/primary`
- 描边：`color/border/default`

间距和圆角用 variables：

- `space/8`
- `space/12`
- `space/16`
- `radius/12`
- `radius/16`
- `radius/full`

### 10.3 组件 variants

按钮组件至少：

```text
Button / Primary
  State=Default
  State=Pressed
  State=Disabled
  Size=Medium
```

AR 操作按钮：

```text
AR / Action Chip
  Action=Place
  Action=Move
  Action=Interact
  State=Default
  State=Active
  State=Disabled
```

好友卡片：

```text
Card / Friend
  Presence=Online
  Presence=InRoom
  Presence=Offline
```

### 10.4 实例 overrides

生成页面时不要复制组件源节点。使用：

- `figma_create_instance_with_overrides`
- `figma_set_explicit_variable_mode`
- `figma_bind_variable`

示例：

```json
{
  "componentId": "ButtonPrimaryComponentId",
  "parentId": "ScreenContentId",
  "name": "Invite Friend Button",
  "x": 0,
  "y": 0,
  "properties": {
    "State": "Default",
    "Label#0:1": "Invite"
  }
}
```

## 11. 实施顺序

### Phase A：稳定性修复

修改文件：

- `src/mcp/tools/write.ts`
- `src/pluginBridge.ts`
- `plugin/code.ts`
- `src/index.ts`
- `scripts/test-all-features.mjs`
- `scripts/codex-ready-check.mjs`

任务：

1. 新增 structured tool result wrapper。
2. 新增 `createSceneNodeSafely()`。
3. 修复 `normalizeEffects()`。
4. 扩展 `/health` 和 `figma_plugin_status`。
5. 新增 cancel/reset bridge tools。
6. 跑通 `npm run typecheck`、`npm run build`。

### Phase B：批量事务写入

修改文件：

- `src/schemas.ts`
- `src/mcp/tools/write.ts`
- `plugin/code.ts`
- `docs/expanded-tools.md`
- `scripts/test-all-features.mjs`

任务：

1. 新增 `figma_batch_create_nodes`。
2. 新增 temp id 映射和 rollback。
3. 支持 container auto layout 和 child layout props。
4. 新增 validate-only。
5. 增加批量 screen 生成测试。

### Phase C：组件 variants

修改文件：

- `src/schemas.ts`
- `src/mcp/tools/write.ts`
- `plugin/code.ts`
- `docs/tasks/components.md`
- `docs/expanded-tools.md`

任务：

1. 新增 `figma_combine_as_variants`。
2. 新增 `figma_set_variant_properties` 或命名辅助。
3. 新增 `figma_create_instance_with_overrides`。
4. 新增 component properties 系列工具。
5. 扩展 read serialization。

### Phase D：variables

修改文件：

- `src/schemas.ts`
- `src/mcp/tools/write.ts`
- `src/mcp/tools/pluginRead.ts`
- `plugin/code.ts`
- `docs/expanded-tools.md`
- `docs/product-usage-guide.md`

任务：

1. 新增 variables 底层 tools。
2. 新增 variable binding。
3. 新增 explicit mode switching。
4. 新增 `figma_create_theme_tokens` 高层工具。
5. 扩展 read serialization 以返回 bindings 和 modes。

## 12. 测试计划

### 12.1 基础命令

```bash
npm run typecheck
npm run build
npm run codex:check
```

### 12.2 P0 回归测试

1. 打开 Figma 测试文件并启动插件。
2. 创建带 shadow 的 frame。
3. 创建带非法 parentId 的 rectangle，确认不留下节点。
4. 创建带非法 effect payload 的 frame，确认不留下节点。
5. 查看 `/health`，确认 lastError 有记录。
6. 调用 `figma_plugin_cancel_pending`，确认 pendingRequests 为 0。

### 12.3 批量事务测试

1. 用 `figma_batch_create_nodes` 创建一个完整 iPhone screen：
   - root screen frame
   - status bar
   - nav bar
   - content list
   - bottom tab bar
2. 确认主要容器都有 auto layout。
3. 在批量 payload 中插入一个错误 text font 或错误 parentTempId。
4. 确认 rollback 后没有残留节点。
5. 使用 `validateOnly: true` 确认画布无变化。

### 12.4 variants 测试

1. 创建 4 个 button component：
   - `Button / Primary, State=Default, Size=Medium`
   - `Button / Primary, State=Pressed, Size=Medium`
   - `Button / Primary, State=Disabled, Size=Medium`
   - `Button / Primary, State=Default, Size=Large`
2. 调用 `figma_combine_as_variants`。
3. 读取 component set，确认 `componentPropertyDefinitions` 包含 `State`、`Size`。
4. 调用 `figma_create_instance_with_overrides` 创建 `State=Pressed` 实例。
5. 读取 instance，确认 `variantProperties.State === "Pressed"`。

### 12.5 component properties 测试

1. 给 Button component 添加 TEXT property：`Label`。
2. 将内部 text layer 的 `characters` 绑定到该 property。
3. 创建 instance，传入 `Label#... = "Invite"`。
4. 确认 instance 显示 Invite。
5. 添加 BOOLEAN property：`IconVisible`。
6. 将 icon layer 的 `visible` 绑定到该 property。
7. 创建 instance，传入 `IconVisible#... = false`，确认图标隐藏。

### 12.6 variables 测试

1. 创建 `Theme` collection。
2. 将默认 mode 改为 `Light`，添加 `Dark` mode。
3. 创建 `color/bg/canvas`、`color/text/primary`、`color/accent/primary`。
4. 分别设置 Light / Dark 值。
5. 创建一个 frame 和 text，绑定 fill 到变量。
6. 在 frame 上设置 explicit mode 为 Dark，确认颜色变化。
7. 切回 Light，确认颜色恢复。

## 13. 验收标准

完成后必须满足：

1. 复杂 UI 生成失败不会污染画布。
2. `effects` 可以用于常见卡片 shadow，不会导致插件断连或残留节点。
3. `/health` 和 `figma_plugin_status` 能定位最后一次失败。
4. 可以一次批量生成包含 auto layout 的 iPhone screen。
5. 可以创建 component set，并用 variant properties 创建不同状态的 instance。
6. 可以创建 Theme variables，并把 fills / strokes / text fills 绑定到变量。
7. 可以通过设置 frame 的 variable mode 在 Light / Dark 之间切换。
8. `npm run typecheck`、`npm run build`、`npm run codex:check` 通过。
9. 文档 `docs/expanded-tools.md` 和 `docs/product-usage-guide.md` 更新，用户知道新工具怎么用。

## 14. 非目标与风险

非目标：

- 不实现 Figma prototype interaction 编辑。当前 Figma Plugin API 对传统 prototype connections 支持有限，本文档不要求实现点击跳转、转场动画等。
- 不接入远程团队 library variables 的自动启用。Plugin API 不能替用户启用 library。
- 不做任意 JS 执行工具。

风险：

- Figma 不同账号套餐对 variable modes 数量可能有限制；`collection.addMode()` 可能抛错。
- `spread`、部分 effect 字段在当前 runtime 上可能不稳定，先保守 omit。
- `componentPropertyReferences` 对节点位置和类型有限制，必须测试 component 子层场景。
- 批量事务工具 max nodes 需要限制，建议第一版上限 500，避免插件 UI 卡死。
- 结构化返回如果改变成功结果 shape，可能需要同步更新已有脚本。

## 15. 给执行 AI 的提示词摘要

如果把本任务交给另一个 AI，可直接给它以下指令：

```text
请在 D:\code\codex figma mcp 项目中按 docs/figma-mcp-improvement-plan.md 实施改造。优先完成 P0 稳定性、P1 批量事务写入、P2 component variants、P2/P3 variables。只修改 TypeScript 源码和文档，不要手写 plugin/code.js；修改后运行 npm run typecheck 和 npm run build 生成 plugin/code.js。所有新工具必须有 Zod schema、MCP tool 注册、plugin command handler、文档和脚本测试。实现完成后保留工作区改动供审阅，不要自行清理 unrelated dirty files。
```

