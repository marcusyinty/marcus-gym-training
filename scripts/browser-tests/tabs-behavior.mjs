// Day tab strip: edge fades, active tab scrolled into view (strip only, page stays put), done dot.
import { launchChrome, sleep } from './cdp.mjs';

const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${JSON.stringify(actual)})`);
};
const FADES = `[...document.querySelectorAll('nav [aria-hidden="true"]')].map((f) => getComputedStyle(f).opacity)`;
const TAB_IN_VIEW = (i) => `(() => { const r = document.querySelectorAll('nav button')[${i}].getBoundingClientRect(); return r.left >= 0 && r.right <= document.documentElement.clientWidth; })()`;

const chrome = await launchChrome(9349, 'profile-tabs');
try {
  for (const [w, lang] of [[360, 'en'], [320, 'zh']]) {
    const page = await chrome.newPage(w, 700);
    await page.goto();
    await page.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', '${lang}'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg');
      localStorage.setItem('aesthetic_recomp_completed_sets_v2', JSON.stringify({ 'leg-press': [0,1,2], 'rdl': [0,1,2], 'bulgarian-split-squat': [0,1,2], 'seated-leg-curl': [0,1,2], 'standing-calf-raises': [0,1,2] }));`);
    await page.reload(3000);
    const tag = `${w} ${lang}:`;
    check(`${tag} at start: right fade on, left fade off`, await page.evaluate(FADES), ['0', '1']);
    check(`${tag} Day 5 starts hidden to the right`, await page.evaluate(TAB_IN_VIEW(4)), false);

    await page.evaluate(`window.scrollTo(0, 900)`); await sleep(300);
    const pageY = await page.evaluate('Math.round(scrollY)');
    await page.evaluate(`document.querySelectorAll('nav button')[4].click()`); await sleep(900);
    check(`${tag} selecting Day 5 scrolls it fully into view`, await page.evaluate(TAB_IN_VIEW(4)), true);
    check(`${tag} ...the page itself did not jump`, await page.evaluate('Math.round(scrollY)'), pageY);
    check(`${tag} ...and the strip now fades on the left, not the right`, await page.evaluate(FADES), ['1', '0']);

    await page.clickButtonByText(lang === 'zh' ? 'EN' : '中文'); await sleep(900);
    check(`${tag} Day 5 stays in view after switching language`, await page.evaluate(TAB_IN_VIEW(4)), true);

    await page.evaluate(`document.querySelectorAll('nav button')[0].click()`); await sleep(900);
    check(`${tag} back to Day 1: fully in view again`, await page.evaluate(TAB_IN_VIEW(0)), true);
    check(`${tag} done dot on Day 2 only`, await page.evaluate(`[...document.querySelectorAll('nav button')].map((b) => !!b.querySelector('span.rounded-full'))`), [false, true, false, false, false]);
    check(`${tag} No page errors`, page.errors, []);
    page.close(); await chrome.closeTarget(page.targetId);
  }
} finally {
  console.log(results.join('\n'));
  chrome.kill();
}
