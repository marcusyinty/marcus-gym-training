// "Previous best" rules, as pure functions (no React, no storage):
// - Sets are ranked by Epley estimated one-rep max: weight * (1 + reps / 30), compared in kg.
// - Only sets that are done (ticked) count. A best never goes down, and a tie keeps the existing best.
import { CompletedSets, PreviousBest, PreviousBests, SetDetailsByExercise } from './savedData';

export const KG_PER_LB = 0.45359237;

// Estimates closer than this count as a tie, so float rounding (e.g. the same load in kg vs lbs) never wins
const TIE_TOLERANCE_KG = 1e-6;

// Accepts plain positive numbers like "60", "62.5" or ".5". Empty, "62.", "abc", "1e3", "0" and negatives are invalid.
const parsePositiveNumber = (text: string): number | null => {
  const trimmed = text.trim();
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
};

// Epley estimated one-rep max in kg, or null when weight or reps are invalid.
export const estimateOneRepMaxKg = (set: PreviousBest): number | null => {
  const weight = parsePositiveNumber(set.weight);
  const reps = parsePositiveNumber(set.reps);
  if (weight === null || reps === null) return null;
  const weightKg = set.unit === 'lbs' ? weight * KG_PER_LB : weight;
  return weightKg * (1 + reps / 30);
};

// True when `candidate` clearly beats `currentBest`. An existing best that is not a valid number
// (e.g. an old typo) can be beaten by any valid set.
export const isNewBest = (candidate: PreviousBest, currentBest: PreviousBest | undefined): boolean => {
  const candidateKg = estimateOneRepMaxKg(candidate);
  if (candidateKg === null) return false;
  const currentKg = currentBest ? estimateOneRepMaxKg(currentBest) : null;
  return currentKg === null || candidateKg > currentKg + TIE_TOLERANCE_KG;
};

export interface WorkoutLog {
  completedSets: CompletedSets;
  setDetails: SetDetailsByExercise;
}

// Updates bests from what changed between two versions of the log. Only sets that are done in `after`
// AND either just became done or had weight/reps/unit edited are considered; other stored bests are
// left exactly as they are. Returns `bests` itself when nothing changes.
export const nextPreviousBests = (bests: PreviousBests, before: WorkoutLog, after: WorkoutLog): PreviousBests => {
  let next = bests;
  for (const [exerciseId, doneSetIndexes] of Object.entries(after.completedSets)) {
    const doneBefore = before.completedSets[exerciseId] || [];
    for (const setIndex of doneSetIndexes) {
      const set = after.setDetails[exerciseId]?.[setIndex];
      if (!set) continue;
      const oldSet = before.setDetails[exerciseId]?.[setIndex];
      const justDone = !doneBefore.includes(setIndex);
      const edited = !oldSet || oldSet.weight !== set.weight || oldSet.reps !== set.reps || oldSet.unit !== set.unit;
      if ((justDone || edited) && isNewBest(set, next[exerciseId])) {
        next = { ...next, [exerciseId]: { weight: set.weight, reps: set.reps, unit: set.unit } };
      }
    }
  }
  return next;
};
