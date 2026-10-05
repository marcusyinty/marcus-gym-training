// Step 6 rollback safety: data with body measurements opened in the released v1.3.0 (V130_URL, port 3003) and
// v1.2.0 (V120_URL, port 3001), used there with real taps (tick, Reset day, Reset all, Start new week, backup,
// restores), then opened in step 6 again. A version that is not served is skipped. All data made up.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { launchChrome, sleep, APP, SCRATCH } from './cdp.mjs';
import { historyData } from './fixtures/seed.mjs';

const OLD = [
  ['v1.3.0', process.env.V130_URL ?? 'http://localhost:3003/'],
  ['v1.2.0', process.env.V120_URL ?? 'http://localhost:3001/'],
];
const V3 = 'aesthetic_recomp_v3';
const RAW = 'aesthetic_recomp_backup_aesthetic_recomp_v3_raw';
const SAFETY = 'aesthetic_recomp_backup_before_restore_';
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)?.slice(0, 400)}, expected ${JSON.stringify(expected)?.slice(0, 400)})`}`);
};
const pad = (n) => String(n).padStart(2, '0');
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const Q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const tap = async (p, elJs) => {
  const r = await p.evaluate(`(() => { const el = ${elJs}; if (!el) throw new Error('not found: ' + ${JSON.stringify(elJs)}); el.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(400);
};
const v3 = (p) => p.evaluate(`JSON.parse(localStorage.getItem('${V3}'))`);
const bodyText = (p) => p.evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('${V3}')).body ?? null)`);
const SECTION = Q('section[aria-labelledby="data-section-title"]');
const buttonIn = (root, label) => `[...${root}.querySelectorAll('button')].find((el) => el.innerText.trim() === ${JSON.stringify(label)})`;
const tick = async (p) => {
  await tap(p, `[...document.querySelectorAll('main [data-set-row] button[aria-pressed="false"]')][0]`);
  await p.evaluate(`${Q('[data-tag-prompt-dismiss]')}?.click()`); // v1.3.0 asks for a tag
  await sleep(200);
};
const closeModal = (p) => p.evaluate(`[...document.querySelectorAll('.fixed.inset-0 button')].find((el) => el.innerText.trim() === 'Close')?.click()`).then(() => sleep(300));
const answers = (url) => fetch(url).then((r) => r.ok).catch(() => false);

const seeded = {
  ...historyData(),
  body: {
    entries: { [daysAgo(1)]: { weight: { value: '72.4', unit: 'kg' }, waist: { value: '80', unit: 'cm' }, updatedAt: '2026-10-05T07:00:00.000Z' }, [daysAgo(6)]: { weight: { value: '160', unit: 'lbs' } } },
    height: { value: '181', unit: 'cm' },
  },
};
const original = JSON.stringify(seeded.body);

const chrome = await launchChrome(9570, 'profile-6-rollback');
try {
  for (const [version, url] of OLD) {
    if (!(await answers(url))) {
      results.push(`SKIP  ${version}: nothing served at ${url} (see README, Rollback checks)`);
      continue;
    }
    const DL = `${SCRATCH}/dl-6-rollback-${version}`;
    rmSync(DL, { recursive: true, force: true });
    mkdirSync(DL, { recursive: true });
    const o = await chrome.newPage(360, 740);
    await o.send('Page.setInterceptFileChooserDialog', { enabled: true });
    await o.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL.replace(/\//g, '\\') });
    await o.goto(url);
    await o.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg'); localStorage.setItem('${V3}', ${JSON.stringify(JSON.stringify(seeded))});`);
    await o.reload(3000);
    check(`${version} is what runs there (no Body button)`, await o.evaluate(`!!${Q('[data-body-open]')}`), false);
    check(`${version} opens step 6 data without writing it and without a repair copy (body data is not "broken" to it)`,
      [await o.evaluate(`localStorage.getItem('${V3}')`) === JSON.stringify(seeded), await o.evaluate(`localStorage.getItem('${RAW}')`)], [true, null]);

    await tick(o);
    check(`${version} tick a set: saved, body data kept byte-for-byte`, [Object.keys((await v3(o)).currentCycle.slots).length > 0, await bodyText(o)], [true, original]);
    const RESET = `[...document.querySelectorAll('[aria-labelledby="reset-modal-title"] button')]`;
    await tap(o, Q('button[title="Clear or Reset Workout Progress"]'));
    await tap(o, `${RESET}[1]`);
    check(`${version} Reset day: body data kept`, await bodyText(o), original);
    await tick(o);
    await tap(o, Q('button[title="Clear or Reset Workout Progress"]'));
    await tap(o, `${RESET}[2]`);
    check(`${version} Reset all: body data kept`, await bodyText(o), original);
    await tick(o);
    const weeks = (await v3(o)).archivedCycles.length;
    await tap(o, Q('header button[title="View Weekly Report Card"]'));
    await tap(o, `[...document.querySelectorAll('.fixed.inset-0 button')].find((b) => b.innerText.trim() === 'Start new week')`);
    await tap(o, `[...document.querySelectorAll('[role=alertdialog] button')].find((b) => b.innerText.trim() === 'Start new week')`);
    await sleep(400);
    check(`${version} Start new week: one more past week, body data kept`, [(await v3(o)).archivedCycles.length, await bodyText(o)], [weeks + 1, original]);
    await closeModal(o);

    // A backup made in the old version carries the body data; restoring it there keeps it
    await tap(o, Q('header button[title^="About"]'));
    await tap(o, buttonIn(SECTION, 'Back up my data'));
    let files = [];
    for (let i = 0; i < 50 && !(files = readdirSync(DL).filter((f) => f.endsWith('.json'))).length; i++) await sleep(100);
    const oldFile = `${DL}/${files[0]}`;
    check(`${version} its backup file carries the body data`, JSON.stringify(JSON.parse(readFileSync(oldFile, 'utf8')).data.body), original);
    const restore = async (path) => {
      const opened = new Promise((resolve) => o.onEvent((m) => m.method === 'Page.fileChooserOpened' && resolve(m.params)));
      await tap(o, buttonIn(SECTION, 'Restore from backup'));
      const { backendNodeId } = await opened;
      await o.send('DOM.setFileInputFiles', { files: [path.replace(/\//g, '\\')], backendNodeId });
      await sleep(600);
      await tap(o, buttonIn(Q('[aria-labelledby="restore-confirm-title"]'), 'Replace my data'));
    };
    await restore(oldFile);
    check(`${version} restoring that file there: body data kept`, await bodyText(o), original);
    const afterOld = await o.evaluate(`localStorage.getItem('${V3}')`);
    check(`${version} no page errors`, o.errors, []);

    // Back in step 6 with what the old version saved: everything shows
    const n = await chrome.newPage(360, 740);
    await n.goto(APP);
    await n.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg'); localStorage.setItem('${V3}', ${JSON.stringify(afterOld)});`);
    await n.reload(2500);
    await tap(n, Q('[data-body-open]'));
    check(`step 6 after ${version}: every entry and the height are back on screen`,
      [await n.evaluate(`[...document.querySelectorAll('[data-body-row]')].map((r) => r.dataset.bodyRow + ' ' + r.querySelector('[data-body-row-values]').innerText.trim())`), await n.evaluate(`${Q('[data-body-height-value]')}.innerText.trim()`)],
      [[`${daysAgo(1)} 72.4 kg · waist 80 cm`, `${daysAgo(6)} 72.6 kg`], '181 cm']);
    check(`step 6 after ${version}: loaded without writing, no repair copy`, [await n.evaluate(`localStorage.getItem('${V3}')`) === afterOld, await n.evaluate(`localStorage.getItem('${RAW}')`)], [true, null]);
    check(`step 6 after ${version}: no page errors`, n.errors, []);
    await chrome.closeTarget(n.targetId);

    // The one way to lose it in the old version: restoring a backup made BEFORE step 6 (no body field) there.
    // The old version replaces everything; its safety copy (made right before) still has the body data.
    const preStep6 = `${DL}/synthetic-pre-step6-backup.json`;
    writeFileSync(preStep6, JSON.stringify({ app: 'aesthetic-recomp-backup', version: 1, exportedAt: '2026-09-30T08:00:00.000Z', schemaVersion: 3, data: historyData() }));
    await restore(preStep6);
    const safety = await o.evaluate(`(() => { const k = Object.keys(localStorage).filter((k) => k.startsWith('${SAFETY}')).sort().at(-1); return JSON.stringify(JSON.parse(localStorage.getItem(k)).body ?? null); })()`);
    check(`${version} KNOWN: restoring a pre-step-6 backup there removes the body data; its safety copy still holds it`, [await bodyText(o), safety], ['null', original]);
    check(`${version} no page errors (after the restores)`, o.errors, []);
    await chrome.closeTarget(o.targetId);
  }
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed${results.some((r) => r.startsWith('SKIP')) ? `, ${results.filter((r) => r.startsWith('SKIP')).length} skipped` : ''}`);
  chrome.kill();
}
