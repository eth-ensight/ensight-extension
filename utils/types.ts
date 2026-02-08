/**
 * ENSight shared types — session model and message protocol.
 */

export type FeedItemKind = 'connect' | 'sign' | 'tx' | 'chain';
export type Severity = 'info' | 'warn' | 'danger';
export type RequestPhase = 'before' | 'after' | 'error';

/** Risk enrichment attached by the background after querying the backend. */
export interface RiskInfo {
  flagged: boolean;
  lastUpdated: number | null;
}

/** ENS enrichment attached by the background after querying the backend. */
export interface EnsInfo {
  name: string;
  avatar?: string | null;
}

export interface FeedItem {
  id: string;
  kind: FeedItemKind;
  severity: Severity;
  oneLiner: string;
  method: string;
  phase: RequestPhase;
  /** Timestamp when the request started (before event). */
  startedAt: number;
  /** Set when phase is after or error. */
  resolvedAt?: number;
  /** For tx: to, value, hasData. For chain: chainId. */
  params?: Record<string, unknown>;
  /** Error message when phase is error. */
  error?: string;
  /** Risk info for the "to" address (populated by backend enrichment). */
  risk?: RiskInfo;
  /** ENS identity for the "to" address (populated by backend enrichment). */
  toEns?: EnsInfo;
}

export interface TabSession {
  tabId: number;
  hostname: string;
  /** Whether we've seen ethereum.request on this tab. */
  web3Active: boolean;
  /** Last time we received any event for this tab. */
  lastSeenAt: number;
  feed: FeedItem[];
  counts: Record<FeedItemKind, number>;
}

// ——— Page world → content (postMessage) ———

export const TRACKED_METHODS = [
  'eth_accounts',
  'eth_requestAccounts',
  'eth_sendTransaction',
  'eth_sign',
  'personal_sign',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
] as const;

export type TrackedMethod = (typeof TRACKED_METHODS)[number];

/** Matches eth_signTypedData, eth_signTypedData_v3, eth_signTypedData_v4 */
export const SIGN_TYPED_DATA_PREFIX = 'eth_signTypedData';

export interface PageEventBase {
  ensight: true;
}

export interface EthereumActiveEvent extends PageEventBase {
  type: 'ETHEREUM_ACTIVE';
}

export interface EthereumRequestBefore {
  type: 'ETHEREUM_REQUEST';
  phase: 'before';
  id: string;
  method: string;
  params: unknown[];
}

export interface EthereumRequestAfter {
  type: 'ETHEREUM_REQUEST';
  phase: 'after';
  id: string;
  result?: unknown;
}

export interface EthereumRequestError {
  type: 'ETHEREUM_REQUEST';
  phase: 'error';
  id: string;
  error: string;
}

export type EthereumRequestEvent =
  | EthereumRequestBefore
  | EthereumRequestAfter
  | EthereumRequestError;

export type PageEvent = EthereumActiveEvent | EthereumRequestEvent;

export function isPageEvent(msg: unknown): msg is PageEvent {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as PageEvent).ensight === true &&
    typeof (msg as PageEvent).type === 'string'
  );
}

export function isTrackedMethod(method: string): boolean {
  if (TRACKED_METHODS.includes(method as TrackedMethod)) return true;
  return method.startsWith(SIGN_TYPED_DATA_PREFIX);
}
