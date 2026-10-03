import { describe, expect, it } from 'vitest';
import { workoutProgram } from '../../data/workoutProgram';
import { AppDataV3, LoggedSet } from '../model';
import { completedIndexes, cycleProgress, isCycleComplete, previousBest, setDetails } from './selectors';

const set = (weight: string, reps: string, done: boolean, extra: Partial<LoggedSet> = {}): LoggedSet => ({
  weight,
  reps,
  unit: 'kg',
  done,
  ...extra,
});
const data = (slots: Record<string, Record<number, LoggedSet>>, bests: AppDataV3['bests'] = {}): AppDataV3 => ({
  schemaVersion: 3,
  currentCycle: {
    id: 'c1',
    startedAt: '2026-10-01T00:00:00.000Z',
    slots: Object.fromEntries(
      Object.entries(slots).map(([slotId, sets]) => [slotId, { slotId, exerciseId: slotId, performedExerciseId: slotId, sets }])
    ),
  },
  archivedCycles: [],
  bests,
  reportShownCycleIds: [],
});

describe('completedIndexes', () => {
  it('returns the ticked set indexes, sorted', () => {
    const d = data({ bench: { 2: set('', '', true), 0: set('60', '8', true), 1: set('62.5', '6', false) } });
    expect(completedIndexes(d, 'bench')).toEqual([0, 2]);
    expect(completedIndexes(d, 'unknown')).toEqual([]);
  });
});

describe('setDetails (v2 SetDetail shape)', () => {
  it('returns typed sets with setNumber and timestamp, done or not', () => {
    const d = data({ bench: { 0: set('60', '8', true, { updatedAt: 't0' }), 1: set('62.5', '', false, { updatedAt: 't1' }) } });
    expect(setDetails(d, 'bench')).toStrictEqual({
      0: { setNumber: 1, weight: '60', reps: '8', unit: 'kg', timestamp: 't0' },
      1: { setNumber: 2, weight: '62.5', reps: '', unit: 'kg', timestamp: 't1' },
    });
  });

  it('leaves out sets that were only ticked (no detail in v2 either), but keeps edited-then-cleared sets', () => {
    const d = data({ bench: { 0: set('', '', true), 1: set('', '', false, { updatedAt: 't1' }) } });
    expect(setDetails(d, 'bench')).toStrictEqual({ 1: { setNumber: 2, weight: '', reps: '', unit: 'kg', timestamp: 't1' } });
  });
});

describe('previousBest', () => {
  it('looks bests up by the shared exercise id, so both RDL slots see the same best', () => {
    const d = data({}, { rdl: { weight: '100', reps: '5', unit: 'kg' } });
    expect(previousBest(d, 'rdl')).toEqual({ weight: '100', reps: '5', unit: 'kg' });
    expect(previousBest(d, 'rdl-lower-b')).toEqual({ weight: '100', reps: '5', unit: 'kg' });
    expect(previousBest(d, 'lat-pulldown')).toBeUndefined();
  });
});

describe('cycleProgress / isCycleComplete', () => {
  const allDone = () => {
    const slots: Record<string, Record<number, LoggedSet>> = {};
    for (const day of workoutProgram) for (const ex of day.exercises) {
      const count = ex.sets.includes('–') ? Number(ex.sets.split('–')[1]) : Number(ex.sets);
      slots[ex.id] = Object.fromEntries(Array.from({ length: count }, (_, i) => [i, set('', '', true)]));
    }
    return data(slots);
  };

  it('counts per day like App.tsx (Day 1 has 18 sets)', () => {
    const d = data({ 'incline-db-press': { 0: set('', '', true), 1: set('', '', true) }, 'leg-press': { 0: set('', '', true) } });
    const p = cycleProgress(d, workoutProgram);
    expect(p.perDay['day-1']).toEqual({ completed: 2, total: 18 });
    expect(p.perDay['day-2'].completed).toBe(1);
    expect(p.completedSets).toBe(3);
    expect(p.completedDays).toBe(0);
    expect(isCycleComplete(d, workoutProgram)).toBe(false);
  });

  it('a fully ticked program is complete', () => {
    const p = cycleProgress(allDone(), workoutProgram);
    expect([p.completedSets === p.totalSets, p.completedDays]).toEqual([true, 5]);
    expect(isCycleComplete(allDone(), workoutProgram)).toBe(true);
  });

  it('copies today’s quirk: ticks beyond the set count still count, capped at the set count', () => {
    // incline-db-press has 3 sets; ticks 0, 1 and 5 count as 3 of 3 even though set 3 (index 2) is not ticked
    const d = data({ 'incline-db-press': { 0: set('', '', true), 1: set('', '', true), 5: set('', '', true) } });
    expect(completedIndexes(d, 'incline-db-press')).toEqual([0, 1, 5]);
    expect(cycleProgress(d, workoutProgram).perDay['day-1'].completed).toBe(3);
    // and more ticks than sets never count more than the set count
    const many = data({ 'incline-db-press': { 0: set('', '', true), 1: set('', '', true), 2: set('', '', true), 7: set('', '', true) } });
    expect(cycleProgress(many, workoutProgram).perDay['day-1'].completed).toBe(3);
  });
});
