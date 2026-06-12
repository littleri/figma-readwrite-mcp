/**
 * Parse a Figma URL or partial input to extract fileKey and nodeId.
 *
 * Handles:
 * - /file/{fileKey}/...
 * - /design/{fileKey}/...
 * - node-id=0-1 -> 0:1
 */
export function parseFigmaUrl(input: string): {
  fileKey?: string;
  nodeId?: string;
} {
  const result: { fileKey?: string; nodeId?: string } = {};

  // Extract fileKey from /file/ or /design/ paths
  const fileMatch = input.match(/\/(?:file|design)\/([a-zA-Z0-9]+)/);
  if (fileMatch) {
    result.fileKey = fileMatch[1];
  }

  // Extract nodeId from node-id= query parameter
  const nodeMatch = input.match(/node-id=([^&\s]+)/);
  if (nodeMatch) {
    // Convert 0-1 to 0:1, also handle URL-encoded variants
    result.nodeId = decodeURIComponent(nodeMatch[1]).replace(/-/g, ":");
  }

  return result;
}
