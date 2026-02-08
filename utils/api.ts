/**
 * ENSight API client — calls the backend for ENS enrichment, risk lookups,
 * and knowledge-graph interactions.
 *
 * ENSIGHT_API_URL defaults to local dev; override in .env or at build time.
 */

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ENSIGHT_API_URL)
  || 'http://localhost:3002';

/* ---------- helpers ---------- */

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ---------- ENS ---------- */

export interface EnsReverseResult {
  address: string;
  name: string;
  verified: boolean;
  success: boolean;
}

export interface EnsInfoResult {
  name: string;
  address: string;
  resolver: string | null;
  avatar: string | null;
  textRecords: Record<string, string>;
  success: boolean;
}

/** Reverse-lookup: address -> ENS name */
export function fetchEnsReverse(address: string) {
  return get<EnsReverseResult>(`/api/ens/reverse/${address}`);
}

/** Full ENS info for a name */
export function fetchEnsInfo(name: string) {
  return get<EnsInfoResult>(`/api/ens/info/${name}`);
}

/* ---------- Risk ---------- */

export interface RiskResult {
  flagged: boolean;
  lastUpdated: number | null;
}

/** Check if an address is flagged in the ScamSniffer blacklist */
export function fetchRisk(address: string) {
  return get<RiskResult>(`/api/risk/address/${address}`);
}

/* ---------- Knowledge graph ---------- */

export interface GraphInteractionPayload {
  from: string;
  to: string;
  method: string;
  kind: string;
  hostname: string;
  chainId?: string;
  value?: string;
  hasData?: boolean;
}

export interface GraphNode {
  address: string;
  ensName: string | null;
  label: string | null;
  firstSeen: number;
  lastSeen: number;
  interactionCount: number;
  flagged: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: string;
  method: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

export interface GraphAddressResult {
  node: GraphNode;
  edges: GraphEdge[];
  riskSummary: {
    flagged: boolean;
    flaggedNeighborCount: number;
    totalNeighborCount: number;
  };
}

export interface GraphNeighborsResult {
  address: string;
  neighbors: GraphNode[];
  edges: GraphEdge[];
}

/** Record a wallet interaction in the knowledge graph */
export function postGraphInteraction(payload: GraphInteractionPayload) {
  return post<{ ok: boolean }>('/api/graph/interaction', payload);
}

/** Get graph node + edges for an address */
export function fetchGraphAddress(address: string) {
  return get<GraphAddressResult>(`/api/graph/address/${address}`);
}

/** Get neighbors of an address */
export function fetchGraphNeighbors(address: string) {
  return get<GraphNeighborsResult>(`/api/graph/address/${address}/neighbors`);
}
