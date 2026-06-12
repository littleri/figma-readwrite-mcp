# Figma MCP Component Property 能力改进文档

## 1. 文档目的

本文档用于指导另一个 AI 或开发者继续改造本地项目：

```text
D:\code\codex figma mcp
```

目标是把当前 MCP 的组件能力从“可以调用 Figma component property API”提升到“AI 可以稳定创建、覆盖、审计复杂组件库”。改完后，本线程会按照本文档的验收标准进行复审。

本文档重点不在基础组件创建、variants 或 variables，这些能力已经有可用闭环；重点在 component properties 的易用性、稳定性和可验证性。

## 2. 当前现状

当前项目已经支持：

- `figma_create_component`
- `figma_create_component_from_node`
- `figma_create_instance`
- `figma_detach_instance`
- `figma_combine_as_variants`
- `figma_add_component_property`
- `figma_edit_component_property`
- `figma_set_component_property_reference`
- `figma_get_component_properties`
- `figma_create_instance_with_overrides`

已实测可用的闭环：

- component variants 可以创建并组合为 component set
- `figma_create_instance_with_overrides` 可以用 `{ "State": "Pressed" }` 切换 variant
- Light/Dark variables mode 可以切换
- shadow 创建失败不会残留节点
- batch rollback 已验证

但当前 component property 仍存在几个明显问题：

1. property reference 需要调用方知道 Figma 内部字段或 key，AI 使用成本高。
2. instance overrides 需要调用方知道真实 property key；如果 property name 和 Figma key 不一致，容易失败。
3. 缺少“一步创建带 TEXT / BOOLEAN / INSTANCE_SWAP properties 的组件”的高级工具。
4. 缺少 property 是否真的绑定、生效、可 override 的审计工具。
5. `figma_get_node` / `figma_get_node_tree` 对某些 component set / variant component 的读取可能触发 `get_componentPropertyDefinitions` 报错，需要修复读取序列化的健壮性。
6. `src/schemas.ts` 中 `componentPropertyTypeSchema` 包含 `VARIANT`，但 `src/mcp/tools/write.ts` 注册的 `figma_add_component_property` 只允许 `TEXT | BOOLEAN | INSTANCE_SWAP`，实现口径不一致。

## 3. 改造目标

改造完成后，AI 应该能用人类可读的方式完成以下任务：

```json
{
  "componentId": "...",
  "properties": {
    "State": "Pressed",
    "Label": "扫码加入",
    "Show Icon": false,
    "Leading Icon": "Icon / QR"
  }
}
```

而不是必须先读取并手动处理类似 `Label#123:4` 的内部 key。

理想结果：

- 创建复杂组件时有事务回滚。
- 设置 property reference 时可用 layer name 定位。
- 创建 instance 时可用 property display name 做 overrides。
- BOOLEAN property 可以控制 layer visibility，并验证 Auto Layout 是否收缩。
- INSTANCE_SWAP property 可以通过 component name 或 component id 指定。
- 审计工具可以报告 properties、references、overrides 是否真实生效。

## 4. 优先级总览

### P0

1. 修复 component node 读取稳定性。
2. 新增 property key 解析 helper，使 overrides 支持 display name。
3. 新增 `figma_create_instance_smart`。
4. 新增 `figma_audit_component_properties`。
5. 完善 TEXT / BOOLEAN property reference 的绑定和读回验证。

### P1

1. 新增 `figma_create_component_with_properties`。
2. 支持通过 layer name 设置 component property references。
3. 支持 BOOLEAN visibility 绑定后的 Auto Layout 收缩验收。
4. 支持 INSTANCE_SWAP 通过 component name 解析。

### P2

1. 支持批量创建组件库模板，例如 Button、Tab Item、List Row、Player Chip。
2. 支持 allowed swap components。
3. 支持 component property dry-run / validate-only。

## 5. P0-1：修复 component 读取稳定性

### 问题

在实际使用中，对某些 component set / variant component 调用读取工具时出现：

