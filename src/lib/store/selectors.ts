// Read-only views of AppDataV3 in exactly the shapes the components use (the v2 shapes). Pure functions.
// Each comes in two forms: for any week (a Cycle, current or archived) and for the current week.
import { parseSetsCount } from '../../utils/parseSetsCount';
import { performedExerciseIdIn } from '../exerciseVariants';
import { AppDataV3, BestSet, Cycle, LoggedSet, LoggedSlot } from '../model';
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

const slotIn = (cycle: Cycle, slotId: string): LoggedSlot | undefined =>
  hasOwn(cycle.slots, slotId) ? cycle.slots[slotId] : undefined;

// Ticked set indexes of a slot in a week, sorted (v2: completedSets[slotId])
export const cycleCompletedIndexes = (cycle: Cycle, slotId: string): number[] => {
  const slot = slotIn(cycle, slotId);
  if (!slot) return [];
  return Object.entries(slot.sets)
    .filter(([, set]) => set.done)
    .map(([setIndex]) => Number(setIndex))
    .sort((a, b) => a - b);
};

export const completedIndexes = (data: AppDataV3, slotId: string): number[] => cycleCompletedIndexes(data.currentCycle, slotId);

// Every ticked set in a week, in any slot (not capped by the program's set counts)
export const tickedSetCount = (cycle: Cycle): number =>
  Object.values(cycle.slots).reduce((count, slot) => count + Object.values(slot.sets).filter((set) => set.done).length, 0);

// Typed weight/reps of a slot in a week (v2: setDetails[slotId])
export const cycleSetDetails = (cycle: Cycle, slotId: string): Record<number, SetDetailView> => {
  const slot = slotIn(cycle, slotId);
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

export const setDetails = (data: AppDataV3, slotId: string): Record<number, SetDetailView> => cycleSetDetails(data.currentCycle, slotId);

// Best set of the exercise done in a slot this week: shared by every slot of the same exercise (e.g. rdl and
// rdl-lower-b, or hack-squat on Day 2 and Day 5); a swapped-in alternative has its own best
export const previousBest = (data: AppDataV3, slotId: string): BestSet | undefined => {
  const exerciseId = performedExerciseIdIn(data.currentCycle, slotId);
  return hasOwn(data.bests, exerciseId) ? data.bests[exerciseId] : undefined;
};

// Counted exactly like App.tsx always did: per exercise, the NUMBER of ticked sets, capped at its set count.
// Known quirk kept on purpose: ticked indexes beyond the set count still count toward it.
export const progressOfCycle = (cycle: Cycle, program: ProgramDay[]): CycleProgress => {
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
      dayCompleted += Math.min(cycleCompletedIndexes(cycle, exercise.id).length, setCount);
    }
    perDay[day.id] = { completed: dayCompleted, total: dayTotal };
    if (dayTotal > 0 && dayCompleted === dayTotal) completedDays += 1;
    completedSets += dayCompleted;
    totalSets += dayTotal;
  }
  return { perDay, completedSets, totalSets, completedDays };
};

export const cycleProgress = (data: AppDataV3, program: ProgramDay[]): CycleProgress => progressOfCycle(data.currentCycle, program);

// The remark saved for an exercise id ('' when there is none)
export const remarkFor = (data: AppDataV3, exerciseId: string): string =>
  data.remarks && hasOwn(data.remarks, exerciseId) ? data.remarks[exerciseId] : '';

// The remark of the exercise done in a slot this week: Day 2 and Day 5 Leg Press share one; a swapped-in
// alternative shows its own (nothing is copied or lost by a swap)
export const remarkForSlot = (data: AppDataV3, slotId: string): string => remarkFor(data, performedExerciseIdIn(data.currentCycle, slotId));

export const isCycleComplete = (data: AppDataV3, program: ProgramDay[]): boolean => {
  const { completedSets, totalSets } = cycleProgress(data, program);
  return totalSets > 0 && completedSets === totalSets;
};
