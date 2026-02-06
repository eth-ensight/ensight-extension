# shernan's personal notes

goal: take notes and brainstorm using this file while making this app so you can see how i think lol

ALSO i ran out of cursor credits so im rawdogging building this entire app reading docs + chatgpt to teach me, lowkey goated method for learnmaxxing no cap.

---

## phase 1 - setting up the extension

prove WXT is building

* background runs
* content script injects on pages
* they can message each other

### background entrypoint

first i gotta make the background entrypoint

the background entrypoint is the extension's brain essentially which receives events, stores state, later calls backend

`src/entrypoints/background/index.ts` to see my changes

### content entrypoint

then i gotta make the content entrypoint

the content entrypoint is how we "sit inside" websites and observe wallet calls,
it runs inside browser tabs, can read page content and send messages back to the background.
this is the basis of being able to detect when a wallet is on the page

`src/entrypoints/content/index.ts` to see my code

* devtools console should show `ensight: content script running`
* service worker logs should show `ensight: content loaded`

`defineContentScript()` - marks this file as a content script
`matches: ["<all_urls>"]` - loads on every page
`runAt: "document_start"` - runs early

---

## phase 2 - detecting a wallet provider

goal: detect whether a wallet provider (metamask, coinbase wallet, etc) is injected on the page so ensight knows the site can make wallet calls.

most web3 dapps expose a global object like:

`window.ethereum`

if it exists, the site can call wallet methods such as:

* `eth_requestAccounts`
* `eth_sendTransaction`
* `personal_sign`

---

### ❌ broken approach (replaced)

initial implementation:

* checked `window.ethereum` directly inside the content script
* polled briefly in case the wallet injected late

this didn’t work reliably and took way too long to click

**why:** content scripts run in an isolated js world.
wallets inject into the page’s js context, so `window.ethereum` was often invisible to the extension.

---

### ✅ current approach (page-context injection)

fix:

* inject a small script directly into the page context
* that script checks for `window.ethereum`
* once found, it sends a message back to the content script
* content script forwards it to the background

flow:

1. content script injects page script
2. page script detects wallet provider
3. message sent via `window.postMessage`
4. background stores page-level wallet context

---

### what this unlocked

* reliable wallet detection on any dapp
* clean separation between page logic and extension logic
* foundation for intercepting wallet calls later

tldr: wallets live in the page’s js world, not the extension’s.
injecting into the page is the only reliable way to see them.

---

## phase 3 - intercept ethereum.request + emit intent events

goal: see **what the wallet is being asked to do**, on **what site**, and **when**, without breaking anything.
this is the perception layer before explanations, scoring, or social logic.

phase 2 answered:

> is there a wallet here?

phase 3 answers:

> what is this site asking the wallet to do right now?

---

### what we intercept (mvp)

we monkey-patch `ethereum.request` in the page context and watch high-signal methods only:

* `eth_requestAccounts`
* `eth_sendTransaction`
* `eth_sign`
* `personal_sign`
* `eth_signTypedData_v4`
* `wallet_switchEthereumChain`
* `wallet_addEthereumChain`

this covers:

* wallet connects
* signatures (where scams actually hide)
* value-moving transactions
* chain switching (common phishing vector)

---

### where interception lives (important)

this **must** run in the page’s js world.

final flow:

```
page js
→ ethereum-main-world.ts (patches ethereum.request)
→ window.postMessage
→ content script
→ browser.runtime.sendMessage
→ background service worker
```

why:

* content scripts cannot access `window.ethereum`
* wallets inject into the page, not the extension
* page-context injection is the only reliable option

---

### intercepting safely

rules:

* store the original `ethereum.request`
* wrap it
* emit events on start / success / failure
* never mutate args or return values

**observing, not modifying**

---

### event shape (intentionally lightweight)

no calldata decoding. no simulation.
just intent + context.

```ts
{
  type: "ETHEREUM_REQUEST",
  phase: "before" | "after" | "error",
  method: "eth_sendTransaction",
  summary: {
    kind: "tx",
    to: "0xabc…",
    value: "0.42",
    hasData: true
  },
  page: {
    hostname,
    url,
    title
  },
  ts
}
```

---

### background = event brain (for now)

current responsibilities:

* receive intent events
* associate them with a tab
* store short-lived history

future responsibilities:

* attach lightweight heuristics
* generate explanations
* power ui + social layers

example heuristic ideas:

```ts
riskSignals = {
  blindSignature: true,
  newContract: true,
  uncommonMethod: false,
  valueOutlier: true
}
```

---

### ui interactions (later in phase 3 / phase 4)

intended behavior:

* extension reacts like metamask
* opens or highlights on high-risk intent

shows things like:

* "this site is requesting a signature"
* "you are about to send 0.42 eth"
* "contract was just deployed"

---

### what phase 3 unlocked

* reliable detection of real wallet actions
* clean demos on real dapps
* understanding intent without reading etherscan
* ability to react to *actual* wallet usage, not just provider presence

this is the core signal layer ensight is built on.

---

## phase 3.5 - activity signals + dynamic extension state

goal: make ensight feel *alive* without being noisy.
only react when something actually matters.

key realization:

> wallet *presence* ≠ wallet *activity*

metamask injects `window.ethereum` on lots of pages.
logging that everywhere is noise.

so instead of treating "ethereum detected" as meaningful, we added an **activity signal**.

---

### ethereum_active signal

we emit `ETHEREUM_ACTIVE` the **first time** a page actually calls `ethereum.request`.

this means:

* the page is a real dapp
* the wallet is actually being used
* we should start paying attention

this happens once per page, not on every reload.

---

### dynamic extension icon

ensight’s icon now reflects page state:

* dark / muted → no wallet activity
* lighter / active → ethereum was used on this page

behavior:

* icon flips on when `ETHEREUM_ACTIVE` or `ETHEREUM_REQUEST` fires
* icon resets when the tab navigates to a new page

this gives:

* zero noise on normal sites
* instant visual feedback on web3 activity

quiet by default. loud when it matters.

---

### mental model update

phase 3 isn’t about ui yet.
it’s about **trusting the signal**.

by the end of this phase, ensight:

* knows when a wallet is actually used
* captures intent safely
* stays invisible unless needed

phase 4 is where this turns into explanations + protection.
