# ENSight Extension — Verification Guide

This guide walks you through verifying that the extension works end-to-end: load in Chrome, intercept wallet activity, show the popup feed, and confirm backend integration (ENS, risk, knowledge graph).

## Prerequisites

- Node.js 18+
- pnpm (or npm)
- Chrome (or another Chromium-based browser)

## 0. Start the backend (for full-stack verification)

The extension calls the backend for risk checks, ENS reverse lookup, and the knowledge graph. To verify those features:

```bash
# From repo root
cd ensight-backend/backend
npm install
npm run dev
```

Backend runs at `http://localhost:3000`. The extension defaults to this URL.

- **ENS-only:** Backend works with no env vars (uses public RPC).
- **Risk + graph:** Copy `backend/.env.example` to `backend/.env` and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (create a free DB at [upstash.com](https://upstash.com)).

Quick backend check:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/ens/reverse/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

## 1. Build the extension

```bash
pnpm install
pnpm build
```

Output is in `.output/chrome-mv3/`.

## 2. Load in Chrome

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the folder: `ensight-extension/.output/chrome-mv3`.
5. The ENSight extension should appear with its icon.

## 3. Verify interception

1. Open a site that uses `window.ethereum` (e.g. [app.ens.domains](https://app.ens.domains) or any dApp with “Connect wallet”).
2. Ensure the page is in the active tab.
3. Trigger a wallet action:
   - Click “Connect wallet” (triggers `eth_requestAccounts`), or
   - Initiate a transaction or signature (if already connected).
4. Open the ENSight popup by clicking the extension icon.
5. You should see:
   - **Header:** Current tab hostname, “Web3 active”, and last-seen time.
   - **Counts:** Non-zero for connect / sign / tx / chain as applicable.
   - **Activity feed:** At least one item (e.g. “Requesting account access” or “Sending transaction”).

## 4. Verify feed details

1. In the popup, click a feed item.
2. It should expand to show:
   - Method name
   - Phase (before / after / error)
   - **To:** address, with ENS name if the backend resolved it (or Wagmi in popup)
   - **ENS:** line when the backend provided a reverse lookup
   - **Risk:** “Clean” or “Flagged (ScamSniffer)” from the backend; if flagged, a red **FLAGGED** badge appears in the item header
   - For transactions: value, has data
   - For chain: chainId
   - For errors: error message

## 5. Verify ENS in popup

- **Connected wallet:** Click “Connect wallet” in the popup (Rainbow Kit). After connecting, your ENS name and avatar (if set) should appear.
- **Feed addresses:** For transaction items with a `to` address, the expanded detail should resolve that address to an ENS name (and avatar when available). Resolution comes from the backend first (reverse lookup), then Wagmi in the popup.

## 6. Verify backend integration (risk + graph)

1. With the backend running, trigger a **transaction** (or sign) that has a “to” address (e.g. send a small amount on a dApp, or approve a token).
2. Open the popup and expand that feed item.
3. **ENS:** You should see “To: name.eth” (or the address) and optionally an “ENS: name.eth” line if the backend resolved it.
4. **Risk:** You should see “Risk: Clean” or “Risk: Flagged …” (Flagged only if that address is in the ScamSniffer list; requires Redis + cron sync).
5. **Graph (optional, needs Redis):** The extension sends the interaction to the backend. To confirm, call the graph API with the same “to” address (lowercase):
   ```bash
   curl http://localhost:3000/api/graph/address/0x<the-to-address-in-lowercase>
   ```
   You should get `node`, `edges`, and `riskSummary`. If you used the same address twice, `edges` may show a count greater than 1.

## 7. Verify persistence

1. Trigger some activity on a dApp tab.
2. Open the popup and confirm the feed.
3. Close the popup and navigate to another tab.
4. Reopen the popup — it should show the **current** tab. Go back to the dApp tab, open the popup again; the previous session for that tab should still be visible (restored from `storage.local` if the service worker restarted).

## 8. Icon state

- Default: extension icon shows “off” state.
- After any intercepted wallet activity on a tab: icon switches to “on” state (if different assets are provided for on/off).

## Troubleshooting

- **No feed items:** Ensure the site actually calls `ethereum.request(...)`. Some sites inject wallets after load; try refreshing and connecting again.
- **Popup shows “Inactive”:** The content script may not have loaded (e.g. restricted page). Try a normal HTTPS dApp.
- **ENS not resolving:** ENS resolution uses Ethereum mainnet (chainId 1). The popup uses a public RPC; if it’s rate-limited, resolution may be slow or fail.
- **No Risk / ENS from backend:** Ensure the backend is running at `http://localhost:3000` and the extension was built without overriding `VITE_ENSIGHT_API_URL`. Check the backend terminal for errors. For risk, Redis must be configured and the ScamSniffer cron (or a manual sync) must have run.
- **Graph empty:** Risk and graph use Redis. If Redis is not configured, the backend accepts graph writes but returns empty/stub data for graph reads.

## Running tests

```bash
pnpm test
```

This runs unit and integration tests for session logic (kind/severity/one-liner, event → session, serialization) and type helpers.
