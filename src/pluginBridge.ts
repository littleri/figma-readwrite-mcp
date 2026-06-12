import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

import type { PluginCommand } from "./schemas.js";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

type PluginHello = {
  type: "hello";
  payload?: Record<string, unknown>;
};

type PluginResponse = {
  type: "response";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

type PluginMessage = PluginHello | PluginResponse;

export class PluginBridge {
  private socket: WebSocket | null = null;
  private metadata: Record<string, unknown> = {};
  private pending = new Map<string, PendingRequest>();

  // Observability fields
  private connectedSince: number | null = null;
  private lastCommandId: string | null = null;
  private lastCommandType: string | null = null;
  private lastCommandAt: number | null = null;
  private lastResultAt: number | null = null;
  private lastError: string | null = null;

  attach(server: HttpServer, path: string) {
    const wss = new WebSocketServer({ server, path });

    wss.on("connection", (socket) => {
      this.replaceSocket(socket);

      socket.on("message", (data) => this.handleMessage(data.toString()));
      socket.on("close", () => this.handleClose(socket));
      socket.on("error", () => this.handleClose(socket));
    });

    return wss;
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  getStatus() {
    return {
      connected: this.isConnected(),
      metadata: this.metadata,
      pendingRequests: this.pending.size,
      connectedSince: this.connectedSince,
      lastCommand: this.lastCommandType,
      lastCommandAt: this.lastCommandAt,
      lastResultAt: this.lastResultAt,
      lastError: this.lastError,
    };
  }

  async send(command: PluginCommand, timeoutMs = 10_000) {
    if (!this.isConnected() || !this.socket) {
      throw new Error("No Figma plugin is connected. Open the companion plugin in Figma first.");
    }

    const id = randomUUID();

    // Track command for observability
    this.lastCommandId = id;
    this.lastCommandType = command.type;
    this.lastCommandAt = Date.now();
    this.lastError = null;

    const response = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        const errorMsg = `Figma plugin command timed out: ${command.type}`;
        this.lastError = errorMsg;
        reject(new Error(errorMsg));
      }, timeoutMs) as unknown as NodeJS.Timeout;

      this.pending.set(id, { resolve, reject, timeout });
    });

    this.socket.send(JSON.stringify({ type: "command", id, command }));

    try {
      const result = await response;
      this.lastResultAt = Date.now();
      return result;
    } catch (error) {
      this.lastResultAt = Date.now();
      if (!this.lastError) {
        this.lastError = error instanceof Error ? error.message : String(error);
      }
      throw error;
    }
  }

  /**
   * Cancel all pending requests. Useful before a reset or when the caller
   * wants to abort in-flight work.
   */
  cancelAll(reason = "Canceled by MCP client") {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
      this.pending.delete(id);
    }
  }

  /**
   * Reset the bridge: cancel all pending, close socket, clear state.
   * User must reopen the Figma plugin to reconnect.
   */
  resetBridge() {
    this.cancelAll("Bridge reset by MCP client");
    if (this.socket) {
      try {
        this.socket.close(1000, "Bridge reset");
      } catch (_closeError) {
        // Ignore close errors
      }
    }
    this.socket = null;
    this.metadata = {};
    this.connectedSince = null;
    this.lastCommandId = null;
    this.lastCommandType = null;
    this.lastCommandAt = null;
    this.lastResultAt = null;
    this.lastError = null;
  }

  private replaceSocket(socket: WebSocket) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close(1000, "Replaced by a new Figma plugin connection");
    }

    this.socket = socket;
    this.metadata = {};
    this.connectedSince = Date.now();
    this.lastError = null;
  }

  private handleMessage(raw: string) {
    let message: PluginMessage;
    try {
      message = JSON.parse(raw) as PluginMessage;
    } catch (_parseError) {
      return;
    }

    if (message.type === "hello") {
      this.metadata = message.payload ?? {};
      return;
    }

    if (message.type === "response") {
      const pending = this.pending.get(message.id);
      if (!pending) return;

      clearTimeout(pending.timeout);
      this.pending.delete(message.id);

      if (message.ok) {
        pending.resolve(message.result ?? null);
      } else {
        const errorMsg = message.error || "Figma plugin command failed";
        this.lastError = errorMsg;
        pending.reject(new Error(errorMsg));
      }
    }
  }

  private handleClose(socket: WebSocket) {
    if (this.socket !== socket) return;

    this.socket = null;
    this.metadata = {};
    this.connectedSince = null;

    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Figma plugin disconnected"));
      this.pending.delete(id);
    }
  }
}
