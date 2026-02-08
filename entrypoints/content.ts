/**
 * Content script: injects main-world script, listens for postMessage events,
 * filters to tracked methods, forwards to background. Background gets tabId from sender.tab.id.
 */

import { injectScript } from 'wxt/client';
import { isPageEvent, isTrackedMethod } from '~/utils/types';
import {
  MSG_CONTENT_LOADED,
  MSG_ETH_ACTIVE,
  MSG_ETH_REQUEST,
} from '~/utils/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  async main() {
    try {
      await injectScript('/ethereum-main-world.js', { keepInDom: true });
    } catch {
      // Page may not allow script injection (e.g. chrome://)
    }

    const hostname = typeof location !== 'undefined' ? new URL(location.href).hostname : '';

    await browser.runtime.sendMessage({
      type: MSG_CONTENT_LOADED,
      payload: { hostname },
    });

    window.addEventListener('message', (event: MessageEvent) => {
      if (event.source !== window || !event.data) return;
      const msg = event.data;

      if (!isPageEvent(msg)) return;
      if (msg.type === 'ETHEREUM_ACTIVE') {
        browser.runtime.sendMessage({ type: MSG_ETH_ACTIVE, payload: {} });
        return;
      }
      if (msg.type === 'ETHEREUM_REQUEST' && isTrackedMethod(msg.method)) {
        const payload: {
          phase: 'before' | 'after' | 'error';
          id: string;
          method: string;
          params?: unknown[];
          result?: unknown;
          error?: string;
        } = {
          phase: msg.phase,
          id: msg.id,
          method: msg.method,
        };
        if (msg.phase === 'before' && Array.isArray(msg.params)) payload.params = msg.params;
        if (msg.phase === 'after' && 'result' in msg) payload.result = msg.result;
        if (msg.phase === 'error' && 'error' in msg) payload.error = msg.error;
        browser.runtime.sendMessage({ type: MSG_ETH_REQUEST, payload });
      }
    });
  },
});
