/**
 * Backend API client for ensight-extension.
 * Used to call ensight-backend (e.g. risk lookup).
 * API base URL is stored in extension storage; when not set, all calls no-op.
 */

import { browser } from "wxt/browser";

const STORAGE_KEY_API_BASE = "ensight:apiBaseUrl";

/** Response shape from GET /api/risk/address/:address (ensight-backend) */
export type RiskAddressResponse = {
  flagged: boolean;
  lastUpdated: number | null;
};

/**
 * Get the configured backend API base URL (e.g. https://ensight-api.vercel.app).
 * No trailing slash. Returns null if not set.
 */
export async function getApiBaseUrl(): Promise<string | null> {
  const out = await browser.storage.local.get(STORAGE_KEY_API_BASE);
  const url = out[STORAGE_KEY_API_BASE];
  return typeof url === "string" && url.length > 0 ? url.replace(/\/$/, "") : null;
}

/**
 * Set the backend API base URL. Pass null or empty to disable backend calls.
 */
export async function setApiBaseUrl(url: string | null): Promise<void> {
  const value =
    url == null || (typeof url === "string" && url.trim() === "") ? null : url.replace(/\/$/, "");
  await browser.storage.local.set({ [STORAGE_KEY_API_BASE]: value });
}

/**
 * Check if an address is flagged by the backend (e.g. ScamSniffer list).
 * Requires API base URL to be set via setApiBaseUrl().
 * Returns null if backend is not configured or the request fails.
 */
export async function getRiskForAddress(
  address: string
): Promise<RiskAddressResponse | null> {
  const base = await getApiBaseUrl();
  if (!base) return null;

  const raw = typeof address === "string" ? address.trim() : "";
  if (!raw || raw.length !== 42 || !raw.startsWith("0x")) return null;

  const normalized = raw.toLowerCase();
  const url = `${base}/api/risk/address/${encodeURIComponent(normalized)}`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;
    const data = (await res.json()) as RiskAddressResponse;
    if (typeof data?.flagged !== "boolean") return null;
    return {
      flagged: data.flagged,
      lastUpdated: typeof data.lastUpdated === "number" ? data.lastUpdated : null,
    };
  } catch {
    return null;
  }
}
