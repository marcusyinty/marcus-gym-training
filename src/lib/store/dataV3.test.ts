import { describe, expect, it } from 'vitest';
import { workoutProgram } from '../../data/workoutProgram';
import { parseSetsCount } from '../../utils/parseSetsCount';
import { AppDataV3 } from '../model';
import { StorageLike } from '../storage';
import { BACKUP_KEY_V3, loadAppData, STORAGE_KEY_V3, validateV3 } from './dataV3';
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

const ctx = () => ({ now: new Date('2026-10-03T08:00:00.000Z'), makeId: () => 'cycle-1' });

// Exact text the app saved in v2 (recorded from a real session): 3 exercises, one in lbs
const V2_RECORDED = {
  language_preference: 'zh',
  aesthetic_recomp_completed_sets_v2: '{"incline-db-press":[0,1],"lat-pulldown":[0],"leg-press":[0]}',
  aesthetic_recomp_set_details_v2:
    '{"incline-db-press":{"0":{"setNumber":1,"weight":"60","reps":"8","unit":"kg","completed":true,"timestamp":"2026-10-02T15:09:36.888Z"},"1":{"setNumber":2,"weight":"62.5","reps":"6","unit":"kg","completed":true,"timestamp":"2026-10-02T15:09:37.185Z"}},"lat-pulldown":{"0":{"setNumber":1,"weight":"135","reps":"10","unit":"lbs","completed":true,"timestamp":"2026-10-02T15:09:37.494Z"}},"leg-press":{"0":{"setNumber":1,"weight":"100","reps":"5","unit":"kg","completed":true,"timestamp":"2026-10-02T15:09:38.255Z"}}}',
  aesthetic_recomp_previous_bests_v2:
    '{"incline-db-press":{"weight":"62.5","reps":"6","unit":"kg"},"lat-pulldown":{"weight":"135","reps":"10","unit":"lbs"},"leg-press":{"weight":"100","reps":"5","unit":"kg"}}',
  aesthetic_recomp_unit_v1: 'kg',
};

// A whole week ticked, as v2 would have saved it
const v2CompleteWeek = () => ({
  aesthetic_recomp_completed_sets_v2: JSON.stringify(
    Object.fromEntries(workoutProgram.flatMap((day) => day.exercises).map((ex) => [ex.id, Array.from({ length: parseSetsCount(ex.sets) }, (_, i) => i)]))
  ),
  aesthetic_recomp_set_details_v2:
    '{"rdl":{"0":{"setNumber":1,"weight":"100","reps":"5","unit":"kg","timestamp":"2026-09-29T07:00:00.000Z"}},"rdl-lower-b":{"0":{"setNumber":1,"weight":"110","reps":"5","unit":"kg","timestamp":"bad date"}}}',
});

const validV3 = (): AppDataV3 & { appVersion: string } => ({
  schemaVersion: 3,
  appVersion: 'future-field',
  currentCycle: {
    id: 'c1',
    startedAt: '2026-10-01T00:00:00.000Z',
    slots: {
      bench: { slotId: 'bench', exerciseId: 'bench', performedExerciseId: 'bench', sets: { 0: { weight: '60', reps: '8', unit: 'kg', done: true, tag: 'good', updatedAt: 't' } } },
    },
  },
  archivedCycles: [{ id: 'c0', startedAt: '2026-09-20T00:00:00.000Z', endedAt: '2026-09-27T00:00:00.000Z', slots: {} }],
  bests: { bench: { weight: '60', reps: '8', unit: 'kg' } },
  reportShownCycleIds: ['c0'],
});