```text
in get_componentPropertyDefinitions: Can only get component property definitions of a component set or non-variant component
```

这会影响：

- `figma_plugin_get_node`
- `figma_plugin_get_node_tree`
- `figma_plugin_get_node_bindings`
- 组件审计
- 生成后验收

### 修改建议

位置：

```text
plugin/code.ts
```

检查 `serializeSceneNode()` / `serializeNode()` 中读取 `componentPropertyDefinitions` 的逻辑。不要仅用：

```ts
if ("componentPropertyDefinitions" in node && node.componentPropertyDefinitions) {
  result.componentPropertyDefinitions = ...
}
```

因为 variant component 可能暴露字段但访问时报错。

建议改为安全 helper：

```ts
function safeGetComponentPropertyDefinitions(node: SceneNode) {
  try {
    if (node.type === "COMPONENT_SET") {
      return Object.assign({}, node.componentPropertyDefinitions);
    }

    if (node.type === "COMPONENT") {
      // Variant component may throw when reading definitions.
      // Non-variant component should be readable.
      return Object.assign({}, node.componentPropertyDefinitions);
    }
  } catch (_error) {
    return undefined;
  }

  return undefined;
}
```

序列化时：

```ts
const definitions = safeGetComponentPropertyDefinitions(node);
if (definitions) {
  result.componentPropertyDefinitions = definitions;
}
```

同理，`componentPropertyReferences` 也要用 try/catch，避免读取某些子层时中断整棵树序列化。

### 验收标准

- `figma_plugin_get_node_tree` 读取包含 component set、variant component、instance 的节点树不报错。
- 读取 Button component set 能返回 `componentPropertyDefinitions`。
- 读取 Button variant component 不因 property definitions 报错。
- 读取普通 frame 不受影响。

## 6. P0-2：统一 property key 解析 helper

### 问题

Figma 的 component property definitions 可能使用用户可见名称，也可能包含内部 suffix。AI 很难稳定知道 override 应该传：

```json
{ "Label": "保存" }
```

还是：

```json
{ "Label#149:123": "保存" }
```

### 目标

新增内部 helper，让所有高级 property 工具都可以通过 display name、exact key 或大小写宽松匹配来解析 property key。

### 建议实现

位置：

```text
plugin/code.ts
```

新增：

```ts
function normalizePropertyName(value: string) {
  return value.trim().toLowerCase();
}

function getPropertyDisplayName(key: string, definition: ComponentPropertyDefinition) {
  const defName = typeof (definition as any).name === "string" ? (definition as any).name : undefined;
  if (defName) return defName;
  return key.split("#")[0];
}

function resolveComponentPropertyKey(
  definitions: Record<string, ComponentPropertyDefinition>,
  requested: string,
) {
  if (definitions[requested]) return requested;

  const wanted = normalizePropertyName(requested);
  const matches = Object.entries(definitions).filter(([key, definition]) => {
    return normalizePropertyName(key) === wanted ||
      normalizePropertyName(key.split("#")[0]) === wanted ||
      normalizePropertyName(getPropertyDisplayName(key, definition)) === wanted;
  });

  if (matches.length === 1) return matches[0][0];
  if (matches.length > 1) {
    throw new Error(`Ambiguous component property '${requested}'. Matches: ${matches.map(([key]) => key).join(", ")}`);
  }

  throw new Error(`Component property '${requested}' not found. Available: ${Object.keys(definitions).join(", ")}`);
}
```

### 验收标准

- 输入真实 key 可以解析。
- 输入 display name 可以解析。
- 输入去掉 suffix 的名称可以解析。
- 多个候选时返回明确 ambiguous 错误。
- 找不到时返回 available property 列表。

## 7. P0-3：新增 `figma_create_instance_smart`

### 目标

在现有 `figma_create_instance_with_overrides` 基础上新增智能版本，支持人类可读 property names，并在创建后读回验证。

### MCP Tool 名称

```text
figma_create_instance_smart
```

### 输入 schema

