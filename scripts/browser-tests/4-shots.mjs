// Step 4 screenshots: 360x740 and 320x640, EN and 中文, without and with history, plus contact sheets.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launchChrome, sleep, SHOTS } from './cdp.mjs';
import { historyData } from './fixtures/seed.mjs';

const OUT = `${SHOTS}/4/shots`;
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)?.slice(0, 300)})`}`);
};
const tap = async (p, elJs) => {
  const r = await p.evaluate(`(() => { const el = ${elJs}; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(450);
};
const CARD = (i) => `[...document.querySelectorAll('main [data-exercise-actions]')][${i}].closest('.rounded-2xl')`;
const showRows = (p, i, above = 230) => p.evaluate(`window.scrollTo(0, window.scrollY + ${CARD(i)}.querySelector('[data-set-row]').getBoundingClientRect().top - ${above})`);
const typeIn = async (p, cardIndex, inputIndex, value) => {
  await p.evaluate(`(() => { const el = ${CARD(cardIndex)}.querySelectorAll('[data-set-row] input')[${inputIndex}]; el.focus(); el.select(); })()`);
  for (const ch of value) { await p.send('Input.insertText', { text: ch }); await sleep(25); }
  await p.evaluate(`document.activeElement.blur()`); await sleep(300);
};
const seed = (p, lang, data) => p.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', '${lang}'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg');${data ? ` localStorage.setItem('aesthetic_recomp_v3', ${JSON.stringify(JSON.stringify(data))});` : ''}`);

const chrome = await launchChrome(9456, 'profile-4-shots');
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
      // 1. no history (first week): the card as in 3B plus the tag button only
      const p = await chrome.newPage(w, h);
      await p.goto();
      await seed(p, lang, null);
      await p.reload(2500);
      check(`${key}: no history -> no last-time line`, await p.evaluate(`document.querySelectorAll('[data-last-time]').length`), 0);
      await showRows(p, 0);
      await shot(p, 'no-history');
      // 2. with history
      await seed(p, lang, historyData());
      await p.reload(2500);
      await showRows(p, 0);
      await shot(p, 'history');
      // 3. tick -> prompt above the timer
      await typeIn(p, 0, 0, '62.5'); await typeIn(p, 0, 1, '10');
      await tap(p, `${CARD(0)}.querySelectorAll('[data-set-row] button[aria-pressed]')[0]`);
      await showRows(p, 0, 150);
      await shot(p, 'prompt-and-timer');
      // 4. a ticked set with each of the three tags
      await tap(p, `document.querySelector('[data-tag-prompt-choice="max"]')`);
      await tap(p, `${CARD(0)}.querySelectorAll('[data-set-row] button[aria-pressed]')[1]`);
      await tap(p, `document.querySelector('[data-tag-prompt-choice="good"]')`);
      await tap(p, `${CARD(0)}.querySelectorAll('[data-set-row] button[aria-pressed]')[2]`);
      await tap(p, `document.querySelector('[data-tag-prompt-choice="easy"]')`);
      await tap(p, `[...document.querySelectorAll('[data-rest-timer] button')][1]`); // Skip
      const ticks = await p.evaluate(`[...${CARD(0)}.querySelectorAll('[data-set-row] button[aria-pressed]')].map((b) => [b.getAttribute('aria-pressed'), b.innerText.trim(), Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height), getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)'])`);
      check(`${key}: three tagged ticks, still 48x48 and filled (ticked look)`, ticks.map(([pressed, , bw, bh, filled]) => [pressed, bw, bh, filled]), [['true', 48, 48, true], ['true', 48, 48, true], ['true', 48, 48, true]]);
      console.log(key, 'tick texts', JSON.stringify(ticks.map((x) => x[1])));
      await showRows(p, 0);
      await shot(p, 'three-tags');
      // 5. tag sheet
      await tap(p, `${CARD(0)}.querySelector('[data-tags-button]')`);
      await shot(p, 'tag-sheet');
      await p.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`); await sleep(400);
      // 6. report with the Max line
      await tap(p, `document.querySelector('header button[title="View Weekly Report Card"]')`);
      await p.evaluate(`document.querySelector('[data-report-max]').scrollIntoView({ block: 'center', behavior: 'instant' })`);
      await shot(p, 'report');
      await p.evaluate(`[...document.querySelectorAll('.fixed.inset-0 button')][0].click()`); await sleep(300);
      // 7. Day 2 Leg Press: history with a Max set and a bodyweight line
      await p.evaluate(`document.querySelectorAll('nav button')[1].click()`); await sleep(400);
      await showRows(p, 0);
      await shot(p, 'day2-leg-press');
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
