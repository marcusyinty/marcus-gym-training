import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppDataV3 } from '../model';
import { StorageLike } from '../storage';
import { createAppDataStore } from './appDataStore';
import { createBackupFile, parseBackupFile, PRE_RESTORE_PREFIX } from './backup';
import { BACKUP_KEY_V3, STORAGE_KEY_V3 } from './dataV3';
import { completedIndexes, previousBest, setDetails } from './selectors';

// Like localStorage (incl. key/length/removeItem); records every write and removal
class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  writes: string[] = [];
  removed: string[] = [];
  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.data.set(k, v);
  }
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.writes.push(key);
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.removed.push(key);
    this.data.delete(key);
  }
  snapshot() {
    return Object.fromEntries([...this.data.entries()].sort());
  }
}

const V2_RECORDED = {
  language_preference: 'zh',
  aesthetic_recomp_completed_sets_v2: '{"incline-db-press":[0,1],"lat-pulldown":[0],"leg-press":[0]}',
  aesthetic_recomp_set_details_v2:
    '{"incline-db-press":{"0":{"setNumber":1,"weight":"60","reps":"8","unit":"kg","completed":true,"timestamp":"2026-10-02T15:09:36.888Z"},"1":{"setNumber":2,"weight":"62.5","reps":"6","unit":"kg","completed":true,"timestamp":"2026-10-02T15:09:37.185Z"}},"lat-pulldown":{"0":{"setNumber":1,"weight":"135","reps":"10","unit":"lbs","completed":true,"timestamp":"2026-10-02T15:09:37.494Z"}},"leg-press":{"0":{"setNumber":1,"weight":"100","reps":"5","unit":"kg","completed":true,"timestamp":"2026-10-02T15:09:38.255Z"}}}',
  aesthetic_recomp_previous_bests_v2:
    '{"incline-db-press":{"weight":"62.5","reps":"6","unit":"kg"},"lat-pulldown":{"weight":"135","reps":"10","unit":"lbs"},"leg-press":{"weight":"100","reps":"5","unit":"kg"}}',
};
const V2_KEYS = ['language_preference', 'aesthetic_recomp_completed_sets_v2', 'aesthetic_recomp_set_details_v2', 'aesthetic_recomp_previous_bests_v2'];
const v2Snapshot = (storage: MemoryStorage) => V2_KEYS.map((k) => storage.getItem(k));

const options = (storage: MemoryStorage | null, makeId = () => 'cycle-1') => ({
  storage,
  now: () => new Date('2026-10-03T08:00:00.000Z'),
  makeId,
});
const tick = (slotId: string, setIndex: number) => ({ type: 'toggleSet' as const, slotId, setIndex, unit: 'kg' as const });

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("source 'error'", () => {
  it('never saves anything: not on load, not after changes, not on flush', () => {
    const storage = new MemoryStorage({ ...V2_RECORDED, [STORAGE_KEY_V3]: 'not json' });
    const before = storage.snapshot();
    const store = createAppDataStore(options(storage, () => { throw new Error('no ids'); }));
    expect(store.source).toBe('error');
    store.saveMigrated();
    store.dispatch(tick('incline-db-press', 2));
    store.dispatch({ type: 'editWeight', slotId: 'incline-db-press', setIndex: 2, weight: '70', unit: 'kg' });
    vi.advanceTimersByTime(5000);
    store.flush();
    expect(completedIndexes(store.getState(), 'incline-db-press')).toEqual([2]); // still works in memory
    expect([storage.writes, storage.snapshot()]).toEqual([[], before]);
  });

  it('ignores data arriving from another tab', () => {
    const storage = new MemoryStorage(V2_RECORDED);
    const store = createAppDataStore(options(storage, () => { throw new Error('no ids'); }));
    const state = store.getState();
    store.receiveExternal(JSON.stringify({ ...state, bests: { x: { weight: '1', reps: '1', unit: 'kg' } } }));
    expect(store.getState()).toBe(state);
    expect(storage.writes).toEqual([]);
  });
});

