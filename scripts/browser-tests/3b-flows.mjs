// Step 3B: swap button + note editor with real taps. Usage: node 3b-flows.mjs [baseUrl] [port]
import { readFileSync } from 'node:fs';
import { launchChrome, SCRATCH, sleep, FIXTURES, APP } from './cdp.mjs';

const BASE = process.argv[2] ?? APP;
const PORT = Number(process.argv[3] ?? 9430);
const V3 = 'aesthetic_recomp_v3';
const V2_KEYS = ['aesthetic_recomp_completed_sets_v2', 'aesthetic_recomp_set_details_v2', 'aesthetic_recomp_previous_bests_v2'];
const recorded = { ...JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8')), language_preference: 'en', aesthetic_recomp_unit_v1: 'kg' };
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)?.slice(0, 300)}, expected ${JSON.stringify(expected)?.slice(0, 300)})`}`);
};
const tapAt = async (p, x, y) => {
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  await sleep(400);
};
const tap = async (p, elJs) => {
  await p.send('Page.bringToFront');
  const r = await p.evaluate(`(() => { const el = ${elJs}; if (!el) throw new Error('not found: ' + ${JSON.stringify(elJs)}); el.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  await tapAt(p, r.x, r.y);
};
const v3 = (p) => p.evaluate(`JSON.parse(localStorage.getItem('${V3}'))`);
const day = async (p, i) => { await p.evaluate(`document.querySelectorAll('nav button')[${i}].click()`); await sleep(400); };
// The card of a slot on the active day, by its position (0-based)
const CARD = (i) => `(() => { const rows = [...document.querySelectorAll('main [data-exercise-actions]')]; if (!rows[${i}]) throw new Error('card ${i} missing: ' + rows.length + ' rows, sheet open: ' + !!document.querySelector('[data-bottom-sheet]')); return rows[${i}].closest('.rounded-2xl'); })()`;
const cardInfo = (p, i) => p.evaluate(`(() => { const c = ${CARD(i)}; return { name: c.querySelector('h3').innerText.trim(), swap: c.querySelector('[data-swap-button]')?.innerText.trim() ?? null, note: c.querySelector('[data-remark-row]').innerText.trim(), noVideo: !!c.querySelector('[data-no-video]'), cue: !!c.querySelector('[aria-expanded] .italic'), prev: (c.innerText.match(/Prev[^\\n]*|上次[^\\n]*/) || [null])[0] }; })()`);
const sheet = (p) => p.evaluate(`document.querySelector('[data-bottom-sheet]')?.innerText.replace(/\\n+/g, ' | ') ?? null`);
const choose = (p, id) => tap(p, `document.querySelector('[data-swap-choice="${id}"]')`);
const setWeight = async (p, cardIndex, setIndex, value) => {
  await p.evaluate(`(() => { const el = ${CARD(cardIndex)}.querySelectorAll('[data-set-row] input')[${setIndex * 2}]; el.scrollIntoView({ block: 'center' }); el.focus(); el.select(); })()`);
  for (const ch of value) { await p.send('Input.insertText', { text: ch }); await sleep(30); }
  await p.evaluate(`document.activeElement.blur()`); await sleep(400);
};
const tickSet = (p, cardIndex, setIndex) => tap(p, `${CARD(cardIndex)}.querySelectorAll('[data-set-row] button[aria-pressed]')[${setIndex}]`);
const openNote = (p, i) => tap(p, `${CARD(i)}.querySelector('[data-remark-row]')`);
const typeNote = async (p, text) => {
  await p.evaluate(`(() => { const box = document.querySelector('[data-remark-input]'); box.focus(); box.select(); })()`);
  await p.send('Input.insertText', { text });
  await sleep(200);
};
const STALE = `window.__blockSync = false;
  for (const [target, type] of [[window, 'storage'], [window, 'pageshow'], [document, 'visibilitychange']]) {
    target.addEventListener(type, (e) => { if (window.__blockSync) e.stopImmediatePropagation(); }, true);
  }`;

const chrome = await launchChrome(PORT, `profile-3b-flows-${PORT}`);
try {
  const p = await chrome.newPage(360, 740);
  await p.goto(BASE);
  await p.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(recorded)})) localStorage.setItem(k, v);`);
  await p.reload(3500);
  const v2Original = await p.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`);
  await day(p, 1); // Day 2: Leg Press (has 1 recorded tick), RDL, Bulgarian, Leg Curl, Calf
  check('Day 2: swap buttons only on slots with an alternative (not RDL)', await p.evaluate(`[...document.querySelectorAll('main [data-exercise-actions]')].map((r) => !!r.querySelector('[data-swap-button]'))`), [true, false, true, true, true]);

  // ---------- blocked by a ticked set (the recorded data has Leg Press set 1 ticked) ----------
  await tap(p, `${CARD(0)}.querySelector('[data-swap-button]')`);
  check('blocked: message shown, both choices unavailable', [await p.evaluate(`document.querySelector('[data-swap-message]')?.innerText.trim()`), await p.evaluate(`[...document.querySelectorAll('[data-swap-choice]')].map((b) => b.disabled)`)],
    ['You already ticked sets on this exercise this week. Untick them first.', [true, true]]);
  const beforeBlocked = await p.evaluate(`localStorage.getItem('${V3}')`);
  await choose(p, 'hack-squat'); // a disabled button: nothing happens
  check('blocked: nothing saved, still Leg Press', [await p.evaluate(`localStorage.getItem('${V3}')`) === beforeBlocked, (await cardInfo(p, 0)).name], [true, 'Leg Press']);
  // Escape closes it
  await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(300);
  check('Escape closes the chooser; page scroll lock released', [await sheet(p), await p.evaluate(`document.body.style.overflow + '|' + document.documentElement.style.overflow`)], [null, '|']);

  // ---------- swap with no data (Bulgarian split squat), and the tap-outside close ----------
  await tap(p, `${CARD(2)}.querySelector('[data-swap-button]')`);
  console.log('chooser:', await sheet(p));
  await tapAt(p, 180, 60); // the dimmed page above the sheet
  check('tap outside closes the chooser, nothing changed', [await sheet(p), (await cardInfo(p, 2)).name], [null, 'Bulgarian Split Squat']);
  await tap(p, `${CARD(2)}.querySelector('[data-swap-button]')`);
  await choose(p, 'smith-split-squat');
  const swapped = await cardInfo(p, 2);
  check('swap with no data: name, amber "Swapped", no-video placeholder, no empty cue row', [swapped.name, swapped.swap, swapped.noVideo, swapped.cue], ['Smith Split Squat', 'Swapped', true, false]);
  check('saved straight away', (await v3(p)).currentCycle.slots['bulgarian-split-squat'], { slotId: 'bulgarian-split-squat', exerciseId: 'bulgarian-split-squat', performedExerciseId: 'smith-split-squat', sets: {} });

  // ---------- swap back ----------
  await tap(p, `${CARD(2)}.querySelector('[data-swap-button]')`);
  check('the way back is offered by name', (await sheet(p)).includes('Switch back to Bulgarian Split Squat'), true);
  await choose(p, 'bulgarian-split-squat');
  check('swap back: the program exercise again, the slot as if never touched', [(await cardInfo(p, 2)).swap, (await v3(p)).currentCycle.slots['bulgarian-split-squat']], ['Swap', undefined]);

  // ---------- typed values: confirm (cancel first) ----------
  await setWeight(p, 3, 0, '45'); // Seated Leg Curl, typed but not ticked
  await tap(p, `${CARD(3)}.querySelector('[data-swap-button]')`);
  await choose(p, 'lying-leg-curl');
  check('typed values: a confirm step first', await p.evaluate(`document.querySelector('[data-swap-confirm]')?.innerText.split('\\n')[0]`), 'Weights and reps you typed for this exercise will be cleared.');
  await tap(p, `[...document.querySelectorAll('[data-swap-confirm] button')].find((b) => b.innerText.trim() === 'Cancel')`);
  await tap(p, `document.querySelector('[data-bottom-sheet] button[aria-label="Close"]')`);
  check('cancel: nothing changed (typed weight kept, still Seated Leg Curl)', [(await cardInfo(p, 3)).name, (await v3(p)).currentCycle.slots['seated-leg-curl'].sets[0].weight], ['Seated Leg Curl', '45']);
  await tap(p, `${CARD(3)}.querySelector('[data-swap-button]')`);
  await choose(p, 'lying-leg-curl');
  await tap(p, `[...document.querySelectorAll('[data-swap-confirm] button')].find((b) => b.innerText.trim() === 'Swap and clear')`);
  check('confirm: swapped, typed values cleared', [(await cardInfo(p, 3)).name, (await v3(p)).currentCycle.slots['seated-leg-curl'].sets], ['Lying Leg Curl', {}]);

  // ---------- the rest-timer bar stays usable while the chooser is open; scroll lock without a jump ----------
  await tickSet(p, 3, 0); // starts a rest
  // (the test's own scroll first, so only the chooser itself can move anything)
  await p.evaluate(`${CARD(4)}.querySelector('[data-swap-button]').scrollIntoView({ block: 'center', behavior: 'instant' })`);
  const yBefore = await p.evaluate(`[window.scrollY, Math.round(${CARD(3)}.getBoundingClientRect().top)]`);
  await tap(p, `${CARD(4)}.querySelector('[data-swap-button]')`);
  const yOpen = await p.evaluate(`[window.scrollY, Math.round(${CARD(3)}.getBoundingClientRect().top)]`);
  // the visible countdown is the last "mm:ss" in the bar (the first is the screen reader's "Rest started")
  const countdown = () => p.evaluate(`document.querySelector('[data-rest-bar]')?.innerText.match(/[0-9]+:[0-9]+/g)?.at(-1)`);
  const restBefore = await countdown();
  await tap(p, `[...document.querySelectorAll('[data-rest-bar] button')].find((b) => b.innerText.trim() === '+15s')`);
  const restAfter = await countdown();
  const toSeconds = (t) => t.split(':').reduce((m, s) => m * 60 + Number(s), 0);
  check('rest bar usable while the chooser is open (+15s works, chooser stays open)', [toSeconds(restAfter) - toSeconds(restBefore) >= 13, !!(await sheet(p))], [true, true]);
  check('opening the chooser moves nothing on the page', yOpen, yBefore);
  await tap(p, `document.querySelector('[data-bottom-sheet] button[aria-label="Close"]')`);
  await p.evaluate(`[...document.querySelectorAll('[data-rest-bar] button')].find((b) => b.innerText.trim() === 'Skip')?.click()`); await sleep(300);

  // ---------- back gesture closes the sheet and never leaves the page ----------
  const url = await p.evaluate(`location.href`);
  await tap(p, `${CARD(4)}.querySelector('[data-swap-button]')`);
  await p.evaluate(`history.back()`); await sleep(600);
  check('back gesture closes the chooser and stays on the page', [await sheet(p), await p.evaluate(`location.href`), (await cardInfo(p, 4)).name], [null, url, 'Standing Calf Raises']);
  await openNote(p, 4);
  await tap(p, `document.querySelector('[data-bottom-sheet] button[aria-label="Close"]')`);
  await sleep(400);
  check('after closing with a button, history is back to the page (no leftover entry)', await p.evaluate(`!!history.state?.bottomSheet`), false);
  await openNote(p, 4);
  await p.evaluate(`history.back()`); await sleep(600);
  check('back gesture closes the note editor too', [await sheet(p), await p.evaluate(`location.href`)], [null, url]);

  // ---------- notes ----------
  await openNote(p, 0);
  // measured with the editor open, so only typing could move the row
  const rowBefore = await p.evaluate(`JSON.stringify(${CARD(0)}.querySelector('[data-remark-row]').getBoundingClientRect())`);
  await typeNote(p, 'Seat 4, pads 2');
  const rowWhileTyping = await p.evaluate(`JSON.stringify(${CARD(0)}.querySelector('[data-remark-row]').getBoundingClientRect())`);
  check('the note row does not move or change while typing', [rowWhileTyping === rowBefore, (await cardInfo(p, 0)).note], [true, 'Add a note (seat height, incline holes…)']);
  await tap(p, `document.querySelector('[data-remark-save]')`);
  check('add: saved right away and shown', [(await cardInfo(p, 0)).note, (await v3(p)).remarks], ['Seat 4, pads 2', { 'leg-press': 'Seat 4, pads 2' }]);
  await openNote(p, 0);
  await typeNote(p, 'Seat 5\nPads 2\nFeet high\nEXTRA\nMORE');
  check('3 lines at most: extra lines joined', await p.evaluate(`document.querySelector('[data-remark-input]').value`), 'Seat 5\nPads 2\nFeet high EXTRA MORE');
  await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  check('Enter on the 3rd line adds no 4th line', await p.evaluate(`document.querySelector('[data-remark-input]').value.split('\\n').length`), 3);
  await tap(p, `document.querySelector('[data-remark-save]')`);
  check('edit: the row shows it on one line', (await cardInfo(p, 0)).note, 'Seat 5 · Pads 2 · Feet high EXTRA MORE');
  await openNote(p, 0);
  await typeNote(p, 'x'.repeat(250));
  check('200 characters at most (counter 200/200)', [await p.evaluate(`document.querySelector('[data-remark-input]').value.length`), await p.evaluate(`document.querySelector('[data-remark-counter]').innerText`)], [200, '200/200']);
  await tap(p, `[...document.querySelectorAll('[data-bottom-sheet] button')].find((b) => b.innerText.trim() === 'Cancel')`);
  check('cancel keeps the saved note', (await v3(p)).remarks['leg-press'], 'Seat 5\nPads 2\nFeet high EXTRA MORE');
  await day(p, 4); // Day 5: RDL, Leg Curl, Leg Press, Leg Ext, Back Ext
  check('Day 5 Leg Press shows the same note (shared)', (await cardInfo(p, 2)).note, 'Seat 5 · Pads 2 · Feet high EXTRA MORE');
  await tap(p, `${CARD(2)}.querySelector('[data-swap-button]')`);
  await choose(p, 'hack-squat');
  check('swapped to Hack Squat: its own (empty) note, Leg Press note kept', [(await cardInfo(p, 2)).note, (await v3(p)).remarks['leg-press']], ['Add a note (seat height, incline holes…)', 'Seat 5\nPads 2\nFeet high EXTRA MORE']);
  await openNote(p, 2);
  check('editor title names the exercise done', await p.evaluate(`document.getElementById('remark-sheet-title').innerText`), 'Note for Hack Squat');
  await typeNote(p, 'Shoulder pads 2');
  await tap(p, `document.querySelector('[data-remark-save]')`);
  check('separate notes per version', (await v3(p)).remarks, { 'leg-press': 'Seat 5\nPads 2\nFeet high EXTRA MORE', 'hack-squat': 'Shoulder pads 2' });

  // ---------- Prev best of the exercise done; kg / lbs ----------
  await setWeight(p, 2, 0, '150');
  await p.evaluate(`(() => { const el = ${CARD(2)}.querySelectorAll('[data-set-row] input')[1]; el.focus(); el.select(); })()`);
  await p.send('Input.insertText', { text: '10' }); await p.evaluate(`document.activeElement.blur()`); await sleep(300);
  await tickSet(p, 2, 0);
  await p.reload(3000);
  await day(p, 4);
  check('Prev on the swapped card is Hack Squat\'s own best', (await cardInfo(p, 2)).prev, 'Prev: 150 kg × 10');
  await day(p, 1);
  check('Day 2 Leg Press keeps Leg Press\'s best', (await cardInfo(p, 0)).prev?.startsWith('Prev: 100 kg'), true);
  await p.evaluate(`[...document.querySelectorAll('main button')].find((b) => b.innerText.trim() === 'lbs').click()`); await sleep(400);
  await day(p, 4);
  check('lbs: the swapped card\'s best shown in lbs; saved data unchanged', [(await cardInfo(p, 2)).prev, (await v3(p)).bests['hack-squat']], ['Prev: 330.7 lbs × 10', { weight: '150', reps: '10', unit: 'kg' }]);
  await p.evaluate(`[...document.querySelectorAll('main button')].find((b) => b.innerText.trim() === 'kg').click()`); await sleep(300);

  // ---------- reload keeps everything; 中文 ----------
  check('reload keeps notes and swaps', [(await cardInfo(p, 2)).name, (await cardInfo(p, 2)).note, (await cardInfo(p, 1)).name], ['Hack Squat', 'Shoulder pads 2', 'Lying Leg Curl'].slice(0, 2).concat(['Seated Leg Curl']));
  await p.evaluate(`[...document.querySelectorAll('header button')].find((b) => b.innerText.trim() === '中文').click()`); await sleep(400);
  const zh = await cardInfo(p, 2);
  check('中文: alternative name, "已替换", note', [zh.name, zh.swap, zh.note], ['哈克深蹲', '已替换', 'Shoulder pads 2']);
  check('中文: placeholder on an empty note', (await cardInfo(p, 0)).note, '添加备注（座椅高度、上斜孔位…）');
  await tap(p, `${CARD(2)}.querySelector('[data-swap-button]')`);
  check('中文 chooser: blocked by the tick, way back named', [await p.evaluate(`document.querySelector('[data-swap-message]')?.innerText.trim()`), (await sheet(p)).includes('换回倒蹬机 Leg Press') || (await sheet(p)).includes('换回')],
    ['本周您已在这个动作上打勾完成了组数。请先取消打勾。', true]);
  await p.evaluate(`history.back()`); await sleep(500);
  await p.evaluate(`[...document.querySelectorAll('header button')].find((b) => b.innerText.trim() === 'EN').click()`); await sleep(300);

  // ---------- new week and Reset day return slots to the default ----------
  await day(p, 1);
  await tap(p, `${CARD(2)}.querySelector('[data-swap-button]')`);
  await choose(p, 'smith-split-squat');
  await tap(p, `document.querySelector('button[title="Clear or Reset Workout Progress"]')`);
  await tap(p, `[...document.querySelector('[aria-labelledby="reset-modal-title"]').querySelectorAll('button')][1]`); // reset this day
  check('Reset day: Day 2 back to the program exercises; notes untouched', [(await cardInfo(p, 2)).name, (await cardInfo(p, 3)).name, Object.keys((await v3(p)).remarks).sort()], ['Bulgarian Split Squat', 'Seated Leg Curl', ['hack-squat', 'leg-press']]);
  await day(p, 4);
  check('Day 5 swap untouched by resetting Day 2', (await cardInfo(p, 2)).name, 'Hack Squat');
  await tap(p, `document.querySelector('button[title="View Weekly Report Card"]')`);
  await tap(p, `[...document.querySelectorAll('.fixed.inset-0 button')].find((b) => b.innerText.trim() === 'Start new week')`);
  await tap(p, `[...document.querySelector('[role="alertdialog"]').querySelectorAll('button')].find((b) => b.innerText.trim() === 'Start new week')`);
  await day(p, 4);
  check('new week: back to Leg Press (its note shows again); the old week keeps Hack Squat', [(await cardInfo(p, 2)).name, (await cardInfo(p, 2)).note, (await v3(p)).archivedCycles.at(-1).slots['leg-press-lower-b'].performedExerciseId],
    ['Leg Press', 'Seat 5 · Pads 2 · Feet high EXTRA MORE', 'hack-squat']);
  await openNote(p, 2);
  await typeNote(p, '   ');
  await tap(p, `document.querySelector('[data-remark-save]')`);
  check('delete by saving empty text (no extra confirm)', [(await cardInfo(p, 2)).note, (await v3(p)).remarks], ['Add a note (seat height, incline holes…)', { 'hack-squat': 'Shoulder pads 2' }]);
  check('v2 keys byte-for-byte unchanged', await p.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`), v2Original);
  check('no page errors', p.errors, []);
  await chrome.closeTarget(p.targetId);

  // ---------- stale tab: another tab swaps and saves a note, then this tab acts ----------
  const fresh = { schemaVersion: 3, currentCycle: { id: 'w1', startedAt: '2026-10-05T06:00:00.000Z', slots: {} }, archivedCycles: [], bests: {}, reportShownCycleIds: [] };
  const b = await chrome.newPage(360, 740);
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: STALE });
  await b.goto(BASE);
  await b.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg'); localStorage.setItem('${V3}', ${JSON.stringify(JSON.stringify(fresh))});`);
  await b.reload(3000);
  await b.evaluate(`window.__blockSync = true`);
  await day(b, 1);
  const other = { ...fresh, currentCycle: { ...fresh.currentCycle, slots: { 'seated-leg-curl': { slotId: 'seated-leg-curl', exerciseId: 'seated-leg-curl', performedExerciseId: 'lying-leg-curl', sets: {} } } }, remarks: { 'lying-leg-curl': 'pad above ankles' } };
  const a = await chrome.newPage(360, 740);
  await a.goto(BASE);
  await a.evaluate(`localStorage.setItem('${V3}', ${JSON.stringify(JSON.stringify(other))})`);
  await chrome.closeTarget(a.targetId);
  // B (stale) swaps Leg Press
  await tap(b, `${CARD(0)}.querySelector('[data-swap-button]')`);
  await choose(b, 'hack-squat');
  const afterB = await v3(b);
  check('stale tab swap: its swap saved AND the other tab\'s swap + note kept; notice shown',
    [afterB.currentCycle.slots['leg-press']?.performedExerciseId, afterB.currentCycle.slots['seated-leg-curl']?.performedExerciseId, afterB.remarks, await b.evaluate(`document.querySelector('[data-tab-notice]')?.innerText.trim()`)],
    ['hack-squat', 'lying-leg-curl', { 'lying-leg-curl': 'pad above ankles' }, 'Updated with newer data from another tab.']);
  check('the stale tab now shows the other tab\'s swap', (await cardInfo(b, 3)).name, 'Lying Leg Curl');
  await b.evaluate(`document.querySelector('[data-tab-notice] button').click()`);
  // the other tab changes again: a note and a swap of the slot B is about to swap
  const other2 = { ...afterB, currentCycle: { ...afterB.currentCycle, slots: { ...afterB.currentCycle.slots, 'standing-calf-raises': { slotId: 'standing-calf-raises', exerciseId: 'standing-calf-raises', performedExerciseId: 'seated-calf-raise', sets: {} } } }, remarks: { ...afterB.remarks, 'leg-press': 'seat 4' } };
  const a2 = await chrome.newPage(360, 740);
  await a2.goto(BASE);
  await a2.evaluate(`localStorage.setItem('${V3}', ${JSON.stringify(JSON.stringify(other2))})`);
  await chrome.closeTarget(a2.targetId);
  await tap(b, `${CARD(4)}.querySelector('[data-swap-button]')`); // B still shows Standing Calf Raises
  await choose(b, 'seated-calf-raise');
  check('stale tab, slot already swapped elsewhere: chooser closes, notice, newest data shown', [await sheet(b), await b.evaluate(`document.querySelector('[data-tab-notice]')?.innerText.trim()`), (await cardInfo(b, 4)).name],
    [null, 'Updated with newer data from another tab.', 'Seated Calf Raise']);
  await b.evaluate(`document.querySelector('[data-tab-notice] button').click()`);
  const a3 = await chrome.newPage(360, 740);
  await a3.goto(BASE);
  await a3.evaluate(`(() => { const d = JSON.parse(localStorage.getItem('${V3}')); d.remarks['bulgarian-split-squat'] = 'front foot 2 tiles'; localStorage.setItem('${V3}', JSON.stringify(d)); })()`);
  await chrome.closeTarget(a3.targetId);
  await openNote(b, 2);
  await typeNote(b, 'knee over toes');
  await tap(b, `document.querySelector('[data-remark-save]')`);
  check('stale tab note save: the other tab\'s note replaced by this deliberate save, all other notes kept, notice',
    [(await v3(b)).remarks, await b.evaluate(`document.querySelector('[data-tab-notice]')?.innerText.trim()`)],
    [{ 'lying-leg-curl': 'pad above ankles', 'leg-press': 'seat 4', 'bulgarian-split-squat': 'knee over toes' }, 'Updated with newer data from another tab.']);
  check('no page errors (stale tab)', b.errors, []);
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
