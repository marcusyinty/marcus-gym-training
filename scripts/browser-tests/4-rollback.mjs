// Step 4 rollback safety: data saved by step 4 (with tags) opened in the real v1.2.0 code (port 3001), used
// there, then opened in step 4 again (port 3000). Real taps.
import { launchChrome, sleep, APP } from './cdp.mjs';
import { historyData, set, slot } from './fixtures/seed.mjs';

const OLD = process.env.V120_URL ?? 'http://localhost:3001/';
const NEW = APP;
const V3 = 'aesthetic_recomp_v3';
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)?.slice(0, 400)}, expected ${JSON.stringify(expected)?.slice(0, 400)})`}`);
};
const tap = async (p, elJs) => {
  const r = await p.evaluate(`(() => { const el = ${elJs}; if (!el) throw new Error('not found: ' + ${JSON.stringify(elJs)}); el.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(450);
};
const v3 = (p) => p.evaluate(`JSON.parse(localStorage.getItem('${V3}'))`);
const tags = (data) => [data.currentCycle, ...data.archivedCycles].flatMap((c) => Object.values(c.slots).flatMap((s) => Object.entries(s.sets).filter(([, x]) => x.tag).map(([i, x]) => `${c.id}/${s.slotId}/${i}=${x.tag}${x.done ? '' : ' (unticked)'}`))).sort();
// v1.2.0 has no data-* hooks on cards: the Nth set row's inputs / tick button on the page
const ROWS = `[...document.querySelectorAll('main [data-set-row]')]`;

const data = historyData();
data.currentCycle.slots['incline-db-press'] = slot('incline-db-press', { 0: set('60', '10', { tag: 'good' }), 1: set('62.5', '8', { tag: 'max' }), 2: set('62.5', '7', { tag: 'easy' }) });
const chrome = await launchChrome(9455, 'profile-4-rollback');
try {
  const o = await chrome.newPage(360, 740);
  await o.goto(OLD);
  await o.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg'); localStorage.setItem('${V3}', ${JSON.stringify(JSON.stringify(data))});`);
  await o.reload(3000);
  check('v1.2.0 is what runs on 3001 (no note row, no tag button)', await o.evaluate(`[!!document.querySelector('[data-remark-row]'), !!document.querySelector('[data-tags-button]')]`), [false, false]);
  check('v1.2.0 loaded it without writing anything or making a repair copy', [await o.evaluate(`localStorage.getItem('${V3}')`) === JSON.stringify(data), await o.evaluate(`localStorage.getItem('aesthetic_recomp_backup_aesthetic_recomp_v3_raw')`)], [true, null]);
  const before = tags(data);

  // 1. edit the weight of a tagged set (set 2, Max)
  await o.evaluate(`(() => { const el = ${ROWS}[1].querySelector('input'); el.scrollIntoView({ block: 'center' }); el.focus(); el.select(); })()`);
  for (const ch of '65') { await o.send('Input.insertText', { text: ch }); await sleep(30); }
  await o.evaluate(`document.activeElement.blur()`); await sleep(600);
  let saved = await v3(o);
  check('v1.2.0 edit of a tagged set: saved, every tag kept (that set still Max)', [saved.currentCycle.slots['incline-db-press'].sets[1].weight, tags(saved)], ['65', before]);
  // 2. tick another exercise's set
  await tap(o, `${ROWS}[3].querySelector('button[aria-pressed]')`);
  await sleep(400);
  saved = await v3(o);
  check('v1.2.0 tick elsewhere: saved, every tag kept', [saved.currentCycle.slots['lat-pulldown'].sets[0].done, tags(saved)], [true, before]);
  // 3. untick a tagged set (set 3, Easy): v1.2.0 keeps the tag on the unticked set
  await tap(o, `${ROWS}[2].querySelector('button[aria-pressed]')`);
  await sleep(400);
  saved = await v3(o);
  check('v1.2.0 untick of a tagged set: it keeps that tag on the unticked set (known, harmless)', saved.currentCycle.slots['incline-db-press'].sets[2], { weight: '62.5', reps: '7', unit: 'kg', done: false, tag: 'easy' });
  // 4. Start new week in v1.2.0
  await tap(o, `document.querySelector('header button[title="View Weekly Report Card"]')`);
  await tap(o, `[...document.querySelectorAll('.fixed.inset-0 button')].find((b) => b.innerText.trim() === 'Start new week')`);
  await tap(o, `[...document.querySelectorAll('[role=alertdialog] button')].find((b) => b.innerText.trim() === 'Start new week')`);
  await sleep(500);
  saved = await v3(o);
  const archived = saved.archivedCycles.at(-1);
  check('v1.2.0 Start new week: the week is archived with its tags', [saved.archivedCycles.length, tags({ currentCycle: { id: 'x', slots: {} }, archivedCycles: [archived] })],
    [4, [`${archived.id}/incline-db-press/0=good`, `${archived.id}/incline-db-press/1=max`, `${archived.id}/incline-db-press/2=easy (unticked)`]]);
  check('v1.2.0 no page errors', o.errors, []);
  const text = await o.evaluate(`localStorage.getItem('${V3}')`);
  await chrome.closeTarget(o.targetId);

  // 5. back in step 4 with what v1.2.0 saved
  const n = await chrome.newPage(360, 740);
  await n.goto(NEW);
  await n.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg'); localStorage.setItem('${V3}', ${JSON.stringify(text)});`);
  await n.reload(2500);
  const lines = await n.evaluate(`[...[...document.querySelectorAll('main [data-exercise-actions]')][0].closest('.rounded-2xl').querySelectorAll('[data-set-row]')].map((r) => r.querySelector('[data-last-time]')?.innerText.replace(/\\s+/g, ' ').trim() ?? null)`);
  const today = await n.evaluate(`new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })`);
  check('step 4 after v1.2.0: last time from the week v1.2.0 archived; the unticked set 3 (with its leftover tag) shows nothing',
    lines, [`Last (${today}): 60 kg × 10 · Good`, 'Last: 65 kg × 8 · Max', null]);
  check('step 4 after v1.2.0: loaded without writing, no repair copy', [await n.evaluate(`localStorage.getItem('${V3}')`) === text, await n.evaluate(`localStorage.getItem('aesthetic_recomp_backup_aesthetic_recomp_v3_raw')`)], [true, null]);
  check('step 4 no page errors', n.errors, []);
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
