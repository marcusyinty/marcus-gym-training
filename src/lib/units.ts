// Weight units: conversion, display formatting and edit rules, as pure functions (no React, no storage).
// Stored weights are never converted; each set keeps the text and unit it was typed in.
import type { SetDetailsByExercise } from './savedData';

export type WeightUnit = 'kg' | 'lbs';

export const KG_PER_LB = 0.45359237;

export interface WeightedSet {
  weight: string;
  reps: string;
  unit: WeightUnit;
}

// Accepts plain non-negative numbers like "60", "62.5" or ".5". Empty, "62.", "abc", "1e3" and negatives give null.
export const parseNumber = (text: string): number | null => {
  const trimmed = text.trim();
  return /^(\d+(\.\d+)?|\.\d+)$/.test(trimmed) ? Number(trimmed) : null;
};

export const convertWeight = (value: number, from: WeightUnit, to: WeightUnit): number => {
  if (from === to) return value;
  return from === 'lbs' ? value * KG_PER_LB : value / KG_PER_LB;
};

export const toKg = (value: number, unit: WeightUnit): number => convertWeight(value, unit, 'kg');

// Rounds to 1 decimal and drops a trailing ".0": 132.277 -> "132.3", 60.004 -> "60"
export const formatWeight = (value: number): string => (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');

// Text to show for a weight typed in `fromUnit` while the app is set to `toUnit`.
// Same unit: exactly as typed (no rounding, nothing changes while typing). Different unit: converted
// and formatted. Empty or invalid: ''.
export const displayWeight = (text: string, fromUnit: WeightUnit, toUnit: WeightUnit): string => {
  if (fromUnit === toUnit) return text;
  const value = parseNumber(text);
  return value === null ? '' : formatWeight(convertWeight(value, fromUnit, toUnit));
};

// Starting unit for people who never picked one: the unit used by most sets that have a weight typed.
// A tie or no data gives "kg".
export const pickDefaultUnit = (setDetails: SetDetailsByExercise): WeightUnit => {
  let kgCount = 0;
  let lbsCount = 0;
  for (const sets of Object.values(setDetails)) {
    for (const set of Object.values(sets)) {
      if (set.weight.trim() === '') continue;
      if (set.unit === 'lbs') lbsCount++;
      else kgCount++;
    }
  }
  return lbsCount > kgCount ? 'lbs' : 'kg';
};

// Typing a weight saves it in the unit the app is set to.
export const withWeightEdit = (set: WeightedSet | undefined, weight: string, currentUnit: WeightUnit): WeightedSet => ({
  weight,
  reps: set?.reps ?? '',
  unit: currentUnit,
});

// Typing reps never relabels an old weight with a new unit: the set keeps its stored weight and unit.
// A set with nothing stored yet starts in the unit the app is set to.
export const withRepsEdit = (set: WeightedSet | undefined, reps: string, currentUnit: WeightUnit): WeightedSet =>
  set ? { weight: set.weight, reps, unit: set.unit } : { weight: '', reps, unit: currentUnit };
