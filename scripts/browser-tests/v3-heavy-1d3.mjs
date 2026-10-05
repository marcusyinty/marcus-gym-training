// Heavy use incl. backup + restore (step 1E): the 4 v2 keys must stay byte-for-byte the same throughout.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { launchChrome, SCRATCH, sleep, FIXTURES, SHOTS } from './cdp.mjs';

const V2_KEYS = ['language_preference', 'aesthetic_recomp_completed_sets_v2', 'aesthetic_recomp_set_details_v2', 'aesthetic_recomp_previous_bests_v2'];
const PREFIX = 'aesthetic_recomp_backup_before_restore_';
const DL = `${SCRATCH}/downloads-1e-heavy`;
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });
const seed = { ...JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8')), language_preference: 'en', aesthetic_recomp_unit_v1: 'kg' };
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${JSON.stringify(actual)?.slice(0, 300)})`);
};
// A backup always carries notes and body measurements (step 6); empty ones are saved as no field at all
const plain = (d) => {
  const { remarks, body, ...rest } = d;
  return {
    ...rest,
    ...(remarks && Object.keys(remarks).length && { remarks }),
    ...(body && (body.height || Object.keys(body.entries ?? {}).length) && { body }),
  };
};
const SECTION = `document.querySelector('section[aria-labelledby="data-section-title"]')`;
const PANEL = `document.querySelector('[aria-labelledby="restore-confirm-title"]')`;
const buttonIn = (root, text) => `[...${root}.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(text)})`;
const T = {
  en: { backup: 'Back up my data', restore: 'Restore from backup', replace: 'Replace my data', cancel: 'Cancel', close: 'Close' },
  zh: { backup: '备份我的数据', restore: '从备份恢复', replace: '替换我的数据', cancel: '取消', close: '关闭' },
};

const chrome = await launchChrome(9408, 'profile-1d3-heavy');
try {
  const p = await chrome.newPage(360, 740);
  await p.send('Page.setInterceptFileChooserDialog', { enabled: true });
  await p.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL.replace(/\//g, '\\') });
  await p.goto();
  await p.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(seed)})) localStorage.setItem(k, v);`);
  const v2 = () => p.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`);
  const original = await v2();
  const tick = (i) => p.evaluate(`document.querySelectorAll('[data-set-row] button[aria-pressed]')[${i}].click()`);
  const day = async (i) => { await p.evaluate(`document.querySelectorAll('nav button')[${i}].click()`); await sleep(400); };
  const unit = (u) => p.evaluate(`[...document.querySelectorAll('main button')].find((b) => b.innerText.trim() === '${u}').click()`);
  const reset = async (which) => {
    await p.evaluate(`document.querySelector('button[title="Clear or Reset Workout Progress"]').click()`); await sleep(300);
    await p.evaluate(`[...document.querySelector('[aria-labelledby="reset-modal-title"]').querySelectorAll('button')][${which === 'day' ? 1 : 2}].click()`); await sleep(400);
  };
  const tap = async (elJs) => {
    const r = await p.evaluate(`(() => { const el = ${elJs}; el.scrollIntoView({ block: 'nearest', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
    await sleep(350);
  };
  const pickFile = async (lang, file) => {
    const opened = new Promise((resolve) => p.onEvent((m) => m.method === 'Page.fileChooserOpened' && resolve(m.params)));
    await tap(buttonIn(SECTION, T[lang].restore));
    const { backendNodeId } = await opened;
    await p.send('DOM.setFileInputFiles', { files: [file.replace(/\//g, '\\')], backendNodeId });
    await sleep(600);
  };
  const about = async (lang, open) => {
    if (open) await p.evaluate(`document.querySelector('header button[title^="About"]').click()`);
    else await p.evaluate(`${buttonIn(`document.querySelector('.fixed.inset-0')`, T[lang].close)}.click()`);
    await sleep(400);
  };
  const phase = async (name, run) => { await run(); await sleep(700); check(`3 v2 workout keys unchanged after: ${name}`, (await v2()).slice(1).every((v, i) => v === original[i + 1]), true); };
  let backupFile = null;
  let v3AtBackup = null;

  await p.reload(3500);
  await phase('migration on load', async () => {});
  await phase('ticks + weights in kg on Day 1', async () => { await tick(2); await p.typeInto(4, '70'); await p.typeInto(5, '5'); await tick(3); await p.typeInto(6, '55'); await p.typeInto(7, '12'); });
  await phase('switch to lbs, type in lbs, reps-only edit of a kg set', async () => { await unit('lbs'); await p.typeInto(8, '120'); await p.typeInto(9, '10'); await tick(4); await p.typeInto(1, '9'); });
  await phase('Day 2 and Day 5 (shared exercises)', async () => { await day(1); await tick(0); await p.typeInto(0, '200'); await p.typeInto(1, '6'); await day(4); await tick(0); await p.typeInto(0, '210'); await p.typeInto(1, '6'); });
  await phase('back up my data (download)', async () => {
    await sleep(500);
    v3AtBackup = await p.evaluate(`localStorage.getItem('aesthetic_recomp_v3')`);
    await about('en', true);
    await tap(buttonIn(SECTION, T.en.backup));
    for (let i = 0; i < 50 && !readdirSync(DL).some((f) => f.endsWith('.json')); i++) await sleep(100);
    backupFile = `${DL}/${readdirSync(DL).find((f) => f.endsWith('.json'))}`;
    await about('en', false);
  });
  check('backup file holds exactly the saved data', JSON.stringify(plain(JSON.parse(readFileSync(backupFile, 'utf8')).data)) === JSON.stringify(JSON.parse(v3AtBackup)), true);
  await phase('reset Day 5', async () => reset('day'));
  await phase('restore: cancel once, then replace', async () => {
    await about('en', true);
    await pickFile('en', backupFile); await tap(buttonIn(PANEL, T.en.cancel));
    await pickFile('en', backupFile); await tap(buttonIn(PANEL, T.en.replace));
    await about('en', false);
  });
  check('restored data = the data at backup time (Day 5 back)', JSON.stringify(JSON.parse(await p.evaluate(`localStorage.getItem('aesthetic_recomp_v3')`))) === JSON.stringify(JSON.parse(v3AtBackup)), true);
  await phase('a broken backup file is refused', async () => {
    const broken = `${SCRATCH}/files-1e/heavy-broken.json`;
    writeFileSync(broken, readFileSync(backupFile, 'utf8').slice(0, 300));
    await about('en', true); await pickFile('en', broken); await about('en', false);
  });
  await phase('reload', async () => p.reload(3000));
  await phase('language 中文, type, untick', async () => { await p.evaluate(`[...document.querySelectorAll('header button')].find((b) => b.innerText.trim() === '中文').click()`); await sleep(300); await day(0); await p.typeInto(10, '30'); await tick(0); });
  await phase('restore again in 中文', async () => {
    await about('zh', true); await pickFile('zh', backupFile); await tap(buttonIn(PANEL, T.zh.replace)); await about('zh', false);
  });
  await phase('reset all', async () => reset('all'));
  await phase('tick again after reset all, back to EN and kg, reload', async () => { await day(0); await tick(0); await unit('kg'); await p.evaluate(`[...document.querySelectorAll('header button')].find((b) => b.innerText.trim() === 'EN').click()`); await p.reload(3000); });

  const final = await p.evaluate(`({ keys: Object.keys(localStorage).sort(), v3: JSON.parse(localStorage.getItem('aesthetic_recomp_v3')) })`);
  check('final: v2 keys byte-for-byte equal to the original text', (await v2()).every((v, i) => v === original[i]), true);
  check('final: bests survived both resets (as before); one shared RDL best (Day 5 210 lbs beat Day 2 200 lbs)', [Object.keys(final.v3.bests).sort(), final.v3.bests.rdl, final.v3.bests['incline-db-press']], [['incline-db-press', 'lat-pulldown', 'leg-press', 'rdl'], { weight: '210', reps: '6', unit: 'lbs' }, { weight: '70', reps: '5', unit: 'kg' }]);
  check('final: language key written only by the language switch, back to the original value', (await v2())[0], original[0]);
  check('final: after reset all only the one new tick remains', Object.keys(final.v3.currentCycle.slots), ['incline-db-press']);
  check('final: two safety copies (two restores), nothing else new', final.keys.filter((k) => k.startsWith(PREFIX)).length, 2);
  check('no page errors', p.errors, []);
  mkdirSync(`${SHOTS}/1d3/heavy`, { recursive: true });
  writeFileSync(`${SHOTS}/1d3/heavy/heavy-use-final.json`, JSON.stringify(final, null, 2));
  console.log('keys at the end:', final.keys.join(', '));
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
