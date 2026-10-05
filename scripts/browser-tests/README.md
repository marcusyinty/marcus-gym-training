# Browser tests

These scripts drive the real app in headless Google Chrome with real taps, real downloads and the real file picker. Each script prints `PASS` / `FAIL` lines. Unit tests live next to the code instead (`npm test`).

## Run everything (one command)

```
npm run test:browser
```

This is the same as `node scripts/browser-tests/run-all.mjs`.

- **Dev server:** uses the one on port 3000, or starts one itself if nothing answers there and stops it afterwards.
- **Output:** one line per script and a total. The exit code is 1 if any script failed.
- **Time:** about 30 minutes.
- **One script:** `node scripts/browser-tests/<name>.mjs`.
- **Only some:** `node scripts/browser-tests/run-all.mjs --only 4-flows,compact-check`.

**Requirements:** Node 22 or newer, and Google Chrome installed. No npm package is needed: `cdp.mjs` talks to Chrome with Node's built-in `fetch` and `WebSocket`. The suite adds nothing to `dependencies` or `devDependencies`, so installs and Vercel builds are unaffected.

**Settings** (environment variables, all optional):

| Variable | Default | Meaning |
|---|---|---|
| `BASE_URL` | `http://localhost:3000/` | The app under test, e.g. a production build served by `npx vite preview --port 3002` |
| `CHROME_PATH` | the usual Chrome install location | The Chrome binary |
| `V120_URL` | `http://localhost:3001/` | A served v1.2.0 build, for the rollback checks (below) |
| `V130_URL` | `http://localhost:3003/` | A served v1.3.0 build, for the step 6 rollback checks (below) |

## Where things go

| What | Where | In git? |
|---|---|---|
| Screenshots, logs, downloaded report images | `review-shots/` | No (ignored) |
| Throwaway Chrome profiles, downloads, generated backup files | the system temp folder, `marcus-browser-tests/` | No (outside the repo) |
| Test data | `fixtures/` | Yes, made-up data only |

**About the fixtures.** All test data is made up; none of it comes from anyone's real saved data or backups.
- `fixtures/old-saved-text.json` and `fixtures/old-screen.json` were made on 2 Oct 2026 by a test script: it typed invented sets (60 kg × 8, 62.5 kg × 6, 135 lbs × 10, 100 kg × 5) into the old app in a fresh, throwaway browser profile, then recorded the saved text and the screen.
- `fixtures/seed.mjs` builds invented past weeks.

## The scripts

