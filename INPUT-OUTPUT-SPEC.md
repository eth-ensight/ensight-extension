# ENSight Extension - Input/Output Specification

**Version**: 1.0.0
**Last Updated**: 2026-02-05
**Status**: Detection Phase Only

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
{
  type: "ENSIGHT/CONTENT_LOADED",
  url: string                    // Current page URL
}

// Wallet provider detected
{
  type: "ENSIGHT/ETH_DETECTED",
  url: string                    // Page where detected
}
```

#### From Background → Content (Acknowledgments):
```typescript
{
  ok: boolean,
  type: "CONTENT_LOADED_ACK" | "ETH_DETECTED_ACK"
}
```

---

### 4. Page-to-Extension Communication

**Source**: Injected page script
**Protocol**: `window.postMessage`

**Expected Messages**:
```typescript
{
  ensight: true,                 // Namespace flag
  type: "ETHEREUM_DETECTED"      // Event type
}
```

**Security Filter**:
```typescript
// Content script validates:
event.source === window         // Must be from same window
data?.ensight === true          // Must have namespace
```

---

### 5. Future Inputs (Not Yet Implemented)

#### Wallet Method Calls to Intercept:
```typescript
// Transaction submission
window.ethereum.request({
  method: "eth_sendTransaction",
  params: [{
    from: "0x...",
    to: "0x...",
    data: "0x...",
    value: "0x...",
    gas: "0x..."
  }]
})

// Typed data signing (permits, approvals)
window.ethereum.request({
  method: "eth_signTypedData_v4",
  params: [address, typedData]
})

// Personal message signing
window.ethereum.request({
  method: "personal_sign",
  params: [message, address]
})

// Account access request
window.ethereum.request({
  method: "eth_requestAccounts"
})
```

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

**Internal State** (not persisted yet):
```typescript
// Conceptual state structure (not implemented)
{
  tabs: {
    [tabId: number]: {
      hasWallet: boolean,
      url: string,
      lastDetection: timestamp
    }
  }
}
```

**Current Implementation**: Stateless (logs only)

---

### 4. User Interface (Future)

**Planned Outputs**:

#### Side Panel Display:
```
┌─────────────────────────────┐
│ ⚠️ Transaction Detected     │
├─────────────────────────────┤
│                             │
│ You're about to:            │
│ • Swap 100 USDC for ETH     │
│                             │
│ Risk Level: 🟢 Low          │
│                             │
│ Contract: Uniswap V3 Router │
│ ✓ Verified                  │
│                             │
│ [Approve] [Reject]          │
└─────────────────────────────┘
```

#### Popup Display:
```
ENSight Status

🟢 Active on 3 tabs
📊 12 transactions analyzed today
🛡️ 2 risky transactions blocked
```

---

### 5. Future: Backend API Calls (Not Implemented)

**Expected Request Format**:
```typescript
POST /api/analyze-transaction
Content-Type: application/json

{
  method: "eth_sendTransaction",
  params: [...],
  origin: "https://app.uniswap.org",
  chainId: 1,
  timestamp: 1234567890
}
```

**Expected Response**:
```typescript
{
  intent: "Swap 100 USDC for ETH on Uniswap V3",
  risk: {
    level: "low" | "medium" | "high",
    score: 0.15,
    factors: [
      "Contract is verified ✓",
      "Normal gas usage ✓",
      "Reasonable token amounts ✓"
    ]
  },
  context: {
    contractName: "Uniswap V3 Router",
    contractVerified: true,
    tokenSymbols: ["USDC", "WETH"],
    estimatedImpact: "$350.50"
  }
}
```

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

#### ✅ Successful Detection:
1. Load extension in Chrome
2. Navigate to Uniswap (https://app.uniswap.org)
3. Open DevTools Console
4. See: `"ENSight: wallet provider detected!"`
5. Check Service Worker logs
6. See: `"ensight: got ETH_DETECTED <url>"`

#### ❌ Failed Detection Scenarios:
| Scenario | Expected Behavior |
|----------|-------------------|
| No wallet installed | No detection logs (correct) |
| Wallet disabled | No detection logs (correct) |
| Non-Web3 site | Content script runs, no wallet (correct) |
| CSP blocked injection | Error in console (investigate) |

---

### Manual Test Checklist

```
[ ] Extension loads without errors
[ ] Content script injects on all pages
[ ] MetaMask detected on Uniswap ✓
[ ] Coinbase Wallet detected on OpenSea ✓
[ ] No false positives on non-Web3 sites ✓
[ ] Background worker receives messages ✓
[ ] Acknowledgments returned to content script ✓
[ ] No memory leaks after 10 page loads ✓
[ ] Works on async wallet injection ✓
[ ] Handles rapid tab switching ✓
```

---

## 🔄 DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                         Web Page                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Page Context (Website's JS World)                 │     │
│  │                                                     │     │
│  │  window.ethereum ← Injected by Wallet Extension    │     │
│  │         ↓                                           │     │
│  │  ethereum-main-world.ts (ENSight detector)         │     │
│  │         ↓                                           │     │
│  │  window.postMessage({ type: "ETHEREUM_DETECTED" }) │     │
│  └────────────────────────────────────────────────────┘     │
│                         ↓                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Content Script (Isolated JS World)                │     │
│  │                                                     │     │
│  │  Receives postMessage                              │     │
│  │         ↓                                           │     │
│  │  browser.runtime.sendMessage({                     │     │
│  │    type: "ENSIGHT/ETH_DETECTED"                    │     │
│  │  })                                                 │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│             Extension Background (Service Worker)           │
│                                                              │
│  onMessage.addListener((msg) => {                           │
│    if (msg.type === "ENSIGHT/ETH_DETECTED") {               │
│      console.log("Wallet detected on:", msg.url)            │
│      // Future: Open side panel, analyze intent             │
│    }                                                         │
│  })                                                          │
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
