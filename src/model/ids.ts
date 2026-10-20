import type { AppId } from './types.ts';

const RESERVED = ['constructor', 'prototype', '__proto__'];

export function isAppId(value: unknown): value is AppId {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,160}$/.test(value) &&
    RESERVED.indexOf(value) < 0
  );
}

export function knownAppId(value: string): AppId {
  if (!isAppId(value)) throw Error('Invalid built-in app id: ' + value);
  return value;
}

/** Only local installed-app icons; anything else falls back to initials. */
export function safeIcon(path: unknown): string {
  return typeof path === 'string' &&
    path.length < 2048 &&
    /^(?:\/[^\/]|file:\/\/\/|wgt-package:\/\/\/)/.test(path)
    ? path
    : '';
}

/** Case-insensitive choice from a fixed list, as stored preferences have always been read. */
export function pick<T extends string>(value: unknown, list: readonly T[], fallback: T): T {
  const v = String(value || '').toLowerCase();
  for (const item of list) if (item.toLowerCase() === v) return item;
  return fallback;
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
