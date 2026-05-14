# Figma read/write MCP

## What this does

This project provides:
- MCP read tools backed by the Figma REST API
- write tools backed by a companion Figma plugin bridge

## Setup

1. Install dependencies

```bash
npm install
```

2. Create `.env`

```bash
copy .env.example .env
```

Set:
- `FIGMA_TOKEN`
- optional `MCP_AUTH_TOKEN`

3. Start the MCP server

```bash
npm run dev
```

The server listens on:
- `http://localhost:8787/mcp`
- `ws://localhost:8787/plugin`

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

## Build

```bash
npm run build
```

This builds the server and also generates `plugin/code.js` for Figma.

## Notes

- Read tools use `FIGMA_TOKEN` server-side only.
- Write tools require the Figma plugin to be open and connected.
- The write path is intentionally narrow and only supports basic node operations for now.
