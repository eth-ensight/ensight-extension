// observer layer inside the page
// injects injected.js into page context
// listens to window.postMessage
// filters for ethereum methods you care about
// forwards structured intent to the background script

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  async main() {
    await injectScript("/ethereum-main-world.js", { keepInDom: true });

    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (data?.ensight && data.type === "ETHEREUM_DETECTED") {
        console.log("ENSight: wallet provider detected!");
        browser.runtime.sendMessage({ type: "ENSIGHT/ETH_DETECTED", url: location.href });
      }
    });
  },
});


