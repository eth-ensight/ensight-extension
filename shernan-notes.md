# shernan's personal notes 

goal: take notes and brainstorm using this file while making this app so you can see how i think lol

ALSO i ran out of cursor credits so im rawdogging building this entire app reading docs + chatgpt to teach me, lowkey goated method for learnmaxxing no cap.

---

## commit 1

provide WXT is building
- background runs
- content script injects on pages
- they can messages each other

### background entrypoint

first i gotta make the background entrypoint

the background entrypoint is the extension's brain essentially which receives events, stores state, later calls backend

`src/entrypoints/background/index.ts` to see my changes


### content entrypoint

then i gotta make the content entrypoint

the content entrypoint is how we "sit inside" websites and observe wallet calls,
it runs inside browser tabs, can read page content and send messages back to the background.
this is the basis of being able to detect when a wallet is on the page i believe? we shall see

`src/entrypoints/content/index.ts` to see my code

devtools console should show `ensight: content injected...`
service worker logs should show: `ensight: got ping from content...`

`defineContentScript()` - tells wxt this file should be injected as a content script
`matches: ["<all_urls>"]` - ensures it loads on every page
`runAt: "document_start"` - means it runs early

---

## commit 2

### detecting a wallet provider

goal: detect whether a wallet provider (metamask, coinbase wallet, etc) is injected on the page so ENSight knows the site can make wallet calls.

most web3 dapps expose a global object like:

`window.ethereum`

if it exists, the site can call wallet methods such as:
- `eth_requestAccounts`
- `eth_sendTransaction`
- `personal_sign`

---

### ❌ broken approach (replaced)

initial implementation:
- checked `window.ethereum` directly inside the content script
- polled briefly in case the wallet injected late

this didn’t work reliably, and it took me a long ahh time to realize this is not it

**why:** content scripts run in an isolated JS world.  
wallets inject into the page’s JS context, so `window.ethereum` was often invisible to the extension.

---

### ✅ current approach (page-context injection)

fix:
- inject a small script directly into the page context
- that script checks for `window.ethereum`
- once found, it sends a message back to the content script
- content script forwards it to the background

flow:
1. content script injects page script
2. page script detects wallet provider
3. message sent via `window.postMessage`
4. background stores page-level wallet context

---

### what this commit unlocked

- reliable wallet detection on any dapp
- clean separation between page logic and extension logic
- foundation for intercepting and explaining wallet calls later

tldr: wallets live in the page’s JS world, not the extension’s.  
injecting into the page is the only reliable way to see them.

---