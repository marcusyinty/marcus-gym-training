import { describe, expect, it } from 'vitest';
import { alternativeExercises, slotAlternatives } from '../data/alternatives';
import { getEnrichedWorkoutProgram, workoutProgram } from '../data/workoutProgram';
import { getExerciseId } from './exerciseIds';
import {
  allowedExerciseIds,
  findExerciseMedia,
  isAllowedInSlot,
  knownExerciseIds,
  performedExercise,
  performedExerciseIdIn,
  performedExerciseName,
} from './exerciseVariants';

// The list from step 3A: slot id -> [alternative id, EN name, 中文 name]
const EXPECTED: Record<string, [string, string, string]> = {
  'machine-shoulder-press': ['db-shoulder-press', 'Seated DB Shoulder Press', '坐姿哑铃肩推'],
  'incline-db-press': ['incline-machine-press', 'Incline Machine Press', '上斜器械推胸'],
  'lat-pulldown': ['neutral-grip-pulldown', 'Neutral-Grip Pulldown', '对握高位下拉'],
  'one-arm-dumbbell-row': ['chest-supported-machine-row', 'Chest-Supported Machine Row', '胸托器械划船'],
  'rope-cable-tricep-pushdown': ['db-overhead-tricep-extension', 'DB Overhead Tricep Extension', '哑铃过头臂屈伸'],
  'incline-db-supinated-wrist-curl': ['cable-curl', 'Cable Curl', '绳索弯举'],
  'leg-press': ['hack-squat', 'Hack Squat', '哈克深蹲'],
  'bulgarian-split-squat': ['smith-split-squat', 'Smith Split Squat', '史密斯分腿蹲'],
  'seated-leg-curl': ['lying-leg-curl', 'Lying Leg Curl', '俯卧腿弯举'],
  'standing-calf-raises': ['seated-calf-raise', 'Seated Calf Raise', '坐姿提踵'],
  'flat-db-press': ['machine-chest-press', 'Machine Chest Press', '器械推胸'],
  'standing-cable-fly': ['pec-deck', 'Pec Deck', '蝴蝶机夹胸'],
  'btb-lateral-raise': ['db-lateral-raise', 'DB Lateral Raise', '哑铃侧平举'],
  'cable-overhead-tricep-extension': ['db-overhead-tricep-extension', 'DB Overhead Tricep Extension', '哑铃过头臂屈伸'],
  'seated-cable-row': ['chest-supported-machine-row', 'Chest-Supported Machine Row', '胸托器械划船'],
  'straight-arm-cable-pulldown': ['db-pullover', 'DB Pullover', '哑铃仰卧上拉'],
  'cable-facepull': ['reverse-pec-deck', 'Reverse Pec Deck', '反向蝴蝶机'],
  'seated-leg-curl-lower-b': ['lying-leg-curl', 'Lying Leg Curl', '俯卧腿弯举'],
  'leg-press-lower-b': ['hack-squat', 'Hack Squat', '哈克深蹲'],
};
const NO_ALTERNATIVE = ['rdl', 'rdl-lower-b', 'seated-leg-extension', '45-degree-back-extension', 'reverse-crunch-abs-a', 'decline-ab-crunch',
  'bicycle-crunches', 'reverse-crunch-abs-b', 'db-hammer-curl', 'seated-db-supinated-wrist-curls', 'seated-db-pronated-wrist-curls'];
const programSlots = workoutProgram.flatMap((day) => day.exercises);
const slotById = (id: string) => programSlots.find((slot) => slot.id === id)!;

