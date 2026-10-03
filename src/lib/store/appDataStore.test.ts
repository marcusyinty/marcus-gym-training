import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageLike } from '../storage';
import { createAppDataStore } from './appDataStore';
import { STORAGE_KEY_V3 } from './dataV3';
import { completedIndexes, previousBest, setDetails } from './selectors';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  writes: string[] = [];
  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.data.set(k, v);
  }
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.writes.push(key);
    this.data.set(key, value);
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