describe("source 'migrated'", () => {
  it('saves the migrated data to the v3 key exactly once, and never touches the v2 keys', () => {
    const storage = new MemoryStorage(V2_RECORDED);
    const v2Before = v2Snapshot(storage);
    const store = createAppDataStore(options(storage));
    expect([store.source, storage.writes]).toEqual(['migrated', []]); // loading itself writes nothing
    store.saveMigrated();
    store.saveMigrated(); // e.g. React running the startup effect twice
    expect(storage.writes).toEqual([STORAGE_KEY_V3]);
    expect(JSON.parse(storage.getItem(STORAGE_KEY_V3)!)).toEqual(store.getState());
    expect(previousBest(store.getState(), 'lat-pulldown')).toEqual({ weight: '135', reps: '10', unit: 'lbs' });
    expect(v2Snapshot(storage)).toEqual(v2Before);
  });

  it('a reload after the migration loads v3 and writes nothing', () => {
    const storage = new MemoryStorage(V2_RECORDED);
    createAppDataStore(options(storage)).saveMigrated();
    const reloaded = createAppDataStore(options(storage, () => 'other-id'));
    reloaded.saveMigrated();
    expect([reloaded.source, storage.writes]).toEqual(['v3', [STORAGE_KEY_V3]]);
    expect(reloaded.getState().currentCycle.id).toBe('cycle-1');
  });
});

