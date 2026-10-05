// Two early fixes, still guarded: (3) the day tabs always sit right under the header, at every width and in
// both languages; (1) the weekly report opens by itself once, when the week becomes complete during a visit.
import { writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, sleep, SHOTS } from './cdp.mjs';

const OUT = `${SHOTS}/check-fixes`;
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${JSON.stringify(actual)})`);
};
const measure = `(async () => {
  window.scrollTo(0, 1500);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const h = document.querySelector('header').getBoundingClientRect();
  const n = document.querySelector('nav').getBoundingClientRect();
  return { width: window.innerWidth, headerBottom: +h.bottom.toFixed(2), navTop: +n.top.toFixed(2), tabsTouchHeader: Math.abs(h.bottom - n.top) < 0.5 };
})()`;
const REPORT = `[...document.querySelectorAll('.fixed.inset-0')].find((el) => el.querySelector('h2'))`;
const reportOpen = (p) => p.evaluate(`!!${REPORT}`);
// A real tap in the middle of an element
const tap = async (p, elJs) => {
  const r = await p.evaluate(`(() => { const el = ${elJs}; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(450);
};
// The tick button of the last set of Day 5's last exercise
const LAST_TICK = `[...document.querySelectorAll('main [data-set-row] button[aria-pressed]')].at(-1)`;

const chrome = await launchChrome(9333, 'profile-check-fixes');
try {
  // ---------- Fix 3: tabs follow the header height ----------
  const p = await chrome.newPage(360, 780);
  await p.goto();
  await p.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en')`);
  await p.reload(3000);
  const en360 = await p.evaluate(measure);
  console.log('EN  360px', JSON.stringify(en360));
  check('EN 360px: tabs sit right under header', en360.tabsTouchHeader, true);
  await p.evaluate(`[...document.querySelectorAll('header button')].find((b) => b.textContent.trim() === '中文').click()`);
  await sleep(500);
  const zh360 = await p.evaluate(measure);
  console.log('ZH  360px', JSON.stringify(zh360));
  check('ZH 360px: tabs sit right under header', zh360.tabsTouchHeader, true);
  const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/zh-360-scrolled.png`, Buffer.from(data, 'base64'));
  for (const w of [320, 1024]) {
    await p.send('Emulation.setDeviceMetricsOverride', { width: w, height: 780, deviceScaleFactor: 2, mobile: w < 600 });
    await sleep(500);
    const m = await p.evaluate(measure);
    console.log(`ZH ${String(w).padStart(4)}px`, JSON.stringify(m));
    check(`ZH ${w}px after resize: tabs sit right under header`, m.tabsTouchHeader, true);
  }
  check('no page errors (tabs)', p.errors, []);
  await chrome.closeTarget(p.targetId);

  // ---------- Fix 1: the weekly report opens by itself once per week ----------
  // (A week that was already complete when the app was updated counts as shown since step 1D-3, so the week is
  // completed here during the visit, like a user would.)
  const r = await chrome.newPage(360, 780);
  await r.goto();
  await r.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en')`);
  await r.reload(3000);
  // Tick every set of the week except the very last one (Day 5, last exercise, last set)
  const ticked = await r.evaluate(`(async () => {
    let n = 0;
    for (let d = 0; d < 5; d++) {
      document.querySelectorAll('nav button')[d].click();
      await new Promise((ok) => setTimeout(ok, 300));
      for (;;) {
        const open = [...document.querySelectorAll('main [data-set-row] button[aria-pressed="false"]')];
        if (open.length === 0 || (d === 4 && open.length === 1)) break;
        open[0].click(); n++;
        await new Promise((ok) => setTimeout(ok, 15));
      }
    }
    return n;
  })()`);
  await sleep(800);
  console.log(`ticked ${ticked} sets`);
  check('every set but the last ticked: the report has not opened', await reportOpen(r), false);
  await tap(r, LAST_TICK);
  await sleep(400);
  check('the last tick completes the week: the report opens by itself', await reportOpen(r), true);
  await tap(r, `${REPORT}.querySelector('button')`);
  check('its close button closes it', await reportOpen(r), false);
  await tap(r, LAST_TICK); // untick
  await tap(r, LAST_TICK); // tick again: the week is complete again
  await sleep(400);
  check('untick + tick again: it does NOT open a second time', await reportOpen(r), false);
  await r.reload(3000);
  check('reload with the whole week done: it stays closed', await reportOpen(r), false);
  await tap(r, `document.querySelector('header button[title="View Weekly Report Card"]')`);
  check('the trophy button still opens it', await reportOpen(r), true);
  check('no page errors (report)', r.errors, []);
} finally {
  console.log('\n' + results.join('\n'));
  console.log(`\n${results.filter((x) => x.startsWith('PASS')).length} passed, ${results.filter((x) => x.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
