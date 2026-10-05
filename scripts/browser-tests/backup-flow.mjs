// Step 1E: back up -> change -> restore, with real taps, the real download and the real file picker.
// Two tabs, cancel, broken files, keep-3 safety copies, no report pop-up, error mode. v2 keys must never change.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { launchChrome, SCRATCH, SNAPSHOT_JS, sleep, FIXTURES, SHOTS } from './cdp.mjs';

const OUT = `${SHOTS}/1e`;
const DL = `${SCRATCH}/downloads-1e`;
const FILES = `${SCRATCH}/files-1e`;
for (const dir of [OUT, FILES]) mkdirSync(dir, { recursive: true });
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });

const V2_KEYS = ['language_preference', 'aesthetic_recomp_completed_sets_v2', 'aesthetic_recomp_set_details_v2', 'aesthetic_recomp_previous_bests_v2'];
const V3 = 'aesthetic_recomp_v3';
const PREFIX = 'aesthetic_recomp_backup_before_restore_';
const recorded = { ...JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8')), language_preference: 'en', aesthetic_recomp_unit_v1: 'kg' };
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)?.slice(0, 400)}, expected ${JSON.stringify(expected)?.slice(0, 400)})`}`);
};
const summarize = (d) => ({
  weeks: 1 + d.archivedCycles.length,
  ticked: [d.currentCycle, ...d.archivedCycles].reduce((n, c) => n + Object.values(c.slots).reduce((m, s) => m + Object.values(s.sets).filter((x) => x.done).length, 0), 0),
});
const countsText = ({ weeks, ticked }) => `${weeks} ${weeks === 1 ? 'week' : 'weeks'} · ${ticked} ticked ${ticked === 1 ? 'set' : 'sets'}`;
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const expectedName = `aesthetic-recomp-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;

const plain = (d) => { const { remarks, ...rest } = d; return remarks && Object.keys(remarks).length ? d : rest; };
const SECTION = `document.querySelector('section[aria-labelledby="data-section-title"]')`;
const PANEL = `document.querySelector('[aria-labelledby="restore-confirm-title"]')`;
const buttonIn = (root, text) => `[...${root}.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(text)})`;

// A real tap: mouse press + release in the middle of the element
const tap = async (p, elJs) => {
  const r = await p.evaluate(`(() => { const el = ${elJs}; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(350);
};
const all = (p) => p.evaluate(`Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]))`);
const v2Of = (store) => V2_KEYS.map((k) => store[k]);
const openAbout = async (p) => { await p.evaluate(`document.querySelector('header button[title^="About"]').click()`); await sleep(400); };
const closeAbout = async (p) => { await p.evaluate(`[...document.querySelectorAll('.fixed.inset-0 button')].find((b) => b.innerText.trim() === 'Close' || b.innerText.trim() === '关闭').click()`); await sleep(300); };
const reportOpen = (p) => p.evaluate(`[...document.querySelectorAll('.fixed.inset-0')].some((el) => el.querySelector('h2'))`);
const message = (p) => p.evaluate(`${SECTION}.querySelector('[aria-live] p')?.innerText.trim() ?? null`);
const shot = async (p, name) => {
  const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
};

// Restore button -> the file picker opens -> the file is chosen
const pickFile = async (p, file) => {
  const opened = new Promise((resolve) => p.onEvent((m) => m.method === 'Page.fileChooserOpened' && resolve(m.params)));
  await tap(p, buttonIn(SECTION, 'Restore from backup'));
  const { backendNodeId } = await Promise.race([opened, sleep(5000).then(() => { throw new Error('file picker did not open'); })]);
  await p.send('DOM.setFileInputFiles', { files: [file.replace(/\//g, '\\')], backendNodeId });
  await sleep(600);
};
const waitForDownload = async () => {
  for (let i = 0; i < 50; i++) {
    const done = readdirSync(DL).filter((f) => !f.endsWith('.crdownload'));
    if (done.length) return done;
    await sleep(100);
  }
  return [];
};

const chrome = await launchChrome(9391, 'profile-1e-flow');
try {
  const a = await chrome.newPage(360, 740);
  await a.send('Page.setInterceptFileChooserDialog', { enabled: true });
  await a.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL.replace(/\//g, '\\') });
  await a.goto();
  await a.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(recorded)})) localStorage.setItem(k, v);`);
  await a.reload(3500);
  const start = await all(a);
  const V2_ORIGINAL = v2Of(recorded);
  check('migrated on load; v2 keys as seeded', [!!start[V3], v2Of(start)], [true, V2_ORIGINAL]);

  // ---------- 1. back up ----------
  const screenAtBackup = await a.evaluate(SNAPSHOT_JS);
  await openAbout(a);
  const sizes = await a.evaluate(`(() => {
    const s = ${SECTION};
    const buttons = [...s.querySelectorAll('button')].map((b) => [b.innerText.trim(), Math.round(b.getBoundingClientRect().height)]);
    const texts = [...s.querySelectorAll('*')].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    return { buttons, minFont: Math.min(...texts.map((el) => parseFloat(getComputedStyle(el).fontSize))), firstInModal: s.parentElement.firstElementChild === s };
  })()`);
  check('"Your data" is the first thing in the About modal; all buttons (incl. Past weeks since 1D-3) >= 44px; all text >= 12px',
    [sizes.firstInModal, sizes.buttons.map(([t]) => t), sizes.buttons.every(([, h]) => h >= 44), sizes.minFont >= 12], [true, ['Back up my data', 'Restore from backup', 'Past weeks (0)'], true, true]);
  console.log('button heights / smallest text:', JSON.stringify(sizes.buttons), sizes.minFont);

  const v3BeforeBackup = (await all(a))[V3];
  await tap(a, buttonIn(SECTION, 'Back up my data'));
  const downloaded = await waitForDownload();
  check('one file downloaded with the local-date name', downloaded, [expectedName]);
  const backupPath = `${DL}/${expectedName}`;
  const backupText = readFileSync(backupPath, 'utf8');
  const backup = JSON.parse(backupText);
  check('file: marker, version, schemaVersion, ISO date, pretty-printed',
    [backup.app, backup.version, backup.schemaVersion, new Date(backup.exportedAt).toISOString() === backup.exportedAt, backupText.startsWith('{\n  "app"')],
    ['aesthetic-recomp-backup', 1, 3, true, true]);
  check('file: data is exactly the saved v3 data; no settings inside', [JSON.stringify(plain(backup.data)) === JSON.stringify(JSON.parse(v3BeforeBackup)), /language_preference|aesthetic_recomp_unit|rest_sound/.test(backupText)], [true, false]);
  check('message names the file', await message(a), `Backup file ${expectedName} created. Look for it in your Downloads.`);
  check('backing up changed nothing in storage', await all(a), start);
  await shot(a, 'flow-en-360-backup-message');
  await closeAbout(a);

  // ---------- 2. change the data ----------
  for (const i of [3, 4, 5]) await a.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[${i}].click()`);
  await a.typeInto(0, '75');
  await sleep(800);
  const changedScreen = await a.evaluate(SNAPSHOT_JS);
  check('the screen really changed', JSON.stringify(changedScreen) !== JSON.stringify(screenAtBackup), true);

  // second tab, opened before the restore
  const b = await chrome.newPage(360, 740);
  await b.goto();
  await sleep(500);
  const bBefore = await b.evaluate(SNAPSHOT_JS);
  check('tab B shows the changed data', JSON.stringify(bBefore) === JSON.stringify(changedScreen), true);
  await a.send('Page.bringToFront');

  // ---------- 3. pick the file, compare, cancel ----------
  await openAbout(a);
  const beforePick = await all(a);
  await pickFile(a, backupPath);
  const cards = await a.evaluate(`[...${PANEL}.querySelectorAll('dl > div')].map((d) => [...d.children].map((c) => c.innerText.trim()))`);
  const current = summarize(JSON.parse(beforePick[V3]));
  check('panel: backup date + backup counts | counts on this phone now', [cards[0][0], cards[0][1].startsWith('Made '), cards[0][2], cards[1]],
    ['Backup file', true, countsText(summarize(backup.data)), ['On this phone now', countsText(current)]]);
  console.log('panel cards:', JSON.stringify(cards));
  check('panel: the two summaries differ (so the user can compare)', cards[0][2] !== cards[1][1], true);
  check('panel: focus moved to the question', await a.evaluate(`document.activeElement?.id`), 'restore-confirm-title');
  check('picking a file changed nothing yet', await all(a), beforePick);
  await shot(a, 'flow-en-360-confirm');
  await tap(a, buttonIn(PANEL, 'Cancel'));
  check('cancel: panel closed, focus back on Restore, storage byte-for-byte the same',
    [await a.evaluate(`!!${PANEL}`), await a.evaluate(`document.activeElement?.innerText.trim()`), JSON.stringify(await all(a)) === JSON.stringify(beforePick)], [false, 'Restore from backup', true]);

  // ---------- 4. restore for real ----------
  await pickFile(a, backupPath);
  await tap(a, buttonIn(PANEL, 'Replace my data'));
  const afterRestore = await all(a);
  const copies = Object.keys(afterRestore).filter((k) => k.startsWith(PREFIX));
  check('restored: message', await message(a), 'Done! Your workouts were restored from the backup.');
  check('restored: v3 key holds the backup data', JSON.stringify(JSON.parse(afterRestore[V3])) === JSON.stringify(plain(backup.data)), true);
  check('restored: one safety copy = the v3 text right before the restore', [copies.length, afterRestore[copies[0]] === beforePick[V3]], [1, true]);
  check('restored: v2 keys, unit and every other key untouched',
    Object.keys(afterRestore).filter((k) => k !== V3 && !k.startsWith(PREFIX)).map((k) => [k, afterRestore[k] === beforePick[k]]),
    Object.keys(beforePick).filter((k) => k !== V3).map((k) => [k, true]));
  check('restored: no weekly report pop-up', await reportOpen(a), false);
  await shot(a, 'flow-en-360-restored');
  await closeAbout(a);
  check('screen is back to the backed-up state', JSON.stringify(await a.evaluate(SNAPSHOT_JS)) === JSON.stringify(screenAtBackup), true);

  await b.send('Page.bringToFront');
  await sleep(600);
  const bAfter = await b.evaluate(SNAPSHOT_JS);
  check('tab B adopted the restored data (no reload)', JSON.stringify(bAfter) === JSON.stringify(screenAtBackup), true);
  await sleep(800);
  check('tab B wrote nothing back', (await all(b))[V3] === afterRestore[V3], true);
  await a.send('Page.bringToFront');
  await a.reload(3000);
  check('after a reload tab A still shows the restored data', JSON.stringify(await a.evaluate(SNAPSHOT_JS)) === JSON.stringify(screenAtBackup), true);

  // ---------- 5. broken files: a message, nothing changes ----------
  const file = (name, text) => { writeFileSync(`${FILES}/${name}`, text); return `${FILES}/${name}`; };
  const withData = (o) => JSON.stringify({ ...backup, ...o }, null, 2);
  const broken = [
    ['truncated.json', backupText.slice(0, Math.floor(backupText.length / 2)), "This file can't be read as a backup."],
    ['not-a-backup.json', '{"hello":"world"}', "This file isn't a backup from this app."],
    ['wrong-version.json', withData({ version: 2 }), 'This backup comes from an unknown version of the app.'],
    ['missing-data.json', withData({ data: undefined }), 'This backup file contains no workout data.'],
    ['bad-data.json', withData({ data: { schemaVersion: 3 } }), "The workout data in this file can't be used."],
    ['too-big.json', withData({ padding: 'x'.repeat(5 * 1024 * 1024) }), 'This file is too large (over 5 MB) to be a backup.'],
    ['proto-keys.json', withData({ __proto__: { polluted: true } }).replace('"data": {', '"data": {\n    "__proto__": { "polluted": true },'), null],
  ];
  await openAbout(a);
  for (const [name, text, expected] of broken) {
    const before = await all(a);
    await pickFile(a, file(name, text));
    if (expected) {
      check(`${name}: message, no panel, nothing changed`, [await message(a), await a.evaluate(`!!${PANEL}`), JSON.stringify(await all(a)) === JSON.stringify(before)], [expected, false, true]);
    } else {
      check(`${name}: accepted as plain data, nothing polluted`, [await a.evaluate(`!!${PANEL}`), await a.evaluate(`({}).polluted === undefined && Object.prototype.polluted === undefined`)], [true, true]);
      await tap(a, buttonIn(PANEL, 'Cancel'));
    }
    if (name === 'truncated.json') await shot(a, 'flow-en-360-error');
  }

  // ---------- 6. keep only 3 safety copies ----------
  const copyTimes = [];
  for (let i = 0; i < 4; i++) {
    await pickFile(a, backupPath);
    await tap(a, buttonIn(PANEL, 'Replace my data'));
    copyTimes.push(...Object.keys(await all(a)).filter((k) => k.startsWith(PREFIX)));
    await sleep(20);
  }
  const finalCopies = Object.keys(await all(a)).filter((k) => k.startsWith(PREFIX)).sort();
  const everCopies = [...new Set(copyTimes)].sort();
  check('5 restores in total -> only the 3 newest safety copies remain', [everCopies.length, finalCopies], [5, everCopies.slice(-3)]);
  check('v2 keys still byte-for-byte the seeded text', v2Of(await all(a)), V2_ORIGINAL);
  await closeAbout(a);

  // ---------- 7. a restored complete week never pops up; the user's own completing tick does ----------
  for (let day = 0; day < 5; day++) {
    await a.evaluate(`document.querySelectorAll('nav button')[${day}].click()`); await sleep(300);
    await a.evaluate(`[...document.querySelectorAll('[data-set-row] button[aria-pressed="false"]')].forEach((btn) => btn.click())`); await sleep(300);
  }
  await sleep(500);
  check('ticking everything myself opens the report (normal behaviour)', await reportOpen(a), true);
  await a.evaluate(`[...document.querySelectorAll('.fixed.inset-0')].find((el) => el.querySelector('h2')).querySelector('button').click()`); await sleep(300);
  const completeData = JSON.parse((await all(a))[V3]);
  const completeFile = file('complete-week.json', JSON.stringify({ ...backup, data: { ...completeData, reportShownCycleIds: [] } }, null, 2));
  // back to the incomplete backup, then restore the complete week
  await openAbout(a);
  await pickFile(a, backupPath); await tap(a, buttonIn(PANEL, 'Replace my data'));
  await pickFile(a, completeFile); await tap(a, buttonIn(PANEL, 'Replace my data'));
  await closeAbout(a);
  await sleep(500);
  check('restoring a complete week (report never shown) does not pop up', await reportOpen(a), false);
  await a.evaluate(`document.querySelectorAll('nav button')[0].click()`); await sleep(300);
  await a.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[0].click()`); await sleep(400);
  await a.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[0].click()`); await sleep(600);
  check('...but untick + tick again (my own change completes it) does', await reportOpen(a), true);

  check('no page errors', [a.errors, b.errors], [[], []]);
  check('final: v2 keys byte-for-byte the seeded text', v2Of(await all(a)), V2_ORIGINAL);
  await chrome.closeTarget(a.targetId); await chrome.closeTarget(b.targetId); await sleep(500);

  // ---------- 8. error mode ----------
  const FAIL_ONCE = `const realToISO = Date.prototype.toISOString; Date.prototype.toISOString = function () { if (!window.__failedOnce && this.getTime() !== 0) { window.__failedOnce = true; throw new RangeError('injected for the test'); } return realToISO.call(this); };`;
  const e = await chrome.newPage(360, 740);
  await e.send('Page.setInterceptFileChooserDialog', { enabled: true });
  await e.goto();
  await e.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(recorded)})) localStorage.setItem(k, v);`);
  await e.send('Page.addScriptToEvaluateOnNewDocument', { source: FAIL_ONCE });
  await e.reload(3500);
  const eStart = await all(e);
  check('error mode: banner shown, nothing saved', [await e.evaluate(`!!document.querySelector('main [role="status"]')`), eStart[V3]], [true, undefined]);
  await openAbout(e);
  check('error mode: Back up disabled with the explanation; Restore allowed',
    [await e.evaluate(`${buttonIn(SECTION, 'Back up my data')}.disabled`), await e.evaluate(`document.getElementById('backup-unavailable')?.innerText.trim().startsWith('Backup is off for now')`), await e.evaluate(`${buttonIn(SECTION, 'Restore from backup')}.disabled`)],
    [true, true, false]);
  await shot(e, 'flow-en-360-error-mode');
  await pickFile(e, backupPath);
  const eCards = await e.evaluate(`[...${PANEL}.querySelectorAll('dl > div')].map((d) => [...d.children].map((c) => c.innerText.trim()))`);
  check('error mode: "on this phone now" says it could not be read', eCards[1], ['On this phone now', "Couldn't be read"]);
  await tap(e, buttonIn(PANEL, 'Replace my data'));
  const eAfter = await all(e);
  check('error mode restore: saved, banner gone, Back up enabled, no safety copy (nothing was saved before)',
    [JSON.stringify(JSON.parse(eAfter[V3])) === JSON.stringify(plain(backup.data)), await e.evaluate(`!!document.querySelector('main [role="status"]')`), await e.evaluate(`${buttonIn(SECTION, 'Back up my data')}.disabled`), Object.keys(eAfter).filter((k) => k.startsWith(PREFIX))],
    [true, false, false, []]);
  await closeAbout(e);
  await e.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[5].click()`);
  await sleep(700);
  check('error mode: saving works again after the restore', (await all(e))[V3] !== eAfter[V3], true);
  check('error mode: v2 keys untouched', v2Of(await all(e)), V2_ORIGINAL);
  const f = await chrome.newPage(360, 740); // a normal reload (without the test injection)
  await f.goto();
  check('after a reload: restored data loads normally, no banner', [await f.evaluate(`!!document.querySelector('main [role="status"]')`), f.errors], [false, []]);
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
