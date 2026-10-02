// Shared exercise ids. A "slot" is one exercise on one day (its `id` is unique and translations use it).
// When the same exercise appears on two days, both slots carry the same `exerciseId`.
import { workoutProgram } from '../data/workoutProgram';

export const getExerciseId = (slot: { id: string; exerciseId?: string }): string => slot.exerciseId ?? slot.id;

const exerciseIdBySlotId: Record<string, string> = Object.fromEntries(
  workoutProgram.flatMap((day) => day.exercises.map((slot) => [slot.id, getExerciseId(slot)]))
);

export const isProgramSlot = (slotId: string): boolean => Object.prototype.hasOwnProperty.call(exerciseIdBySlotId, slotId);

// Exercise id for a slot id. Slot ids that are not in the program are returned unchanged (never dropped).
export const exerciseIdForSlotId = (slotId: string): string =>
  isProgramSlot(slotId) ? exerciseIdBySlotId[slotId] : slotId;
