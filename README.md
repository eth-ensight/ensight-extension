<p align="center">
  <img src=".github/images/ensight-logo.png" width="180" alt="ENSight Logo" />
</p>

<h1 align="center">ENSight Extension</h1>

<p align="center">
  Real-time perception layer for Ethereum — intercepting wallet actions and explaining intent, risk, and context.
</p>

<p align="center">
  <a href="https://ethglobal.com" target="_blank">
    <img src="https://img.shields.io/badge/Community-ETHGlobal-blue" />
  </a>
  <a href="https://ethglobal.com/events/hackmoney2026/" target="_blank">
    <img src="https://img.shields.io/badge/Built%20at-HackMoney%202026-purple" />
  </a>
  <img src="https://img.shields.io/badge/Platform-Chrome%20Extension-green" />
</p>

---

## 🔄 Extension User Flow

<p align="center">
  <img src=".github/images/diagram-extension-flow.png" alt="ENSight Extension Flow Diagram" />
</p>

### How it works

1. User visits a website  
2. Website injects a wallet (`window.ethereum`)  
3. ENSight hooks into the page runtime  
4. Website calls `ethereum.request(...)`  
5. ENSight intercepts method + parameters  
6. Intent is forwarded to the background worker  
7. ENSight side panel opens automatically  
8. ENSight explains what’s about to happen (action, risk, context)

---

## ⚙️ Tech Stack

- **WXT** — Chrome Extension (MV3) build
- **React** — Popup UI
- **Wagmi + Viem** — ENS resolution (names, avatars) on Ethereum mainnet
- **Rainbow Kit** — Wallet connect in popup (optional)
- **Chrome Extension APIs** — Runtime interception, storage, messaging
- **Background workers** — Per-tab session and persistence  

---

## 🧪 Development & testing

- **Build:** `pnpm install && pnpm build` → output in `.output/chrome-mv3`
- **Dev:** `pnpm dev` (or `npm run dev`) → watch build only (Chrome is not auto-launched). Load **Load unpacked** in `chrome://extensions` and select `.output/chrome-mv3`. Reload the extension after code changes.
- **Tests:** `pnpm test` — unit and integration tests for session logic (kind/severity/one-liner, event → session, serialization) and type helpers.
- **Verification:** See [VERIFICATION-GUIDE.md](./VERIFICATION-GUIDE.md) for a step-by-step guide to confirm the extension works end-to-end (load, intercept, popup feed, ENS resolution).
- **ENS:** Popup uses [wagmi](https://wagmi.sh) + [Rainbow Kit](https://rainbowkit.com) per the [ENS quickstart](https://docs.ens.domains/web/quickstart/). ENS resolution (names/avatars) uses Ethereum mainnet (chainId 1). For WalletConnect in the popup, set your own `projectId` from [WalletConnect Cloud](https://cloud.walletconnect.com) in `entrypoints/popup/main.tsx` if needed.
- **Backend:** The extension calls [ensight-backend](../ensight-backend) for risk checks, ENS reverse lookup, and the knowledge graph. API base URL defaults to `http://localhost:3000`; set `VITE_ENSIGHT_API_URL` in `.env` (or at build time) to use a deployed backend. See [CORE-FUNCTIONALITY.md](./CORE-FUNCTIONALITY.md#backend-integration).

---

## 🎯 Role in ENSight

This repository contains the **client perception layer** of ENSight — responsible for detecting wallet activity, intercepting transaction intent, and presenting real-time context to users.

---

## 🚀 Why ENSight

ENSight acts as a **real-time safety + context layer for Web3**, giving users clarity before they sign, approve, or interact with smart contracts.

- Inline transaction explanations  
- Scam & abnormal behavior detection  
- Human-readable wallet intent

---

## ⛓️ On-Chain + Off-Chain Integration

The extension is where blockchain truth meets real-time intelligence.

It captures:

- Raw wallet intent (methods + parameters)
- Contract interactions
- Approval flows

And enriches them with:

- Risk heuristics  
- Context signals  
- Human-readable explanations  

All before the user signs.

---

## 🔐 Security Model

- No private keys accessed  
- Read-only interception  
- Optional backend enrichment  
- Sanitized payloads  

ENSight is designed as a passive safety layer — not a wallet replacement.

---

<sub>Part of the ENSight ecosystem • Built for open Web3 infrastructure</sub>
