/**
 * Runs in the page's main world. Patches window.ethereum.request (and providers)
 * and posts ETHEREUM_ACTIVE / ETHEREUM_REQUEST events via postMessage for the
 * content script to forward. No extension APIs — self-contained.
 */

const TRACKED = [
  'eth_accounts',
  'eth_requestAccounts',
  'eth_sendTransaction',
  'eth_sign',
  'personal_sign',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
] as const;

const SIGN_TYPED_PREFIX = 'eth_signTypedData';

function isTracked(method: string): boolean {
  if (TRACKED.includes(method as (typeof TRACKED)[number])) return true;
  return method.startsWith(SIGN_TYPED_PREFIX);
}

function emit(event: object): void {
  window.postMessage({ ensight: true, ...event }, '*');
}

function patchRequest(original: (args: { method: string; params?: unknown[] }) => Promise<unknown>) {
  return function (args: { method: string; params?: unknown[] }): Promise<unknown> {
    const method = typeof args?.method === 'string' ? args.method : '';
    if (!isTracked(method)) return original(args);

    const id = `ensight-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    emit({ type: 'ETHEREUM_ACTIVE', ensight: true });
    emit({
      type: 'ETHEREUM_REQUEST',
      ensight: true,
      phase: 'before',
      id,
      method,
      params: Array.isArray(args?.params) ? args.params : [],
    });

    return original(args)
      .then((result) => {
        emit({
          type: 'ETHEREUM_REQUEST',
          ensight: true,
          phase: 'after',
          id,
          result,
        });
        return result;
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : String(err);
        emit({
          type: 'ETHEREUM_REQUEST',
          ensight: true,
          phase: 'error',
          id,
          error,
        });
        throw err;
      });
  };
}

function run(): void {
  const win = typeof window !== 'undefined' ? window : (globalThis as unknown as Window & { ethereum?: unknown });
  const eth = win?.ethereum as
    | { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>; providers?: unknown[] }
    | undefined;
  if (!eth || typeof eth.request !== 'function') return;

  if (!(eth as { _ensightPatched?: boolean })._ensightPatched) {
    (eth as { _ensightPatched?: boolean })._ensightPatched = true;
    const orig = eth.request.bind(eth);
    eth.request = patchRequest(orig) as (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  }

  const providers = eth.providers;
  if (Array.isArray(providers)) {
    for (let i = 0; i < providers.length; i++) {
      const p = providers[i] as { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>; _ensightPatched?: boolean };
      if (p && typeof p.request === 'function' && !p._ensightPatched) {
        p._ensightPatched = true;
        const orig = p.request.bind(p);
        p.request = patchRequest(orig) as (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      }
    }
  }
}

// Only the callback passed to defineUnlistedScript runs in the page context.
export default defineUnlistedScript(() => {
  run();
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => setTimeout(run, 500));
  }
});
