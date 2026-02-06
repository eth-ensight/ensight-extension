// background service worker
// receives wallet intent from content scripts
// routing + tiny state brain
// icon goes bright when a page is web3-active

export default defineBackground(() => {
  console.log("ensight: background running");

  const ICON_OFF = {
    16: "icons/ensight-off-16.png",
    32: "icons/ensight-off-32.png",
    48: "icons/ensight-off-48.png",
    128: "icons/ensight-off-128.png",
  };

  const ICON_ON = {
    16: "icons/ensight-on-16.png",
    32: "icons/ensight-on-32.png",
    48: "icons/ensight-on-48.png",
    128: "icons/ensight-on-128.png",
  };

  const setTabIcon = async (tabId: number, on: boolean) => {
    try {
      await browser.action.setIcon({
        tabId,
        path: on ? ICON_ON : ICON_OFF,
      });
    } catch {
      // some tabs/pages can fail, ignore
    }
  };

  // reset to off when a tab starts loading a new page
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "loading") {
      setTabIcon(tabId, false);
    }
  });

  // tiny rolling buffer (mvp)
  const events: any[] = [];
  const MAX = 50;

  const push = (evt: any) => {
    events.unshift(evt);
    if (events.length > MAX) events.pop();
  };

  browser.runtime.onMessage.addListener((msg, sender) => {
    if (msg?.type === "ENSIGHT/CONTENT_LOADED") {
      console.log("ensight: content loaded", msg.url);
      return Promise.resolve({ ok: true });
    }

    if (msg?.type === "ENSIGHT/ETH_ACTIVE") {
      console.log("ensight: ethereum active", msg.url);

      const tabId = sender.tab?.id;
      if (tabId != null) setTabIcon(tabId, true);

      return Promise.resolve({ ok: true });
    }

    if (msg?.type === "ENSIGHT/ETH_REQUEST") {
      const evt = msg.event;
      push(evt);

      const tabId = sender.tab?.id;
      if (tabId != null) setTabIcon(tabId, true);

      console.log("ensight: eth_request", evt?.method, evt?.phase, evt?.summary, evt?.page?.hostname);
      return Promise.resolve({ ok: true });
    }

    if (msg?.type === "ENSIGHT/GET_EVENTS") {
      return Promise.resolve({ ok: true, events });
    }
  });
});