建议添加到 `src/schemas.ts`：

```ts
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
```

加入 `PluginCommand`：

```ts
| { type: "createInstanceSmart"; payload: z.infer<typeof createInstanceSmartSchema> }
```

在 `src/mcp/tools/write.ts` 注册同名工具。

### 插件端行为

位置：

```text
plugin/code.ts
```

行为：

1. 支持 `componentId` 是 `COMPONENT` 或 `COMPONENT_SET`。
2. 如果是 component set，使用 `defaultVariant.createInstance()`。
3. 创建 instance 后 append、设置位置、可选 resize。
4. 读取 `instance.componentProperties` 或 source definitions。
5. 用 `resolveComponentPropertyKey()` 把用户传入的 property name 映射为真实 key。
6. 调用 `instance.setProperties(resolvedProperties)`。
7. 如果任一步失败，remove instance，保证不残留。
8. 如果 `verify !== false`，读回 instance 的 property 状态。

返回：

```json
{
  "id": "...",
  "name": "CTA Instance",
  "type": "INSTANCE",
  "resolvedProperties": {
    "State": "Pressed",
    "Label#149:123": "扫码加入"
  },
  "requestedProperties": {
    "State": "Pressed",
    "Label": "扫码加入"
  },
  "componentProperties": {}
}
```

### 验收场景

1. 对 Button component set 创建 instance，传 `{ "State": "Pressed" }`，实例变为 Pressed。
2. 对 Button component 创建 TEXT property `Label` 后，传 `{ "Label": "扫码加入" }`，实例文案变化。
3. 对 BOOLEAN property `Show Icon` 传 `false`，目标 layer 隐藏。
4. 传不存在 property 返回错误，错误中包含 available properties。
5. 传错误 variant 值返回错误，不残留 instance。

## 8. P0-4：新增 `figma_audit_component_properties`

### 目标

提供一个审计工具，让 AI 和审阅者知道组件 properties 是否真的可用，而不是“只创建了 definition”。

### MCP Tool 名称

```text
figma_audit_component_properties
```

### 输入 schema

```ts
export const auditComponentPropertiesSchema = z.object({
  componentId: z.string().min(1),
  createProbeInstance: z.boolean().optional(),
  probeParentId: z.string().min(1).optional(),
  cleanupProbe: z.boolean().optional(),
});
```

### 输出建议

```json
{
  "id": "...",
  "name": "Button",
  "type": "COMPONENT_SET",
  "isComponentSet": true,
  "variants": {
    "State": ["Default", "Pressed", "Disabled"],
    "Type": ["Primary", "Secondary"]
  },
  "properties": [
    {
      "key": "Label#149:123",
      "displayName": "Label",
      "type": "TEXT",
      "defaultValue": "创建 AR 房间",
      "hasReference": true,
      "references": [
        {
          "nodeId": "...",
          "nodeName": "Label",
          "field": "characters"
        }
      ],
      "overrideProbe": "passed"
    }
  ],
  "issues": [],
  "warnings": []
}
```

### 审计内容

必须检查：

- node 是否是 `COMPONENT` 或 `COMPONENT_SET`
- component set 有哪些 variant dimensions 和 options
- component property definitions 列表
- 每个非 VARIANT property 是否至少有一个 layer reference
- TEXT property 是否绑定到 TextNode 的 `characters`
- BOOLEAN property 是否绑定到 layer `visible`
- INSTANCE_SWAP property 是否绑定到 nested instance swap
- 可选：创建 probe instance 后尝试 override，并验证没有报错

### 验收标准

- 对只有 variants 的组件，返回 variants，无错误。
- 对 TEXT property 未绑定 reference 的组件，返回 warning。
- 对 BOOLEAN property 未绑定 visible 的组件，返回 warning。
- 对非法 component id 返回结构化错误。
- `cleanupProbe: true` 时，probe instance 不残留。

## 9. P1-1：支持 layer name 绑定 property reference

### 当前问题

现有 `figma_set_component_property_reference` 要求调用方直接传：

