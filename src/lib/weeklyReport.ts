// The numbers of the weekly report for one week (current or archived): the same rules as the report always
// used. Only ticked sets count; each set keeps the unit it was typed in, tops are compared in kg and volume
// is added up in the unit the app shows now. Pure, so the report, the history list and the tests agree.
import { parseSetsCount } from '../utils/parseSetsCount';
import { performedExerciseIdIn } from './exerciseVariants';
import { Cycle } from './model';
import { cycleCompletedIndexes, cycleSetDetails, cycleSetTag, ProgramDay, progressOfCycle, tickedSetCount } from './store/selectors';
import { convertWeight, displayWeight, parseNumber, toKg, WeightUnit } from './units';

// The best ticked set of one exercise, as the report shows it
export type TopSet =
  | { kind: 'none' } // nothing ticked
  | { kind: 'ticked'; sets: number } // ticked, but no weight or reps typed
  | { kind: 'bodyweight'; reps: number } // reps typed, no weight
  | { kind: 'weight'; weightText: string; reps: number }; // weightText in the report's unit; reps 0 = not typed

export interface ExerciseReport {
  id: string; // the slot
  performedExerciseId: string; // the exercise done in it that week (its own, or a swapped-in alternative)
  top: TopSet;
  volume: number; // in the report's unit
  complete: boolean; // every set of the exercise ticked
  maxSets: number[]; // set numbers (1, 2, ...) of ticked sets tagged Max; tags change none of the numbers above
}

export interface DayReport {
  dayId: string;
  exercises: ExerciseReport[];
}

export interface WeeklyReport {
  days: DayReport[];
  totalVolume: number;
  completedSets: number; // capped per exercise, like the progress bars
  totalSets: number;
  completedDays: number;
  totalDays: number;
  doneExercises: number;
  totalExercises: number;
  tickedSets: number; // every ticked set; 0 means the week is empty
}

const exerciseReport = (cycle: Cycle, exercise: ProgramDay['exercises'][number], unit: WeightUnit): ExerciseReport => {
  const doneIndexes = cycleCompletedIndexes(cycle, exercise.id);
  const details = cycleSetDetails(cycle, exercise.id);
  let maxWeightKg = 0;
  let weightText = '';
  let maxReps = 0;
  let volume = 0;
  for (const [key, detail] of Object.entries(details)) {
    if (!doneIndexes.includes(Number(key))) continue;
    const weight = parseNumber(detail.weight) ?? 0;
    const reps = parseFloat(detail.reps || '0') || 0;
    const weightKg = toKg(weight, detail.unit);
    if (weightKg > maxWeightKg) {
      maxWeightKg = weightKg;
      weightText = displayWeight(detail.weight, detail.unit, unit);
      maxReps = reps;
    } else if (weightKg === maxWeightKg && reps > maxReps) {
      maxReps = reps;
    }
    volume += convertWeight(weight, detail.unit, unit) * reps;
  }
  const top: TopSet =
    doneIndexes.length === 0
      ? { kind: 'none' }
      : maxWeightKg > 0
        ? { kind: 'weight', weightText, reps: maxReps }
        : maxReps > 0
          ? { kind: 'bodyweight', reps: maxReps }
          : { kind: 'ticked', sets: doneIndexes.length };
  const setCount = parseSetsCount(exercise.sets);
  return {
    id: exercise.id,
    performedExerciseId: performedExerciseIdIn(cycle, exercise.id),
    top,
    volume,
    complete: setCount > 0 && Math.min(doneIndexes.length, setCount) === setCount,
    maxSets: doneIndexes.filter((index) => cycleSetTag(cycle, exercise.id, index) === 'max').map((index) => index + 1),
  };
};

export const buildWeeklyReport = (cycle: Cycle, program: ProgramDay[], unit: WeightUnit): WeeklyReport => {
  const days = program.map((day) => ({ dayId: day.id, exercises: day.exercises.map((exercise) => exerciseReport(cycle, exercise, unit)) }));
  const exercises = days.flatMap((day) => day.exercises);
  const progress = progressOfCycle(cycle, program);
  return {
    days,
    totalVolume: exercises.reduce((sum, exercise) => sum + exercise.volume, 0),
    completedSets: progress.completedSets,
    totalSets: progress.totalSets,
    completedDays: progress.completedDays,
    totalDays: program.length,
    doneExercises: exercises.filter((exercise) => exercise.complete).length,
    totalExercises: exercises.length,
    tickedSets: tickedSetCount(cycle),
  };
};
