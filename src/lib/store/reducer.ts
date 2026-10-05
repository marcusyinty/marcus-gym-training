// The one place that changes AppDataV3, following exactly today's rules (ticks, weights, reps, units,
// bests, resets, weeks). Pure: every change returns a new object and the input is never mutated.
import { isNewBest } from '../bestSet';
import { exerciseIdForSlotId } from '../exerciseIds';
import { AppDataV3, LoggedSet, LoggedSlot } from '../model';
import { WeightUnit, withRepsEdit, withWeightEdit } from '../units';
import { hasDetail, tickedSetCount } from './selectors';
import { applySwap, checkSwap } from './swap';
import { knownExerciseIds } from '../exerciseVariants';
import { normalizeRemark } from '../remarks';
import { BodyData, hasBodyData, LengthValue, WeightValue } from '../body';

export type SetTag = 'easy' | 'good' | 'max';

export type StoreAction =
  // unit: the app's current unit, used if the tick creates a new set
  | { type: 'toggleSet'; slotId: string; setIndex: number; unit: WeightUnit }
  | { type: 'editWeight'; slotId: string; setIndex: number; weight: string; unit: WeightUnit }
  | { type: 'editReps'; slotId: string; setIndex: number; reps: string; unit: WeightUnit }
  | { type: 'setTag'; slotId: string; setIndex: number; tag: SetTag | null }
  | { type: 'resetDay'; slotIds: string[] }
  | { type: 'resetAll' }
  | { type: 'markReportShown'; cycleId: string }
  // a restored backup (already checked with validateV3) replaces everything
  | { type: 'replaceAll'; data: AppDataV3 }
  // cycleId: the week the user was looking at; newId: the id for the new empty week
  | { type: 'startNewWeek'; cycleId: string; newId: string }
  // which exercise a slot does this week (see swap.ts for the rule); from: the exercise the user saw there
  | { type: 'swapExercise'; cycleId: string; slotId: string; from: string; to: string }
  // a permanent note for an exercise id; empty text deletes it
  | { type: 'setRemark'; exerciseId: string; text: string }
  // body measurements (values already checked by the store); previousDay: the day an edited entry had before
  | { type: 'saveBodyEntry'; day: string; entry: { weight: WeightValue; waist?: LengthValue; hips?: LengthValue }; previousDay?: string }
  | { type: 'deleteBodyEntry'; day: string }
  | { type: 'setHeight'; height: LengthValue | null };

export interface ReducerContext {
  now: Date;
}

const hasOwn = (object: object, key: string | number) => Object.prototype.hasOwnProperty.call(object, key);

const getSlot = (state: AppDataV3, slotId: string): LoggedSlot | undefined =>
  hasOwn(state.currentCycle.slots, slotId) ? state.currentCycle.slots[slotId] : undefined;

const getSet = (slot: LoggedSlot | undefined, setIndex: number): LoggedSet | undefined =>
  slot && hasOwn(slot.sets, setIndex) ? slot.sets[setIndex] : undefined;

const newSlot = (slotId: string): LoggedSlot => {
  const exerciseId = exerciseIdForSlotId(slotId);
  return { slotId, exerciseId, performedExerciseId: exerciseId, sets: {} };
};

// Returns state with `slot` placed in the current cycle (new objects along the way only)
const withSlot = (state: AppDataV3, slot: LoggedSlot): AppDataV3 => ({
  ...state,
  currentCycle: { ...state.currentCycle, slots: { ...state.currentCycle.slots, [slot.slotId]: slot } },
});

const withoutKey = <V>(record: Record<string, V>, key: string): Record<string, V> =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

// Body data with nothing in it is no field at all (so data without body measurements stays as it was)
const withBody = (state: AppDataV3, body: BodyData): AppDataV3 => {
  const { body: _old, ...rest } = state;
  return hasBodyData(body) ? { ...rest, body } : rest;
};

