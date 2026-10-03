// "Previous best" rules, as pure functions (no React, no storage):
// - Sets are ranked by Epley estimated one-rep max: weight * (1 + reps / 30), compared in kg.
// - Only sets that are done (ticked) count. A best never goes down, and a tie keeps the existing best.
//   (Applied by the store's reducer, src/lib/store/reducer.ts.)
import { PreviousBest } from './savedData';
import { parseNumber, toKg } from './units';

// Estimates closer than this count as a tie, so float rounding (e.g. the same load in kg vs lbs) never wins
const TIE_TOLERANCE_KG = 1e-6;

// Like parseNumber, but 0 is invalid too.
const parsePositiveNumber = (text: string): number | null => {
  const value = parseNumber(text);
  return value !== null && value > 0 ? value : null;
};

// Epley estimated one-rep max in kg, or null when weight or reps are invalid.
export const estimateOneRepMaxKg = (set: PreviousBest): number | null => {
  const weight = parsePositiveNumber(set.weight);
  const reps = parsePositiveNumber(set.reps);
  if (weight === null || reps === null) return null;
  return toKg(weight, set.unit) * (1 + reps / 30);
};

// True when `candidate` clearly beats `currentBest`. An existing best that is not a valid number
// (e.g. an old typo) can be beaten by any valid set.
export const isNewBest = (candidate: PreviousBest, currentBest: PreviousBest | undefined): boolean => {
  const candidateKg = estimateOneRepMaxKg(candidate);
  if (candidateKg === null) return false;
  const currentKg = currentBest ? estimateOneRepMaxKg(currentBest) : null;
  return currentKg === null || candidateKg > currentKg + TIE_TOLERANCE_KG;
};
