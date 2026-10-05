// Drives headless Chrome (throwaway profile) against the dev server to check fix 1 and fix 3.
import { spawn, execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { APP, CHROME, SCRATCH, SHOTS } from './cdp.mjs';

const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${SCRATCH}/chrome-profile`,
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  await sleep(200);
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    wsUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
}
if (!wsUrl) throw new Error('Chrome did not start');

const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let nextId = 0;
const pending = new Map();
const pageErrors = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') pageErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++nextId;
  pending.set(id, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const setWidth = (width) => send('Emulation.setDeviceMetricsOverride', { width, height: 780, deviceScaleFactor: 2, mobile: width < 600 });
const load = async () => { await send('Page.navigate', { url: APP }); await sleep(3000); };

const measure = () => evaluate(`(async () => {
  window.scrollTo(0, 1500);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const h = document.querySelector('header').getBoundingClientRect();
  const nav = document.querySelector('nav');
  const n = nav.getBoundingClientRect();
  return {
    width: window.innerWidth,
    cssVar: getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim(),
    headerBottom: +h.bottom.toFixed(2),
    navTop: +n.top.toFixed(2),
    tabsTouchHeader: Math.abs(h.bottom - n.top) < 0.5,
  };
})()`);
const reportOpen = () => evaluate(`[...document.querySelectorAll('.fixed.inset-0')].some((el) => el.textContent.includes('WEEKLY COMPLETION REPORT'))`);
const clickFirstSet = () => evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Set 1').click()`);
const closeReport = () => evaluate(`[...document.querySelectorAll('.fixed.inset-0')].find((el) => el.textContent.includes('WEEKLY COMPLETION REPORT')).querySelector('button').click()`);
const screenshot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${SHOTS}/check-fixes-${name}.png`, Buffer.from(data, 'base64'));
};

const results = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${JSON.stringify(actual)})`);
};

try {
  await send('Runtime.enable');
  await send('Page.enable');

  // ---------- Fix 3: tabs follow the header height ----------
  await setWidth(360);
  await load();
  await evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en')`);
  await load();
  const en360 = await measure();
  console.log('EN  360px ', en360);
  check('EN 360px: tabs sit right under header', en360.tabsTouchHeader, true);

  await evaluate(`[...document.querySelectorAll('header button')].find((b) => b.textContent.trim() === '中文').click()`);
  await sleep(500);
  const zh360 = await measure();
  console.log('ZH  360px ', zh360);
  check('ZH 360px: tabs sit right under header', zh360.tabsTouchHeader, true);
  await screenshot('zh-360-scrolled');

  for (const w of [320, 1024]) {
    await setWidth(w);
    await sleep(500);
    const m = await measure();
    console.log(`ZH ${String(w).padStart(4)}px `, m);
    check(`ZH ${w}px after resize: tabs sit right under header`, m.tabsTouchHeader, true);
  }

  // ---------- Fix 1: weekly report auto-open ----------
  await setWidth(360);
  await evaluate(`(async () => {
    const { getEnrichedWorkoutProgram, workoutProgram } = await import('/src/data/workoutProgram.ts');
    const { parseSetsCount } = await import('/src/utils/parseSetsCount.ts');
    const all = {};
    for (const day of getEnrichedWorkoutProgram(workoutProgram))
      for (const ex of day.exercises) all[ex.id] = Array.from({ length: parseSetsCount(ex.sets) }, (_, i) => i);
    localStorage.setItem('aesthetic_recomp_completed_sets_v2', JSON.stringify(all));
    localStorage.setItem('language_preference', 'en');
  })()`);
  await load();
  check('Page load with all sets done: report stays closed', await reportOpen(), false);

  await clickFirstSet(); await sleep(400);
  check('Untick a set: report stays closed', await reportOpen(), false);
  await clickFirstSet(); await sleep(400);
  check('Re-tick it (first time complete this session): report opens', await reportOpen(), true);

  await closeReport(); await sleep(300);
  check('Close button closes report', await reportOpen(), false);
  await clickFirstSet(); await sleep(400);
  await clickFirstSet(); await sleep(400);
  check('Untick + re-tick again: report does NOT reopen', await reportOpen(), false);

  await load();
  check('Reload with all sets done: report stays closed', await reportOpen(), false);
  await evaluate(`document.querySelector('button[title="View Weekly Report Card"]').click()`);
  await sleep(400);
  check('Trophy button still opens report manually', await reportOpen(), true);
} finally {
  console.log('\n' + results.join('\n'));
  console.log(`\nPage errors: ${pageErrors.length ? '\n  ' + pageErrors.join('\n  ') : 'none'}`);
  ws.close();
  try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
