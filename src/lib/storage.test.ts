import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backupKeyFor, createDebouncedWriter, onPageHide, safeRead, safeWrite, StorageLike } from './storage';
import {
  completedSetsItem,
  languageItem,
  previousBestsItem,
  restSoundItem,
  saveDefaultWeightUnitIfMissing,
  setDetailsItem,
  weightUnitItem,
} from './savedData';

// In-memory stand-in for localStorage
class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  setItemCalls = 0;
  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.data.set(k, v);
  }
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.setItemCalls++;
    this.data.set(key, value);
  }
}

// Behaves like a full storage or private mode: every save throws
class FailingStorage extends MemoryStorage {
  setItem(): void {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  }
}

// Exact text written by the current app (recorded from a real session)
const OLD_FORMAT = {
  language_preference: 'zh',
  aesthetic_recomp_completed_sets_v2: '{"incline-db-press":[0,1],"lat-pulldown":[0],"leg-press":[0]}',
  aesthetic_recomp_set_details_v2:
    '{"incline-db-press":{"0":{"setNumber":1,"weight":"60","reps":"8","unit":"kg","completed":true,"timestamp":"2026-10-02T15:09:36.888Z"},"1":{"setNumber":2,"weight":"62.5","reps":"6","unit":"kg","completed":true,"timestamp":"2026-10-02T15:09:37.185Z"}},"lat-pulldown":{"0":{"setNumber":1,"weight":"135","reps":"10","unit":"lbs","completed":true,"timestamp":"2026-10-02T15:09:37.494Z"}},"leg-press":{"0":{"setNumber":1,"weight":"100","reps":"5","unit":"kg","completed":true,"timestamp":"2026-10-02T15:09:38.255Z"}}}',
  aesthetic_recomp_previous_bests_v2:
    '{"incline-db-press":{"weight":"62.5","reps":"6","unit":"kg"},"lat-pulldown":{"weight":"135","reps":"10","unit":"lbs"},"leg-press":{"weight":"100","reps":"5","unit":"kg"}}',
};

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('safeRead', () => {
  it('returns the fallback when the key is missing, without making a backup', () => {
    const storage = new MemoryStorage();
    expect(safeRead(completedSetsItem, storage)).toEqual({});
    expect(safeRead(languageItem, storage)).toBe('en');
    expect(storage.setItemCalls).toBe(0);
  });

  it('returns the fallback when storage itself is unavailable', () => {
    expect(safeRead(setDetailsItem, null)).toEqual({});
  });

  it('returns the fallback for broken JSON and backs up the original text', () => {
    const storage = new MemoryStorage({ [completedSetsItem.key]: '{"bench":[0,1' });
    expect(safeRead(completedSetsItem, storage)).toEqual({});
    expect(storage.getItem(backupKeyFor(completedSetsItem.key))).toBe('{"bench":[0,1');
  });

  it('returns the fallback when the whole value has the wrong shape', () => {
    for (const raw of ['null', '[1,2,3]', '42', '"text"']) {
      expect(safeRead(previousBestsItem, new MemoryStorage({ [previousBestsItem.key]: raw }))).toEqual({});
    }
  });

  it('drops only the bad entries and keeps the good ones', () => {
    const storage = new MemoryStorage({
      [completedSetsItem.key]: '{"bench":[0,"x",2,-1,1.5],"squat":"oops","row":[1]}',
      [setDetailsItem.key]:
        '{"bench":{"0":{"setNumber":1,"weight":"60","reps":"8","unit":"kg","completed":true},"1":{"weight":60,"reps":"8","unit":"kg"},"x":{"weight":"1","reps":"1","unit":"kg"}},"squat":null}',
      [previousBestsItem.key]: '{"bench":{"weight":"60","reps":"8","unit":"stone"},"row":{"weight":"50","reps":"10","unit":"lbs"}}',
    });

    expect(safeRead(completedSetsItem, storage)).toEqual({ bench: [0, 2], row: [1] });
    expect(safeRead(setDetailsItem, storage)).toEqual({
      bench: { 0: { setNumber: 1, weight: '60', reps: '8', unit: 'kg', completed: true } },
    });
    expect(safeRead(previousBestsItem, storage)).toEqual({ row: { weight: '50', reps: '10', unit: 'lbs' } });
  });

  it('accepts set details with or without the old "completed" field and leaves the text alone', () => {
    const raw =
      '{"bench":{"0":{"setNumber":1,"weight":"60","reps":"8","unit":"kg","completed":true},"1":{"setNumber":2,"weight":"60","reps":"8","unit":"kg","completed":false},"2":{"setNumber":3,"weight":"60","reps":"8","unit":"kg","timestamp":"2026-10-02T15:09:36.888Z"}}}';
    const storage = new MemoryStorage({ [setDetailsItem.key]: raw });
    const value = safeRead(setDetailsItem, storage);
    expect(Object.keys(value.bench)).toEqual(['0', '1', '2']);
    expect(setDetailsItem.serialize(value)).toBe(raw);
    expect(storage.getItem(backupKeyFor(setDetailsItem.key))).toBeNull();
  });

  it('loads the old saved format unchanged, with no backup, and saves it back byte-for-byte', () => {
    const storage = new MemoryStorage(OLD_FORMAT);
    for (const item of [languageItem, completedSetsItem, setDetailsItem, previousBestsItem]) {
      const value = safeRead<unknown>(item as never, storage);
      expect((item.serialize as (v: unknown) => string)(value)).toBe(OLD_FORMAT[item.key as keyof typeof OLD_FORMAT]);
      expect(storage.getItem(backupKeyFor(item.key))).toBeNull();
    }
    expect(storage.setItemCalls).toBe(0);
  });

  it('treats an unknown language as English and backs it up', () => {
    const storage = new MemoryStorage({ [languageItem.key]: 'fr' });
    expect(safeRead(languageItem, storage)).toBe('en');
    expect(storage.getItem(backupKeyFor(languageItem.key))).toBe('fr');
  });
});

