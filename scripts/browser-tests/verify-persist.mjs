// Checks navigator.storage.persist() is requested once at startup and never breaks the app.
import { launchChrome, sleep } from './cdp.mjs';

const results = [];
const check = (label, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
const appRendered = (p) => p.evaluate(`document.querySelectorAll('nav button').length === 5 && document.querySelectorAll('main input').length > 0`);

const chrome = await launchChrome(9335, 'profile-persist');
try {
  const counted = await chrome.newPage(360);
  await counted.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__persistCalls = 0; const real = StorageManager.prototype.persist;
      StorageManager.prototype.persist = function () { window.__persistCalls++; return real.call(this); };`,
  });
  await counted.goto();
  const calls = await counted.evaluate('window.__persistCalls');
  const persisted = await counted.evaluate('navigator.storage.persisted()');
  check('persist() called exactly once at startup', calls === 1, `${calls} call(s); browser answered persisted=${persisted}`);
  check('app renders normally', await appRendered(counted));

  for (const [label, source] of [
    ['persist() missing (old browser)', `delete StorageManager.prototype.persist;`],
    ['persist() throws', `StorageManager.prototype.persist = () => { throw new Error('boom'); };`],
    ['persist() rejects', `StorageManager.prototype.persist = () => Promise.reject(new Error('denied'));`],
  ]) {
    const p = await chrome.newPage(360);
    await p.send('Page.addScriptToEvaluateOnNewDocument', { source });
    await p.goto();
    await sleep(300);
    check(`${label}: app still renders, no errors`, (await appRendered(p)) && p.errors.length === 0, p.errors.join(' | '));
  }
} finally {
  console.log(results.join('\n'));
  chrome.kill();
}
