import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BodyEntryInput, localDay, MAX_BODY_ENTRIES } from '../body';
import { AppDataV3 } from '../model';
import { StorageLike } from '../storage';
import { createAppDataStore } from './appDataStore';
import { createBackupFile, parseBackupFile } from './backup';
import { BACKUP_KEY_V3, STORAGE_KEY_V3 } from './dataV3';
import { reduce } from './reducer';

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
}

const NOW = new Date(2026, 9, 6, 9, 0);
const options = (storage: MemoryStorage | null) => ({ storage, now: () => NOW, makeId: () => 'new-week' });
const week = (): AppDataV3 => ({
  schemaVersion: 3,
  currentCycle: { id: 'w1', startedAt: '2026-10-05T06:00:00.000Z', slots: { 'incline-db-press': { slotId: 'incline-db-press', exerciseId: 'incline-db-press', performedExerciseId: 'incline-db-press', sets: { 0: { weight: '60', reps: '8', unit: 'kg', done: true } } } } },
  archivedCycles: [],
  bests: {},
  reportShownCycleIds: [],
});
const input = (day: string, weight: string, extra: Partial<BodyEntryInput> = {}): BodyEntryInput => ({ day, weight, waist: '', hips: '', unit: 'kg', ...extra });
const stored = (storage: MemoryStorage) => JSON.parse(storage.getItem(STORAGE_KEY_V3)!) as AppDataV3;
const ctx = { now: NOW };

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('saving body measurements', () => {
  it('nothing is written until something is saved: the saved text stays byte-identical', () => {
    const text = JSON.stringify(week());
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: text });
    const store = createAppDataStore(options(storage));
    store.dispatch({ type: 'markReportShown', cycleId: 'w1' });
    store.flush();
    expect(stored(storage).body).toBeUndefined();
    expect('body' in stored(storage)).toBe(false);
  });

  it('add: saved right away (no 300 ms wait), as typed with its unit', () => {
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: JSON.stringify(week()) });
    const store = createAppDataStore(options(storage));
    expect(store.saveBodyEntry(input('2026-10-06', '72,4', { waist: '80', hips: '95.5' }))).toEqual({ ok: true, updatedFromOtherTab: false });
    expect(stored(storage).body).toEqual({ entries: { '2026-10-06': { weight: { value: '72.4', unit: 'kg' }, waist: { value: '80', unit: 'cm' }, hips: { value: '95.5', unit: 'cm' }, updatedAt: NOW.toISOString() } } });
  });

  it('the same day again asks first (never silently overwritten); "replace" with the shown values saves', () => {
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: JSON.stringify(week()) });
    const store = createAppDataStore(options(storage));
    store.saveBodyEntry(input('2026-10-06', '72.4'));
    const again = store.saveBodyEntry(input('2026-10-06', '73'));
    expect(again).toMatchObject({ ok: false, reason: 'exists', existing: { weight: { value: '72.4', unit: 'kg' } } });
    expect(stored(storage).body!.entries['2026-10-06'].weight.value).toBe('72.4');
    const existing = again.ok === false && again.reason === 'exists' ? again.existing : undefined;
    expect(store.saveBodyEntry({ ...input('2026-10-06', '73'), expected: existing })).toEqual({ ok: true, updatedFromOtherTab: false });
    expect(stored(storage).body!.entries['2026-10-06'].weight.value).toBe('73');
  });

  it('invalid input or a future day: nothing saved, every problem reported', () => {
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: JSON.stringify(week()) });
    const store = createAppDataStore(options(storage));
    expect(store.saveBodyEntry(input('2026-10-07', 'abc', { hips: '400' }))).toEqual({
      ok: false, reason: 'invalid', updatedFromOtherTab: false,
      problems: [{ field: 'day', problem: 'future' }, { field: 'weight', problem: 'notNumber' }, { field: 'hips', problem: 'outOfRange' }],
    });
    expect(storage.writes).toEqual([]);
  });

  it('edit in place, move to another day (asks if that day has one), delete; the field goes away when empty', () => {
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: JSON.stringify(week()) });
    const store = createAppDataStore(options(storage));
    store.saveBodyEntry(input('2026-10-05', '72'));
    store.saveBodyEntry(input('2026-10-06', '73'));
    const day6 = stored(storage).body!.entries['2026-10-06'];
    expect(store.saveBodyEntry({ ...input('2026-10-06', '73.5'), previousDay: '2026-10-06', expected: day6 }).ok).toBe(true);
    expect(store.saveBodyEntry({ ...input('2026-10-05', '73.5'), previousDay: '2026-10-06' })).toMatchObject({ ok: false, reason: 'exists' });
    expect(store.saveBodyEntry({ ...input('2026-10-04', '73.5'), previousDay: '2026-10-06' }).ok).toBe(true);
    expect(Object.keys(stored(storage).body!.entries).sort()).toEqual(['2026-10-04', '2026-10-05']);
    store.deleteBodyEntry('2026-10-04');
    store.deleteBodyEntry('2026-10-05');
    expect('body' in stored(storage)).toBe(false);
  });

  it('editing with the app in the other unit: fields left untouched keep their stored value and unit exactly', () => {
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: JSON.stringify(week()) });
    const store = createAppDataStore(options(storage));
    store.saveBodyEntry(input('2026-10-06', '72.4', { waist: '80' }));
    const original = stored(storage).body!.entries['2026-10-06'];
    // the form shows 159.6 lbs and 31.5 in; only the waist is changed, to 32 in
    expect(store.saveBodyEntry({ day: '2026-10-06', weight: '159.6', waist: '32', hips: '', unit: 'lbs', previousDay: '2026-10-06', expected: original, original, unchanged: ['weight'] }).ok).toBe(true);
    expect(stored(storage).body!.entries['2026-10-06']).toMatchObject({ weight: { value: '72.4', unit: 'kg' }, waist: { value: '32', unit: 'in' } });
  });

  it('height: saved, replaced, removed with empty text; bad text refused', () => {
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: JSON.stringify(week()) });
    const store = createAppDataStore(options(storage));
    expect(store.setHeight('178', 'kg')).toEqual({ ok: true, updatedFromOtherTab: false });
    expect(store.setHeight('70', 'lbs')).toEqual({ ok: true, updatedFromOtherTab: false });
    expect(stored(storage).body!.height).toEqual({ value: '70', unit: 'in' });
    expect(store.setHeight('12', 'kg')).toMatchObject({ ok: false, reason: 'outOfRange' });
    expect(store.setHeight('x', 'kg')).toMatchObject({ ok: false, reason: 'notNumber' });
    store.setHeight('', 'kg');
    expect('body' in stored(storage)).toBe(false);
  });

  it('at 2000 entries a new day is refused (nothing deleted); editing still works', () => {
    const entries: Record<string, object> = {};
    for (let i = 0; i < MAX_BODY_ENTRIES; i++) entries[localDay(new Date(2015, 0, 1 + i))] = { weight: { value: '70', unit: 'kg' } };
    const days = Object.keys(entries).sort();
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: JSON.stringify({ ...week(), body: { entries } }) });
    const store = createAppDataStore(options(storage));
    expect(store.saveBodyEntry(input('2026-10-06', '72'))).toMatchObject({ ok: false, reason: 'atCap' });
    const last = days[days.length - 1];
    expect(store.saveBodyEntry({ ...input(last, '71'), previousDay: last, expected: { weight: { value: '70', unit: 'kg' } } }).ok).toBe(true);
    expect(Object.keys(stored(storage).body!.entries).length).toBe(MAX_BODY_ENTRIES);
  });

  it('saving off (unreadable saved data): nothing is written', () => {
    // unreadable v3 text + old data whose migration fails = the app's error mode (as in appDataStore.test)
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: 'not json', aesthetic_recomp_completed_sets_v2: '{"bench":[0]}' });
    const store = createAppDataStore({ ...options(storage), makeId: () => { throw new Error('no ids'); } });
    expect(store.isSavingDisabled()).toBe(true);
    expect(store.saveBodyEntry(input('2026-10-06', '72'))).toMatchObject({ ok: false, reason: 'savingOff' });
    expect(store.setHeight('178', 'kg')).toMatchObject({ ok: false, reason: 'savingOff' });
    expect(storage.getItem(STORAGE_KEY_V3)).toBe('not json');
  });
});

