import { describe, it, expect } from 'vitest';
import {
  kindFromMethod,
  severityForItem,
  oneLinerForRequest,
  createEmptySession,
  ensureSession,
  mergeRequestIntoSession,
  serializeSession,
  deserializeSession,
} from './session';
import type { FeedItemKind } from './types';

describe('session', () => {
  describe('kindFromMethod', () => {
    it('returns connect for eth_accounts and eth_requestAccounts', () => {
      expect(kindFromMethod('eth_accounts')).toBe('connect');
      expect(kindFromMethod('eth_requestAccounts')).toBe('connect');
    });
    it('returns tx for eth_sendTransaction', () => {
      expect(kindFromMethod('eth_sendTransaction')).toBe('tx');
    });
    it('returns chain for wallet_switchEthereumChain and wallet_addEthereumChain', () => {
      expect(kindFromMethod('wallet_switchEthereumChain')).toBe('chain');
      expect(kindFromMethod('wallet_addEthereumChain')).toBe('chain');
    });
    it('returns sign for eth_sign, personal_sign, and eth_signTypedData*', () => {
      expect(kindFromMethod('eth_sign')).toBe('sign');
      expect(kindFromMethod('personal_sign')).toBe('sign');
      expect(kindFromMethod('eth_signTypedData')).toBe('sign');
      expect(kindFromMethod('eth_signTypedData_v4')).toBe('sign');
    });
  });

  describe('severityForItem', () => {
    it('returns danger for error phase', () => {
      expect(severityForItem('connect', 'error')).toBe('danger');
      expect(severityForItem('tx', 'error')).toBe('danger');
    });
    it('returns warn for tx and sign when not error', () => {
      expect(severityForItem('tx', 'before')).toBe('warn');
      expect(severityForItem('tx', 'after')).toBe('warn');
      expect(severityForItem('sign', 'before')).toBe('warn');
    });
    it('returns info for connect and chain when not error', () => {
      expect(severityForItem('connect', 'before')).toBe('info');
      expect(severityForItem('chain', 'after')).toBe('info');
    });
  });

  describe('oneLinerForRequest', () => {
    it('returns error slice for error phase with error message', () => {
      const out = oneLinerForRequest('tx', 'eth_sendTransaction', 'error', undefined, 'User rejected');
      expect(out).toContain('Failed:');
      expect(out).toContain('User rejected');
    });
    it('returns connect before/after lines', () => {
      expect(oneLinerForRequest('connect', 'eth_requestAccounts', 'before')).toBe('Requesting account access');
      expect(oneLinerForRequest('connect', 'eth_requestAccounts', 'after')).toBe('Account access completed');
    });
    it('returns tx before/after lines', () => {
      expect(oneLinerForRequest('tx', 'eth_sendTransaction', 'before')).toBe('Sending transaction');
      expect(oneLinerForRequest('tx', 'eth_sendTransaction', 'after')).toBe('Transaction sent');
    });
    it('returns sign and chain lines', () => {
      expect(oneLinerForRequest('sign', 'personal_sign', 'before')).toBe('Requesting signature');
      expect(oneLinerForRequest('chain', 'wallet_switchEthereumChain', 'before')).toBe('Switching/add chain');
    });
  });

  describe('createEmptySession', () => {
    it('returns session with tabId, hostname, empty feed and zero counts', () => {
      const s = createEmptySession(1, 'example.com');
      expect(s.tabId).toBe(1);
      expect(s.hostname).toBe('example.com');
      expect(s.web3Active).toBe(false);
      expect(s.feed).toEqual([]);
      expect(s.counts).toEqual({ connect: 0, sign: 0, tx: 0, chain: 0 });
      expect(typeof s.lastSeenAt).toBe('number');
    });
  });

  describe('ensureSession', () => {
    it('creates and stores session when missing', () => {
      const m = new Map();
      const s = ensureSession(m, 2, 'test.com');
      expect(s.tabId).toBe(2);
      expect(s.hostname).toBe('test.com');
      expect(m.get(2)).toBe(s);
    });
    it('returns existing session when present', () => {
      const m = new Map();
      const existing = createEmptySession(3, 'old.com');
      m.set(3, existing);
      const s = ensureSession(m, 3, 'new.com');
      expect(s).toBe(existing);
      expect(s.hostname).toBe('old.com');
    });
  });

  describe('mergeRequestIntoSession', () => {
    it('adds before event as new feed item and increments count', () => {
      const session = createEmptySession(1, 'site.com');
      const updated = mergeRequestIntoSession(session, {
        phase: 'before',
        id: 'req-1',
        method: 'eth_sendTransaction',
        params: [{ to: '0x123', value: '0x0', data: '0x' }],
      });
      expect(updated.feed).toHaveLength(1);
      expect(updated.feed[0].id).toBe('req-1');
      expect(updated.feed[0].kind).toBe('tx');
      expect(updated.feed[0].phase).toBe('before');
      expect(updated.feed[0].params).toEqual({ to: '0x123', value: '0x0', hasData: true });
      expect(updated.counts.tx).toBe(1);
      expect(updated.web3Active).toBe(true);
    });

    it('merges after event into same id and updates phase', () => {
      const session = createEmptySession(1, 'site.com');
      let updated = mergeRequestIntoSession(session, {
        phase: 'before',
        id: 'req-2',
        method: 'personal_sign',
        params: [],
      });
      updated = mergeRequestIntoSession(updated, {
        phase: 'after',
        id: 'req-2',
        method: 'personal_sign',
        result: '0xabc',
      });
      expect(updated.feed).toHaveLength(1);
      expect(updated.feed[0].phase).toBe('after');
      expect(updated.feed[0].resolvedAt).toBeDefined();
    });

    it('merges error event and sets error message', () => {
      const session = createEmptySession(1, 'site.com');
      let updated = mergeRequestIntoSession(session, {
        phase: 'before',
        id: 'req-3',
        method: 'eth_requestAccounts',
      });
      updated = mergeRequestIntoSession(updated, {
        phase: 'error',
        id: 'req-3',
        method: 'eth_requestAccounts',
        error: 'User denied',
      });
      expect(updated.feed[0].phase).toBe('error');
      expect(updated.feed[0].error).toBe('User denied');
    });

    it('caps feed at 50 items', () => {
      let session = createEmptySession(1, 'site.com');
      for (let i = 0; i < 55; i++) {
        session = mergeRequestIntoSession(session, {
          phase: 'before',
          id: `id-${i}`,
          method: 'eth_accounts',
        });
      }
      expect(session.feed.length).toBe(50);
    });
  });

  describe('serializeSession / deserializeSession', () => {
    it('round-trips a session', () => {
      const session = createEmptySession(99, 'roundtrip.com');
      session.web3Active = true;
      session.feed.push({
        id: 'f1',
        kind: 'sign',
        severity: 'warn',
        oneLiner: 'Sign',
        method: 'personal_sign',
        phase: 'before',
        startedAt: 1000,
      });
      const json = serializeSession(session);
      expect(typeof json).toBe('string');
      const restored = deserializeSession(json);
      expect(restored).not.toBeNull();
      expect(restored!.tabId).toBe(99);
      expect(restored!.hostname).toBe('roundtrip.com');
      expect(restored!.feed).toHaveLength(1);
      expect(restored!.feed[0].id).toBe('f1');
    });

    it('returns null for invalid JSON', () => {
      expect(deserializeSession('')).toBeNull();
      expect(deserializeSession('{')).toBeNull();
      expect(deserializeSession('null')).toBeNull();
    });

    it('returns null for JSON missing required fields', () => {
      expect(deserializeSession('{}')).toBeNull();
      expect(deserializeSession('{"tabId":1}')).toBeNull();
    });
  });
});