```json
{
  "characters": "Label#149:123"
}
```

但 AI 更自然地知道 layer 名称，例如：

```json
{
  "layerName": "Label",
  "field": "characters",
  "propertyName": "Label"
}
```

### 新工具

```text
figma_bind_component_property
```

### 输入 schema

```ts
export const bindComponentPropertySchema = z.object({
  componentId: z.string().min(1),
  propertyName: z.string().min(1),
  layerName: z.string().min(1),
  field: z.enum(["characters", "visible", "mainComponent"]),
  match: z.enum(["exact", "contains"]).optional(),
});
```

### 行为

1. 找到 component 或 component set。
2. 解析 propertyName 为真实 property key。
3. 在 component 内部递归查找 layerName。
4. 对 component set，应支持：
   - 绑定到所有 variants 中同名 layer。
   - 如果只匹配部分 variants，返回 warning。
5. 根据 field 写入 `componentPropertyReferences`。
6. 读回确认。

### layer 查找规则

默认 exact match：

```ts
node.name === layerName
```

`match: "contains"` 时：

```ts
node.name.includes(layerName)
```

如果匹配多个，必须报错并列出候选；不要随便选第一个。

### 验收标准

- Button 中 `Label` TEXT property 可以绑定到所有 variant 的 `Label` 文本层。
- `Show Icon` BOOLEAN property 可以绑定到所有 variant 的 `Icon` layer visible。
- layer 名称不存在时返回候选层列表或明确错误。
- 多个同名 layer 时返回 ambiguous 错误。

## 10. P1-2：新增 `figma_create_component_with_properties`

### 目标

一站式创建可配置组件，减少 AI 多步调用中断和半成品风险。

### MCP Tool 名称

```text
figma_create_component_with_properties
```

### 输入示例

```json
{
  "name": "Button / Configurable",
  "x": 0,
  "y": 0,
  "width": 240,
  "height": 54,
  "layoutMode": "HORIZONTAL",
  "itemSpacing": 8,
  "paddingLeft": 16,
  "paddingRight": 16,
  "fills": [{ "type": "SOLID", "color": { "r": 0.04, "g": 0.52, "b": 1 } }],
  "layers": [
    {
      "type": "TEXT",
      "name": "Label",
      "text": "创建 AR 房间",
      "fontSize": 17
    }
  ],
  "properties": [
    {
      "name": "Label",
      "type": "TEXT",
      "defaultValue": "创建 AR 房间",
      "bind": {
        "layerName": "Label",
        "field": "characters"
      }
    }
  ],
  "verify": true
}
```

### 最小可接受范围

P1 先支持：

- component 外壳
- child TEXT layer
- child FRAME / RECTANGLE / ELLIPSE layer
- TEXT property -> characters
- BOOLEAN property -> visible
- 创建一个 probe instance 做 override 验证
- 失败事务回滚

INSTANCE_SWAP 可放 P1 后半段或 P2。

### 验收标准

- 一次调用创建 Button component，包含 Label TEXT property。
- 创建后可用 `figma_create_instance_smart` 改 Label。
- BOOLEAN property 可隐藏 Icon。
- 任一 layer 创建失败时，component 不残留。

## 11. P1-3：INSTANCE_SWAP property 增强

### 目标

让 instance swap 可以通过 component name 使用，而不是必须传 component id 或内部 key。

### 建议

为 `figma_create_instance_smart` 增加可选参数：

```ts
componentNameMap?: Record<string, string>
```

或新增 resolver：

```text
figma_resolve_component_by_name
```

更推荐在 smart 工具内部支持：

```json
{
  "properties": {
    "Leading Icon": "Icon / QR"
  }
}
```

内部流程：

1. 判断 property type 是否 `INSTANCE_SWAP`。
2. 如果 value 看起来不是 node id，则在当前文件中查找同名 component。
3. 唯一匹配则使用 component id。
4. 多个匹配则报 ambiguous。
5. 找不到则返回候选列表。

