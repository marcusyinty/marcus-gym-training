// Tiny Chrome DevTools Protocol helper for the browser tests: starts the Chrome that is already installed
// (headless, throwaway profile) and drives pages. No npm package: only Node's built-in fetch and WebSocket
// (Node 22+).
//   BASE_URL     the app under test (default http://localhost:3000/)
//   CHROME_PATH  chrome.exe / Google Chrome binary (default: the usual install location)
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
// Made-up test data (see fixtures/README in the main README)
export const FIXTURES = path.join(HERE, 'fixtures');
// Screenshots, logs and downloaded images: review-shots/ in the repo, which git ignores
export const SHOTS = path.join(ROOT, 'review-shots');
// Throwaway Chrome profiles, downloads and generated backup files: outside the repo
export const SCRATCH = path.join(os.tmpdir(), 'marcus-browser-tests');
mkdirSync(SCRATCH, { recursive: true });
export const APP = process.env.BASE_URL ?? 'http://localhost:3000/';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
export const CHROME = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));

export const KEYS = [
  'language_preference',
  'aesthetic_recomp_completed_sets_v2',
  'aesthetic_recomp_set_details_v2',
  'aesthetic_recomp_previous_bests_v2',
];
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchChrome(port = 9333, profileName = 'chrome-profile') {
  if (!CHROME) throw new Error('Chrome not found: set CHROME_PATH to the Chrome binary');
  const profile = path.join(SCRATCH, profileName);
  rmSync(profile, { recursive: true, force: true });
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await sleep(200);
    try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch {}
  }
  return {
    port,
    async newPage(width = 360, height = 780) {
      const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
      const page = await connect(target.webSocketDebuggerUrl);
      page.targetId = target.id;
      await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: width < 600 });
      return page;
    },
    async closeTarget(targetId) {
      await fetch(`http://127.0.0.1:${port}/json/close/${targetId}`);
    },
    kill() {
      try {
        if (process.platform === 'win32') execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' });
        else proc.kill('SIGKILL');
      } catch {}
    },
  };
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  let nextId = 0;
  const pending = new Map();
  const listeners = [];
  const errors = [];
  const warnings = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value ?? a.description).join(' ');
      if (msg.params.type === 'error') errors.push(text);
      if (msg.params.type === 'warning') warnings.push(text);
    }
    for (const fn of listeners) fn(msg);
  };
  // Every command fails after 30s instead of hanging forever, naming the command that hung
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); rej(new Error(`${method} timed out after 30s`)); }, 30000);
    pending.set(id, (m) => { clearTimeout(timer); m.error ? rej(new Error(`${method}: ${JSON.stringify(m.error)}`)) : res(m.result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  return {
    send, evaluate, errors, warnings,
    onEvent(fn) { listeners.push(fn); },
    async goto(url = APP, wait = 3000) { await send('Page.navigate', { url }); await sleep(wait); },
    async reload(wait = 3000) { await send('Page.reload', {}); await sleep(wait); },
    readKeys: () => evaluate(`Object.fromEntries(${JSON.stringify(KEYS)}.map((k) => [k, localStorage.getItem(k)]))`),
    allStorage: () => evaluate(`Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]))`),
    // Types into the nth weight/reps input on screen, one character at a time like a person.
    async typeInto(inputIndex, text, perCharDelay = 40) {
      await evaluate(`(() => { const el = document.querySelectorAll('main input')[${inputIndex}]; el.focus(); el.select(); })()`);
      for (const ch of text) { await send('Input.insertText', { text: ch }); await sleep(perCharDelay); }
    },
    // "Set 1" also matches the tick buttons, labelled "Set 1 done"
    clickButtonByText: (text, nth = 0) => evaluate(`[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === ${JSON.stringify(text)} || b.getAttribute('aria-label') === ${JSON.stringify(text)} + ' done')[${nth}].click()`),
    close() { ws.close(); },
  };
}

// The image library behind "Download image" can't read the Google Fonts stylesheet (another site), so it logs
// one of these notices on every export. Known and harmless; tests ignore them (dev and production wording).
export const isKnownImageNotice = (text) =>
  /^Error inlining remote css file|^Error while reading CSS rules from https:\/\/fonts\.googleapis\.com\/|^Error loading remote stylesheet/.test(text);

// Collects everything a user sees that comes from saved data, across all 5 days + the weekly report.
export const SNAPSHOT_JS = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const activeLang = [...document.querySelectorAll('header button')]
    .find((b) => (b.innerText.trim() === 'EN' || b.innerText.trim() === '中文') && b.className.includes('bg-emerald-500'))?.innerText.trim();
  const days = [];
  for (const tab of [...document.querySelectorAll('nav button')]) {
    tab.click();
    await sleep(300);
    const rows = [...document.querySelectorAll('main [data-set-row]')]
      .filter((r) => r.querySelectorAll('input').length === 2)
      .map((r) => {
        const [w, reps] = r.querySelectorAll('input');
        const b = r.querySelector('button');
        return { set: b.innerText.trim(), done: b.className.includes('bg-emerald-500 text-black'), weight: w.value, reps: reps.value };
      });
    const bests = [...document.querySelectorAll('main *')].filter((d) => typeof d.className === 'string' && d.className.includes('bg-cyan-500/10')).map((d) => d.innerText.trim());
    const monoTexts = [...document.querySelectorAll('main span.font-mono')].map((s) => s.innerText.trim());
    days.push({ tab: tab.innerText.replace(/\\s+/g, ' ').trim(), rows, bests, monoTexts });
  }
  document.querySelector('nav button').click();
  await sleep(200);
  document.querySelector('button[title="View Weekly Report Card"]').click();
  await sleep(400);
  const modal = [...document.querySelectorAll('.fixed.inset-0')].find((el) => el.querySelector('h2'));
  const weeklyReport = modal ? modal.innerText.replace(/\\d{4}-\\d{2}-\\d{2}/g, '<date>').replace(/\\s+/g, ' ').trim() : null;
  modal?.querySelector('button')?.click();
  await sleep(200);
  return { activeLang, days, weeklyReport };
})()`;
