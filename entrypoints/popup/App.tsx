// entrypoints/popup/App.tsx
// popup UI (mvp)
// asks background for current tab session
// renders a simple activity feed + details panel
// polls for updates (cheap + easy for phase 4)

import { useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import "./App.css";

type Severity = "info" | "warn" | "danger";
type Kind = "connect" | "tx" | "sign" | "chain" | "unknown";

type FeedItem = {
  id: string;
  method: string;
  kind: Kind;
  severity: Severity;

  // lifecycle
  phase: "before" | "after" | "error";
  ok?: boolean;
  error?: { name?: string; message?: string };
  durationMs?: number;

  // page context
  page?: { hostname?: string; title?: string; url?: string };

  // tx hints
  to?: string;
  value?: string;
  hasData?: boolean;

  // chain hints
  chainId?: string;

  // safe preview for debug
  paramsPreview?: any;

  // UI-ready one-liner from background
  oneLiner?: string;
};

type Session = {
  tabId: number;
  isActive: boolean;
  lastSeenAt: number;
  hostname?: string;
  title?: string;
  counts: Record<Kind, number>;
  feed: FeedItem[];
};

// css class for the pill
const pill = (severity: Severity) => {
  if (severity === "danger") return "pill pill-danger";
  if (severity === "warn") return "pill pill-warn";
  return "pill pill-info";
};

// tiny icon per action type
const icon = (kind: Kind) => {
  if (kind === "tx") return "↗";
  if (kind === "sign") return "✍";
  if (kind === "connect") return "🔌";
  if (kind === "chain") return "⛓";
  return "•";
};

// "last seen" helper
function timeAgo(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function App() {
  console.log("POPUP BUILD MARKER v999");
  // session snapshot from background (active tab)
  const [session, setSession] = useState<Session | null>(null);

  // which feed item is expanded in the UI
  const [selectedId, setSelectedId] = useState<string | null>(null);
  console.log("popup render", session?.feed?.length);
  // subscribe to storage changes
  useEffect(() => {
    let alive = true;
  
    const load = async () => {
      try {
        const res = await browser.runtime.sendMessage({
          type: "ENSIGHT/GET_ACTIVE_SESSION",
        });
        if (!alive) return;
        setSession(res?.session ?? null);
      } catch (error) {
        if (!alive) return;
        setSession(null);
      }
    };
    
    
  
    const onChanged = (changes: any, area: string) => {
      if (area !== "local") return;
      // easiest: just reload when any local storage changes
      load();
    };
  
    load();
    browser.storage.onChanged.addListener(onChanged);
  
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);  

  const feed = session?.feed ?? [];

  // find the selected item in the current feed
  const selected = useMemo(
    () => feed.find((x) => x.id === selectedId) ?? null,
    [feed, selectedId]
  );

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <div className="logoDot" />
          <div>
            <div className="title">ensight</div>
            <div className="sub">
              {session?.hostname ?? "no active tab"}
              {session ? ` • ${timeAgo(session.lastSeenAt)}` : ""}
            </div>
          </div>
        </div>

        <div className={session?.isActive ? "status status-on" : "status status-off"}>
          {session?.isActive ? "web3 active" : "inactive"}
        </div>
      </header>

      {/* quick counters (what happened on this page) */}
      <section className="counts">
        <div className="count">
          <div className="countNum">{session?.counts?.connect ?? 0}</div>
          <div className="countLbl">connect</div>
        </div>
        <div className="count">
          <div className="countNum">{session?.counts?.sign ?? 0}</div>
          <div className="countLbl">sign</div>
        </div>
        <div className="count">
          <div className="countNum">{session?.counts?.tx ?? 0}</div>
          <div className="countLbl">tx</div>
        </div>
        <div className="count">
          <div className="countNum">{session?.counts?.chain ?? 0}</div>
          <div className="countLbl">chain</div>
        </div>
      </section>

      {/* main activity feed */}
      <section className="feed">
        {feed.length === 0 ? (
          <div className="empty">
            <div className="emptyTitle">no wallet activity yet</div>
            <div className="emptySub">connect / sign / tx will show up here</div>
          </div>
        ) : (
          feed.slice(0, 15).map((x) => (
            <button
              key={x.id}
              className={selectedId === x.id ? "row rowActive" : "row"}
              onClick={() => setSelectedId((cur) => (cur === x.id ? null : x.id))}
            >
              <div className="rowLeft">
                <div className="rowIcon">{icon(x.kind)}</div>

                <div className="rowMain">
                  <div className="rowTop">
                    <span className={pill(x.severity)}>{x.severity}</span>
                    <span className="rowText">{x.oneLiner ?? x.method}</span>
                  </div>

                  <div className="rowSub">
                    {x.page?.hostname ?? "unknown site"}
                    {typeof x.durationMs === "number" ? ` • ${x.durationMs}ms` : ""}
                    {x.phase === "before"
                      ? " • pending"
                      : x.phase === "error"
                      ? " • rejected"
                      : " • ok"}
                  </div>
                </div>
              </div>

              <div className="chev">{selectedId === x.id ? "–" : "+"}</div>
            </button>
          ))
        )}
      </section>

      {/* expanded details panel */}
      {selected ? (
        <section className="detail">
          <div className="detailTitle">details</div>

          <div className="detailGrid">
            <div className="kv">
              <div className="k">method</div>
              <div className="v mono">{selected.method}</div>
            </div>

            <div className="kv">
              <div className="k">phase</div>
              <div className="v mono">{selected.phase}</div>
            </div>

            {/* tx-specific fields */}
            {selected.kind === "tx" ? (
              <>
                <div className="kv">
                  <div className="k">to</div>
                  <div className="v mono">{selected.to ?? "—"}</div>
                </div>

                <div className="kv">
                  <div className="k">value</div>
                  <div className="v mono">{selected.value ?? "—"}</div>
                </div>

                <div className="kv">
                  <div className="k">has data</div>
                  <div className="v mono">{String(!!selected.hasData)}</div>
                </div>
              </>
            ) : null}

            {/* chain-specific fields */}
            {selected.kind === "chain" ? (
              <div className="kv">
                <div className="k">chainId</div>
                <div className="v mono">{selected.chainId ?? "—"}</div>
              </div>
            ) : null}

            {/* errors */}
            {selected.phase === "error" ? (
              <div className="kv kvFull">
                <div className="k">error</div>
                <div className="v mono">{selected.error?.message ?? "—"}</div>
              </div>
            ) : null}

            {/* safe preview */}
            {selected.paramsPreview ? (
              <div className="kv kvFull">
                <div className="k">preview</div>
                <pre className="v pre">{JSON.stringify(selected.paramsPreview, null, 2)}</pre>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <footer className="foot">
        {/* simple manual refresh (useful while developing) */}
        <button
          className="ghost"
          onClick={() => {
            setSelectedId(null);
            browser.runtime.sendMessage({ type: "ENSIGHT/GET_ACTIVE_SESSION" }).then((res) => {
              console.log("ensight: GET_ACTIVE_SESSION response", res);
              setSession(res?.session ?? null);
            });
          }}
        >
          refresh
        </button>
      </footer>
    </div>
  );
}