### 验收标准

- Button 的 `Leading Icon` 可以从 `Icon / Plus` 换成 `Icon / QR`。
- 传不存在 icon name 时，返回清晰错误。
- 多个同名 component 时，返回 ambiguous。

## 12. P1-4：BOOLEAN visibility 与 Auto Layout 收缩验证

### 背景

BOOLEAN property 很常用于：

- Button 是否显示 icon
- Tab Item 是否 active badge
- List Row 是否显示 subtitle
- Player Chip 是否显示离线状态
- Sheet 是否显示 grabber

但隐藏 layer 后，如果 Auto Layout 没有正确收缩，实例可能留下空洞。

### 审计规则

`figma_audit_component_properties` 对 BOOLEAN property 做 probe：

1. 记录 instance 初始 width/height。
2. 设置 BOOLEAN 为 false。
3. 读取目标 layer visible 是否为 false。
4. 如果目标 layer 位于 Auto Layout 父级，检查父级布局是否有明显空洞。

注意：Figma 对 hidden layer 在 Auto Layout 中通常不会占位，但不同节点类型/布局设置可能有差异。审计工具可以先给 warning，不必强行 fail。

### 验收标准

- `Show Icon=false` 后 Icon layer invisible。
- 审计结果能报告 visibility passed。
- 若无法确认收缩，返回 warning 而不是抛错。

## 13. Schema 与工具注册要求

需要修改：

```text
src/schemas.ts
src/mcp/tools/write.ts
plugin/code.ts
```

新增 schema：

- `createInstanceSmartSchema`
- `auditComponentPropertiesSchema`
- `bindComponentPropertySchema`
- `createComponentWithPropertiesSchema`，P1

新增 `PluginCommand` union：

- `{ type: "createInstanceSmart"; payload: ... }`
- `{ type: "auditComponentProperties"; payload: ... }`
- `{ type: "bindComponentProperty"; payload: ... }`
- `{ type: "createComponentWithProperties"; payload: ... }`

新增 MCP tools：

- `figma_create_instance_smart`
- `figma_audit_component_properties`
- `figma_bind_component_property`
- `figma_create_component_with_properties`

修复一致性：

- 如果 `VARIANT` 不应该由 `figma_add_component_property` 创建，就从 `componentPropertyTypeSchema` 移除 `VARIANT`，或在 write tool 中一致支持。
- 推荐保留 `VARIANT` 只作为 read/audit 概念，不作为 add property 的输入，因为 variants 应通过 `figma_combine_as_variants` 创建。

## 14. 返回结构要求

所有新增工具必须使用当前项目已有的结构化 wrapper：

成功：

```json
{
  "ok": true,
  "result": {}
}
```

失败：

```json
{
  "ok": false,
  "error": "..."
}
```

且失败时：

- 不残留新创建的 component / instance / probe node
- 错误信息包含当前操作、目标 id、可选候选项
- 不返回无法解析的纯文本

## 15. 测试脚本建议

新增：

```text
scripts/test-component-properties.mjs
```

测试内容：

1. 健康检查 `/health`，确认 plugin connected。
2. 创建 Button component：
   - Auto Layout horizontal
   - Icon layer
   - Label text layer
3. 添加 properties：
   - `Label` TEXT
   - `Show Icon` BOOLEAN
4. 用 `figma_bind_component_property`：
   - `Label` -> Label.characters
   - `Show Icon` -> Icon.visible
5. 用 `figma_create_instance_smart` 创建 instance：
   - `{ "Label": "扫码加入", "Show Icon": false }`
6. 用审计工具确认：
   - property definitions 存在
   - references 存在
   - override probe passed
7. 创建 variants：
   - `Button / Primary, State=Default`
   - `Button / Primary, State=Pressed`
   - combine as variants
8. 用 `figma_create_instance_smart`：
   - `{ "State": "Pressed" }`
9. 测试错误路径：
   - 不存在 property
   - ambiguous layer name
   - 错误 variant value
