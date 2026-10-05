// Compact card details: cue + Muscle Map toggles, tap target and text sizes, and the no-video placeholder.
import { writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, sleep, SHOTS } from './cdp.mjs';

const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${JSON.stringify(actual)})`);
};
const OUT = `${SHOTS}/2b-after`;
mkdirSync(OUT, { recursive: true });
const card = `document.querySelector('main .space-y-6').children[0]`;

const chrome = await launchChrome(9356, 'profile-compact');
try {
  for (const lang of ['en', 'zh']) {
    const page = await chrome.newPage(360, 740);
    // Pretend the first exercise has no video: rename its id in the video list module (browser-only, no file changes)
    await page.send('Network.enable');
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.send('Fetch.enable', { patterns: [{ urlPattern: '*exerciseVideos.json*', requestStage: 'Response' }] });
    page.onEvent(async (msg) => {
      if (msg.method !== 'Fetch.requestPaused') return;
      const { body, base64Encoded } = await page.send('Fetch.getResponseBody', { requestId: msg.params.requestId });
      const original = base64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
      // Vite serves the JSON as JSON.parse("..."), so the quotes around the id may be escaped (\")
      const text = original.replace(/(\\?")incline-db-press(\\?")/g, '$1incline-db-press-missing$2');
      console.log('  intercepted video list; id renamed:', text !== original);
      await page.send('Fetch.fulfillRequest', { requestId: msg.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }], body: Buffer.from(text).toString('base64') });
    });
    await page.goto();
    await page.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', '${lang}'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg');`);
    await page.reload(3500);

    check(`${lang}: card 1 without a video shows the placeholder (no button, no image)`,
      await page.evaluate(`({ placeholder: !!${card}.querySelector('div[aria-hidden="true"] svg'), thumbButton: !!${card}.querySelector('button[aria-label]'), img: !!${card}.querySelector('img') })`),
      { placeholder: true, thumbButton: false, img: false });
    check(`${lang}: card 2 has a thumbnail button labelled with the exercise name`,
      await page.evaluate(`document.querySelector('main .space-y-6').children[1].querySelector('button[aria-label]').getAttribute('aria-label')`),
      lang === 'zh' ? '动作示范: 高位下拉' : 'Form Demo: Lat Pulldown');

    const sizes = await page.evaluate(`(() => {
      const c = document.querySelector('main .space-y-6').children[1];
      const thumb = c.querySelector('button[aria-label]').getBoundingClientRect();
      const toggles = [...c.querySelectorAll('button[aria-expanded]')].map((b) => Math.round(b.getBoundingClientRect().height));
      const header = c.querySelector('.flex.gap-3');
      const texts = [...header.querySelectorAll('*'), ...c.querySelectorAll('button[aria-expanded] *')]
        .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
        .map((el) => parseFloat(getComputedStyle(el).fontSize));
      return { thumb: [Math.round(thumb.width), Math.round(thumb.height)], toggles, smallestText: Math.min(...texts) };
    })()`);
    check(`${lang}: thumbnail 72x96, cue + Muscle Map toggles >= 40px, new text >= 12px`,
      [sizes.thumb, sizes.toggles.every((h) => h >= 40), sizes.smallestText >= 12], [[72, 96], true, true]);
    console.log(`${lang} sizes:`, JSON.stringify(sizes));

    // Cue: at most 2 lines when collapsed; after a tap nothing is cut off (checked on every card of Day 1)
    const cueState = `[...document.querySelectorAll('main .space-y-6 > *')].map((c) => { const s = c.querySelectorAll('button[aria-expanded]')[0].querySelector('span');
      return { lines: Math.round(s.getBoundingClientRect().height / parseFloat(getComputedStyle(s).lineHeight)), hidden: s.scrollHeight > s.clientHeight + 1 }; })`;
    const collapsed = await page.evaluate(cueState);
    await page.evaluate(`document.querySelectorAll('main .space-y-6 > *').forEach((c) => c.querySelectorAll('button[aria-expanded]')[0].click())`); await sleep(300);
    const expanded = await page.evaluate(cueState);
    check(`${lang}: every cue is at most 2 lines collapsed; expanded nothing is cut off`,
      [collapsed.every((c) => c.lines <= 2), expanded.every((c) => !c.hidden), collapsed.some((c) => c.hidden)], [true, true, true]);
    console.log(`  ${lang} cue lines collapsed -> expanded:`, collapsed.map((c, i) => c.lines + '->' + expanded[i].lines).join(' '));

    check(`${lang}: Muscle Map closed by default (no map in the card)`, await page.evaluate(`!!document.querySelector('main .space-y-6').children[1].querySelector('svg[viewBox="0 0 200 220"]')`), false);
    await page.evaluate(`document.querySelector('main .space-y-6').children[1].querySelectorAll('button[aria-expanded]')[1].click()`); await sleep(300);
    check(`${lang}: Muscle Map toggle opens the map + secondary muscles`,
      await page.evaluate(`(() => { const c = document.querySelector('main .space-y-6').children[1]; return { map: !!c.querySelector('svg[viewBox="0 0 200 220"]'), chips: c.querySelectorAll('.bg-zinc-800\\\\/80').length > 0 }; })()`),
      { map: true, chips: true });
    await page.evaluate(`window.scrollTo(0, document.querySelector('main .space-y-6').children[1].getBoundingClientRect().top + scrollY - 120)`); await sleep(400);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/360x740-${lang}-expanded-cue-and-map.png`, Buffer.from(data, 'base64'));
    await page.evaluate(`window.scrollTo(0, 0)`); await sleep(300);
    const top = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/360x740-${lang}-placeholder.png`, Buffer.from(top.data, 'base64'));
    check(`${lang}: no page errors, no video elements`, [page.errors, await page.evaluate(`document.querySelectorAll('video').length`)], [[], 0]);
    page.close(); await chrome.closeTarget(page.targetId);
  }
} finally {
  console.log(results.join('\n'));
  chrome.kill();
}
