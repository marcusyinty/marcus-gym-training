// Runs the whole browser test suite: one line per script, a total, exit code 1 if anything failed.
//   node scripts/browser-tests/run-all.mjs              (or: npm run test:browser)
//   node scripts/browser-tests/run-all.mjs --only 4-flows,compact-check
// Uses BASE_URL (default http://localhost:3000/). When nothing answers there and BASE_URL is the default, it
// starts the Vite dev server itself (and stops it at the end). Logs: review-shots/browser-tests/logs/.
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/';
const V120_URL = process.env.V120_URL ?? 'http://localhost:3001/';
const V130_URL = process.env.V130_URL ?? 'http://localhost:3003/';
const LOGS = path.join(ROOT, 'review-shots', 'browser-tests', 'logs');
mkdirSync(LOGS, { recursive: true });

// Order: quick checks first, then the long flows. [script, ...arguments]
const SUITE = [
  ['tabs-behavior'], ['verify-persist'], ['verify-units'], ['verify-best'], ['verify-new'], ['verify-report-units'],
  ['keyboard-check'], ['modal-check'], ['daycard-check'], ['compact-check'], ['check-fixes'],
  ['check-reset', 'reset', '360', '740', 'en'], ['check-reset', 'reset', '360', '740', 'zh'],
  ['check-reset', 'reset', '320', '640', 'en'], ['check-reset', 'reset', '320', '640', 'zh'],
  ['rest-timer-check'], ['rest-cover'], ['about-1d4'], ['report-export', 'suite', BASE_URL, '9412'],
  ['v3-scenarios'], ['weeks-flow'], ['weeks-break'], ['backup-flow'], ['backup-shots-1d3'], ['v3-heavy-1d3'],
  ['3a-break'], ['3b-flows', BASE_URL, '9430'], ['3b-shots'],
  ['4-flows', BASE_URL, '9453'], ['4-report', 'suite', BASE_URL, '9452'], ['4-shots'], ['5a-polish'],
  ['6-body'], ['6-shots'],
  ['4-rollback'], // needs v1.2.0 served at V120_URL; skipped otherwise
  ['6-rollback'], // needs v1.3.0 at V130_URL and/or v1.2.0 at V120_URL; skipped when neither is served
];

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const answers = (url) => fetch(url).then((r) => r.ok).catch(() => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null;
if (!(await answers(BASE_URL))) {
  if (process.env.BASE_URL) {
    console.error(`Nothing answers at ${BASE_URL}. Start it first.`);
    process.exit(1);
  }
  console.log('Starting the dev server on port 3000 ...');
  server = spawn('npx', ['vite', '--port', '3000', '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, shell: true, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await answers(BASE_URL)); i++) await sleep(1000);
  if (!(await answers(BASE_URL))) {
    console.error('The dev server did not start.');
    process.exit(1);
  }
}

const run = (script, scriptArgs) => new Promise((resolve) => {
  const started = Date.now();
  const child = spawn(process.execPath, [path.join(HERE, `${script}.mjs`), ...scriptArgs], { cwd: ROOT, env: { ...process.env, BASE_URL } });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  const timer = setTimeout(() => { output += '\nTIMEOUT after 15 minutes'; child.kill(); }, 15 * 60 * 1000);
  child.on('close', (code) => { clearTimeout(timer); resolve({ code, output, seconds: Math.round((Date.now() - started) / 1000) }); });
});

const rows = [];
let failed = 0;
const started = Date.now();
console.log(`Browser tests against ${BASE_URL}\n`);
try {
  for (const [script, ...scriptArgs] of SUITE) {
    if (only && !only.includes(script)) continue;
    const name = [script, ...scriptArgs.filter((a) => !a.startsWith('http') && !/^94\d\d$/.test(a) && a !== 'suite')].join(' ');
    if (script === '4-rollback' && !(await answers(V120_URL))) {
      rows.push(`SKIP  ${name.padEnd(30)} needs v1.2.0 at ${V120_URL} (see README)`);
      console.log(rows.at(-1));
      continue;
    }
    if (script === '6-rollback' && !(await answers(V120_URL)) && !(await answers(V130_URL))) {
      rows.push(`SKIP  ${name.padEnd(30)} needs v1.3.0 at ${V130_URL} or v1.2.0 at ${V120_URL} (see README)`);
      console.log(rows.at(-1));
      continue;
    }
    const { code, output, seconds } = await run(script, scriptArgs);
    writeFileSync(path.join(LOGS, `${name.replace(/ /g, '-')}.log`), output);
    const count = (prefix) => output.split('\n').filter((line) => line.startsWith(prefix)).length;
    const [pass, fail, skip] = [count('PASS'), count('FAIL'), count('SKIP')];
    const ok = code === 0 && fail === 0 && pass > 0;
    if (!ok) failed++;
    rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(30)} ${String(pass).padStart(3)} passed, ${fail} failed${skip ? `, ${skip} skipped` : ''}${code !== 0 ? `, exit code ${code}` : ''}  (${seconds}s)`);
    console.log(rows.at(-1));
  }
} finally {
  if (server) {
    try {
      if (process.platform === 'win32') execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' });
      else server.kill();
    } catch {}
  }
}
const total = rows.filter((r) => !r.startsWith('SKIP')).length;
console.log(`\n${total - failed} of ${total} scripts passed${failed ? `, ${failed} FAILED` : ''} (${Math.round((Date.now() - started) / 60000)} min). Logs: ${path.relative(ROOT, LOGS)}`);
process.exit(failed ? 1 : 0);
