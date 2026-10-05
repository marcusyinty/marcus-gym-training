// Browser check for the "previous best" rules and the ticks-only "done" state.
import { launchChrome, sleep } from './cdp.mjs';

const results = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${JSON.stringify(actual)})`);
};
const COUNT_WRITES = `window.__writes = []; const realSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { window.__writes.push(k); return realSetItem.call(this, k, v); };`;
const bests = (p) => p.evaluate(`[...document.querySelectorAll('main *')].filter((d) => typeof d.className === 'string' && d.className.includes('bg-cyan-500/10')).map((d) => d.innerText.trim())`);
const rows = (p) => p.evaluate(`[...document.querySelectorAll('main [data-set-row]')].filter((r) => r.querySelectorAll('input').length === 2).slice(0, 3)
  .map((r) => [r.querySelector('button').className.includes('bg-emerald-500 text-black') ? 'done' : 'not done', r.querySelectorAll('input')[0].value, r.querySelectorAll('input')[1].value].join(' '))`);
const storedBench = (p) => p.evaluate(`({ best: (((d) => d ? { completedSets: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.keys(s.sets).filter((i) => s.sets[i].done).map(Number).sort((a, b) => a - b)])), setDetails: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.fromEntries(Object.entries(s.sets).filter(([, x]) => x.updatedAt !== undefined || x.weight !== '' || x.reps !== '').map(([i, x]) => [i, { setNumber: Number(i) + 1, weight: x.weight, reps: x.reps, unit: x.unit, timestamp: x.updatedAt }]))])), bests: d.bests } : { completedSets: {}, setDetails: {}, bests: {} })(JSON.parse(localStorage.getItem('aesthetic_recomp_v3') || 'null'))).bests['incline-db-press'] ?? null,
  details: (((d) => d ? { completedSets: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.keys(s.sets).filter((i) => s.sets[i].done).map(Number).sort((a, b) => a - b)])), setDetails: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.fromEntries(Object.entries(s.sets).filter(([, x]) => x.updatedAt !== undefined || x.weight !== '' || x.reps !== '').map(([i, x]) => [i, { setNumber: Number(i) + 1, weight: x.weight, reps: x.reps, unit: x.unit, timestamp: x.updatedAt }]))])), bests: d.bests } : { completedSets: {}, setDetails: {}, bests: {} })(JSON.parse(localStorage.getItem('aesthetic_recomp_v3') || 'null'))).setDetails['incline-db-press'] ?? null })`);

const chrome = await launchChrome(9337, 'profile-best');
try {
  const page = await chrome.newPage(360);
  await page.goto();
  await page.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en')`);
  await page.reload();

  // Day 1, exercise 1 (Incline DB Press): set inputs are 0/1 (set 1), 2/3 (set 2), 4/5 (set 3)
  await page.typeInto(0, '60'); await page.typeInto(1, '8'); await sleep(500);
  check('1. type 60 x 8 without ticking -> no best', await bests(page), []);
  check('   ...and nothing stored as best', (await storedBench(page)).best, null);

  await page.clickButtonByText('Set 1', 0); await sleep(300);
  check('2. tick it -> best 60 x 8 (76.0)', await bests(page), ['Prev: 60 kg × 8']);

  await page.typeInto(2, '62.5'); await page.typeInto(3, '6');
  await page.clickButtonByText('Set 2', 0); await sleep(300);
  check('3. 62.5 x 6 (75.0) ticked -> best stays 60 x 8', await bests(page), ['Prev: 60 kg × 8']);

  await page.typeInto(4, '65'); await page.typeInto(5, '6'); await sleep(300);
  check('4a. 65 x 6 typed but not ticked -> best stays', await bests(page), ['Prev: 60 kg × 8']);
  await page.clickButtonByText('Set 3', 0); await sleep(300);
  check('4b. 65 x 6 (78.0) ticked -> best updates', await bests(page), ['Prev: 65 kg × 6']);

  await page.clickButtonByText('Set 3', 0); await sleep(300);
  check('5. untick 65 x 6 -> best stays', await bests(page), ['Prev: 65 kg × 6']);

  await page.clickButtonByText('Set 3', 0); await sleep(300);
  await page.typeInto(4, '50'); await sleep(300);
  check('6. edit a done set lower (65 -> 50) -> best stays', await bests(page), ['Prev: 65 kg × 6']);

  await page.typeInto(3, '12'); await sleep(300);
  check('7. (extra) edit a done set higher (62.5 x 6 -> 62.5 x 12 = 87.5) -> best updates', await bests(page), ['Prev: 62.5 kg × 12']);

  // Exercise 2: typed but NOT ticked (used for the weekly report check)
  const ex2Input = await page.evaluate(`[...document.querySelectorAll('main input')].indexOf([...document.querySelectorAll('main [data-set-row]')].filter((r) => r.querySelectorAll('input').length === 2)[3].querySelector('input'))`);
  await page.typeInto(ex2Input, '100'); await page.typeInto(ex2Input + 1, '10'); await sleep(500);
  check('   exercise 2: 100 x 10 typed, not ticked -> still only one best on the page', await bests(page), ['Prev: 62.5 kg × 12']);

  await page.reload();
  check('8. reload -> best persists', await bests(page), ['Prev: 62.5 kg × 12']);
  check('   reload -> ticks, weights and reps persist', await rows(page), ['done 60 8', 'done 62.5 12', 'done 50 6']);
  const stored = await storedBench(page);
  check('   stored best keeps its unit and typed text', stored.best, { weight: '62.5', reps: '12', unit: 'kg' });
  check('   new set entries no longer contain "completed"', Object.values(stored.details).some((d) => 'completed' in d), false);
  console.log('Stored for Incline DB Press after reload:', JSON.stringify(stored));

  // ---------- another tab ----------
  const tabA = await chrome.newPage(360);
  const tabB = await chrome.newPage(360);
  for (const t of [tabA, tabB]) {
    await t.send('Page.addScriptToEvaluateOnNewDocument', { source: COUNT_WRITES });
    await t.goto();
    await t.evaluate(`document.querySelectorAll('nav button')[1].click()`); // Day 2
    await sleep(300);
  }
  await tabA.typeInto(0, '120'); await tabA.typeInto(1, '5');
  await tabA.clickButtonByText('Set 1', 0);
  let bestInB = [];
  for (let i = 0; i < 12 && bestInB.length === 0; i++) { await sleep(250); bestInB = await bests(tabB); }
  await sleep(1500);
  check('9. (extra) best made in tab A shows up in tab B', bestInB, ['Prev: 120 kg × 5']);
  check('   tab B saved nothing itself (no write loop)', await tabB.evaluate('window.__writes'), []);
  // Since the v3 data store (step 1D-2), everything is saved in one key and the three old v2 keys are never
  // written again. How many saves happen depends on the 300ms save timer, so only the keys are checked.
  check('   tab A saved only the v3 key (never the old v2 keys)', [...new Set(await tabA.evaluate('window.__writes'))], ['aesthetic_recomp_v3']);

  const errors = [page, tabA, tabB].flatMap((p) => p.errors);
  check('No page errors', errors, []);
} finally {
  console.log(results.join('\n'));
  chrome.kill();
}
