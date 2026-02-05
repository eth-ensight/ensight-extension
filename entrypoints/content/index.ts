// observer layer inside the page
// injects injected.js into page context
// listens to window.postMessage
// filters for ethereum methods you care about
// forwards structured intent to the background script

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: "document_start",
  main(){
    console.log("ensight: content script running", location.href);

    browser.runtime.sendMessage({ type: "ENSIGHT/PING", url: location.href });
  }
});
