// Compact Day card: height on every day, title lines, progress bar values, description tap, tap target, text sizes.
import { writeFileSync } from 'node:fs';
import { launchChrome, sleep } from './cdp.mjs';

const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${JSON.stringify(actual)})`);
};
const CARD = `document.querySelector('main h2').closest('.rounded-2xl')`;

const chrome = await launchChrome(9367, 'profile-daycheck');
try {
  for (const [w, lang] of [[360, 'en'], [360, 'zh'], [320, 'en'], [320, 'zh']]) {
    const page = await chrome.newPage(w, 740);
    await page.goto();
    await page.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', '${lang}'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg');
      localStorage.setItem('aesthetic_recomp_completed_sets_v2', '{"incline-db-press":[0,1],"lat-pulldown":[0]}');`);
    await page.reload(3000);
    const perDay = [];
    for (let d = 0; d < 5; d++) {
      await page.evaluate(`document.querySelectorAll('nav button')[${d}].click()`); await sleep(250);
      perDay.push(await page.evaluate(`(() => { const h = ${CARD}.querySelector('h2'); return Math.round(${CARD}.getBoundingClientRect().height) + 'px/' + Math.round(h.getBoundingClientRect().height / 24) + 'L'; })()`));
    }
    console.log(`${w} ${lang} card height / title lines, days 1-5:`, perDay.join('  '));
    await page.evaluate(`document.querySelectorAll('nav button')[0].click()`); await sleep(250);
    // The fill animates its width for 300ms after a day switch: wait until it stops changing before reading it
    // (reading it mid-animation gave 16% instead of 17%, depending on timing)
    await page.evaluate(`(async () => {
      const fill = ${CARD}.querySelector('[role="progressbar"]').firstElementChild;
      let last = -1;
      for (let i = 0; i < 40; i++) { const w = fill.getBoundingClientRect().width; if (w === last) return; last = w; await new Promise((r) => setTimeout(r, 100)); }
    })()`);

    const bar = await page.evaluate(`(() => { const b = ${CARD}.querySelector('[role="progressbar"]'); return [b.getAttribute('aria-label'), b.getAttribute('aria-valuenow'), b.getAttribute('aria-valuemax'), Math.round(b.firstElementChild.getBoundingClientRect().width / b.getBoundingClientRect().width * 100)]; })()`);
    check(`${w} ${lang}: progress bar label, now/max, fill % (3 of 18 = 17%)`, bar, [lang === 'zh' ? '本日进度' : 'Day Progress', '3', '18', 17]);
    check(`${w} ${lang}: shows "3 / 18" from the same numbers`, await page.evaluate(`${CARD}.innerText.includes('3 / 18')`), true);

    const desc = `(() => { const b = ${CARD}.querySelector('button[aria-expanded]'); const s = b.querySelector('span'); return { tap: Math.round(b.getBoundingClientRect().height), lines: Math.round(s.getBoundingClientRect().height / 16), cut: s.scrollHeight > s.clientHeight + 1 }; })()`;
    const before = await page.evaluate(desc);
    await page.evaluate(`${CARD}.querySelector('button[aria-expanded]').click()`); await sleep(200);
    const after = await page.evaluate(desc);
    // Tap area 40px when this was written (step 2C), 44px since step 5A
    check(`${w} ${lang}: description 1 line, tap area >= 44px, tap shows all`, [before.lines, before.tap >= 44, after.cut, after.lines >= before.lines], [1, true, false, true]);
    const smallest = await page.evaluate(`Math.min(...[...${CARD}.querySelectorAll('*')].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((el) => parseFloat(getComputedStyle(el).fontSize)))`);
    check(`${w} ${lang}: smallest text >= 12px`, smallest >= 12, true);
    check(`${w} ${lang}: no sideways scroll, no errors`, [await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth'), page.errors], [0, []]);
    await page.evaluate(`${CARD}.querySelector('button[aria-expanded]').click()`); await sleep(200);
    page.close(); await chrome.closeTarget(page.targetId);
  }
} finally {
  console.log(results.join('\n'));
  chrome.kill();
}
