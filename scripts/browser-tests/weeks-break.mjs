// Step 1D-3 break-the-code checks (real taps, headless Chrome).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, SCRATCH, sleep, FIXTURES, SHOTS } from './cdp.mjs';

const OUT = `${SHOTS}/1d3`;
mkdirSync(OUT, { recursive: true });
const V3 = 'aesthetic_recomp_v3';
const BACKUP = 'aesthetic_recomp_backup_aesthetic_recomp_v3_raw';
const V2_KEYS = ['language_preference', 'aesthetic_recomp_completed_sets_v2', 'aesthetic_recomp_set_details_v2', 'aesthetic_recomp_previous_bests_v2'];
const recorded = { ...JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8')), language_preference: 'en', aesthetic_recomp_unit_v1: 'kg' };
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)?.slice(0, 300)}, expected ${JSON.stringify(expected)?.slice(0, 300)})`}`);
};
const tap = async (p, elJs) => {
  await p.send('Page.bringToFront');
  const r = await p.evaluate(`(() => { const el = ${elJs}; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(400);
};
const shot = async (p, name) => { const { data } = await p.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64')); };
const btn = (root, text) => `[...${root}.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith(${JSON.stringify(text)}))`;
const TOP = `(() => { const ms = [...document.querySelectorAll('.fixed.inset-0')]; return ms[ms.length - 1]; })()`;
const v3 = (p) => p.evaluate(`JSON.parse(localStorage.getItem('${V3}'))`);
const tickN = (p, i) => tap(p, `document.querySelectorAll('[data-set-row] button[aria-pressed]')[${i}]`);
const openReport = (p) => tap(p, `document.querySelector('button[title="View Weekly Report Card"]')`);
const startNewWeek = async (p, text = 'Start new week') => {
  await openReport(p);
  await tap(p, btn(TOP, text));
  await tap(p, btn(`document.querySelector('[role="alertdialog"]')`, text));
};
const notice = (p) => p.evaluate(`document.querySelector('[data-tab-notice]')?.innerText.trim() ?? null`);
// A tab that misses "another tab saved" and "page shown again" while window.__blockSync is true
const STALE = `window.__blockSync = false;
  for (const [target, type] of [[window, 'storage'], [window, 'pageshow'], [document, 'visibilitychange']]) {
    target.addEventListener(type, (e) => { if (window.__blockSync) e.stopImmediatePropagation(); }, true);
  }`;

const chrome = await launchChrome(9405, 'profile-1d3-break');
const newTab = async (inject = STALE) => {
  const p = await chrome.newPage(360, 740);
  if (inject) await p.send('Page.addScriptToEvaluateOnNewDocument', { source: inject });
  await p.goto();
  return p;
};
try {
  // ---------- (a) damaged saved data with archived weeks ----------
  const set = (weight, reps, done = true) => ({ weight, reps, unit: 'kg', done });
  const slot = (id, sets) => ({ slotId: id, exerciseId: id, performedExerciseId: id, sets });
  const damaged = {
    schemaVersion: 3,
    currentCycle: { id: 'cur', startedAt: '2026-10-01T06:00:00.000Z', slots: { 'leg-press': slot('leg-press', { 0: set('100', '8') }) } },
    archivedCycles: [
      { id: 'w1', startedAt: '2026-09-14T06:00:00.000Z', endedAt: '2026-09-20T18:00:00.000Z', slots: { 'incline-db-press': slot('incline-db-press', { 0: set('60', '8') }) } },
      { startedAt: '2026-09-21T06:00:00.000Z', slots: {} }, // no id: dropped
      'garbage', // not a week: dropped
      { id: 'w4', startedAt: '2026-09-28T06:00:00.000Z', endedAt: 12345, slots: { 'incline-db-press': slot('incline-db-press', { 0: { weight: 62.5, reps: '6', unit: 'kg', done: true }, 1: set('62.5', '6') }) } },
      { id: 'w5', startedAt: 'not a date', endedAt: 'nope', slots: { 'lat-pulldown': slot('lat-pulldown', { 0: set('50', '10') }) } },
    ],
    bests: { 'incline-db-press': { weight: '62.5', reps: '6', unit: 'kg' } },
    reportShownCycleIds: ['w1'],
  };
  const damagedText = JSON.stringify(damaged);
  let a = await newTab(null);
  await a.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en'); localStorage.setItem('${V3}', ${JSON.stringify(damagedText)});`);
  await a.reload(3000);
  check('(a) damaged history loads; original text kept once in the backup key; v3 key untouched on load',
    [await a.evaluate(`localStorage.getItem('${BACKUP}') === ${JSON.stringify(damagedText)}`), await a.evaluate(`localStorage.getItem('${V3}') === ${JSON.stringify(damagedText)}`), a.errors], [true, true, []]);
  await tap(a, `document.querySelector('header button[title^="About"]')`);
  await tap(a, btn('document', 'Past weeks (3)'));
  const rows = await a.evaluate(`[...document.querySelectorAll('[data-history-row]')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim())`);
  console.log('(a) rows:', JSON.stringify(rows));
  check('(a) the 3 usable weeks are listed (2 unusable entries dropped; later weeks move up a number), bad dates say so',
    rows, ['Week 3 dates unknown 1 ticked set 500 kg', 'Week 2 dates unknown 1 ticked set 375 kg', `Week 1 ${new Date('2026-09-14T06:00:00.000Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date('2026-09-20T18:00:00.000Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} 1 ticked set 480 kg`]);
  for (const n of [1, 2, 3]) {
    await tap(a, `document.querySelector('[data-history-row="${n}"]')`);
    await tap(a, `${TOP}.querySelector('button.absolute')`);
  }
  await shot(a, 'break-damaged-history-360-en');
  await tap(a, btn(TOP, 'Close'));
  await startNewWeek(a);
  const afterDamaged = await v3(a);
  check('(a) every report opens without errors; a new week then saves the cleaned history + this week',
    [a.errors, afterDamaged.archivedCycles.map((c) => c.id), afterDamaged.archivedCycles[1].slots['incline-db-press'].sets],
    [[], ['w1', 'w4', 'w5', 'cur'], { 1: { weight: '62.5', reps: '6', unit: 'kg', done: true } }]);
  await chrome.closeTarget(a.targetId);

  // ---------- (b) + (c) a stale second tab ----------
  a = await newTab();
  await a.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(recorded)})) localStorage.setItem(k, v);`);
  await a.reload(3500);
  const v2Original = await a.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`);
  const b = await newTab();
  await sleep(500);
  const weekOneId = (await v3(a)).currentCycle.id;
  await b.evaluate(`window.__blockSync = true`); // from now on B misses all news
  await startNewWeek(a);
  await tickN(a, 3); // A trains in week 2
  await sleep(500);
  const aSaved = await a.evaluate(`localStorage.getItem('${V3}')`);
  check('(b) B still shows the old week (it missed the news)', await b.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed="true"]').length`), 3);
  await tickN(b, 5); // B ticks on the old week
  await sleep(700);
  const afterB = await v3(b);
  check('(b) B\'s save found A\'s newer data: nothing written over it, the week is still archived once',
    [await b.evaluate(`localStorage.getItem('${V3}')`) === aSaved, afterB.archivedCycles.map((c) => c.id)], [true, [weekOneId]]);
  check('(b) B now shows A\'s week 2 and says so', [await b.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed="true"]').length`), await notice(b)],
    [1, "Updated from another tab. Your last change here wasn't saved."]); // A's one tick in week 2
  await b.evaluate(`window.scrollTo(0, 0)`);
  await shot(b, 'break-notice-dropped-360-en');

  // (c) B is stale again, still showing week 2 with A's tick, and A starts week 3
  await b.evaluate(`document.querySelector('[data-tab-notice] button').click()`);
  await tickN(a, 0); await sleep(500); // a second tick in week 2 so B's copy is out of date
  const weekTwoId = (await v3(a)).currentCycle.id;
  await startNewWeek(a);
  const archivedBefore = (await v3(a)).archivedCycles.map((c) => c.id);
  await startNewWeek(b); // B: Start new week for week 2, already archived by A
  const afterC = await v3(b);
  check('(c) stale Start new week: no second copy of the week, nothing lost',
    [afterC.archivedCycles.map((c) => c.id), archivedBefore], [[weekOneId, weekTwoId], [weekOneId, weekTwoId]]);
  check('(c) B shows the new week and explains', [await b.evaluate(`document.querySelectorAll('.fixed.inset-0').length`), await notice(b)],
    [0, 'Updated from another tab: a new week was already started there.']);
  await shot(b, 'break-notice-weekstarted-360-en');

  // ---------- (d) both tabs confirm at the same moment ----------
  await b.evaluate(`window.__blockSync = false`);
  await b.reload(2500);
  await tickN(a, 1); await sleep(500);
  await b.reload(2500); // both show week 3 with one tick
  await b.evaluate(`window.__blockSync = true`);
  await a.evaluate(`window.__blockSync = true`);
  const weekThreeId = (await v3(a)).currentCycle.id;
  for (const t of [a, b]) {
    await openReport(t);
    await tap(t, btn(TOP, 'Start new week'));
  }
  const confirm = `${btn(`document.querySelector('[role="alertdialog"]')`, 'Start new week')}.click()`;
  await Promise.all([a.evaluate(confirm), b.evaluate(confirm)]);
  await sleep(800);
  const raced = await v3(a);
  const ids = raced.archivedCycles.map((c) => c.id);
  check('(d) same-moment race: week 3 archived exactly once, ids unique, its tick kept',
    [ids.filter((id) => id === weekThreeId).length, new Set(ids).size === ids.length, Object.keys(raced.archivedCycles[ids.indexOf(weekThreeId)].slots).length], [1, true, 1]);
  console.log('(d) archived ids:', ids.join(', '), '| current:', raced.currentCycle.id);
  for (const t of [a, b]) await t.evaluate(`window.__blockSync = false`);

  // ---------- (e) resets with history: this week only ----------
  await a.reload(2500);
  await tickN(a, 0); await tickN(a, 1); await sleep(500);
  const beforeReset = await v3(a);
  const reset = async (which) => {
    await tap(a, `document.querySelector('button[title="Clear or Reset Workout Progress"]')`);
    await tap(a, `[...document.querySelector('[aria-labelledby="reset-modal-title"]').querySelectorAll('button')][${which === 'day' ? 1 : 2}]`);
    await sleep(500);
  };
  await reset('day');
  const afterDay = await v3(a);
  await tickN(a, 0); await sleep(400);
  await reset('all');
  const afterAll = await v3(a);
  check('(e) reset day / reset all: history and bests unchanged, this week cleared',
    [JSON.stringify(afterDay.archivedCycles) === JSON.stringify(beforeReset.archivedCycles), JSON.stringify(afterAll.archivedCycles) === JSON.stringify(beforeReset.archivedCycles),
      JSON.stringify(afterAll.bests) === JSON.stringify(beforeReset.bests), Object.keys(afterAll.currentCycle.slots).length], [true, true, true, 0]);
  check('v2 keys byte-for-byte unchanged through (b)-(e)', await a.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`), v2Original);
  check('no page errors (b)-(e)', [a.errors, b.errors], [[], []]);
  await chrome.closeTarget(a.targetId);
  await chrome.closeTarget(b.targetId);

  // ---------- (f) error mode ----------
  const FAIL_ONCE = `const realToISO = Date.prototype.toISOString; Date.prototype.toISOString = function () { if (!window.__failedOnce && this.getTime() !== 0) { window.__failedOnce = true; throw new RangeError('injected for the test'); } return realToISO.call(this); };`;
  const e = await newTab(null);
  await e.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(recorded)})) localStorage.setItem(k, v);`);
  await e.send('Page.addScriptToEvaluateOnNewDocument', { source: FAIL_ONCE });
  await e.reload(3500);
  await tickN(e, 3);
  await openReport(e);
  check('(f) error mode: Start new week disabled with the saving-off reason',
    [await e.evaluate(`${btn(TOP, 'Start new week')}.disabled`), await e.evaluate(`document.getElementById('start-new-week-reason')?.innerText`)],
    [true, "Saving is off right now (your saved workouts couldn't be read), so a new week can't be started."]);
  await tap(e, `${TOP}.querySelector('button.absolute')`);
  await tap(e, `document.querySelector('header button[title^="About"]')`);
  await tap(e, btn('document', 'Past weeks'));
  check('(f) error mode: history says it cannot be read', await e.evaluate(`document.querySelector('[aria-labelledby="history-title"]').innerText.includes("couldn't be read")`), true);
  check('(f) error mode: nothing saved', await e.evaluate(`localStorage.getItem('${V3}')`), null);
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
