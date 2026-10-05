// Step 4: fatigue tags + "last time" with real taps. Usage: node 4-flows.mjs [baseUrl] [port]
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { launchChrome, SCRATCH, sleep, FIXTURES, APP } from './cdp.mjs';
import { historyData, set, slot } from './fixtures/seed.mjs';

const BASE = process.argv[2] ?? APP;
const PORT = Number(process.argv[3] ?? 9453);
const V3 = 'aesthetic_recomp_v3';
const V2_KEYS = ['language_preference', 'aesthetic_recomp_completed_sets_v2', 'aesthetic_recomp_set_details_v2', 'aesthetic_recomp_previous_bests_v2'];
const recorded = { ...JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8')), language_preference: 'en', aesthetic_recomp_unit_v1: 'kg' };
const DL = `${SCRATCH}/dl-4-flows`;
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)?.slice(0, 400)}, expected ${JSON.stringify(expected)?.slice(0, 400)})`}`);
};
const tap = async (p, elJs) => {
  await p.send('Page.bringToFront');
  const r = await p.evaluate(`(() => { const el = ${elJs}; if (!el) throw new Error('not found: ' + ${JSON.stringify(elJs)}); el.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(400);
};
const v3 = (p) => p.evaluate(`JSON.parse(localStorage.getItem('${V3}'))`);
const v2 = (p) => p.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`);
const day = async (p, i) => { await p.evaluate(`document.querySelectorAll('nav button')[${i}].click()`); await sleep(400); };
const CARD = (i) => `(() => { const rows = [...document.querySelectorAll('main [data-exercise-actions]')]; if (!rows[${i}]) throw new Error('card ${i} missing'); return rows[${i}].closest('.rounded-2xl'); })()`;
const typeIn = async (p, cardIndex, inputIndex, value) => {
  await p.evaluate(`(() => { const el = ${CARD(cardIndex)}.querySelectorAll('[data-set-row] input')[${inputIndex}]; el.scrollIntoView({ block: 'center' }); el.focus(); el.select(); })()`);
  for (const ch of value) { await p.send('Input.insertText', { text: ch }); await sleep(25); }
  await p.evaluate(`document.activeElement.blur()`); await sleep(350);
};
const setWeight = (p, c, s, v) => typeIn(p, c, s * 2, v);
const setReps = (p, c, s, v) => typeIn(p, c, s * 2 + 1, v);
const tickSet = (p, c, s) => tap(p, `${CARD(c)}.querySelectorAll('[data-set-row] button[aria-pressed]')[${s}]`);
const tickLabels = (p, c) => p.evaluate(`[...${CARD(c)}.querySelectorAll('[data-set-row] button[aria-pressed]')].map((b) => b.getAttribute('aria-label') + (b.innerText.trim() ? ' [' + b.innerText.trim() + ']' : ''))`);
const lastLines = (p, c) => p.evaluate(`[...${CARD(c)}.querySelectorAll('[data-last-time]')].map((l) => l.closest('[data-set-row]') ? l.innerText.replace(/\\s+/g, ' ').trim() : null)`);
const lastLinesBySet = (p, c) => p.evaluate(`[...${CARD(c)}.querySelectorAll('[data-set-row]')].map((r) => r.querySelector('[data-last-time]')?.innerText.replace(/\\s+/g, ' ').trim() ?? null)`);
const maxMarkers = (p, c) => p.evaluate(`[...${CARD(c)}.querySelectorAll('[data-set-row]')].map((r) => !!r.querySelector('[data-last-time-max] svg'))`);
const allLastLineCounts = async (p) => {
  const counts = [];
  for (let d = 0; d < 5; d++) { await day(p, d); counts.push(await p.evaluate(`document.querySelectorAll('main [data-last-time]').length`)); }
  await day(p, 0);
  return counts;
};
const prompt = (p) => p.evaluate(`(() => { const q = document.getElementById('tag-prompt-question'); return q ? q.innerText.replace(/\\s+/g, ' ').trim() : null; })()`);
const promptCount = (p) => p.evaluate(`document.querySelectorAll('[data-tag-prompt]').length`);
const timerText = (p) => p.evaluate(`document.querySelector('[data-rest-timer] [role=timer]')?.innerText.trim() ?? null`);
const seconds = (mmss) => { const [m, s] = mmss.split(':').map(Number); return m * 60 + s; };
const sheetPressed = (p) => p.evaluate(`[...document.querySelectorAll('[data-tag-set]')].map((li) => li.querySelector('[aria-pressed="true"]')?.dataset.tagChoice ?? (li.querySelector('[data-tag-not-ticked]') ? 'not-ticked' : null))`);
const slotSets = async (p, slotId) => (await v3(p)).currentCycle.slots[slotId]?.sets ?? null;
const shortDate = (p, iso, lang = 'en') => p.evaluate(`new Date(${JSON.stringify(iso)}).toLocaleDateString('${lang === 'en' ? 'en-GB' : 'zh-CN'}', { day: 'numeric', month: 'short' })`);
const openReport = (p) => tap(p, `document.querySelector('header button[title="View Weekly Report Card"]')`);
const startNewWeek = async (p) => {
  await openReport(p);
  await tap(p, `[...document.querySelectorAll('.fixed.inset-0 button')].find((b) => b.innerText.trim() === 'Start new week')`);
  await tap(p, `[...document.querySelectorAll('[role=alertdialog] button')].find((b) => b.innerText.trim() === 'Start new week')`);
  await sleep(400);
};
// Lets a test move the page's clock forward (the rest timer reads Date.now)
const CLOCK = `window.__timeOffset = 0; { const realNow = Date.now.bind(Date); Date.now = () => realNow() + window.__timeOffset; }`;
const STALE = `window.__blockSync = false;
  for (const [target, type] of [[window, 'storage'], [window, 'pageshow'], [document, 'visibilitychange']]) {
    target.addEventListener(type, (e) => { if (window.__blockSync) e.stopImmediatePropagation(); }, true);
  }`;
const seed = (p, entries) => p.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(entries)})) localStorage.setItem(k, v);`);

const chrome = await launchChrome(PORT, `profile-4-flows-${PORT}`);
try {
  // ================= A. tagging on a fresh start (360 px, EN, kg) =================
  const p = await chrome.newPage(360, 740);
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
  await p.goto(BASE);
  await seed(p, { language_preference: 'en', aesthetic_recomp_unit_v1: 'kg' });
  await p.reload(2500);
  check('A first week: no "last time" line on any of the 5 days', await allLastLineCounts(p), [0, 0, 0, 0, 0]);

  await setWeight(p, 0, 0, '60'); await setReps(p, 0, 0, '8');
  await setWeight(p, 0, 1, '62.5');
  await tickSet(p, 0, 0);
  check('A tick set 1: prompt asks about set 1 of Incline DB Press, timer running', [await prompt(p), !!(await timerText(p))], ['How did set 1 feel? · Incline DB Press', true]);
  const layout = await p.evaluate(`(() => {
    const card = document.querySelector('[data-tag-prompt]').getBoundingClientRect();
    const timer = document.querySelector('[data-rest-timer] .h-16').getBoundingClientRect();
    const tagBtn = getComputedStyle(document.querySelector('[data-tag-prompt-choice="max"]'));
    const skip = [...document.querySelectorAll('[data-rest-timer] button')].find((b) => b.innerText.trim() === 'Skip');
    const skipStyle = getComputedStyle(skip);
    const heights = [...document.querySelectorAll('[data-tag-prompt] button, [data-rest-timer] button')].map((b) => Math.round(b.getBoundingClientRect().height));
    return { gap: Math.round(timer.top - card.bottom), tag: [tagBtn.backgroundColor, tagBtn.borderTopWidth, parseFloat(tagBtn.borderTopLeftRadius) > 20], skip: [skipStyle.backgroundColor !== 'rgba(0, 0, 0, 0)', skipStyle.borderTopWidth, parseFloat(skipStyle.borderTopLeftRadius)], minHeight: Math.min(...heights), padding: document.querySelector('#root > div').style.paddingBottom, dock: Math.round(document.querySelector('[data-rest-bar]').getBoundingClientRect().height) };
  })()`);
  console.log('A prompt/timer layout:', JSON.stringify(layout));
  check('A prompt on its own line, 12px above the timer card (at least 8px)', layout.gap, 12);
  check('A tag buttons: no fill, 2px outline, pill; Skip: grey fill, no outline, 12px corners', [layout.tag, layout.skip], [['rgba(0, 0, 0, 0)', '2px', true], [true, '0px', 12]]);
  check('A every prompt/timer button at least 44px tall; page bottom room = dock height', [layout.minHeight >= 44, layout.padding], [true, `${layout.dock}px`]);

  await tickSet(p, 0, 1);
  check('A tick set 2 before answering: the prompt moves to set 2 (still one prompt)', [await prompt(p), await promptCount(p)], ['How did set 2 feel? · Incline DB Press', 1]);
  const before = seconds(await timerText(p));
  await tap(p, `document.querySelector('[data-tag-prompt-choice="max"]')`);
  await sleep(300);
  const afterTag = seconds(await timerText(p));
  check('A tap Max: prompt gone, set 2 shows MAX in its tick, saved; set 1 has no tag', [await promptCount(p), (await tickLabels(p, 0)).slice(0, 2), (await slotSets(p, 'incline-db-press'))[1].tag, 'tag' in (await slotSets(p, 'incline-db-press'))[0]],
    [0, ['Set 1 done', 'Set 2 done, Max [MAX]'], 'max', false]);
  check('A the tag tap left the timer alone (kept counting down, not restarted)', afterTag <= before && before - afterTag <= 2, true);
  await tap(p, `[...document.querySelectorAll('[data-rest-timer] button')].find((b) => b.innerText.trim() === '+15s')`);
  const plus = seconds(await timerText(p));
  check('A +15s still works next to the prompt-free dock', plus - afterTag >= 13 && plus - afterTag <= 15, true);

  await tickSet(p, 0, 2);
  check('A tick set 3: prompt for set 3', await prompt(p), 'How did set 3 feel? · Incline DB Press');
  await tap(p, `[...document.querySelectorAll('[data-rest-timer] button')].find((b) => b.innerText.trim() === 'Skip')`);
  check('A Skip: the timer goes, the prompt stays', [await timerText(p), await prompt(p)], [null, 'How did set 3 feel? · Incline DB Press']);
  const promptOnly = await p.evaluate(`[Math.round(document.querySelector('[data-rest-bar]').getBoundingClientRect().height), document.querySelector('#root > div').style.paddingBottom]`);
  check('A prompt alone: page bottom room = its height (98px)', promptOnly, [98, '98px']);
  await tap(p, `document.querySelector('[data-tag-prompt-dismiss]')`);
  check('A dismiss (×): prompt and dock gone, page bottom room removed, set 3 untagged', [await promptCount(p), await p.evaluate(`!!document.querySelector('[data-rest-bar]')`), await p.evaluate(`document.querySelector('#root > div').style.paddingBottom`), 'tag' in (await slotSets(p, 'incline-db-press'))[2]], [0, false, '', false]);

  // the rest running out on its own: the prompt stays through "Rest over" and after the bar closes
  await tickSet(p, 1, 0);
  check('A tick Lat Pulldown set 1: prompt for it', await prompt(p), 'How did set 1 feel? · Lat Pulldown');
  await p.evaluate(`window.__timeOffset = 200000`); await sleep(900);
  check('A rest over (green bar): prompt still there', [await p.evaluate(`document.querySelector('[data-rest-timer]')?.innerText.includes('Rest over') ?? false`), await prompt(p)], [true, 'How did set 1 feel? · Lat Pulldown']);
  await p.evaluate(`window.__timeOffset = 215000`); await sleep(900);
  check('A rest bar closed by itself: prompt still there, never lost', [await p.evaluate(`!!document.querySelector('[data-rest-timer]')`), await prompt(p)], [false, 'How did set 1 feel? · Lat Pulldown']);
  await tap(p, `document.querySelector('[data-tag-prompt-choice="good"]')`);
  check('A tagging after the rest ended still works', (await slotSets(p, 'lat-pulldown'))[0].tag, 'good');
  await p.evaluate(`window.__timeOffset = 0`);

  // the tag sheet (2 taps): set, change, clear
  await tap(p, `${CARD(0)}.querySelector('[data-tags-button]')`);
  check('A sheet: 3 sets, Set 2 = Max, others No tag; the 3 meanings shown', [await sheetPressed(p), await p.evaluate(`document.querySelector('[data-tag-help]').innerText.replace(/\\s+/g, ' ').trim()`)],
    [['none', 'max', 'none'], 'Easy: I could have done 3 or more extra reps Good: I had 1 to 2 reps left Max: I was at my limit, I could not do another rep / had to stop']);
  await tap(p, `document.querySelector('[data-tag-set="0"] [data-tag-choice="good"]')`);
  const s1 = (await slotSets(p, 'incline-db-press'))[0].tag;
  await tap(p, `document.querySelector('[data-tag-set="0"] [data-tag-choice="easy"]')`);
  const s2 = (await slotSets(p, 'incline-db-press'))[0].tag;
  await tap(p, `document.querySelector('[data-tag-set="1"] [data-tag-choice="none"]')`);
  const cleared = 'tag' in (await slotSets(p, 'incline-db-press'))[1];
  check('A sheet: set Good, change to Easy, clear Max (each saved)', [s1, s2, cleared, await sheetPressed(p)], ['good', 'easy', false, ['easy', 'none', 'none']]);
  await tap(p, `document.querySelector('[data-tag-set="1"] [data-tag-choice="max"]')`);
  await tap(p, `document.querySelector('[data-tag-sheet-done]')`);
  check('A sheet closed; tick buttons show Easy / Max / nothing', [await p.evaluate(`!!document.querySelector('[data-bottom-sheet]')`), await tickLabels(p, 0)], [false, ['Set 1 done, Easy [EASY]', 'Set 2 done, Max [MAX]', 'Set 3 done']]);

  // untick clears the tag, re-tick starts with none
  await tickSet(p, 0, 1);
  const unticked = (await slotSets(p, 'incline-db-press'))[1];
  check('A untick set 2 (Max): tag gone, typed 62.5 kept, no prompt', [unticked.done, 'tag' in unticked, unticked.weight, await promptCount(p)], [false, false, '62.5', 0]);
  await tickSet(p, 0, 1);
  check('A tick it again: no tag, prompt asks again', [(await tickLabels(p, 0))[1], 'tag' in (await slotSets(p, 'incline-db-press'))[1], await prompt(p)], ['Set 2 done', false, 'How did set 2 feel? · Incline DB Press']);
  await tickSet(p, 0, 1);
  check('A untick the set the prompt asks about: prompt closes', await promptCount(p), 0);
  await tap(p, `${CARD(2)}.querySelector('[data-tags-button]')`);
  check('A sheet of an exercise with nothing ticked: no tag buttons, "Tick this set first" on each set', [await p.evaluate(`document.querySelectorAll('[data-tag-choice]').length`), await sheetPressed(p)], [0, ['not-ticked', 'not-ticked', 'not-ticked']]);
  await p.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`); await sleep(400);
  await setWeight(p, 0, 0, '65');
  check('A editing the weight of a tagged set keeps the tag', [(await slotSets(p, 'incline-db-press'))[0].weight, (await slotSets(p, 'incline-db-press'))[0].tag], ['65', 'easy']);

  // Reset day takes the tags with the sets
  await tickSet(p, 1, 1);
  check('A prompt open before Reset day', await prompt(p), 'How did set 2 feel? · Lat Pulldown');
  await tap(p, `document.querySelector('button[aria-label="Reset Day"]')`);
  await tap(p, `[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Clear Current Day Progress')`);
  const afterReset = await v3(p);
  check('A Reset day: Day 1 sets (with their tags) gone, prompt gone, no tag on any tick', [Object.keys(afterReset.currentCycle.slots), await promptCount(p), (await tickLabels(p, 0)).concat(await tickLabels(p, 1))],
    [[], 0, ['Set 1 done', 'Set 2 done', 'Set 3 done', 'Set 1 done', 'Set 2 done', 'Set 3 done']]);
  check('A no page errors', p.errors, []);
  await chrome.closeTarget(p.targetId);

  // ================= B. weeks: tags carried into "last time" (recorded v2 data, migrated) =================
  const q = await chrome.newPage(360, 740);
  await q.goto(BASE);
  await seed(q, recorded);
  await q.reload(3000);
  const v2Original = await v2(q);
  check('B migrated week 1: no "last time" anywhere', await allLastLineCounts(q), [0, 0, 0, 0, 0]);
  await tap(q, `${CARD(0)}.querySelector('[data-tags-button]')`);
  await tap(q, `document.querySelector('[data-tag-set="0"] [data-tag-choice="good"]')`);
  await tap(q, `document.querySelector('[data-tag-set="1"] [data-tag-choice="max"]')`);
  await tap(q, `document.querySelector('[data-tag-sheet-done]')`);
  await tickSet(q, 0, 2);
  await tap(q, `document.querySelector('[data-tag-prompt-dismiss]')`);
  await day(q, 1);
  await tap(q, `${CARD(2)}.querySelector('[data-swap-button]')`);
  await tap(q, `document.querySelector('[data-swap-choice="smith-split-squat"]')`);
  await setWeight(q, 2, 0, '40'); await setReps(q, 2, 0, '10');
  await tickSet(q, 2, 0);
  await tap(q, `document.querySelector('[data-tag-prompt-choice="max"]')`);
  await day(q, 4);
  await setWeight(q, 2, 0, '140'); await setReps(q, 2, 0, '10');
  await tickSet(q, 2, 0);
  await tap(q, `document.querySelector('[data-tag-prompt-choice="easy"]')`);
  const week1 = await v3(q);
  await startNewWeek(q);
  const week2 = await v3(q);
  check('B Start new week: week 1 archived with its tags', [week2.archivedCycles.length, week2.archivedCycles[0].slots['incline-db-press'].sets[1].tag, week2.archivedCycles[0].slots['bulgarian-split-squat'].sets[0].tag, week2.archivedCycles[0].slots['leg-press-lower-b'].sets[0].tag, Object.keys(week2.currentCycle.slots)],
    [1, 'max', 'max', 'easy', []]);
  const oct2 = await shortDate(q, '2026-10-02T15:09:37.185Z');
  const today = await shortDate(q, new Date().toISOString());
  check('B week 2, Incline: last time per set, date once, Good / Max / done', await lastLinesBySet(q, 0), [`Last (${oct2}): 60 kg × 8 · Good`, 'Last: 62.5 kg × 6 · Max', 'Last: done']);
  check('B week 2, Incline: the calm Max marker (flag icon + word) only on set 2', await maxMarkers(q, 0), [false, true, false]);
  check('B week 2, Lat Pulldown (135 lbs typed): converted to kg like the report', await lastLinesBySet(q, 1), [`Last (${oct2}): 61.2 kg × 10`, null, null]);
  check('B week 2, exercises not done in week 1: nothing at all', [await lastLines(q, 2), await lastLines(q, 3)], [[], []]);
  await day(q, 1);
  check('B week 2, Day 2 Leg Press: its own slot from week 1', await lastLinesBySet(q, 0), [`Last (${oct2}): 100 kg × 5`, null, null]);
  check('B week 2, Bulgarian (Smith split squat was done instead): nothing', await lastLines(q, 2), []);
  await tap(q, `${CARD(2)}.querySelector('[data-swap-button]')`);
  await tap(q, `document.querySelector('[data-swap-choice="smith-split-squat"]')`);
  check('B swap to Smith split squat: its own history only', await lastLinesBySet(q, 2), [`Last (${today}): 40 kg × 10 · Max`, null, null]);
  await day(q, 4);
  check('B week 2, Day 5 Leg Press: its own slot', await lastLinesBySet(q, 2), [`Last (${today}): 140 kg × 10 · Easy`, null, null]);
  // units and language
  await day(q, 0);
  await tap(q, `${CARD(0)}.querySelector('button[aria-pressed][class*="min-w-10"]:not([aria-pressed="true"])')`);
  check('B lbs: Incline converted (60 -> 132.3, 62.5 -> 137.8), Lat Pulldown back to 135 as typed', [await lastLinesBySet(q, 0), await lastLinesBySet(q, 1)],
    [[`Last (${oct2}): 132.3 lbs × 8 · Good`, 'Last: 137.8 lbs × 6 · Max', 'Last: done'], [`Last (${oct2}): 135 lbs × 10`, null, null]]);
  await q.evaluate(`[...document.querySelectorAll('header button')].find((b) => b.innerText.trim() === '中文').click()`); await sleep(500);
  const oct2zh = await shortDate(q, '2026-10-02T15:09:37.185Z', 'zh');
  check('B 中文 + lbs', [await lastLinesBySet(q, 0), await lastLinesBySet(q, 1)],
    [[`上次（${oct2zh}）：132.3 lbs × 8 · 刚好`, '上次：137.8 lbs × 6 · 极限', '上次：已完成'], [`上次（${oct2zh}）：135 lbs × 10`, null, null]]);
  await tap(q, `${CARD(0)}.querySelector('button[aria-pressed][class*="min-w-10"]:not([aria-pressed="true"])')`);
  check('B 中文 + kg', await lastLinesBySet(q, 0), [`上次（${oct2zh}）：60 kg × 8 · 刚好`, '上次：62.5 kg × 6 · 极限', '上次：已完成']);
  check('B 中文 tick labels and best badge', [await tickLabels(q, 0), await q.evaluate(`(${CARD(0)}.innerText.match(/最佳[^\\n]*/) || [null])[0]`)], [['第 1 组 已完成', '第 2 组 已完成', '第 3 组 已完成'], '最佳: 62.5 kg × 6次']);
  await q.evaluate(`[...document.querySelectorAll('header button')].find((b) => b.innerText.trim() === 'EN').click()`); await sleep(500);
  // week 2: Lat Pulldown and Day 2 Leg Press only (no Incline, no Day 5 Leg Press)
  await setWeight(q, 1, 0, '55'); await setReps(q, 1, 0, '10');
  await tickSet(q, 1, 0);
  await tap(q, `document.querySelector('[data-tag-prompt-dismiss]')`);
  await day(q, 1);
  await setWeight(q, 0, 0, '160'); await setReps(q, 0, 0, '8');
  await tickSet(q, 0, 0);
  await tap(q, `document.querySelector('[data-tag-prompt-choice="max"]')`);
  await startNewWeek(q);
  check('B week 3: Incline was skipped in week 2, so week 1 is found', await lastLinesBySet(q, 0), [`Last (${oct2}): 60 kg × 8 · Good`, 'Last: 62.5 kg × 6 · Max', 'Last: done']);
  check('B week 3: Lat Pulldown from week 2', await lastLinesBySet(q, 1), [`Last (${today}): 55 kg × 10`, null, null]);
  await day(q, 4);
  check('B week 3, Day 5 Leg Press: not done in week 2, Day 2 was -> that one (newest week first)', await lastLinesBySet(q, 2), [`Last (${today}): 160 kg × 8 · Max`, null, null]);
  await day(q, 1);
  check('B week 3, Smith split squat is not swapped in this week: Bulgarian card shows nothing', await lastLines(q, 2), []);
  check('B tags never touched the bests (Incline best still 62.5 x 6)', (await v3(q)).bests['incline-db-press'], { weight: '62.5', reps: '6', unit: 'kg' });
  check('B v2 keys byte-for-byte unchanged', await v2(q), v2Original);
  check('B no page errors', q.errors, []);
  writeFileSync(`${SCRATCH}/4-flows-week1.json`, JSON.stringify(week1));
  await chrome.closeTarget(q.targetId);

  // ================= C. stale tab: another tab tags a set, this tab acts =================
  const start = { schemaVersion: 3, currentCycle: { id: 'w', startedAt: '2026-10-05T06:00:00.000Z', slots: { 'incline-db-press': slot('incline-db-press', { 0: set('60', '8'), 1: set('62.5', '6') }) } }, archivedCycles: [], bests: {}, reportShownCycleIds: [] };
  const b = await chrome.newPage(360, 740);
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: STALE });
  await b.goto(BASE);
  await seed(b, { language_preference: 'en', aesthetic_recomp_unit_v1: 'kg', [V3]: JSON.stringify(start) });
  await b.reload(2500);
  await b.evaluate(`window.__blockSync = true`); // this tab never hears about the other tab (like a phone asleep)
  const a = await chrome.newPage(360, 740);
  await a.goto(BASE); await sleep(500);
  await tap(a, `${CARD(0)}.querySelector('[data-tags-button]')`);
  await tap(a, `document.querySelector('[data-tag-set="0"] [data-tag-choice="max"]')`);
  await sleep(400);
  check('C other tab tagged set 1 Max (saved)', (await v3(a)).currentCycle.slots['incline-db-press'].sets[0].tag, 'max');
  await chrome.closeTarget(a.targetId);
  check('C this tab still shows set 1 without a tag (stale)', (await tickLabels(b, 0))[0], 'Set 1 done');
  await tap(b, `${CARD(0)}.querySelector('[data-tags-button]')`);
  await tap(b, `document.querySelector('[data-tag-set="1"] [data-tag-choice="easy"]')`);
  await sleep(500);
  const staleSaved = await v3(b);
  check('C this tab tags set 2: the other tab\'s Max is kept, this change is dropped, notice shown',
    [staleSaved.currentCycle.slots['incline-db-press'].sets[0].tag, 'tag' in staleSaved.currentCycle.slots['incline-db-press'].sets[1], await b.evaluate(`document.querySelector('[data-tab-notice]')?.innerText.trim()`)],
    ['max', false, "Updated from another tab. Your last change here wasn't saved."]);
  await tap(b, `document.querySelector('[data-tag-sheet-done]')`);
  check('C this tab now shows the other tab\'s tag; ticks and typed values kept', [await tickLabels(b, 0), staleSaved.currentCycle.slots['incline-db-press'].sets[1].weight], [['Set 1 done, Max [MAX]', 'Set 2 done', 'Set 3 done'], '62.5']);
  check('C no page errors', b.errors, []);
  await chrome.closeTarget(b.targetId);

  // ================= D. backup and restore round trip with tags =================
  rmSync(DL, { recursive: true, force: true }); mkdirSync(DL, { recursive: true });
  const withTags = historyData();
  withTags.currentCycle.slots['incline-db-press'] = slot('incline-db-press', { 0: set('60', '10', { tag: 'good' }), 1: set('62.5', '8', { tag: 'max' }) });
  const d = await chrome.newPage(360, 740);
  await d.send('Page.setInterceptFileChooserDialog', { enabled: true });
  await d.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL.replace(/\//g, '\\') });
  await d.goto(BASE);
  await seed(d, { language_preference: 'en', aesthetic_recomp_unit_v1: 'kg', [V3]: JSON.stringify(withTags) });
  await d.reload(2500);
  const savedBefore = await d.evaluate(`localStorage.getItem('${V3}')`);
  const SECTION = `document.querySelector('section[aria-labelledby="data-section-title"]')`;
  const buttonIn = (root, text) => `[...${root}.querySelectorAll('button')].find((el) => el.innerText.trim() === ${JSON.stringify(text)})`;
  await tap(d, `document.querySelector('header button[title^="About"]')`);
  await tap(d, buttonIn(SECTION, 'Back up my data'));
  let files = [];
  for (let i = 0; i < 50 && !(files = readdirSync(DL).filter((f) => f.endsWith('.json'))).length; i++) await sleep(100);
  const backup = JSON.parse(readFileSync(`${DL}/${files[0]}`, 'utf8'));
  const tagsIn = (data) => [data.currentCycle, ...data.archivedCycles].flatMap((c) => Object.values(c.slots).flatMap((s) => Object.entries(s.sets).filter(([, x]) => x.tag).map(([i, x]) => `${c.id}/${s.slotId}/${i}=${x.tag}`))).sort();
  // A backup always carries the notes and the body measurements (empty when there are none; step 6)
  check('D backup file holds every tag (current + past weeks), exactly the saved data', [tagsIn(backup.data).length, JSON.stringify(backup.data) === JSON.stringify({ ...JSON.parse(savedBefore), remarks: {}, body: { entries: {} } })], [9, true]);
  await d.evaluate(`[...document.querySelectorAll('.fixed.inset-0 button')].find((el) => el.innerText.trim() === 'Close').click()`); await sleep(300);
  await tap(d, `${CARD(0)}.querySelector('[data-tags-button]')`);
  await tap(d, `document.querySelector('[data-tag-set="1"] [data-tag-choice="easy"]')`);
  await tap(d, `document.querySelector('[data-tag-set="0"] [data-tag-choice="none"]')`);
  await tap(d, `document.querySelector('[data-tag-sheet-done]')`);
  check('D changed after the backup', await tickLabels(d, 0), ['Set 1 done', 'Set 2 done, Easy [EASY]', 'Set 3 done']);
  await tap(d, `document.querySelector('header button[title^="About"]')`);
  const opened = new Promise((resolve) => d.onEvent((m) => m.method === 'Page.fileChooserOpened' && resolve(m.params)));
  await tap(d, buttonIn(SECTION, 'Restore from backup'));
  const { backendNodeId } = await opened;
  await d.send('DOM.setFileInputFiles', { files: [`${DL}/${files[0]}`.replace(/\//g, '\\')], backendNodeId });
  await sleep(600);
  await tap(d, buttonIn(`document.querySelector('[aria-labelledby="restore-confirm-title"]')`, 'Replace my data'));
  const restored = await v3(d);
  check('D restored: every tag back, data equal to the backup', [tagsIn(restored), JSON.stringify(restored) === JSON.stringify(JSON.parse(savedBefore))], [tagsIn(backup.data), true]);
  await d.evaluate(`[...document.querySelectorAll('.fixed.inset-0 button')].find((el) => el.innerText.trim() === 'Close').click()`); await sleep(300);
  check('D restored tags on screen, last time unchanged', [await tickLabels(d, 0), await lastLinesBySet(d, 0)],
    [['Set 1 done, Good [GOOD]', 'Set 2 done, Max [MAX]', 'Set 3 done'], [`Last (${await shortDate(d, '2026-09-14T17:40:00.000Z')}): 60 kg × 12 · Easy`, 'Last: 62.5 kg × 10 · Good', 'Last: 65 kg × 8 · Max']]);
  check('D no page errors', d.errors, []);
  await chrome.closeTarget(d.targetId);

  // ================= E. a tag an older version left on an unticked set =================
  const old = { schemaVersion: 3, currentCycle: { id: 'w', startedAt: '2026-10-05T06:00:00.000Z', slots: { 'incline-db-press': slot('incline-db-press', { 0: set('60', '8', { done: false, tag: 'max', updatedAt: '2026-10-05T07:00:00.000Z' }), 1: set('', '', { done: false, tag: 'easy' }) }) } }, archivedCycles: [], bests: {}, reportShownCycleIds: [] };
  const e = await chrome.newPage(360, 740);
  await e.goto(BASE);
  await seed(e, { language_preference: 'en', aesthetic_recomp_unit_v1: 'kg', [V3]: JSON.stringify(old) });
  await e.reload(2500);
  check('E loaded: no tag shown on the unticked sets; nothing written on load', [await tickLabels(e, 0), await e.evaluate(`localStorage.getItem('${V3}')`) === JSON.stringify(old), await e.evaluate(`localStorage.getItem('aesthetic_recomp_backup_aesthetic_recomp_v3_raw')`)],
    [['Set 1 done', 'Set 2 done', 'Set 3 done'], true, null]);
  await tickSet(e, 0, 0);
  await sleep(400);
  const cleaned = (await v3(e)).currentCycle.slots['incline-db-press'].sets;
  check('E tick set 1: starts with no tag (prompt asks); the next save also drops set 2\'s leftover tag', [(await tickLabels(e, 0))[0], await prompt(e), cleaned[0], cleaned[1]],
    ['Set 1 done', 'How did set 1 feel? · Incline DB Press', { weight: '60', reps: '8', unit: 'kg', done: true, updatedAt: '2026-10-05T07:00:00.000Z' }, { weight: '', reps: '', unit: 'kg', done: false }]);
  check('E no page errors', e.errors, []);
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
