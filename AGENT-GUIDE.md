# ENSight Extension — Guide for Coding Agents

This document gives a **coding agent** (or new developer) everything needed to understand and modify the ensight-extension codebase. Use it as the primary structural reference; for exact input/output contracts see `INPUT-OUTPUT-SPEC.md`.

---

## 1. What This Extension Does

- **Observes** Ethereum wallet usage on any tab: connect, sign, send transaction, switch/add chain.
- **Does not block or modify** wallet calls; it only intercepts and records.
- **Popup** shows the active tab’s “session”: hostname, counts (connect/sign/tx/chain), and a **feed** of recent requests with one-liners and expandable details.
- **Backend-ready**: can call ensight-backend `GET /api/risk/address/:address` when API base URL is set in storage.

---

## 2. Repository Layout

```
ensight-extension/
├── entrypoints/
│   ├── ethereum-main-world.ts   # Page context: patches window.ethereum.request
│   ├── content/index.ts         # Content script: postMessage → sendMessage bridge
│   ├── background/index.ts      # Service worker: sessions, feed, persistence, popup API
│   └── popup/                   # React popup UI (App.tsx, App.css, main.tsx, style.css)
├── utils/
│   ├── backend.ts               # Backend API client (getRiskForAddress, getApiBaseUrl, setApiBaseUrl)
│   ├── messages.ts              # Message type constants and TypeScript types
│   ├── ethMethods.ts            # Ethereum method definitions (stub)
│   ├── format.ts                # Formatting helpers
│   └── riskRules.ts             # Risk heuristics (stub)
├── public/icons/                # Extension icons (on/off, multiple sizes)
├── wxt.config.ts                # WXT + React; web_accessible_resources for ethereum-main-world.js
├── INPUT-OUTPUT-SPEC.md         # Authoritative I/O and backend contract
├── AGENT-GUIDE.md               # This file
├── DOCUMENTATION.md             # Longer human docs (partially outdated re “detection only”)
└── QUICK-REFERENCE.md           # Quick lookup (update to “interception” when editing)
```

---

## 3. Entrypoints and Responsibilities

| Entrypoint | Role | Key behavior |
|------------|------|--------------|
| **ethereum-main-world.ts** | Page context (same JS world as `window.ethereum`) | Patches `provider.request`; sends `ETHEREUM_ACTIVE` once per page when first request runs; sends `ETHEREUM_REQUEST` with `phase: "before" \| "after" \| "error"` and `id`, `method`, `params`, `page`, `summary` (kind, to, value, hasData, chainId). |
| **content/index.ts** | Bridge | Injects main-world script; listens `window.postMessage`; forwards only high-signal methods to background via `ENSIGHT/ETH_ACTIVE` and `ENSIGHT/ETH_REQUEST`; sends `ENSIGHT/CONTENT_LOADED` on load. |
| **background/index.ts** | State and API | Keeps per-tab sessions (feed, counts, hostname, etc.); collapses before/after/error by `id`; persists to `browser.storage.local` on ETH_ACTIVE and every ETH_REQUEST; sets tab icon on/off; handles `ENSIGHT/GET_ACTIVE_SESSION`, `ENSIGHT/GET_SESSION`, `ENSIGHT/GET_LAST_SESSION`, etc. |
| **popup/App.tsx** | UI | Calls `ENSIGHT/GET_ACTIVE_SESSION` on load and on storage change; shows session header, counts, feed list, expandable details; refresh button re-requests GET_ACTIVE_SESSION. |

---

## 4. Message Protocol (Single Source of Truth: `utils/messages.ts`)

- **Content → Background**: `ENSIGHT/CONTENT_LOADED`, `ENSIGHT/ETH_ACTIVE`, `ENSIGHT/ETH_REQUEST` (with `event` payload).
- **Popup → Background**: `ENSIGHT/GET_ACTIVE_SESSION`, `ENSIGHT/GET_SESSION` (with `tabId`), `ENSIGHT/GET_LAST_SESSION`, `ENSIGHT/GET_EVENTS`, `ENSIGHT/DEBUG_ALL_SESSIONS`.
- **Background responses**: `{ ok: true }`, `{ ok: true, session: SerializedSession | null }`, `{ ok: true, all: ... }`.

Use the constants and types in `utils/messages.ts` when adding or handling messages.

---

## 5. Backend Integration (ensight-backend)

