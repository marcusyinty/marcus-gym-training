import { describe, expect, it } from 'vitest';
import { AppDataV3 } from '../model';
import {
  BACKUP_APP,
  backupFileName,
  createBackupFile,
  MAX_BACKUP_BYTES,
  parseBackupFile,
  PRE_RESTORE_PREFIX,
  pruneSafetyCopies,
  saveSafetyCopy,
  summarizeData,
} from './backup';
import { reduce } from './reducer';
import { shouldAutoOpenReport } from './reportAutoOpen';

// localStorage-like storage with key/length/removeItem, as in the browser
class MemoryStorage {
  data = new Map<string, string>();
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
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const sample = (): AppDataV3 => ({
  schemaVersion: 3,
  currentCycle: {
    id: 'c2',
    startedAt: '2026-10-01T06:00:00.000Z',
    slots: {
      'incline-db-press': {
        slotId: 'incline-db-press', exerciseId: 'incline-db-press', performedExerciseId: 'incline-db-press',
        sets: { 0: { weight: '60', reps: '8', unit: 'kg', done: true, updatedAt: '2026-10-01T06:10:00.000Z' }, 1: { weight: '62.5', reps: '', unit: 'kg', done: false } },
      },
      'lat-pulldown': {
        slotId: 'lat-pulldown', exerciseId: 'lat-pulldown', performedExerciseId: 'lat-pulldown',
        sets: { 0: { weight: '135', reps: '10', unit: 'lbs', done: true, tag: 'good' } },
      },
    },
  },
  archivedCycles: [
    { id: 'c1', startedAt: '2026-09-24T06:00:00.000Z', endedAt: '2026-09-30T20:00:00.000Z', slots: { rdl: { slotId: 'rdl', exerciseId: 'rdl', performedExerciseId: 'rdl', sets: { 0: { weight: '100', reps: '5', unit: 'kg', done: true } } } } },
  ],
  bests: { 'incline-db-press': { weight: '60', reps: '8', unit: 'kg' }, rdl: { weight: '100', reps: '5', unit: 'kg' } },
  reportShownCycleIds: ['c1'],
});
const NOW = new Date('2026-10-04T09:30:00.000Z');
const fileWith = (overrides: Record<string, unknown>) =>
  JSON.stringify({ app: BACKUP_APP, version: 1, exportedAt: NOW.toISOString(), schemaVersion: 3, data: sample(), ...overrides });

describe('backup file', () => {
  it('export -> import round trip gives identical data', () => {
    const { text } = createBackupFile(sample(), NOW);
    const parsed = parseBackupFile(text);
    expect(parsed).toMatchObject({ ok: true, exportedAt: '2026-10-04T09:30:00.000Z', droppedAny: false });
    if (!parsed.ok) throw new Error('expected ok');
    expect(parsed.data).toStrictEqual(sample());
    expect(JSON.parse(text)).toMatchObject({ app: 'aesthetic-recomp-backup', version: 1, schemaVersion: 3 });
  });

  it("names the file with the phone's local date", () => {
    const local = new Date(2026, 0, 5, 23, 59); // 5 Jan 2026, 23:59 local time
    expect(backupFileName(local)).toBe('aesthetic-recomp-backup-2026-01-05.json');
    expect(createBackupFile(sample(), local).fileName).toBe('aesthetic-recomp-backup-2026-01-05.json');
  });

  it('summarizes weeks and ticked sets', () => {
    expect(summarizeData(sample())).toEqual({ weeks: 2, tickedSets: 3 });
  });

  it('rejects broken files with a clear error code and nothing else', () => {
    const full = createBackupFile(sample(), NOW).text;
    expect(parseBackupFile(full.slice(0, full.length / 2))).toEqual({ ok: false, error: 'notJson' }); // truncated
    expect(parseBackupFile('')).toEqual({ ok: false, error: 'notJson' });
    expect(parseBackupFile(fileWith({ app: 'some-other-app' }))).toEqual({ ok: false, error: 'wrongApp' });
    expect(parseBackupFile('[1,2,3]')).toEqual({ ok: false, error: 'wrongApp' });
    expect(parseBackupFile(fileWith({ version: 2 }))).toEqual({ ok: false, error: 'wrongVersion' });
    expect(parseBackupFile(fileWith({ schemaVersion: 4 }))).toEqual({ ok: false, error: 'wrongVersion' });
    expect(parseBackupFile(fileWith({ data: undefined }))).toEqual({ ok: false, error: 'missingData' });
    expect(parseBackupFile(fileWith({ data: null }))).toEqual({ ok: false, error: 'missingData' });
    expect(parseBackupFile(fileWith({ data: { schemaVersion: 3 } }))).toEqual({ ok: false, error: 'invalidData' });
  });

  it('rejects files over 5 MB', () => {
    const big = fileWith({ padding: 'x'.repeat(MAX_BACKUP_BYTES) });
    expect(parseBackupFile(big)).toEqual({ ok: false, error: 'tooLarge' });
  });

  it('keeps odd keys like __proto__, constructor and prototype as plain data (no prototype pollution)', () => {
    const text =
      '{"app":"aesthetic-recomp-backup","version":1,"schemaVersion":3,"exportedAt":"2026-10-04T09:30:00.000Z","__proto__":{"polluted":true},' +
      '"data":{"schemaVersion":3,"__proto__":{"polluted":true},"currentCycle":{"id":"c","startedAt":"t","slots":{' +
      '"__proto__":{"slotId":"__proto__","exerciseId":"__proto__","performedExerciseId":"__proto__","sets":{"0":{"weight":"1","reps":"1","unit":"kg","done":true}}},' +
      '"constructor":{"slotId":"constructor","exerciseId":"constructor","performedExerciseId":"constructor","sets":{}},' +
      '"prototype":{"slotId":"prototype","exerciseId":"prototype","performedExerciseId":"prototype","sets":{}}}},' +
      '"archivedCycles":[],"bests":{"__proto__":{"weight":"1","reps":"1","unit":"kg"},"constructor":{"weight":"2","reps":"2","unit":"kg"}},"reportShownCycleIds":[]}}';
    const parsed = parseBackupFile(text);
    if (!parsed.ok) throw new Error('expected ok, got ' + parsed.error);
    const slots = parsed.data.currentCycle.slots;
    expect(Object.keys(slots)).toEqual(['__proto__', 'constructor', 'prototype']);
    expect(Object.getPrototypeOf(slots)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(parsed.data)).toBe(Object.prototype);
    expect(Object.keys(parsed.data.bests)).toEqual(['__proto__', 'constructor']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false);
    expect(parsed.summary.tickedSets).toBe(1);
  });

  it('drops invalid pieces and reports it in the summary', () => {
    const data = JSON.parse(JSON.stringify(sample()));
    data.currentCycle.slots['incline-db-press'].sets['2'] = { weight: 70, reps: '5', unit: 'kg', done: true }; // weight not text
    data.bests.row = 'nonsense';
    const parsed = parseBackupFile(fileWith({ data }));
    if (!parsed.ok) throw new Error('expected ok');
    expect(parsed.droppedAny).toBe(true);
    expect(parsed.data.currentCycle.slots['incline-db-press'].sets).not.toHaveProperty('2');
    expect(parsed.data.bests).not.toHaveProperty('row');
    expect(parsed.summary).toEqual({ weeks: 2, tickedSets: 3 });
  });

  it('a missing or bad export date is reported as unknown, not an error', () => {
    const parsed = parseBackupFile(fileWith({ exportedAt: 'yesterday' }));
    expect(parsed).toMatchObject({ ok: true, exportedAt: null });
  });
});

describe('safety copies before a restore', () => {
  const V2 = {
    language_preference: 'zh',
    aesthetic_recomp_completed_sets_v2: '{"a":[0]}',
    aesthetic_recomp_set_details_v2: '{}',
    aesthetic_recomp_previous_bests_v2: '{}',
  };

  it('saving a copy never removes anything by itself', () => {
    const storage = new MemoryStorage();
    for (let day = 1; day <= 5; day++) saveSafetyCopy(storage, `v3 text ${day}`, new Date(Date.UTC(2026, 9, day)));
    expect(storage.length).toBe(5);
  });

  it('pruning keeps only the 3 newest copies and touches nothing else', () => {
    const storage = new MemoryStorage({
      ...V2,
      aesthetic_recomp_backup_aesthetic_recomp_v3_raw: 'older backup kind',
      aesthetic_recomp_backup_before_restore: 'no trailing underscore: not ours',
    });
    const times = ['2026-10-01T10:00:00.000Z', '2026-10-02T10:00:00.000Z', '2026-10-03T10:00:00.000Z', '2026-10-04T10:00:00.000Z'];
    times.forEach((t, i) => {
      expect(saveSafetyCopy(storage, `v3 text ${i}`, new Date(t))).toBe(true);
      pruneSafetyCopies(storage);
    });
    const copies = [...storage.data.keys()].filter((k) => k.startsWith(PRE_RESTORE_PREFIX)).sort();
    expect(copies).toEqual(times.slice(1).map((t) => PRE_RESTORE_PREFIX + t));
    expect(storage.getItem(PRE_RESTORE_PREFIX + times[3])).toBe('v3 text 3');
    for (const [k, v] of Object.entries(V2)) expect(storage.getItem(k)).toBe(v);
    expect(storage.getItem('aesthetic_recomp_backup_aesthetic_recomp_v3_raw')).toBe('older backup kind');
    expect(storage.getItem('aesthetic_recomp_backup_before_restore')).toBe('no trailing underscore: not ours');
  });

  it('nothing saved yet -> nothing to copy', () => {
    const storage = new MemoryStorage();
    expect(saveSafetyCopy(storage, null, NOW)).toBe(true);
    expect(storage.length).toBe(0);
  });

  it('reports failure when the copy cannot be saved (storage full)', () => {
    const full = { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    expect(saveSafetyCopy(full, 'current', NOW)).toBe(false);
  });
});

describe('replaceAll + report pop-up rule', () => {
  it('replaceAll returns the restored data as a new object', () => {
    const before = sample();
    const restored = { ...sample(), reportShownCycleIds: ['c1', 'c2'] };
    const after = reduce(before, { type: 'replaceAll', data: restored }, { now: NOW });
    expect(after).toStrictEqual(restored);
    expect(after).not.toBe(restored);
  });

  it('the report never pops up because data was replaced, and never twice for a week', () => {
    // normal case: the user's own tick completes the week
    expect(shouldAutoOpenReport({ wasComplete: false, isComplete: true, alreadyShown: false, dataReplaced: false })).toBe(true);
    // a restored complete week, even if its report was never shown
    expect(shouldAutoOpenReport({ wasComplete: false, isComplete: true, alreadyShown: false, dataReplaced: true })).toBe(false);
    // restored reportShownCycleIds are respected
    expect(shouldAutoOpenReport({ wasComplete: false, isComplete: true, alreadyShown: true, dataReplaced: false })).toBe(false);
    expect(shouldAutoOpenReport({ wasComplete: true, isComplete: true, alreadyShown: false, dataReplaced: false })).toBe(false);
  });
});
