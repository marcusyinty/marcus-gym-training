// Set row keyboards + labels: input attributes, tap selects the value, Enter weight -> reps -> closed, aria labels.
import { launchChrome, sleep } from './cdp.mjs';

const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${JSON.stringify(actual)})`);
};
const ROW = (i) => `document.querySelectorAll('[data-set-row]')[${i}]`;

const chrome = await launchChrome(9362, 'profile-keyboard');
try {
  for (const lang of ['en', 'zh']) {
    const page = await chrome.newPage(360, 740);
    await page.goto();
    await page.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', '${lang}'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg');`);
    await page.reload(3000);
    await page.evaluate(`window.scrollTo(0, ${ROW(0)}.getBoundingClientRect().top + scrollY - 300)`); await sleep(300);
    const tapInput = async (field) => {
      const r = await page.evaluate(`(() => { const b = ${ROW(0)}.querySelector('input[data-field="${field}"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 3 }; })()`);
      for (const type of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
      await sleep(150);
    };
    const enter = async () => {
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await sleep(150);
    };
    const type = async (text) => { for (const ch of text) { await page.send('Input.insertText', { text: ch }); await sleep(30); } await sleep(200); };
    const active = `(() => { const a = document.activeElement; return a.tagName === 'INPUT' ? a.dataset.field + '@row' + [...document.querySelectorAll('[data-set-row]')].indexOf(a.closest('[data-set-row]')) : a.tagName.toLowerCase(); })()`;
    const values = `[...${ROW(0)}.querySelectorAll('input')].map((i) => i.value)`;

    check(`${lang}: input attributes`, await page.evaluate(`[...${ROW(0)}.querySelectorAll('input')].map((i) => [i.type, i.inputMode, i.step, i.enterKeyHint, i.placeholder])`),
      [['number', 'decimal', 'any', 'next', '–'], ['number', 'numeric', 'any', 'done', '–']]);
    check(`${lang}: box font size >= 16px`, await page.evaluate(`[...${ROW(0)}.querySelectorAll('input')].map((i) => parseFloat(getComputedStyle(i).fontSize))`), [18, 18]);

    await tapInput('weight'); await type('60');
    await enter();
    check(`${lang}: Enter in weight moves to reps of the same row`, await page.evaluate(active), 'reps@row0');
    await type('8');
    await enter();
    check(`${lang}: Enter in reps closes the keyboard (box loses focus)`, await page.evaluate(active), 'body');
    check(`${lang}: values typed`, await page.evaluate(values), ['60', '8']);

    await tapInput('weight'); await type('7');
    check(`${lang}: tapping a filled box selects it, so typing replaces the value`, await page.evaluate(values), ['7', '8']);
    await tapInput('reps'); await type('12');
    check(`${lang}: same for reps`, await page.evaluate(values), ['7', '12']);
    await sleep(600);
    check(`${lang}: values saved as before`, await page.evaluate(`(() => { const d = (((d) => d ? { completedSets: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.keys(s.sets).filter((i) => s.sets[i].done).map(Number).sort((a, b) => a - b)])), setDetails: Object.fromEntries(Object.entries(d.currentCycle.slots).map(([id, s]) => [id, Object.fromEntries(Object.entries(s.sets).filter(([, x]) => x.updatedAt !== undefined || x.weight !== '' || x.reps !== '').map(([i, x]) => [i, { setNumber: Number(i) + 1, weight: x.weight, reps: x.reps, unit: x.unit, timestamp: x.updatedAt }]))])), bests: d.bests } : { completedSets: {}, setDetails: {}, bests: {} })(JSON.parse(localStorage.getItem('aesthetic_recomp_v3') || 'null'))).setDetails['incline-db-press'][0]; return [d.weight, d.reps, d.unit]; })()`), ['7', '12', 'kg']);

    const labels = await page.evaluate(`(() => { const r = ${ROW(1)}; const b = r.querySelector('button[aria-pressed]');
      return [...r.querySelectorAll('input')].map((i) => i.getAttribute('aria-label')).concat([b.getAttribute('aria-label'), b.getAttribute('aria-pressed'), r.querySelector('.sr-only').textContent]); })()`);
    check(`${lang}: labels on set 2 (weight, reps, tick, pressed, set name)`, labels,
      lang === 'zh' ? ['第 2 组 重量（kg）', '第 2 组 次数', '第 2 组 已完成', 'false', '第 2 组'] : ['Set 2 weight (kg)', 'Set 2 reps', 'Set 2 done', 'false', 'Set 2']);
    await page.evaluate(`${ROW(1)}.querySelector('button[aria-pressed]').click()`); await sleep(200);
    check(`${lang}: tick sets aria-pressed=true`, await page.evaluate(`${ROW(1)}.querySelector('button[aria-pressed]').getAttribute('aria-pressed')`), 'true');
    check(`${lang}: no page errors`, page.errors, []);
    page.close(); await chrome.closeTarget(page.targetId);
  }
} finally {
  console.log(results.join('\n'));
  chrome.kill();
}
