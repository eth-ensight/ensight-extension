// background.ts
// service worker (brain)

// listens for messages from content script
// stores "latest intent per tab"
// opens side panel on intent (wow so cool lol)

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });
});

