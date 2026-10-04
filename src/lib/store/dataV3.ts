// Loading the single v3 data object: from the v3 key, by migrating the old v2 keys, or fresh.
// Pure apart from the storage passed in; it never changes or deletes the old v2 keys and never
// writes the v3 key itself (saving is for the connect step). Not used by the app yet.
import { workoutProgram } from '../../data/workoutProgram';
import { migrateV2ToV3, MigrationContext } from '../migrateV2';
import { AppDataV3, BestSet, Cycle, LoggedSet, LoggedSlot } from '../model';
import { completedSetsItem, previousBestsItem, setDetailsItem, SetDetailsByExercise } from '../savedData';
import { backupKeyFor, safeRead, safeWrite, StorageLike } from '../storage';
import { isAllowedInSlot } from '../exerciseVariants';
import { isCycleComplete } from './selectors';

export const STORAGE_KEY_V3 = 'aesthetic_recomp_v3';
export const BACKUP_KEY_V3 = backupKeyFor(STORAGE_KEY_V3); // aesthetic_recomp_backup_aesthetic_recomp_v3_raw

// Only these old keys hold workout data; the language key alone does not trigger a migration
const V2_DATA_KEYS = [completedSetsItem.key, setDetailsItem.key, previousBestsItem.key];

export type LoadSource = 'v3' | 'migrated' | 'fresh' | 'error';

export interface LoadResult {
  data: AppDataV3;
  source: LoadSource;
  backupsMade: string[];
}

// ---------- shape check ----------

type Checked<T> = { value: T | null; dropped: boolean };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isUnit = (value: unknown) => value === 'kg' || value === 'lbs';
const isSetIndexKey = (key: string) => /^(0|[1-9]\d*)$/.test(key);
const TAGS = ['easy', 'good', 'max'];

// Copies the entries of a plain object that pass `check` (Object.fromEntries keeps odd keys like "__proto__" safe)
const checkRecord = <T>(raw: unknown, check: (value: unknown, key: string) => Checked<T>): Checked<Record<string, T>> => {
  if (!isPlainObject(raw)) return { value: {}, dropped: true };
  let dropped = false;
  const entries: [string, T][] = [];
  for (const [key, entry] of Object.entries(raw)) {
    const checked = check(entry, key);
    if (checked.dropped) dropped = true;
    if (checked.value !== null) entries.push([key, checked.value]);
  }
  return { value: Object.fromEntries(entries), dropped };
};

const checkSet = (raw: unknown, key: string): Checked<LoggedSet> => {
  if (!isSetIndexKey(key) || !isPlainObject(raw) || typeof raw.weight !== 'string' || typeof raw.reps !== 'string' || !isUnit(raw.unit) || typeof raw.done !== 'boolean') {
    return { value: null, dropped: true };
  }
  const set: Record<string, unknown> = { ...raw }; // unknown extra fields are kept
  let dropped = false;
  if ('tag' in set && !TAGS.includes(set.tag as string)) {
    delete set.tag;
    dropped = true;
  }
  if ('updatedAt' in set && typeof set.updatedAt !== 'string') {
    delete set.updatedAt;
    dropped = true;
  }
  return { value: set as unknown as LoggedSet, dropped };
};

const checkSlot = (raw: unknown, slotKey: string): Checked<LoggedSlot> => {
  if (!isPlainObject(raw) || typeof raw.slotId !== 'string' || typeof raw.exerciseId !== 'string') return { value: null, dropped: true };
  const sets = checkRecord(raw.sets, checkSet);
  // The exercise done must be the slot's own exercise or one of its alternatives. Anything else (e.g. a
  // hand-edited backup) falls back to the slot's own exercise; its logged sets are always kept.
  const performedOk =
    typeof raw.performedExerciseId === 'string' &&
    (raw.performedExerciseId === raw.exerciseId || isAllowedInSlot(slotKey, raw.performedExerciseId));
  return {
    value: { ...raw, slotId: raw.slotId, exerciseId: raw.exerciseId, performedExerciseId: performedOk ? (raw.performedExerciseId as string) : raw.exerciseId, sets: sets.value ?? {} },
    dropped: sets.dropped || !performedOk,
  };
};

const checkCycle = (raw: unknown): Checked<Cycle> => {
  if (!isPlainObject(raw) || typeof raw.id !== 'string' || typeof raw.startedAt !== 'string') return { value: null, dropped: true };
  const cycle: Record<string, unknown> = { ...raw };
  let dropped = false;
  if ('endedAt' in cycle && typeof cycle.endedAt !== 'string') {
    delete cycle.endedAt;
    dropped = true;
  }
  const slots = checkRecord(raw.slots, checkSlot);
  cycle.slots = slots.value ?? {};
  return { value: cycle as unknown as Cycle, dropped: dropped || slots.dropped };
};

const checkBest = (raw: unknown): Checked<BestSet> =>
  isPlainObject(raw) && typeof raw.weight === 'string' && typeof raw.reps === 'string' && isUnit(raw.unit)
    ? { value: { ...raw } as unknown as BestSet, dropped: false }
    : { value: null, dropped: true };

