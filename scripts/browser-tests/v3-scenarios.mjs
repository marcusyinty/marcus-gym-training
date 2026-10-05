// The 8 data scenarios for the v3 switch. Saves the exact storage text before/after each to review-shots.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launchChrome, SCRATCH, sleep, FIXTURES, SHOTS } from './cdp.mjs';

const OUT = `${SHOTS}/1d2b-scenarios`;
mkdirSync(OUT, { recursive: true });
const V2_KEYS = ['language_preference', 'aesthetic_recomp_completed_sets_v2', 'aesthetic_recomp_set_details_v2', 'aesthetic_recomp_previous_bests_v2'];
const recorded = { ...JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8')), language_preference: 'en', aesthetic_recomp_unit_v1: 'kg' };
const COUNT_WRITES = `window.__writes = []; const realSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { window.__writes.push(k); return realSetItem.call(this, k, v); };`;
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${JSON.stringify(actual)})`);
};

const chrome = await launchChrome(9378, 'profile-v3scen');
// reads through a reference kept before any test injection blocks localStorage
const all = (p) => p.evaluate(`(() => { const ls = window.__realLS || localStorage; return Object.fromEntries(Object.keys(ls).sort().map((k) => [k, ls.getItem(k)])); })()`);
const diff = (before, after) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().map((k) =>
    `${!(k in before) ? 'NEW      ' : !(k in after) ? 'REMOVED  ' : before[k] === after[k] ? 'same     ' : 'CHANGED  '}${k}${k in after ? ` (${after[k].length} chars)` : ''}`);
const v2Same = (before, after) => V2_KEYS.every((k) => before[k] === after[k]);
const banner = (p) => p.evaluate(`!!document.querySelector('main [role="status"]')`);
const tickFirst = (p) => p.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[0].click()`);

// Opens a page with an optional script injected before the app, seeds storage, loads, and returns snapshots
const scenario = async (name, seed, { inject = '', act = null } = {}) => {
  const page = await chrome.newPage(360, 740);
  await page.goto();
  await page.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(seed)})) localStorage.setItem(k, v);`);
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: COUNT_WRITES + inject });
  const before = await all(page);
  await page.reload(3500);
  const afterLoad = await all(page);
  const loadWrites = await page.evaluate('window.__writes');
  let afterAct = null;
  let actWrites = null;
  if (act) {
    await act(page);
    await sleep(900);
    await page.evaluate(`window.dispatchEvent(new Event('pagehide'))`);
    await sleep(200);
    afterAct = await all(page);
    actWrites = (await page.evaluate('window.__writes')).slice(loadWrites.length);
  }
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify({ before, afterLoad, loadWrites, afterAct, actWrites }, null, 2));
  console.log(`\n=== ${name} ===\n  load writes: ${JSON.stringify(loadWrites)}\n  ${diff(before, afterLoad).join('\n  ')}`);
  if (act) console.log(`  after the user's change, writes: ${JSON.stringify(actWrites)}\n  ${diff(afterLoad, afterAct).join('\n  ')}`);
  return { page, before, afterLoad, loadWrites, afterAct, actWrites };
};

