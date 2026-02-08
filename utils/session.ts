/**
 * Session logic: kind/severity/oneLiner, merge before/after/error, cap feed at 50.
 */

import type { FeedItem, FeedItemKind, Severity, TabSession } from './types';

const MAX_FEED_ITEMS = 50;

export function kindFromMethod(method: string): FeedItemKind {
  switch (method) {
    case 'eth_accounts':
    case 'eth_requestAccounts':
      return 'connect';
    case 'eth_sendTransaction':
      return 'tx';
    case 'wallet_switchEthereumChain':
    case 'wallet_addEthereumChain':
      return 'chain';
    case 'eth_sign':
    case 'personal_sign':
    default:
      if (method.startsWith('eth_signTypedData')) return 'sign';
      return 'sign';
  }
}

export function severityForItem(
  kind: FeedItemKind,
  phase: 'before' | 'after' | 'error'
): Severity {
  if (phase === 'error') return 'danger';
  if (kind === 'tx' || kind === 'sign') return 'warn';
  return 'info';
}

export function oneLinerForRequest(
  kind: FeedItemKind,
  method: string,
  phase: 'before' | 'after' | 'error',
  params?: unknown[],
  error?: string
): string {
  if (phase === 'error' && error) return `Failed: ${error.slice(0, 60)}`;
  switch (kind) {
    case 'connect':
      return phase === 'before' ? 'Requesting account access' : 'Account access completed';
    case 'tx':
      return phase === 'before' ? 'Sending transaction' : 'Transaction sent';
    case 'sign':
      return phase === 'before' ? 'Requesting signature' : 'Signature completed';
    case 'chain':
      return phase === 'before' ? 'Switching/add chain' : 'Chain switch completed';
    default:
      return `${method} ${phase}`;
  }
}

export function createEmptySession(tabId: number, hostname: string): TabSession {
  return {
    tabId,
    hostname,
    web3Active: false,
    lastSeenAt: Date.now(),
    feed: [],
    counts: { connect: 0, sign: 0, tx: 0, chain: 0 },
  };
}

export function ensureSession(
  sessions: Map<number, TabSession>,
  tabId: number,
  hostname: string
): TabSession {
  let session = sessions.get(tabId);
  if (!session) {
    session = createEmptySession(tabId, hostname);
    sessions.set(tabId, session);
  }
  return session;
}

export function mergeRequestIntoSession(
  session: TabSession,
  payload: {
    phase: 'before' | 'after' | 'error';
    id: string;
    method: string;
    params?: unknown[];
    result?: unknown;
    error?: string;
  }
): TabSession {
  const { phase, id, method, params, result, error } = payload;
  const kind = kindFromMethod(method);
  const severity = severityForItem(kind, phase);
  const oneLiner = oneLinerForRequest(kind, method, phase, params, error);

  const now = Date.now();
  const existingIndex = session.feed.findIndex((item) => item.id === id);

  if (phase === 'before') {
    const newItem: FeedItem = {
      id,
      kind,
      severity,
      oneLiner,
      method,
      phase: 'before',
      startedAt: now,
      params: paramsToPreview(method, params),
    };
    let feed = [...session.feed];
    if (existingIndex >= 0) {
      feed[existingIndex] = newItem;
    } else {
      feed = [newItem, ...feed].slice(0, MAX_FEED_ITEMS);
    }
    const counts = { ...session.counts };
    counts[kind] = (counts[kind] ?? 0) + 1;
    return {
      ...session,
      web3Active: true,
      lastSeenAt: now,
      feed,
      counts,
    };
  }

  // after | error
  if (existingIndex < 0) {
    const newItem: FeedItem = {
      id,
      kind,
      severity,
      oneLiner,
      method,
      phase: phase as 'after' | 'error',
      startedAt: now,
      resolvedAt: now,
      params: paramsToPreview(method, params),
      ...(phase === 'error' && error ? { error } : {}),
    };
    const feed = [newItem, ...session.feed].slice(0, MAX_FEED_ITEMS);
    const counts = { ...session.counts };
    counts[kind] = (counts[kind] ?? 0) + 1;
    return {
      ...session,
      web3Active: true,
      lastSeenAt: now,
      feed,
      counts,
    };
  }

  const item = session.feed[existingIndex];
  const updatedItem: FeedItem = {
    ...item,
    phase: phase as 'after' | 'error',
    resolvedAt: now,
    oneLiner,
    severity,
    ...(phase === 'error' && error ? { error } : {}),
  };
  const feed = [...session.feed];
  feed[existingIndex] = updatedItem;

  return {
    ...session,
    web3Active: true,
    lastSeenAt: now,
    feed,
  };
}

function paramsToPreview(
  method: string,
  params?: unknown[]
): Record<string, unknown> | undefined {
  if (!params?.length) return undefined;
  if (method === 'eth_sendTransaction' && params[0] && typeof params[0] === 'object') {
    const tx = params[0] as Record<string, unknown>;
    return {
      to: tx.to,
      value: tx.value,
      hasData: Boolean(tx.data),
    };
  }
  if (
    (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') &&
    params[0] &&
    typeof params[0] === 'object'
  ) {
    const chain = params[0] as Record<string, unknown>;
    return { chainId: chain.chainId };
  }
  return { paramsLength: params.length };
}

/** Serialize session for storage (no non-JSON values). */
export function serializeSession(session: TabSession): string {
  return JSON.stringify(session);
}

export function deserializeSession(json: string): TabSession | null {
  try {
    const parsed = JSON.parse(json) as TabSession;
    if (
      typeof parsed.tabId !== 'number' ||
      typeof parsed.hostname !== 'string' ||
      !Array.isArray(parsed.feed)
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}
