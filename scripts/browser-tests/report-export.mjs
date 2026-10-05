// Step 1D-4: the weekly report on screen + the downloaded PNG, for one build.
// Usage: node report-export.mjs <label> <baseUrl> <port>
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { launchChrome, SCRATCH, sleep, FIXTURES, SHOTS } from './cdp.mjs';

const [label, base, port] = [process.argv[2], process.argv[3], Number(process.argv[4])];
const OUT = `${SHOTS}/1d4`;
mkdirSync(OUT, { recursive: true });
const recorded = { ...JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8')), language_preference: 'en', aesthetic_recomp_unit_v1: 'kg' };
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)?.slice(0, 300)})`}`);
};
const tap = async (p, elJs) => {
  const r = await p.evaluate(`(() => { const el = ${elJs}; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(300);
};
const pngSize = (file) => {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};
const REPORT = `[...document.querySelectorAll('.fixed.inset-0')].find((el) => el.querySelector('h2'))`;

const chrome = await launchChrome(port, `profile-1d4-export-${label}`);
const sizes = {};
try {
  for (const [w, h] of [[360, 740], [320, 640]]) {
    for (const lang of ['en', 'zh']) {
      const key = `${w}-${lang}`;
      const dl = `${SCRATCH}/dl-1d4-${label}-${key}`;
      rmSync(dl, { recursive: true, force: true });
      mkdirSync(dl, { recursive: true });
      const p = await chrome.newPage(w, h);
      await p.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dl.replace(/\//g, '\\') });
      await p.goto(base);
      await p.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify({ ...recorded, language_preference: lang })})) localStorage.setItem(k, v);`);
      await p.reload(3500);
      await tap(p, `document.querySelector('button[title="View Weekly Report Card"]')`);
      await sleep(400);
      // On screen: does the card fit? (anything sticking out to the right of the card or its scroll area)
      const fit = await p.evaluate(`(() => {
        const m = ${REPORT};
        const scroller = m.querySelector('.overflow-y-auto');
        const card = scroller.firstElementChild;
        const box = scroller.getBoundingClientRect();
        const cardBox = card.getBoundingClientRect();
        const outside = [...card.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > cardBox.right + 0.5; })
          .map((el) => (el.innerText || el.tagName).trim().slice(0, 30));
        return { sideways: scroller.scrollWidth > scroller.clientWidth + 1, cardFits: cardBox.right <= box.right + 0.5, outside: outside.slice(0, 6), cardWidth: Math.round(cardBox.width), tileColumns: getComputedStyle(card.querySelector('.grid')).gridTemplateColumns.split(' ').length };
      })()`);
      console.log(`${label} ${key} on screen:`, JSON.stringify(fit));
      check(`${label} ${key}: card fits the screen (nothing to the right, no sideways scroll)`, [fit.sideways, fit.cardFits, fit.outside], [false, true, []]);
      const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`${OUT}/screen-${label}-${w}x${h}-${lang}.png`, Buffer.from(data, 'base64'));

      // The image: tap Download, then find the saved PNG
      const scrollBefore = await p.evaluate(`[document.documentElement.scrollWidth, document.documentElement.scrollHeight]`);
      await tap(p, `[...${REPORT}.querySelectorAll('button')].find((b) => b.querySelector('svg') && b.className.includes('from-emerald-500 to-cyan-500'))`);
      let files = [];
      for (let i = 0; i < 100 && !(files = readdirSync(dl).filter((f) => f.endsWith('.png'))).length; i++) await sleep(100);
      check(`${label} ${key}: one PNG downloaded`, files.length, 1);
      if (!files.length) continue;
      const target = `${OUT}/export-${label}-${w}x${h}-${lang}.png`;
      copyFileSync(`${dl}/${files[0]}`, target);
      sizes[key] = pngSize(target);
      await sleep(500);
      const after = await p.evaluate(`({ copies: document.querySelectorAll('[inert][aria-hidden="true"]').length, scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], focusInCopy: !!document.activeElement?.closest('[inert]') })`);
      check(`${label} ${key}: off-screen copy gone afterwards, page scroll size unchanged, focus never inside it`, [after.copies, after.scroll, after.focusInCopy], [0, scrollBefore, false]);
      const errors = p.errors.filter((e) => !e.startsWith('Error inlining remote css file') && !e.startsWith('Error while reading CSS rules from https://fonts.googleapis.com/'));
      check(`${label} ${key}: no page errors (apart from the 2 known font-stylesheet notices from the image library)`, errors, []);
      await chrome.closeTarget(p.targetId);
    }
  }
} finally {
  writeFileSync(`${OUT}/export-sizes-${label}.json`, JSON.stringify(sizes, null, 2));
  console.log('PNG sizes:', JSON.stringify(sizes));
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
