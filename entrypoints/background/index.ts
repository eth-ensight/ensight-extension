// entrypoints/background/index.ts
// background service worker
// receives wallet intent from content scripts
// keeps per-tab session state
// collapses before/after/error into one action
// feeds the popup clean, UI-ready snapshots

export default defineBackground(() => {
  console.log("ensight: background running");

  // ------------------------------------------------------------
  // types (our internal "wallet activity model")
  // ------------------------------------------------------------

  type Severity = "info" | "warn" | "danger";
  type Kind = "connect" | "tx" | "sign" | "chain" | "unknown";

  // one user action (connect/sign/tx/chain)
  // collapsed by `id` across before/after/error
  type RequestRecord = {
    id: string;
    method: string;
    kind: Kind;
    severity: Severity;

    // lightweight page identity for UI
    page?: { url?: string; hostname?: string; title?: string };

    // tx hints
    to?: string;
    value?: string;
    hasData?: boolean;

    // chain hints
    chainId?: string;

    // lifecycle
    phase: "before" | "after" | "error";
    ok?: boolean;
    error?: { name?: string; message?: string };

    // timing
    startedAt?: number;
    endedAt?: number;
    durationMs?: number;

    // safe debug preview (never store full signature payloads)
    paramsPreview?: any;
  };

  // tab session = what happened on this page, in this tab
  type TabSession = {
    tabId: number;
    isActive: boolean; // "wallet was used" (not just installed)
    lastSeenAt: number;

    hostname?: string;
    title?: string;

    counts: Record<Kind, number>;
    feed: RequestRecord[]; // newest first
    byId: Record<string, RequestRecord>; // collapse map by request id
  };

  // ------------------------------------------------------------
  // state (MUST exist before any listeners reference it)
  // ------------------------------------------------------------

  const MAX_FEED = 50;

  // per-tab sessions (prevents cross-site mixing)
  const tabSessions = new Map<number, TabSession>();

  const baseCounts = (): TabSession["counts"] => ({
    connect: 0,
    tx: 0,
    sign: 0,
    chain: 0,
    unknown: 0,
  });

  const getSession = (tabId: number): TabSession => {
    const existing = tabSessions.get(tabId);
    if (existing) return existing;

    const fresh: TabSession = {
      tabId,
      isActive: false,
      lastSeenAt: Date.now(),
      hostname: undefined,
      title: undefined,
      counts: baseCounts(),
      feed: [],
      byId: {},
    };

    tabSessions.set(tabId, fresh);
    return fresh;
  };

  // ------------------------------------------------------------
  // icons (off = normal browsing, on = web3-active)
  // ------------------------------------------------------------

  const ICON_OFF = {
    16: "icons/ensight-off-16.png",
    32: "icons/ensight-off-32.png",
    48: "icons/ensight-off-48.png",
    128: "icons/ensight-off-128.png",
  };

  const ICON_ON = {
    16: "icons/ensight-on-16.png",
    32: "icons/ensight-on-32.png",
    48: "icons/ensight-on-48.png",
    128: "icons/ensight-on-128.png",
  };

  const setTabIcon = async (tabId: number, on: boolean) => {
    try {
      await browser.action.setIcon({
        tabId,
        path: on ? ICON_ON : ICON_OFF,
      });
      void browser.runtime.lastError;
    } catch {
      // some pages block it, ignore
    }
  };

  // ------------------------------------------------------------
  // tab lifecycle listeners (now safe: tabSessions exists)
  // ------------------------------------------------------------

  // new navigation = new trust context
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "loading") {
      setTabIcon(tabId, false);
      tabSessions.delete(tabId); // wipe session for the new page

      browser.storage.local.remove(sessionKey(tabId));
    }
  });

  // cleanup on close
  browser.tabs.onRemoved.addListener((tabId) => {
    tabSessions.delete(tabId);
    browser.storage.local.remove(sessionKey(tabId));
  });

  // ------------------------------------------------------------
  // derive helpers (turn raw events into "explainable intent")
  // ------------------------------------------------------------

  const kindFrom = (evt: any): Kind => {
    const k = evt?.summary?.kind;
    if (k === "connect" || k === "tx" || k === "sign" || k === "chain") return k;
    return "unknown";
  };

  const severityFor = (r: Partial<RequestRecord>): Severity => {
    if (r.kind === "tx") {
      // contract calls = highest attention
      if (r.hasData) return "danger";

      // value transfer = still attention
      if (r.value && r.value !== "0x0" && r.value !== "0x00") return "warn";

      // tx is meaningful by default
      return "warn";
    }

    if (r.kind === "sign") return "warn";
    if (r.kind === "chain") return "warn";
    if (r.kind === "connect") return "info";
    return "info";
  };

  const explainOneLiner = (r: RequestRecord): string => {
    if (r.kind === "connect") return "wallet connection request";
    if (r.kind === "sign") return "signature request";
    if (r.kind === "chain") return `network change${r.chainId ? ` → ${r.chainId}` : ""}`;

    if (r.kind === "tx") {
      const parts: string[] = ["transaction"];
      if (r.value && r.value !== "0x0" && r.value !== "0x00") parts.push("sends value");
      if (r.hasData) parts.push("contract interaction");
      if (r.to) parts.push(`to ${r.to.slice(0, 6)}…${r.to.slice(-4)}`);
      return parts.join(" • ");
    }

    return "wallet request";
  };

  const previewParams = (method: string, params: any) => {
    try {
      // signatures can be huge; keep tiny
      if (method.startsWith("eth_sign") || method === "personal_sign") {
        const p = Array.isArray(params) ? params : [];
        const msg = p.find((x) => typeof x === "string");
        return msg ? { messagePreview: msg.slice(0, 80), length: msg.length } : { note: "signature" };
      }

      // tx preview (safe + useful)
      if (method === "eth_sendTransaction") {
        const p = Array.isArray(params) ? params : [];
        const tx = (p?.[0] ?? {}) as any;
        return {
          to: typeof tx?.to === "string" ? tx.to : undefined,
          value: typeof tx?.value === "string" ? tx.value : undefined,
          hasData: typeof tx?.data === "string" && tx.data.length > 2,
        };
      }

      return undefined;
    } catch {
      return undefined;
    }
  };

  // core reducer:
  // takes raw ETHEREUM_REQUEST events
  // collapses them into one RequestRecord per id
  const upsertFromEvent = (tabId: number, evt: any) => {
    const s = getSession(tabId);

    // tab is now officially "web3 active"
    s.isActive = true;
    s.lastSeenAt = Date.now();

    // capture page identity (best-effort)
    s.hostname = evt?.page?.hostname ?? s.hostname;
    s.title = evt?.page?.title ?? s.title;

    const id = String(evt?.id ?? "");
    if (!id) return;

    const kind = kindFrom(evt);
    const method = String(evt?.method ?? "unknown");
    const phase =
      evt?.phase === "before" || evt?.phase === "after" || evt?.phase === "error"
        ? evt.phase
        : "before";

    const existing = s.byId[id];

    // new action if first time seeing this id
    const record: RequestRecord =
      existing ??
      ({
        id,
        method,
        kind,
        severity: "info",
        phase,
        page: evt?.page,
      } as RequestRecord);

    // always refresh fields
    record.method = method;
    record.kind = kind;
    record.phase = phase;
    record.page = evt?.page ?? record.page;

    // timing / lifecycle
    if (phase === "before") record.startedAt = evt?.ts ?? Date.now();

    if (phase === "after" || phase === "error") {
      record.endedAt = evt?.ts ?? Date.now();
      record.durationMs = typeof evt?.durationMs === "number" ? evt.durationMs : record.durationMs;
      record.ok = phase === "after";
      record.error = phase === "error" ? evt?.error : undefined;
    }

    // copy summary hints for tx/chain
    if (kind === "tx") {
      record.to = evt?.summary?.to ?? record.to;
      record.value = evt?.summary?.value ?? record.value;
      record.hasData = evt?.summary?.hasData ?? record.hasData;
    }

    if (kind === "chain") {
      record.chainId = evt?.summary?.chainId ?? record.chainId;
    }

    record.paramsPreview = previewParams(method, evt?.params);
    record.severity = severityFor(record);

    // first time = add to feed + bump counters
    if (!existing) {
      s.counts[kind] = (s.counts[kind] ?? 0) + 1;
      s.feed.unshift(record);
      if (s.feed.length > MAX_FEED) s.feed.pop();
    }

    // collapse map always holds latest record
    s.byId[id] = record;

    // keep feed entry synced (safe even if you later clone objects)
    const idx = s.feed.findIndex((x) => x.id === id);
    if (idx >= 0) s.feed[idx] = record;

    return record;
  };

  // popup gets a clean snapshot (no big objects)
  const serializeSession = (s: TabSession) => ({
    tabId: s.tabId,
    isActive: s.isActive,
    lastSeenAt: s.lastSeenAt,
    hostname: s.hostname,
    title: s.title,
    counts: s.counts,
    feed: s.feed.map((r) => ({
      ...r,
      oneLiner: explainOneLiner(r),
    })),
  });

  // ------------------------------------------------------------
  // persistence helpers (so popup survives MV3 worker restarts)
  // ------------------------------------------------------------

  const sessionKey = (tabId: number) => `ensight:session:${tabId}`;

  const persistSession = async (tabId: number) => {
    const s = tabSessions.get(tabId);
    await browser.storage.local.set({
      [sessionKey(tabId)]: s ? serializeSession(s) : null,
    });
  };

  // ------------------------------------------------------------
  // message router (content script + popup)
  // ------------------------------------------------------------

  browser.runtime.onMessage.addListener(async (msg, sender) => {
    if (msg?.type === "ENSIGHT/CONTENT_LOADED") {
      return { ok: true };
    }

    // debug: see every tab session (proves background is storing events)
    if (msg?.type === "ENSIGHT/DEBUG_ALL_SESSIONS") {
      const all = Array.from(tabSessions.entries()).map(([tabId, s]) => ({
        tabId,
        isActive: s.isActive,
        lastSeenAt: s.lastSeenAt,
        hostname: s.hostname,
        title: s.title,
        counts: s.counts,
        feedLen: s.feed.length,
      }));
      return { ok: true, all };
    }

    // phase 2/3: first real wallet usage happened on this page
    if (msg?.type === "ENSIGHT/ETH_ACTIVE") {
      const tabId = sender.tab?.id;
      if (tabId != null) {
        const s = getSession(tabId);
        s.isActive = true;
        s.lastSeenAt = Date.now();
        await setTabIcon(tabId, true);

        await persistSession(tabId); // ✅ here
      }
      return { ok: true };
    }


    // phase 3+: wallet request lifecycle events
    let lastTabId: number | null = null;

    if (msg?.type === "ENSIGHT/ETH_REQUEST") {
      const tabId = sender.tab?.id;
      if (tabId != null) {
        lastTabId = tabId;
        upsertFromEvent(tabId, msg.event);
        await setTabIcon(tabId, true);
        await persistSession(tabId);
      }
    }


    // popup: give me a specific tab session snapshot
    if (msg?.type === "ENSIGHT/GET_SESSION") {
      const tabId = msg?.tabId;
      const s = typeof tabId === "number" ? tabSessions.get(tabId) : undefined;
      console.log("ensight: GET_SESSION", tabId, "has?", !!s, "feedLen", s?.feed.length);
      return { ok: true, session: s ? serializeSession(s) : null };
    }
      
    if (msg?.type === "ENSIGHT/GET_LAST_SESSION") {
      const tabId = lastTabId;
      if (tabId == null) return { ok: true, session: null };
      const s = tabSessions.get(tabId);
      return { ok: true, session: s ? serializeSession(s) : null };
    }
    


    // popup: give me the active tab session snapshot
    // fallback to stored session if live session is not found
    if (msg?.type === "ENSIGHT/GET_ACTIVE_SESSION") {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const tabId = tab?.id;
      if (tabId == null) return { ok: true, session: null };
    
      const live = tabSessions.get(tabId);
      if (live) return { ok: true, session: serializeSession(live) };
    
      const stored = await browser.storage.local.get(sessionKey(tabId));
      return { ok: true, session: stored[sessionKey(tabId)] ?? null };
    }
    

    // legacy debug endpoint (optional)
    if (msg?.type === "ENSIGHT/GET_EVENTS") {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const tabId = tab?.id;
      if (tabId == null) return { ok: true, events: [] };

      const s = tabSessions.get(tabId);
      return { ok: true, events: s?.feed ?? [] };
    }

    return undefined;
  });
});
