/**
 * Background: per-tab sessions, merge before/after/error into feed items,
 * persist to storage.local, handle popup session requests, set icon.
 *
 * Enrichment: when a tx or sign event arrives with a "to" address, call the
 * backend for risk + ENS reverse lookup, then update the feed item and
 * persist again. Also sends interactions to the knowledge graph API.
 */

import {
  MSG_CONTENT_LOADED,
  MSG_ETH_ACTIVE,
  MSG_ETH_REQUEST,
  MSG_GET_ACTIVE_SESSION,
  MSG_GET_SESSION,
  MSG_GET_LAST_SESSION,
} from '~/utils/messages';
import type { TabSession, RiskInfo, EnsInfo } from '~/utils/types';
import {
  createEmptySession,
  ensureSession,
  mergeRequestIntoSession,
  serializeSession,
  deserializeSession,
  kindFromMethod,
} from '~/utils/session';
import {
  fetchRisk,
  fetchEnsReverse,
  postGraphInteraction,
} from '~/utils/api';

const STORAGE_KEY_PREFIX = 'ensight-session-';

export default defineBackground(() => {
  const sessions = new Map<number, TabSession>();

  async function persistSession(tabId: number, session: TabSession): Promise<void> {
    await browser.storage.local.set({
      [`${STORAGE_KEY_PREFIX}${tabId}`]: serializeSession(session),
    });
  }

  async function removeSession(tabId: number): Promise<void> {
    await browser.storage.local.remove(`${STORAGE_KEY_PREFIX}${tabId}`);
  }

  function setIcon(hasActivity: boolean): void {
    const path = hasActivity
      ? { path: { 16: '/icons/ensight-on-16.png', 32: '/icons/ensight-on-32.png', 48: '/icons/ensight-on-48.png' } }
      : { path: { 16: '/icons/ensight-off-16.png', 32: '/icons/ensight-off-32.png', 48: '/icons/ensight-off-48.png' } };
    browser.action?.setIcon(path).catch(() => {});
  }

  /**
   * Enrich a feed item with risk + ENS data from the backend.
   * Runs asynchronously — updates the session in-place when done.
   */
  async function enrichFeedItem(tabId: number, feedItemId: string, toAddress: string): Promise<void> {
    const [riskResult, ensResult] = await Promise.all([
      fetchRisk(toAddress),
      fetchEnsReverse(toAddress),
    ]);

    const session = sessions.get(tabId);
    if (!session) return;

    const idx = session.feed.findIndex((item) => item.id === feedItemId);
    if (idx < 0) return;

    const item = session.feed[idx];
    const updates: Partial<typeof item> = {};

    if (riskResult) {
      const risk: RiskInfo = { flagged: riskResult.flagged, lastUpdated: riskResult.lastUpdated };
      updates.risk = risk;
      // Escalate severity if flagged
      if (risk.flagged && item.severity !== 'danger') {
        updates.severity = 'danger';
        updates.oneLiner = `WARNING: flagged address — ${item.oneLiner}`;
      }
    }

    if (ensResult && ensResult.name) {
      const toEns: EnsInfo = { name: ensResult.name };
      updates.toEns = toEns;
    }

    if (Object.keys(updates).length > 0) {
      const updatedFeed = [...session.feed];
      updatedFeed[idx] = { ...item, ...updates };
      const updatedSession = { ...session, feed: updatedFeed };
      sessions.set(tabId, updatedSession);
      persistSession(tabId, updatedSession);
    }
  }

  /**
   * Send an interaction to the backend knowledge graph (fire-and-forget).
   */
  function recordGraphInteraction(
    fromAddress: string | undefined,
    toAddress: string,
    method: string,
    kind: string,
    hostname: string,
    params?: Record<string, unknown>,
  ): void {
    if (!fromAddress && !toAddress) return;
    postGraphInteraction({
      from: fromAddress ?? '',
      to: toAddress,
      method,
      kind,
      hostname,
      chainId: params?.chainId != null ? String(params.chainId) : undefined,
      value: params?.value != null ? String(params.value) : undefined,
      hasData: params?.hasData != null ? Boolean(params.hasData) : undefined,
    }).catch(() => { /* fire-and-forget */ });
  }

  browser.runtime.onMessage.addListener(
    (
      message: { type: string; payload?: Record<string, unknown> },
      sender: { tab?: { id?: number } }
    ) => {
      const tabId = sender.tab?.id;
      if (message.type === MSG_CONTENT_LOADED && tabId != null && message.payload) {
        const hostname = (message.payload.hostname as string) ?? '';
        const session = ensureSession(sessions, tabId, hostname);
        sessions.set(tabId, session);
        persistSession(tabId, session);
        return Promise.resolve(undefined);
      }

      if (message.type === MSG_ETH_ACTIVE && tabId != null) {
        let session = sessions.get(tabId);
        if (session) {
          session = { ...session, web3Active: true, lastSeenAt: Date.now() };
          sessions.set(tabId, session);
          persistSession(tabId, session);
          setIcon(true);
        }
        return Promise.resolve(undefined);
      }

      if (message.type === MSG_ETH_REQUEST && tabId != null && message.payload) {
        const p = message.payload as {
          phase: 'before' | 'after' | 'error';
          id: string;
          method: string;
          params?: unknown[];
          result?: unknown;
          error?: string;
        };
        let session = sessions.get(tabId);
        if (!session) {
          session = createEmptySession(tabId, '');
          sessions.set(tabId, session);
        }
        session = mergeRequestIntoSession(session, {
          phase: p.phase,
          id: p.id,
          method: p.method,
          params: p.params,
          result: p.result,
          error: p.error,
        });
        sessions.set(tabId, session);
        persistSession(tabId, session);
        setIcon(true);

        // --- Backend enrichment (async, non-blocking) ---
        if (p.phase === 'before') {
          const kind = kindFromMethod(p.method);
          // Extract "to" address from tx params
          const txParams = Array.isArray(p.params) && p.params[0] && typeof p.params[0] === 'object'
            ? (p.params[0] as Record<string, unknown>)
            : undefined;
          const toAddress = txParams?.to as string | undefined;

          if (toAddress && /^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
            // Enrich the feed item with risk + ENS (async)
            enrichFeedItem(tabId, p.id, toAddress);

            // Record in knowledge graph (from = tx/sign sender; in "before" phase use params.from)
            const fromAddress = (txParams?.from as string)?.trim();
            const fromValid = fromAddress && /^0x[a-fA-F0-9]{40}$/.test(fromAddress) ? fromAddress : undefined;
            recordGraphInteraction(
              fromValid,
              toAddress,
              p.method,
              kind,
              session.hostname,
              txParams as Record<string, unknown>,
            );
          }
        }

        return Promise.resolve(undefined);
      }

      if (message.type === MSG_GET_ACTIVE_SESSION) {
        return browser.tabs
          .query({ active: true, currentWindow: true })
          .then((tabs) => {
            const tab = tabs[0];
            const id = tab?.id;
            if (id == null) return null;
            const session = sessions.get(id);
            if (session) return session;
            return browser.storage.local.get(`${STORAGE_KEY_PREFIX}${id}`).then((stored) => {
              const raw = stored[`${STORAGE_KEY_PREFIX}${id}`];
              if (typeof raw === 'string') {
                const restored = deserializeSession(raw);
                if (restored) sessions.set(id, restored);
                return restored;
              }
              return null;
            });
          });
      }

      if (message.type === MSG_GET_SESSION && message.payload?.tabId != null) {
        const id = message.payload.tabId as number;
        const session = sessions.get(id);
        if (session) return Promise.resolve(session);
        return browser.storage.local.get(`${STORAGE_KEY_PREFIX}${id}`).then((stored) => {
          const raw = stored[`${STORAGE_KEY_PREFIX}${id}`];
          if (typeof raw === 'string') {
            const restored = deserializeSession(raw);
            if (restored) sessions.set(id, restored);
            return restored ?? null;
          }
          return null;
        });
      }

      if (message.type === MSG_GET_LAST_SESSION) {
        return browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
          const id = tabs[0]?.id;
          if (id == null) return null;
          const session = sessions.get(id);
          if (session) return session;
          return browser.storage.local.get(`${STORAGE_KEY_PREFIX}${id}`).then((stored) => {
            const raw = stored[`${STORAGE_KEY_PREFIX}${id}`];
            if (typeof raw === 'string') {
              const restored = deserializeSession(raw);
              if (restored) sessions.set(id, restored);
              return restored ?? null;
            }
            return null;
          });
        });
      }

      return undefined;
    }
  );

  browser.tabs.onRemoved.addListener((tabId: number) => {
    sessions.delete(tabId);
    removeSession(tabId);
  });

  browser.tabs.onUpdated.addListener((tabId: number, changeInfo: { status?: string }) => {
    if (changeInfo.status === 'loading') {
      sessions.delete(tabId);
      removeSession(tabId);
    }
  });
});