- **Config**: API base URL is stored in `browser.storage.local` under key `ensight:apiBaseUrl`. No URL → no backend calls.
- **Client**: `utils/backend.ts`
  - `getApiBaseUrl()` / `setApiBaseUrl(url)` — get/set base URL.
  - `getRiskForAddress(address)` — `GET ${base}/api/risk/address/${address}` → `{ flagged: boolean, lastUpdated: number | null }` or `null` if disabled/failure.
- **Backend contract** (implement in ensight-backend): `GET /api/risk/address/:address` returns `{ flagged: boolean, lastUpdated: number | null }`. See `docs/BACKEND-VERCEL-UPSTASH.md` and `INPUT-OUTPUT-SPEC.md` (section 5).

**Where to call risk in the extension**: From popup when rendering a tx detail (e.g. when `selected.kind === "tx"` and `selected.to` is set), call `getRiskForAddress(selected.to)` and show flagged/ok. Alternatively, background can call it after upserting a tx and attach a `riskChecked` field to the record (then persist).

---

## 6. Persistence and Session Lifecycle

- **Storage key**: `ensight:session:${tabId}`.
- **Written**: On every `ENSIGHT/ETH_ACTIVE` and every `ENSIGHT/ETH_REQUEST` for that tab (after `upsertFromEvent`).
- **Cleared**: On tab `onUpdated` when `status === "loading"`, and on `tabs.onRemoved`.
- **Read**: When popup requests `ENSIGHT/GET_ACTIVE_SESSION` and the live session is missing (e.g. worker restarted), background falls back to `browser.storage.local.get(sessionKey(tabId))`.

---

## 7. How to Run and Verify

1. **Install deps and dev**: From `ensight-extension/` run `pnpm install && pnpm dev`.
2. **Load extension**: Chrome → `chrome://extensions/` → Developer mode → Load unpacked → select `ensight-extension/.output/chrome-mv3`.
3. **Verify main flow**:
   - Open a dApp (e.g. https://app.uniswap.org), connect wallet or trigger a tx/sign.
   - Extension icon for that tab should switch to “on”.
   - Open popup: you should see hostname, “web3 active”, counts, and a feed of requests; expanding an item shows method, phase, to, value, hasData, etc.
   - Close and reopen popup: session should still appear (persisted).
4. **Verify backend socket** (optional): In background or popup, call `setApiBaseUrl('https://your-backend.vercel.app')` then `getRiskForAddress('0x...')`; with backend up and risk route implemented, you should get `{ flagged, lastUpdated }`.

---

## 8. Where to Change What

| Goal | Where to change |
|------|------------------|
| Add a new intercepted method | `content/index.ts`: add method to `HIGH_SIGNAL_METHODS`. `ethereum-main-world.ts`: extend `summarize()` if you need a new `kind` or extra fields. |
| Change feed cap or session shape | `background/index.ts`: `MAX_FEED`, `TabSession`, `RequestRecord`, `serializeSession`. |
| Add a new popup → background request | `utils/messages.ts`: add constant and payload type; `background/index.ts`: add handler and return shape. |
| Add a new backend endpoint call | `utils/backend.ts`: add a function (same pattern as `getRiskForAddress`). Optionally call it from background after upsert or from popup when showing details. |
| Change risk UI in popup | `entrypoints/popup/App.tsx`: when rendering `selected` (e.g. for `kind === "tx"`), call `getRiskForAddress(selected.to)` and display result. |
| Add or change storage keys | Prefer prefix `ensight:` (e.g. `ensight:apiBaseUrl`, `ensight:session:${tabId}`). Document in INPUT-OUTPUT-SPEC or here. |

---

## 9. Important Conventions

- **Message types**: Use constants from `utils/messages.ts`, not string literals.
- **Backend base URL**: Only in storage; no hardcoded production URL in code.
- **Addresses**: Normalize to lowercase for risk lookup; validate 0x + 42 chars before calling backend.
- **One fix at a time**: If something breaks, revert the last change, re-evaluate, then iterate (per project rules).

---

## 10. References

- **I/O and backend contract**: `INPUT-OUTPUT-SPEC.md`
- **Ecosystem (extension + backend + web)**: `docs/ARCHITECTURE.md`
- **Backend Vercel/Upstash/ScamSniffer**: `docs/BACKEND-VERCEL-UPSTASH.md`
- **Changelog**: `CHANGELOG.md`

End of agent guide.
