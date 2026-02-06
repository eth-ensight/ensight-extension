# ENSight Extension - Technical Documentation

## Overview

ENSight Extension is a Chrome browser extension that acts as a **real-time perception layer for Ethereum**, intercepting wallet actions and providing users with clear explanations of transaction intent, risk assessment, and contextual information before they sign transactions.

**Purpose**: Give Web3 users clarity and safety by explaining what wallet transactions will do in human-readable terms before execution.

---

## Architecture

### Component Structure

The extension is built using **WXT** (a modern framework for browser extensions) with **React** and **TypeScript**.

```
ensight-extension/
├── entrypoints/           # Extension entry points
│   ├── background/        # Service worker (brain)
│   ├── content/          # Content script (observer)
│   ├── ethereum-main-world.ts  # Page context detector
│   └── popup/            # Extension popup UI
├── utils/                # Utilities and helpers
│   ├── ethMethods.ts     # Ethereum method definitions
│   ├── messages.ts       # Message type definitions
│   ├── riskRules.ts      # Risk assessment heuristics
│   └── format.ts         # Formatting utilities
├── public/               # Static assets
└── assets/               # Images and media
```

### Three-Layer Architecture

#### 1. **Page Context Layer** (`ethereum-main-world.ts`)
- **Purpose**: Detect wallet providers injected by browser extensions (MetaMask, Coinbase Wallet, etc.)
- **Runs in**: Page's JavaScript context (NOT extension isolated context)
- **Why**: Wallets inject `window.ethereum` into the page's JS world, which is invisible to content scripts
- **Detection Strategy**:
  - Immediately checks for `window.ethereum`
  - Polls every 50ms for up to 3 seconds if not found
  - Listens for `ethereum#initialized` event (MetaMask async injection)
  - Sends `ETHEREUM_DETECTED` message via `window.postMessage` when found

#### 2. **Content Script Layer** (`entrypoints/content/index.ts`)
- **Purpose**: Bridge between page context and extension background
- **Runs in**: Content script isolated world
- **Responsibilities**:
  - Injects the page context detector script
  - Listens for `window.postMessage` events from page context
  - Forwards wallet detection events to background service worker
  - (Future) Intercepts wallet method calls and extracts transaction intent

**Message Flow**:
```
Page detects wallet → postMessage → Content Script → runtime.sendMessage → Background
```

#### 3. **Background Service Worker** (`entrypoints/background/index.ts`)
- **Purpose**: Central coordination and state management
- **Runs in**: Service worker context (persistent in Chrome)
- **Responsibilities**:
  - Receives messages from content scripts across all tabs
  - Associates wallet activity with specific browser tabs
  - Coordinates UI updates (future: opens side panel)
  - (Future) Communicates with backend for risk analysis

**Current Message Handlers**:
- `ENSIGHT/CONTENT_LOADED`: Acknowledges content script initialization
- `ENSIGHT/ETH_DETECTED`: Acknowledges wallet provider detection

---

## Input Specifications

### 1. Wallet Provider Detection

**Input**: `window.ethereum` object presence on web pages

**Expected Provider Properties** (standard EIP-1193):
```typescript
interface EthereumProvider {
  request(args: { method: string; params?: any[] }): Promise<any>;
  on(event: string, handler: Function): void;
  removeListener(event: string, handler: Function): void;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  // ... other provider-specific flags
}
```

**Detection Triggers**:
- Provider exists at page load
- Provider injected asynchronously (within 3 seconds)
- `ethereum#initialized` event fired

### 2. Wallet Method Calls (Future)

**Expected Intercepts** (currently stubbed, not implemented):
- `eth_requestAccounts` - Connect wallet request
- `eth_sendTransaction` - Transaction submission
- `eth_signTypedData_v4` - Typed data signing (permits, approvals)
- `personal_sign` - Message signing
- `wallet_switchEthereumChain` - Network switching
- `wallet_addEthereumChain` - Add custom network

**Message Format**:
```typescript
{
  method: string;        // e.g., "eth_sendTransaction"
  params: any[];         // Method-specific parameters
  origin: string;        // Website origin
  timestamp: number;     // When intercepted
}
```

---

## Output Specifications

### 1. Console Logs (Current Implementation)

**Content Script Output**:
```
ENSight: content script running <url>
ENSight: wallet provider detected!
ENSight: background ack { ok: true, type: "ETH_DETECTED_ACK" }
```

**Background Worker Output**:
```
ensight: background running...
ensight: got CONTENT_LOADED <url>
ensight: got ETH_DETECTED <url>
```

### 2. Message Protocol

**Message Types**:

**Content → Background**:
```typescript
{
  type: "ENSIGHT/CONTENT_LOADED";
  url: string;
}

{
  type: "ENSIGHT/ETH_DETECTED";
  url: string;
}
```

**Background → Content (Acknowledgments)**:
```typescript
{
  ok: boolean;
  type: "CONTENT_LOADED_ACK" | "ETH_DETECTED_ACK";
}
```

