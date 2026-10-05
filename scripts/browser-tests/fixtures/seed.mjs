// Step 4 test data: v3 saved data with past weeks that have tags.
export const set = (weight, reps, extra = {}) => ({ weight, reps, unit: 'kg', done: true, ...extra });
export const slot = (slotId, sets, performedExerciseId, exerciseId = slotId) => ({ slotId, exerciseId, performedExerciseId: performedExerciseId ?? exerciseId, sets });
export const week = (id, startedAt, endedAt, slots) => ({ id, startedAt, endedAt, slots: Object.fromEntries(slots.map((s) => [s.slotId, s])) });

const at = (day, time = '17:30') => `2026-09-${day}T${time}:00.000Z`;

// Week 1 (14 Sept): incline done (with tags); Week 2 (21 Sept): incline skipped; Week 3 (28 Sept): no incline either,
// but lat pulldown, leg press on Day 2 only, and hack squat swapped in on Day 5
export const historyData = () => ({
  schemaVersion: 3,
  currentCycle: { id: 'week-4', startedAt: '2026-10-05T06:00:00.000Z', slots: {} },
  archivedCycles: [
    week('week-1', at('14', '06:00'), at('20', '20:00'), [
      slot('incline-db-press', {
        0: set('60', '12', { tag: 'easy', updatedAt: at('14') }),
        1: set('62.5', '10', { tag: 'good', updatedAt: at('14') }),
        2: set('65', '8', { tag: 'max', updatedAt: at('14', '17:40') }),
      }),
      slot('btb-lateral-raise', { 0: set('10', '15', { updatedAt: at('16') }), 1: set('10', '12', { updatedAt: at('16') }), 2: set('12', '9', { tag: 'max', updatedAt: at('16') }) }),
    ]),
    week('week-2', at('21', '06:00'), at('27', '20:00'), [
      slot('lat-pulldown', { 0: set('55', '10', { updatedAt: at('22') }) }),
    ]),
    week('week-3', at('28', '06:00'), '2026-10-04T20:00:00.000Z', [
      slot('lat-pulldown', { 0: set('57.5', '10', { tag: 'good', updatedAt: at('28') }), 1: set('57.5', '9', { tag: 'max', updatedAt: at('28') }), 2: set('55', '8', { done: false, updatedAt: at('28') }) }),
      slot('leg-press', { 0: set('150', '10', { updatedAt: at('29') }), 1: set('150', '9', { tag: 'max', updatedAt: at('29') }), 2: set('', '12', { updatedAt: at('29') }) }),
      slot('leg-press-lower-b', { 0: set('120', '10', { updatedAt: '2026-10-02T17:00:00.000Z' }) }, 'hack-squat', 'leg-press'),
      slot('seated-cable-row', { 0: set('', ''), 1: set('', '') }),
    ]),
  ],
  bests: {},
  reportShownCycleIds: ['week-1', 'week-2', 'week-3'],
});
