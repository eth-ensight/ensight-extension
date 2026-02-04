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

- WXT  
- Chrome Extension APIs  
- Runtime interception hooks  
- Background workers  

---

## 🎯 Role in ENSight

This repository contains the **client perception layer** of ENSight — responsible for detecting wallet activity, intercepting transaction intent, and presenting real-time context to users.

---

## 🚀 Why ENSight

ENSight acts as a **real-time safety + context layer for Web3**, giving users clarity before they sign, approve, or interact with smart contracts.

- Inline transaction explanations  
- Scam & abnormal behavior detection  
- Human-readable wallet intent  