describe("sources 'v3' and 'fresh'", () => {
  it("'v3': nothing written on load; a change is saved 300ms later", () => {
    const storage = new MemoryStorage(V2_RECORDED);
    createAppDataStore(options(storage)).saveMigrated();
    storage.writes = [];
    const store = createAppDataStore(options(storage));
    store.saveMigrated();
    store.flush();
    expect(storage.writes).toEqual([]);
    store.dispatch(tick('lat-pulldown', 1));
    vi.advanceTimersByTime(299);
    expect(storage.writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(storage.writes).toEqual([STORAGE_KEY_V3]);
  });

  it("'fresh': nothing written until the user changes something; quick changes are saved once", () => {
    const storage = new MemoryStorage({ language_preference: 'en', aesthetic_recomp_unit_v1: 'kg' });
    const store = createAppDataStore(options(storage));
    store.saveMigrated();
    vi.advanceTimersByTime(1000);
    expect([store.source, storage.writes]).toEqual(['fresh', []]);
    store.dispatch({ type: 'editWeight', slotId: 'bench', setIndex: 0, weight: '6', unit: 'kg' });
    store.dispatch({ type: 'editWeight', slotId: 'bench', setIndex: 0, weight: '60', unit: 'kg' });
    store.dispatch(tick('bench', 0));
    vi.advanceTimersByTime(300);
    expect(storage.writes).toEqual([STORAGE_KEY_V3]);
    expect(setDetails(JSON.parse(storage.getItem(STORAGE_KEY_V3)!), 'bench')[0].weight).toBe('60');
  });

  it('flush (page hidden/closed) saves a pending change immediately', () => {
    const storage = new MemoryStorage();
    const store = createAppDataStore(options(storage));
    store.dispatch(tick('bench', 0));
    store.flush();
    expect(storage.writes).toEqual([STORAGE_KEY_V3]);
  });

  it('a change that changes nothing is not saved', () => {
    const storage = new MemoryStorage();
    const store = createAppDataStore(options(storage));
    store.dispatch({ type: 'setTag', slotId: 'bench', setIndex: 9, tag: 'max' });
    vi.advanceTimersByTime(1000);
    expect(storage.writes).toEqual([]);
  });
});

describe('two tabs', () => {
  it('data from another tab is adopted and not written back (no loop)', () => {
    const shared = new MemoryStorage();
    const tabA = createAppDataStore(options(shared, () => 'a'));
    const tabB = createAppDataStore(options(shared, () => 'b'));
    tabA.dispatch(tick('bench', 0));
    tabA.flush();
    const written = shared.getItem(STORAGE_KEY_V3)!;
    shared.writes = [];

    let notified = 0;
    tabB.subscribe(() => notified++);
    tabB.receiveExternal(written);
    vi.advanceTimersByTime(1000);
    tabB.flush();
    expect(completedIndexes(tabB.getState(), 'bench')).toEqual([0]);
    expect([notified, shared.writes]).toEqual([1, []]);
  });

  it("the other tab's newer save replaces a change still waiting here", () => {
    const shared = new MemoryStorage();
    const tabA = createAppDataStore(options(shared, () => 'a'));
    const tabB = createAppDataStore(options(shared, () => 'b'));
    tabB.dispatch(tick('squat', 0)); // pending in B
    tabA.dispatch(tick('bench', 0));
    tabA.flush();
    shared.writes = [];
    tabB.receiveExternal(shared.getItem(STORAGE_KEY_V3));
    vi.advanceTimersByTime(1000);
    expect(shared.writes).toEqual([]);
    expect(completedIndexes(tabB.getState(), 'squat')).toEqual([]);
  });

  it('removed key or unreadable text from another tab is ignored', () => {
    const storage = new MemoryStorage(V2_RECORDED);
    const store = createAppDataStore(options(storage));
    const state = store.getState();
    for (const raw of [null, 'not json', '{"schemaVersion":2}']) store.receiveExternal(raw);
    expect(store.getState()).toBe(state);
    expect(storage.writes).toEqual([]);
  });
});

describe('storage blocked', () => {
  it('works in memory with no storage at all', () => {
    const store = createAppDataStore(options(null));
    store.dispatch(tick('bench', 0));
    vi.advanceTimersByTime(1000);
    expect([store.source, completedIndexes(store.getState(), 'bench')]).toEqual(['fresh', [0]]);
  });
});

describe('restore from a backup', () => {
  // A backup's data (as parseBackupFile returns it): one archived week, two ticked sets
  const BACKUP_DATA: AppDataV3 = {
    schemaVersion: 3,
    currentCycle: {
      id: 'restored-week',
      startedAt: '2026-09-28T06:00:00.000Z',
      slots: { rdl: { slotId: 'rdl', exerciseId: 'rdl', performedExerciseId: 'rdl', sets: { 0: { weight: '100', reps: '5', unit: 'kg', done: true } } } },
    },
    archivedCycles: [
      { id: 'old-week', startedAt: '2026-09-21T06:00:00.000Z', endedAt: '2026-09-27T20:00:00.000Z', slots: { squat: { slotId: 'squat', exerciseId: 'squat', performedExerciseId: 'squat', sets: { 0: { weight: '80', reps: '8', unit: 'kg', done: true } } } } },
    ],
    bests: { rdl: { weight: '100', reps: '5', unit: 'kg' } },
    reportShownCycleIds: ['old-week'],
  };
  const OTHER_KEYS = { aesthetic_recomp_unit_v1: 'lbs', aesthetic_recomp_rest_sound_v1: 'off', [BACKUP_KEY_V3]: 'an older raw backup' };
  // A clock that moves on 1 minute per call, so every safety copy gets its own time
  const movingClock = () => {
    let minute = 0;
    return () => new Date(Date.UTC(2026, 9, 4, 8, minute++));
  };
  const safetyCopies = (storage: MemoryStorage) => [...storage.data.keys()].filter((k) => k.startsWith(PRE_RESTORE_PREFIX)).sort();

  it('keeps a copy of the latest saved data (incl. a change still waiting), then saves the backup right away', () => {
    const storage = new MemoryStorage({ ...V2_RECORDED, ...OTHER_KEYS });
    createAppDataStore(options(storage)).saveMigrated();
    const store = createAppDataStore({ ...options(storage), now: movingClock() });
    store.dispatch(tick('bench', 0)); // not saved yet (300ms)
    const latest = JSON.stringify(store.getState());
    let notified = 0;
    store.subscribe(() => notified++);

    expect(store.restore(BACKUP_DATA)).toEqual({ ok: true });
    const [copy] = safetyCopies(storage);
    expect(safetyCopies(storage)).toHaveLength(1);
    expect(storage.getItem(copy)).toBe(latest);
    expect(JSON.parse(storage.getItem(STORAGE_KEY_V3)!)).toEqual(BACKUP_DATA);
    expect(store.getState()).toEqual(BACKUP_DATA);
    expect([notified, store.getReplacedCount(), store.isSavingDisabled()]).toEqual([1, 1, false]);
    vi.advanceTimersByTime(1000); // the old waiting change never comes back
    expect(JSON.parse(storage.getItem(STORAGE_KEY_V3)!)).toEqual(BACKUP_DATA);
    expect(v2Snapshot(storage)).toEqual(Object.values(V2_RECORDED));
    for (const [k, v] of Object.entries(OTHER_KEYS)) expect(storage.getItem(k)).toBe(v);

    store.dispatch(tick('rdl', 1)); // saving goes on as normal
    vi.advanceTimersByTime(300);
    expect(completedIndexes(JSON.parse(storage.getItem(STORAGE_KEY_V3)!), 'rdl')).toEqual([0, 1]);
  });

  it('keeps only the 3 newest safety copies; nothing else is removed', () => {
    const storage = new MemoryStorage({ ...V2_RECORDED, ...OTHER_KEYS });
    const store = createAppDataStore({ ...options(storage), now: movingClock() });
    store.saveMigrated();
    const texts: string[] = [];
    for (let i = 0; i < 5; i++) {
      texts.push(storage.getItem(STORAGE_KEY_V3)!);
      expect(store.restore({ ...BACKUP_DATA, bests: { [`ex-${i}`]: { weight: String(i + 1), reps: '1', unit: 'kg' } } }).ok).toBe(true);
    }
    const copies = safetyCopies(storage);
    expect(copies.map((k) => storage.getItem(k))).toEqual(texts.slice(2)); // the 3 newest, oldest first
    expect(storage.removed).toEqual([...storage.removed].filter((k) => k.startsWith(PRE_RESTORE_PREFIX)));
    expect(storage.removed).toHaveLength(2);
    expect(v2Snapshot(storage)).toEqual(Object.values(V2_RECORDED));
    for (const [k, v] of Object.entries(OTHER_KEYS)) expect(storage.getItem(k)).toBe(v);
  });

  it('nothing saved yet: no safety copy, the backup is saved', () => {
    const storage = new MemoryStorage({ language_preference: 'en' });
    const store = createAppDataStore(options(storage));
    expect(store.restore(BACKUP_DATA)).toEqual({ ok: true });
    expect(storage.writes).toEqual([STORAGE_KEY_V3]);
    expect(storage.getItem('language_preference')).toBe('en');
  });

  it('in an error session: keeps the unreadable text, saves the backup and turns saving back on', () => {
    const storage = new MemoryStorage({ ...V2_RECORDED, [STORAGE_KEY_V3]: 'not json' });
    const store = createAppDataStore(options(storage, () => { throw new Error('no ids'); }));
    expect([store.source, store.isSavingDisabled()]).toEqual(['error', true]);
    store.dispatch(tick('bench', 0)); // in memory only
    vi.advanceTimersByTime(1000);
    expect(storage.writes).toEqual([]);

    expect(store.restore(BACKUP_DATA)).toEqual({ ok: true });
    expect(safetyCopies(storage).map((k) => storage.getItem(k))).toEqual(['not json']);
    expect(JSON.parse(storage.getItem(STORAGE_KEY_V3)!)).toEqual(BACKUP_DATA);
    expect(store.isSavingDisabled()).toBe(false);
    store.dispatch(tick('rdl', 1));
    vi.advanceTimersByTime(300);
    expect(completedIndexes(JSON.parse(storage.getItem(STORAGE_KEY_V3)!), 'rdl')).toEqual([0, 1]);
    expect(v2Snapshot(storage)).toEqual(Object.values(V2_RECORDED));
  });

  it('storage full or blocked: nothing changes', () => {
    const fullFor = (failKey: (key: string) => boolean) => {
      const storage = new MemoryStorage({ ...V2_RECORDED });
      createAppDataStore(options(storage)).saveMigrated();
      storage.setItem = (key, value) => {
        if (failKey(key)) throw new DOMException('full', 'QuotaExceededError');
        storage.data.set(key, value);
      };
      return storage;
    };
    const withOldCopies = (storage: MemoryStorage) => {
      for (const day of ['01', '02', '03']) storage.data.set(`${PRE_RESTORE_PREFIX}2026-09-${day}T10:00:00.000Z`, 'old copy');
      return storage;
    };
    const cases = [
      { storage: withOldCopies(fullFor((k) => k.startsWith(PRE_RESTORE_PREFIX))), error: 'safetyCopyFailed' },
      { storage: withOldCopies(fullFor((k) => k === STORAGE_KEY_V3)), error: 'saveFailed' },
    ];
    for (const { storage, error } of cases) {
      const store = createAppDataStore(options(storage));
      const before = store.getState();
      const savedBefore = storage.getItem(STORAGE_KEY_V3);
      let notified = 0;
      store.subscribe(() => notified++);
      expect(store.restore(BACKUP_DATA)).toEqual({ ok: false, error });
      expect([store.getState(), storage.getItem(STORAGE_KEY_V3), notified, store.getReplacedCount()]).toEqual([before, savedBefore, 0, 0]);
      expect(storage.removed).toEqual([]); // a failed restore never removes an older safety copy
      expect(v2Snapshot(storage)).toEqual(Object.values(V2_RECORDED));
    }

    const unreadable = new MemoryStorage();
    const store = createAppDataStore(options(unreadable));
    unreadable.getItem = () => { throw new Error('blocked'); };
    expect(store.restore(BACKUP_DATA)).toEqual({ ok: false, error: 'safetyCopyFailed' });
    expect(createAppDataStore(options(null)).restore(BACKUP_DATA)).toEqual({ ok: false, error: 'noStorage' });
  });

  it('an error session stays in error mode when the restore fails', () => {
    const storage = new MemoryStorage({ ...V2_RECORDED });
    const store = createAppDataStore(options(storage, () => { throw new Error('no ids'); }));
    storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    expect(store.restore(BACKUP_DATA)).toEqual({ ok: false, error: 'saveFailed' });
    expect(store.isSavingDisabled()).toBe(true);
  });

  it('other tabs adopt the restored data (counted as replaced); an error-session tab ignores it', () => {
    const shared = new MemoryStorage({ ...V2_RECORDED });
    createAppDataStore(options(shared)).saveMigrated();
    const tabA = createAppDataStore({ ...options(shared), now: movingClock() });
    const tabB = createAppDataStore(options(shared));
    expect(tabA.restore(BACKUP_DATA).ok).toBe(true);
    const writesAfterRestore = shared.writes.length;
    tabB.receiveExternal(shared.getItem(STORAGE_KEY_V3)); // what the "storage" event delivers
    vi.advanceTimersByTime(1000);
    tabB.flush();
    expect([tabB.getState(), tabB.getReplacedCount(), shared.writes.length]).toEqual([BACKUP_DATA, 1, writesAfterRestore]);

    const errorShared = new MemoryStorage({ ...V2_RECORDED });
    const errorTab = createAppDataStore(options(errorShared, () => { throw new Error('no ids'); }));
    const state = errorTab.getState();
    errorTab.receiveExternal(JSON.stringify(BACKUP_DATA));
    expect([errorTab.getState(), errorTab.getReplacedCount()]).toEqual([state, 0]);
  });
});

describe('start new week and stale tabs', () => {
  // makeId that hands out the given ids in order
  const ids = (...list: string[]) => {
    let i = 0;
    return () => list[i++] ?? `extra-${i}`;
  };
  const stored = (storage: MemoryStorage) => JSON.parse(storage.getItem(STORAGE_KEY_V3)!) as AppDataV3;
  const weekOne = (storage: MemoryStorage) => {
    const store = createAppDataStore(options(storage, ids('w1', 'w2', 'w3')));
    store.dispatch(tick('bench', 0));
    store.flush();
    return store;
  };

  it('saves a change still waiting (300ms) first, then the new week right away', () => {
    const storage = new MemoryStorage();
    const store = createAppDataStore(options(storage, ids('w1', 'w2')));
    store.dispatch(tick('bench', 0));
    store.dispatch(tick('bench', 1)); // still waiting
    expect(store.startNewWeek('w1')).toEqual({ ok: true });
    const saved = stored(storage); // no timers needed: already saved
    expect(saved.archivedCycles.map((c) => [c.id, completedIndexes({ ...saved, currentCycle: c }, 'bench')])).toEqual([['w1', [0, 1]]]);
    expect(saved.archivedCycles[0].endedAt).toBe('2026-10-03T08:00:00.000Z');
    expect(saved.currentCycle).toEqual({ id: 'w2', startedAt: '2026-10-03T08:00:00.000Z', slots: {} });
    expect(store.getState()).toEqual(saved);
    vi.advanceTimersByTime(1000);
    expect(stored(storage)).toEqual(saved); // the old waiting save never comes back
  });

  it('is refused for an empty week, in an error session, or when the store cannot save; nothing changes', () => {
    const empty = new MemoryStorage();
    const emptyStore = createAppDataStore(options(empty, ids('w1', 'w2')));
    emptyStore.dispatch({ type: 'editWeight', slotId: 'bench', setIndex: 0, weight: '60', unit: 'kg' }); // typed, not ticked
    emptyStore.flush();
    const before = empty.getItem(STORAGE_KEY_V3);
    expect(emptyStore.startNewWeek('w1')).toEqual({ ok: false, reason: 'empty' });
    expect(empty.getItem(STORAGE_KEY_V3)).toBe(before);

    const errorStorage = new MemoryStorage({ ...V2_RECORDED });
    const errorStore = createAppDataStore(options(errorStorage, () => { throw new Error('no ids'); }));
    errorStore.dispatch(tick('bench', 0));
    expect(errorStore.startNewWeek(errorStore.getState().currentCycle.id)).toEqual({ ok: false, reason: 'savingOff' });
    expect(errorStorage.writes).toEqual([]);

    const full = new MemoryStorage();
    const fullStore = weekOne(full);
    const saved = full.getItem(STORAGE_KEY_V3);
    full.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    expect(fullStore.startNewWeek('w1')).toEqual({ ok: false, reason: 'saveFailed' });
    expect([fullStore.getState().currentCycle.id, full.getItem(STORAGE_KEY_V3)]).toEqual(['w1', saved]);
  });

  it('a stale tab (it missed the news) cannot archive the same week twice', () => {
    const shared = new MemoryStorage();
    const tabA = weekOne(shared);
    const tabB = createAppDataStore(options(shared, ids('b-new')));
    expect(tabA.startNewWeek('w1')).toEqual({ ok: true });
    const writes = shared.writes.length;
    // B never got the "storage" event and still shows week w1
    expect(tabB.getState().currentCycle.id).toBe('w1');
    expect(tabB.startNewWeek('w1')).toEqual({ ok: false, reason: 'alreadyStarted' });
    expect(stored(shared).archivedCycles.map((c) => c.id)).toEqual(['w1']);
    expect([tabB.getState(), shared.writes.length]).toEqual([stored(shared), writes]); // B now shows the new week, wrote nothing
  });

  it("a stale tab's tick after the other tab started a new week: the week survives, the tick is dropped and counted", () => {
    const shared = new MemoryStorage();
    const tabA = weekOne(shared);
    const tabB = createAppDataStore(options(shared));
    tabA.startNewWeek('w1');
    tabA.dispatch(tick('squat', 0)); // A trains in the new week
    tabA.flush();
    const aText = shared.getItem(STORAGE_KEY_V3);
    tabB.dispatch(tick('deadlift', 0)); // B, still on week w1
    vi.advanceTimersByTime(300);
    expect(shared.getItem(STORAGE_KEY_V3)).toBe(aText);
    expect([tabB.getState(), tabB.getDroppedChangeCount()]).toEqual([stored(shared), 1]);
    expect(completedIndexes(tabB.getState(), 'squat')).toEqual([0]);
  });

  it('worst case, both tabs start a new week at the same moment: one copy of the week, nothing lost', () => {
    const shared = new MemoryStorage();
    const tabA = weekOne(shared);
    // B reads storage before A's save lands (a real race between two tabs), so it sees no news
    const stale = shared.getItem(STORAGE_KEY_V3);
    const tabB = createAppDataStore({ ...options(shared, ids('b-new')), storage: { ...shared, getItem: (k: string) => (k === STORAGE_KEY_V3 ? stale : shared.getItem(k)), setItem: (k: string, v: string) => shared.setItem(k, v) } });
    expect(tabA.startNewWeek('w1')).toEqual({ ok: true });
    expect(tabB.startNewWeek('w1')).toEqual({ ok: true });
    tabA.receiveExternal(shared.getItem(STORAGE_KEY_V3)); // A hears about B's save
    const saved = stored(shared);
    expect(saved.archivedCycles.map((c) => [c.id, completedIndexes({ ...saved, currentCycle: c }, 'bench')])).toEqual([['w1', [0]]]);
    expect([saved.currentCycle.id, tabA.getState()]).toEqual(['b-new', saved]);
  });

  it('back on screen, a page picks up what another tab saved meanwhile (not in an error session)', () => {
    const shared = new MemoryStorage({ ...V2_RECORDED });
    createAppDataStore(options(shared)).saveMigrated();
    const tabA = createAppDataStore(options(shared));
    const tabB = createAppDataStore(options(shared));
    tabA.dispatch(tick('bench', 0));
    tabA.flush();
    const writes = shared.writes.length;
    tabB.syncFromStorage();
    tabB.syncFromStorage(); // nothing new the second time
    expect([completedIndexes(tabB.getState(), 'bench'), tabB.getReplacedCount(), shared.writes.length]).toEqual([[0], 1, writes]);

    const errorStorage = new MemoryStorage({ ...V2_RECORDED });
    const errorStore = createAppDataStore(options(errorStorage, () => { throw new Error('no ids'); }));
    const state = errorStore.getState();
    errorStorage.data.set(STORAGE_KEY_V3, shared.getItem(STORAGE_KEY_V3)!);
    errorStore.syncFromStorage();
    expect([errorStore.source, errorStore.getState()]).toEqual(['error', state]);
  });

  it('a live update from another tab that replaces a waiting change is counted too', () => {
    const shared = new MemoryStorage();
    const tabA = createAppDataStore(options(shared, ids('a')));
    const tabB = createAppDataStore(options(shared, ids('b')));
    tabB.dispatch(tick('squat', 0)); // waiting in B
    tabA.dispatch(tick('bench', 0));
    tabA.flush();
    tabB.receiveExternal(shared.getItem(STORAGE_KEY_V3));
    expect(tabB.getDroppedChangeCount()).toBe(1);
  });

  it('a restore carries 3 archived weeks; another tab adopts them in order', () => {
    const shared = new MemoryStorage();
    const tabA = weekOne(shared);
    const tabB = createAppDataStore(options(shared));
    const week = (n: number) => ({ id: `old-${n}`, startedAt: `2026-09-0${n}T06:00:00.000Z`, endedAt: `2026-09-0${n + 6}T20:00:00.000Z`, slots: { rdl: { slotId: 'rdl', exerciseId: 'rdl', performedExerciseId: 'rdl', sets: { 0: { weight: String(90 + n), reps: '5', unit: 'kg' as const, done: true } } } } });
    const backup: AppDataV3 = { ...tabA.getState(), archivedCycles: [week(1), week(2), week(3)] };
    const parsed = parseBackupFile(createBackupFile(backup, new Date('2026-10-03T08:00:00.000Z')).text);
    if (!parsed.ok) throw new Error('expected ok');
    expect(tabA.restore(parsed.data)).toEqual({ ok: true });
    tabB.receiveExternal(shared.getItem(STORAGE_KEY_V3));
    for (const data of [stored(shared), tabB.getState()]) expect(data.archivedCycles.map((c) => c.id)).toEqual(['old-1', 'old-2', 'old-3']);
    expect(stored(shared)).toEqual(backup);
  });
});

describe('swapping a slot (saved right away, stale tabs)', () => {
  const ids = (...list: string[]) => {
    let i = 0;
    return () => list[i++] ?? `extra-${i}`;
  };
  const stored = (storage: MemoryStorage) => JSON.parse(storage.getItem(STORAGE_KEY_V3)!) as AppDataV3;
  const request = (cycleId: string, from = 'leg-press', to = 'hack-squat') => ({ cycleId, slotId: 'leg-press', from, to });

  it('a swap is saved straight away; typed values are cleared and reported', () => {
    const storage = new MemoryStorage();
    const store = createAppDataStore(options(storage, ids('w1')));
    store.dispatch({ type: 'editWeight', slotId: 'leg-press', setIndex: 0, weight: '220', unit: 'kg' }); // waiting, not ticked
    expect(store.swapExercise(request('w1'))).toEqual({ ok: true, clearedTypedValues: true, updatedFromOtherTab: false });
    expect(stored(storage).currentCycle.slots['leg-press']).toEqual({ slotId: 'leg-press', exerciseId: 'leg-press', performedExerciseId: 'hack-squat', sets: {} });
    vi.advanceTimersByTime(1000);
    expect(stored(storage).currentCycle.slots['leg-press'].sets).toEqual({}); // the old waiting change never comes back
  });

  it('a stale tab cannot swap a slot that another tab ticked meanwhile', () => {
    const shared = new MemoryStorage();
    const tabA = createAppDataStore(options(shared, ids('w1')));
    tabA.flush();
    tabA.dispatch(tick('squat', 0));
    tabA.flush();
    const tabB = createAppDataStore(options(shared));
    tabA.dispatch(tick('leg-press', 0));
    tabA.flush();
    const writes = shared.writes.length;
    // B never heard about A's tick on leg-press
    expect(tabB.swapExercise(request('w1'))).toEqual({ ok: false, reason: 'hasTickedSets', updatedFromOtherTab: true });
    expect([shared.writes.length, completedIndexes(tabB.getState(), 'leg-press')]).toEqual([writes, [0]]);
  });

  it('a stale tab cannot swap again what another tab already swapped, nor swap in an old week', () => {
    const shared = new MemoryStorage();
    const tabA = createAppDataStore(options(shared, ids('w1', 'w2')));
    tabA.dispatch(tick('squat', 0));
    tabA.flush();
    const tabB = createAppDataStore(options(shared));
    expect(tabA.swapExercise(request('w1')).ok).toBe(true);
    expect(tabB.swapExercise(request('w1'))).toEqual({ ok: false, reason: 'changedElsewhere', updatedFromOtherTab: true });
    const tabC = createAppDataStore(options(shared));
    expect(tabA.startNewWeek('w1')).toEqual({ ok: true });
    expect(tabC.swapExercise(request('w1', 'hack-squat', 'leg-press'))).toEqual({ ok: false, reason: 'weekChanged', updatedFromOtherTab: true });
    expect(stored(shared).archivedCycles.map((c) => c.slots['leg-press']?.performedExerciseId)).toEqual(['hack-squat']);
  });

  it("a waiting change of this tab is saved first; another tab's data is kept", () => {
    const shared = new MemoryStorage();
    const tabA = createAppDataStore(options(shared, ids('w1')));
    tabA.flush();
    tabA.dispatch(tick('bench', 0)); // waiting in A
    expect(tabA.swapExercise(request('w1')).ok).toBe(true);
    expect([completedIndexes(stored(shared), 'bench'), stored(shared).currentCycle.slots['leg-press'].performedExerciseId]).toEqual([[0], 'hack-squat']);
  });

  it('refused in an error session or when storage is full; nothing changes', () => {
    const errorStorage = new MemoryStorage({ ...V2_RECORDED });
    const errorStore = createAppDataStore(options(errorStorage, () => { throw new Error('no ids'); }));
    expect(errorStore.swapExercise(request(errorStore.getState().currentCycle.id))).toEqual({ ok: false, reason: 'savingOff', updatedFromOtherTab: false });
    expect(errorStorage.writes).toEqual([]);
    const full = new MemoryStorage();
    const store = createAppDataStore(options(full, ids('w1')));
    full.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    const before = store.getState();
    expect(store.swapExercise(request('w1'))).toEqual({ ok: false, reason: 'saveFailed', updatedFromOtherTab: false });
    expect(store.getState()).toBe(before);
  });
});
