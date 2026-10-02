import { describe, expect, it } from 'vitest';
import { workoutProgram } from '../data/workoutProgram';
import { exerciseIdForSlotId, getExerciseId, isProgramSlot } from './exerciseIds';

describe('getExerciseId', () => {
  it('uses exerciseId when set, otherwise the slot id', () => {
    expect(getExerciseId({ id: 'rdl-lower-b', exerciseId: 'rdl' })).toBe('rdl');
    expect(getExerciseId({ id: 'lat-pulldown' })).toBe('lat-pulldown');
  });
});

describe('exerciseIdForSlotId', () => {
  it('maps both slots of each duplicate exercise to one shared id', () => {
    expect([exerciseIdForSlotId('rdl'), exerciseIdForSlotId('rdl-lower-b')]).toEqual(['rdl', 'rdl']);
    expect([exerciseIdForSlotId('leg-press'), exerciseIdForSlotId('leg-press-lower-b')]).toEqual(['leg-press', 'leg-press']);
    expect([exerciseIdForSlotId('seated-leg-curl'), exerciseIdForSlotId('seated-leg-curl-lower-b')]).toEqual([
      'seated-leg-curl',
      'seated-leg-curl',
    ]);
    expect([exerciseIdForSlotId('reverse-crunch-abs-a'), exerciseIdForSlotId('reverse-crunch-abs-b')]).toEqual([
      'reverse-crunch',
      'reverse-crunch',
    ]);
  });

  it('only the 5 duplicate slots have a different exercise id; all others keep their slot id', () => {
    const slots = workoutProgram.flatMap((day) => day.exercises);
    const renamed = slots.filter((slot) => getExerciseId(slot) !== slot.id).map((slot) => slot.id);
    expect(renamed).toEqual(['reverse-crunch-abs-a', 'reverse-crunch-abs-b', 'rdl-lower-b', 'seated-leg-curl-lower-b', 'leg-press-lower-b']);
    // Slots that share an exercise also share its video
    for (const slot of slots.filter((s) => s.exerciseId)) {
      const sameExercise = slots.filter((s) => getExerciseId(s) === slot.exerciseId);
      expect(new Set(sameExercise.map((s) => s.videoFilename)).size).toBe(1);
    }
  });

  it('returns unknown slot ids unchanged', () => {
    expect(isProgramSlot('old-removed-exercise')).toBe(false);
    expect(exerciseIdForSlotId('old-removed-exercise')).toBe('old-removed-exercise');
    expect(exerciseIdForSlotId('__proto__')).toBe('__proto__');
  });
});