describe('backup before dropping data', () => {
  it('uses the backup key name aesthetic_recomp_backup_<key>_raw', () => {
    expect(backupKeyFor('aesthetic_recomp_completed_sets_v2')).toBe(
      'aesthetic_recomp_backup_aesthetic_recomp_completed_sets_v2_raw'
    );
  });

  it('saves the original raw text the first time something is dropped', () => {
    const raw = '{"bench":[0,"x"]}';
    const storage = new MemoryStorage({ [completedSetsItem.key]: raw });
    safeRead(completedSetsItem, storage);
    expect(storage.getItem(backupKeyFor(completedSetsItem.key))).toBe(raw);
    // The original key itself is left untouched by reading
    expect(storage.getItem(completedSetsItem.key)).toBe(raw);
  });

  it('never overwrites an existing backup', () => {
    const backupKey = backupKeyFor(completedSetsItem.key);
    const storage = new MemoryStorage({ [completedSetsItem.key]: '{"bench":[0,"x"]}', [backupKey]: 'first backup' });
    safeRead(completedSetsItem, storage);
    storage.data.set(completedSetsItem.key, '{"bench":"broken again"}');
    safeRead(completedSetsItem, storage);
    expect(storage.getItem(backupKey)).toBe('first backup');
  });

  it('still returns the cleaned data if the backup cannot be saved', () => {
    const storage = new FailingStorage({ [completedSetsItem.key]: '{"bench":[0,"x"]}' });
    expect(safeRead(completedSetsItem, storage)).toEqual({ bench: [0] });
  });
});