| Script | What it checks |
|---|---|
| `tabs-behavior` | Day tab strip: edge fades, the active tab scrolls into view, done dot |
| `verify-persist` | The app asks for persistent storage once and keeps working if the browser refuses |
| `verify-units` | The single saved kg/lbs setting; conversions; stored weights never change |
| `verify-best` | "Previous best" rules (only ticked sets, never lowered) and two tabs in sync; only the v3 key is written |
| `verify-new` | Old v2 data loads with the same sets and bests, the old keys stay byte-for-byte; saving on tab close; two tabs; full storage |
| `verify-report-units` | Weekly report totals with kg and lbs sets, in both units, plus the image export |
| `keyboard-check` | Set-row keyboards: input types, tap selects the value, Enter goes weight → reps → closed, labels |
| `modal-check` | Video window: loads one video only when opened, muted loop, scroll lock, closes |
| `daycard-check` | Compact day card: height, title lines, progress bar values, description, text sizes |
| `compact-check` | Compact exercise card: thumbnail, cue clamp, muscle map, the "no video yet" placeholder |
| `check-fixes` | The day tabs stay right under the header; the weekly report opens by itself once when the week completes |
| `check-reset` | Reset dialog: covers the screen, closes, resets the day; run at 360/320 in EN and 中文 |
| `rest-timer-check` | Rest timer with a fake clock: start rule, +15s, Skip, end alert, auto-hide |
| `rest-cover` | With the rest bar showing, the last set rows and the footer can still be scrolled into view |
| `about-1d4` | About window at 320/360, EN and 中文: version, developer log, footer |
| `report-export` | Weekly report fits the screen; the downloaded image's size; the off-screen copy is cleaned up |
| `v3-scenarios` | The 8 data scenarios of the v3 store: migration, broken data, backups of unreadable data, error mode |
| `weeks-flow` | Start new week → past weeks → old report → units and language → reload |
| `weeks-break` | Weeks under stress: stale tabs, empty week, unreadable dates |
| `backup-flow` | Back up → change → restore; cancel; broken files; safety copies; error mode |
| `backup-shots-1d3` | Backup and restore screens at 360/320, EN and 中文 |
| `v3-heavy-1d3` | Heavy use with backup and restore; the old v2 keys never change |
| `3a-break` | Swap and note data rules under stress; with `V120_URL` up, also the rollback to v1.2.0 |
| `3b-flows` | Swap chooser and note editor with real taps, stale tabs, back gesture |
| `3b-shots` | Swap and note screens at 360/320, EN and 中文 |
| `4-flows` | Set tags and "last time" with real taps (details below) |
| `4-report` | "Max on set …" lines in the report; image size with and without tags; numbers unchanged |
| `4-shots` | Tag and "last time" screens at 360/320, EN and 中文 |
| `5a-polish` | Step 5A fixes (details below) |
| `6-body` | Body measurements with real taps (details below) |
| `6-shots` | Body screen, About and restore panel at 360/320, EN and 中文, with layout checks |
| `4-rollback` | Data with tags opened in real v1.2.0 and back. Needs `V120_URL`, otherwise skipped |
| `6-rollback` | Data with body measurements opened in real v1.3.0 and v1.2.0, used there, and back. Needs `V130_URL` and/or `V120_URL`, otherwise skipped |

What `4-flows` covers:
- the tag prompt rules and the tag sheet
- untick clears the tag; Reset day
- new weeks, including a skipped week; swapped exercises
- kg/lbs and 中文
- a stale tab, a backup round trip, and tags left behind by older versions

What `5a-polish` checks:
- the rest timer fits at 320px
- the report footer has its gap
- every dialog button is at least 44px
- the day description closes when the day changes
- muscle-map sizes and its touch-screen wording
- the About text sizes
- the old v2 keys are unchanged

What `6-body` covers:
- add, edit, move to another day, delete; the same day asks before replacing
- refused input: a future day, not a number, out of range; "." and "," decimals; height
- kg/lbs: shown converted, stored as typed, no drift after 5 switches
- the chart, its ranges and the summary, with 0, 1, 2 and many entries
- reload, Reset day, Reset all and Start new week leave body data alone
- backup and restore, including an old backup without body data
- stale tabs (another tab saves the same day while the replace question is open)
- broken body data, the 2,000-entry cap, 中文 at 320px
- privacy: body values never appear outside the Body screen, About and the backup file (all days, the report, its image and file name, past weeks, console, network, storage)

`cdp.mjs` is the shared helper (start Chrome, open pages, tap, read storage). `run-all.mjs` is the runner.

## Rollback checks (optional)

`3a-break` (its last part), `4-rollback` and `6-rollback` open data in released code. They need v1.2.0 served on port 3001 (and, for `6-rollback`, v1.3.0 on port 3003); without it they print `SKIP`. To serve them:

```
mkdir ../v120 && git archive v1.2.0 | tar -x -C ../v120    # a copy of the v1.2.0 code
cd ../v120 && npm ci && npx vite --port 3001
mkdir ../v130 && git archive v1.3.0 | tar -x -C ../v130    # a copy of the v1.3.0 code
cd ../v130 && npm ci && npx vite --port 3003
```

## Testing a production build

```
npm run build
npx vite preview --port 3002
BASE_URL=http://localhost:3002/ npm run test:browser
```

In PowerShell, set the variable first with `$env:BASE_URL = 'http://localhost:3002/'`.
