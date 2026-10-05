// Step 1D-4: About modal at 320/360, EN/中文 - version, developer-log card layout, footer.
import { writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, sleep, SHOTS } from './cdp.mjs';
const OUT = `${SHOTS}/1d4`;
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)})`}`);
};
const chrome = await launchChrome(9416, 'profile-1d4-about');
try {
  for (const [w, h] of [[360, 740], [320, 640]]) for (const lang of ['en', 'zh']) {
    const key = `${w}-${lang}`;
    const p = await chrome.newPage(w, h);
    await p.goto();
    await p.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', '${lang}'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg');`);
    await p.reload(3000);
    await p.evaluate(`document.querySelector('header button[title^="About"]').click()`); await sleep(500);
    const info = await p.evaluate(`(() => {
      const modal = document.querySelector('.fixed.inset-0');
      const scroller = modal.querySelector('.overflow-y-auto');
      const card = [...scroller.querySelectorAll('h5')][0].closest('.rounded-xl');
      card.scrollIntoView({ block: 'center', behavior: 'instant' });
      const c = card.getBoundingClientRect();
      const title = card.querySelector('h5').getBoundingClientRect();
      const date = card.querySelector('.font-mono').getBoundingClientRect();
      const footer = [...modal.querySelectorAll('span')].find((s) => s.querySelector('svg.lucide-heart'))?.innerText.trim();
      return {
        version: modal.querySelector('[data-app-version]')?.innerText,
        dateText: card.querySelector('.font-mono').innerText.trim(),
        titleWidth: Math.round(title.width), cardInner: Math.round(c.width - 28),
        dateInside: date.right <= c.right - 13 && date.left >= c.left,
        titleBelowDate: title.top >= date.bottom - 1,
        footer,
        sideways: scroller.scrollWidth > scroller.clientWidth + 1,
      };
    })()`);
    console.log(key, JSON.stringify(info));
    check(`${key}: version v1.2.0`, info.version, 'v1.2.0');
    check(`${key}: log title uses the full card width, date fully inside, no sideways scroll`, [info.titleWidth >= info.cardInner - 2, info.dateInside, info.sideways], [true, true, false]);
    check(`${key}: date and footer in the chosen language`, [info.dateText, info.footer], lang === 'en' ? ['September 13, 2026', 'Built for Progressive Overload'] : ['2026年9月13日', '为渐进超负荷而生']);
    await sleep(200);
    const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/about-${w}x${h}-${lang}.png`, Buffer.from(data, 'base64'));
    check(`${key}: no page errors`, p.errors, []);
    await chrome.closeTarget(p.targetId);
  }
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
