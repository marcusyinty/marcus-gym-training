// Read-only views of AppDataV3 in exactly the shapes the components use today (the v2 shapes), so the
// store can be connected later without changing any component. Pure functions. Not used by the app yet.
import { parseSetsCount } from '../../utils/parseSetsCount';
import { exerciseIdForSlotId } from '../exerciseIds';
import { AppDataV3, BestSet, LoggedSet, LoggedSlot } from '../model';
import { WeightUnit } from '../units';

// Same fields as the v2 SetDetail the cards read
export interface SetDetailView {
  setNumber: number;
  weight: string;
  reps: string;
  unit: WeightUnit;
  timestamp?: string;
}

// The parts of the program these selectors need (works for WorkoutDay and EnrichedWorkoutDay)
export interface ProgramDay {
  id: string;
  exercises: { id: string; sets: string }[];
}

export interface CycleProgress {
  perDay: Record<string, { completed: number; total: number }>;
  completedSets: number;
  totalSets: number;
  completedDays: number;
}

const hasOwn = (object: object, key: string | number) => Object.prototype.hasOwnProperty.call(object, key);

// A set created only by a tick (nothing typed, never edited, as migrated or via toggleSet) has no detail
// entry, exactly like v2, where only the tick existed.
export const hasDetail = (set: LoggedSet): boolean => set.updatedAt !== undefined || set.weight !== '' || set.reps !== '';

const currentSlot = (data: AppDataV3, slotId: string): LoggedSlot | undefined =>
  hasOwn(data.currentCycle.slots, slotId) ? data.currentCycle.slots[slotId] : undefined;

// Ticked set indexes of a slot in the current cycle, sorted (v2: completedSets[slotId])
export const completedIndexes = (data: AppDataV3, slotId: string): number[] => {
  const slot = currentSlot(data, slotId);
  if (!slot) return [];
  return Object.entries(slot.sets)
    .filter(([, set]) => set.done)
    .map(([setIndex]) => Number(setIndex))
    .sort((a, b) => a - b);
};

// Typed weight/reps of a slot in the current cycle (v2: setDetails[slotId])
export const setDetails = (data: AppDataV3, slotId: string): Record<number, SetDetailView> => {
  const slot = currentSlot(data, slotId);
  if (!slot) return {};
  return Object.fromEntries(
    Object.entries(slot.sets)
      .filter(([, set]) => hasDetail(set))
      .map(([setIndex, set]) => {
        const view: SetDetailView = { setNumber: Number(setIndex) + 1, weight: set.weight, reps: set.reps, unit: set.unit };
        if (set.updatedAt !== undefined) view.timestamp = set.updatedAt;
        return [setIndex, view];
      })
  );
};

// Best set for a slot, shared by every slot of the same exercise (e.g. rdl and rdl-lower-b)
export const previousBest = (data: AppDataV3, slotId: string): BestSet | undefined => {
  const exerciseId = exerciseIdForSlotId(slotId);
  return hasOwn(data.bests, exerciseId) ? data.bests[exerciseId] : undefined;
};

// Counted exactly like App.tsx today: per exercise, the NUMBER of ticked sets, capped at its set count.
// Known quirk kept on purpose: ticked indexes beyond the set count still count toward it.
export const cycleProgress = (data: AppDataV3, program: ProgramDay[]): CycleProgress => {
  const perDay: CycleProgress['perDay'] = {};
  let completedSets = 0;
  let totalSets = 0;
  let completedDays = 0;
  for (const day of program) {
    let dayCompleted = 0;
    let dayTotal = 0;
    for (const exercise of day.exercises) {
      const setCount = parseSetsCount(exercise.sets);
      dayTotal += setCount;
      dayCompleted += Math.min(completedIndexes(data, exercise.id).length, setCount);
    }
    perDay[day.id] = { completed: dayCompleted, total: dayTotal };
    if (dayTotal > 0 && dayCompleted === dayTotal) completedDays += 1;
    completedSets += dayCompleted;
    totalSets += dayTotal;
  }
  return { perDay, completedSets, totalSets, completedDays };
};

export const isCycleComplete = (data: AppDataV3, program: ProgramDay[]): boolean => {
  const { completedSets, totalSets } = cycleProgress(data, program);
  return totalSets > 0 && completedSets === totalSets;
};
