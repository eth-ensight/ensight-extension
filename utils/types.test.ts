import { describe, it, expect } from 'vitest';
import { isPageEvent, isTrackedMethod, TRACKED_METHODS, SIGN_TYPED_DATA_PREFIX } from './types';

describe('types', () => {
  describe('isPageEvent', () => {
    it('returns true for ETHEREUM_ACTIVE', () => {
      expect(isPageEvent({ ensight: true, type: 'ETHEREUM_ACTIVE' })).toBe(true);
    });
    it('returns true for ETHEREUM_REQUEST with phase', () => {
      expect(
        isPageEvent({
          ensight: true,
          type: 'ETHEREUM_REQUEST',
          phase: 'before',
          id: 'x',
          method: 'eth_accounts',
          params: [],
        })
      ).toBe(true);
    });
    it('returns false for non-object', () => {
      expect(isPageEvent(null)).toBe(false);
      expect(isPageEvent(undefined)).toBe(false);
      expect(isPageEvent('')).toBe(false);
    });
    it('returns false when ensight is not true', () => {
      expect(isPageEvent({ type: 'ETHEREUM_ACTIVE' })).toBe(false);
    });
    it('returns false when type is missing', () => {
      expect(isPageEvent({ ensight: true })).toBe(false);
    });
  });

  describe('isTrackedMethod', () => {
    it('returns true for all TRACKED_METHODS', () => {
      TRACKED_METHODS.forEach((method) => {
        expect(isTrackedMethod(method)).toBe(true);
      });
    });
    it('returns true for eth_signTypedData*', () => {
      expect(isTrackedMethod('eth_signTypedData')).toBe(true);
      expect(isTrackedMethod('eth_signTypedData_v3')).toBe(true);
      expect(isTrackedMethod('eth_signTypedData_v4')).toBe(true);
    });
    it('returns false for untracked methods', () => {
      expect(isTrackedMethod('eth_blockNumber')).toBe(false);
      expect(isTrackedMethod('net_version')).toBe(false);
      expect(isTrackedMethod('')).toBe(false);
    });
  });
});
