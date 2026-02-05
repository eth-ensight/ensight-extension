// observer layer inside the page
// injects injected.js into page context
// listens to window.postMessage
// filters for ethereum methods you care about
// forwards structured intent to the background script

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",

  async main() {
    console.log("ENSight: content script running", location.href);

    // listener first (avoid race)
    let sent = false;

    window.addEventListener("message", async (event) => {
      if (event.source !== window) return;
      const data = event.data;

      if (data?.ensight && data.type === "ETHEREUM_DETECTED" && !sent) {
        sent = true;
        console.log("ENSight: wallet provider detected!");

        try {
          const res = await browser.runtime.sendMessage({
            type: "ENSIGHT/ETH_DETECTED",
            url: location.href,
          });
          console.log("ENSight: background ack", res);
        } catch (err) {
          console.error("ENSight: failed to message background", err);
        }
      }
    });

    // ping background (debug)
    try {
      const res = await browser.runtime.sendMessage({
        type: "ENSIGHT/CONTENT_LOADED",
        url: location.href,
      });
      console.log("ENSight: background ack", res);
    } catch (err) {
      console.error("ENSight: CONTENT_LOADED failed", err);
    }

    // now inject
    await injectScript("/ethereum-main-world.js", { keepInDom: true });
  },
});