### 3. User Interface (Future)

**Planned Outputs**:
- **Side Panel**: Opens automatically when wallet action detected
- **Intent Explanation**: Human-readable description of what transaction will do
- **Risk Assessment**: Color-coded risk level (low/medium/high)
- **Context Information**: Contract details, token info, historical behavior

---

## Technical Requirements

### Development Environment

**Prerequisites**:
```bash
Node.js: >= 18.x
Package Manager: pnpm
TypeScript: ^5.9.3
```

**Core Dependencies**:
- `wxt@^0.20.6` - Browser extension framework
- `react@^19.2.3` - UI framework
- `react-dom@^19.2.3` - React DOM rendering
- `@wxt-dev/module-react@^1.1.5` - WXT React integration

### Build Configuration

**WXT Config** (`wxt.config.ts`):
```typescript
{
  modules: ['@wxt-dev/module-react'],
  manifest: {
    web_accessible_resources: [
      {
        resources: ["ethereum-main-world.js"],  // Allows page context injection
        matches: ["<all_urls>"],
      },
    ],
  },
  webExt: {
    disabled: true,  // Disables automatic Firefox testing
  }
}
```

### Browser Compatibility

**Primary Target**: Chrome/Chromium-based browsers
- Chrome >= 88 (Manifest V3 support)
- Edge >= 88
- Brave (Chromium-based)

**Future Support**: Firefox (requires build configuration changes)

---

## Development Workflow

### Available Scripts

```bash
# Development with hot reload
pnpm dev                 # Chrome development mode
pnpm dev:firefox        # Firefox development mode

# Production builds
pnpm build              # Build for Chrome
pnpm build:firefox      # Build for Firefox

# Distribution
pnpm zip                # Create Chrome extension zip
pnpm zip:firefox        # Create Firefox extension zip

# Type checking
pnpm compile            # TypeScript type checking (no emit)
```

### Development Mode

1. **Start development server**:
   ```bash
   pnpm dev
   ```

2. **Load unpacked extension in Chrome**:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `.output/chrome-mv3` directory

3. **Testing**:
   - Visit any Web3 dapp (e.g., Uniswap, OpenSea)
   - Open DevTools Console to see detection logs
   - Check extension Service Worker logs in `chrome://extensions/`

### File Watching

WXT automatically watches:
- All files in `entrypoints/`
- All files in `utils/`
- `wxt.config.ts`
- `package.json`

Changes trigger automatic rebuild and extension reload.

---

## Key Concepts & Terminology

### Content Script vs Page Context

**Content Script**:
- Runs in isolated JavaScript world
- Has access to Chrome extension APIs
- Cannot see page's `window.ethereum` directly
- Can manipulate DOM but not page JavaScript

**Page Context**:
- Runs in same JavaScript world as website code
- Can see `window.ethereum` and other page globals
- Cannot access Chrome extension APIs directly
- Must use `window.postMessage` to communicate

### Message Passing Flow

```
Page Context (ethereum-main-world.ts)
    ↓ window.postMessage
Content Script (content/index.ts)
    ↓ browser.runtime.sendMessage
Background Worker (background/index.ts)
```

### WXT Framework Helpers

**`defineContentScript()`**:
- Declares a file as a content script
- `matches`: URL patterns to inject on
- `runAt`: When to inject (`document_start`, `document_end`, `document_idle`)

**`defineBackground()`**:
- Declares service worker/background script
- Persistent event handlers

**`defineUnlistedScript()`**:
- Creates script not auto-listed in manifest
- Must be declared in `web_accessible_resources`
- Used for page context injection

**`injectScript()`**:
- Injects web-accessible resource into page
- `keepInDom`: Whether to remove `<script>` tag after execution

---

## Security Model

### Privacy & Security Guarantees

✅ **Read-only interception** - No modification of wallet calls (yet)
✅ **No private key access** - Extension never handles keys
✅ **Optional backend** - Can run fully client-side
✅ **Sanitized payloads** - No sensitive data logged

### Permissions Required

**Current**:
- `<all_urls>` - Inject on all websites to detect wallets

**Future** (when intercept implemented):
- `storage` - Cache risk assessments
- `sidePanel` - Display transaction explanations
- (Optional) `<backend-url>` - For enriched analysis

---

## Current Limitations

### What's Implemented ✅
- Wallet provider detection (`window.ethereum`)
- Cross-context messaging (page → content → background)
- React-based popup UI scaffold
- Development/build tooling

### What's Not Implemented ❌
- **Wallet method interception** - Currently only detects, doesn't intercept `eth_sendTransaction`, etc.
- **Transaction parsing** - No ABI decoding or intent extraction
- **Risk analysis** - Heuristic rules stubbed but not active
- **Side panel UI** - Popup exists but side panel not implemented
- **Backend integration** - No API calls for enriched data
- **User preferences** - No settings/configuration

---

## Future Development Roadmap

