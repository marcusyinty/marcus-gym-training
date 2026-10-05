// Step 4: the weekly report with Max tags. Same week with and without tags -> on-screen check + PNG sizes.
// Usage: node 4-report.mjs <label> <baseUrl> <port>
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { launchChrome, SCRATCH, sleep, SHOTS, APP, isKnownImageNotice } from './cdp.mjs';
import { set, slot } from './fixtures/seed.mjs';

const [label, base, port] = [process.argv[2] ?? 'branch', process.argv[3] ?? APP, Number(process.argv[4] ?? 9452)];
const OUT = `${SHOTS}/4`;
mkdirSync(OUT, { recursive: true });
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

// This week: incline (Max on set 2), lat pulldown (Max on sets 1 and 3), leg press (no Max)
const tagged = () => ({
  schemaVersion: 3,
  currentCycle: {
    id: 'week-now',
    startedAt: '2026-10-05T06:00:00.000Z',
    slots: {
      'incline-db-press': slot('incline-db-press', { 0: set('60', '10', { tag: 'good' }), 1: set('62.5', '8', { tag: 'max' }), 2: set('62.5', '7', { tag: 'easy' }) }),
      'lat-pulldown': slot('lat-pulldown', { 0: set('55', '10', { tag: 'max' }), 1: set('55', '9'), 2: set('50', '10', { tag: 'max' }) }),
      'leg-press': slot('leg-press', { 0: set('150', '10', { tag: 'good' }), 1: set('150', '9') }),
    },
  },
  archivedCycles: [],
  bests: {},
  reportShownCycleIds: [],
});
const untagged = () => JSON.parse(JSON.stringify(tagged(), (key, value) => (key === 'tag' ? undefined : value)));

const chrome = await launchChrome(port, `profile-4-report-${label}`);
const sizes = {};
try {
  for (const [w, h] of [[360, 740], [320, 640]]) {
    for (const lang of ['en', 'zh']) {
      for (const [name, data] of [['tagged', tagged()], ['untagged', untagged()]]) {
        const key = `${w}-${lang}-${name}`;
        const dl = `${SCRATCH}/dl-4-${label}-${key}`;
        rmSync(dl, { recursive: true, force: true });
        mkdirSync(dl, { recursive: true });
        const p = await chrome.newPage(w, h);
        await p.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dl.replace(/\//g, '\\') });
        await p.goto(base);
        await p.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', '${lang}'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg'); localStorage.setItem('aesthetic_recomp_v3', ${JSON.stringify(JSON.stringify(data))});`);
        await p.reload(3000);
        await tap(p, `document.querySelector('header button[title="View Weekly Report Card"]')`);
        await sleep(400);
        const lines = await p.evaluate(`[...${REPORT}.querySelectorAll('[data-report-max]')].map((l) => [l.parentElement.querySelector('span').innerText.trim(), l.innerText.trim()])`);
        const expected = name === 'untagged' ? [] : lang === 'en'
          ? [['Incline DB Press', 'Max on set 2'], ['Lat Pulldown', 'Max on sets 1, 3']]
          : [['上斜哑铃卧推', '第 2 组到达极限'], ['高位下拉', '第 1、3 组到达极限']];
        check(`${label} ${key}: Max lines`, lines, expected);
        const numbers = await p.evaluate(`[...${REPORT}.querySelectorAll('.grid .font-mono')].map((s) => s.innerText.trim())`);
        sizes[`${key}-numbers`] = numbers;
        if (name === 'tagged') {
          await p.evaluate(`${REPORT}.querySelector('[data-report-max]').scrollIntoView({ block: 'center', behavior: 'instant' })`);
          await sleep(200);
          const { data: shot } = await p.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(`${OUT}/report-${label}-${w}x${h}-${lang}.png`, Buffer.from(shot, 'base64'));
        }
        await tap(p, `[...${REPORT}.querySelectorAll('button')].find((b) => b.querySelector('svg') && b.className.includes('from-emerald-500 to-cyan-500'))`);
        let files = [];
        for (let i = 0; i < 100 && !(files = readdirSync(dl).filter((f) => f.endsWith('.png'))).length; i++) await sleep(100);
        check(`${label} ${key}: one PNG downloaded`, files.length, 1);
        if (files.length) {
          const target = `${OUT}/export-${label}-${key}.png`;
          copyFileSync(`${dl}/${files[0]}`, target);
          sizes[key] = pngSize(target);
        }
        const errors = p.errors.filter((e) => !isKnownImageNotice(e));
        check(`${label} ${key}: no page errors`, errors, []);
        await chrome.closeTarget(p.targetId);
      }
      // Tags change no number in the report
      check(`${label} ${w}-${lang}: report numbers identical with and without tags`, sizes[`${w}-${lang}-tagged-numbers`], sizes[`${w}-${lang}-untagged-numbers`]);
    }
  }
} finally {
  writeFileSync(`${OUT}/export-sizes-${label}.json`, JSON.stringify(sizes, null, 2));
  for (const [k, v] of Object.entries(sizes)) if (!k.endsWith('-numbers')) console.log(k.padEnd(24), `${v.width}x${v.height}`);
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
