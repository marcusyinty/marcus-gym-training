// Browser check for the one global, saved weight unit.
import { launchChrome, sleep } from './cdp.mjs';

const results = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${JSON.stringify(actual)})`);
};
const COUNT_WRITES = `window.__writes = []; const realSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { window.__writes.push(k); return realSetItem.call(this, k, v); };`;
// What set rows 1-2 of the first card show: weight, unit label, reps
const shown = (p) => p.evaluate(`[...document.querySelectorAll('main [data-set-row]')].filter((r) => r.querySelectorAll('input').length === 2).slice(0, 2)
  .map((r) => { const [w, reps] = r.querySelectorAll('input'); return w.value + ' ' + w.nextElementSibling.innerText.trim().toLowerCase() + ' x ' + reps.value; })`);
// Which unit button is active on every card of the current day
const activeUnits = (p) => p.evaluate(`[...document.querySelectorAll('main button')].filter((b) => ['kg', 'lbs'].includes(b.innerText.trim()) && b.className.includes('bg-emerald-500')).map((b) => b.innerText.trim())`);
const stored = (p) => p.evaluate(`({ unit: localStorage.getItem('aesthetic_recomp_unit_v1'),
  sets: (((d) => d ? { completedSets: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.keys(s.sets).filter((i) => s.sets[i].done).map(Number).sort((a, b) => a - b)])), setDetails: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.fromEntries(Object.entries(s.sets).filter(([, x]) => x.updatedAt !== undefined || x.weight !== '' || x.reps !== '').map(([i, x]) => [i, { setNumber: Number(i) + 1, weight: x.weight, reps: x.reps, unit: x.unit, timestamp: x.updatedAt }]))])), bests: d.bests } : { completedSets: {}, setDetails: {}, bests: {} })(JSON.parse(localStorage.getItem('aesthetic_recomp_v3') || 'null'))).setDetails['incline-db-press'] ?? null })`);
const pick = (s) => s && { weight: s.weight, reps: s.reps, unit: s.unit };
const badge = (p) => p.evaluate(`[...document.querySelectorAll('main *')].filter((d) => typeof d.className === 'string' && d.className.includes('bg-cyan-500/10')).map((d) => d.innerText.trim())`);

const chrome = await launchChrome(9339, 'profile-units');
try {
  const page = await chrome.newPage(360);
  await page.goto();
  await page.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en')`);
  await page.reload();
  check('0. new user (no data): unit setting created as kg', (await stored(page)).unit, 'kg');
  const cardCount = (await activeUnits(page)).length;

  await page.typeInto(0, '60'); await page.typeInto(1, '8'); await sleep(500);
  check('1. type 60 kg x 8 -> stored as 60 kg', pick((await stored(page)).sets['0']), { weight: '60', reps: '8', unit: 'kg' });

  await page.clickButtonByText('lbs', 2); await sleep(500); // the 3rd card's lbs button
  check('2. switch to lbs (on another card) -> set shows 132.3 lbs x 8', (await shown(page))[0], '132.3 lbs x 8');
  check(`   every card (${cardCount}) now shows lbs`, await activeUnits(page), Array(cardCount).fill('lbs'));
  check('   stored value untouched by switching', pick((await stored(page)).sets['0']), { weight: '60', reps: '8', unit: 'kg' });

  await page.clickButtonByText('kg', 4); await sleep(500);
  check('3. switch back to kg -> exactly 60 again', (await shown(page))[0], '60 kg x 8');

  await page.clickButtonByText('lbs', 0); await sleep(300);
  await page.typeInto(2, '135'); await page.typeInto(3, '10'); await sleep(500);
  check('4. type a new weight while in lbs -> saved as lbs', pick((await stored(page)).sets['1']), { weight: '135', reps: '10', unit: 'lbs' });
  check('   ...and shown exactly as typed', (await shown(page))[1], '135 lbs x 10');

  await page.typeInto(1, '10'); await sleep(500);
  check('5. edit only the reps of the 60 kg set while in lbs -> stored weight stays 60 kg', pick((await stored(page)).sets['0']), { weight: '60', reps: '10', unit: 'kg' });
  check('   ...shown as 132.3 lbs x 10', (await shown(page))[0], '132.3 lbs x 10');

  await page.clickButtonByText('Set 1', 0); await sleep(500);
  check('6. Prev badge shows in lbs (60 kg x 10 stored)', await badge(page), ['Prev: 132.3 lbs × 10']);
  await page.clickButtonByText('kg', 0); await sleep(300);
  check('   ...and in kg after switching', await badge(page), ['Prev: 60 kg × 10']);
  await page.clickButtonByText('lbs', 0); await sleep(800);

  await page.reload();
  check('7. reload -> unit setting persists', [(await stored(page)).unit, ...new Set(await activeUnits(page))], ['lbs', 'lbs']);
  check('   reload -> values persist', await shown(page), ['132.3 lbs x 10', '135 lbs x 10']);
  check('   reload -> stored values unchanged', Object.values((await stored(page)).sets).map(pick),
    [{ weight: '60', reps: '10', unit: 'kg' }, { weight: '135', reps: '10', unit: 'lbs' }]);
  await page.evaluate(`document.querySelectorAll('nav button')[3].click()`); await sleep(300);
  check('   other days use the same unit too', [...new Set(await activeUnits(page))], ['lbs']);

  // ---------- second tab ----------
  const tabA = await chrome.newPage(360);
  const tabB = await chrome.newPage(360);
  for (const t of [tabA, tabB]) { await t.send('Page.addScriptToEvaluateOnNewDocument', { source: COUNT_WRITES }); await t.goto(); }
  check('8. second tab opens in lbs', [...new Set(await activeUnits(tabB))], ['lbs']);
  await tabA.clickButtonByText('kg', 1);
  let unitsB = [];
  for (let i = 0; i < 12; i++) { await sleep(250); unitsB = [...new Set(await activeUnits(tabB))]; if (unitsB[0] === 'kg') break; }
  await sleep(1000);
  check('   switching to kg in tab A switches tab B', unitsB, ['kg']);
  check('   tab B shows the converted values in kg', await shown(tabB), ['60 kg x 10', '61.2 kg x 10']);
  check('   tab B saved nothing itself; tab A saved only the unit', [await tabB.evaluate('window.__writes'), await tabA.evaluate('window.__writes')], [[], ['aesthetic_recomp_unit_v1']]);

  check('No page errors', [page, tabA, tabB].flatMap((p) => p.errors), []);
} finally {
  console.log(results.join('\n'));
  chrome.kill();
}
