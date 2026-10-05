// Step 1E screenshots at 360x740 and 320x640, EN and 中文, plus About modal scroll/close checks.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, SCRATCH, sleep, FIXTURES, SHOTS } from './cdp.mjs';

const OUT = `${SHOTS}/1d3/about`;
mkdirSync(OUT, { recursive: true });
// A small made-up backup file to restore (its own, so this script doesn't depend on another one's download)
const backupPath = `${SCRATCH}/backup-shots-backup.json`;
const set = (weight, reps, updatedAt) => ({ weight, reps, unit: 'kg', done: true, updatedAt });
writeFileSync(backupPath, JSON.stringify({
  app: 'aesthetic-recomp-backup', version: 1, exportedAt: '2026-10-02T15:10:00.000Z', schemaVersion: 3,
  data: {
    schemaVersion: 3,
    currentCycle: { id: 'made-up-week', startedAt: '2026-10-02T15:00:00.000Z', slots: { 'incline-db-press': { slotId: 'incline-db-press', exerciseId: 'incline-db-press', performedExerciseId: 'incline-db-press', sets: { 0: set('60', '8', '2026-10-02T15:09:36.888Z') } } } },
    archivedCycles: [], bests: { 'incline-db-press': { weight: '60', reps: '8', unit: 'kg' } }, reportShownCycleIds: [], remarks: {},
  },
}, null, 2));
const truncatedPath = `${SCRATCH}/truncated-backup.json`;
writeFileSync(truncatedPath, '{"app":"aesthetic-recomp-backup","version":1,"exportedAt":"2026-10-0'); // cut off half-way: not JSON
const recorded = { ...JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8')), language_preference: 'en', aesthetic_recomp_unit_v1: 'kg' };
const FAIL_ONCE = `const realToISO = Date.prototype.toISOString; Date.prototype.toISOString = function () { if (!window.__failedOnce && this.getTime() !== 0) { window.__failedOnce = true; throw new RangeError('injected for the test'); } return realToISO.call(this); };`;
const TEXT = {
  en: { restore: 'Restore from backup', replace: 'Replace my data', close: 'Close' },
  zh: { restore: '从备份恢复', replace: '替换我的数据', close: '关闭' },
};
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)})`}`);
};
const SECTION = `document.querySelector('section[aria-labelledby="data-section-title"]')`;
const PANEL = `document.querySelector('[aria-labelledby="restore-confirm-title"]')`;
const buttonIn = (root, text) => `[...${root}.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(text)})`;
const SCROLLER = `document.querySelector('.fixed.inset-0 .overflow-y-auto')`;
const overlays = (p) => p.evaluate(`document.querySelectorAll('.fixed.inset-0').length`);

const tap = async (p, elJs) => {
  const r = await p.evaluate(`(() => { const el = ${elJs}; el.scrollIntoView({ block: 'nearest', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(350);
};
const pickFile = async (p, lang, file) => {
  const opened = new Promise((resolve) => p.onEvent((m) => m.method === 'Page.fileChooserOpened' && resolve(m.params)));
  await tap(p, buttonIn(SECTION, TEXT[lang].restore));
  const { backendNodeId } = await Promise.race([opened, sleep(5000).then(() => { throw new Error('file picker did not open'); })]);
  await p.send('DOM.setFileInputFiles', { files: [file.replace(/\//g, '\\')], backendNodeId });
  await sleep(600);
};
const openPage = async (chrome, w, h, lang, inject = '') => {
  const p = await chrome.newPage(w, h);
  await p.send('Page.setInterceptFileChooserDialog', { enabled: true });
  await p.goto();
  await p.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(recorded)})) localStorage.setItem(k, v);`);
  if (inject) await p.send('Page.addScriptToEvaluateOnNewDocument', { source: inject });
  await p.reload(3500);
  if (lang === 'zh') { await p.evaluate(`[...document.querySelectorAll('header button')].find((b) => b.innerText.trim() === '中文').click()`); await sleep(300); }
  return p;
};
const openAbout = async (p) => { await p.evaluate(`document.querySelector('header button[title^="About"]').click()`); await sleep(400); };

