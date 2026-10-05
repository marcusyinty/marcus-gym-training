// Step 6 screens at 360x740 and 320x640, EN and 中文: the notice row, the Body screen (empty, problems, replace
// question, 1 / 10 / 200 entries, delete question, height), About > Your data and the restore panel. Each screen:
// nothing wider than the screen, every Body button at least 44x44, the title never under the close button.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchChrome, sleep, SHOTS, SCRATCH } from './cdp.mjs';
import { historyData } from './fixtures/seed.mjs';

const OUT = `${SHOTS}/6`;
mkdirSync(OUT, { recursive: true });
const V3 = 'aesthetic_recomp_v3';
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)?.slice(0, 300)}, expected ${JSON.stringify(expected)?.slice(0, 300)})`}`);
};
const pad = (n) => String(n).padStart(2, '0');
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// Made-up entries: a slow, noisy drift down, a few typed in lbs, some with waist and hips
const entries = (count, every) => {
  const out = {};
  for (let i = 0; i < count; i++) {
    const kg = 80 - (i * 8) / count + Math.sin(i * 1.7) * 0.6;
    out[daysAgo(Math.round((count - 1 - i) * every))] = i % 9 === 4
      ? { weight: { value: (kg / 0.45359237).toFixed(1), unit: 'lbs' } }
      : { weight: { value: String(Math.round(kg * 10) / 10), unit: 'kg' }, ...(i % 4 === 0 && { waist: { value: String(Math.round((86 - i * 0.02) * 10) / 10), unit: 'cm' }, hips: { value: '97', unit: 'cm' } }) };
  }
  return out;
};
const Q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const tap = async (p, elJs) => {
  const r = await p.evaluate(`(() => { const el = ${elJs}; if (!el) throw new Error('not found: ' + ${JSON.stringify(elJs)}); el.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(350);
};
const type = async (p, field, text) => {
  await p.evaluate(`(() => { const el = ${Q(`[data-body-field="${field}"]`)}; el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.focus(); el.select(); })()`);
  await p.send('Input.insertText', { text });
  await sleep(100);
};
const setDay = (p, day) => p.evaluate(`(() => { const el = ${Q('[data-body-field="day"]')}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(day)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const scrollTo = (p, selector, block = 'start') => p.evaluate(`(() => { ${Q(selector)}.scrollIntoView({ block: '${block}', behavior: 'instant' }); const s = ${Q('[data-body-screen] .overflow-y-auto')}; if (s && '${block}' === 'start') s.scrollTop -= 6; })()`).then(() => sleep(250));
const layout = (p) => p.evaluate(`(() => {
  const screen = ${Q('[data-body-screen]')};
  const scroller = screen?.querySelector('.overflow-y-auto');
  const buttons = screen ? [...screen.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().height > 0) : [];
  const close = screen?.querySelector('button[aria-label]')?.getBoundingClientRect();
  const range = document.createRange();
  if (screen) range.selectNodeContents(screen.querySelector('#body-title'));
  return {
    sideways: Math.max(document.documentElement.scrollWidth - innerWidth, scroller ? scroller.scrollWidth - scroller.clientWidth : 0),
    small: buttons.map((b) => [(b.innerText.trim() || b.getAttribute('aria-label') || '?').slice(0, 24), Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)]).filter(([, w, h]) => w < 44 || h < 44),
    titleUnderClose: !!close && [...range.getClientRects()].some((t) => t.right > close.left && t.left < close.right && t.bottom > close.top && t.top < close.bottom),
  };
})()`);

const chrome = await launchChrome(9580, 'profile-6-shots');
try {
  for (const [w, h] of [[360, 740], [320, 640]]) {
    for (const lang of ['en', 'zh']) {
      const key = `${w}x${h}-${lang}`;
      const p = await chrome.newPage(w, h);
      await p.send('Page.setInterceptFileChooserDialog', { enabled: true });
      const shot = async (name) => {
        const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(`${OUT}/${key}-${name}.png`, Buffer.from(data, 'base64'));
        const l = await layout(p);
        check(`${key} ${name}: nothing wider than the screen, Body buttons >= 44x44, title clear of the close button`, l, { sideways: 0, small: [], titleUnderClose: false });
      };
      const load = async (body) => {
        await p.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', '${lang}'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg'); localStorage.setItem('${V3}', ${JSON.stringify(JSON.stringify({ ...historyData(), ...(body && { body }) }))});`);
        await p.reload(2500);
      };
      await p.goto();
      await load(null);
      check(`${key} notice row: same height as before step 6 (50px), Body button 44px tall`,
        await p.evaluate(`[Math.round(${Q('[data-body-open]')}.parentElement.getBoundingClientRect().height), Math.round(${Q('[data-body-open]')}.getBoundingClientRect().height)]`), [50, 44]);
      await shot('01-notice-row');
      await tap(p, Q('[data-body-open]'));
      await shot('02-empty');
      await setDay(p, daysAgo(-1));
      await type(p, 'weight', 'abc');
      await type(p, 'hips', '400');
      await tap(p, Q('[data-body-save]'));
      await scrollTo(p, '[data-body-form]');
      await shot('03-problems');

      await load({ entries: { [daysAgo(2)]: { weight: { value: '72.4', unit: 'kg' }, waist: { value: '80', unit: 'cm' } } }, height: { value: '181', unit: 'cm' } });
      await tap(p, Q('[data-body-open]'));
      await scrollTo(p, '[data-body-chart]');
      await shot('04-one-entry');
      await setDay(p, daysAgo(2));
      await type(p, 'weight', '73');
      await tap(p, Q('[data-body-save]'));
      await scrollTo(p, '[data-body-replace]', 'center');
      await shot('05-replace-question');

      await load({ entries: entries(10, 3), height: { value: '181', unit: 'cm' } });
      await tap(p, Q('[data-body-open]'));
      await scrollTo(p, '[data-body-chart]');
      await shot('06-ten-entries');
      await tap(p, Q(`[data-body-row="${daysAgo(3)}"] [data-body-delete]`));
      await scrollTo(p, '[data-body-list]');
      await shot('07-list-delete-question');
      await tap(p, Q('[data-body-height-edit]'));
      await scrollTo(p, '[data-body-height]', 'center');
      await shot('08-height-edit');

      await load({ entries: entries(200, 1.3) });
      await tap(p, Q('[data-body-open]'));
      await tap(p, Q('[data-body-range="all"]'));
      await scrollTo(p, '[data-body-chart]');
      await shot('09-200-entries-all');
      await tap(p, Q('[data-body-range="30"]'));
      await scrollTo(p, '[data-body-chart]');
      await shot('10-200-entries-30-days');
      await tap(p, `[...document.querySelectorAll('[data-body-screen] button')].at(-1)`);

      await tap(p, Q('header button[title^="About"]'));
      await tap(p, Q('[data-body-open-about]'));
      check(`${key} About > Body opens the Body screen`, await p.evaluate(`!!${Q('[data-body-screen]')}`), true);
      await tap(p, `[...document.querySelectorAll('[data-body-screen] button')].at(-1)`);
      await tap(p, Q('header button[title^="About"]'));
      await p.evaluate(`${Q('[data-body-open-about]')}.scrollIntoView({ block: 'center', behavior: 'instant' })`);
      await sleep(250);
      await shot('11-about-your-data');
      const file = `${SCRATCH}/synthetic-6-shots-backup.json`;
      writeFileSync(file, JSON.stringify({ app: 'aesthetic-recomp-backup', version: 1, exportedAt: '2026-10-01T08:00:00.000Z', schemaVersion: 3, data: historyData() }));
      const opened = new Promise((resolve) => p.onEvent((m) => m.method === 'Page.fileChooserOpened' && resolve(m.params)));
      await tap(p, `[...${Q('section[aria-labelledby="data-section-title"]')}.querySelectorAll('button')][1]`);
      const { backendNodeId } = await opened;
      await p.send('DOM.setFileInputFiles', { files: [file.replace(/\//g, '\\')], backendNodeId });
      await sleep(600);
      await p.evaluate(`${Q('[data-restore-body]')}.scrollIntoView({ block: 'center', behavior: 'instant' })`);
      await sleep(250);
      await shot('12-restore-panel');
      check(`${key} no page errors`, p.errors, []);
      await chrome.closeTarget(p.targetId);
    }
  }
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
