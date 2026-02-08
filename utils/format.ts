/**
 * Display formatting: short address, dates, etc.
 */

export function shortAddress(address: string, chars = 6): string {
  if (!address || typeof address !== 'string') return '';
  const a = address.startsWith('0x') ? address.slice(2) : address;
  if (a.length <= chars * 2) return address;
  return `0x${a.slice(0, chars)}...${a.slice(-chars)}`;
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatRelativeTime(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return formatTime(ms);
}
