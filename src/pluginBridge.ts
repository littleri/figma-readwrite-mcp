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
    };
  }

  async send(command: PluginCommand, timeoutMs = 10_000) {
    if (!this.isConnected() || !this.socket) {
      throw new Error("No Figma plugin is connected. Open the companion plugin in Figma first.");
    }

    const id = randomUUID();
    const response = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Figma plugin command timed out: ${command.type}`));
      }, timeoutMs) as unknown as NodeJS.Timeout;

      this.pending.set(id, { resolve, reject, timeout });
    });

    this.socket.send(JSON.stringify({ type: "command", id, command }));
    return response;
  }

  private replaceSocket(socket: WebSocket) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close(1000, "Replaced by a new Figma plugin connection");
    }

    this.socket = socket;
    this.metadata = {};
  }

  private handleMessage(raw: string) {
    let message: PluginMessage;
    try {
      message = JSON.parse(raw) as PluginMessage;
    } catch {
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
        pending.reject(new Error(message.error || "Figma plugin command failed"));
      }
    }
  }

  private handleClose(socket: WebSocket) {
    if (this.socket !== socket) return;

    this.socket = null;
    this.metadata = {};

    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Figma plugin disconnected"));
      this.pending.delete(id);
    }
  }
}
