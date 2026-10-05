// Reset dialog: does it cover the whole screen, can it be closed, does "reset current day" still work?
// Usage: node check-reset.mjs <before|after> <width> <height> <lang>
import { writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, sleep, SHOTS } from './cdp.mjs';

const [label, w, h, lang] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4]), process.argv[5]];
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${JSON.stringify(actual)})`);
};
const DIALOG = `[...document.querySelectorAll('.fixed.inset-0')].find((el) => el.querySelector('h3') && el.innerText.includes(${JSON.stringify(lang === 'zh' ? '重置' : 'Reset')}))`;
const openDialog = `document.querySelector('button[title="Clear or Reset Workout Progress"]').click()`;
const dialogInfo = `(() => { const d = ${DIALOG}; if (!d) return null; const r = d.getBoundingClientRect();
  return { rect: [r.left, r.top, r.width, r.height].map(Math.round), parent: d.parentElement.tagName.toLowerCase() }; })()`;
const ticksDay1 = `(((d) => d ? { completedSets: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.keys(s.sets).filter((i) => s.sets[i].done).map(Number).sort((a, b) => a - b)])), setDetails: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.fromEntries(Object.entries(s.sets).filter(([, x]) => x.updatedAt !== undefined || x.weight !== '' || x.reps !== '').map(([i, x]) => [i, { setNumber: Number(i) + 1, weight: x.weight, reps: x.reps, unit: x.unit, timestamp: x.updatedAt }]))])), bests: d.bests } : { completedSets: {}, setDetails: {}, bests: {} })(JSON.parse(localStorage.getItem('aesthetic_recomp_v3') || 'null'))).completedSets['incline-db-press'] ?? null`;

const chrome = await launchChrome(9344, `profile-reset-${label}`);
try {
  const page = await chrome.newPage(w, h);
  await page.goto();
  await page.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', '${lang}'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg');
    localStorage.setItem('aesthetic_recomp_completed_sets_v2', '{"incline-db-press":[0,1],"leg-press":[0]}');`);
  await page.reload(3500);
  await page.evaluate(`window.scrollTo(0, 400)`); // open it from further down the page, like a user would
  await sleep(300);
  await page.evaluate(openDialog);
  await sleep(400);
  const info = await page.evaluate(dialogInfo);
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(`${SHOTS}/${label}`, { recursive: true });
  writeFileSync(`${SHOTS}/${label}/reset-dialog-${w}x${h}-${lang}.png`, Buffer.from(data, 'base64'));
  check(`dialog covers the full screen (0, 0, ${w}, ${h})`, info?.rect, [0, 0, w, h]);
  console.log(`${label} ${w}x${h} ${lang}: dialog rect [left, top, width, height] =`, info?.rect, '| rendered inside <' + info?.parent + '>');

  await page.evaluate(`${DIALOG}.querySelector('button').click()`); // the X in the corner
  await sleep(300);
  check('X closes it', await page.evaluate(dialogInfo), null);
  await page.evaluate(openDialog); await sleep(300);
  await page.evaluate(`[...${DIALOG}.querySelectorAll('button')].at(-1).click()`); // Cancel
  await sleep(300);
  check('Cancel closes it', await page.evaluate(dialogInfo), null);
  await page.evaluate(openDialog); await sleep(300);
  await page.evaluate(`[...${DIALOG}.querySelectorAll('button')][1].click()`); // Reset current day
  await sleep(800);
  check('"Reset current day" clears day 1 ticks only', [await page.evaluate(ticksDay1), await page.evaluate(`(((d) => d ? { completedSets: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.keys(s.sets).filter((i) => s.sets[i].done).map(Number).sort((a, b) => a - b)])), setDetails: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.fromEntries(Object.entries(s.sets).filter(([, x]) => x.updatedAt !== undefined || x.weight !== '' || x.reps !== '').map(([i, x]) => [i, { setNumber: Number(i) + 1, weight: x.weight, reps: x.reps, unit: x.unit, timestamp: x.updatedAt }]))])), bests: d.bests } : { completedSets: {}, setDetails: {}, bests: {} })(JSON.parse(localStorage.getItem('aesthetic_recomp_v3') || 'null'))).completedSets['leg-press']`)], [null, [0]]);
  check('No page errors', page.errors, []);
} finally {
  console.log(results.join('\n'));
  chrome.kill();
}
