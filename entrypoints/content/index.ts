// entrypoints/content/index.ts
// observer layer inside the extension
// injects page-world script
// listens for wallet intent via window.postMessage
// filters high-signal methods
// forwards structured events to background

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",

  async main() {
    console.log("ensight: content script running", location.href);

    // prevent duplicate "active" events per page load
    let sentDetected = false;

    // only forward things users actually care about
    const HIGH_SIGNAL_METHODS = new Set([
      "eth_requestAccounts",
      "eth_sendTransaction",
      "eth_sign",
      "personal_sign",
      "eth_signTypedData",
      "eth_signTypedData_v3",
      "eth_signTypedData_v4",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
    ]);

    // bridge: page world -> extension world
    // main world script posts events via window.postMessage
    window.addEventListener("message", async (event) => {
      // ensure this is a same-page message
      if (event.source !== window) return;

      const data = event.data;
      if (!data?.ensight) return;

      // phase 2/3: page is web3-active (first wallet request happened)
      if (data.type === "ETHEREUM_ACTIVE" && !sentDetected) {
        sentDetected = true;

        try {
          await browser.runtime.sendMessage({
            type: "ENSIGHT/ETH_ACTIVE",
            url: location.href,
          });
        } catch (err) {
          console.error("ensight: eth_active failed", err);
        }

        return;
      }

      // phase 3+: intercepted ethereum.request lifecycle
      if (data.type === "ETHEREUM_REQUEST") {
        const method = data.method as string;

        // drop noise
        if (!HIGH_SIGNAL_METHODS.has(method)) return;

        try {
          await browser.runtime.sendMessage({
            type: "ENSIGHT/ETH_REQUEST",
            event: data,
          });
        } catch (err) {
          console.error("ensight: eth_request forward failed", err);
        }
      }
    });

    // debug ping to confirm content script is live
    try {
      await browser.runtime.sendMessage({
        type: "ENSIGHT/CONTENT_LOADED",
        url: location.href,
      });
    } catch (err) {
      console.error("ensight: content_loaded failed", err);
    }

    // inject page-world script (window.ethereum lives here)
    // keepInDom keeps the script node for debugging / visibility
    await injectScript("/ethereum-main-world.js", {
      keepInDom: true,
    });
  },
});
