// The things the app saves, with their localStorage keys and formats (do not rename keys).
// Each `parse` checks the shape and drops bad entries instead of crashing.
import { Language } from '../data/translations';
import { SetDetail } from '../types/workout';
import { getDefaultStorage, safeRead, safeWrite, StorageLike, StoredItem } from './storage';
import { pickDefaultUnit, WeightUnit } from './units';

export type CompletedSets = Record<string, number[]>;
export type SetDetailsByExercise = Record<string, Record<number, SetDetail>>;
export type PreviousBest = { weight: string; reps: string; unit: 'kg' | 'lbs' };
export type PreviousBests = Record<string, PreviousBest>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isUnit = (value: unknown): value is 'kg' | 'lbs' => value === 'kg' || value === 'lbs';

const isSetIndex = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

// Weight/reps/unit are what the UI needs; any other fields on a set are kept as they are.
const isLoggedSet = (value: unknown): value is PreviousBest =>
  isPlainObject(value) && typeof value.weight === 'string' && typeof value.reps === 'string' && isUnit(value.unit);

// Runs `cleanEntry` on every entry of a stored object. Entries it returns null for are dropped.
const parseRecord = <V>(
  raw: string,
  cleanEntry: (value: unknown, key: string) => { value: V; dropped: boolean } | null
): { value: Record<string, V>; dropped: boolean } => {
  const data: unknown = JSON.parse(raw);
  if (!isPlainObject(data)) return { value: {}, dropped: true };

  const value: Record<string, V> = {};
  let dropped = false;
  for (const [key, entry] of Object.entries(data)) {
    const cleaned = cleanEntry(entry, key);
    if (cleaned) value[key] = cleaned.value;
    if (!cleaned || cleaned.dropped) dropped = true;
  }
  return { value, dropped };
};

// Saved as plain text ("en" / "zh"), not JSON.
export const languageItem: StoredItem<Language> = {
  key: 'language_preference',
  fallback: 'en',
  parse: (raw) => ({ value: raw === 'zh' ? 'zh' : 'en', dropped: raw !== 'zh' && raw !== 'en' }),
  serialize: (lang) => lang,
};

// { [exerciseId]: [setIndex, ...] }
export const completedSetsItem: StoredItem<CompletedSets> = {
  key: 'aesthetic_recomp_completed_sets_v2',
  fallback: {},
  parse: (raw) =>
    parseRecord(raw, (entry) => {
      if (!Array.isArray(entry)) return null;
      const setIndexes = entry.filter(isSetIndex);
      return { value: setIndexes, dropped: setIndexes.length !== entry.length };
    }),
  serialize: (value) => JSON.stringify(value),
};

// { [exerciseId]: { [setIndex]: SetDetail } }
export const setDetailsItem: StoredItem<SetDetailsByExercise> = {
  key: 'aesthetic_recomp_set_details_v2',
  fallback: {},
  parse: (raw) =>
    parseRecord(raw, (entry) => {
      if (!isPlainObject(entry)) return null;
      const sets: Record<number, SetDetail> = {};
      let dropped = false;
      for (const [setIndex, detail] of Object.entries(entry)) {
        if (/^(0|[1-9]\d*)$/.test(setIndex) && isLoggedSet(detail)) sets[Number(setIndex)] = detail as SetDetail;
        else dropped = true;
      }
      return { value: sets, dropped };
    }),
  serialize: (value) => JSON.stringify(value),
};

// { [exerciseId]: { weight, reps, unit } }
export const previousBestsItem: StoredItem<PreviousBests> = {
  key: 'aesthetic_recomp_previous_bests_v2',
  fallback: {},
  parse: (raw) => parseRecord(raw, (entry) => (isLoggedSet(entry) ? { value: entry, dropped: false } : null)),
  serialize: (value) => JSON.stringify(value),
};

// One weight unit for the whole app. Saved as plain text ("kg" / "lbs"), like the language key.
export const weightUnitItem: StoredItem<WeightUnit> = {
  key: 'aesthetic_recomp_unit_v1',
  fallback: 'kg',
  parse: (raw) => ({ value: raw === 'lbs' ? 'lbs' : 'kg', dropped: raw !== 'kg' && raw !== 'lbs' }),
  serialize: (unit) => unit,
};

// First run with the unit setting: start with the unit most saved sets were typed in, and save that
// choice once. Only the new unit key is ever written here; the set details are just read.
export const saveDefaultWeightUnitIfMissing = (storage: StorageLike | null = getDefaultStorage()) => {
  if (!storage) return;
  try {
    const existing = storage.getItem(weightUnitItem.key);
    if (existing !== null && existing !== '') return;
  } catch (e) {
    return;
  }
  safeWrite(weightUnitItem.key, weightUnitItem.serialize(pickDefaultUnit(safeRead(setDetailsItem, storage))), storage);
};
