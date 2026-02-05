# ensight runtime glossary

minimal reference for browser + web3 concepts mapped directly to ensight.

---

## flow

```
main world (page js)
  window.ethereum
  ethereum.request()

      ↓ injected script

content script (isolated)
  relay + bridge

      ↓ runtime messaging

background (service worker)
  state + logic + backend
```

---

## execution worlds

**main world** – the website’s real js runtime. wallets inject here.

**isolated world** – extension content script sandbox. same dom, different js.

**extension world** – background service worker (ensight brain).

---

## core techniques

**script injection** – run js inside main world from content script.

**message passing** – move data across worlds (postMessage, runtime messages).

**event bridging** – forwarding signals main → content → background.

---

## web3 runtime

**ethereum provider** – injected wallet object (`window.ethereum`).

**ethereum.request()** – dapp → wallet api for all actions.

**json-rpc** – protocol format of wallet calls (method + params).

**eip-1193** – standard defining ethereum providers.

---

## interception language

**hooking** – wrapping a function to observe behavior.

**monkey-patching** – overriding runtime functions.

**proxying** – trapping calls using js Proxy.

**instrumentation** – observing runtime behavior (what ensight does).

**telemetry** – captured behavioral signals.

**event stream** – continuous flow of signals.

**trace** – timeline of interactions.

---

## debugging

**execution context** – each js environment (page, iframe, content, worker).

**service worker** – extension background process.

**preserve log** – devtools option to keep logs on reload.

**source maps** – map bundled code back to ts.

---

## advanced

**cdp (chrome devtools protocol)** – programmatic browser instrumentation.

---

## core idea

ensight instruments the browser runtime to observe wallet behavior and turn raw signals into context + safety + explanations.

