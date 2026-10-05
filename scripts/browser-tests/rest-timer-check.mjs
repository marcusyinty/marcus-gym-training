// Rest timer with a fake clock: start rule, +15s, Skip, end alert (vibrate + beep spies), auto-hide,
// no start on untick / reload / other tab / day-completing tick, hidden-at-zero, sound off, dialogs on top.
import { writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, sleep, SHOTS } from './cdp.mjs';

const OUT = `${SHOTS}/2e-after`;
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${JSON.stringify(actual)})`);
};
// Fake clock + spies, installed before the app's code runs
const SPIES = `
  window.__offset = 0;
  const realNow = Date.now.bind(Date);
  Date.now = () => realNow() + window.__offset;
  window.__vibrations = [];
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (pattern) => { window.__vibrations.push(pattern); return true; } });
  window.__beeps = 0; window.__audioContexts = 0;
  const RealAudioContext = window.AudioContext;
  window.AudioContext = class extends RealAudioContext { constructor(...a) { super(...a); window.__audioContexts++; } };
  const realStart = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...a) { window.__beeps++; return realStart.apply(this, a); };
  window.__vis = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
`;
const near = (text, mmss) => { const toS = (t) => { const [m, sec] = t.split(':').map(Number); return m * 60 + sec; }; const m = /running (\d\d:\d\d)/.exec(text); return !!m && Math.abs(toS(m[1]) - toS(mmss)) <= 1; };
const BAR = `(() => {
  const timer = document.querySelector('[role="timer"]');
  const over = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Rest over') || b.textContent.includes('休息结束'));
  return timer ? 'running ' + timer.textContent : over ? 'over' : 'hidden';
})()`;

const chrome = await launchChrome(9371, 'profile-rest');
const pages = [];
const newPage = async (w, h) => {
  const p = await chrome.newPage(w, h);
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: SPIES });
  pages.push(p);
  return p;
};
const tapTick = async (p, rowIndex) => {
  // Scroll instantly (the page uses smooth scrolling), then measure where the button really is
  await p.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[${rowIndex}].scrollIntoView({ block: 'center', behavior: 'instant' })`);
  await sleep(250);
  const r = await p.evaluate(`(() => { const rect = document.querySelectorAll('[data-set-row] button[aria-pressed]')[${rowIndex}].getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(400);
};
const advanceToEnd = async (p) => {
  const text = await p.evaluate(BAR);
  const [m, sec] = text.replace('running ', '').split(':').map(Number);
  await advance(p, m * 60 + sec);
};
const advance = async (p, seconds) => { await p.evaluate(`window.__offset += ${seconds * 1000}`); await sleep(700); };
const clickText = (p, text) => p.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)} || b.getAttribute('aria-label') === ${JSON.stringify(text)}).click()`);
const seed = (p, lang, done = {}) => p.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', '${lang}'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg');
  localStorage.setItem('aesthetic_recomp_completed_sets_v2', '${JSON.stringify(done)}');`);
const shot = async (p, name) => { const { data } = await p.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64')); };

try {
  // ---------- main flow, 360 EN ----------
  const page = await newPage(360, 740);
  await page.goto();
  await seed(page, 'en');
  await page.reload(3000);
  check('nothing on load', await page.evaluate(BAR), 'hidden');

  await tapTick(page, 0); // Incline DB Press 6-8 reps -> 120s
  check('tick set 1 of Incline DB Press (6–8) -> bar with 02:00', await page.evaluate(BAR), 'running 02:00');
  check('the tap unlocked the audio (AudioContext created)', await page.evaluate('window.__audioContexts'), 1);
  await advance(page, 30);
  check('30s later -> 01:30 (±1s of real time)', near(await page.evaluate(BAR), '01:30'), true);
  await clickText(page, 'Add 15 seconds'); await sleep(400);
  const beforeAdd = await page.evaluate(BAR);
  await sleep(0);
  check('+15s -> 01:45 (±1s)', near(await page.evaluate(BAR), '01:45'), true);
  console.log('  before +15s it showed (already pressed above):', beforeAdd);
  await page.evaluate(`window.scrollTo(0, 0)`); await sleep(300);
  await shot(page, '360x740-en-running');
  await clickText(page, 'Skip'); await sleep(400);
  check('Skip hides it', await page.evaluate(BAR), 'hidden');

  await tapTick(page, 3); // Lat Pulldown 8-10 -> 120s
  check('tick Lat Pulldown set 1 (8–10) -> 02:00', await page.evaluate(BAR), 'running 02:00');
  await tapTick(page, 6); // Machine Shoulder Press 8-10 -> restarts for that set
  await advance(page, 60);
  await tapTick(page, 12); // Rope Pushdown 10-12 -> 90s, restarts
  check('ticking another set restarts it (Rope Pushdown 10–12 -> 01:30)', await page.evaluate(BAR), 'running 01:30');
  const before = await page.evaluate('[window.__vibrations.length, window.__beeps]');
  await advance(page, 90);
  check('at zero: green "Rest over - next set!"', await page.evaluate(BAR), 'over');
  check('at zero: vibrate([200,100,200]) called once', await page.evaluate('window.__vibrations'), [[200, 100, 200]]);
  check('at zero: beep played once', (await page.evaluate('window.__beeps')) - before[1], 1);
  await shot(page, '360x740-en-finished');
  await advance(page, 5);
  check('still green after 5s', await page.evaluate(BAR), 'over');
  await advance(page, 6);
  check('hidden 10s after it turned green', await page.evaluate(BAR), 'hidden');

  await tapTick(page, 12); // untick the done Rope Pushdown set 1
  check('unticking a done set does not start it', await page.evaluate(BAR), 'hidden');
  await tapTick(page, 13);
  await page.evaluate(`[...document.querySelectorAll('[role="timer"]')].length`);
  await clickText(page, 'Skip'); await sleep(300);

  // tap the green bar to hide it
  await tapTick(page, 14); await advance(page, 91);
  await clickText(page, 'Rest over - next set!'); await sleep(400);
  check('tapping the green bar hides it', await page.evaluate(BAR), 'hidden');

  await page.reload(3000);
  check('reload (with done sets saved) does not start it', await page.evaluate(BAR), 'hidden');

  // ---------- sound off ----------
  await tapTick(page, 15);
  await clickText(page, 'Rest timer sound'); await sleep(500);
  check('sound toggle saves "off"', await page.evaluate(`localStorage.getItem('aesthetic_recomp_rest_sound_v1')`), 'off');
  await page.evaluate(`window.scrollTo(0, 0)`); await sleep(300);
  await shot(page, '360x740-en-sound-off');
  const beepsBefore = await page.evaluate('window.__beeps');
  const vibBefore = await page.evaluate('window.__vibrations.length');
  await advanceToEnd(page);
  check('sound off: no beep at zero, still vibrates', [(await page.evaluate('window.__beeps')) - beepsBefore, (await page.evaluate('window.__vibrations.length')) - vibBefore], [0, 1]);
  await clickText(page, 'Rest timer sound').catch(() => {});
  await page.evaluate(`localStorage.setItem('aesthetic_recomp_rest_sound_v1', 'on')`);
  await page.reload(3000);

  // ---------- hidden at zero: no late beep, green when back, then hides ----------
  await tapTick(page, 1);
  const alertsBefore = await page.evaluate('[window.__vibrations.length, window.__beeps]');
  await page.evaluate(`window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange'))`);
  await advance(page, 300);
  await page.evaluate(`window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange'))`);
  await sleep(500);
  check('back after zero: green, but no late vibrate/beep', [await page.evaluate(BAR), ...(await page.evaluate('[window.__vibrations.length, window.__beeps]')).map((n, i) => n - alertsBefore[i])], ['over', 0, 0]);
  await advance(page, 11);
  check('...then hides 10s after it was seen', await page.evaluate(BAR), 'hidden');

  // ---------- second tab ----------
  const tabB = await newPage(360, 740);
  await tabB.goto();
  await tapTick(page, 4);
  await sleep(1500);
  check('tick in tab A: A runs the timer', (await page.evaluate(BAR)).startsWith('running'), true);
  check('...tab B synced the tick but did not start a timer', [await tabB.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed="true"]').length > 0`), await tabB.evaluate(BAR)], [true, 'hidden']);

  await page.send('Page.bringToFront');
  await sleep(500);

  // ---------- dialogs cover the bar ----------
  const coveredAt = (p) => p.evaluate(`(() => { const bar = document.querySelector('[role="timer"]').closest('.fixed'); const r = bar.querySelector('.h-16').getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return bar.contains(hit) ? 'bar on top' : (hit.closest('[role="dialog"]') ? 'dialog on top' : 'other: ' + hit.tagName); })()`);
  check('bar visible before opening dialogs', await coveredAt(page), 'bar on top');
  await page.evaluate(`window.scrollTo(0, 0)`); await sleep(200);
  await page.evaluate(`document.querySelector('main button[aria-label^="Form Demo"]').click()`); await sleep(1500);
  check('video modal covers the bar', await coveredAt(page), 'dialog on top');
  await shot(page, '360x740-en-video-modal-over-bar');
  await page.evaluate(`document.querySelector('[role="dialog"] button[aria-label="Close"]').click()`); await sleep(400);
  await page.evaluate(`document.querySelector('button[title="Clear or Reset Workout Progress"]').click()`); await sleep(400);
  check('Reset dialog covers the bar', await coveredAt(page), 'dialog on top');
  check('Reset dialog still usable (Cancel closes it)', await page.evaluate(`(() => { const d = document.querySelector('[role="dialog"][aria-labelledby="reset-modal-title"]'); [...d.querySelectorAll('button')].at(-1).click(); return true; })()`), true);
  await sleep(300);
  check('bar back on top after closing dialogs', await coveredAt(page), 'bar on top');

  // ---------- the tick that completes the day stops the timer ----------
  const dayPage = await newPage(360, 740);
  await dayPage.goto();
  await seed(dayPage, 'en', { 'incline-db-press': [0, 1, 2], 'lat-pulldown': [0, 1, 2], 'machine-shoulder-press': [0, 1, 2], 'one-arm-dumbbell-row': [0, 1, 2], 'rope-cable-tricep-pushdown': [0, 1, 2], 'incline-db-supinated-wrist-curl': [0] });
  await dayPage.reload(3000);
  await dayPage.send('Page.bringToFront');
  await tapTick(dayPage, 16);
  check('second-to-last set starts the timer', (await dayPage.evaluate(BAR)).startsWith('running'), true);
  await tapTick(dayPage, 17);
  check('the tick that completes the day stops it (no new rest)', await dayPage.evaluate(BAR), 'hidden');

  check('No page errors', pages.flatMap((p) => p.errors), []);
} finally {
  console.log(results.join('\n'));
  chrome.kill();
}
