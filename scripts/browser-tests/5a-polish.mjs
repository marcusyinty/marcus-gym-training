// Step 5A polish, guarded: rest timer fits at 320px, report footer gap, dialog buttons >= 44px, the day
// description closes on a day change, muscle map sizes + touch wording, tap areas, About text sizes, v2 keys.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, sleep, FIXTURES, SHOTS } from './cdp.mjs';

const OUT = `${SHOTS}/5a`;
mkdirSync(OUT, { recursive: true });
const recorded = JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8'));
const V2_KEYS = ['language_preference', 'aesthetic_recomp_completed_sets_v2', 'aesthetic_recomp_set_details_v2', 'aesthetic_recomp_previous_bests_v2'];
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${JSON.stringify(actual)?.slice(0, 300)})`);
};
const open = async (chrome, w, h, lang, { touch = false } = {}) => {
  const p = await chrome.newPage(w, h);
  if (touch) await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await p.goto();
  await p.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify({ ...recorded, language_preference: lang, aesthetic_recomp_unit_v1: 'kg' })})) localStorage.setItem(k, v);`);
  await p.reload(2500);
  return p;
};
const shot = async (p, name) => {
  const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
};
const FIXED = `[...document.querySelectorAll('.fixed.inset-0')].at(-1)`;
const heights = (p, scope) => p.evaluate(`[...${scope}.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().height > 0).map((b) => [(b.innerText.trim() || b.getAttribute('aria-label') || '?').slice(0, 30), Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)])`);
const small = (list) => list.filter(([, w, h]) => w < 44 || h < 44);