// A tag says how a finished set felt, so only a ticked set has one
const withoutTag = (set: LoggedSet): LoggedSet => {
  const { tag: _tag, ...untagged } = set;
  return untagged;
};

// Bests only come from done sets and only go up (estimated 1RM in kg; a tie keeps the existing best).
// Keyed by the exercise actually done (performedExerciseId): the slot's own shared id, so two slots of the
// same exercise share one best, or an alternative's own id, which never touches the default's best.
const withBestFrom = (state: AppDataV3, slot: LoggedSlot, set: LoggedSet): AppDataV3 => {
  if (!set.done) return state;
  const key = slot.performedExerciseId;
  const candidate = { weight: set.weight, reps: set.reps, unit: set.unit };
  const current = hasOwn(state.bests, key) ? state.bests[key] : undefined;
  if (!isNewBest(candidate, current)) return state;
  return { ...state, bests: { ...state.bests, [key]: candidate } };
};

export const reduce = (state: AppDataV3, action: StoreAction, ctx: ReducerContext): AppDataV3 => {
  switch (action.type) {
    case 'toggleSet': {
      const slot = getSlot(state, action.slotId) ?? newSlot(action.slotId);
      const existing = getSet(slot, action.setIndex);
      if (existing?.done) {
        // Untick: the tag goes with it. A set that only ever had the tick disappears again; bests are never lowered.
        const sets = hasDetail(existing)
          ? { ...slot.sets, [action.setIndex]: { ...withoutTag(existing), done: false } }
          : withoutKey(slot.sets, String(action.setIndex));
        return withSlot(state, { ...slot, sets });
      }
      // A newly ticked set never starts with a tag (not even one an older version left on the unticked set)
      const set: LoggedSet = existing ? { ...withoutTag(existing), done: true } : { weight: '', reps: '', unit: action.unit, done: true };
      const nextSlot = { ...slot, sets: { ...slot.sets, [action.setIndex]: set } };
      return withBestFrom(withSlot(state, nextSlot), nextSlot, set);
    }

    case 'editWeight':
    case 'editReps': {
      const slot = getSlot(state, action.slotId) ?? newSlot(action.slotId);
      const existing = getSet(slot, action.setIndex);
      // A set that was only ticked has nothing stored yet (same as v2, where it had no detail)
      const stored = existing && hasDetail(existing) ? existing : undefined;
      // Same rules as today: a new weight is saved in the current unit; editing reps keeps the stored weight and unit
      const edited =
        action.type === 'editWeight'
          ? withWeightEdit(stored, action.weight, action.unit)
          : withRepsEdit(stored, action.reps, action.unit);
      // A ticked set keeps its tag when its numbers are corrected
      const kept = existing ? (existing.done ? existing : withoutTag(existing)) : undefined;
      const set: LoggedSet = { ...kept, ...edited, done: existing?.done ?? false, updatedAt: ctx.now.toISOString() };
      const nextSlot = { ...slot, sets: { ...slot.sets, [action.setIndex]: set } };
      const next = withSlot(state, nextSlot);
      // As today: a done set is checked for a new best only when its weight, reps or unit actually changed
      const changed = !existing || existing.weight !== set.weight || existing.reps !== set.reps || existing.unit !== set.unit;
      return changed ? withBestFrom(next, nextSlot, set) : next;
    }

    case 'setTag': {
      // Only a ticked set can be tagged (null clears the tag). Tags never touch bests, volume or progress.
      const slot = getSlot(state, action.slotId);
      const existing = getSet(slot, action.setIndex);
      if (!slot || !existing?.done || (existing.tag ?? null) === action.tag) return state;
      const set: LoggedSet = action.tag ? { ...withoutTag(existing), tag: action.tag } : withoutTag(existing);
      return withSlot(state, { ...slot, sets: { ...slot.sets, [action.setIndex]: set } });
    }

    case 'resetDay': {
      // Current cycle only; archived cycles and bests are never touched (bests stay, as today). Removing the
      // slots also puts any swapped exercise back to the slot's own exercise.
      const slots = Object.fromEntries(Object.entries(state.currentCycle.slots).filter(([slotId]) => !action.slotIds.includes(slotId)));
      return { ...state, currentCycle: { ...state.currentCycle, slots } };
    }

    case 'resetAll':
      // Current cycle only, same as resetDay: archived cycles and bests are never touched
      return { ...state, currentCycle: { ...state.currentCycle, slots: {} } };

    case 'replaceAll': {
      // A backup made before remarks existed has no remarks field: the phone keeps its own remarks. A backup
      // with the field (even empty) replaces them. No remarks are kept as no field at all. Body measurements
      // follow the same rule.
      const { remarks: _ignored, body: _ignoredBody, ...rest } = action.data;
      const remarks = action.data.remarks === undefined ? state.remarks : action.data.remarks;
      const body = action.data.body === undefined ? state.body : action.data.body;
      const withRemarks: AppDataV3 = remarks && Object.keys(remarks).length > 0 ? { ...rest, remarks } : rest;
      return hasBodyData(body) ? { ...withRemarks, body } : withRemarks;
    }

    case 'saveBodyEntry': {
      const current = state.body ?? { entries: {} };
      const others = action.previousDay !== undefined ? withoutKey(current.entries, action.previousDay) : current.entries;
      const entry = { ...action.entry, updatedAt: ctx.now.toISOString() };
      return withBody(state, { ...current, entries: { ...withoutKey(others, action.day), [action.day]: entry } });
    }

    case 'deleteBodyEntry': {
      if (!state.body || !hasOwn(state.body.entries, action.day)) return state;
      return withBody(state, { ...state.body, entries: withoutKey(state.body.entries, action.day) });
    }

    case 'setHeight': {
      if (JSON.stringify(state.body?.height ?? null) === JSON.stringify(action.height)) return state;
      const { height: _old, ...current } = state.body ?? { entries: {} };
      return withBody(state, action.height ? { ...current, height: action.height } : current);
    }

    case 'setRemark': {
      // Only for exercise ids the app knows; the text is cleaned (see remarks.ts)
      if (!knownExerciseIds.has(action.exerciseId)) return state;
      const text = normalizeRemark(action.text);
      const current = state.remarks && hasOwn(state.remarks, action.exerciseId) ? state.remarks[action.exerciseId] : undefined;
      if ((current ?? '') === text) return state;
      const others = Object.fromEntries(Object.entries(state.remarks ?? {}).filter(([id]) => id !== action.exerciseId));
      if (text === '') {
        // Deleting the last remark removes the field again
        const { remarks: _old, ...rest } = state;
        return Object.keys(others).length > 0 ? { ...rest, remarks: others } : rest;
      }
      return { ...state, remarks: { ...others, [action.exerciseId]: text } };
    }

    case 'swapExercise':
      // Not allowed (ticked sets, another week, ...): nothing changes; the store reports the reason
      return checkSwap(state, action).ok ? applySwap(state, action.slotId, action.to) : state;

    case 'startNewWeek': {
      // Nothing happens unless the user's week is still the current one (another tab may have moved on),
      // the week has at least one ticked set (empty weeks are never archived) and the new id is unused.
      // Bests and reportShownCycleIds stay exactly as they are.
      const current = state.currentCycle;
      const idTaken = action.newId === current.id || state.archivedCycles.some((cycle) => cycle.id === action.newId);
      if (current.id !== action.cycleId || tickedSetCount(current) === 0 || idTaken) return state;
      const now = ctx.now.toISOString();
      return {
        ...state,
        archivedCycles: [...state.archivedCycles, { ...current, endedAt: now }],
        currentCycle: { id: action.newId, startedAt: now, slots: {} },
      };
    }

    case 'markReportShown':
      if (state.reportShownCycleIds.includes(action.cycleId)) return state;
      return { ...state, reportShownCycleIds: [...state.reportShownCycleIds, action.cycleId] };
  }
};
