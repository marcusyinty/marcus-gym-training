import { describe, expect, it } from 'vitest';
import { lastTimeFor } from './lastTime';
import { AppDataV3, Cycle, LoggedSet, LoggedSlot } from './model';
import { formatShortDay } from './weeks';

const set = (weight: string, reps: string, extra: Partial<LoggedSet> = {}): LoggedSet => ({ weight, reps, unit: 'kg', done: true, ...extra });
const slot = (slotId: string, sets: Record<number, LoggedSet>, performedExerciseId?: string, exerciseId = slotId): LoggedSlot => ({
  slotId,
  exerciseId,
  performedExerciseId: performedExerciseId ?? exerciseId,
  sets,
});
const week = (id: string, startedAt: string, slots: LoggedSlot[]): Cycle => ({
  id,
  startedAt,
  endedAt: startedAt,
  slots: Object.fromEntries(slots.map((s) => [s.slotId, s])),
});
const data = (archivedCycles: Cycle[], current: LoggedSlot[] = []): AppDataV3 => ({
  schemaVersion: 3,
  currentCycle: week('now', '2026-10-05T06:00:00.000Z', current),
  archivedCycles,
  bests: {},
  reportShownCycleIds: [],
});

describe('last time', () => {
  it('first week (no past weeks), or the exercise was never done: nothing', () => {
    expect(lastTimeFor(data([]), 'incline-db-press', 'kg')).toBeNull();
    expect(lastTimeFor(data([week('w1', '2026-09-28T06:00:00.000Z', [slot('lat-pulldown', { 0: set('50', '10') })])]), 'incline-db-press', 'kg')).toBeNull();
  });

  it('the newest past week with a ticked set; a week without one is skipped (and so is a week with only typed values)', () => {
    const w1 = week('w1', '2026-09-14T06:00:00.000Z', [slot('incline-db-press', { 0: set('55', '10', { tag: 'easy' }) })]);
    const w2 = week('w2', '2026-09-21T06:00:00.000Z', [slot('incline-db-press', { 0: set('60', '8', { done: false }) })]); // typed, not ticked
    const w3 = week('w3', '2026-09-28T06:00:00.000Z', [slot('lat-pulldown', { 0: set('50', '10') })]); // skipped this exercise
    const found = lastTimeFor(data([w1, w2, w3]), 'incline-db-press', 'kg');
    expect(found).toEqual({ cycleId: 'w1', slotId: 'incline-db-press', date: '2026-09-14T06:00:00.000Z', sets: { 0: { weight: '55', reps: '10', tag: 'easy' } } });
  });

  it('only ticked sets, with their tags; set 4 shows nothing when last time had 3', () => {
    const w1 = week('w1', '2026-09-28T06:00:00.000Z', [
      slot('btb-lateral-raise', { 0: set('10', '15'), 1: set('10', '12', { tag: 'good' }), 2: set('12', '9', { tag: 'max' }), 3: set('12', '8', { done: false }) }),
    ]);
    const found = lastTimeFor(data([w1]), 'btb-lateral-raise', 'kg')!;
    expect(found.sets).toEqual({ 0: { weight: '10', reps: '15' }, 1: { weight: '10', reps: '12', tag: 'good' }, 2: { weight: '12', reps: '9', tag: 'max' } });
    expect(found.sets[3]).toBeUndefined();
  });

  it('weights in the current unit, converted like the report (same unit: exactly as typed)', () => {
    const w1 = week('w1', '2026-09-28T06:00:00.000Z', [
      slot('incline-db-press', { 0: set('60', '8'), 1: set('135', '10', { unit: 'lbs' }), 2: set('62.50', '6'), 3: set('', '12'), 4: set('', '') }),
    ]);
    expect(lastTimeFor(data([w1]), 'incline-db-press', 'lbs')!.sets).toEqual({
      0: { weight: '132.3', reps: '8' },
      1: { weight: '135', reps: '10' },
      2: { weight: '137.8', reps: '6' },
      3: { weight: '', reps: '12' },
      4: { weight: '', reps: '' },
    });
    expect(lastTimeFor(data([w1]), 'incline-db-press', 'kg')!.sets).toMatchObject({ 0: { weight: '60' }, 1: { weight: '61.2' }, 2: { weight: '62.50' } });
  });

  it('a swapped-in alternative only sees its own history, and the default only its own', () => {
    const w1 = week('w1', '2026-09-21T06:00:00.000Z', [slot('leg-press', { 0: set('150', '10') })]);
    const w2 = week('w2', '2026-09-28T06:00:00.000Z', [slot('leg-press', { 0: set('100', '8', { tag: 'max' }) }, 'hack-squat')]);
    // This week Day 2 does Hack Squat: the hack squat week (w2)
    expect(lastTimeFor(data([w1, w2], [slot('leg-press', {}, 'hack-squat')]), 'leg-press', 'kg')).toMatchObject({ cycleId: 'w2', sets: { 0: { weight: '100', tag: 'max' } } });
    // This week Day 2 does Leg Press: the older leg press week (w1), not last week's hack squat
    expect(lastTimeFor(data([w1, w2]), 'leg-press', 'kg')).toMatchObject({ cycleId: 'w1', sets: { 0: { weight: '150' } } });
    // An alternative never done before: nothing
    expect(lastTimeFor(data([w1], [slot('leg-press', {}, 'hack-squat')]), 'leg-press', 'kg')).toBeNull();
  });

  it('Leg Press on Day 2 and Day 5: the same slot that week first, otherwise the other slot', () => {
    const both = week('w1', '2026-09-28T06:00:00.000Z', [
      slot('leg-press', { 0: set('150', '10') }),
      slot('leg-press-lower-b', { 0: set('140', '12') }, undefined, 'leg-press'),
    ]);
    expect(lastTimeFor(data([both]), 'leg-press-lower-b', 'kg')).toMatchObject({ slotId: 'leg-press-lower-b', sets: { 0: { weight: '140' } } });
    expect(lastTimeFor(data([both]), 'leg-press', 'kg')).toMatchObject({ slotId: 'leg-press', sets: { 0: { weight: '150' } } });
    const onlyDay2 = week('w2', '2026-10-01T06:00:00.000Z', [slot('leg-press', { 0: set('155', '9') }), slot('leg-press-lower-b', { 0: set('150', '8', { done: false }) }, undefined, 'leg-press')]);
    expect(lastTimeFor(data([both, onlyDay2]), 'leg-press-lower-b', 'kg')).toMatchObject({ cycleId: 'w2', slotId: 'leg-press', sets: { 0: { weight: '155' } } });
  });

  it("the date: when those sets were last saved, else the week's start", () => {
    const w1 = week('w1', '2026-09-28T06:00:00.000Z', [
      slot('incline-db-press', { 0: set('60', '8', { updatedAt: '2026-09-30T18:00:00.000Z' }), 1: set('60', '7', { updatedAt: '2026-09-30T18:05:00.000Z' }), 2: set('60', '6', { done: false, updatedAt: '2026-10-02T09:00:00.000Z' }) }),
      slot('lat-pulldown', { 0: set('', '', { updatedAt: 'not a date' }) }),
    ]);
    expect(lastTimeFor(data([w1]), 'incline-db-press', 'kg')!.date).toBe('2026-09-30T18:05:00.000Z'); // the unticked set's later save doesn't count
    expect(lastTimeFor(data([w1]), 'lat-pulldown', 'kg')!.date).toBe('2026-09-28T06:00:00.000Z');
  });

  it('short dates for the card: no year, EN and 中文', () => {
    expect([formatShortDay('2026-09-28T12:00:00.000Z', 'en'), formatShortDay('2026-09-28T12:00:00.000Z', 'zh'), formatShortDay('bad', 'en')]).toEqual([
      expect.stringMatching(/^28 Sept?$/),
      '9月28日',
      null,
    ]);
  });
});
