# shernan's personal notes 

goal: take notes and brainstorm using this file while making this app so you can see how i think lol

ALSO i ran out of cursor credits so im rawdogging building this entire app reading docs + chatgpt to teach me, lowkey goated method for learnmaxxing no cap.

---

## commit 1

provide WXT is building
- background runs
- content script injects on pages
- they can messages each other

### background entrypoint

first i gotta make the background entrypoint

the background entrypoint is the extension's brain essentially which receives events, stores state, later calls backend

`src/entrypoints/background/index.ts` to see my changes


### content entrypoint

then i gotta make the content entrypoint

the content entrypoint is how we "sit inside" websites and observe wallet calls,
it runs inside browser tabs, can read page content and send messages back to the background.
this is the basis of being able to detect when a wallet is on the page i believe? we shall see

`src/entrypoints/content/index.ts` to see my code

devtools console should show `ensight: content injected...`
service worker logs should show: `ensight: got ping from content...`

`defineContentScript()` - tells wxt this file should be injected as a content script
`matches: ["<all_urls>"]` - ensures it loads on every page
`runAt: "document_start"` - means it runs early

---