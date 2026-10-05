// The swap rule: which exercise a slot does this week. Pure, so the reducer, the store and the UI (step 3B)
// all decide the same way and get the same reason codes.
import { exerciseIdForSlotId, isProgramSlot } from '../exerciseIds';
import { allowedExerciseIds, isAllowedInSlot, performedExerciseIdIn } from '../exerciseVariants';
import { AppDataV3, LoggedSlot } from '../model';
import { hasDetail } from './selectors';

export interface SwapRequest {
  cycleId: string; // the week the user was looking at
  slotId: string;
  from: string; // the exercise the user saw in the slot
  to: string;
}

// weekChanged: another tab started a new week; changedElsewhere: the slot was swapped elsewhere meanwhile;
// notAllowed: not the slot's own exercise or one of its alternatives; hasTickedSets: untick them first
export type SwapBlockReason = 'weekChanged' | 'notAllowed' | 'changedElsewhere' | 'sameExercise' | 'hasTickedSets';
export type SwapCheck = { ok: true; clearsTypedValues: boolean } | { ok: false; reason: SwapBlockReason };

const hasOwn = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
const slotOf = (data: AppDataV3, slotId: string): LoggedSlot | undefined =>
  hasOwn(data.currentCycle.slots, slotId) ? data.currentCycle.slots[slotId] : undefined;

// A swap is only for the current week, never with a ticked set (one version per slot per week). Typed
// weights/reps without a tick belong to the other exercise, so they are cleared (the UI asks first).
export const checkSwap = (data: AppDataV3, request: SwapRequest): SwapCheck => {
  const { cycleId, slotId, from, to } = request;
  if (data.currentCycle.id !== cycleId) return { ok: false, reason: 'weekChanged' };
  if (!isProgramSlot(slotId) || !isAllowedInSlot(slotId, to)) return { ok: false, reason: 'notAllowed' };
  const current = performedExerciseIdIn(data.currentCycle, slotId);
  if (current !== from) return { ok: false, reason: 'changedElsewhere' };
  if (from === to) return { ok: false, reason: 'sameExercise' };
  const sets = Object.values(slotOf(data, slotId)?.sets ?? {});
  if (sets.some((set) => set.done)) return { ok: false, reason: 'hasTickedSets' };
  return { ok: true, clearsTypedValues: sets.some((set) => hasDetail(set) || set.tag !== undefined) };
};

// Applies an allowed swap (call checkSwap first). Back to the slot's own exercise removes the slot's saved
// data entirely (as if never touched); an alternative starts with no sets. Bests are never touched.
export const applySwap = (data: AppDataV3, slotId: string, to: string): AppDataV3 => {
  const { [slotId]: _old, ...otherSlots } = data.currentCycle.slots;
  const own = exerciseIdForSlotId(slotId);
  const slots = to === own ? otherSlots : { ...otherSlots, [slotId]: { slotId, exerciseId: own, performedExerciseId: to, sets: {} } };
  return { ...data, currentCycle: { ...data.currentCycle, slots } };
};

export interface SwapOptions {
  current: string; // the exercise done in the slot this week
  choices: string[]; // the slot's own exercise first, then its alternatives (just the own one if there are none)
  blockedBy: 'hasTickedSets' | null;
  hasTypedValues: boolean; // a swap would clear them (the UI asks to confirm)
}

// What the swap UI needs for one slot of the current week
export const swapOptions = (data: AppDataV3, slotId: string): SwapOptions => {
  const sets = Object.values(slotOf(data, slotId)?.sets ?? {});
  return {
    current: performedExerciseIdIn(data.currentCycle, slotId),
    choices: allowedExerciseIds(slotId),
    blockedBy: sets.some((set) => set.done) ? 'hasTickedSets' : null,
    hasTypedValues: sets.some((set) => !set.done && (hasDetail(set) || set.tag !== undefined)),
  };
};
