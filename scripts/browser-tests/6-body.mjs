// Step 6: body measurements with real taps. A add / edit / delete / replace and the checks; B kg/lbs without
// drift; C chart and summary; D reload, new week, resets; E backup and restore; F stale tabs; G broken data;
// H the 2,000 cap and the list pages; I 中文 at 320px; J privacy (body values never outside the Body screen,
// About and the backup file; nothing sent). All data made up.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { launchChrome, sleep, FIXTURES, SCRATCH, isKnownImageNotice } from './cdp.mjs';
import { historyData } from './fixtures/seed.mjs';

const V3 = 'aesthetic_recomp_v3';
const RAW = 'aesthetic_recomp_backup_aesthetic_recomp_v3_raw';
const V2_KEYS = ['language_preference', 'aesthetic_recomp_completed_sets_v2', 'aesthetic_recomp_set_details_v2', 'aesthetic_recomp_previous_bests_v2'];
const DL = `${SCRATCH}/dl-6-body`;
const recorded = JSON.parse(readFileSync(`${FIXTURES}/old-saved-text.json`, 'utf8'));
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(actual)?.slice(0, 500)}, expected ${JSON.stringify(expected)?.slice(0, 500)})`}`);
};

const pad = (n) => String(n).padStart(2, '0');
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const TODAY = daysAgo(0);
const kg = (value, extra = {}) => ({ weight: { value, unit: 'kg' }, ...extra });
const cm = (value) => ({ value, unit: 'cm' });
const noTimes = (value) => (value == null ? value : JSON.parse(JSON.stringify(value, (k, v) => (k === 'updatedAt' ? undefined : v))));

