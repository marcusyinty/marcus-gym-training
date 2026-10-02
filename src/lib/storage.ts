// Safe localStorage tools: reads never crash, writes never crash, and writes can be debounced
// but are flushed immediately when the page is hidden or closed.

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface StoredItem<T> {
  key: string;
  fallback: T;
  // Turns stored text into a value. `dropped` is true when some of the stored data could not be used.
  parse: (raw: string) => { value: T; dropped: boolean };
  serialize: (value: T) => string;
}

// Accessing localStorage itself can throw (e.g. blocked site data), so this returns null instead.
export const getDefaultStorage = (): StorageLike | null => {
  try {
    return window.localStorage;
  } catch (e) {
    return null;
  }
};

export const backupKeyFor = (key: string) => `aesthetic_recomp_backup_${key}_raw`;

// Keeps the original text before any of it is dropped. An existing backup is never overwritten.
const backupRawOnce = (key: string, raw: string, storage: StorageLike) => {
  const backupKey = backupKeyFor(key);
  try {
    if (storage.getItem(backupKey) !== null) return;
    storage.setItem(backupKey, raw);
    console.warn(`[storage] Some saved data in "${key}" could not be used. The original was backed up to "${backupKey}".`);
  } catch (e) {
    console.warn(`[storage] Could not back up "${key}" before dropping unusable data.`, e);
  }
};

// Returns the fallback when the key is missing, the JSON is broken, or the shape is wrong.
export const safeRead = <T>(item: StoredItem<T>, storage: StorageLike | null = getDefaultStorage()): T => {
  if (!storage) return item.fallback;

  let raw: string | null;
  try {
    raw = storage.getItem(item.key);
  } catch (e) {
    console.warn(`[storage] Could not read "${item.key}".`, e);
    return item.fallback;
  }
  if (raw === null || raw === '') return item.fallback;

  let result: { value: T; dropped: boolean };
  try {
    result = item.parse(raw);
  } catch (e) {
    result = { value: item.fallback, dropped: true };
  }
  if (result.dropped) backupRawOnce(item.key, raw, storage);
  return result.value;
};

// Keys that already logged a failed save, so typing doesn't flood the console. Cleared once a save works again.
const warnedKeys = new Set<string>();

// Returns false if saving failed (private mode, storage full, ...). The app keeps working from memory.
export const safeWrite = (key: string, text: string, storage: StorageLike | null = getDefaultStorage()): boolean => {
  try {
    if (!storage) throw new Error('localStorage is not available');
    // Skipping identical writes also stops two open tabs from re-saving each other's changes forever
    if (storage.getItem(key) === text) return true;
    storage.setItem(key, text);
    warnedKeys.delete(key);
    return true;
  } catch (e) {
    if (!warnedKeys.has(key)) {
      warnedKeys.add(key);
      console.warn(`[storage] Could not save "${key}". Changes are kept in memory only.`, e);
    }
    return false;
  }
};

export interface DebouncedWriter<T> {
  schedule: (value: T) => void; // save `value` once there have been no changes for `delay` ms
  flush: () => void; // save the pending value right now
  cancel: () => void; // forget the pending value without saving it
}

export const createDebouncedWriter = <T>(
  item: StoredItem<T>,
  { delay = 300, storage = getDefaultStorage() }: { delay?: number; storage?: StorageLike | null } = {}
): DebouncedWriter<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { value: T } | null = null;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const flush = () => {
    clearTimer();
    if (!pending) return;
    const { value } = pending;
    pending = null;
    try {
      safeWrite(item.key, item.serialize(value), storage);
    } catch (e) {
      console.warn(`[storage] Could not prepare "${item.key}" for saving.`, e);
    }
  };

  return {
    schedule(value) {
      pending = { value };
      clearTimer();
      timer = setTimeout(flush, delay);
    },
    flush,
    cancel() {
      clearTimer();
      pending = null;
    },
  };
};

interface EventSource {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

// Calls `callback` when the page is hidden (app switch, tab switch) or closed. Phones can kill a page
// at any time after this, so it's the last safe moment to save. Returns a function that stops listening.
export const onPageHide = (
  callback: () => void,
  win: EventSource = window,
  doc: EventSource & { visibilityState: DocumentVisibilityState } = document
): (() => void) => {
  const handleVisibilityChange = () => {
    if (doc.visibilityState === 'hidden') callback();
  };
  doc.addEventListener('visibilitychange', handleVisibilityChange);
  win.addEventListener('pagehide', callback);
  return () => {
    doc.removeEventListener('visibilitychange', handleVisibilityChange);
    win.removeEventListener('pagehide', callback);
  };
};
