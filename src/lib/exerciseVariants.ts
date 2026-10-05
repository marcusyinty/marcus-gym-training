// Which exercise is done in a slot: its default exercise, or an alternative picked for the current week.
// The saved data keeps the choice per week in each slot's performedExerciseId (the default when nothing
// else was picked), so nothing needs migrating: every slot saved so far already holds its default there.
import { AlternativeExercise, alternativeExercises, slotAlternatives } from '../data/alternatives';
import type { Language } from '../data/translations';
import { exerciseTranslationsZh } from '../data/translations';
import { exerciseMediaMap, workoutProgram } from '../data/workoutProgram';
import { EnrichedExercise, ExerciseMedia } from '../types/workout';
import { exerciseIdForSlotId, getExerciseId } from './exerciseIds';
import { Cycle } from './model';

const hasOwn = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

const alternativeById: Record<string, AlternativeExercise> = Object.fromEntries(alternativeExercises.map((alt) => [alt.id, alt]));

export const isAlternativeExercise = (exerciseId: string): boolean => hasOwn(alternativeById, exerciseId);

// Alternatives allowed in a slot (none for most slots)
export const alternativesForSlot = (slotId: string): string[] => (hasOwn(slotAlternatives, slotId) ? [...slotAlternatives[slotId]] : []);

// Exercise ids allowed in a slot: its default first, then its alternatives
export const allowedExerciseIds = (slotId: string): string[] => [exerciseIdForSlotId(slotId), ...alternativesForSlot(slotId)];

export const isAllowedInSlot = (slotId: string, exerciseId: string): boolean => allowedExerciseIds(slotId).includes(exerciseId);

// Every exercise id the app knows: the program's (shared) ids and all alternatives
export const knownExerciseIds: ReadonlySet<string> = new Set([
  ...workoutProgram.flatMap((day) => day.exercises.map(getExerciseId)),
  ...alternativeExercises.map((alt) => alt.id),
]);

// The exercise done in a slot in one week (its default when nothing else was picked)
export const performedExerciseIdIn = (cycle: Cycle, slotId: string): string => {
  const slot = hasOwn(cycle.slots, slotId) ? cycle.slots[slotId] : undefined;
  return slot?.performedExerciseId ?? exerciseIdForSlotId(slotId);
};

// The name of the exercise done in a slot, in the chosen language
export const performedExerciseName = (slot: { id: string; name: string }, performedId: string, lang: Language): string => {
  if (hasOwn(alternativeById, performedId)) return alternativeById[performedId].name[lang];
  const zh = hasOwn(exerciseTranslationsZh, slot.id) ? exerciseTranslationsZh[slot.id] : undefined;
  return lang === 'zh' && zh ? zh.name : slot.name;
};

// The video for a file name, or undefined (no alternative has a video yet; that is not an error)
export const findExerciseMedia = (videoFilename: string): ExerciseMedia | undefined => {
  const key = videoFilename.toLowerCase();
  return hasOwn(exerciseMediaMap, key) ? exerciseMediaMap[key] : undefined;
};

export interface PerformedExercise extends EnrichedExercise {
  performedExerciseId: string;
  isAlternative: boolean;
  nameZh?: string; // an alternative's 中文 name (defaults keep using the translations by slot id)
}

// What a card shows for the exercise done in a slot (used by the swap UI in step 3B). An alternative keeps the
// slot's sets, reps and muscle tags, and has its own name, its own video (none yet) and no description yet.
export const performedExercise = (slot: EnrichedExercise, performedId: string): PerformedExercise => {
  if (!hasOwn(alternativeById, performedId) || !isAllowedInSlot(slot.id, performedId)) {
    return { ...slot, performedExerciseId: exerciseIdForSlotId(slot.id), isAlternative: false };
  }
  const alt = alternativeById[performedId];
  return {
    ...slot,
    name: alt.name.en,
    nameZh: alt.name.zh,
    coachingCue: '',
    videoFilename: alt.id,
    media: findExerciseMedia(alt.id),
    performedExerciseId: alt.id,
    isAlternative: true,
  };
};