describe('safeWrite', () => {
  it('skips the write when the same text is already stored', () => {
    const storage = new MemoryStorage({ k: '{"a":1}' });
    expect(safeWrite('k', '{"a":1}', storage)).toBe(true);
    expect(storage.setItemCalls).toBe(0);
  });

  it('does not throw when saving fails, and warns once per key until a save works again', () => {
    const failing = new FailingStorage();
    expect(safeWrite('fail-key', 'a', failing)).toBe(false);
    expect(safeWrite('fail-key', 'b', failing)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);

    expect(safeWrite('fail-key', 'c', new MemoryStorage())).toBe(true);
    expect(safeWrite('fail-key', 'd', failing)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('createDebouncedWriter', () => {
  it('saves once, with the last value, 300ms after typing stops', () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const writer = createDebouncedWriter(previousBestsItem, { storage });

    for (const weight of ['6', '60', '62', '62.', '62.5']) {
      writer.schedule({ bench: { weight, reps: '6', unit: 'kg' } });
      vi.advanceTimersByTime(100);
    }
    expect(storage.setItemCalls).toBe(0);

    vi.advanceTimersByTime(200);
    expect(storage.setItemCalls).toBe(1);
    expect(storage.getItem(previousBestsItem.key)).toBe('{"bench":{"weight":"62.5","reps":"6","unit":"kg"}}');
  });

  it('flush saves the pending value immediately and does not save it twice', () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const writer = createDebouncedWriter(languageItem, { storage });
    writer.schedule('zh');
    writer.flush();
    expect(storage.getItem(languageItem.key)).toBe('zh');
    vi.advanceTimersByTime(1000);
    expect(storage.setItemCalls).toBe(1);
  });

  it('cancel forgets the pending value', () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const writer = createDebouncedWriter(languageItem, { storage });
    writer.schedule('zh');
    writer.cancel();
    writer.flush();
    vi.advanceTimersByTime(1000);
    expect(storage.setItemCalls).toBe(0);
  });
});

describe('onPageHide + flush (closing the tab right after typing)', () => {
  const makePage = () => ({
    win: new EventTarget(),
    doc: Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState }),
  });

  it('saves the last typed value on pagehide, before the 300ms debounce ends', () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const writer = createDebouncedWriter(completedSetsItem, { storage });
    const { win, doc } = makePage();
    onPageHide(writer.flush, win, doc);

    writer.schedule({ bench: [0, 1, 2] });
    vi.advanceTimersByTime(50);
    win.dispatchEvent(new Event('pagehide'));

    expect(storage.getItem(completedSetsItem.key)).toBe('{"bench":[0,1,2]}');
  });

  it('saves when the page becomes hidden, but not when it becomes visible', () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const writer = createDebouncedWriter(languageItem, { storage });
    const { win, doc } = makePage();
    onPageHide(writer.flush, win, doc);

    writer.schedule('zh');
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(storage.setItemCalls).toBe(0);

    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(storage.getItem(languageItem.key)).toBe('zh');
  });

  it('stops listening after the returned cleanup is called', () => {
    const callback = vi.fn();
    const { win, doc } = makePage();
    const stop = onPageHide(callback, win, doc);
    stop();
    win.dispatchEvent(new Event('pagehide'));
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('requestPersistentStorage', () => {
  // The module only asks once, so each test loads a fresh copy of it
  const loadFresh = async () => {
    vi.resetModules();
    return (await import('./storage')).requestPersistentStorage;
  };
  afterEach(() => vi.unstubAllGlobals());

  it('asks the browser only once', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persist } });
    const requestPersistentStorage = await loadFresh();
    requestPersistentStorage();
    requestPersistentStorage();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('never throws when unsupported, throwing, or rejected', async () => {
    vi.stubGlobal('navigator', {});
    expect(await loadFresh()).not.toThrow();

    vi.stubGlobal('navigator', { storage: { persist: () => { throw new Error('nope'); } } });
    expect(await loadFresh()).not.toThrow();

    vi.stubGlobal('navigator', { storage: { persist: () => Promise.reject(new Error('denied')) } });
    expect(await loadFresh()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalled();
  });
});

describe('weight unit setting (aesthetic_recomp_unit_v1)', () => {
  it('reads "kg" / "lbs" as plain text, and treats anything else as kg', () => {
    expect(safeRead(weightUnitItem, new MemoryStorage({ [weightUnitItem.key]: 'lbs' }))).toBe('lbs');
    expect(safeRead(weightUnitItem, new MemoryStorage({ [weightUnitItem.key]: 'kg' }))).toBe('kg');
    expect(safeRead(weightUnitItem, new MemoryStorage({ [weightUnitItem.key]: 'stone' }))).toBe('kg');
    expect(safeRead(weightUnitItem, new MemoryStorage())).toBe('kg');
  });

  it('on first run, saves the unit most sets were typed in, writing only the new key', () => {
    const storage = new MemoryStorage(OLD_FORMAT); // 3 sets with a weight in kg, 1 in lbs
    saveDefaultWeightUnitIfMissing(storage);
    expect(storage.getItem(weightUnitItem.key)).toBe('kg');
    expect(storage.setItemCalls).toBe(1);
    for (const [key, raw] of Object.entries(OLD_FORMAT)) expect(storage.getItem(key)).toBe(raw);
  });

  it('picks lbs when most sets with a weight are in lbs, and kg when there is no data', () => {
    const lbsUser = new MemoryStorage({
      [setDetailsItem.key]: '{"a":{"0":{"setNumber":1,"weight":"135","reps":"8","unit":"lbs"},"1":{"setNumber":2,"weight":"","reps":"8","unit":"kg"}}}',
    });
    saveDefaultWeightUnitIfMissing(lbsUser);
    expect(lbsUser.getItem(weightUnitItem.key)).toBe('lbs');

    const newUser = new MemoryStorage();
    saveDefaultWeightUnitIfMissing(newUser);
    expect(newUser.getItem(weightUnitItem.key)).toBe('kg');
  });

  it('never overwrites a unit that was already chosen', () => {
    const storage = new MemoryStorage({ ...OLD_FORMAT, [weightUnitItem.key]: 'lbs' });
    saveDefaultWeightUnitIfMissing(storage);
    expect(storage.getItem(weightUnitItem.key)).toBe('lbs');
    expect(storage.setItemCalls).toBe(0);
  });
});

describe('rest timer sound setting (aesthetic_recomp_rest_sound_v1)', () => {
  it('reads "on" / "off" as plain text, defaults to on, and treats anything else as on', () => {
    expect(safeRead(restSoundItem, new MemoryStorage())).toBe('on');
    expect(safeRead(restSoundItem, new MemoryStorage({ [restSoundItem.key]: 'off' }))).toBe('off');
    expect(safeRead(restSoundItem, new MemoryStorage({ [restSoundItem.key]: 'on' }))).toBe('on');
    expect(safeRead(restSoundItem, new MemoryStorage({ [restSoundItem.key]: 'loud' }))).toBe('on');
  });

  it('saves plain text', () => {
    expect(restSoundItem.serialize('off')).toBe('off');
    expect(restSoundItem.serialize('on')).toBe('on');
  });
});