10. 验证失败不残留。

命令：

```bash
npm run typecheck
npm run build
node scripts/test-component-properties.mjs
```

如果项目已有 `npm run codex:check`，也要通过：

```bash
npm run codex:check
```

## 16. TableDoll AR 场景验收

改完后，用 TableDoll AR 的组件需求做一次真实验收。至少创建以下组件：

### Button

Variants：

- `Type=Primary | Secondary | Destructive`
- `State=Default | Pressed | Disabled`

Properties：

- `Label` TEXT
- `Show Icon` BOOLEAN
- `Leading Icon` INSTANCE_SWAP，P1/P2

验收：

- instance 可以设置 `Label=扫码加入`
- instance 可以设置 `State=Pressed`
- instance 可以设置 `Show Icon=false`

### Tab Item

Variants：

- `Active=true | false` 或 `State=Active | Inactive`

Properties：

- `Label` TEXT
- `Icon` INSTANCE_SWAP，P1/P2

验收：

- 可以创建 `Label=瞬间`
- 可以切换 active 状态

### Player Chip

Variants：

- `Status=Ready | Leading | Offline`

Properties：

- `Name` TEXT
- `Score` TEXT
- `Show Connection Dot` BOOLEAN

验收：

- 可以创建 `Name=小蓝`
- 可以创建 `Score=12`
- 可以切换 `Status=Offline`

### AR Action Button

Variants：

- `Kind=Jump | Push | HighFive | Emote`
- `State=Ready | Cooldown | Disabled`

Properties：

- `Cooldown` TEXT 或 BOOLEAN

验收：

- 可以创建 `Kind=Push`
- 可以设置 `State=Cooldown`

## 17. 审阅时的通过标准

我会按以下标准审阅另一个 AI 的修改结果：

1. `npm run typecheck` 通过。
2. `npm run build` 通过。
3. 如果存在 `npm run codex:check`，必须通过。
4. `scripts/test-component-properties.mjs` 通过。
5. Figma 插件连接下，真实闭环通过：
   - TEXT property override
   - BOOLEAN visible override
   - variant override
   - smart property name resolution
   - audit report
   - 错误路径不残留节点
6. 读取 component set 和 variant component 不再触发 `get_componentPropertyDefinitions` 报错。
7. 新增工具文档已更新到 `docs/expanded-tools.md` 或单独任务文档。

## 18. 非目标

本轮不要求：

- 完整实现 Figma Prototyping 交互连线。
- 支持复杂 rich text mixed styles。
- 支持所有 Figma component property 边界场景。
- 做完整 UI 组件库模板市场。
- 重写 MCP 架构。

请保持改动集中在 component property 生产链路上。

## 19. 推荐实现顺序

1. 修复 component 读取序列化报错。
2. 实现 property key resolver。
3. 实现 `figma_create_instance_smart`。
4. 实现 `figma_audit_component_properties`。
5. 实现 `figma_bind_component_property`。
6. 增加 `scripts/test-component-properties.mjs`。
7. 跑通 Button 的 TEXT / BOOLEAN / variant 三个闭环。
8. 再实现 `figma_create_component_with_properties`。
9. 最后增强 INSTANCE_SWAP。

## 20. 给修改 AI 的提示

不要只做 schema 或 tool 注册。每个新增工具都必须包含：

- `src/schemas.ts` schema
- `src/mcp/tools/write.ts` tool registration
- `plugin/code.ts` command handler
- 成功路径测试
- 失败路径测试
- Figma 真实插件连接下的验证

不要手动修改 `plugin/code.js`。请修改 `plugin/code.ts` 后运行构建生成。

不要使用 `catch {}`，Figma 插件运行环境曾经因为该语法出现 `Unexpected token {}`。请使用：

```ts
catch (_cleanupError) {
  // ignore cleanup errors
}
```

完成后请在回复中列出：

- 修改文件
- 新增工具
- 测试命令和结果
- 未完成或降级处理的能力
- 真实 Figma 闭环验证结果