describe('stale tabs', () => {
  it('another tab added a different day: both kept, this tab is told', () => {
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: JSON.stringify(week()) });
    const tabA = createAppDataStore(options(storage));
    const tabB = createAppDataStore(options(storage)); // never hears about A's save
    tabA.saveBodyEntry(input('2026-10-05', '72'));
    expect(tabB.saveBodyEntry(input('2026-10-06', '73'))).toEqual({ ok: true, updatedFromOtherTab: true });
    expect(Object.keys(stored(storage).body!.entries).sort()).toEqual(['2026-10-05', '2026-10-06']);
  });

  it('another tab saved the SAME day while the replace question was open: asked again with the newest values', () => {
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: JSON.stringify(week()) });
    const tabA = createAppDataStore(options(storage));
    const tabB = createAppDataStore(options(storage));
    tabA.saveBodyEntry(input('2026-10-06', '72'));
    const asked = tabB.saveBodyEntry(input('2026-10-06', '75')); // B catches up, sees 72: asks
    expect(asked).toMatchObject({ ok: false, reason: 'exists', existing: { weight: { value: '72' } }, updatedFromOtherTab: true });
    const shown = asked.ok === false && asked.reason === 'exists' ? asked.existing : undefined;
    // meanwhile A replaces its own entry with 74
    tabA.saveBodyEntry({ ...input('2026-10-06', '74'), previousDay: '2026-10-06', expected: tabA.getState().body!.entries['2026-10-06'] });
    // B taps "Replace" (it was shown 72): not overwritten, asked again with 74
    expect(tabB.saveBodyEntry({ ...input('2026-10-06', '75'), expected: shown })).toMatchObject({ ok: false, reason: 'exists', existing: { weight: { value: '74' } } });
    expect(stored(storage).body!.entries['2026-10-06'].weight.value).toBe('74');
    const newest = tabB.getState().body!.entries['2026-10-06'];
    expect(tabB.saveBodyEntry({ ...input('2026-10-06', '75'), expected: newest }).ok).toBe(true);
    expect(stored(storage).body!.entries['2026-10-06'].weight.value).toBe('75');
  });

  it('an edit of an entry another tab changed meanwhile asks first too', () => {
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: JSON.stringify(week()) });
    const tabA = createAppDataStore(options(storage));
    tabA.saveBodyEntry(input('2026-10-06', '72'));
    const tabB = createAppDataStore(options(storage));
    const loadedForEdit = tabB.getState().body!.entries['2026-10-06'];
    tabA.saveBodyEntry({ ...input('2026-10-06', '74'), previousDay: '2026-10-06', expected: tabA.getState().body!.entries['2026-10-06'] });
    expect(tabB.saveBodyEntry({ ...input('2026-10-06', '73'), previousDay: '2026-10-06', expected: loadedForEdit })).toMatchObject({ ok: false, reason: 'exists', existing: { weight: { value: '74' } } });
  });
});

