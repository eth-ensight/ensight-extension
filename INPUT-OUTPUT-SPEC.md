# ENSight Extension - Input/Output Specification

**Version**: 1.1.0
**Last Updated**: 2026-02-08
**Status**: Interception Phase — wallet request lifecycle observed; per-tab feed; popup shows activity; backend risk API client ready.

---

## Purpose

This document clearly defines what the ENSight Extension **expects as input**, what it **produces as output**, and what **requirements must be met** for proper operation.

---

## 📥 INPUTS

### 1. Wallet Provider Object

**Source**: Web page's `window` object
**Location**: `window.ethereum`
**Type**: EIP-1193 Ethereum Provider

**Required Properties**:
```typescript
interface EthereumProvider {
  // Core method (required)
  request(args: RequestArguments): Promise<any>;

  // Event system (required)
  on(event: string, handler: Function): void;
  removeListener(event: string, handler: Function): void;

  // Optional provider identifiers
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  // ... other wallet flags
}

interface RequestArguments {
  method: string;
  params?: any[];
}
```

**Detection Criteria**:
- Object exists at `window.ethereum`
- Has callable `request` method
- May be injected sync (immediate) or async (delayed up to 3s)
- May trigger `ethereum#initialized` event (MetaMask)

**Supported Wallets** (any EIP-1193 compliant):
- ✅ MetaMask
- ✅ Coinbase Wallet
- ✅ Rainbow Wallet
- ✅ Rabby Wallet
- ✅ Trust Wallet
- ✅ Any EIP-1193 provider

---

### 2. Web Page URLs

**Source**: Browser tab navigation
**Format**: Any valid HTTP(S) URL
**Scope**: All URLs (`<all_urls>` permission)

**Content Script Injection Rules**:
```typescript
matches: ["<all_urls>"]        // Inject on ALL websites
runAt: "document_start"         // Inject before page loads
```

**Why All URLs**:
- Cannot predict which sites will have wallets
- Dapps can be on any domain
- Detection is lightweight (minimal overhead)

---

### 3. Browser Extension Messages (Internal)

**Source**: Cross-extension communication
**Protocol**: Chrome Extension Message Passing API

**Expected Message Types**:

#### From Content Script → Background:
```typescript
// Content script initialized
{ type: "ENSIGHT/CONTENT_LOADED", url: string }

// First real wallet usage on page (ethereum.request called)
{ type: "ENSIGHT/ETH_ACTIVE", url: string }

// Each intercepted wallet request (before/after/error)
{ type: "ENSIGHT/ETH_REQUEST", event: EthereumRequestEvent }
// event: { id, phase: "before"|"after"|"error", method, params?, page?, summary?, ... }
```

#### From Popup → Background (requests):
```typescript
{ type: "ENSIGHT/GET_ACTIVE_SESSION" }   // Session for active tab (fallback to storage)
{ type: "ENSIGHT/GET_SESSION", tabId: number }
{ type: "ENSIGHT/GET_LAST_SESSION" }
{ type: "ENSIGHT/GET_EVENTS" }            // Legacy debug
{ type: "ENSIGHT/DEBUG_ALL_SESSIONS" }
```

#### Background → Content / Popup (responses):
```typescript
{ ok: true }
{ ok: true, session: SerializedSession | null }
{ ok: true, all: Array<{ tabId, isActive, hostname, counts, feedLen }> }
```

---

### 4. Page-to-Extension Communication

**Source**: Injected page script (`ethereum-main-world.ts`)
**Protocol**: `window.postMessage` (all payloads include `ensight: true`)

**Expected Messages**:
```typescript
// First time a wallet request is made on the page
{ ensight: true, type: "ETHEREUM_ACTIVE" }

// Every intercepted ethereum.request (high-signal methods only)
{
  ensight: true,
  type: "ETHEREUM_REQUEST",
  id: string,                    // Ties before/after/error together
  phase: "before" | "after" | "error",
  ts?: number,
  method: string,
  params?: any[],
  page?: { url, hostname, title },
  summary?: { kind, to?, value?, hasData?, chainId? },
  durationMs?: number,
  ok?: boolean,
  error?: { name, message },
  resultSummary?: any
}
```

**Security Filter**:
```typescript
event.source === window && data?.ensight === true
```

