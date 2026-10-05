// With the rest bar showing, scroll to the very bottom: the last set rows and the footer must be above the bar.
// Also: screenshots (running / finished, EN + 中文) and reduced motion.
import { writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, sleep, SHOTS } from './cdp.mjs';

const OUT = `${SHOTS}/2e-after`;
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${JSON.stringify(actual)})`);
};
const CLOCK = `window.__offset = 0; const realNow = Date.now.bind(Date); Date.now = () => realNow() + window.__offset;`;

const chrome = await launchChrome(9373, 'profile-restcover');
try {
  for (const [w, h] of [[360, 740], [320, 640]]) {
    for (const lang of ['en', 'zh']) {
      const page = await chrome.newPage(w, h);
      await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
      await page.goto();
      await page.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', '${lang}'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg');`);
      await page.reload(3000);
      await page.evaluate(`document.querySelectorAll('nav button')[3].click()`); // Day 4, the longest day
      await sleep(500);
      await page.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[0].click()`);
      await sleep(400);
      await page.evaluate(`window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })`);
      await sleep(500);
      const m = await page.evaluate(`(() => {
        const bar = document.querySelector('[role="timer"]').closest('.h-16').getBoundingClientRect();
        const rows = document.querySelectorAll('[data-set-row]');
        const last = rows[rows.length - 1].getBoundingClientRect();
        const footer = document.querySelector('footer').getBoundingClientRect();
        return { barTop: Math.round(bar.top), lastRowBottom: Math.round(last.bottom), footerBottom: Math.round(footer.bottom), sideScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      })()`);
      check(`${w}x${h} ${lang}: at the bottom of Day 4 the last set row and the footer are above the bar`,
        [m.lastRowBottom <= m.barTop, m.footerBottom <= m.barTop, m.sideScroll], [true, true, 0]);
      console.log(`${w}x${h} ${lang}:`, JSON.stringify(m));
      let shot = await page.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`${OUT}/${w}x${h}-${lang}-running-bottom.png`, Buffer.from(shot.data, 'base64'));

      // finished state
      const left = await page.evaluate(`document.querySelector('[role="timer"]').textContent`);
      const [mm, ss] = left.split(':').map(Number);
      await page.evaluate(`window.__offset += ${(mm * 60 + ss) * 1000}`);
      await sleep(700);
      shot = await page.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`${OUT}/${w}x${h}-${lang}-finished-bottom.png`, Buffer.from(shot.data, 'base64'));
      check(`${w}x${h} ${lang}: finished text`, await page.evaluate(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes(${JSON.stringify(lang === 'zh' ? '休息结束，开始下一组！' : 'Rest over - next set!')}))`), true);
      check(`${w}x${h} ${lang}: no errors`, page.errors, []);
      page.close(); await chrome.closeTarget(page.targetId);
    }
  }

  // Reduced motion: no progress transition, no pulse
  const page = await chrome.newPage(360, 740);
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.goto();
  await page.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en')`);
  await page.reload(3000);
  await page.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[0].click()`); await sleep(400);
  const running = await page.evaluate(`getComputedStyle(document.querySelector('[role="timer"]').closest('.h-16').querySelector('[aria-hidden] > div')).transitionDuration`);
  await page.evaluate(`window.__offset += 121000`); await sleep(700);
  const pulse = await page.evaluate(`getComputedStyle([...document.querySelectorAll('button')].find((b) => b.textContent.includes('Rest over')).querySelector('svg')).animationName`);
  check('reduced motion: no progress transition, no pulse', [running, pulse], ['0s', 'none']);
} finally {
  console.log(results.join('\n'));
  chrome.kill();
}
