/**
 * API Client
 * ----------
 * All communication between the frontend and backend goes through this file.
 * Keeping API calls in one place means:
 *   - If the base URL changes, we change it here only
 *   - Error handling is consistent everywhere
 *   - TypeScript types are defined once and shared across the app
 *
 * We use the native browser `fetch` API — no third-party HTTP library needed.
 */

// ---------------------------------------------------------------------------
// TypeScript types (mirror the Pydantic models in backend/app/models/)
// ---------------------------------------------------------------------------
// TypeScript interfaces describe the *shape* of data. If the backend returns
// something that doesn't match these, TypeScript will warn us at compile time.

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeData {
  label: string;
  resourceType: string;
  service: string;
  properties: Record<string, unknown>;
}

export interface DiagramNode {
  id: string;
  type: string;
  position: NodePosition;
  data: NodeData;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface ParseResponse {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface DiagramSummary {
  id: string;
  name: string;
  createdAt: string;
}

export interface DiagramDetail extends DiagramSummary {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------
// In development: Vite proxies /api/* to localhost:8000 (see vite.config.ts)
// In production:  VITE_API_URL is set to the API Gateway URL at build time
//                 (the CDK stack outputs this URL, and we set it in the build)
const BASE_URL = import.meta.env.VITE_API_URL ?? "";

/**
 * Thin wrapper around fetch that:
 *   - Sets Content-Type: application/json on POST requests
 *   - Throws an Error with the server's error message on non-2xx responses
 *   - Returns parsed JSON
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    // FastAPI returns error details in { "detail": "..." }
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "An unexpected error occurred");
  }

  // 204 No Content (DELETE) has no body
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** Send a raw CloudFormation template string, get back nodes + edges */
export function parseTemplate(template: string): Promise<ParseResponse> {
  return request<ParseResponse>("/api/v1/parse", {
    method: "POST",
    body: JSON.stringify({ template }),
  });
}

/** Save a parsed diagram with a user-given name */
export function saveDiagram(
  name: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): Promise<DiagramSummary> {
  return request<DiagramSummary>("/api/v1/diagrams", {
    method: "POST",
    body: JSON.stringify({ name, nodes, edges }),
  });
}

/** List all saved diagrams (summaries only) */
export function listDiagrams(): Promise<DiagramSummary[]> {
  return request<DiagramSummary[]>("/api/v1/diagrams");
}

/** Load a specific saved diagram with full node/edge data */
export function getDiagram(id: string): Promise<DiagramDetail> {
  return request<DiagramDetail>(`/api/v1/diagrams/${id}`);
}

/** Delete a saved diagram */
export function deleteDiagram(id: string): Promise<void> {
  return request<void>(`/api/v1/diagrams/${id}`, { method: "DELETE" });
}
