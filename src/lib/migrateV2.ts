// Turns the v2 saved data (ticks, set details, bests) into the v3 model. Not used by the app yet.
// Pure: no storage and no clock. Time and ids come from `ctx`, so the same input and ctx always give the
// same output. Malformed entries are skipped one at a time, nothing throws, and the input is never changed
// (values are copied, so the output shares no objects with it).
import { isNewBest } from './bestSet';
import { exerciseIdForSlotId } from './exerciseIds';
import { AppDataV3, BestSet, LoggedSet, LoggedSlot } from './model';
import { CompletedSets, PreviousBests, SetDetailsByExercise } from './savedData';
import { WeightUnit } from './units';

export interface V2Data {
  completedSets: CompletedSets;
  setDetails: SetDetailsByExercise;
  bests: PreviousBests;
}

export interface MigrationContext {
  now: Date;
  makeId: () => string;
}

interface V2Detail {
  weight: string;
  reps: string;
  unit: unknown;
  timestamp?: unknown;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isUnit = (value: unknown): value is WeightUnit => value === 'kg' || value === 'lbs';

const isSetIndex = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

const isSetIndexKey = (key: string) => /^(0|[1-9]\d*)$/.test(key);

// Own entries of a plain object; nothing for anything else (null, arrays, text, ...)
const entriesOf = (value: unknown): [string, unknown][] => (isPlainObject(value) ? Object.entries(value) : []);

const toLoggedSet = (detail: V2Detail | undefined, done: boolean): LoggedSet => {
  if (!detail) return { weight: '', reps: '', unit: 'kg', done };
  const set: LoggedSet = { weight: detail.weight, reps: detail.reps, unit: isUnit(detail.unit) ? detail.unit : 'kg', done };
  if (typeof detail.timestamp === 'string') set.updatedAt = detail.timestamp;
  return set;
};

export const migrateV2ToV3 = (input: V2Data, ctx: MigrationContext): AppDataV3 => {
  const data: Partial<Record<keyof V2Data, unknown>> = isPlainObject(input) ? input : {};

  // Ticked set indexes per slot id. Ticks are the only source of "done"; the old "completed" field is ignored.
  const ticks = new Map<string, Set<number>>();
  for (const [slotId, setIndexes] of entriesOf(data.completedSets)) {
    if (Array.isArray(setIndexes)) ticks.set(slotId, new Set(setIndexes.filter(isSetIndex)));
  }

  // Usable set details per slot id: weight and reps must be text, keys must be set numbers
  const details = new Map<string, Map<number, V2Detail>>();
  for (const [slotId, sets] of entriesOf(data.setDetails)) {
    if (!isPlainObject(sets)) continue;
    const usable = new Map<number, V2Detail>();
    for (const [key, detail] of Object.entries(sets)) {
      if (isSetIndexKey(key) && isPlainObject(detail) && typeof detail.weight === 'string' && typeof detail.reps === 'string') {
        usable.set(Number(key), detail as unknown as V2Detail);
      }
    }
    details.set(slotId, usable);
  }

  // One LoggedSlot per slot id found in ticks or details. Unknown slot ids are kept with their own id.
  // Maps + Object.fromEntries keep odd ids like "__proto__" as plain keys.
  const slots = new Map<string, LoggedSlot>();
  for (const slotId of new Set([...ticks.keys(), ...details.keys()])) {
    const ticked = ticks.get(slotId) ?? new Set<number>();
    const slotDetails = details.get(slotId) ?? new Map<number, V2Detail>();
    const setIndexes = [...new Set([...ticked, ...slotDetails.keys()])].sort((a, b) => a - b);
    const exerciseId = exerciseIdForSlotId(slotId);
    slots.set(slotId, {
      slotId,
      exerciseId,
      performedExerciseId: exerciseId,
      sets: Object.fromEntries(setIndexes.map((i) => [i, toLoggedSet(slotDetails.get(i), ticked.has(i))])),
    });
  }

  // Bests move from slot ids to shared exercise ids. When two slots share an exercise, the stronger one
  // (estimated 1RM, compared in kg) wins; on a tie the one saved first is kept.
  const bests = new Map<string, BestSet>();
  for (const [slotId, best] of entriesOf(data.bests)) {
    if (!isPlainObject(best) || typeof best.weight !== 'string' || typeof best.reps !== 'string' || !isUnit(best.unit)) {
      continue;
    }
    const candidate: BestSet = { weight: best.weight, reps: best.reps, unit: best.unit };
    const exerciseId = exerciseIdForSlotId(slotId);
    const current = bests.get(exerciseId);
    if (!current || isNewBest(candidate, current)) bests.set(exerciseId, candidate);
  }

  return {
    schemaVersion: 3,
    currentCycle: {
      id: ctx.makeId(),
      startedAt: ctx.now.toISOString(),
      slots: Object.fromEntries(slots),
    },
    archivedCycles: [],
    bests: Object.fromEntries(bests),
    reportShownCycleIds: [],
  };
};
