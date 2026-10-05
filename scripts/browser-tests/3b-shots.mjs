// Step 3B screenshots: 360x740 and 320x640, EN and 中文, 7 screens each, plus contact sheets.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, SCRATCH, sleep, FIXTURES, SHOTS } from './cdp.mjs';

const OUT = `${SHOTS}/3b`;
mkdirSync(OUT, { recursive: true });
const recorded = { ...JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8')), aesthetic_recomp_unit_v1: 'kg' };
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)})`}`);
};
const tap = async (p, elJs) => {
  const r = await p.evaluate(`(() => { const el = ${elJs}; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(450);
};
const CARD = (i) => `[...document.querySelectorAll('main [data-exercise-actions]')][${i}].closest('.rounded-2xl')`;
const showCard = (p, i) => p.evaluate(`window.scrollTo(0, window.scrollY + ${CARD(i)}.getBoundingClientRect().top - 120)`);
const T = { en: { cancel: 'Cancel' }, zh: { cancel: '取消' } };

const chrome = await launchChrome(9435, 'profile-3b-shots');
const sheets = {};
try {
  for (const [w, h] of [[360, 740], [320, 640]]) {
    for (const lang of ['en', 'zh']) {
      const key = `${w}x${h}-${lang}`;
      sheets[key] = [];
      const shot = async (p, name) => {
        await sleep(250);
        const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
        const file = `${OUT}/${key}-${sheets[key].length + 1}-${name}.png`;
        writeFileSync(file, Buffer.from(data, 'base64'));
        sheets[key].push([name, file]);
      };
      const p = await chrome.newPage(w, h);
      await p.send('Page.setInterceptFileChooserDialog', { enabled: true });
      await p.goto();
      await p.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify({ ...recorded, language_preference: lang })})) localStorage.setItem(k, v);`);
      await p.reload(3500);
      // 1. Day 1, first card (defaults; Incline DB Press has a note)
      await tap(p, `${CARD(0)}.querySelector('[data-remark-row]')`);
      await p.evaluate(`(() => { const box = document.querySelector('[data-remark-input]'); box.focus(); })()`);
      await p.send('Input.insertText', { text: lang === 'zh' ? '上斜凳：往上 3 个孔位，座椅 2' : 'Incline bench: 3 holes up, seat at 2' });
      await tap(p, `document.querySelector('[data-remark-save]')`);
      await showCard(p, 0);
      await shot(p, 'day1-card');
      // 2. Day 2 default card (Leg Press, ticked set, Prev)
      await p.evaluate(`document.querySelectorAll('nav button')[1].click()`); await sleep(400);
      await showCard(p, 0);
      await shot(p, 'day2-default-card');
      // 3. Day 2 swapped card (Bulgarian -> Smith split squat) with its own note
      await tap(p, `${CARD(2)}.querySelector('[data-swap-button]')`);
      await tap(p, `document.querySelector('[data-swap-choice="smith-split-squat"]')`);
      await tap(p, `${CARD(2)}.querySelector('[data-remark-row]')`);
      await p.evaluate(`document.querySelector('[data-remark-input]').focus()`);
      await p.send('Input.insertText', { text: lang === 'zh' ? '杠铃高度 5，前脚离凳 2 块地砖' : 'Bar at 5, front foot 2 tiles from bench' });
      await tap(p, `document.querySelector('[data-remark-save]')`);
      await showCard(p, 2);
      await shot(p, 'day2-swapped-card');
      // 4. the chooser (on the swapped card), 5. the blocked message (Leg Press has a ticked set)
      await tap(p, `${CARD(2)}.querySelector('[data-swap-button]')`);
      await shot(p, 'chooser');
      await p.evaluate(`history.back()`); await sleep(500);
      await tap(p, `${CARD(0)}.querySelector('[data-swap-button]')`);
      check(`${key}: blocked message shown`, await p.evaluate(`!!document.querySelector('[data-swap-message]')`), true);
      await shot(p, 'blocked');
      await p.evaluate(`history.back()`); await sleep(500);
      // 6. note editor with the keyboard open (visual viewport shorter by ~40%)
      const keyboard = Math.round(h * 0.4);
      await tap(p, `${CARD(1)}.querySelector('[data-remark-row]')`);
      await p.evaluate(`(() => {
        const vv = window.visualViewport;
        Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - ${keyboard} });
        vv.dispatchEvent(new Event('resize'));
        const kb = document.createElement('div'); kb.id = 'fake-keyboard';
        kb.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:${keyboard}px;background:#3a3a40;z-index:9999;color:#bbb;font:13px sans-serif;display:flex;align-items:center;justify-content:center';
        kb.textContent = 'keyboard (${keyboard}px)'; document.body.appendChild(kb);
      })()`);
      await p.evaluate(`document.querySelector('[data-remark-input]').focus()`);
      await p.send('Input.insertText', { text: lang === 'zh' ? '髋部贴紧\n脚跟发力' : 'Hips back\nDrive through heels' });
      const fit = await p.evaluate(`(() => { const s = document.querySelector('[data-remark-save]').getBoundingClientRect(); const b = document.querySelector('[data-remark-input]').getBoundingClientRect(); return b.top >= 0 && s.bottom <= window.innerHeight - ${keyboard}; })()`);
      check(`${key}: editor (text box + Save) fully above a ${keyboard}px keyboard`, fit, true);
      await shot(p, 'editor-keyboard');
      await p.evaluate(`(() => { document.getElementById('fake-keyboard').remove(); delete window.visualViewport.height; window.visualViewport.dispatchEvent(new Event('resize')); })()`);
      await tap(p, `[...document.querySelectorAll('[data-bottom-sheet] button')].find((b) => b.innerText.trim() === '${T[lang].cancel}')`);
      // 7. restore panel: a new backup (replaces notes) at 360, an old one (keeps notes) at 320
      const current = await p.evaluate(`JSON.parse(localStorage.getItem('aesthetic_recomp_v3'))`);
      const { remarks, ...withoutRemarks } = current;
      const backupData = w === 360 ? { ...current, remarks: { 'leg-press': 'from the backup' } } : withoutRemarks;
      const file = `${SCRATCH}/files-3b-${key}.json`;
      writeFileSync(file, JSON.stringify({ app: 'aesthetic-recomp-backup', version: 1, exportedAt: new Date().toISOString(), schemaVersion: 3, data: backupData }, null, 2));
      await tap(p, `document.querySelector('header button[title^="About"]')`);
      const opened = new Promise((resolve) => p.onEvent((m) => m.method === 'Page.fileChooserOpened' && resolve(m.params)));
      await tap(p, `[...document.querySelectorAll('section[aria-labelledby="data-section-title"] button')][1]`);
      const { backendNodeId } = await opened;
      await p.send('DOM.setFileInputFiles', { files: [file.replace(/\//g, '\\')], backendNodeId });
      await sleep(700);
      await p.evaluate(`document.querySelector('[data-restore-remarks]').scrollIntoView({ block: 'center', behavior: 'instant' })`);
      check(`${key}: restore panel line`, await p.evaluate(`document.querySelector('[data-restore-remarks]').innerText.trim()`),
        w === 360 ? (lang === 'en' ? 'Your saved remarks will be replaced.' : '您保存的备注会被替换。') : (lang === 'en' ? 'Your saved remarks will be kept.' : '您保存的备注会保留。'));
      await shot(p, 'restore-panel');
      check(`${key}: no page errors`, p.errors, []);
      await chrome.closeTarget(p.targetId);
    }
  }
  for (const [key, list] of Object.entries(sheets)) {
    const [w, h] = key.split('-')[0].split('x').map(Number);
    for (let part = 0; part * 4 < list.length; part++) {
      const cells = list.slice(part * 4, part * 4 + 4).map(([name, file]) =>
        `<figure style="margin:0"><figcaption>${key} · ${name}</figcaption><img src="data:image/png;base64,${readFileSync(file).toString('base64')}" style="width:${w}px;height:${h}px;display:block"></figure>`);
      const page = await chrome.newPage(4 * w + 60, h + 40);
      await page.send('Emulation.setDeviceMetricsOverride', { width: 4 * w + 60, height: h + 34, deviceScaleFactor: 1, mobile: false });
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