describe('body data is not weekly data', () => {
  it('Start new week, Reset day and Reset all never touch it', () => {
    const withBody: AppDataV3 = { ...week(), body: { height: { value: '178', unit: 'cm' }, entries: { '2026-10-05': { weight: { value: '72', unit: 'kg' } } } } };
    expect(reduce(withBody, { type: 'startNewWeek', cycleId: 'w1', newId: 'w2' }, ctx).body).toBe(withBody.body);
    expect(reduce(withBody, { type: 'resetDay', slotIds: ['incline-db-press'] }, ctx).body).toBe(withBody.body);
    expect(reduce(withBody, { type: 'resetAll' }, ctx).body).toBe(withBody.body);
  });
});

describe('loading, backups and restore', () => {
  it('broken body data loads safely; the original text is backed up once', () => {
    const raw = JSON.stringify({ ...week(), body: { height: 'tall', entries: { '2026-10-05': { weight: { value: '72', unit: 'kg' } }, 'not-a-day': { weight: { value: '70', unit: 'kg' } }, '2026-10-04': { weight: { value: 'heavy', unit: 'kg' } } } } });
    const storage = new MemoryStorage({ [STORAGE_KEY_V3]: raw });
    const store = createAppDataStore(options(storage));
    expect(store.getState().body).toEqual({ entries: { '2026-10-05': { weight: { value: '72', unit: 'kg' } } } });
    expect(storage.getItem(BACKUP_KEY_V3)).toBe(raw);
    const notAnObject = new MemoryStorage({ [STORAGE_KEY_V3]: JSON.stringify({ ...week(), body: 'oops' }) });
    expect(createAppDataStore(options(notAnObject)).getState().body).toBeUndefined();
  });

  it('a backup carries the body data; the round trip gives identical data', () => {
    const data: AppDataV3 = { ...week(), body: { height: { value: '70', unit: 'in' }, entries: { '2026-10-05': { weight: { value: '160', unit: 'lbs' }, waist: { value: '31.5', unit: 'in' }, updatedAt: 't' } } } };
    const parsed = parseBackupFile(createBackupFile(data, NOW).text);
    expect(parsed.ok && parsed.data.body).toEqual(data.body);
    expect(parsed.ok && parsed.keepsCurrentBody).toBe(false);
  });

  it('restore: an old backup without the field KEEPS the phone\'s body data; a newer one (even empty) replaces it', () => {
    const phone: AppDataV3 = { ...week(), body: { entries: { '2026-10-05': { weight: { value: '72', unit: 'kg' } } } } };
    const old = parseBackupFile(JSON.stringify({ app: 'aesthetic-recomp-backup', version: 1, exportedAt: 'x', schemaVersion: 3, data: week() }));
    expect(old.ok && old.keepsCurrentBody).toBe(true);
    if (old.ok) expect(reduce(phone, { type: 'replaceAll', data: old.data }, ctx).body).toEqual(phone.body);
    const newerEmpty = parseBackupFile(createBackupFile(week(), NOW).text);
    expect(newerEmpty.ok && newerEmpty.keepsCurrentBody).toBe(false);
    if (newerEmpty.ok) expect('body' in reduce(phone, { type: 'replaceAll', data: newerEmpty.data }, ctx)).toBe(false);
    const newer = parseBackupFile(createBackupFile({ ...week(), body: { entries: { '2026-09-01': { weight: { value: '80', unit: 'kg' } } } } }, NOW).text);
    if (newer.ok) expect(Object.keys(reduce(phone, { type: 'replaceAll', data: newer.data }, ctx).body!.entries)).toEqual(['2026-09-01']);
  });
});
