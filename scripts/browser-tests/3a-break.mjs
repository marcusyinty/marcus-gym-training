// Step 3A break-it + rollback checks (real browser). 3000 = this branch, 3001 = released v1.2.0 (main 1c19df1).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, SCRATCH, sleep, FIXTURES, SHOTS, APP } from './cdp.mjs';

const BRANCH = APP;
const V120 = process.env.V120_URL ?? 'http://localhost:3001/';
const OUT = `${SHOTS}/3a`;
mkdirSync(OUT, { recursive: true });
const V3 = 'aesthetic_recomp_v3';
const BACKUP = 'aesthetic_recomp_backup_aesthetic_recomp_v3_raw';
const V2 = JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8'));
const V2_KEYS = ['aesthetic_recomp_completed_sets_v2', 'aesthetic_recomp_set_details_v2', 'aesthetic_recomp_previous_bests_v2'];
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
const set = (weight, reps, done = true) => ({ weight, reps, unit: 'kg', done });
const slot = (slotId, exerciseId, performedExerciseId, sets) => ({ slotId, exerciseId, performedExerciseId, sets });
const seed = (p, v3) => p.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify({ ...V2, language_preference: 'en', aesthetic_recomp_unit_v1: 'kg', [V3]: JSON.stringify(v3) })})) localStorage.setItem(k, v);`);
const v3Of = (p) => p.evaluate(`JSON.parse(localStorage.getItem('${V3}'))`);
const day = async (p, i) => { await p.evaluate(`document.querySelectorAll('nav button')[${i}].click()`); await sleep(350); };
// Rows of the open weekly report: "name | best set"
const reportRows = (p) => p.evaluate(`(() => { const ms = [...document.querySelectorAll('.fixed.inset-0')]; const m = ms[ms.length - 1]; return [...m.querySelectorAll('.grid.grid-cols-1 > div')].map((r) => [...r.children].map((c) => c.innerText.trim()).join(' | ')); })()`);
const openReport = (p) => tap(p, `document.querySelector('button[title="View Weekly Report Card"]')`);
const closeTop = (p) => p.evaluate(`(() => { const ms = [...document.querySelectorAll('.fixed.inset-0')]; ms[ms.length - 1].querySelector('button.absolute').click(); })()`).then(() => sleep(300));
const STALE = `window.__blockSync = false;
  for (const [target, type] of [[window, 'storage'], [window, 'pageshow'], [document, 'visibilitychange']]) {
    target.addEventListener(type, (e) => { if (window.__blockSync) e.stopImmediatePropagation(); }, true);
  }`;

const chrome = await launchChrome(9420, 'profile-3a-break');
try {
  // ---------- (a) broken swap ids and remark values in saved data ----------
  const broken = {
    schemaVersion: 3,
    currentCycle: { id: 'cur', startedAt: '2026-10-04T06:00:00.000Z', slots: {
      'leg-press': slot('leg-press', 'leg-press', 'pec-deck', { 0: set('150', '10') }), // an alternative of another slot
      'incline-db-press': slot('incline-db-press', 'incline-db-press', 42, { 0: set('60', '8') }), // not text
      'lat-pulldown': slot('lat-pulldown', 'lat-pulldown', 'constructor', { 0: set('50', '10') }), // odd id
      'flat-db-press': slot('flat-db-press', 'flat-db-press', 'machine-chest-press', { 0: set('80', '8') }), // allowed swap
    } },
    archivedCycles: [{ id: 'old', startedAt: '2026-09-27T06:00:00.000Z', endedAt: '2026-10-03T18:00:00.000Z', slots: {
      'leg-press': slot('leg-press', 'leg-press', 'made-up', { 0: set('140', '10') }),
    } }],
    bests: { 'leg-press': { weight: '150', reps: '10', unit: 'kg' } },
    reportShownCycleIds: [],
    remarks: { 'leg-press': 'seat 4', 'made-up': 'x', rdl: 42, 'pec-deck': 'p'.repeat(300) },
  };
  const brokenText = JSON.stringify(broken);
  let p = await chrome.newPage(360, 740);
  await p.goto(BRANCH);
  await seed(p, broken);
  const v2Before = await p.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`);
  await p.reload(3500);
  check('(a) loads without errors; v3 text untouched on load; original kept in the backup key',
    [p.errors, await p.evaluate(`localStorage.getItem('${V3}') === ${JSON.stringify(brokenText)}`), await p.evaluate(`localStorage.getItem('${BACKUP}') === ${JSON.stringify(brokenText)}`)], [[], true, true]);
  check('(a) every logged set still shows on the main screen (Day 1: incline + lat ticked)',
    await p.evaluate(`[...document.querySelectorAll('[data-set-row] button[aria-pressed="true"]')].length`), 2);
  await openReport(p);
  const rows = await reportRows(p);
  console.log('(a) report rows:', JSON.stringify(rows.filter((r) => !r.endsWith('—'))));
  check('(a) report: broken ids show the default exercise with its sets; the allowed swap shows its own name',
    rows.filter((r) => !r.endsWith('—')), ['Incline DB Press | 60 kg × 8', 'Lat Pulldown | 50 kg × 10', 'Leg Press | 150 kg × 10', 'Machine Chest Press | 80 kg × 8']);
  await closeTop(p);
  await tap(p, `document.querySelector('header button[title^="About"]')`);
  await tap(p, `[...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith('Past weeks'))`);
  await tap(p, `document.querySelector('[data-history-row="1"]')`);
  check('(a) past week: the broken id shows the default with its set', (await reportRows(p)).filter((r) => !r.endsWith('—')), ['Leg Press | 140 kg × 10']);
  await closeTop(p); await closeTop(p);
  await day(p, 4);
  await tap(p, `document.querySelectorAll('[data-set-row] button[aria-pressed]')[0]`); // a normal change, saved 300ms later
  await sleep(700);
  const cleaned = await v3Of(p);
  check('(a) the next save writes the cleaned data: defaults back, swap kept, all sets kept, good remarks kept (cut to 200)',
    [Object.fromEntries(Object.entries(cleaned.currentCycle.slots).filter(([k]) => k !== 'rdl-lower-b').map(([k, s]) => [k, [s.performedExerciseId, s.sets[0].weight]])), cleaned.archivedCycles[0].slots['leg-press'].performedExerciseId, cleaned.remarks],
    [{ 'leg-press': ['leg-press', '150'], 'incline-db-press': ['incline-db-press', '60'], 'lat-pulldown': ['lat-pulldown', '50'], 'flat-db-press': ['machine-chest-press', '80'] }, 'leg-press', { 'leg-press': 'seat 4', 'pec-deck': 'p'.repeat(200) }]);
  check('(a) v2 keys byte-for-byte unchanged', await p.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`), v2Before);
  check('(a) no page errors', p.errors, []);
  await chrome.closeTarget(p.targetId);

  // ---------- (b) a stale tab while another tab saves a swap and a remark ----------
  const fresh = { schemaVersion: 3, currentCycle: { id: 'w1', startedAt: '2026-10-05T06:00:00.000Z', slots: {} }, archivedCycles: [], bests: {}, reportShownCycleIds: [] };
  const b = await chrome.newPage(360, 740);
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: STALE });
  await b.goto(BRANCH);
  await seed(b, fresh);
  await b.reload(3000);
  await b.evaluate(`window.__blockSync = true`); // B misses all news from now on
  const a = await chrome.newPage(360, 740);
  await a.goto(BRANCH);
  // what another tab's swap + remark save looks like (written as that tab would)
  const otherTab = { ...fresh, currentCycle: { ...fresh.currentCycle, slots: { 'leg-press': slot('leg-press', 'leg-press', 'hack-squat', {}) } }, remarks: { 'hack-squat': 'shoulder pads 2' } };
  await a.evaluate(`localStorage.setItem('${V3}', ${JSON.stringify(JSON.stringify(otherTab))})`);
  await chrome.closeTarget(a.targetId);
  await day(b, 0);
  await tap(b, `document.querySelectorAll('[data-set-row] button[aria-pressed]')[0]`); // B ticks on its old data
  await sleep(700);
  const afterStale = await v3Of(b);
  check('(b) the stale tab kept the other tab\'s swap and remark (its own tick was not written over them)',
    [afterStale.currentCycle.slots['leg-press']?.performedExerciseId, afterStale.remarks, Object.keys(afterStale.currentCycle.slots)], ['hack-squat', { 'hack-squat': 'shoulder pads 2' }, ['leg-press']]);
  check('(b) and says so', await b.evaluate(`document.querySelector('[data-tab-notice]')?.innerText.trim()`), "Updated from another tab. Your last change here wasn't saved.");
  await b.evaluate(`document.querySelector('[data-tab-notice] button').click()`);
  await day(b, 1);
  await tap(b, `document.querySelectorAll('[data-set-row] button[aria-pressed]')[0]`); // first Day 2 set = the swapped slot
  await sleep(700);
  await openReport(b);
  check('(b) a tick in that slot now counts for Hack Squat (report row + saved slot)',
    [(await reportRows(b)).filter((r) => !r.endsWith('—')), (await v3Of(b)).currentCycle.slots['leg-press'].performedExerciseId], [['Hack Squat | 1 set ✓'], 'hack-squat']);
  check('(b) no page errors', b.errors, []);
  await chrome.closeTarget(b.targetId);

  // ---------- (c) rollback: v1.2.0 opens data with a swap and remarks (only when v1.2.0 is served, see README) ----------
  const v120Up = await fetch(V120).then((r) => r.ok).catch(() => false);
  if (!v120Up) results.push(`SKIP  (c) rollback checks: no v1.2.0 build at ${V120} (see README: "Rollback checks")`);
  else await (async () => {
  const swapped = { ...fresh, currentCycle: { ...fresh.currentCycle, slots: { 'leg-press': slot('leg-press', 'leg-press', 'hack-squat', { 0: set('200', '8') }) } },
    bests: { 'leg-press': { weight: '150', reps: '10', unit: 'kg' }, 'hack-squat': { weight: '200', reps: '8', unit: 'kg' } }, remarks: { 'hack-squat': 'shoulder pads 2', 'leg-press': 'seat 4' } };
  const old = await chrome.newPage(360, 740);
  await old.goto(V120);
  await seed(old, swapped);
  await old.reload(3500);
  await day(old, 1);
  const oldCard = await old.evaluate(`(() => { const card = document.querySelector('main [data-set-row]').closest('[class*="rounded"]').parentElement; return document.querySelector('main').innerText.includes('Leg Press') && document.querySelector('main').innerText.includes('Prev: 150 kg × 10'); })()`);
  check('(c) v1.2.0 shows the default name "Leg Press" and Leg Press\'s Prev best for the swapped slot', oldCard, true);
  await openReport(old);
  check('(c) v1.2.0 report: Hack Squat\'s set under "Leg Press"', (await reportRows(old)).filter((r) => !r.endsWith('—')), ['Leg Press | 200 kg × 8']);
  await closeTop(old);
  await old.typeInto(2, '210'); await old.typeInto(3, '8');
  await tap(old, `document.querySelectorAll('[data-set-row] button[aria-pressed]')[1]`);
  await sleep(700);
  const savedByOld = await v3Of(old);
  console.log('(c) saved by v1.2.0:', JSON.stringify({ performed: savedByOld.currentCycle.slots['leg-press'].performedExerciseId, remarks: savedByOld.remarks, bests: savedByOld.bests }));
  check('(c) v1.2.0 keeps the swap choice and the remarks when it saves',
    [savedByOld.currentCycle.slots['leg-press'].performedExerciseId, savedByOld.remarks], ['hack-squat', swapped.remarks]);
  check('(c) the risk: v1.2.0 put the Hack Squat set into Leg Press\'s best', [savedByOld.bests['leg-press'], savedByOld.bests['hack-squat']], [{ weight: '210', reps: '8', unit: 'kg' }, { weight: '200', reps: '8', unit: 'kg' }]);
  check('(c) no page errors in v1.2.0', old.errors, []);
  await chrome.closeTarget(old.targetId);
  const back = await chrome.newPage(360, 740);
  await back.goto(BRANCH);
  await seed(back, savedByOld);
  await back.reload(3000);
  await openReport(back);
  check('(c) upgraded again: the slot is Hack Squat again with both sets, remarks intact',
    [(await reportRows(back)).filter((r) => !r.endsWith('—')), (await v3Of(back)).remarks], [['Hack Squat | 210 kg × 8'], swapped.remarks]);
  const { data } = await back.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/rollback-report-branch.png`, Buffer.from(data, 'base64'));
  check('(c) no page errors after upgrading again', back.errors, []);
  })();
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
