import { STORAGE_KEY } from '../model/tables.ts';

export function readStored(key: string): string | null {
  return localStorage.getItem(key);
}

/** False when the browser refuses the write, for example when storage is full. */
export function writeStored(value: string): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}
