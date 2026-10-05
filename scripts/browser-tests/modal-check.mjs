// Video modal on a phone: loads one video only when opened, plays muted + loops, scroll lock,
// taps on the video controls keep it open, and X / tap outside / Escape close it.
import { writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, sleep, SHOTS } from './cdp.mjs';

const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${JSON.stringify(actual)})`);
};
const MODAL = `document.querySelector('[role="dialog"][aria-modal="true"] video')?.closest('[role="dialog"]')`;
const isOpen = () => page.evaluate(`!!(${MODAL})`);
const locks = () => page.evaluate(`[document.body.style.overflow, document.documentElement.style.overflow]`);
const tap = async (x, y) => {
  for (const type of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
};
const openThumb = async (i) => { await page.evaluate(`document.querySelectorAll('main button[aria-label^="Form Demo"]')[${i}].click()`); await sleep(2500); };

const chrome = await launchChrome(9357, 'profile-modal');
const page = await chrome.newPage(360, 740);
try {
  await page.goto();
  await page.evaluate(`localStorage.clear(); localStorage.setItem('language_preference', 'en'); localStorage.setItem('aesthetic_recomp_unit_v1', 'kg');`);
  const media = [];
  page.onEvent((msg) => {
    if (msg.method === 'Network.requestWillBeSent' && msg.params.type === 'Media') media.push(msg.params.request.url.split('/').pop().split('?')[0]);
  });
  await page.send('Network.enable');
  await page.reload(4000);
  await page.evaluate(`window.scrollTo(0, 500)`); await sleep(300);
  check('no video requested on page load', media, []);

  await openThumb(1); // Lat Pulldown
  check('tapping a thumbnail loads exactly that one video', media, ['lat-pulldown']);
  const video = await page.evaluate(`(() => { const v = ${MODAL}.querySelector('video'); return { muted: v.muted, loop: v.loop, playing: !v.paused && v.currentTime > 0 }; })()`);
  check('modal video plays, muted, looping', video, { muted: true, loop: true, playing: true });
  check('page scroll is locked while open', await locks(), ['hidden', 'hidden']);
  const yBefore = await page.evaluate('Math.round(scrollY)');
  await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 180, y: 20, deltaX: 0, deltaY: 600 });
  await sleep(500);
  check('wheel/scroll on the backdrop does not move the page', await page.evaluate('Math.round(scrollY)'), yBefore);
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(`${SHOTS}/2b-after`, { recursive: true });
  writeFileSync(`${SHOTS}/2b-after/360x740-en-video-modal.png`, Buffer.from(data, 'base64'));

  // Tap the video and its control bar: must stay open
  const v = await page.evaluate(`(() => { const r = ${MODAL}.querySelector('video').getBoundingClientRect(); return { x: r.left + r.width / 2, mid: r.top + r.height / 2, bar: r.bottom - 12 }; })()`);
  await tap(v.x, v.mid); await sleep(300);
  await tap(v.x, v.bar); await sleep(300);
  check('tapping the video and its controls keeps the modal open', await isOpen(), true);

  const backdropY = await page.evaluate(`Math.round(${MODAL}.firstElementChild.getBoundingClientRect().top / 2)`);
  await tap(180, backdropY); await sleep(400);
  check(`tap outside (backdrop at y=${backdropY}) closes it and unlocks scroll`, [await isOpen(), await locks()], [false, ['', '']]);
  check('closing removes the video (it stops loading)', await page.evaluate(`document.querySelectorAll('video').length`), 0);

  await openThumb(1);
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(400);
  check('Escape closes it and unlocks scroll', [await isOpen(), await locks()], [false, ['', '']]);

  await openThumb(1);
  await page.evaluate(`${MODAL}.querySelector('button[aria-label="Close"]').click()`); await sleep(400);
  check('X closes it and unlocks scroll', [await isOpen(), await locks()], [false, ['', '']]);
  check('page scroll position kept after closing', await page.evaluate('Math.round(scrollY)'), yBefore);
  check('No page errors', page.errors, []);
} finally {
  console.log(results.join('\n'));
  chrome.kill();
}
