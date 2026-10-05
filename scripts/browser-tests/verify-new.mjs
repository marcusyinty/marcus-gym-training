// Checks the NEW storage code in a real browser against the text recorded from the OLD app.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { launchChrome, SCRATCH, SNAPSHOT_JS, KEYS, sleep, FIXTURES } from './cdp.mjs';

const oldSavedText = JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8'));
const oldScreen = JSON.parse(readFileSync(`${FIXTURES}/old-screen.json`, 'utf8'));
const results = [];
const check = (label, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
const loadOldText = `(() => { localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(oldSavedText)})) localStorage.setItem(k, v); })()`;
// Counts every localStorage write the page makes (installed before the app's code runs)
const COUNT_WRITES = `window.__writes = []; const realSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { window.__writes.push(k); return realSetItem.call(this, k, v); };`;

const chrome = await launchChrome(9334, 'profile-new');
try {
  // ---------- A: old saved text loads exactly as before ----------
  const page = await chrome.newPage(360);
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: COUNT_WRITES });
  await page.goto();
  await page.evaluate(loadOldText);
  await page.reload();
  const newScreen = await page.evaluate(SNAPSHOT_JS);
  await sleep(1000);
  const storageAfter = await page.allStorage();
  const writesDuringLoad = await page.evaluate('window.__writes');

  // What is still meant to be identical to the old app (step 1C), and what changed on purpose since:
  // - the data: every tick, weight and reps on all 5 days. Since step 1C-2 there is one kg/lbs setting for the
  //   whole app (picked from the data: kg here), so the one set typed in lbs (135) is shown converted (61.2);
  // - the best-set numbers (the badge's label changed: "上次" -> "最佳" in step 4);
  // - the report's top sets, now in the app's unit (labels were translated in step 1D-4).
  const savedDetails = JSON.parse(oldSavedText.aesthetic_recomp_set_details_v2);
  const typedInLbs = new Set(Object.values(savedDetails).flatMap((sets) => Object.values(sets)).filter((s) => s.unit === 'lbs').map((s) => s.weight));
  const kg = (lbs) => String(Math.round(Number(lbs) * 0.45359237 * 10) / 10); // the app's rule: 1 decimal
  const rowsOf = (screen, fromOldApp) => screen.days.map((d) => d.rows.map((r) => [r.done, fromOldApp && typedInLbs.has(r.weight) ? kg(r.weight) : r.weight, r.reps]));
  const bestsOf = (screen, fromOldApp) => screen.days.map((d) => d.bests.map((t) => {
    const value = t.replace(/^[^:]*:\s*/, ''); // drop the label ("上次" / "最佳")
    return fromOldApp ? value.replace(/^([\d.]+) lbs/, (m, n) => `${kg(n)} kg`) : value;
  }));
  check('A1 every tick, weight and reps on all 5 days as in the old app (its lbs set shown in the app\'s kg)', isDeepStrictEqual(rowsOf(newScreen, false), rowsOf(oldScreen, true)),
    JSON.stringify(rowsOf(newScreen, false).map((d) => d.filter(([done, w]) => done || w))));
  // Since step 1D-2 an exercise that is on two days shares one best: Day 5's Leg Press shows Day 2's 100 x 5 too
  const expectedBests = bestsOf(oldScreen, true).map((day, i) => (i === 4 ? [...day, bestsOf(oldScreen, true)[1][0]] : day));
  check('A1 the same best-set numbers (Day 5 Leg Press shares Day 2\'s best)', isDeepStrictEqual(bestsOf(newScreen, false), expectedBests), JSON.stringify(newScreen.days.map((d) => d.bests)));
  check('A1 the report shows the same top sets (in kg)', ['62.5 kg × 6', '61.2 kg × 10', '100 kg × 5'].every((top) => newScreen.weeklyReport.includes(top)));
  // Since the v3 data store (step 1D-2): the first load copies the old data into the v3 key once and saves the
  // unit it picked; the four old keys are only read, never changed.
  const v2Now = Object.fromEntries(Object.keys(oldSavedText).map((k) => [k, storageAfter[k]]));
  check('A2 the four old keys are unchanged byte-for-byte after loading', isDeepStrictEqual(v2Now, oldSavedText));
  check('A2 the only new keys are the v3 data and the unit setting', Object.keys(storageAfter).filter((k) => !(k in oldSavedText)).sort().join(', ') === 'aesthetic_recomp_unit_v1, aesthetic_recomp_v3',
    Object.keys(storageAfter).join(', '));
  check('A3 no backup keys created for valid old data', !Object.keys(storageAfter).some((k) => k.includes('backup')));
  check('A4 the first load writes only the v3 key and the unit, once each', [...writesDuringLoad].sort().join(', ') === 'aesthetic_recomp_unit_v1, aesthetic_recomp_v3', `writes: ${JSON.stringify(writesDuringLoad)}`);
  await page.evaluate('window.__writes = []');
  await page.reload();
  await sleep(1000);
  check('A4 a second load writes nothing at all', (await page.evaluate('window.__writes')).length === 0, `writes: ${JSON.stringify(await page.evaluate('window.__writes'))}`);
  console.log('A: day 1 rows shown by NEW app:', newScreen.days[0].rows.filter((r) => r.done || r.weight), newScreen.days[0].bests, newScreen.activeLang);

  // ---------- B: close the tab right after typing ----------
  // Probe 1 is registered before the app, so it runs BEFORE the app's flush; probe 2 runs AFTER it.
  const tab = await chrome.newPage(360);
  const probe = (name) => `window.addEventListener('pagehide', () => {
    const d = (((d) => d ? { completedSets: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.keys(s.sets).filter((i) => s.sets[i].done).map(Number).sort((a, b) => a - b)])), setDetails: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.fromEntries(Object.entries(s.sets).filter(([, x]) => x.updatedAt !== undefined || x.weight !== '' || x.reps !== '').map(([i, x]) => [i, { setNumber: Number(i) + 1, weight: x.weight, reps: x.reps, unit: x.unit, timestamp: x.updatedAt }]))])), bests: d.bests } : { completedSets: {}, setDetails: {}, bests: {} })(JSON.parse(localStorage.getItem('aesthetic_recomp_v3') || 'null'))).setDetails;
    localStorage.setItem('__probe_${name}', JSON.stringify({ msSinceLastKey: Date.now() - window.__lastKeyAt, set3Weight: d['incline-db-press']?.[2]?.weight ?? null }));
  });`;
  await tab.send('Page.addScriptToEvaluateOnNewDocument', { source: `${probe('before_flush')}; document.addEventListener('input', () => { window.__lastKeyAt = Date.now(); }, true);` });
  await tab.goto();
  await tab.evaluate(probe('after_flush'));
  await tab.typeInto(4, '70', 30); // day 1, exercise 1, set 3 weight
  const beforeClose = await tab.evaluate(`(((d) => d ? { completedSets: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.keys(s.sets).filter((i) => s.sets[i].done).map(Number).sort((a, b) => a - b)])), setDetails: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.fromEntries(Object.entries(s.sets).filter(([, x]) => x.updatedAt !== undefined || x.weight !== '' || x.reps !== '').map(([i, x]) => [i, { setNumber: Number(i) + 1, weight: x.weight, reps: x.reps, unit: x.unit, timestamp: x.updatedAt }]))])), bests: d.bests } : { completedSets: {}, setDetails: {}, bests: {} })(JSON.parse(localStorage.getItem('aesthetic_recomp_v3') || 'null'))).setDetails['incline-db-press'][2]?.weight ?? null`);
  await chrome.closeTarget(tab.targetId);
  await sleep(500);

  const reopened = await chrome.newPage(360);
  await reopened.goto();
  const probes = await reopened.evaluate(`({ before: JSON.parse(localStorage.getItem('__probe_before_flush')), after: JSON.parse(localStorage.getItem('__probe_after_flush')) })`);
  const savedWeight = await reopened.evaluate(`(((d) => d ? { completedSets: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.keys(s.sets).filter((i) => s.sets[i].done).map(Number).sort((a, b) => a - b)])), setDetails: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.fromEntries(Object.entries(s.sets).filter(([, x]) => x.updatedAt !== undefined || x.weight !== '' || x.reps !== '').map(([i, x]) => [i, { setNumber: Number(i) + 1, weight: x.weight, reps: x.reps, unit: x.unit, timestamp: x.updatedAt }]))])), bests: d.bests } : { completedSets: {}, setDetails: {}, bests: {} })(JSON.parse(localStorage.getItem('aesthetic_recomp_v3') || 'null'))).setDetails['incline-db-press'][2]?.weight ?? null`);
  const shownWeight = await reopened.evaluate(`document.querySelectorAll('main input')[4].value`);
  console.log('B: weight in storage just before closing:', beforeClose, '| probes:', probes, '| after reopening:', savedWeight, '| shown:', shownWeight);
  check('B1 value not saved yet when the tab was closed (still inside the 300ms debounce)', beforeClose === null && probes.before?.set3Weight === null && probes.before.msSinceLastKey < 300, `${probes.before?.msSinceLastKey}ms after last key`);
  check('B2 pagehide flush saved it before the tab died', probes.after?.set3Weight === '70');
  check('B3 reopened tab shows the typed value', savedWeight === '70' && shownWeight === '70');

  // ---------- C: two tabs stay in sync without a write loop ----------
  const tabA = await chrome.newPage(360);
  const tabB = await chrome.newPage(360);
  for (const t of [tabA, tabB]) {
    await t.send('Page.addScriptToEvaluateOnNewDocument', { source: COUNT_WRITES });
    await t.goto();
  }
  const activeLang = (t) => t.evaluate(`[...document.querySelectorAll('header button')].find((b) => ['EN', '中文'].includes(b.innerText.trim()) && b.className.includes('bg-emerald-500')).innerText.trim()`);
  const set3Done = (t) => t.evaluate(`[...document.querySelectorAll('main [data-set-row]')].filter((r) => r.querySelectorAll('input').length === 2)[2].querySelector('button').className.includes('bg-emerald-500 text-black')`);
  const langBefore = await activeLang(tabB);
  await tabA.clickButtonByText('EN');
  const waitFor = async (fn, expected) => { for (let i = 0; i < 12; i++) { if ((await fn()) === expected) return expected; await sleep(250); } return fn(); };
  // Tab A is a hidden background tab here, and Chrome slows its timers, so allow up to 3s
  const langAfter = await waitFor(() => activeLang(tabB), 'EN');
  await tabA.clickButtonByText('Set 3', 0);
  const tickedInB = await waitFor(() => set3Done(tabB), true);
  await sleep(1500);
  const writesA = await tabA.evaluate('window.__writes');
  const writesB = await tabB.evaluate('window.__writes');
  check('C1 language change in tab A shows up in tab B', langBefore === '中文' && langAfter === 'EN', `${langBefore} -> ${langAfter}`);
  check('C2 ticking a set in tab A shows up in tab B', tickedInB === true);
  check('C3 no write loop: A saved once per change, B saved nothing', writesA.length === 2 && writesB.length === 0, `A: ${JSON.stringify(writesA)}, B: ${JSON.stringify(writesB)}`);

  // ---------- D: saving fails (full storage / private mode) ----------
  const full = await chrome.newPage(360);
  await full.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `Storage.prototype.setItem = function () { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); };`,
  });
  await full.goto();
  // Wait until the app has rendered (a fixed wait was sometimes too short when the machine was busy)
  for (let i = 0; i < 40 && !(await full.evaluate(`document.querySelectorAll('nav button').length >= 5`)); i++) await sleep(250);
  await full.evaluate(`document.querySelectorAll('nav button')[2].click()`);
  await sleep(300);
  await full.clickButtonByText('Set 1', 0);
  await full.typeInto(0, '42');
  await full.typeInto(1, '9');
  await sleep(800);
  await full.clickButtonByText('Set 2', 0);
  await sleep(800);
  const fullRow = await full.evaluate(`[...document.querySelectorAll('main [data-set-row]')].filter((r) => r.querySelectorAll('input').length === 2).slice(0, 2).map((r) => ({ done: r.querySelector('button').className.includes('bg-emerald-500 text-black'), weight: r.querySelectorAll('input')[0].value, reps: r.querySelectorAll('input')[1].value }))`);
  const saveWarnings = full.warnings.filter((w) => w.includes('Could not save'));
  console.log('D: rows on screen while saving fails:', fullRow, '\n   warnings:', saveWarnings);
  check('D1 app keeps working in memory when saving fails', fullRow[0].done && fullRow[0].weight === '42' && fullRow[0].reps === '9' && fullRow[1].done);
  check('D2 one console.warn per key, no crash', saveWarnings.length >= 1 && saveWarnings.length === new Set(saveWarnings).size && full.errors.length === 0, `${saveWarnings.length} warnings, ${full.errors.length} errors`);

  const allErrors = [page, reopened, tabA, tabB].flatMap((p) => p.errors);
  check('No page errors in A/B/C', allErrors.length === 0, allErrors.join(' | '));
} finally {
  console.log('\n' + results.join('\n'));
  chrome.kill();
}
