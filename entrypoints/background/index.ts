// background.ts
// service worker (brain)

// receives intent messages
// associates them with a browser tab
// broadcasts updates to UI surfaces
// opens side panel on intent (wow so cool lol)

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });
});