const chrome = await launchChrome(9407, 'profile-1d3-about');
const shots = {};
try {
  for (const [w, h] of [[360, 740], [320, 640]]) {
    for (const lang of ['en', 'zh']) {
      const key = `${w}x${h}-${lang}`;
      shots[key] = [];
      const shot = async (p, name) => {
        const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
        const file = `${OUT}/${key}-${shots[key].length + 1}-${name}.png`;
        writeFileSync(file, Buffer.from(data, 'base64'));
        shots[key].push([name, file]);
      };

      const p = await openPage(chrome, w, h, lang);
      // two extra ticks so "on this phone now" differs from the backup
      for (let i = 0; i < 2; i++) await p.evaluate(`document.querySelector('[data-set-row] button[aria-pressed="false"]').click()`);
      await sleep(700);
      await openAbout(p);
      await shot(p, 'about-top');
      await pickFile(p, lang, backupPath);
      await p.evaluate(`${PANEL}.scrollIntoView({ block: 'start', behavior: 'instant' })`); // like a user scrolling the modal
      await shot(p, 'confirm');
      const panelFits = await p.evaluate(`(() => { const s = ${SCROLLER}.getBoundingClientRect(); const b = ${PANEL}.getBoundingClientRect(); return { panelHeight: Math.round(b.height), scrollerHeight: Math.round(s.height), overflowX: document.documentElement.scrollWidth > innerWidth, boxScrollable: (() => { const box = document.querySelector('.fixed.inset-0 > div'); return box.scrollHeight > box.clientHeight; })() }; })()`);
      console.log(key, 'confirm panel', JSON.stringify(panelFits));
      check(`${key}: no sideways scroll with the panel open; the modal box itself never scrolls`, [panelFits.overflowX, panelFits.boxScrollable], [false, false]);
      await tap(p, buttonIn(PANEL, TEXT[lang].replace));
      await shot(p, 'restored');
      await pickFile(p, lang, truncatedPath);
      await shot(p, 'error-message');

      // the modal still scrolls to the last log entry and closes both ways
      const scroll = await p.evaluate(`(() => { const s = ${SCROLLER}; s.scrollTop = s.scrollHeight; const last = s.lastElementChild.getBoundingClientRect(); const box = s.getBoundingClientRect(); return { scrolls: s.scrollHeight > s.clientHeight, lastVisible: last.bottom <= box.bottom + 1 && last.bottom > box.top }; })()`);
      await sleep(200);
      await shot(p, 'scrolled-bottom');
      check(`${key}: About modal scrolls to its end`, scroll, { scrolls: true, lastVisible: true });
      await tap(p, `document.querySelector('.fixed.inset-0 button.absolute')`);
      const afterX = await overlays(p);
      await openAbout(p);
      await tap(p, buttonIn(`document.querySelector('.fixed.inset-0')`, TEXT[lang].close));
      check(`${key}: X closes, bottom Close closes`, [afterX, await overlays(p)], [0, 0]);
      check(`${key}: no page errors`, p.errors, []);
      await chrome.closeTarget(p.targetId);

      const e = await openPage(chrome, w, h, lang, FAIL_ONCE);
      await openAbout(e);
      await shot(e, 'error-mode');
      check(`${key}: error mode shows the disabled Back up + explanation`, await e.evaluate(`!!document.getElementById('backup-unavailable')`), true);
      await chrome.closeTarget(e.targetId);
      await sleep(300);
    }
  }

  // contact sheets: 3 phone screens per sheet
  for (const [key, list] of Object.entries(shots)) {
    const [w, h] = key.split('-')[0].split('x').map(Number);
    for (let part = 0; part * 3 < list.length; part++) {
      const cells = list.slice(part * 3, part * 3 + 3).map(([name, file]) =>
        `<figure style="margin:0"><figcaption>${key} · ${name}</figcaption><img src="data:image/png;base64,${readFileSync(file).toString('base64')}" style="width:${w}px;height:${h}px;display:block"></figure>`);
      const page = await chrome.newPage(3 * w + 50, h + 40);
      await page.send('Emulation.setDeviceMetricsOverride', { width: 3 * w + 50, height: h + 34, deviceScaleFactor: 1, mobile: false });
      await page.evaluate(`document.body.style.cssText = 'background:#555;color:#fff;font:bold 12px sans-serif;margin:6px'; document.body.innerHTML = ${JSON.stringify(`<div style="display:flex;gap:12px">${cells.join('')}</div>`)}`);
      const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`${OUT}/sheet-${key}-${part + 1}.png`, Buffer.from(data, 'base64'));
      await chrome.closeTarget(page.targetId);
    }
  }
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
