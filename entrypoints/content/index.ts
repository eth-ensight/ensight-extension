// observer layer inside the page
// injects injected.js into page context
// listens to window.postMessage
// filters for ethereum methods you care about
// forwards structured intent to the background script

export default defineContentScript({
  matches: ['*://*.google.com/*'],
  main() {
    console.log('Hello content.');
  },
});
