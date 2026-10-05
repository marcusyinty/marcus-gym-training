// Step 1D-3 main flow with real taps on migrated real-user data (360x740):
// tick -> Start new week -> history row -> old report -> lbs -> 中文 -> reload -> everything still there.
// The 4 v2 keys must stay byte-for-byte the same after every step.
import { readFileSync } from 'node:fs';
import { launchChrome, SCRATCH, sleep, FIXTURES } from './cdp.mjs';

const V2_KEYS = ['language_preference', 'aesthetic_recomp_completed_sets_v2', 'aesthetic_recomp_set_details_v2', 'aesthetic_recomp_previous_bests_v2'];
const recorded = { ...JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8')), language_preference: 'en', aesthetic_recomp_unit_v1: 'kg' };
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)?.slice(0, 300)}, expected ${JSON.stringify(expected)?.slice(0, 300)})`}`);
};
const tap = async (p, elJs) => {
  const r = await p.evaluate(`(() => { const el = ${elJs}; el.scrollIntoView({ block: 'nearest', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(400);
};
const btn = (root, text) => `[...${root}.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith(${JSON.stringify(text)}))`;
const TOP = `(() => { const ms = [...document.querySelectorAll('.fixed.inset-0')]; return ms[ms.length - 1]; })()`;
// The open report's caption and its 4 tiles
const readReport = (p) => p.evaluate(`(() => { const m = ${TOP}; const tiles = [...m.querySelectorAll('.grid.grid-cols-2 > div')].map((d) => d.lastElementChild.innerText.replace(/\\s+/g, ' ').trim()); return { caption: m.querySelector('[data-week-caption]')?.innerText, tiles }; })()`);
const v3 = (p) => p.evaluate(`JSON.parse(localStorage.getItem('aesthetic_recomp_v3'))`);
const v2 = (p) => p.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`);
const TODAY_EN = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const TODAY_ZH = new Date().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
const T = {
  en: { past: 'Past weeks', start: 'Start new week', close: 'Close', report: 'View Weekly Report Card' },
  zh: { past: '历史周', start: '开始新的一周', close: '关闭', report: 'View Weekly Report Card' },
};

const chrome = await launchChrome(9404, 'profile-1d3-flow');
try {
  const p = await chrome.newPage(360, 740);
  await p.goto();
  await p.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(recorded)})) localStorage.setItem(k, v);`);
  await p.reload(3500);
  const original = await v2(p);
  const v2Same = async (when) => check(`v2 keys byte-for-byte unchanged: ${when}`, (await v2(p)).slice(1), original.slice(1));
  const start = await v3(p);
  check('migrated: week 1 with the 4 recorded ticks, no history', [start.archivedCycles.length, Object.values(start.currentCycle.slots).reduce((n, s) => n + Object.values(s.sets).filter((x) => x.done).length, 0)], [0, 4]);

  // ---- 1. train a bit more (real taps), then look at this week's report ----
  await tap(p, `document.querySelectorAll('[data-set-row] button[aria-pressed]')[2]`); // incline set 3
  await p.typeInto(4, '65'); await p.typeInto(5, '5');
  await tap(p, `document.querySelectorAll('nav button')[2]`); // Day 3
  await p.typeInto(0, '30'); await p.typeInto(1, '10');
  await tap(p, `document.querySelectorAll('[data-set-row] button[aria-pressed]')[0]`);
  await sleep(500);
  await v2Same('after training');
  await tap(p, `document.querySelector('button[title="${T.en.report}"]')`);
  const before = await readReport(p);
  console.log('week 1 report before:', JSON.stringify(before));
  check('this week: caption, and the report is open by tap (not a pop-up)', before.caption, 'Week 1 · since 2 Oct 2026');
  const beforeData = await v3(p);

  // ---- 2. start a new week ----
  await tap(p, btn(TOP, T.en.start));
  check('confirm dialog with the exact text', await p.evaluate(`document.getElementById('start-week-text')?.innerText`), 'This week will be saved to your history. A new empty week begins. Your personal bests are kept.');
  await tap(p, btn(`document.querySelector('[role="alertdialog"]')`, T.en.start));
  const after = await v3(p);
  check('archived once (same week, with an end time), new empty week', [after.archivedCycles.length, after.archivedCycles[0].id, !!after.archivedCycles[0].endedAt, JSON.stringify(after.archivedCycles[0].slots) === JSON.stringify(beforeData.currentCycle.slots), Object.keys(after.currentCycle.slots).length],
    [1, beforeData.currentCycle.id, true, true, 0]);
  check('bests and "report shown" list unchanged', [JSON.stringify(after.bests) === JSON.stringify(beforeData.bests), after.reportShownCycleIds], [true, beforeData.reportShownCycleIds]);
  check('no modal left open (no report pop-up), Day 1 shown, no ticks on screen',
    [await p.evaluate(`document.querySelectorAll('.fixed.inset-0').length`), await p.evaluate(`document.querySelector('nav button').getAttribute('aria-current')`), await p.evaluate(`[...document.querySelectorAll('[data-set-row] button[aria-pressed="true"]')].length`)],
    [0, 'true', 0]);
  await v2Same('after Start new week');

  // ---- 3. history row and the old report ----
  await tap(p, `document.querySelector('header button[title^="About"]')`);
  await tap(p, btn('document', `${T.en.past} (1)`));
  const row = await p.evaluate(`document.querySelector('[data-history-row="1"]').innerText.replace(/\\s+/g, ' ').trim()`);
  console.log('history row:', row);
  const setsTile = before.tiles[1].split('/')[0];
  check('history row: Week 1, dates, same sets + volume as the week\'s report', row, `Week 1 2 Oct – ${TODAY_EN} 2026 ${setsTile} ticked sets ${before.tiles[3]}`);
  await tap(p, `document.querySelector('[data-history-row="1"]')`);
  const old = await readReport(p);
  check('old report: its dates, same 4 numbers as before the new week', [old.caption, old.tiles], [`Week 1 · 2 Oct – ${TODAY_EN} 2026`, before.tiles]);
  check('old report is read-only: Start new week disabled with the reason',
    [await p.evaluate(`${btn(TOP, T.en.start)}.disabled`), await p.evaluate(`document.getElementById('start-new-week-reason')?.innerText`)], [true, "This is a past week from your history. It can't be changed."]);
  await tap(p, `${TOP}.querySelector('button.absolute')`); // back to the list
  await tap(p, btn(TOP, T.en.close));

  // ---- 4. the new week, then lbs ----
  await tap(p, `document.querySelectorAll('[data-set-row] button[aria-pressed]')[0]`);
  await tap(p, `document.querySelector('button[title="${T.en.report}"]')`);
  check('the new week is Week 2', (await readReport(p)).caption, `Week 2 · since ${TODAY_EN} 2026`);
  await tap(p, `${TOP}.querySelector('button.absolute')`);
  await p.evaluate(`[...document.querySelectorAll('main button')].find((b) => b.innerText.trim() === 'lbs').click()`); await sleep(400);
  await tap(p, `document.querySelector('header button[title^="About"]')`);
  await tap(p, btn('document', `${T.en.past} (1)`));
  const lbsRow = await p.evaluate(`document.querySelector('[data-history-row="1"]').innerText.replace(/\\s+/g, ' ').trim()`);
  const kgVolume = Number(before.tiles[3].replace(/[^0-9]/g, ''));
  const lbsVolume = Number(lbsRow.match(/([0-9,]+) lbs/)?.[1].replace(/,/g, ''));
  console.log('history row in lbs:', lbsRow);
  check('history volume follows the unit shown now (kg x 2.2046, rounding allowed)', Math.abs(lbsVolume - kgVolume * 2.20462) < 3, true);
  await tap(p, btn(TOP, T.en.close));
  await p.evaluate(`[...document.querySelectorAll('main button')].find((b) => b.innerText.trim() === 'kg').click()`); await sleep(400);

  // ---- 5. 中文 ----
  await p.evaluate(`[...document.querySelectorAll('header button')].find((b) => b.innerText.trim() === '中文').click()`); await sleep(400);
  await tap(p, `document.querySelector('header button[title^="About"]')`);
  await tap(p, btn('document', `${T.zh.past}（1）`));
  const zhRow = await p.evaluate(`document.querySelector('[data-history-row="1"]').innerText.replace(/\\s+/g, ' ').trim()`);
  check('中文 history row', zhRow, `第 1 周 2026年10月2日 – ${TODAY_ZH} ${setsTile} 组已完成 ${before.tiles[3]}`);
  await tap(p, `document.querySelector('[data-history-row="1"]')`);
  check('中文 old report caption + reason', [(await readReport(p)).caption, await p.evaluate(`document.getElementById('start-new-week-reason')?.innerText`)], [`第 1 周 · 2026年10月2日 – ${TODAY_ZH}`, '这是历史中的过去一周，无法更改。']);
  await tap(p, `${TOP}.querySelector('button.absolute')`);
  await tap(p, btn(TOP, T.zh.close));
  await sleep(500);

  // ---- 6. reload: everything is still there ----
  const savedBeforeReload = await v3(p);
  await p.reload(3000);
  check('after reload: same saved data, still 中文, week 2 tick still there',
    [JSON.stringify(await v3(p)) === JSON.stringify(savedBeforeReload), await p.evaluate(`localStorage.getItem('language_preference')`), await p.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[0].getAttribute('aria-pressed')`)],
    [true, 'zh', 'true']);
  await tap(p, `document.querySelector('header button[title^="About"]')`);
  await tap(p, btn('document', `${T.zh.past}（1）`));
  check('after reload: the history row is unchanged', await p.evaluate(`document.querySelector('[data-history-row="1"]').innerText.replace(/\\s+/g, ' ').trim()`), zhRow);
  await tap(p, `document.querySelector('[data-history-row="1"]')`);
  check('after reload: the old report has the same numbers', (await readReport(p)).tiles, before.tiles);
  await v2Same('after reload');
  check('language key only changed by the language switch', (await v2(p))[0], 'zh');
  check('no page errors', p.errors, []);
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
