// Version 3 of the saved workout data. Not used by the app yet.
// Language and weight unit are NOT part of it; they keep their own saved keys.
import { WeightUnit } from './units';

// One set of one exercise. Weight stays text plus its unit, exactly like the v2 format.
export interface LoggedSet {
  weight: string;
  reps: string;
  unit: WeightUnit;
  done: boolean;
  tag?: 'easy' | 'good' | 'max'; // no UI yet
  updatedAt?: string;
}

// One exercise slot on one day within a cycle.
export interface LoggedSlot {
  slotId: string;
  exerciseId: string; // shared id (see getExerciseId)
  performedExerciseId: string; // equals exerciseId for now; later it can be a swapped alternative
  sets: Record<number, LoggedSet>;
}

// One program week. It ends when the user completes it or taps "Start new week";
// there is no automatic rollover by calendar.
export interface Cycle {
  id: string;
  startedAt: string;
  endedAt?: string;
  slots: Record<string, LoggedSlot>; // keyed by slot id
}

export interface BestSet {
  weight: string;
  reps: string;
  unit: WeightUnit;
}

export interface AppDataV3 {
  schemaVersion: 3;
  currentCycle: Cycle;
  archivedCycles: Cycle[];
  bests: Record<string, BestSet>; // keyed by shared exercise id
  reportShownCycleIds: string[];
}
