import { describe, expect, it } from 'vitest';
import { migrateV2ToV3, V2Data, MigrationContext } from './migrateV2';

const NOW = '2026-10-03T08:00:00.000Z';
const ctx = (): MigrationContext => ({ now: new Date(NOW), makeId: () => 'cycle-1' });
const v2 = (data: Partial<Record<keyof V2Data, unknown>>): V2Data =>
  ({ completedSets: {}, setDetails: {}, bests: {}, ...data }) as V2Data;

// Exact text saved by the current app in an earlier step (recorded from a real session)
const RECORDED: V2Data = {
  completedSets: JSON.parse('{"incline-db-press":[0,1],"lat-pulldown":[0],"leg-press":[0]}'),
  setDetails: JSON.parse(
    '{"incline-db-press":{"0":{"setNumber":1,"weight":"60","reps":"8","unit":"kg","completed":true,"timestamp":"2026-10-02T15:09:36.888Z"},"1":{"setNumber":2,"weight":"62.5","reps":"6","unit":"kg","completed":true,"timestamp":"2026-10-02T15:09:37.185Z"}},"lat-pulldown":{"0":{"setNumber":1,"weight":"135","reps":"10","unit":"lbs","completed":true,"timestamp":"2026-10-02T15:09:37.494Z"}},"leg-press":{"0":{"setNumber":1,"weight":"100","reps":"5","unit":"kg","completed":true,"timestamp":"2026-10-02T15:09:38.255Z"}}}'
  ),
  bests: JSON.parse(
    '{"incline-db-press":{"weight":"62.5","reps":"6","unit":"kg"},"lat-pulldown":{"weight":"135","reps":"10","unit":"lbs"},"leg-press":{"weight":"100","reps":"5","unit":"kg"}}'
  ),
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

describe('migrateV2ToV3', () => {
  it('empty input gives one empty current cycle', () => {
    expect(migrateV2ToV3(v2({}), ctx())).toStrictEqual({
      schemaVersion: 3,
      currentCycle: { id: 'cycle-1', startedAt: NOW, slots: {} },
      archivedCycles: [],
      bests: {},
      reportShownCycleIds: [],
    });
  });

  it('normal case: the data recorded from the current app', () => {
    const out = migrateV2ToV3(RECORDED, ctx());
    expect(Object.keys(out.currentCycle.slots)).toEqual(['incline-db-press', 'lat-pulldown', 'leg-press']);
    expect(out.currentCycle.slots['incline-db-press']).toStrictEqual({
      slotId: 'incline-db-press',
      exerciseId: 'incline-db-press',
      performedExerciseId: 'incline-db-press',
      sets: {
        0: { weight: '60', reps: '8', unit: 'kg', done: true, updatedAt: '2026-10-02T15:09:36.888Z' },
        1: { weight: '62.5', reps: '6', unit: 'kg', done: true, updatedAt: '2026-10-02T15:09:37.185Z' },
      },
    });
    expect(out.bests).toStrictEqual({
      'incline-db-press': { weight: '62.5', reps: '6', unit: 'kg' },
      'lat-pulldown': { weight: '135', reps: '10', unit: 'lbs' },
      'leg-press': { weight: '100', reps: '5', unit: 'kg' },
    });
    expect(out.archivedCycles).toEqual([]);
    expect(out.reportShownCycleIds).toEqual([]);
    expect('endedAt' in out.currentCycle).toBe(false);
  });

  it('keeps an lbs set in lbs, with its text exactly as typed', () => {
    const out = migrateV2ToV3(RECORDED, ctx());
    expect(out.currentCycle.slots['lat-pulldown'].sets[0]).toStrictEqual({
      weight: '135',
      reps: '10',
      unit: 'lbs',
      done: true,
      updatedAt: '2026-10-02T15:09:37.494Z',
    });
  });

  it('a ticked set without details becomes an empty done set in kg', () => {
    const out = migrateV2ToV3(v2({ completedSets: { 'lat-pulldown': [2] } }), ctx());
    expect(out.currentCycle.slots['lat-pulldown'].sets).toStrictEqual({ 2: { weight: '', reps: '', unit: 'kg', done: true } });
  });

  it('a detail that is not ticked becomes done: false, and the old "completed" field is ignored', () => {
    const out = migrateV2ToV3(
      v2({
        completedSets: { 'lat-pulldown': [] },
        setDetails: { 'lat-pulldown': { 0: { setNumber: 1, weight: '50', reps: '12', unit: 'kg', completed: true } } },
      }),
      ctx()
    );
    expect(out.currentCycle.slots['lat-pulldown'].sets).toStrictEqual({ 0: { weight: '50', reps: '12', unit: 'kg', done: false } });
  });

  it('keeps unknown slot ids, using the slot id as the exercise id', () => {
    const out = migrateV2ToV3(
      v2({
        completedSets: { 'old-removed-exercise': [0] },
        setDetails: { 'old-removed-exercise': { 0: { setNumber: 1, weight: '20', reps: '15', unit: 'kg' } } },
        bests: { 'old-removed-exercise': { weight: '20', reps: '15', unit: 'kg' } },
      }),
      ctx()
    );
    expect(out.currentCycle.slots['old-removed-exercise']).toMatchObject({ exerciseId: 'old-removed-exercise', performedExerciseId: 'old-removed-exercise' });
    expect(out.bests['old-removed-exercise']).toEqual({ weight: '20', reps: '15', unit: 'kg' });
  });

  it('slots of the same exercise stay separate, but share one exercise id', () => {
    const out = migrateV2ToV3(v2({ completedSets: { 'reverse-crunch-abs-a': [0], 'reverse-crunch-abs-b': [1] } }), ctx());
    expect(Object.keys(out.currentCycle.slots)).toEqual(['reverse-crunch-abs-a', 'reverse-crunch-abs-b']);
    expect(out.currentCycle.slots['reverse-crunch-abs-a'].exerciseId).toBe('reverse-crunch');
    expect(out.currentCycle.slots['reverse-crunch-abs-b'].exerciseId).toBe('reverse-crunch');
  });

  it('merges bests of duplicate exercises: the stronger one wins, compared in kg', () => {
    const out = migrateV2ToV3(
      v2({
        bests: {
          // lbs stronger: 225 lbs x 5 = 102.1 kg beats 100 kg x 5
          rdl: { weight: '100', reps: '5', unit: 'kg' },
          'rdl-lower-b': { weight: '225', reps: '5', unit: 'lbs' },
          // kg stronger although the lbs number is bigger: 300 lbs x 8 = 136.1 kg < 150 kg x 8
          'leg-press-lower-b': { weight: '300', reps: '8', unit: 'lbs' },
          'leg-press': { weight: '150', reps: '8', unit: 'kg' },
          // heavier but fewer reps loses: 60 x 12 (84.0) beats 70 x 5 (81.7)
          'seated-leg-curl': { weight: '70', reps: '5', unit: 'kg' },
          'seated-leg-curl-lower-b': { weight: '60', reps: '12', unit: 'kg' },
          // tie (both exactly 80.0): the one saved first is kept
          'reverse-crunch-abs-a': { weight: '60', reps: '10', unit: 'kg' },
          'reverse-crunch-abs-b': { weight: '75', reps: '2', unit: 'kg' },
        },
      }),
      ctx()
    );
    expect(out.bests).toStrictEqual({
      rdl: { weight: '225', reps: '5', unit: 'lbs' },
      'leg-press': { weight: '150', reps: '8', unit: 'kg' },
      'seated-leg-curl': { weight: '60', reps: '12', unit: 'kg' },
      'reverse-crunch': { weight: '60', reps: '10', unit: 'kg' },
    });
  });

  it('skips malformed entries one at a time without throwing', () => {
    const out = migrateV2ToV3(
      v2({
        completedSets: { a: [0, 'x', -1, 1.5, 2, null], b: 'oops', c: null },
        setDetails: {
          a: {
            0: { setNumber: 1, weight: '60', reps: '8', unit: 'stone' }, // unknown unit -> kg
            1: { weight: 60, reps: '8', unit: 'kg' }, // weight not text -> skipped
            x: { weight: '1', reps: '1', unit: 'kg' }, // not a set number -> skipped
            '01': { weight: '1', reps: '1', unit: 'kg' }, // not a set number -> skipped
            3: null, // not an object -> skipped
            4: { weight: '40', reps: '5', unit: 'lbs', timestamp: 123 }, // bad timestamp -> no updatedAt
          },
          d: 'nope',
          e: [1, 2],
        },
        bests: {
          a: { weight: '60', reps: '8', unit: 'stone' }, // unknown unit -> skipped (not guessed)
          b: null,
          c: { weight: 50, reps: '5', unit: 'kg' },
          f: { weight: '50', reps: '5', unit: 'kg' },
        },
      }),
      ctx()
    );
    expect(Object.keys(out.currentCycle.slots)).toEqual(['a']);
    expect(out.currentCycle.slots.a.sets).toStrictEqual({
      0: { weight: '60', reps: '8', unit: 'kg', done: true },
      2: { weight: '', reps: '', unit: 'kg', done: true },
      4: { weight: '40', reps: '5', unit: 'lbs', done: false },
    });
    expect(out.bests).toStrictEqual({ f: { weight: '50', reps: '5', unit: 'kg' } });
  });

  it('never throws on completely wrong input shapes', () => {
    for (const bad of [null, undefined, 'text', 42, [], { completedSets: null, setDetails: [], bests: 'x' }]) {
      const out = migrateV2ToV3(bad as unknown as V2Data, ctx());
      expect(out.currentCycle.slots).toEqual({});
      expect(out.bests).toEqual({});
    }
  });

  it('keeps odd slot ids like "__proto__" as normal keys without touching object prototypes', () => {
    const out = migrateV2ToV3(v2({ completedSets: JSON.parse('{"__proto__":[0]}') }), ctx());
    expect(Object.keys(out.currentCycle.slots)).toEqual(['__proto__']);
    expect(Object.getPrototypeOf(out.currentCycle.slots)).toBe(Object.prototype);
  });

  it('does not change the input, and the output shares no objects with it', () => {
    const input = deepFreeze(structuredClone(RECORDED));
    const before = JSON.stringify(input);
    const out = migrateV2ToV3(input, ctx()); // frozen input: any write would throw here
    expect(JSON.stringify(input)).toBe(before);
    out.currentCycle.slots['incline-db-press'].sets[0].weight = '999';
    out.bests['lat-pulldown'].weight = '999';
    expect(JSON.stringify(input)).toBe(before);
  });

  it('same input and same ctx always give the same output', () => {
    const a = migrateV2ToV3(RECORDED, ctx());
    const b = migrateV2ToV3(structuredClone(RECORDED), ctx());
    expect(b).toStrictEqual(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});