describe('validateV3', () => {
  it('accepts valid data unchanged, keeping unknown extra fields', () => {
    const raw = validV3();
    expect(validateV3(JSON.parse(JSON.stringify(raw)))).toStrictEqual({ data: raw, droppedAny: false });
  });

  it('drops malformed pieces one at a time and keeps the rest', () => {
    const raw = JSON.parse(JSON.stringify(validV3()));
    raw.currentCycle.slots.bench.sets['1'] = { weight: 60, reps: '8', unit: 'kg', done: true }; // weight not text
    raw.currentCycle.slots.bench.sets['2'] = { weight: '1', reps: '1', unit: 'stone', done: true }; // bad unit
    raw.currentCycle.slots.bench.sets['x'] = { weight: '1', reps: '1', unit: 'kg', done: true }; // bad key
    raw.currentCycle.slots.bench.sets['0'].tag = 'heavy'; // bad tag -> just the tag goes
    raw.currentCycle.slots.broken = { exerciseId: 'x', sets: {} }; // no slotId
    raw.archivedCycles.push({ startedAt: 'no id' });
    raw.bests.row = { weight: '50', reps: 10, unit: 'kg' };
    raw.reportShownCycleIds.push(42);
    const { data, droppedAny } = validateV3(raw);
    expect(droppedAny).toBe(true);
    expect(data!.currentCycle.slots.bench.sets).toStrictEqual({ 0: { weight: '60', reps: '8', unit: 'kg', done: true, updatedAt: 't' } });
    expect(Object.keys(data!.currentCycle.slots)).toEqual(['bench']);
    expect(data!.archivedCycles.map((c) => c.id)).toEqual(['c0']);
    expect(Object.keys(data!.bests)).toEqual(['bench']);
    expect(data!.reportShownCycleIds).toEqual(['c0']);
  });

  it('missing optional lists count as empty without dropping anything', () => {
    const { data, droppedAny } = validateV3({ schemaVersion: 3, currentCycle: { id: 'c', startedAt: 't', slots: {} } });
    expect(droppedAny).toBe(false);
    expect([data!.archivedCycles, data!.bests, data!.reportShownCycleIds]).toEqual([[], {}, []]);
  });

  it('returns null for an unusable top level, never throws', () => {
    for (const bad of [null, 'text', 42, [], {}, { schemaVersion: 2 }, { schemaVersion: 3 }, { schemaVersion: 3, currentCycle: { id: 1 } }]) {
      expect(validateV3(bad)).toEqual({ data: null, droppedAny: true });
    }
  });
});

