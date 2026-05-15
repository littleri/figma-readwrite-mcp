# Figma Read/Write MCP 产品使用文档

## 1. 产品定位

Figma Read/Write MCP 是一个面向 Claude Code 的本地 Figma 自动化桥接工具。它让 Claude Code 不仅能读取 Figma 文件，还能通过 companion Figma 插件在 Design 模式中批量创建和修改画布内容。

适合场景：

- 个人作品集网站设计
- 简历网站设计
- 产品设计 case study 页面
- 多页面网站原型搭建
- 批量创建 Figma 页面 frame
- 自动生成卡片、导航、文本、图形、组件和图片占位

## 2. 架构说明

```text
Claude Code
  │
  │ HTTP MCP
  ▼
本地 MCP Server
  │
  ├── Figma REST API：读取文件、节点、图片、评论、版本
  │
  └── WebSocket Bridge
        │
        ▼
      Figma 插件
        │
        ▼
      Figma Design 画布写入
```

核心组件：

| 组件 | 位置 | 作用 |
|---|---|---|
| MCP Server | `src/` | 提供 Claude Code 可调用的 MCP 工具 |
| Figma Plugin | `plugin/` | 在 Figma 内执行画布写入 |
| WebSocket Bridge | `src/pluginBridge.ts` | 连接 MCP Server 与 Figma 插件 |
| Scripts | `scripts/` | 批量测试或批量生成页面的脚本 |
| Docs | `docs/` | 功能说明、任务文档、使用文档 |

## 3. 与 Figma 官方 MCP 的区别

| 能力 | Figma 官方 MCP | 自建 Figma Read/Write MCP |
|---|---|---|
| 读取设计上下文 | 强 | 可通过 REST 读取基础数据 |
| 截图/视觉理解 | 强 | 不是主要能力 |
| 创建 Figma 节点 | 不适合/不支持 | 支持 |
| 修改 Figma 画布 | 不支持或非常有限 | 支持 |
| 批量生成页面 | 不适合 | 支持 |
| 原型交互连线 | 不支持 | 不支持，Figma Plugin API 限制 |
| Dev Mode 写入 | 不支持 | 不支持 |
| Design 模式写入 | 不支持 | 支持，需要插件连接 |
| 可扩展性 | 官方控制 | 可自行扩展代码 |

推荐组合：

- 官方 MCP：用于读取、截图、理解现有设计。
- 自建 MCP：用于创建、修改、批量生成 Figma 内容。

## 4. 安装部署

### 4.1 克隆仓库

```bash
git clone https://github.com/littleri/figma-readwrite-mcp.git
cd figma-readwrite-mcp
```

### 4.2 安装依赖

```bash
npm install
```

### 4.3 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
FIGMA_TOKEN=你的_Figma_Personal_Access_Token
MCP_AUTH_TOKEN=
HOST=localhost
PORT=8787
PLUGIN_WS_PATH=/plugin
```

说明：

- `FIGMA_TOKEN`：Figma Personal Access Token，用于 REST 读取。
- `MCP_AUTH_TOKEN`：可选。留空时 Claude Code 连接 MCP 不需要 header。
- `HOST=localhost`：本机使用推荐值。
- `PORT=8787`：MCP server 端口。
- `PLUGIN_WS_PATH=/plugin`：Figma 插件 WebSocket 路径。

### 4.4 构建项目

```bash
npm run build
```

## 5. Claude Code 添加 MCP

如果没有设置 `MCP_AUTH_TOKEN`：

```bash
claude mcp add --scope user --transport http figma-custom http://localhost:8787/mcp
```

如果设置了 `MCP_AUTH_TOKEN`：

```bash
claude mcp add --scope user --transport http figma-custom http://localhost:8787/mcp --header "Authorization: Bearer 你的token"
```

检查 MCP：

```bash
claude mcp list
```

## 6. Figma 插件加载

首次使用：

1. 打开 Figma。
2. 进入任意 Figma 设计文件。
3. 选择：
   ```text
   Plugins -> Development -> Import plugin from manifest...
   ```
4. 选择：
   ```text
   plugin/manifest.json
   ```
5. 之后插件会出现在：
   ```text
   Plugins -> Development -> Figma Read/Write MCP Bridge
   ```

## 7. 每次使用流程

### 7.1 启动 MCP Server

在项目目录运行：

```bash
npm run dev
```

保持终端运行，不要关闭。

### 7.2 打开 Figma 插件

在 Figma **Design 模式**中打开：

```text
Plugins -> Development -> Figma Read/Write MCP Bridge
```

插件窗口应显示：

```text
Connected
```

### 7.3 检查连接

```bash
curl http://localhost:8787/health
```

正确结果：

```json
{
  "ok": true,
  "plugin": {
    "connected": true
  }
}
```

如果 `connected: false`：

- 检查 `npm run dev` 是否仍在运行。
- 关闭并重新打开 Figma 插件。
- 确认插件 URL 是 `ws://localhost:8787/plugin`。

