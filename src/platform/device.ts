import { safeIcon } from '../model/ids.ts';
import type { CatalogEntry, DeviceError, DeviceOp } from '../model/types.ts';

type Callback = (err: unknown, value?: unknown) => void;
/** `app/device.js` stays a runtime script so the packaged widget keeps its Tizen adapter as is. */
interface FrameDevice {
  launchApp(id: string, done: Callback): void;
  home(done: Callback): void;
  settings(done: Callback): void;
  apps(done: Callback): void;
}
declare global { interface Window { FrameDevice?: FrameDevice } }

function adapter(): FrameDevice {
  const d = window.FrameDevice;
  if (!d) throw Error('FrameDevice is not loaded');
  return d;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function parseError(err: unknown): DeviceError | null {
  if (!err) return null;
  if (!isRecord(err)) return {};
  return { message: typeof err.message === 'string' ? err.message : undefined, detail: typeof err.detail === 'string' ? err.detail : undefined };
}

export function runDevice(op: DeviceOp, done: (error: DeviceError | null) => void): void {
  const cb: Callback = err => done(parseError(err));
  if (op.op === 'launch') adapter().launchApp(op.appId, cb);
  else if (op.op === 'home') adapter().home(cb);
  else adapter().settings(cb);
}

export function loadCatalog(done: (error: string | null, entries: CatalogEntry[]) => void): void {
  adapter().apps((err, value) => {
    const error = parseError(err);
    if (error) { done(error.message || 'Could not read installed apps.', []); return; }
    const entries = (Array.isArray(value) ? value : []).filter(isRecord).map(e => ({
      appId: typeof e.appId === 'string' ? e.appId : '',
      name: String(e.name),
      brand: typeof e.brand === 'string' ? e.brand : '',
      icon: safeIcon(e.icon)
    }));
    done(null, entries);
  });
}
