// The one place that changes AppDataV3, following exactly today's rules (ticks, weights, reps, units,
// bests, resets). Pure: every change returns a new object and the input is never mutated.
// Not used by the app yet.
import { isNewBest } from '../bestSet';
import { exerciseIdForSlotId } from '../exerciseIds';
import { AppDataV3, LoggedSet, LoggedSlot } from '../model';
import { WeightUnit, withRepsEdit, withWeightEdit } from '../units';
import { hasDetail } from './selectors';

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
  | { type: 'replaceAll'; data: AppDataV3 };

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

// Bests only come from done sets and only go up (estimated 1RM in kg; a tie keeps the existing best).
// Keyed by the shared exercise id, so the two slots of the same exercise share one best.
const withBestFrom = (state: AppDataV3, slot: LoggedSlot, set: LoggedSet): AppDataV3 => {
  if (!set.done) return state;
  const candidate = { weight: set.weight, reps: set.reps, unit: set.unit };
  const current = hasOwn(state.bests, slot.exerciseId) ? state.bests[slot.exerciseId] : undefined;
  if (!isNewBest(candidate, current)) return state;
  return { ...state, bests: { ...state.bests, [slot.exerciseId]: candidate } };
};

export const reduce = (state: AppDataV3, action: StoreAction, ctx: ReducerContext): AppDataV3 => {
  switch (action.type) {
    case 'toggleSet': {
      const slot = getSlot(state, action.slotId) ?? newSlot(action.slotId);
      const existing = getSet(slot, action.setIndex);
      if (existing?.done) {
        // Untick. A set that only ever had the tick disappears again; bests are never lowered.
        const sets =
          hasDetail(existing) || existing.tag !== undefined
            ? { ...slot.sets, [action.setIndex]: { ...existing, done: false } }
            : withoutKey(slot.sets, String(action.setIndex));
        return withSlot(state, { ...slot, sets });
      }
      const set: LoggedSet = existing ? { ...existing, done: true } : { weight: '', reps: '', unit: action.unit, done: true };
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
      const set: LoggedSet = { ...existing, ...edited, done: existing?.done ?? false, updatedAt: ctx.now.toISOString() };
      const nextSlot = { ...slot, sets: { ...slot.sets, [action.setIndex]: set } };
      const next = withSlot(state, nextSlot);
      // As today: a done set is checked for a new best only when its weight, reps or unit actually changed
      const changed = !existing || existing.weight !== set.weight || existing.reps !== set.reps || existing.unit !== set.unit;
      return changed ? withBestFrom(next, nextSlot, set) : next;
    }

    case 'setTag': {
      const slot = getSlot(state, action.slotId);
      const existing = getSet(slot, action.setIndex);
      if (!slot || !existing) return state; // nothing to tag
      const { tag: _previousTag, ...untagged } = existing;
      const set: LoggedSet = action.tag ? { ...untagged, tag: action.tag } : untagged;
      return withSlot(state, { ...slot, sets: { ...slot.sets, [action.setIndex]: set } });
    }

    case 'resetDay': {
      // Current cycle only; archived cycles and bests are never touched (bests stay, as today)
      const slots = Object.fromEntries(Object.entries(state.currentCycle.slots).filter(([slotId]) => !action.slotIds.includes(slotId)));
      return { ...state, currentCycle: { ...state.currentCycle, slots } };
    }

    case 'resetAll':
      return { ...state, currentCycle: { ...state.currentCycle, slots: {} } };

    case 'replaceAll':
      return { ...action.data };

    case 'markReportShown':
      if (state.reportShownCycleIds.includes(action.cycleId)) return state;
      return { ...state, reportShownCycleIds: [...state.reportShownCycleIds, action.cycleId] };
  }
};
