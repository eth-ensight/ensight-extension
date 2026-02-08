import { describe, it, expect } from 'vitest';
import { shortAddress, formatTime, formatRelativeTime } from './format';

describe('format', () => {
  describe('shortAddress', () => {
    it('returns empty for empty or non-string', () => {
      expect(shortAddress('')).toBe('');
      expect(shortAddress(null as unknown as string)).toBe('');
    });
    it('shortens 0x-prefixed address to default 6+6 chars', () => {
      const addr = '0x1234567890abcdef1234567890abcdef12345678';
      expect(shortAddress(addr)).toBe('0x123456...345678');
    });
    it('returns full string if shorter than 2*chars', () => {
      expect(shortAddress('0x1234')).toBe('0x1234');
    });
    it('accepts custom char count', () => {
      const addr = '0x1234567890abcdef1234567890abcdef12345678';
      expect(shortAddress(addr, 4)).toBe('0x1234...5678');
    });
  });

  describe('formatTime', () => {
    it('formats timestamp as time string', () => {
      const ms = new Date(2024, 0, 15, 14, 30, 45).getTime();
      const out = formatTime(ms);
      expect(out).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "just now" for recent time', () => {
      const now = Date.now() - 30_000;
      expect(formatRelativeTime(now)).toBe('just now');
    });
    it('returns "Xm ago" for minutes', () => {
      const now = Date.now() - 5 * 60_000;
      expect(formatRelativeTime(now)).toMatch(/\d+m ago/);
    });
    it('returns "Xh ago" for hours', () => {
      const now = Date.now() - 2 * 3600_000;
      expect(formatRelativeTime(now)).toMatch(/\d+h ago/);
    });
    it('returns formatted time for old', () => {
      const now = Date.now() - 25 * 3600_000;
      expect(formatRelativeTime(now)).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });
  });
});