**High-signal methods** (content script forwards only these): `eth_requestAccounts`, `eth_sendTransaction`, `eth_sign`, `personal_sign`, `eth_signTypedData*`, `wallet_switchEthereumChain`, `wallet_addEthereumChain`.

---

### 5. Backend API (Extension → ensight-backend)

**Configuration**: API base URL is stored in `browser.storage.local` under key `ensight:apiBaseUrl`. If not set, no backend calls are made.

**Risk lookup (implemented)** — see `utils/backend.ts`:

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/api/risk/address/:address` | GET | Path param: Ethereum address (0x-prefixed, 42 chars) | `{ flagged: boolean, lastUpdated: number \| null }` |

- **Extension client**: `getRiskForAddress(address)` → returns `RiskAddressResponse \| null` (null if backend not configured or request fails).
- **Setting base URL**: `setApiBaseUrl(url)` / `getApiBaseUrl()` from `utils/backend.ts`.

---

## 📤 OUTPUTS

### 1. Console Logs (Development)

**Content Script Logs**:
```javascript
// On injection
"ENSight: content script running <url>"

// On wallet detection
"ENSight: wallet provider detected!"

// On background acknowledgment
"ENSight: background ack { ok: true, type: 'ETH_DETECTED_ACK' }"

// On errors
"ENSight: failed to message background <error>"
"ENSight: CONTENT_LOADED failed <error>"
```

**Background Worker Logs**:
```javascript
// On initialization
"ensight: background running..."

// On message receipt
"ensight: got CONTENT_LOADED <url>"
"ensight: got ETH_DETECTED <url>"
```

**Page Context Logs**: None (silent detection)

---

### 2. Extension Messages (Internal Communication)

**Background → Content Acknowledgments**:
```typescript
{
  ok: true,
  type: "ETH_DETECTED_ACK"
}

{
  ok: true,
  type: "CONTENT_LOADED_ACK"
}
```

**Promise Resolution**:
- All messages return Promises
- Acknowledgments resolve within ~10ms
- Failed sends throw exception (logged)

---

### 3. State Changes (Background Worker)

**Per-tab session** (in memory + persisted to `browser.storage.local` after each ETH_ACTIVE and each ETH_REQUEST):
```typescript
{
  tabId: number,
  isActive: boolean,
  lastSeenAt: number,
  hostname?: string,
  title?: string,
  counts: { connect, sign, tx, chain, unknown },
  feed: RequestRecord[],   // Newest first, max 50; each has id, method, kind, severity, phase, oneLiner, ...
  byId: Record<string, RequestRecord>
}
```
Storage key: `ensight:session:${tabId}`. Session is cleared on tab navigation (loading) or tab close.

---

### 4. User Interface (Popup)

**Popup** requests `ENSIGHT/GET_ACTIVE_SESSION` and displays:
- Header: hostname, "web3 active" / "inactive", last seen time
- Counts: connect, sign, tx, chain
- Activity feed: one-liners per request, severity pills, expandable details (method, phase, to, value, hasData, chainId, error, paramsPreview)
- Refresh button (re-requests GET_ACTIVE_SESSION)

**Tab icon**: Off (normal) vs on (web3-active tab).

---

## ⚙️ REQUIREMENTS

### Development Requirements

#### Software Prerequisites:
```yaml
Node.js: >= 18.0.0
Package Manager: pnpm (required, not npm/yarn)
TypeScript: ^5.9.3
Git: Any recent version
```

#### Installation:
```bash
git clone <repo-url>
cd ensight-extension
pnpm install
pnpm dev
```

---

### Runtime Requirements

#### Browser:
- **Chrome/Chromium**: >= 88 (Manifest V3 support)
- **Edge**: >= 88
- **Brave**: Any recent version
- **Firefox**: Not yet supported (requires config changes)

#### Permissions Declared:
```json
{
  "permissions": [],
  "host_permissions": ["<all_urls>"]
}
```

**Why `<all_urls>`**: Must inject on any site that might have a wallet

---

### Wallet Requirements

**Wallet Must Provide**:
- EIP-1193 compliant `window.ethereum` object
- `request()` method for JSON-RPC calls
- Event emitters (`on`, `removeListener`)

**Wallet Injection Timing**:
- Must inject within 3 seconds of page load
- OR emit `ethereum#initialized` event
- OR be present at `document_start`

**No Wallet Modifications Required**:
- Extension is read-only observer
- Wallets function normally
- No SDK changes needed