### Phase 1: Detection (Current)
- [x] Detect wallet providers
- [x] Message passing infrastructure
- [ ] Log detected methods for analysis

### Phase 2: Interception
- [ ] Proxy `window.ethereum.request()`
- [ ] Extract transaction parameters
- [ ] Parse contract ABIs
- [ ] Decode function calls

### Phase 3: Analysis
- [ ] Client-side risk heuristics
- [ ] Backend API integration
- [ ] Historical contract behavior lookup
- [ ] Token approval analysis

### Phase 4: UI/UX
- [ ] Side panel automatic opening
- [ ] Human-readable transaction explanations
- [ ] Visual risk indicators
- [ ] User approval/rejection flow

---

## Integration with ENSight Ecosystem

### Relationship to Other Components

**ensight-extension** (this repo):
- Client-side perception layer
- Captures wallet intent in real-time
- Presents analysis results to users

**ensight-backend** (separate repo):
- Enrichment layer for transaction analysis
- Contract metadata lookup
- Historical behavior database
- Machine learning risk models

**ensight-web** (separate repo):
- Marketing/landing page
- Dashboard for historical activity
- Public API documentation

### Data Flow (Future)
```
User clicks "Sign" on dapp
    ↓
Extension intercepts eth_sendTransaction
    ↓
Extension parses transaction parameters
    ↓
Extension sends to ensight-backend for analysis
    ↓
Backend returns: intent, risk, context
    ↓
Extension displays in side panel
    ↓
User approves/rejects with full context
```

---

## Testing & Validation

### Manual Testing Checklist

**Wallet Detection**:
- [ ] Load extension on Uniswap - detects MetaMask ✓
- [ ] Load extension on OpenSea - detects Coinbase Wallet ✓
- [ ] Load extension on regular website - no false positives ✓
- [ ] Test async injection (disable wallet, enable after page load) ✓

**Message Passing**:
- [ ] Verify `ENSIGHT/CONTENT_LOADED` logs in Service Worker ✓
- [ ] Verify `ENSIGHT/ETH_DETECTED` logs in Service Worker ✓
- [ ] Verify acknowledgment messages received in Content Script ✓

**Browser Compatibility**:
- [ ] Chrome stable
- [ ] Chrome Canary
- [ ] Edge
- [ ] Brave

### Automated Testing (Not Yet Implemented)
- Unit tests for utility functions
- Integration tests for message passing
- E2E tests with Playwright + dapp simulator

---

## Troubleshooting

### Extension not detecting wallet

**Symptoms**: No "wallet provider detected!" log in console

**Causes**:
1. Wallet extension not enabled
2. Page loads before wallet injection complete
3. Content script not injected (check manifest)

**Solutions**:
- Ensure wallet extension is active
- Check `chrome://extensions/` for errors
- Verify content script injected: see "ENSight: content script running"
- Increase polling timeout in `ethereum-main-world.ts` (currently 3s)

### Content script not loading

**Symptoms**: No console logs from `content/index.ts`

**Solutions**:
- Reload extension in `chrome://extensions/`
- Check `matches: ["<all_urls>"]` in content script definition
- Verify no CSP errors in DevTools Console
- Check Service Worker for errors

### postMessage not received

**Symptoms**: Page detects wallet but content script doesn't receive message

**Solutions**:
- Verify `event.source === window` check in listener
- Check message listener registered before script injection
- Ensure `web_accessible_resources` includes `ethereum-main-world.js`

---

## Code Style & Conventions

### File Naming
- PascalCase for React components: `App.tsx`
- camelCase for utilities: `ethMethods.ts`
- kebab-case for scripts: `ethereum-main-world.ts`

### Message Types
- Namespace with `ENSIGHT/` prefix
- ALL_CAPS for event types: `ENSIGHT/ETH_DETECTED`
- Acknowledgments suffixed with `_ACK`

### Comments
- Inline explanatory comments for non-obvious logic
- Top-of-file purpose comments in all entrypoints
- TSDoc for public utilities (when implemented)

---

## References

### Standards & Specifications
- [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) - Ethereum Provider JavaScript API
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) - Typed Structured Data Hashing and Signing
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)

### Frameworks & Tools
- [WXT Documentation](https://wxt.dev/)
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)
- [React Documentation](https://react.dev/)

### Inspiration & Prior Art
- [Pocket Universe](https://www.pocketuniverse.app/) - Transaction simulation
- [Fire](https://www.joinfire.xyz/) - Wallet security
- [Wallet Guard](https://walletguard.app/) - Phishing protection

---

## Contact & Contribution

**Project**: ENSight
**Built at**: ETHGlobal HackMoney 2026
**License**: (TBD)

For questions about this extension, refer to the main ENSight ecosystem documentation or check `shernan-notes.md` for development thought process.

---

**Last Updated**: 2026-02-05
**Documentation Version**: 1.0.0
**Extension Version**: 0.0.0 (pre-release)