describe('alternatives list', () => {
  it('exactly the step 3A list: every alternative once, EN + 中文 names, valid slots', () => {
    expect(new Set(alternativeExercises.map((alt) => alt.id)).size).toBe(alternativeExercises.length);
    expect(alternativeExercises).toHaveLength(15);
    for (const alt of alternativeExercises) expect([alt.name.en.trim().length > 0, alt.name.zh.trim().length > 0]).toEqual([true, true]);
    expect(Object.keys(slotAlternatives).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const [slotId, [altId, en, zh]] of Object.entries(EXPECTED)) {
      expect(slotById(slotId)).toBeDefined();
      expect(slotAlternatives[slotId]).toEqual([altId]);
      expect(alternativeExercises.find((alt) => alt.id === altId)?.name).toEqual({ en, zh });
    }
    // the 11 slots without an alternative, and 19 + 11 = all 30 slots
    for (const slotId of NO_ALTERNATIVE) expect([slotById(slotId) !== undefined, allowedExerciseIds(slotId).length]).toEqual([true, 1]);
    expect(Object.keys(EXPECTED).length + NO_ALTERNATIVE.length).toBe(programSlots.length);
  });

  it('alternative ids never clash with the program\'s own ids', () => {
    const programIds = new Set(programSlots.flatMap((slot) => [slot.id, getExerciseId(slot)]));
    for (const alt of alternativeExercises) expect(programIds.has(alt.id)).toBe(false);
  });

  it('allowed ids per slot: the default (shared on Day 5) first, then the alternative', () => {
    expect(allowedExerciseIds('leg-press-lower-b')).toEqual(['leg-press', 'hack-squat']);
    expect([isAllowedInSlot('leg-press', 'hack-squat'), isAllowedInSlot('leg-press', 'pec-deck'), isAllowedInSlot('rdl', 'hack-squat')]).toEqual([true, false, false]);
    expect([knownExerciseIds.has('leg-press'), knownExerciseIds.has('hack-squat'), knownExerciseIds.has('leg-press-lower-b')]).toEqual([true, true, false]);
  });
});

describe('the exercise done in a slot', () => {
  const enriched = getEnrichedWorkoutProgram(workoutProgram).flatMap((day) => day.exercises);
  const enrichedSlot = (id: string) => enriched.find((slot) => slot.id === id)!;

  it('by default nothing changes: the default exercise, unchanged', () => {
    const cycle = { id: 'w', startedAt: 't', slots: {} };
    expect([performedExerciseIdIn(cycle, 'leg-press'), performedExerciseIdIn(cycle, 'leg-press-lower-b')]).toEqual(['leg-press', 'leg-press']);
    const slot = enrichedSlot('incline-db-press');
    expect(performedExercise(slot, 'incline-db-press')).toEqual({ ...slot, performedExerciseId: 'incline-db-press', isAlternative: false });
    expect([performedExerciseName(slot, 'incline-db-press', 'en'), performedExerciseName(slot, 'incline-db-press', 'zh')]).toEqual(['Incline DB Press', '上斜哑铃卧推']);
  });

  it('an alternative: its own name, no video (not an error), no description; the slot\'s sets, reps and muscles', () => {
    const slot = enrichedSlot('leg-press-lower-b');
    const swapped = performedExercise(slot, 'hack-squat');
    expect([swapped.name, swapped.nameZh, swapped.coachingCue, swapped.videoFilename, swapped.media, swapped.isAlternative]).toEqual(['Hack Squat', '哈克深蹲', '', 'hack-squat', undefined, true]);
    expect([swapped.sets, swapped.reps, swapped.primaryMuscles, swapped.primaryMuscleGroupIds]).toEqual([slot.sets, slot.reps, slot.primaryMuscles, slot.primaryMuscleGroupIds]);
    expect([performedExerciseName(slot, 'hack-squat', 'en'), performedExerciseName(slot, 'hack-squat', 'zh')]).toEqual(['Hack Squat', '哈克深蹲']);
  });

  it('an id that is not allowed in the slot falls back to the default', () => {
    const slot = enrichedSlot('leg-press');
    expect(performedExercise(slot, 'pec-deck').performedExerciseId).toBe('leg-press');
    expect(performedExercise(slot, 'made-up').isAlternative).toBe(false);
  });

  it('video lookup: found for the program, missing (undefined) for alternatives and odd ids', () => {
    expect(findExerciseMedia('incline-db-press')?.id).toBe('incline-db-press');
    expect([findExerciseMedia('hack-squat'), findExerciseMedia('constructor'), findExerciseMedia('__proto__')]).toEqual([undefined, undefined, undefined]);
  });
});