---

### Page Requirements

**Compatible Pages**:
- Any HTTP(S) webpage
- Pages with or without wallet providers
- Single-page apps (React, Vue, etc.)
- Multi-page apps

**Incompatible Pages**:
- `chrome://` internal pages (cannot inject)
- `file://` local files (requires permission)
- Sandboxed iframes (CSP restrictions)

**No Server-Side Changes Required**:
- Works with any dapp without modification
- Passive observation only

---

### Security Requirements

**Extension Must**:
- ✅ Never access private keys
- ✅ Never modify transaction data
- ✅ Never send data to third parties without user consent
- ✅ Sanitize all logged data
- ✅ Validate all message sources

**Content Security Policy**:
- Respects page CSP headers
- Uses web-accessible resources for injection
- No eval() or inline scripts

---

### Performance Requirements

**Resource Limits**:
- Content script injection: < 10ms
- Wallet detection: < 3 seconds max
- Message passing: < 50ms roundtrip
- Memory footprint: < 10MB per tab

**User Experience**:
- No visible UI changes (unless wallet action detected)
- No page load delay
- No impact on wallet functionality

---

## 🧪 VALIDATION CRITERIA

### How to Know It's Working

#### ✅ Successful interception and UI:
1. Load extension in Chrome (`pnpm dev` in ensight-extension).
2. Navigate to a dApp (e.g. https://app.uniswap.org) and connect wallet or trigger a tx/sign.
3. Extension icon for that tab turns "on".
4. Open popup (click extension icon): see hostname, "web3 active", counts, and feed of requests (connect/sign/tx/chain) with one-liners and expandable details.
5. After closing popup and re-opening, session still shown (persisted to storage).

#### ❌ Failed scenarios:
| Scenario | Expected Behavior |
|----------|-------------------|
| No wallet installed | No feed (correct) |
| Non-Web3 site | Content script runs, no wallet activity (correct) |
| CSP blocked injection | Page script may not load; check console |

---

### Manual Test Checklist

```
[ ] Extension loads without errors (pnpm dev)
[ ] Content script injects on all pages
[ ] On dApp: connect/sign/tx/chain appear in popup feed ✓
[ ] Tab icon turns "on" when wallet used on that tab ✓
[ ] Popup shows GET_ACTIVE_SESSION session (counts + feed) ✓
[ ] After worker restart, popup still shows last session (storage fallback) ✓
[ ] Backend: setApiBaseUrl() then getRiskForAddress(addr) returns { flagged, lastUpdated } when backend is up ✓
```

---

## 🔄 DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                         Web Page                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Page Context: ethereum-main-world.ts               │     │
│  │  Patches window.ethereum.request                   │     │
│  │  → postMessage ETHEREUM_ACTIVE (first use)         │     │
│  │  → postMessage ETHEREUM_REQUEST (before/after/error)│     │
│  └────────────────────────────────────────────────────┘     │
│                         ↓                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Content Script                                    │     │
│  │  Forwards ENSIGHT/ETH_ACTIVE, ENSIGHT/ETH_REQUEST  │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│             Background (Service Worker)                      │
│  Per-tab sessions; upsertFromEvent(); persistSession();      │
│  Handles GET_ACTIVE_SESSION, GET_SESSION (serialized feed)   │
└─────────────────────────────────────────────────────────────┘
                         ↑
┌─────────────────────────────────────────────────────────────┐
│  Popup  → GET_ACTIVE_SESSION → session (feed, counts, etc.)  │
│  Optional: getRiskForAddress(to) via utils/backend.ts        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 QUICK REFERENCE CHECKLIST

### When Adding New Features

**Inputs to Consider**:
- [ ] What message type does this need?
- [ ] Where does data originate (page/content/background)?
- [ ] What validation is required?
- [ ] Is user consent needed?

**Outputs to Define**:
- [ ] What console logs for debugging?
- [ ] What messages to send?
- [ ] What UI changes?
- [ ] What state updates?

**Requirements to Check**:
- [ ] Does it need new permissions?
- [ ] Will it impact performance?
- [ ] Is it secure (no PII leaks)?
- [ ] Is it tested on real dapps?

---

**End of Specification**

For implementation details, see: `DOCUMENTATION.md`
For quick development tips, see: `QUICK-REFERENCE.md`
For developer thought process, see: `shernan-notes.md`
