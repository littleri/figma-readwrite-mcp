import { URLSearchParams } from "node:url";

const FIGMA_API_BASE = "https://api.figma.com/v1";

type Query = Record<string, string | number | boolean | string[] | undefined>;

export class FigmaRestClient {
  constructor(private readonly token: string) {}

  async getFile(fileKey: string, query: Query = {}) {
    return this.request(`/files/${encodeURIComponent(fileKey)}`, query);
  }

  async getNode(fileKey: string, nodeId: string, query: Query = {}) {
    return this.request(`/files/${encodeURIComponent(fileKey)}/nodes`, {
      ...query,
      ids: nodeId,
    });
  }

  async getImages(fileKey: string, nodeIds: string[], query: Query = {}) {
    return this.request(`/images/${encodeURIComponent(fileKey)}`, {
      ...query,
      ids: nodeIds.join(","),
    });
  }

  async getComments(fileKey: string) {
    return this.request(`/files/${encodeURIComponent(fileKey)}/comments`);
  }

  async getVersions(fileKey: string) {
    return this.request(`/files/${encodeURIComponent(fileKey)}/versions`);
  }

  private async request(path: string, query: Query = {}) {
    if (!this.token) {
      throw new Error("FIGMA_TOKEN is required for Figma REST API calls");
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      params.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }

    const url = `${FIGMA_API_BASE}${path}${params.size ? `?${params}` : ""}`;
    const response = await fetch(url, {
      headers: {
        "X-Figma-Token": this.token,
      },
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message = body?.err || body?.message || response.statusText;
      throw new Error(`Figma API ${response.status}: ${message}`);
    }

    return body;
  }
}