const chrome = await launchChrome(9510, 'profile-5a-polish');
try {
  for (const [w, h] of [[320, 640], [360, 740]]) for (const lang of ['en', 'zh']) {
    const key = `${w}x${h}-${lang}`;
    const p = await open(chrome, w, h, lang);
    const v2Before = await p.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`);

    // 1. rest timer: the digits never run under +15s / +15秒
    await p.evaluate(`[...document.querySelectorAll('[data-set-row] button[aria-pressed="false"]')][0].click()`); await sleep(500);
    await p.evaluate(`document.querySelector('[data-tag-prompt-dismiss]')?.click()`); await sleep(300);
    const rest = await p.evaluate(`(() => {
      const bar = document.querySelector('[data-rest-timer] .h-16'); const timer = bar.querySelector('[role=timer]');
      const range = document.createRange(); range.selectNodeContents(timer);
      return { free: Math.round(bar.querySelectorAll('button')[0].getBoundingClientRect().left - range.getBoundingClientRect().right), icon: !!bar.querySelector('svg.lucide-timer') && getComputedStyle(bar.querySelector('svg.lucide-timer')).display !== 'none' };
    })()`);
    check(`${key}: rest timer digits end before +15s (free px > 0); the timer icon only from 360px`, [rest.free > 0, rest.icon], [true, w >= 360]);
    await shot(p, `${key}-rest-bar`);
    await p.evaluate(`[...document.querySelectorAll('[data-rest-timer] button')][1].click()`); await sleep(300); // Skip

    // 4. the day description closes when the day changes
    const DESC = `document.querySelector('main button[aria-expanded].-mt-3')`;
    await p.evaluate(`window.scrollTo(0, 0); ${DESC}.click()`); await sleep(200);
    const opened = await p.evaluate(`${DESC}.getAttribute('aria-expanded')`);
    await p.evaluate(`document.querySelectorAll('nav button')[1].click()`); await sleep(300);
    const onDay2 = await p.evaluate(`${DESC}.getAttribute('aria-expanded')`);
    await p.evaluate(`document.querySelectorAll('nav button')[0].click()`); await sleep(300);
    check(`${key}: day description open on Day 1, closed on Day 2 and back on Day 1`, [opened, onDay2, await p.evaluate(`${DESC}.getAttribute('aria-expanded')`)], ['true', 'false', 'false']);
    // 5. tap areas without layout change: day description 44px, footer links 44px
    // (a footer link whose text wraps onto 2 lines at 320px is taller than 44px)
    check(`${key}: day description and footer link tap areas are at least 44px tall`,
      await p.evaluate(`[Math.round(${DESC}.getBoundingClientRect().height), ...[...document.querySelectorAll('footer button')].map((b) => Math.round(b.getBoundingClientRect().height))].every((h) => h >= 44)`), true);

    // 3. dialogs: every button >= 44px
    await p.evaluate(`document.querySelector('button[title="Clear or Reset Workout Progress"]').click()`); await sleep(400);
    check(`${key}: Reset dialog buttons all >= 44px`, small(await heights(p, FIXED)), []);
    await shot(p, `${key}-reset-dialog`);
    await p.evaluate(`${FIXED}.querySelectorAll('button')[0].click()`); await sleep(300);
    await p.evaluate(`document.querySelector('header button[title^="About"]').click()`); await sleep(400);
    check(`${key}: About buttons all >= 44px`, small(await heights(p, FIXED)), []);
    const aboutText = await p.evaluate(`Math.min(...[...${FIXED}.querySelectorAll('[data-app-version], [data-log-version], .space-y-3 .font-mono, .space-y-3 .uppercase')].map((el) => parseFloat(getComputedStyle(el).fontSize)))`);
    check(`${key}: About version, dates and tags >= 11px`, aboutText >= 11, true);
    // the close button's visible square stays 32px where it always was, so the (中文) title never runs under it
    check(`${key}: About title never under the close button's visible square`, await p.evaluate(`(() => {
      const box = ${FIXED}.firstElementChild; const sq = box.querySelector(':scope > button > span').getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(box.querySelector('h3'));
      return [...range.getClientRects()].some((t) => t.right > sq.left && t.left < sq.right && t.bottom > sq.top && t.top < sq.bottom);
    })()`), false);
    await shot(p, `${key}-about`);
    await p.evaluate(`${FIXED}.querySelector('button').click()`); await sleep(300);
    await p.evaluate(`document.querySelector('header button[title="View Weekly Report Card"]').click()`); await sleep(500);
    check(`${key}: Weekly report buttons all >= 44px`, small(await heights(p, FIXED)), []);
    // the close button never covers the "x% Cleared" pill
    check(`${key}: report close button clear of the pill`, await p.evaluate(`(() => { const m = ${FIXED}; const x = m.firstElementChild.querySelector(':scope > button').getBoundingClientRect(); const pill = m.querySelector('.overflow-y-auto > div .text-right span').getBoundingClientRect(); return Math.min(x.right, pill.right) - Math.max(x.left, pill.left) <= 0 || Math.min(x.bottom, pill.bottom) - Math.max(x.top, pill.top) <= 0; })()`), true);
    // 2. report footer: a gap between the two texts
    const footer = await p.evaluate(`(() => { const f = ${FIXED}.querySelector('.overflow-y-auto > div').lastElementChild; f.scrollIntoView({ block: 'center' }); const [l, r] = f.children; return Math.round(r.getBoundingClientRect().left - l.getBoundingClientRect().right); })()`);
    check(`${key}: report footer gap >= 8px`, footer >= 8, true);
    await sleep(300);
    await shot(p, `${key}-report-footer`);
    await p.evaluate(`${FIXED}.querySelector('button').click()`); await sleep(300);
    // video dialog
    await p.evaluate(`document.querySelector('main button[aria-label^="${lang === 'zh' ? '动作示范' : 'Form Demo'}"]').click()`); await sleep(500);
    check(`${key}: Video close button >= 44px`, small(await heights(p, FIXED)), []);
    await p.evaluate(`${FIXED}.querySelector('button[aria-label="Close"]').click()`); await sleep(300);

    check(`${key}: the four old v2 keys unchanged byte-for-byte`, await p.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`), v2Before);
    check(`${key}: no page errors`, p.errors, []);
    await chrome.closeTarget(p.targetId);

    // 5. muscle map (phones, touch): 44px view buttons, labels >= 11px, "tap" wording, a tap shows the name
    const t = await open(chrome, w, h, lang, { touch: true });
    await t.evaluate(`[...document.querySelectorAll('main button[aria-expanded]')].find((b) => b.querySelector('.lucide-activity')).click()`); await sleep(400);
    const map = await t.evaluate(`(() => {
      const svg = document.querySelector('main svg[viewBox="0 0 200 220"]'); const box = svg.closest('.rounded-xl');
      box.scrollIntoView({ block: 'center', behavior: 'instant' });
      const scale = svg.getBoundingClientRect().width / 200;
      const title = box.firstElementChild.firstElementChild;
      return { buttons: [...box.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height)), svgLabel: Math.round(parseFloat(svg.querySelector('text').getAttribute('font-size')) * scale * 10) / 10,
        legend: Math.min(...[...box.lastElementChild.querySelectorAll('span, div')].filter((el) => el.innerText.trim()).map((el) => parseFloat(getComputedStyle(el).fontSize))),
        hint: box.querySelector('.font-mono').innerText.trim(), titleOneLine: Math.round(title.getBoundingClientRect().height) <= 18 };
    })()`);
    check(`${key}: muscle map: 3 view buttons 44px, FRONT/BACK >= 11px, legend >= 11px, title on one line, touch wording`,
      [map.buttons, map.svgLabel >= 11, map.legend >= 11, map.titleOneLine, map.hint], [[44, 44, 44], true, true, true, lang === 'zh' ? '点按肌肉查看' : 'Tap a muscle']);
    await sleep(300);
    const pt = await t.evaluate(`(() => { const path = [...document.querySelectorAll('main svg[viewBox="0 0 200 220"] path')].find((x) => x.getAttribute('fill') === '#10b981'); const b = path.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    for (const type of ['touchStart', 'touchEnd']) await t.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [pt] });
    await sleep(400);
    check(`${key}: tapping a highlighted muscle shows its name`, await t.evaluate(`document.querySelector('main svg[viewBox="0 0 200 220"]').closest('.rounded-xl').querySelector('.font-mono').innerText.trim() !== ${JSON.stringify(map.hint)}`), true);
    await shot(t, `${key}-muscle-map`);
    check(`${key}: no page errors (muscle map)`, t.errors, []);
    await chrome.closeTarget(t.targetId);
  }
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
