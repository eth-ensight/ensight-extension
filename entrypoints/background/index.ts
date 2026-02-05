// background.ts
// service worker (brain)

// receives intent messages
// associates them with a browser tab
// broadcasts updates to UI surfaces
// opens side panel on intent (wow so cool lol)

export default defineBackground(() => {
  console.log("ensight: background running...");

  browser.runtime.onMessage.addListener((msg, sender) => {
    if (msg?.type === "ENSIGHT/PING") {
      console.log("ensight: background received ping from content at URL: ",
        msg.url
      );
    }
  });
});

