// background.ts
// service worker (brain)

// receives intent messages
// associates them with a browser tab
// broadcasts updates to UI surfaces
// opens side panel on intent (wow so cool lol)

export default defineBackground(() => {
  console.log("ensight: background running...");

  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "ENSIGHT/CONTENT_LOADED") {
      console.log("ensight: got CONTENT_LOADED", msg.url);
      return Promise.resolve({ ok: true, type: "CONTENT_LOADED_ACK" });
    }

    if (msg?.type === "ENSIGHT/ETH_DETECTED") {
      console.log("ensight: got ETH_DETECTED", msg.url);
      return Promise.resolve({ ok: true, type: "ETH_DETECTED_ACK" });
    }
  });
});