## 8. 当前支持的 MCP 工具

### 8.1 读取工具

| 工具 | 用途 |
|---|---|
| `figma_get_file` | 读取整个 Figma 文件 |
| `figma_get_node` | 读取指定节点 |
| `figma_get_images` | 导出节点图片 |
| `figma_get_comments` | 读取评论 |
| `figma_get_versions` | 读取版本历史 |

### 8.2 基础写入工具

| 工具 | 用途 |
|---|---|
| `figma_plugin_status` | 查看插件连接状态 |
| `figma_get_selection` | 获取当前选中节点 |
| `figma_create_frame` | 创建 frame |
| `figma_create_rectangle` | 创建矩形 |
| `figma_create_text` | 创建文本 |
| `figma_update_node` | 更新节点属性 |
| `figma_delete_node` | 删除节点 |
| `figma_select_node` | 选中节点 |

### 8.3 扩展写入工具

| 工具 | 用途 |
|---|---|
| `figma_create_auto_layout_frame` | 创建自动布局 frame |
| `figma_update_auto_layout` | 更新自动布局属性 |
| `figma_create_ellipse` | 创建椭圆 |
| `figma_create_line` | 创建线条 |
| `figma_create_polygon` | 创建多边形 |
| `figma_create_star` | 创建星形 |
| `figma_create_vector` | 创建矢量路径 |
| `figma_create_component` | 创建组件 |
| `figma_create_component_from_node` | 从节点创建组件 |
| `figma_create_instance` | 创建组件实例 |
| `figma_detach_instance` | 拆分组件实例 |
| `figma_create_image_rectangle` | 创建图片填充矩形 |
| `figma_update_image_fill` | 更新图片填充 |
| `figma_create_page_frames` | 批量创建页面 frame |
| `figma_create_page_from_template` | 根据模板批量创建页面 frame |

## 9. 批量创建页面

### 9.1 根据模板创建作品集网站页面

适合一次性生成多个网站页面 frame。

示例：

```json
{
  "parentId": "0:1",
  "template": "portfolio-site",
  "pages": ["Home", "Work", "Project Detail", "Internship", "Hobbies"],
  "startX": 0,
  "startY": 0,
  "gap": 160,
  "width": 1440,
  "height": 1024
}
```

说明：

- `parentId` 可以是 Figma Page ID，例如 `0:1`。
- 每个页面会横向排列。
- `gap` 控制页面 frame 间距。

### 9.2 精确批量创建 frame

```json
{
  "parentId": "0:1",
  "frames": [
    { "name": "Home", "x": 0, "y": 0, "width": 1440, "height": 1024 },
    { "name": "Work", "x": 1600, "y": 0, "width": 1440, "height": 1024 },
    { "name": "About", "x": 3200, "y": 0, "width": 1440, "height": 1024 }
  ]
}
```

## 10. Page 与 Frame 的区别

