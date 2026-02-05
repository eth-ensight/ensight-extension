export default defineUnlistedScript(() => {
  const tryDetect = () => {
    const eth = (window as any).ethereum;
    if (eth) {
      window.postMessage({ ensight: true, type: "ETHEREUM_DETECTED" }, "*");
      return true;
    }
    return false;
  };

  // immediate + retry loop
  if (!tryDetect()) {
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (tryDetect() || Date.now() - start > 3000) {
        window.clearInterval(interval);
      }
    }, 50);
  }

  // metamask also fires ethereum#initialized on async injection
  window.addEventListener("ethereum#initialized", tryDetect, { once: true });
});
