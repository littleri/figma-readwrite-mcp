# Figma read/write MCP

## What this does

This project provides:

- MCP read tools backed by the Figma REST API.
- MCP read tools backed by the companion Figma plugin.
- Automatic read tools that choose REST or plugin based on context.
- Write tools backed by a companion Figma plugin bridge.

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create `.env`.

```bash
copy .env.example .env
```

Set:

- `FIGMA_TOKEN`
- optional `MCP_AUTH_TOKEN`

You may copy the existing `FIGMA_TOKEN` from your current `.env` when moving this project to another machine. Do not paste the token into README, prompts, or committed files.

3. Start the MCP server.

```bash
npm run dev
```

The server listens on:

- `http://localhost:8787/mcp`
- `ws://localhost:8787/plugin`

Figma plugin `devAllowedDomains` should stay on `localhost`. Figma rejects `127.0.0.1` entries in the plugin manifest even though Codex can connect to the MCP endpoint through `127.0.0.1`.

## Connect Codex

Start the MCP server first:

```bash
npm run codex:serve
```

Then register it with Codex:

```bash
codex mcp add figma-custom --url http://127.0.0.1:8787/mcp
codex mcp list
```

If `MCP_AUTH_TOKEN` is set, expose the same value through an environment variable and register the bearer-token env var.

Command Prompt:

```bat
set FIGMA_MCP_AUTH_TOKEN=YOUR_MCP_AUTH_TOKEN
codex mcp add figma-custom --url http://127.0.0.1:8787/mcp --bearer-token-env-var FIGMA_MCP_AUTH_TOKEN
```

PowerShell:

```powershell
$env:FIGMA_MCP_AUTH_TOKEN="YOUR_MCP_AUTH_TOKEN"
codex mcp add figma-custom --url http://127.0.0.1:8787/mcp --bearer-token-env-var FIGMA_MCP_AUTH_TOKEN
```

Check readiness:

```bash
npm run codex:check
```

## Connect Claude Code

Add the MCP server:

```bash
claude mcp add --scope user --transport http figma-custom http://localhost:8787/mcp --header "Authorization: Bearer YOUR_MCP_AUTH_TOKEN"
```

If `MCP_AUTH_TOKEN` is empty, omit the header.

## Figma plugin bridge

1. In Figma, load the plugin from the `plugin/` folder.
2. Open the plugin.
3. It connects to `ws://localhost:8787/plugin`.
4. Once connected, write tools can create, update, select, and delete nodes.
5. Plugin read tools can read from the currently open file.

After changing `plugin/code.ts` or rebuilding, close and reopen the Figma plugin so Figma loads the regenerated `plugin/code.js`.

## Hybrid read mode

The MCP supports three categories of read tools.

### REST-backed reads

These require `FIGMA_TOKEN`.

- `figma_rest_get_file` / `figma_get_file`
- `figma_rest_get_node` / `figma_get_node`
- `figma_rest_get_images` / `figma_get_images`
- `figma_rest_get_comments` / `figma_get_comments`
- `figma_rest_get_versions` / `figma_get_versions`

### Plugin-backed reads

These require the companion plugin to be connected.

- `figma_plugin_get_current_file_summary`
- `figma_plugin_get_current_page`
- `figma_plugin_get_page_tree`
- `figma_plugin_get_node`
- `figma_plugin_get_node_tree`
- `figma_plugin_get_selection` / `figma_get_selection`

Plugin read tools support output controls:

- `depth`
- `maxChildren`
- `maxTextLength`
- `compact`
- `includeInvisible`

### Automatic reads

These choose REST or plugin based on context:

- `figma_read_context` - reads file, current page, or selection.
- `figma_read_node` - reads a specific node.

Default source selection strategy:

| Request shape | Read source |
|---|---|
| Includes `fileKey` or Figma file URL | REST API |
| Comments, versions, or image exports | REST API |
| Current selection, page, or open file | Plugin |
| `nodeId` without `fileKey`, plugin connected | Plugin |
| State immediately after a write | Plugin |
| Plugin not connected, `fileKey` available | REST API |
| `FIGMA_TOKEN` missing, plugin connected | Plugin |
| Neither source available | Clear error message |

## Codex usage examples

Use these prompts in Codex after the MCP is registered and the server is running:

```text
Use the figma-custom MCP to read the current Figma file summary.
```

```text
Use the figma-custom MCP to read the current selection and explain its hierarchy.
```

```text
Use the figma-custom MCP to create a 1440x900 dashboard frame on the current Figma page.
```

Prefer depth-limited reads first:

```json
{
  "depth": 1,
  "maxChildren": 30,
  "compact": true
}
```

## Build

```bash
npm run build
```

This builds the server and also generates `plugin/code.js` for Figma.

## Notes

- REST read tools use `FIGMA_TOKEN` server-side only.
- Plugin read tools require the Figma plugin to be open and connected.
- Write tools require the Figma plugin to be open and connected.
- After building, restart the MCP server and reload the Figma plugin.