// Checks parsed v3 data and drops malformed pieces one at a time; never throws. Unknown extra fields are
// kept. Missing optional lists count as empty (nothing lost); anything removed or repaired sets droppedAny.
// data is null when the top level itself is unusable (not v3, or no valid current cycle).
export const validateV3 = (raw: unknown): { data: AppDataV3 | null; droppedAny: boolean } => {
  if (!isPlainObject(raw) || raw.schemaVersion !== 3) return { data: null, droppedAny: true };
  const current = checkCycle(raw.currentCycle);
  if (!current.value) return { data: null, droppedAny: true };
  let droppedAny = current.dropped;

  let archivedCycles: Cycle[] = [];
  if (raw.archivedCycles !== undefined) {
    if (!Array.isArray(raw.archivedCycles)) droppedAny = true;
    else for (const entry of raw.archivedCycles) {
      const cycle = checkCycle(entry);
      if (cycle.dropped) droppedAny = true;
      if (cycle.value) archivedCycles.push(cycle.value);
    }
  }

  let bests: Record<string, BestSet> = {};
  if (raw.bests !== undefined) {
    const checked = checkRecord(raw.bests, checkBest);
    bests = checked.value ?? {};
    if (checked.dropped) droppedAny = true;
  }

  let reportShownCycleIds: string[] = [];
  if (raw.reportShownCycleIds !== undefined) {
    if (!Array.isArray(raw.reportShownCycleIds)) droppedAny = true;
    else {
      reportShownCycleIds = raw.reportShownCycleIds.filter((id): id is string => typeof id === 'string');
      if (reportShownCycleIds.length !== raw.reportShownCycleIds.length) droppedAny = true;
    }
  }

  return {
    data: { ...raw, schemaVersion: 3, currentCycle: current.value, archivedCycles, bests, reportShownCycleIds } as AppDataV3,
    droppedAny,
  };
};

// ---------- loading ----------

const readRaw = (storage: StorageLike | null, key: string): string | null => {
  try {
    const raw = storage ? storage.getItem(key) : null;
    return raw === '' ? null : raw;
  } catch (e) {
    return null;
  }
};

// Never throws: if ctx.makeId or ctx.now fails, a fixed id / the epoch is used
const freshData = (ctx: MigrationContext): AppDataV3 => {
  let id = 'cycle-unsaved';
  let startedAt = new Date(0).toISOString();
  try {
    id = ctx.makeId();
  } catch (e) {
    /* keep the fixed id */
  }
  try {
    startedAt = ctx.now.toISOString();
  } catch (e) {
    /* keep the epoch */
  }
  return { schemaVersion: 3, currentCycle: { id, startedAt, slots: {} }, archivedCycles: [], bests: {}, reportShownCycleIds: [] };
};

// Earliest valid timestamp in the old set details (the original text), or null
const earliestTimestamp = (setDetails: SetDetailsByExercise): string | null => {
  let earliest: { time: number; text: string } | null = null;
  for (const sets of Object.values(setDetails)) {
    for (const detail of Object.values(sets)) {
      const text = detail.timestamp;
      const time = typeof text === 'string' ? Date.parse(text) : NaN;
      if (!Number.isNaN(time) && (earliest === null || time < earliest.time)) earliest = { time, text: text as string };
    }
  }
  return earliest?.text ?? null;
};

// Loads the app data:
// 1. a valid v3 key -> 'v3' (if pieces had to be dropped, the original text is backed up once first)
// 2. else any of the three old v2 workout keys -> 'migrated' (old keys are only read, never changed)
// 3. else -> 'fresh'
// If the migration throws -> 'error' with a fresh in-memory object, and NOTHING is written.
export const loadAppData = (storage: StorageLike | null, ctx: MigrationContext): LoadResult => {
  // Writes (backups only) are collected and saved at the end, so the error path can write nothing
  const pending: [key: string, text: string][] = [];
  const bufferedStorage: StorageLike = {
    getItem: (key) => pending.find(([k]) => k === key)?.[1] ?? readRaw(storage, key),
    setItem: (key, text) => {
      pending.push([key, text]);
    },
  };
  const commit = (): string[] => pending.filter(([key, text]) => safeWrite(key, text, storage)).map(([key]) => key);

  const rawV3 = readRaw(storage, STORAGE_KEY_V3);
  if (rawV3 !== null) {
    let checked: { data: AppDataV3 | null; droppedAny: boolean };
    try {
      checked = validateV3(JSON.parse(rawV3));
    } catch (e) {
      checked = { data: null, droppedAny: true }; // broken JSON
    }
    // Back up the original text once before anything is lost; an existing backup is never overwritten
    if (checked.droppedAny && bufferedStorage.getItem(BACKUP_KEY_V3) === null) bufferedStorage.setItem(BACKUP_KEY_V3, rawV3);
    if (checked.data) return { data: checked.data, source: 'v3', backupsMade: commit() };
  }

  if (V2_DATA_KEYS.some((key) => readRaw(storage, key) !== null)) {
    try {
      const v2 = {
        completedSets: safeRead(completedSetsItem, bufferedStorage),
        setDetails: safeRead(setDetailsItem, bufferedStorage),
        bests: safeRead(previousBestsItem, bufferedStorage),
      };
      const migrated = migrateV2ToV3(v2, ctx);
      const startedAt = earliestTimestamp(v2.setDetails) ?? migrated.currentCycle.startedAt;
      let data: AppDataV3 = { ...migrated, currentCycle: { ...migrated.currentCycle, startedAt } };
      // A week that was already complete before the update: its report counts as shown (no pop-up on first load)
      if (isCycleComplete(data, workoutProgram)) data = { ...data, reportShownCycleIds: [...data.reportShownCycleIds, data.currentCycle.id] };
      return { data, source: 'migrated', backupsMade: commit() };
    } catch (e) {
      return { data: freshData(ctx), source: 'error', backupsMade: [] };
    }
  }

  return { data: freshData(ctx), source: 'fresh', backupsMade: commit() };
};