Figma Page 可以作为创建 frame 的父容器，但不能被选中。

原因：

```text
figma.currentPage.selection 只接受 SceneNode[]
```

可以选中：

- Frame
- Rectangle
- Text
- Component
- Instance
- Ellipse
- Line
- Polygon
- Star
- Vector

不能选中：

- Document
- Page

因此：

- `figma_create_page_frames` 可以在 Page 下创建 frame。
- `figma_select_node` 不能选中 Page。
- 如果需要聚焦结果，应选中创建出来的 frame，而不是选中 Page。

## 11. 支持的设计能力

### 11.1 样式

支持：

- solid fill
- gradient fill
- image fill
- stroke
- stroke weight
- stroke align
- drop shadow
- inner shadow
- blur
- opacity
- corner radius
- corner smoothing
- rotation

### 11.2 自动布局

支持：

- horizontal / vertical layout
- item spacing
- padding
- primary axis alignment
- counter axis alignment
- wrap
- sizing mode

### 11.3 高级文本

支持：

- font family
- font style
- font size
- line height
- letter spacing
- horizontal alignment
- vertical alignment
- auto resize
- paragraph spacing
- paragraph indent

### 11.4 图形

支持：

- rectangle
- ellipse
- line
- polygon
- star
- vector path

### 11.5 组件

支持：

- create component
- create component from node
- create instance
- detach instance

## 12. 不支持的功能

由于 Figma Plugin API 限制，目前不能自动创建或修改：

- Prototype 点击跳转
- Hover 交互
- Smart Animate
- 原型 flow 起点
- 原型连线
- Dev Mode 写入

这些仍需要在 Figma Prototype 模式中手动设置。

## 13. Dev Mode 支持情况

读取：可以。

写入：不可以。

写入必须满足：

1. Figma 处于 Design 模式。
2. 插件窗口打开。
3. 插件显示 Connected。
4. MCP Server 正在运行。

## 14. 常见问题

### 14.1 插件显示 Disconnected

解决：

- 确认 `npm run dev` 正在运行。
- 点击插件里的 Connect。
- 如果刚重启 MCP Server，需要关闭并重新打开插件。

### 14.2 插件报 Unexpected token

原因：Figma 插件运行环境不支持某些新 JS 语法。

解决：

```bash
npm run build:plugin
```

当前项目已处理过：

- `??`
- `...object`

### 14.3 写入工具报 No Figma plugin is connected

原因：MCP Server 在线，但 Figma 插件没连上。

解决：重新打开 Figma 插件。

### 14.4 图片 URL 失败

可能原因：

- CORS
- Figma 插件网络限制
- manifest 域名限制

推荐：

- 使用明确授权的 HTTPS 图片 URL。
- 或使用 `data:image/png;base64,...`。

### 14.5 为什么不能选中 Page

Page 不是 SceneNode，Figma selection 不能包含 Page。应选中 Page 下创建出的 Frame。

## 15. 维护和更新

修改插件代码后：

```bash
npm run build:plugin
```

修改 MCP Server 代码后：

```bash
npm run build
npm run dev
```

每次构建后，Figma 插件需要关闭并重新打开。

提交到 GitHub：

```bash
git status
git add <files>
git commit -m "your message"
git push origin master
```

## 16. 推荐使用方式

在新项目中可以直接这样告诉 Claude Code：

```text
请使用 figma-custom MCP，在 Page 0:1 中创建 5 个作品集网站页面：Home、Work、Project Detail、Internship、Hobbies。每个页面 1440x1024，横向排列，间距 160。
```

如果已有目标链接：

```text
请在这个 Figma Page 中批量生成作品集网站页面：https://www.figma.com/design/...?...node-id=0-1
```

Claude Code 会将链接中的：

```text
node-id=0-1
```

转换为：

```text
0:1
```

然后通过 `figma_create_page_from_template` 或 `figma_create_page_frames` 创建页面。
