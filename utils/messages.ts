/**
 * Extension message protocol: content script ↔ background, popup ↔ background.
 * Single source of truth for message type strings and payload shapes.
 */

// ---------------------------------------------------------------------------
// Message type constants (use these instead of string literals)
// ---------------------------------------------------------------------------

/** Content script → Background */
export const MSG_CONTENT_LOADED = "ENSIGHT/CONTENT_LOADED";
export const MSG_ETH_ACTIVE = "ENSIGHT/ETH_ACTIVE";
export const MSG_ETH_REQUEST = "ENSIGHT/ETH_REQUEST";

/** Popup / any → Background (requests) */
export const MSG_GET_SESSION = "ENSIGHT/GET_SESSION";
export const MSG_GET_ACTIVE_SESSION = "ENSIGHT/GET_ACTIVE_SESSION";
export const MSG_GET_LAST_SESSION = "ENSIGHT/GET_LAST_SESSION";
export const MSG_GET_EVENTS = "ENSIGHT/GET_EVENTS";
export const MSG_DEBUG_ALL_SESSIONS = "ENSIGHT/DEBUG_ALL_SESSIONS";

// ---------------------------------------------------------------------------
// Page → Content (window.postMessage) event types
// ---------------------------------------------------------------------------

export const PAGE_ETHEREUM_ACTIVE = "ETHEREUM_ACTIVE";
export const PAGE_ETHEREUM_REQUEST = "ETHEREUM_REQUEST";

// ---------------------------------------------------------------------------
// Payload types (for type-safe sendMessage / onMessage)
// ---------------------------------------------------------------------------

export type ContentLoadedPayload = { type: typeof MSG_CONTENT_LOADED; url: string };
export type EthActivePayload = { type: typeof MSG_ETH_ACTIVE; url: string };
export type EthRequestPayload = { type: typeof MSG_ETH_REQUEST; event: EthereumRequestEvent };

export type GetSessionPayload = { type: typeof MSG_GET_SESSION; tabId: number };
export type GetActiveSessionPayload = { type: typeof MSG_GET_ACTIVE_SESSION };
export type GetLastSessionPayload = { type: typeof MSG_GET_LAST_SESSION };
export type GetEventsPayload = { type: typeof MSG_GET_EVENTS };
export type DebugAllSessionsPayload = { type: typeof MSG_DEBUG_ALL_SESSIONS };

/** Raw event from page (ethereum-main-world) for ETHEREUM_REQUEST */
export type EthereumRequestEvent = {
  type: typeof PAGE_ETHEREUM_REQUEST;
  id: string;
  phase: "before" | "after" | "error";
  ts?: number;
  method: string;
  params?: unknown;
  page?: { url?: string; hostname?: string; title?: string };
  durationMs?: number;
  ok?: boolean;
  error?: { name?: string; message?: string };
  resultSummary?: unknown;
  summary?: { kind: string; to?: string; value?: string; hasData?: boolean; chainId?: string };
};

/** Response from GET_SESSION / GET_ACTIVE_SESSION / GET_LAST_SESSION */
export type SessionResponse = {
  ok: true;
  session: SerializedSession | null;
};

export type SerializedSession = {
  tabId: number;
  isActive: boolean;
  lastSeenAt: number;
  hostname?: string;
  title?: string;
  counts: Record<string, number>;
  feed: SerializedFeedItem[];
};

export type SerializedFeedItem = {
  id: string;
  method: string;
  kind: string;
  severity: string;
  phase: string;
  ok?: boolean;
  error?: { name?: string; message?: string };
  durationMs?: number;
  page?: { url?: string; hostname?: string; title?: string };
  to?: string;
  value?: string;
  hasData?: boolean;
  chainId?: string;
  paramsPreview?: unknown;
  oneLiner?: string;
};

export type InboundMessage =
  | ContentLoadedPayload
  | EthActivePayload
  | EthRequestPayload
  | GetSessionPayload
  | GetActiveSessionPayload
  | GetLastSessionPayload
  | GetEventsPayload
  | DebugAllSessionsPayload;