describe('loadAppData', () => {
  it("source 'v3': uses valid v3 data, writes nothing", () => {
    const storage = new MemoryStorage({ ...V2_RECORDED, [STORAGE_KEY_V3]: JSON.stringify(validV3()) });
    const result = loadAppData(storage, ctx());
    expect([result.source, result.backupsMade, storage.writes]).toEqual(['v3', [], []]);
    expect(result.data).toStrictEqual(validV3());
  });

  it("source 'v3' with dropped pieces: original text backed up once, never overwritten", () => {
    const broken = JSON.parse(JSON.stringify(validV3()));
    broken.bests.row = 'nonsense';
    const raw1 = JSON.stringify(broken);
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: raw1 });
    const first = loadAppData(storage, ctx());
    expect([first.source, first.backupsMade, storage.getItem(BACKUP_KEY_V3)]).toEqual(['v3', [BACKUP_KEY_V3], raw1]);
    expect(BACKUP_KEY_V3).toBe('aesthetic_recomp_backup_aesthetic_recomp_v3_raw');
    // a later, different bad text does not replace the first backup
    broken.bests.other = 7;
    storage.data.set(STORAGE_KEY_V3, JSON.stringify(broken));
    const second = loadAppData(storage, ctx());
    expect([second.backupsMade, storage.getItem(BACKUP_KEY_V3)]).toEqual([[], raw1]);
    expect(storage.getItem(STORAGE_KEY_V3)).toBe(JSON.stringify(broken)); // the v3 key itself is not rewritten
  });

  it("source 'migrated': realistic v2 data incl. an lbs set; old keys untouched byte-for-byte", () => {
    const storage = new MemoryStorage(V2_RECORDED);
    const before = storage.snapshot();
    const result = loadAppData(storage, ctx());
    expect(result.source).toBe('migrated');
    expect(storage.snapshot()).toEqual(before); // nothing written, nothing changed or deleted
    expect(storage.writes).toEqual([]);
    const d = result.data;
    expect(completedIndexes(d, 'incline-db-press')).toEqual([0, 1]);
    expect(setDetails(d, 'lat-pulldown')[0]).toStrictEqual({ setNumber: 1, weight: '135', reps: '10', unit: 'lbs', timestamp: '2026-10-02T15:09:37.494Z' });
    expect(previousBest(d, 'lat-pulldown')).toEqual({ weight: '135', reps: '10', unit: 'lbs' });
    expect(d.currentCycle.startedAt).toBe('2026-10-02T15:09:36.888Z'); // earliest timestamp, not ctx.now
    expect(d.reportShownCycleIds).toEqual([]); // week not complete
  });

  it('a migrated week that was already complete is marked as reported (no pop-up on first load)', () => {
    const storage = new MemoryStorage(v2CompleteWeek());
    const result = loadAppData(storage, ctx());
    expect([result.source, result.data.reportShownCycleIds]).toEqual(['migrated', ['cycle-1']]);
    expect(result.data.currentCycle.startedAt).toBe('2026-09-29T07:00:00.000Z'); // 'bad date' ignored
  });

  it('startedAt falls back to ctx.now when no old set detail has a valid timestamp', () => {
    const storage = new MemoryStorage({ aesthetic_recomp_completed_sets_v2: '{"incline-db-press":[0]}' });
    expect(loadAppData(storage, ctx()).data.currentCycle.startedAt).toBe('2026-10-03T08:00:00.000Z');
  });

  it("source 'fresh': empty storage, or only the language/unit keys", () => {
    for (const initial of [{}, { language_preference: 'zh', aesthetic_recomp_unit_v1: 'lbs' }] as Record<string, string>[]) {
      const storage = new MemoryStorage(initial);
      const result = loadAppData(storage, ctx());
      expect([result.source, storage.writes]).toEqual(['fresh', []]);
      expect(result.data).toStrictEqual({
        schemaVersion: 3,
        currentCycle: { id: 'cycle-1', startedAt: '2026-10-03T08:00:00.000Z', slots: {} },
        archivedCycles: [],
        bests: {},
        reportShownCycleIds: [],
      });
    }
  });

  it('broken v3 text with v2 data present: backed up, then migrated', () => {
    const storage = new MemoryStorage({ ...V2_RECORDED, [STORAGE_KEY_V3]: '{"schemaVersion":3,' });
    const result = loadAppData(storage, ctx());
    expect([result.source, result.backupsMade, storage.getItem(BACKUP_KEY_V3)]).toEqual(['migrated', [BACKUP_KEY_V3], '{"schemaVersion":3,']);
  });

  it("source 'error': the migration throws -> fresh in-memory data and NOTHING written", () => {
    // malformed v3 and malformed v2 would normally each cause a backup write
    const storage = new MemoryStorage({ ...V2_RECORDED, aesthetic_recomp_completed_sets_v2: '{"incline-db-press":[0,"x"]}', [STORAGE_KEY_V3]: 'not json' });
    const before = storage.snapshot();
    const failing = { now: new Date('2026-10-03T08:00:00.000Z'), makeId: () => { throw new Error('no ids'); } };
    const result = loadAppData(storage, failing);
    expect(result.source).toBe('error');
    expect([storage.writes, storage.snapshot()]).toEqual([[], before]);
    expect(result.data.currentCycle).toEqual({ id: 'cycle-unsaved', startedAt: '2026-10-03T08:00:00.000Z', slots: {} });
    expect(result.backupsMade).toEqual([]);
  });

  it('malformed v2 data is backed up by the existing safe readers (new keys only) when migration works', () => {
    const storage = new MemoryStorage({ aesthetic_recomp_completed_sets_v2: '{"incline-db-press":[0,"x"]}' });
    const result = loadAppData(storage, ctx());
    expect(result.backupsMade).toEqual(['aesthetic_recomp_backup_aesthetic_recomp_completed_sets_v2_raw']);
    expect(storage.getItem('aesthetic_recomp_completed_sets_v2')).toBe('{"incline-db-press":[0,"x"]}'); // old key unchanged
  });

  it('same storage + same ctx gives the same result', () => {
    const a = loadAppData(new MemoryStorage(V2_RECORDED), ctx());
    const b = loadAppData(new MemoryStorage(V2_RECORDED), ctx());
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});
