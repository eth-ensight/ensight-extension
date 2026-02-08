# ENSight Extension — Core Functionality

**What it does:** Intercepts `window.ethereum` usage on any page, records wallet intent (connect / sign / tx / chain), and shows a per-tab activity feed in the popup so users see what’s happening before and after wallet actions.

---

## Architecture

| Layer | Role |
|-------|------|
| **Page world** (`ethereum-main-world.js`) | Patches `provider.request` in the same JS context as the site. Emits structured events via `window.postMessage`. |
| **Content script** | Listens for those messages, filters to high-signal methods, forwards to background. Injects the page-world script. |
| **Background** | Keeps per-tab sessions, collapses before/after/error into one feed item, persists to `storage.local` so popup survives MV3 restarts. |
| **Popup** | Asks background for the active tab’s session, shows feed + detail panel; updates when storage changes. |

---

## Interception

- **Patch target:** `ethereum.request` (and each provider in `ethereum.providers` if present).
- **Tracked methods:** `eth_accounts`, `eth_requestAccounts`, `eth_sendTransaction`, `eth_sign`, `personal_sign`, `eth_signTypedData*`, `wallet_switchEthereumChain`, `wallet_addEthereumChain`.
- **Per request:** One “before” event when the call starts; one “after” or “error” when it resolves. Same `id` ties them together.

---

## Session Model

- **One session per tab.** New navigation clears that tab’s session; tab close removes it.
- **Feed:** Up to 50 items. Each item is a single logical request (before/after/error merged), with `kind` (connect / tx / sign / chain), `severity` (info / warn / danger), and a short `oneLiner`.
- **Persistence:** Background writes serialized session to `storage.local` per tab so the popup can read it after service worker restarts.
- **Icon:** Off by default; turns “on” when the tab has had any wallet activity.

---

## Popup UI

- **Header:** Current tab hostname, “web3 active” vs “inactive”, last-seen time.
- **Counts:** connect / sign / tx / chain for the current session.
- **Feed:** List of requests; click to expand details (method, phase, to/value/hasData for tx, chainId for chain, error if failed, params preview).
- **Updates:** Listens to `storage.onChanged` and re-requests active session so the feed stays in sync.

---

## Message Flow (summary)

- **Page → content:** `window.postMessage` with `ensight: true` and `type`: `ETHEREUM_ACTIVE` (first use) or `ETHEREUM_REQUEST` (each request lifecycle).
- **Content → background:** `ENSIGHT/ETH_ACTIVE`, `ENSIGHT/ETH_REQUEST`, `ENSIGHT/CONTENT_LOADED`.
- **Popup → background:** `ENSIGHT/GET_ACTIVE_SESSION` (or `GET_SESSION` / `GET_LAST_SESSION`). Response is serialized session or `null`.

---

## Backend integration

- **ENSight Backend** is called by the **background** when a tx or sign involves a `to` address:
  - **Risk:** `GET /api/risk/address/:address` (ScamSniffer). If flagged, the feed item is upgraded to danger and shows a "FLAGGED" badge.
  - **ENS:** `GET /api/ens/reverse/:address`. The resolved name is attached to the feed item and shown in the popup (To: name.eth).
- **Knowledge graph:** Each such interaction is sent as `POST /api/graph/interaction` so the backend can build semantic edges between wallets (sent_tx, signed_for, etc.). The graph can be queried via `GET /api/graph/address/:address` and `GET /api/graph/address/:address/neighbors`.
- **API base URL** defaults to `http://localhost:3000`. Override with `VITE_ENSIGHT_API_URL` (e.g. in `.env` or at build time) to point at a deployed backend.