// ---------- page helpers ----------
const Q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const tap = async (p, elJs) => {
  const r = await p.evaluate(`(() => { const el = ${elJs}; if (!el) throw new Error('not found: ' + ${JSON.stringify(elJs)}); el.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(350);
};
const key = async (p, key, code, keyCode) => {
  await p.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode });
  await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
  await sleep(150);
};
// Types into a Body field like a person: select what is there, then type (or delete it)
const type = async (p, field, text) => {
  await p.evaluate(`(() => { const el = ${Q(`[data-body-field="${field}"]`)}; el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.focus(); el.select(); })()`);
  if (text === '') await key(p, 'Backspace', 'Backspace', 8);
  else await p.send('Input.insertText', { text });
  await sleep(100);
};
// The date box: a phone shows its own date picker, so the value is set the way the picker sets it
const setDay = async (p, day) => {
  await p.evaluate(`(() => { const el = ${Q('[data-body-field="day"]')}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(day)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(100);
};
const fill = async (p, { day, weight, waist, hips }) => {
  if (day !== undefined) await setDay(p, day);
  if (weight !== undefined) await type(p, 'weight', weight);
  if (waist !== undefined) await type(p, 'waist', waist);
  if (hips !== undefined) await type(p, 'hips', hips);
};
const save = (p) => tap(p, Q('[data-body-save]'));
const openBody = (p) => tap(p, Q('[data-body-open]'));
const closeBody = (p) => tap(p, `[...document.querySelectorAll('[data-body-screen] button')].at(-1)`);
const isOpen = (p) => p.evaluate(`!!${Q('[data-body-screen]')}`);
const v3 = (p) => p.evaluate(`JSON.parse(localStorage.getItem('${V3}') ?? 'null')`);
const v3Text = (p) => p.evaluate(`localStorage.getItem('${V3}')`);
const body = async (p) => (await v3(p))?.body;
const rows = (p) => p.evaluate(`[...document.querySelectorAll('[data-body-row]')].map((r) => r.dataset.bodyRow + ' ' + (r.querySelector('[data-body-row-values]')?.innerText.trim() ?? '[' + r.innerText.replace(/\\s+/g, ' ').trim() + ']'))`);
const problems = (p) => p.evaluate(`[...document.querySelectorAll('[data-body-problem]')].map((e) => e.dataset.bodyProblem + ': ' + e.innerText.trim())`);
const text = (p, selector) => p.evaluate(`${Q(selector)}?.innerText.replace(/\\s+/g, ' ').trim() ?? null`);
const fieldValues = (p) => p.evaluate(`Object.fromEntries([...document.querySelectorAll('[data-body-field]')].map((e) => [e.dataset.bodyField, e.value]))`);
const units = (p) => p.evaluate(`[...document.querySelectorAll('[data-body-form] .relative > span')].map((s) => s.innerText.trim())`);
const fmtDay = (p, day, { short = false, lang = 'en' } = {}) =>
  p.evaluate(`(() => { const [y, m, d] = ${JSON.stringify(day)}.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(${JSON.stringify(lang === 'zh' ? 'zh-CN' : 'en-GB')}, ${short ? `{ day: 'numeric', month: 'short' }` : `{ day: 'numeric', month: 'short', year: 'numeric' }`}); })()`);
// As the Body screen shows a day in its summary: short this year, with the year before
const label = (p, day, lang = 'en') => fmtDay(p, day, { short: day.slice(0, 4) === TODAY.slice(0, 4), lang });
const setUnit = (p, unit) => p.evaluate(`[...document.querySelectorAll('main button[aria-pressed]')].find((b) => b.innerText.trim() === ${JSON.stringify(unit)}).click()`).then(() => sleep(250));
const smallButtons = (p) => p.evaluate(`[...document.querySelectorAll('[data-body-screen] button')].filter((b) => b.getBoundingClientRect().height > 0).map((b) => [(b.innerText.trim() || b.getAttribute('aria-label') || '?').slice(0, 30), Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)]).filter(([, w, h]) => w < 44 || h < 44)`);

// A stale tab never hears about other tabs (like a phone asleep): it only finds out when it saves
const STALE = `window.__blockSync = false;
  for (const [target, type] of [[window, 'storage'], [window, 'pageshow'], [document, 'visibilitychange']]) {
    target.addEventListener(type, (e) => { if (window.__blockSync) e.stopImmediatePropagation(); }, true);
  }`;

let chrome;
const open = async ({ w = 360, h = 740, lang = 'en', unit = 'kg', data = historyData(), storage = null, keep = false, stale = false, download = false, picker = false } = {}) => {
  const p = await chrome.newPage(w, h);
  if (stale) await p.send('Page.addScriptToEvaluateOnNewDocument', { source: STALE });
  if (picker) await p.send('Page.setInterceptFileChooserDialog', { enabled: true });
  if (download) await p.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL.replace(/\//g, '\\') });
  await p.goto();
  if (!keep) {
    const items = storage ?? { language_preference: lang, aesthetic_recomp_unit_v1: unit, ...(data && { [V3]: typeof data === 'string' ? data : JSON.stringify(data) }) };
    await p.evaluate(`localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(items)})) localStorage.setItem(k, v);`);
    await p.reload(2500);
  }
  if (stale) await p.evaluate(`window.__blockSync = true`);
  return p;
};
const done = (p) => chrome.closeTarget(p.targetId);
const section = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    results.push(`FAIL  ${name}: stopped by an error: ${e.message.split('\n')[0]}`);
  }
};
const withBody = (entries, extra = {}) => ({ ...historyData(), body: { entries, ...extra } });

chrome = await launchChrome(9560, 'profile-6-body');
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });
try {
  // ======================= A. add / edit / delete / replace, checks and messages (360, EN, kg) =======================
  await section('A', async () => {
    const p = await open({ storage: { ...recorded, language_preference: 'en', aesthetic_recomp_unit_v1: 'kg' } });
    const v2Before = await p.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`);
    const savedBefore = await v3Text(p);
    const button = await p.evaluate(`(() => { const b = ${Q('[data-body-open]')}; const r = b.getBoundingClientRect(); return [b.getAttribute('aria-label'), b.getAttribute('title'), Math.round(r.width) >= 44 && Math.round(r.height) >= 44]; })()`);
    check('A notice-row Body button: label and title "Body measurements", at least 44x44', button, ['Body measurements', 'Body measurements', true]);
    await openBody(p);
    check('A the Body screen opens from the notice row', await isOpen(p), true);
    check('A empty: date is today (no later day allowed), chart and list say there is nothing yet',
      [await p.evaluate(`[${Q('[data-body-field="day"]')}.value, ${Q('[data-body-field="day"]')}.max]`), await text(p, '[data-body-chart-empty]'), await text(p, '[data-body-list] p')],
      [[TODAY, TODAY], 'Your weight chart appears here once you add entries.', 'No entries yet. Add your first one above.']);
    check('A empty: units next to the boxes follow kg (cm for lengths)', await units(p), ['kg', 'cm', 'cm']);

    // Add with a comma decimal
    await fill(p, { weight: '72,4', waist: '80' });
    await save(p);
    let b = await body(p);
    check('A "72,4" saved as 72.4 kg with waist 80 cm, today, with a time', [noTimes(b), typeof b?.entries[TODAY]?.updatedAt], [{ entries: { [TODAY]: kg('72.4', { waist: cm('80') }) } }, 'string']);
    check('A after saving: "Saved.", form empty again, the row shows it', [await text(p, '[data-body-message]'), await fieldValues(p), await rows(p)],
      ['Saved.', { day: TODAY, weight: '', waist: '', hips: '' }, [`${TODAY} 72.4 kg · waist 80 cm`]]);
    check('A one entry: summary "Latest", and the chart asks for another day', [await text(p, '[data-body-summary]'), await text(p, '[data-body-chart-one]')],
      [`Latest: 72.4 kg (${await label(p, TODAY)})`, 'Add an entry for another day to see the chart.']);

    // Checks: nothing saved for any of these
    const before = JSON.stringify(await body(p));
    await fill(p, { day: daysAgo(-1), weight: '70' });
    await save(p);
    check('A tomorrow: refused with a clear message', await problems(p), ["day: The date can't be in the future."]);
    await fill(p, { day: daysAgo(1), weight: 'abc' });
    await save(p);
    check('A "abc": refused', await problems(p), ['weight: Use numbers only, e.g. 72.4 or 72,4.']);
    await fill(p, { weight: '' });
    await save(p);
    check('A no weight: refused', await problems(p), ['weight: Enter your weight.']);
    await fill(p, { weight: '500', waist: '20', hips: '72.456' });
    await save(p);
    check('A out of range and 3 decimals: each box says what is wrong', await problems(p),
      ['weight: Weight must be between 20 and 400 kg.', 'waist: Waist must be between 30 and 250 cm.', 'hips: Use numbers only, e.g. 72.4 or 72,4.']);
    check('A focus goes to the first box with a problem', await p.evaluate(`document.activeElement?.dataset.bodyField`), 'weight');
    check('A none of the refused entries changed the saved data', JSON.stringify(await body(p)), before);

    // A past day; newest first
    await fill(p, { day: daysAgo(3), weight: '73.1', waist: '', hips: '' });
    await save(p);
    check('A a past day saved; list newest first', await rows(p), [`${TODAY} 72.4 kg · waist 80 cm`, `${daysAgo(3)} 73.1 kg`]);

    // Same day again: asks first
    await fill(p, { day: daysAgo(3), weight: '74' });
    await save(p);
    const day3 = await fmtDay(p, daysAgo(3));
    check('A same day again: asks, showing what that day has', await text(p, '[data-body-replace]'), `Replace the entry for ${day3}? It has 73.1 kg. Cancel Replace`);
    await tap(p, `${Q('[data-body-replace]')}.querySelector('button')`);
    check('A Cancel: nothing replaced, the typed values stay', [noTimes((await body(p)).entries[daysAgo(3)]), (await fieldValues(p)).weight], [kg('73.1'), '74']);
    await save(p);
    await tap(p, Q('[data-body-replace-confirm]'));
    check('A Replace: the day now has 74 kg', [noTimes((await body(p)).entries[daysAgo(3)]), await text(p, '[data-body-message]')], [kg('74'), 'Saved.']);

    // Edit in place: unchanged fields keep their stored value
    await tap(p, Q(`[data-body-row="${TODAY}"] [data-body-edit]`));
    check('A Edit: the form shows that entry', [await text(p, '#body-form-title'), await fieldValues(p)], ['EDIT ENTRY', { day: TODAY, weight: '72.4', waist: '80', hips: '' }]);
    await fill(p, { weight: '72.8' });
    await save(p);
    check('A edit saved without asking (it is the same entry)', noTimes((await body(p)).entries[TODAY]), kg('72.8', { waist: cm('80') }));
    // Edit and move to a free day
    await tap(p, Q(`[data-body-row="${daysAgo(3)}"] [data-body-edit]`));
    await fill(p, { day: daysAgo(5) });
    await save(p);
    check('A edit to another (free) day: moved', Object.keys((await body(p)).entries).sort(), [daysAgo(5), TODAY].sort());
    // Edit and move onto a day that has an entry: asks first
    await tap(p, Q(`[data-body-row="${daysAgo(5)}"] [data-body-edit]`));
    await fill(p, { day: TODAY });
    await save(p);
    check('A edit onto a day with an entry: asks first', await text(p, '[data-body-replace-has]'), 'It has 72.8 kg · waist 80 cm.');
    await tap(p, Q('[data-body-replace-confirm]'));
    check('A after Replace: that day has the moved entry, the old day is gone', noTimes((await body(p)).entries), { [TODAY]: kg('74') });

    // Delete asks first; deleting everything removes the field
    await tap(p, Q(`[data-body-row="${TODAY}"] [data-body-delete]`));
    check('A Delete asks first', await text(p, `[data-body-row="${TODAY}"]`), `Delete the entry for ${await fmtDay(p, TODAY)}? Cancel Delete`);
    await tap(p, `${Q(`[data-body-row="${TODAY}"]`)}.querySelector('button')`);
    check('A Cancel keeps it', Object.keys((await body(p)).entries), [TODAY]);
    await tap(p, Q(`[data-body-row="${TODAY}"] [data-body-delete]`));
    await tap(p, Q('[data-body-delete-confirm]'));
    check('A deleted: "Deleted.", nothing listed, no body field left in the saved data', [await text(p, '[data-body-message]'), await rows(p), 'body' in (await v3(p))], ['Deleted.', [], false]);

    // Height
    await tap(p, Q('[data-body-height-edit]'));
    await type(p, 'height', '180,5');
    await tap(p, Q('[data-body-height-save]'));
    check('A height "180,5" saved as 180.5 cm and shown', [(await body(p)).height, await text(p, '[data-body-height-value]')], [cm('180.5'), '180.5 cm']);
    await tap(p, Q('[data-body-height-edit]'));
    await type(p, 'height', '300');
    await tap(p, Q('[data-body-height-save]'));
    check('A height 300: refused with the range', [await problems(p), (await body(p)).height], [['height: Height must be between 100 and 250 cm.'], cm('180.5')]);
    await tap(p, Q('[data-body-height-remove]'));
    check('A height removed: nothing left, so no body field', [await text(p, '[data-body-height-value]'), 'body' in (await v3(p))], ['Not set', false]);

    // Tap sizes, Escape, the About entry point
    await fill(p, { weight: '71' });
    await save(p);
    await tap(p, Q(`[data-body-row="${TODAY}"] [data-body-delete]`));
    check('A every Body screen button is at least 44x44 (with a row being deleted and one listed)', await smallButtons(p), []);
    await tap(p, `${Q(`[data-body-row="${TODAY}"]`)}.querySelector('button')`);
    await p.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(300);
    check('A Escape closes the Body screen', await isOpen(p), false);
    await tap(p, Q('header button[title^="About"]'));
    check('A About > Your data: Body button with the number of entries', await text(p, '[data-body-open-about]'), 'Body (1)');
    await tap(p, Q('[data-body-open-about]'));
    check('A About closes and the Body screen opens', [await p.evaluate(`!!${Q('section[aria-labelledby="data-section-title"]')}`), await isOpen(p)], [false, true]);
    await closeBody(p);
    check('A the old v2 keys are byte-for-byte unchanged', await p.evaluate(`${JSON.stringify(V2_KEYS)}.map((k) => localStorage.getItem(k))`), v2Before);
    check('A only the Body data changed in the saved data', (({ body: _b, ...rest }) => JSON.stringify(rest))(await v3(p)), (({ body: _b, ...rest }) => JSON.stringify(rest))(JSON.parse(savedBefore)));
    check('A no page errors', p.errors, []);
    await done(p);
  });

  // ======================= B. kg / lbs: shown converted, stored as typed, no drift =======================
  await section('B', async () => {
    const seeded = withBody({ [daysAgo(2)]: kg('72.4', { waist: cm('80.5'), hips: cm('95') }) }, { height: cm('180') });
    const p = await open({ data: seeded });
    const savedBody = JSON.stringify((await v3(p)).body);
    for (let i = 0; i < 5; i++) {
      await setUnit(p, 'lbs');
      await setUnit(p, 'kg');
    }
    check('B kg → lbs → kg five times: the saved body data is byte-for-byte the same', JSON.stringify((await v3(p)).body), savedBody);
    await openBody(p);
    check('B in kg: shown as typed', [await rows(p), await text(p, '[data-body-height-value]')], [[`${daysAgo(2)} 72.4 kg · waist 80.5 cm · hips 95 cm`], '180 cm']);
    await closeBody(p);
    await setUnit(p, 'lbs');
    await openBody(p);
    check('B in lbs: converted for display (lbs and inches), units next to the boxes too',
      [await rows(p), await text(p, '[data-body-height-value]'), await units(p)], [[`${daysAgo(2)} 159.6 lbs · waist 31.7 in · hips 37.4 in`], '70.9 in', ['lbs', 'in', 'in']]);
    // Edit only the weight in lbs: waist and hips keep their stored cm values
    await tap(p, Q(`[data-body-row="${daysAgo(2)}"] [data-body-edit]`));
    check('B edit in lbs: the form shows the converted values', await fieldValues(p), { day: daysAgo(2), weight: '159.6', waist: '31.7', hips: '37.4' });
    await fill(p, { weight: '160' });
    await save(p);
    check('B only the weight changed: 160 lbs; waist and hips still 80.5 cm and 95 cm (no rounding)', noTimes((await body(p)).entries[daysAgo(2)]),
      { weight: { value: '160', unit: 'lbs' }, waist: cm('80.5'), hips: cm('95') });
    await fill(p, { day: daysAgo(1), weight: '158,5', waist: '31' });
    await save(p);
    check('B typed in lbs: stored as typed in lbs and inches', noTimes((await body(p)).entries[daysAgo(1)]), { weight: { value: '158.5', unit: 'lbs' }, waist: { value: '31', unit: 'in' } });
    await fill(p, { weight: '30' });
    await save(p);
    check('B the range in lbs', await problems(p), ['weight: Weight must be between 44.1 and 881.8 lbs.']);
    await closeBody(p);
    await setUnit(p, 'kg');
    await openBody(p);
    check('B back in kg: converted back for display', await rows(p), [`${daysAgo(1)} 71.9 kg · waist 78.7 cm`, `${daysAgo(2)} 72.6 kg · waist 80.5 cm · hips 95 cm`]);
    check('B no page errors', p.errors, []);
    await done(p);
  });

  // ======================= C. chart and summary =======================
  await section('C', async () => {
    // 0 and 1 entries are in A. Ten entries, 3 days apart, 80 → 71 kg; then older ones; then ranges with fewer than 2.
    const ten = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [daysAgo(27 - i * 3), kg(String(80 - i))]));
    let p = await open({ data: withBody(ten) });
    await openBody(p);
    const [d0, today] = [await label(p, daysAgo(27)), await label(p, TODAY)];
    const chart = () => p.evaluate(`(() => { const svg = ${Q('[data-body-chart-svg]')}; return svg ? { points: svg.querySelectorAll('[data-body-chart-points] circle').length, average: !!svg.querySelector('[data-body-chart-average]'), aria: svg.getAttribute('aria-label') } : null; })()`);
    const pressed = () => p.evaluate(`[...document.querySelectorAll('[data-body-range]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.innerText.trim())`);
    check('C 10 entries: neutral summary (latest, since first, last 30 days)', await p.evaluate(`[...document.querySelectorAll('[data-body-summary] p')].map((e) => e.innerText.trim())`),
      [`Latest: 71 kg (${today})`, `Since first entry (${d0}): −9 kg`, `Last 30 days: −9 kg (${d0} → ${today})`]);
    check('C 10 entries: 90 days chosen at first; 10 dots and the average line; described for screen readers', [await pressed(), await chart()],
      [['90 days'], { points: 10, average: true, aria: `Weight chart, last 90 days: 10 entries from ${d0} to ${today}, between 71 kg and 80 kg. Every entry is in the list below.` }]);
    check('C legend: a dot "Entry" and a line "7-entry average" (shapes, not only colour)', await text(p, '[data-body-chart-legend]'), 'Entry 7-entry average');
    const height = () => p.evaluate(`Math.round(${Q('[data-body-chart]')}.getBoundingClientRect().height)`);
    const h90 = await height();
    await tap(p, Q('[data-body-range="30"]'));
    check('C 30 days: all 10 still inside; the button says it is chosen', [await pressed(), (await chart()).points], [['30 days'], 10]);
    check('C switching ranges never changes the section height', await height(), h90);
    await done(p);

    p = await open({ data: withBody({ ...ten, [daysAgo(60)]: kg('85'), [daysAgo(200)]: kg('90') }) });
    await openBody(p);
    const counts = [];
    for (const r of ['30', '90', 'all']) {
      await tap(p, Q(`[data-body-range="${r}"]`));
      counts.push((await chart()).points);
    }
    check('C ranges: 30 days 10 dots, 90 days 11, All 12', counts, [10, 11, 12]);
    check('C summary: since first entry uses the oldest, last 30 days only the window', await p.evaluate(`[...document.querySelectorAll('[data-body-summary] p')].slice(1).map((e) => e.innerText.trim())`),
      [`Since first entry (${await label(p, daysAgo(200))}): −19 kg`, `Last 30 days: −9 kg (${d0} → ${today})`]);
    await done(p);

    p = await open({ data: withBody({ [daysAgo(100)]: kg('75'), [daysAgo(200)]: kg('76.5') }) });
    await openBody(p);
    await tap(p, Q('[data-body-range="30"]'));
    check('C a range with fewer than 2 entries says so (no empty chart)', [await chart(), await text(p, '[data-body-chart-few]')], [null, 'Fewer than 2 entries in this range. Pick a longer range.']);
    await tap(p, Q('[data-body-range="all"]'));
    check('C All: 2 dots, no average line yet, and a note says when it appears', [await chart().then((c) => [c.points, c.average]), await text(p, '[data-body-average-later]'), await text(p, '[data-body-chart-legend]')],
      [[2, false], 'The 7-entry average line appears from your 7th entry.', 'Entry']);
    check('C last 30 days without 2 entries there', await text(p, '[data-body-summary-30]'), 'Last 30 days: not enough entries');
    check('C no page errors', p.errors, []);
    await done(p);
  });

  // ======================= D. reload, Reset day, Reset all, Start new week: body data untouched =======================
  await section('D', async () => {
    const seeded = withBody({ [daysAgo(1)]: kg('72.4', { waist: cm('80') }), [daysAgo(8)]: kg('73') }, { height: cm('181') });
    const p = await open({ data: seeded });
    const bodyText = () => p.evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('${V3}')).body)`);
    const original = JSON.stringify(seeded.body);
    // tick a set first, so the resets and the new week have something to do
    await tap(p, `[...document.querySelectorAll('[data-set-row] button[aria-pressed="false"]')][0]`);
    await p.evaluate(`${Q('[data-tag-prompt-dismiss]')}?.click()`);
    await sleep(200);
    check('D a tick saved; body data unchanged', [Object.keys((await v3(p)).currentCycle.slots).length > 0, await bodyText()], [true, original]);
    await p.reload(2500);
    await openBody(p);
    check('D after reload: still listed', await rows(p), [`${daysAgo(1)} 72.4 kg · waist 80 cm`, `${daysAgo(8)} 73 kg`]);
    await closeBody(p);
    const RESET = `[...document.querySelectorAll('[aria-labelledby="reset-modal-title"] button')]`;
    await tap(p, Q('button[title="Clear or Reset Workout Progress"]'));
    await tap(p, `${RESET}[1]`);
    check('D Reset day: the day is cleared, body data unchanged', [Object.keys((await v3(p)).currentCycle.slots).length, await bodyText()], [0, original]);
    await tap(p, `[...document.querySelectorAll('[data-set-row] button[aria-pressed="false"]')][0]`);
    await p.evaluate(`${Q('[data-tag-prompt-dismiss]')}?.click()`);
    await tap(p, Q('button[title="Clear or Reset Workout Progress"]'));
    await tap(p, `${RESET}[2]`);
    check('D Reset all: everything this week cleared, body data unchanged', [Object.keys((await v3(p)).currentCycle.slots).length, await bodyText()], [0, original]);
    const weeks = (await v3(p)).archivedCycles.length;
    // an empty week can't be started (by design), so tick one set first
    await tap(p, `[...document.querySelectorAll('[data-set-row] button[aria-pressed="false"]')][0]`);
    await p.evaluate(`${Q('[data-tag-prompt-dismiss]')}?.click()`);
    await tap(p, Q('header button[title="View Weekly Report Card"]'));
    await tap(p, `[...document.querySelectorAll('.fixed.inset-0 button')].find((b) => b.innerText.trim() === 'Start new week')`);
    await tap(p, `[...document.querySelectorAll('[role=alertdialog] button')].find((b) => b.innerText.trim() === 'Start new week')`);
    await sleep(400);
    check('D Start new week: one more past week, body data unchanged', [(await v3(p)).archivedCycles.length, await bodyText()], [weeks + 1, original]);
    check('D no page errors', p.errors, []);
    await done(p);
  });

  // ======================= E. backup and restore =======================
  await section('E', async () => {
    const seeded = withBody({ [daysAgo(1)]: kg('72.4', { waist: cm('80'), hips: cm('96.5') }), [daysAgo(4)]: { weight: { value: '161', unit: 'lbs' } } }, { height: cm('181') });
    const p = await open({ data: seeded, download: true, picker: true });
    const SECTION = Q('section[aria-labelledby="data-section-title"]');
    const buttonIn = (root, label) => `[...${root}.querySelectorAll('button')].find((el) => el.innerText.trim() === ${JSON.stringify(label)})`;
    const restore = async (path) => {
      const opened = new Promise((resolve) => p.onEvent((m) => m.method === 'Page.fileChooserOpened' && resolve(m.params)));
      await tap(p, buttonIn(SECTION, 'Restore from backup'));
      const { backendNodeId } = await opened;
      await p.send('DOM.setFileInputFiles', { files: [path.replace(/\//g, '\\')], backendNodeId });
      await sleep(600);
    };
    const panelLine = () => text(p, '[data-restore-body]');
    const confirm = () => tap(p, buttonIn(Q('[aria-labelledby="restore-confirm-title"]'), 'Replace my data'));
    await tap(p, Q('header button[title^="About"]'));
    check('E About says backups include body measurements', await p.evaluate(`${SECTION}.querySelector('p').innerText.trim()`),
      'Your workouts and body measurements are saved only on this phone. Save a backup file now and then; it includes both.');
    await tap(p, buttonIn(SECTION, 'Back up my data'));
    let files = [];
    for (let i = 0; i < 50 && !(files = readdirSync(DL).filter((f) => f.endsWith('.json'))).length; i++) await sleep(100);
    const path = `${DL}/${files[0]}`;
    const file = JSON.parse(readFileSync(path, 'utf8'));
    check('E the backup file holds the body data exactly as saved', JSON.stringify(file.data.body), JSON.stringify((await v3(p)).body));
    // change it: delete an entry, change the height
    await tap(p, Q('[data-body-open-about]'));
    await tap(p, Q(`[data-body-row="${daysAgo(4)}"] [data-body-delete]`));
    await tap(p, Q('[data-body-delete-confirm]'));
    await tap(p, Q('[data-body-height-edit]'));
    await type(p, 'height', '175');
    await tap(p, Q('[data-body-height-save]'));
    await closeBody(p);
    await tap(p, Q('header button[title^="About"]'));
    await restore(path);
    check('E restoring that file: the panel says body measurements will be replaced', await panelLine(), 'Your body measurements will be replaced.');
    await confirm();
    check('E after restoring: the body data is back exactly as in the file', JSON.stringify((await v3(p)).body), JSON.stringify(file.data.body));
    check('E the safety copy made before restoring holds the changed body data', await p.evaluate(`(() => { const k = Object.keys(localStorage).filter((k) => k.startsWith('aesthetic_recomp_backup_before_restore_')).sort().at(-1); return JSON.parse(localStorage.getItem(k)).body.height; })()`), cm('175'));

    // A backup made before body measurements existed (no body field): this phone's body data stays
    const old = { ...historyData(), currentCycle: { id: 'week-from-old-file', startedAt: '2026-10-01T06:00:00.000Z', slots: {} } };
    const oldPath = `${DL}/synthetic-old-backup.json`;
    writeFileSync(oldPath, JSON.stringify({ app: 'aesthetic-recomp-backup', version: 1, exportedAt: '2026-10-01T08:00:00.000Z', schemaVersion: 3, data: old }));
    const bodyNow = JSON.stringify((await v3(p)).body);
    await restore(oldPath);
    check('E an old backup without body data: the panel says they will be kept', await panelLine(), 'Your body measurements will be kept.');
    await confirm();
    check('E after restoring the old backup: workouts from the file, body data kept as it was', [(await v3(p)).currentCycle.id, JSON.stringify((await v3(p)).body)], ['week-from-old-file', bodyNow]);
    // A newer backup with no body measurements (an empty list) replaces them
    const emptyPath = `${DL}/synthetic-empty-body-backup.json`;
    writeFileSync(emptyPath, JSON.stringify({ app: 'aesthetic-recomp-backup', version: 1, exportedAt: '2026-10-02T08:00:00.000Z', schemaVersion: 3, data: { ...old, body: { entries: {} } } }));
    await restore(emptyPath);
    check('E a newer backup with an empty body list: the panel says they will be replaced', await panelLine(), 'Your body measurements will be replaced.');
    await confirm();
    check('E after restoring it: no body data (and no empty field)', 'body' in (await v3(p)), false);
    check('E no page errors', p.errors, []);
    await done(p);
  });

  // ======================= F. stale tabs =======================
  await section('F', async () => {
    // 1. different days: both kept
    const a = await open({ data: withBody({ [daysAgo(10)]: kg('75') }) });
    const b = await open({ keep: true, stale: true });
    await openBody(a);
    await openBody(b);
    await fill(a, { day: daysAgo(2), weight: '74' });
    await save(a);
    await fill(b, { day: daysAgo(1), weight: '73.5' });
    await save(b);
    check('F 1 two tabs add different days: all three kept', Object.keys((await body(b)).entries).sort(), [daysAgo(10), daysAgo(2), daysAgo(1)].sort());
    check('F 1 the stale tab says it took in newer data from another tab, and lists all three', [await text(b, '[data-body-other-tab]') !== null, (await rows(b)).length], [true, 3]);
    await done(a);
    await done(b);

    // 2. the same day while this tab's replace question is open: asked again with the newest values
    const c = await open({ data: withBody({ [daysAgo(3)]: kg('70') }) });
    const d = await open({ keep: true, stale: true });
    await openBody(c);
    await openBody(d);
    await fill(d, { day: daysAgo(3), weight: '71' });
    await save(d);
    check('F 2 this tab asks: the day has 70 kg', await text(d, '[data-body-replace-has]'), 'It has 70 kg.');
    await tap(c, Q(`[data-body-row="${daysAgo(3)}"] [data-body-edit]`));
    await fill(c, { weight: '72' });
    await save(c);
    check('F 2 meanwhile the other tab changed that day to 72 kg', noTimes((await body(c)).entries[daysAgo(3)]), kg('72'));
    await tap(d, Q('[data-body-replace-confirm]'));
    check('F 2 Replace: NOT overwritten; asked again, now showing the newest 72 kg', [noTimes((await body(d)).entries[daysAgo(3)]), await text(d, '[data-body-replace-has]')], [kg('72'), 'It has 72 kg.']);
    await tap(d, Q('[data-body-replace-confirm]'));
    check('F 2 Replace again (knowing it): saved 71 kg', [noTimes((await body(d)).entries[daysAgo(3)]), await text(d, '[data-body-replace]')], [kg('71'), null]);

    // 3. the other tab deletes that day while the question is open: nothing to replace, saved
    await fill(d, { day: daysAgo(3), weight: '69' });
    await save(d);
    await tap(c, Q(`[data-body-row="${daysAgo(3)}"] [data-body-delete]`));
    await tap(c, Q('[data-body-delete-confirm]'));
    await tap(d, Q('[data-body-replace-confirm]'));
    check('F 3 the day was deleted elsewhere meanwhile: Replace simply saves', noTimes((await body(d)).entries), { [daysAgo(3)]: kg('69') });
    check('F no page errors', [...c.errors, ...d.errors], []);
    await done(c);
    await done(d);

    // 4. the same, with both tabs awake (this tab hears about the change while its question is open)
    const e = await open({ data: withBody({ [daysAgo(3)]: kg('70') }) });
    const f = await open({ keep: true });
    await openBody(e);
    await openBody(f);
    await fill(f, { day: daysAgo(3), weight: '71' });
    await save(f);
    await tap(e, Q(`[data-body-row="${daysAgo(3)}"] [data-body-edit]`));
    await fill(e, { weight: '72' });
    await save(e);
    await sleep(300);
    check('F 4 awake tab: its list shows the other tab\'s 72 kg at once', (await rows(f)).includes(`${daysAgo(3)} 72 kg`), true);
    await tap(f, Q('[data-body-replace-confirm]'));
    check('F 4 awake tab, Replace: NOT overwritten; asked again with 72 kg', [noTimes((await body(f)).entries[daysAgo(3)]), await text(f, '[data-body-replace-has]')], [kg('72'), 'It has 72 kg.']);
    await tap(f, Q('[data-body-replace-confirm]'));
    check('F 4 Replace again: saved 71 kg', noTimes((await body(f)).entries[daysAgo(3)]), kg('71'));
    check('F 4 no page errors', [...e.errors, ...f.errors], []);
    await done(e);
    await done(f);
  });

  // ======================= G. broken body data =======================
  await section('G', async () => {
    const broken = withBody({
      [daysAgo(1)]: kg('72.4'),
      '2026-13-01': kg('70'), // no such day
      [daysAgo(2)]: { weight: { value: 'abc', unit: 'kg' } },
      [daysAgo(3)]: kg('73', { waist: cm('5'), hips: cm('96') }), // waist out of range: only that value goes
    }, { height: { value: '999', unit: 'cm' } });
    const textIn = JSON.stringify(broken);
    let p = await open({ data: textIn });
    check('G broken pieces: the original text is backed up once, exactly', await p.evaluate(`localStorage.getItem('${RAW}')`), textIn);
    await openBody(p);
    check('G only the readable entries and values are shown', [await rows(p), await text(p, '[data-body-height-value]')], [[`${daysAgo(1)} 72.4 kg`, `${daysAgo(3)} 73 kg · hips 96 cm`], 'Not set']);
    await fill(p, { weight: '71.9' });
    await save(p);
    check('G saving works on the cleaned data; the backup copy is not overwritten', [Object.keys((await body(p)).entries).sort(), await p.evaluate(`localStorage.getItem('${RAW}')`)],
      [[daysAgo(3), daysAgo(1), TODAY], textIn]);
    check('G no page errors', p.errors, []);
    await done(p);

    const garbage = JSON.stringify({ ...historyData(), body: 'not body data' });
    p = await open({ data: garbage });
    await openBody(p);
    check('G body data that is not data at all: backed up, the screen is empty, the app works', [await p.evaluate(`localStorage.getItem('${RAW}')`), await rows(p), await text(p, '[data-body-chart-empty]') !== null],
      [garbage, [], true]);
    check('G no page errors', p.errors, []);
    await done(p);
  });

  // ======================= H. the 2,000 cap and the list pages =======================
  await section('H', async () => {
    const many = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [daysAgo(i + 1), kg((70 + (i % 50) / 10).toFixed(1))]));
    const p = await open({ data: withBody(many) });
    await openBody(p);
    check('H 2,000 entries: 30 listed at first', [await text(p, '#body-list-title'), (await rows(p)).length, await text(p, '[data-body-more]')], ['ENTRIES (2000)', 30, 'Show 30 more']);
    await tap(p, Q('[data-body-more]'));
    check('H "Show 30 more": 60 listed', (await rows(p)).length, 60);
    await fill(p, { day: TODAY, weight: '70' });
    await save(p);
    check('H at the cap a new day is refused with a message; nothing deleted', [await text(p, '[data-body-message]'), Object.keys((await body(p)).entries).length],
      ['You have 2,000 entries, the most this app keeps. Delete old entries to add new ones.', 2000]);
    await fill(p, { day: daysAgo(1), weight: '70' });
    await save(p);
    await tap(p, Q('[data-body-replace-confirm]'));
    check('H at the cap, replacing an existing day still works', [noTimes((await body(p)).entries[daysAgo(1)]), Object.keys((await body(p)).entries).length], [kg('70'), 2000]);
    await tap(p, Q(`[data-body-row="${daysAgo(2)}"] [data-body-delete]`));
    await tap(p, Q('[data-body-delete-confirm]'));
    await fill(p, { day: TODAY, weight: '70' });
    await save(p);
    check('H after deleting one, a new day can be added', [await text(p, '[data-body-message]'), Object.keys((await body(p)).entries).length], ['Saved.', 2000]);
    check('H no page errors', p.errors, []);
    await done(p);
  });

  // ======================= I. 中文 at 320px =======================
  await section('I', async () => {
    const p = await open({ w: 320, h: 640, lang: 'zh', data: withBody({ [daysAgo(3)]: kg('73', { waist: cm('81') }) }) });
    check('I 中文: notice-row button label and title', await p.evaluate(`[${Q('[data-body-open]')}.getAttribute('aria-label'), ${Q('[data-body-open]')}.title]`), ['身体数据', '身体数据']);
    await openBody(p);
    check('I 中文: title, private note, list', [await text(p, '#body-title'), await text(p, '[data-body-screen] .shrink-0 p'), await rows(p)],
      ['身体数据', '仅保存在这台手机上，不会发送到任何地方。', [`${daysAgo(3)} 73 kg · 腰围 81 cm`]]);
    await fill(p, { day: daysAgo(-1), weight: '7O' });
    await save(p);
    check('I 中文: messages', await problems(p), ['day: 日期不能晚于今天。', 'weight: 只能输入数字，例如 72.4 或 72,4。']);
    await fill(p, { day: daysAgo(3), weight: '72,5' });
    await save(p);
    check('I 中文: replace question', await text(p, '[data-body-replace]'), `替换 ${await fmtDay(p, daysAgo(3), { lang: 'zh' })} 的记录？ 该记录为：73 kg · 腰围 81 cm。 取消 替换`);
    await tap(p, Q('[data-body-replace-confirm]'));
    await fill(p, { day: daysAgo(1), weight: '72' });
    await save(p);
    check('I 中文: summary and legend', [await text(p, '[data-body-summary-latest]'), await text(p, '[data-body-chart-legend]')],
      [`最新：72 kg（${await label(p, daysAgo(1), 'zh')}）`, '每次记录']);
    check('I 320px: nothing wider than the screen; every button at least 44x44',
      [await p.evaluate(`(() => { const s = ${Q('[data-body-screen] .overflow-y-auto')}; return s.scrollWidth - s.clientWidth; })()`), await smallButtons(p)], [0, []]);
    check('I no page errors', p.errors, []);
    await done(p);
  });

  // ======================= J. privacy: body values never outside the Body screen, About and the backup file =======================
  await section('J', async () => {
    // Values that appear nowhere else in the app: 88.88 kg (195.9 lbs), waist 77.77 cm (30.6 in), hips 101.11 cm (39.8 in), height 188.88 cm (74.4 in)
    const SECRETS = ['88.88', '195.9', '77.77', '30.6', '101.11', '39.8', '188.88', '74.4'];
    const seeded = withBody({ [daysAgo(1)]: kg('88.88', { waist: cm('77.77'), hips: cm('101.11') }), [daysAgo(9)]: kg('88.88') }, { height: cm('188.88') });
    for (const [lang, unit] of [['en', 'kg'], ['zh', 'lbs']]) {
      rmSync(`${DL}/j`, { recursive: true, force: true });
      mkdirSync(`${DL}/j`, { recursive: true });
      const p = await chrome.newPage(360, 740);
      const logs = [];
      const requests = [];
      p.onEvent((m) => {
        if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
        if (m.method === 'Network.requestWillBeSent') requests.push(`${m.params.request.url} ${m.params.request.postData ?? ''}`);
      });
      await p.send('Network.enable');
      await p.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: `${DL}/j`.replace(/\//g, '\\') });
      await p.goto();
      await p.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', '${lang}'); localStorage.setItem('aesthetic_recomp_unit_v1', '${unit}'); localStorage.setItem('${V3}', ${JSON.stringify(JSON.stringify(seeded))});`);
      await p.reload(2500);
      const found = (html) => SECRETS.filter((s) => html.includes(s));
      const page = () => p.evaluate(`document.title + ' ' + document.documentElement.outerHTML`);
      // the scan works: the Body screen does show them
      await openBody(p);
      check(`J ${lang}/${unit} (control) the Body screen shows the values`, found(await page()).length > 0, true);
      await closeBody(p);
      const leaks = {};
      const note = (where, html) => { const f = found(html); if (f.length) leaks[where] = f; };
      for (let day = 0; day < 5; day++) {
        await p.evaluate(`document.querySelectorAll('nav button')[${day}].click()`);
        await sleep(250);
        note(`day ${day + 1}`, await page());
      }
      // the weekly report on screen, and its image: everything put on the page while the image is made
      await tap(p, Q('header button[title="View Weekly Report Card"]'));
      note('weekly report', await page());
      await p.evaluate(`window.__added = []; new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => window.__added.push(n.outerHTML ?? n.textContent ?? '')))).observe(document.body, { childList: true, subtree: true, characterData: true });`);
      await tap(p, `[...[...document.querySelectorAll('.fixed.inset-0')].find((el) => el.querySelector('h2')).querySelectorAll('button')].find((b) => b.querySelector('svg') && b.className.includes('from-emerald-500 to-cyan-500'))`);
      let images = [];
      for (let i = 0; i < 100 && !(images = readdirSync(`${DL}/j`).filter((f) => f.endsWith('.png'))).length; i++) await sleep(100);
      check(`J ${lang}/${unit} the report image was made`, images.length, 1);
      note('report image copy', (await p.evaluate(`window.__added.join(' ')`)) ?? '');
      note('report image file name', images.join(' '));
      await p.evaluate(`[...document.querySelectorAll('.fixed.inset-0')].find((el) => el.querySelector('h2')).querySelector('button').click()`);
      await sleep(300);
      // past weeks list and an old week's report
      await tap(p, Q('header button[title^="About"]'));
      await tap(p, `${Q('section[aria-labelledby="data-section-title"]')}.querySelector('.grid button')`);
      note('past weeks', await page());
      check(`J ${lang}/${unit} title, all 5 days, weekly report, its image and file name, past weeks: no body value anywhere`, leaks, {});
      check(`J ${lang}/${unit} console: no body value in any message`, found(logs.join('\n')), []);
      check(`J ${lang}/${unit} network: no request carries a body value (nothing is sent)`, found(requests.join('\n')), []);
      const keys = await p.evaluate(`Object.keys(localStorage).filter((k) => ${JSON.stringify(SECRETS)}.some((s) => localStorage.getItem(k).includes(s)))`);
      check(`J ${lang}/${unit} storage: only the saved data holds body values`, keys, [V3]);
      check(`J ${lang}/${unit} no page errors (apart from the known image-library notices)`, p.errors.filter((e) => !isKnownImageNotice(e)), []);
      await done(p);
    }
  });
} finally {
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  chrome.kill();
}
