# ENSight Extension - Quick Reference

**For AI Assistants & Future Prompts**

---

## What is ENSight Extension?

A Chrome extension that **intercepts Ethereum wallet transactions** and explains them in human-readable terms before users sign.

**Current Status**: 🟢 **Interception Phase** - Intercepts connect/sign/tx/chain; per-tab feed; popup shows activity; backend risk client ready

---

## Key Architecture Components

| Component | File | Purpose | Context |
|-----------|------|---------|---------|
| **Page Script** | `ethereum-main-world.ts` | Patch `ethereum.request`; emit ETHEREUM_ACTIVE / ETHEREUM_REQUEST | Page JS world |
| **Content Script** | `content/index.ts` | Bridge layer | Isolated world |
| **Background Worker** | `background/index.ts` | Central brain | Service worker |
| **Popup UI** | `popup/App.tsx` | Extension UI | React popup |

---

## Message Flow

```
Page: ethereum.request patched → postMessage(ETHEREUM_ACTIVE / ETHEREUM_REQUEST)
  ↓
Content Script → sendMessage(ENSIGHT/ETH_ACTIVE | ENSIGHT/ETH_REQUEST)
  ↓
Background: upsertFromEvent(); persistSession(); setTabIcon
  ↑
Popup: GET_ACTIVE_SESSION → session (feed, counts)
```

---

## Inputs / Outputs

- **Inputs**: `window.ethereum.request` (connect, sign, tx, chain methods); high-signal methods only (see content script).
- **Outputs**: Per-tab session (feed, counts, hostname); persisted to storage; popup shows one-liners + details. Backend: `getRiskForAddress(addr)` → `{ flagged, lastUpdated }` when API base URL set.

See **INPUT-OUTPUT-SPEC.md** and **utils/messages.ts** for exact message types and payloads.

---

## Technical Stack

```yaml
Framework: WXT (browser extension framework)
UI: React 19 + TypeScript
Build Tool: WXT bundler
Package Manager: pnpm
Target: Chrome Manifest V3
```

---

## File Structure Quick Map

```
entrypoints/
  background/index.ts    → Service worker, message handler
  content/index.ts       → Injects detector, forwards messages
  ethereum-main-world.ts → Detects window.ethereum
  popup/                 → React UI (unused currently)

utils/
  ethMethods.ts          → Ethereum method definitions (stub)
  messages.ts            → Message types (stub)
  riskRules.ts           → Risk heuristics (stub)
```

---

## Development Commands

```bash
pnpm dev              # Start dev mode with hot reload
pnpm build            # Production build
pnpm compile          # Type check only
```

**Load in Chrome**: `chrome://extensions/` → Load unpacked → `.output/chrome-mv3`

---

## Critical Configuration

**WXT Config** (`wxt.config.ts`):
```typescript
manifest: {
  web_accessible_resources: [
    {
      resources: ["ethereum-main-world.js"],  // Required for page injection
      matches: ["<all_urls>"],
    },
  ],
}
```

---

## What Works ✅

- Detects wallet providers on any website
- Handles async wallet injection (MetaMask)
- Cross-context messaging (page → content → background)
- Development hot reload
- TypeScript type checking

---

## What Doesn't Work ❌

- Transaction interception (only detects wallet presence)
- Intent parsing/explanation
- Risk analysis
- Side panel UI
- Backend integration
- User settings

---

## Common Development Patterns

### Adding a New Message Type

1. Define in `utils/messages.ts`:
```typescript
type NewMessage = {
  type: "ENSIGHT/NEW_EVENT";
  data: SomeType;
}
```

2. Send from content script:
```typescript
browser.runtime.sendMessage({
  type: "ENSIGHT/NEW_EVENT",
  data: someData
});
```

3. Handle in background:
```typescript
browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "ENSIGHT/NEW_EVENT") {
    console.log("Got new event", msg.data);
    return Promise.resolve({ ok: true });
  }
});
```

### Injecting into Page Context

Content scripts can't see `window.ethereum`. Must inject:

```typescript
// In content script
await injectScript("/my-page-script.js", { keepInDom: true });

// Create entrypoints/my-page-script.ts
export default defineUnlistedScript(() => {
  // This runs in page context
  console.log(window.ethereum); // ✅ Can see it now
  window.postMessage({ type: "RESULT" }, "*");
});

// Add to wxt.config.ts
manifest: {
  web_accessible_resources: [{
    resources: ["my-page-script.js"],
    matches: ["<all_urls>"]
  }]
}
```

---

## Integration Points

### With Backend (`ensight-backend`)
- **Not yet connected**
- **Future**: Send transaction data for enrichment
- **Expected endpoint**: `POST /api/analyze-transaction`

### With Web (`ensight-web`)
- **No direct integration**
- **Future**: Link to dashboard for historical view

---

## Security Considerations

- **No private keys accessed** - Extension never handles keys
- **Read-only** (currently) - Only observes, doesn't modify
- **Optional backend** - Can run client-side only
- **Sanitized logs** - No sensitive data in console

---

## Testing on Real Dapps

**Recommended Test Sites**:
- Uniswap: https://app.uniswap.org
- OpenSea: https://opensea.io
- Aave: https://app.aave.com

**What to Check**:
1. Console shows "wallet provider detected!" ✓
2. Service Worker logs "got ETH_DETECTED" ✓
3. No errors in DevTools ✓

---

## Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| Wallet not detected | Check wallet extension enabled + reload page |
| Content script not loading | Reload extension in `chrome://extensions/` |
| postMessage not working | Ensure listener registered before inject |
| Build errors | Run `pnpm compile` to see TypeScript errors |

---

## Future Development Priority

1. **Next**: Intercept `eth_sendTransaction` calls
2. **Then**: Parse transaction parameters
3. **Then**: Implement side panel UI
4. **Finally**: Connect to backend for enrichment

---

## When Working on This Extension

### Always Remember:
- Content scripts ≠ page context (different JS worlds)
- Messages flow: Page → Content → Background
- `web_accessible_resources` required for page injection
- WXT auto-reloads on file changes

### Before Adding Features:
- Check if function belongs in page context or content script
- Update message type definitions in `utils/messages.ts`
- Add console logs for debugging
- Update this documentation

### Code Style:
- Message types: `ENSIGHT/EVENT_NAME`
- File comments: Explain purpose at top
- Commits: Follow existing style (see `shernan-notes.md`)

---

**Quick Links**:
- Full documentation: `DOCUMENTATION.md`
- Developer notes: `shernan-notes.md`
- Build config: `wxt.config.ts`

**Last Updated**: 2026-02-05