try {
  // 1. fresh install
  let s = await scenario('1-fresh-install', { language_preference: 'en' }, { act: tickFirst });
  check('1 fresh: nothing written on load except the first-run unit default', s.loadWrites, ['aesthetic_recomp_unit_v1']);
  check('1 fresh: first change saves the v3 key once (no v2 keys)', s.actWrites, ['aesthetic_recomp_v3']);
  s.page.close();

  // 2. recorded v2 data
  s = await scenario('2-recorded-v2', recorded, { act: tickFirst });
  check('2 recorded v2: the one migration save on load, nothing else', s.loadWrites, ['aesthetic_recomp_v3']);
  check('2 recorded v2: v2 keys byte-for-byte unchanged after load and after a change', [v2Same(s.before, s.afterLoad), v2Same(s.before, s.afterAct)], [true, true]);
  check('2 recorded v2: a change writes only the v3 key', s.actWrites, ['aesthetic_recomp_v3']);
  const v3 = JSON.parse(s.afterLoad.aesthetic_recomp_v3);
  const migratedRecorded = v3;
  check('2 recorded v2: migrated content', [v3.currentCycle.startedAt, Object.keys(v3.currentCycle.slots), v3.bests['lat-pulldown']],
    ['2026-10-02T15:09:36.888Z', ['incline-db-press', 'lat-pulldown', 'leg-press'], { weight: '135', reps: '10', unit: 'lbs' }]);
  s.page.close();

  // 3. corrupt v2 data
  s = await scenario('3-corrupt-v2', {
    ...recorded,
    aesthetic_recomp_completed_sets_v2: '{"incline-db-press":[0,1],"lat-pulldown":"oops","leg-press":[0,"x"]}',
    aesthetic_recomp_set_details_v2: '{"incline-db-press":{"0":{"setNumber":1,"weight":60,"reps":"8","unit":"kg"}',
  });
  check('3 corrupt v2: backups of the damaged v2 text + the migration save; v2 keys unchanged',
    [s.loadWrites.sort(), v2Same(s.before, s.afterLoad)],
    [['aesthetic_recomp_backup_aesthetic_recomp_completed_sets_v2_raw', 'aesthetic_recomp_backup_aesthetic_recomp_set_details_v2_raw', 'aesthetic_recomp_v3'].sort(), true]);
  check('3 corrupt v2: backups hold the exact original text', [s.afterLoad.aesthetic_recomp_backup_aesthetic_recomp_completed_sets_v2_raw, s.afterLoad.aesthetic_recomp_backup_aesthetic_recomp_set_details_v2_raw],
    [s.before.aesthetic_recomp_completed_sets_v2, s.before.aesthetic_recomp_set_details_v2]);
  check('3 corrupt v2: usable parts kept (ticks 0,1 + leg-press 0; bests kept)', [Object.keys(JSON.parse(s.afterLoad.aesthetic_recomp_v3).currentCycle.slots), await banner(s.page)],
    [['incline-db-press', 'leg-press'], false]);
  s.page.close();

  // 4a. corrupt v3 (valid JSON, one bad piece): backup once, v3 text not rewritten on load
  const good = JSON.parse(s.afterLoad.aesthetic_recomp_v3);
  const corrupt = { ...good, bests: { ...good.bests, 'leg-press': 'nonsense' } };
  s = await scenario('4a-corrupt-v3-piece', { ...recorded, aesthetic_recomp_v3: JSON.stringify(corrupt) });
  check('4a corrupt v3 piece: only the backup is written on load', s.loadWrites, ['aesthetic_recomp_backup_aesthetic_recomp_v3_raw']);
  check('4a: backup = original text; v3 and v2 keys unchanged', [s.afterLoad.aesthetic_recomp_backup_aesthetic_recomp_v3_raw === s.before.aesthetic_recomp_v3, s.afterLoad.aesthetic_recomp_v3 === s.before.aesthetic_recomp_v3, v2Same(s.before, s.afterLoad)], [true, true, true]);
  // a later corrupt text must not overwrite that first backup
  await s.page.evaluate(`localStorage.setItem('aesthetic_recomp_v3', ${JSON.stringify(JSON.stringify({ ...corrupt, archivedCycles: 'bad' }))})`);
  await s.page.reload(3000);
  const later = await all(s.page);
  check('4a: a second corrupt load does not overwrite the first backup', later.aesthetic_recomp_backup_aesthetic_recomp_v3_raw, s.before.aesthetic_recomp_v3);
  s.page.close();

  // 4b. unreadable v3 text with v2 present: backed up, then migrated from v2
  s = await scenario('4b-broken-v3-json', { ...recorded, aesthetic_recomp_v3: '{"schemaVersion":3,"currentCyc' });
  check('4b broken v3: backup of the broken text, then the migration save', [s.loadWrites, s.afterLoad.aesthetic_recomp_backup_aesthetic_recomp_v3_raw],
    [['aesthetic_recomp_backup_aesthetic_recomp_v3_raw', 'aesthetic_recomp_v3'], '{"schemaVersion":3,"currentCyc']);
  s.page.close();

  // 5. forced 'error': the first date-to-text call during loading throws (test page only)
  const FAIL_ONCE = `const realToISO = Date.prototype.toISOString; Date.prototype.toISOString = function () { if (!window.__failedOnce && this.getTime() !== 0) { window.__failedOnce = true; throw new RangeError('injected for the test'); } return realToISO.call(this); };`;
  s = await scenario('5-forced-error', recorded, {
    inject: FAIL_ONCE,
    act: async (p) => { await tickFirst(p); await p.typeInto(0, '99'); await p.typeInto(1, '9'); },
  });
  check('5 error: banner shown', await banner(s.page), true);
  check('5 error: NOTHING written on load, after changes, or on pagehide', [s.loadWrites, s.actWrites], [[], []]);
  check('5 error: storage byte-for-byte identical throughout', [JSON.stringify(s.afterLoad) === JSON.stringify(s.before), JSON.stringify(s.afterAct) === JSON.stringify(s.before)], [true, true]);
  check('5 error: the app still works in memory', await s.page.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[0].getAttribute('aria-pressed') + ' ' + document.querySelectorAll('main input')[0].value`), 'true 99');
  const { data: errShot } = await s.page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/5-forced-error-banner.png`, Buffer.from(errShot, 'base64'));
  await s.page.evaluate(`localStorage.setItem('language_preference', 'zh')`);
  await s.page.evaluate(`window.__failedOnce = false`);
  s.page.close();

  // 6. v3 already present (and different from v2): v3 wins, nothing written
  const v3Only = { ...migratedRecorded, currentCycle: { ...migratedRecorded.currentCycle, slots: { 'lat-pulldown': migratedRecorded.currentCycle.slots['lat-pulldown'] } } };
  s = await scenario('6-v3-present', { ...recorded, aesthetic_recomp_v3: JSON.stringify(v3Only) });
  check('6 v3 present: nothing written on load', s.loadWrites, []);
  check('6 v3 present: shows the v3 data, not v2 (Incline not ticked, Lat Pulldown ticked)',
    await s.page.evaluate(`[...document.querySelectorAll('[data-set-row] button[aria-pressed]')].filter((_, i) => i === 0 || i === 3).map((b) => b.getAttribute('aria-pressed'))`), ['false', 'true']);
  s.page.close();

  // 7a. storage full: every save throws
  s = await scenario('7a-storage-full', recorded, {
    inject: `Storage.prototype.setItem = function (k) { window.__writes.push('FAILED:' + k); throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); };`,
    act: tickFirst,
  });
  check('7a full: migration save attempted and failed; storage unchanged; app works', [s.loadWrites, JSON.stringify(s.afterLoad) === JSON.stringify(s.before), s.page.errors.length],
    [['FAILED:aesthetic_recomp_v3'], true, 0]);
  // set 1 was done in the recorded data, so the tick turned it off: the change works in memory
  check('7a full: tick works in memory (set 1 was done -> now not done)', await s.page.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[0].getAttribute('aria-pressed')`), 'false');
  s.page.close();

  // 7b. storage blocked: reading localStorage itself throws
  s = await scenario('7b-storage-blocked', recorded, {
    inject: `window.__realLS = window.localStorage; Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });`,
    act: tickFirst,
  });
  check('7b blocked: app loads empty and works, no errors', [await s.page.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[0].getAttribute('aria-pressed')`), s.page.errors], ['true', []]);
  s.page.close();

  // 8. two tabs
  const seed8 = recorded;
  const tabA = await chrome.newPage(360, 740);
  await tabA.goto();
  await tabA.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(seed8)})) localStorage.setItem(k, v);`);
  for (const t of [tabA]) { await t.send('Page.addScriptToEvaluateOnNewDocument', { source: COUNT_WRITES }); await t.reload(3500); }
  const tabB = await chrome.newPage(360, 740);
  await tabB.send('Page.addScriptToEvaluateOnNewDocument', { source: COUNT_WRITES });
  await tabB.goto();
  const beforeTabs = await all(tabA);
  check('8 tabs: B opened after the migration -> loads v3, writes nothing', await tabB.evaluate('window.__writes'), []);
  await tabA.send('Page.bringToFront');
  await tabA.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[2].click()`);
  await sleep(2500);
  check('8 tabs: B shows A\'s tick, B wrote nothing (no loop)', [await tabB.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[2].getAttribute('aria-pressed')`), await tabB.evaluate('window.__writes')], ['true', []]);
  await tabB.send('Page.bringToFront');
  await tabB.typeInto(4, '72');
  await sleep(2500);
  check('8 tabs: B\'s edit reaches A; A wrote only its own change once', [await tabA.evaluate(`document.querySelectorAll('main input')[4].value`), (await tabA.evaluate('window.__writes')).filter((k) => k === 'aesthetic_recomp_v3').length], ['72', 2]);
  const afterTabs = await all(tabA);
  check('8 tabs: v2 keys unchanged', v2Same(beforeTabs, afterTabs), true);
  writeFileSync(`${OUT}/8-two-tabs.json`, JSON.stringify({ before: beforeTabs, after: afterTabs, writesA: await tabA.evaluate('window.__writes'), writesB: await tabB.evaluate('window.__writes') }, null, 2));
  check('No page errors in scenarios', [tabA.errors, tabB.errors], [[], []]);
} finally {
  console.log('\n' + results.join('\n'));
  chrome.kill();
}
