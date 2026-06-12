# Codex Usage Guide

## Start the server

```powershell
cd "D:\code\codex figma mcp"
npm run codex:serve
```

The MCP server should be reachable at:

```text
http://127.0.0.1:8787/mcp
```

The Figma plugin connects to:

```text
ws://localhost:8787/plugin
```

Keep `plugin/manifest.json` on `localhost`. Figma currently rejects `127.0.0.1` entries in `devAllowedDomains`.

## Register with Codex

```powershell
codex mcp add figma-custom --url http://127.0.0.1:8787/mcp
codex mcp list
```

If `MCP_AUTH_TOKEN` is configured:

```powershell
$env:FIGMA_MCP_AUTH_TOKEN="YOUR_MCP_AUTH_TOKEN"
codex mcp add figma-custom --url http://127.0.0.1:8787/mcp --bearer-token-env-var FIGMA_MCP_AUTH_TOKEN
```

## Check readiness

```powershell
npm run codex:check
```

The readiness check verifies:

- `/health` is reachable.
- Required MCP tools are listed.
- `FIGMA_TOKEN` is configured for REST reads.
- The Figma plugin is connected when plugin reads or writes are needed.
- `figma_read_context` can read from the plugin when connected.

## Figma plugin flow

1. Start the MCP server.
2. Open the target Figma file.
3. Open `Plugins -> Development -> Figma Read/Write MCP Bridge`.
4. Confirm the plugin UI says `Connected`.
5. Run `npm run codex:check`.
6. Start a new Codex session or ask Codex to use the `figma-custom` MCP.

After rebuilding plugin code, close and reopen the Figma plugin. Reconnecting inside the plugin UI is not enough to reload `plugin/code.js`.

## Recommended Codex prompts

```text
Use the figma-custom MCP to read the current Figma file summary.
```

```text
Use the figma-custom MCP to read the current selection and describe its hierarchy.
```

```text
Use the figma-custom MCP to read the current page with depth 1, maxChildren 30, and compact output.
```

```text
Use the figma-custom MCP to create a 1440x900 dashboard frame on the current Figma page.
```

## Tool selection

Use REST tools when the prompt includes a Figma URL or `fileKey`:

- `figma_rest_get_file`
- `figma_rest_get_node`
- `figma_rest_get_images`
- `figma_rest_get_comments`
- `figma_rest_get_versions`

Use plugin tools when the prompt refers to the current open Figma file, current page, or current selection:

- `figma_plugin_get_current_file_summary`
- `figma_plugin_get_current_page`
- `figma_plugin_get_page_tree`
- `figma_plugin_get_node`
- `figma_plugin_get_node_tree`
- `figma_plugin_get_selection`

Use automatic tools for most Codex workflows:

- `figma_read_context`
- `figma_read_node`

Start with compact, depth-limited reads:

```json
{
  "depth": 1,
  "maxChildren": 30,
  "maxTextLength": 500,
  "compact": true
}
```

Only increase `depth` or `maxChildren` after identifying the relevant frame or node.
