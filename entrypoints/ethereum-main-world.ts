// page-world script
// runs alongside the site
// observes ethereum provider + request lifecycle
// emits structured wallet intent events

export default defineUnlistedScript(() => {
  const CHANNEL_FLAG = "ensight";

  // send events back to the extension
  const post = (payload: any) => {
    window.postMessage({ [CHANNEL_FLAG]: true, ...payload }, "*");
  };

  // basic page context for explanations
  const pageCtx = () => ({
    url: location.href,
    hostname: location.hostname,
    title: document?.title,
  });

  // lightweight intent summary (no calldata decoding)
  const summarize = (method: string, params: any) => {
    try {
      const p = Array.isArray(params) ? params : [];

      if (method === "eth_requestAccounts") return { kind: "connect" };

      if (method === "eth_sendTransaction") {
        const tx = (p?.[0] ?? {}) as any;
        return {
          kind: "tx",
          to: typeof tx?.to === "string" ? tx.to : undefined,
          value: typeof tx?.value === "string" ? tx.value : undefined,
          hasData: typeof tx?.data === "string" && tx.data.length > 2,
        };
      }

      if (
        method === "eth_sign" ||
        method === "personal_sign" ||
        method === "eth_signTypedData" ||
        method === "eth_signTypedData_v3" ||
        method === "eth_signTypedData_v4"
      ) {
        return { kind: "sign" };
      }

      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") {
        const obj = (p?.[0] ?? {}) as any;
        return {
          kind: "chain",
          chainId: typeof obj?.chainId === "string" ? obj.chainId : undefined,
        };
      }

      return { kind: "unknown" };
    } catch {
      return { kind: "unknown" };
    }
  };

  // monkey-patch ethereum.request
  const patchProvider = (provider: any) => {
    if (!provider || typeof provider.request !== "function") return false;
    if ((provider.request as any).__ensight_patched) return true;

    const original = provider.request.bind(provider);
    let sentActive = false;

    const wrapped = async (args: any) => {
      if (!sentActive) {
        sentActive = true;
        post({ type: "ETHEREUM_ACTIVE" }); // or keep name ETHEREUM_DETECTED but it now means "used"
      }
      const id = `${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
      const ts0 = Date.now();
      const method = args?.method ?? "unknown";
      const params = args?.params;

      // request started
      post({
        type: "ETHEREUM_REQUEST",
        phase: "before",
        id,
        ts: ts0,
        method,
        params,
        page: pageCtx(),
        summary: summarize(method, params),
      });

      try {
        const result = await original(args);
        const ts1 = Date.now();

        // request succeeded
        post({
          type: "ETHEREUM_REQUEST",
          phase: "after",
          id,
          ts: ts1,
          method,
          page: pageCtx(),
          durationMs: ts1 - ts0,
          ok: true,
          resultSummary: typeof result === "string" ? result.slice(0, 80) : result,
          summary: summarize(method, params),
        });

        return result;
      } catch (e: any) {
        const ts1 = Date.now();

        // request failed / rejected
        post({
          type: "ETHEREUM_REQUEST",
          phase: "error",
          id,
          ts: ts1,
          method,
          page: pageCtx(),
          durationMs: ts1 - ts0,
          ok: false,
          error: { name: e?.name, message: e?.message },
          summary: summarize(method, params),
        });

        throw e;
      }
    };

    (wrapped as any).__ensight_patched = true;
    provider.request = wrapped;
    return true;
  };

  // detect provider + patch (handles async injection)
  const tryDetectAndPatch = () => {
    const eth = (window as any).ethereum;
    if (!eth) return false;

    //post({ type: "ETHEREUM_DETECTED" });

    // main provider
    patchProvider(eth);

    // multi-provider wallets (e.g. metamask + others)
    if (Array.isArray(eth?.providers)) {
      for (const p of eth.providers) patchProvider(p);
    }

    return true;
  };

  // immediate + short retry window
  if (!tryDetectAndPatch()) {
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (tryDetectAndPatch() || Date.now() - start > 3000) {
        window.clearInterval(interval);
      }
    }, 50);
  }

  // metamask async init signal
  window.addEventListener("ethereum#initialized", tryDetectAndPatch, { once: true });
});
