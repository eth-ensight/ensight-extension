/**
 * Message protocol: content ↔ background, popup ↔ background.
 */

import type { TabSession } from './types';

// Content → Background

export const MSG_ETH_ACTIVE = 'ENSIGHT/ETH_ACTIVE';
export const MSG_ETH_REQUEST = 'ENSIGHT/ETH_REQUEST';
export const MSG_CONTENT_LOADED = 'ENSIGHT/CONTENT_LOADED';

export interface EthActivePayload {
  tabId: number;
}

export interface EthRequestPayload {
  tabId: number;
  phase: 'before' | 'after' | 'error';
  id: string;
  method: string;
  params?: unknown[];
  result?: unknown;
  error?: string;
}

export interface ContentLoadedPayload {
  tabId: number;
  hostname: string;
}

// Popup → Background

export const MSG_GET_ACTIVE_SESSION = 'ENSIGHT/GET_ACTIVE_SESSION';
export const MSG_GET_SESSION = 'ENSIGHT/GET_SESSION';
export const MSG_GET_LAST_SESSION = 'ENSIGHT/GET_LAST_SESSION';

export interface GetSessionPayload {
  tabId?: number;
}

export type GetActiveSessionResponse = TabSession | null;
export type GetSessionResponse = TabSession | null;
export type GetLastSessionResponse = TabSession | null;
