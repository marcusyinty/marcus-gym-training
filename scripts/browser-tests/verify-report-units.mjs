// Weekly report for a day mixing kg and lbs sets, in both units, plus the PNG export.
import { writeFileSync } from 'node:fs';
import { launchChrome, SCRATCH, sleep } from './cdp.mjs';

const results = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${JSON.stringify(actual)})`);
};
const KG_PER_LB = 0.45359237;
// Day 1, both ticked: Incline DB Press 60 kg x 8, Lat Pulldown 135 lbs x 10
const expectedKg = 60 * 8 + 135 * KG_PER_LB * 10; // 480 + 612.35 = 1092.35
const expectedLbs = (60 / KG_PER_LB) * 8 + 135 * 10; // 1058.22 + 1350 = 2408.22
console.log(`hand math: ${expectedKg.toFixed(2)} kg, ${expectedLbs.toFixed(2)} lbs`);

const openReport = `(async () => { document.querySelector('button[title="View Weekly Report Card"]').click(); await new Promise((r) => setTimeout(r, 400)); })()`;
const readReport = `(() => {
  const lines = [...document.querySelectorAll('.fixed.inset-0')].find((el) => el.querySelector('h2')).innerText.split('\\n').map((l) => l.trim()).filter(Boolean);
  const after = (label) => lines[lines.findIndex((l) => l.includes(label)) + 1];
  return { total: lines.find((l) => /^\\d[\\d,]* (kg|lbs)$/.test(l)), incline: after('Incline DB Press'), lat: after('Lat Pulldown') };
})()`;
const closeReport = `[...document.querySelectorAll('.fixed.inset-0')].find((el) => el.querySelector('h2')).querySelector('button').click()`;

const chrome = await launchChrome(9340, 'profile-report-units');
try {
  const page = await chrome.newPage(390);
  await page.goto();
  await page.evaluate(`localStorage.clear();
    localStorage.setItem('language_preference', 'en');
    localStorage.setItem('aesthetic_recomp_unit_v1', 'kg');
    localStorage.setItem('aesthetic_recomp_completed_sets_v2', '{"incline-db-press":[0],"lat-pulldown":[0]}');
    localStorage.setItem('aesthetic_recomp_set_details_v2', '{"incline-db-press":{"0":{"setNumber":1,"weight":"60","reps":"8","unit":"kg"}},"lat-pulldown":{"0":{"setNumber":1,"weight":"135","reps":"10","unit":"lbs"}}}');`);
  await page.reload();

  await page.evaluate(openReport);
  check('kg: total volume (480 + 612.35 = 1,092 kg)', (await page.evaluate(readReport)).total, `${Math.round(expectedKg).toLocaleString('en-US')} kg`);
  check('kg: top weights converted, kg set exactly as typed', await page.evaluate(readReport), { total: '1,092 kg', incline: '60 kg × 8', lat: '61.2 kg × 10' });

  // PNG export: catch the download link instead of saving through the browser
  await page.evaluate(`HTMLAnchorElement.prototype.click = function () { window.__download = { name: this.download, href: this.href }; }`);
  const exportPng = async (file) => {
    // After an export the button shows a success message for 3s; wait until it is the download button again
    for (let i = 0; i < 20; i++) {
      if (await page.evaluate(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Download Image'))`)) break;
      await sleep(250);
    }
    await page.evaluate(`window.__download = null; [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Download Image')).click()`);
    let download = null;
    for (let i = 0; i < 40 && !download; i++) { await sleep(250); download = await page.evaluate('window.__download'); }
    writeFileSync(`${SCRATCH}/${file}`, Buffer.from(download.href.split(',')[1], 'base64'));
    return download.name;
  };
  const pngNameKg = await exportPng('report-kg.png');
  await page.evaluate(closeReport);
  await sleep(300);

  await page.clickButtonByText('lbs', 0);
  await sleep(500);
  await page.evaluate(openReport);
  check('lbs: total volume (1,058.22 + 1,350 = 2,408 lbs)', await page.evaluate(readReport), { total: '2,408 lbs', incline: '132.3 lbs × 8', lat: '135 lbs × 10' });
  const pngNameLbs = await exportPng('report-lbs.png');
  console.log('PNG files exported:', pngNameKg, pngNameLbs);
  check('Stored set details untouched by switching unit', await page.evaluate(`localStorage.getItem('aesthetic_recomp_set_details_v2')`),
    '{"incline-db-press":{"0":{"setNumber":1,"weight":"60","reps":"8","unit":"kg"}},"lat-pulldown":{"0":{"setNumber":1,"weight":"135","reps":"10","unit":"lbs"}}}');
  check('No page errors', page.errors, []);
} finally {
  console.log(results.join('\n'));
  chrome.kill();
}
