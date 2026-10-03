// Rest timer rules and countdown maths, as pure functions (no React, no real clock).
// Times are millisecond timestamps (Date.now() in the app), so the countdown stays right after the
// screen was off or the app was in the background: it is always recomputed from the end time.

// Rest length from an exercise's reps text ("6–8", "8–10/leg", "12–16 total", ...). The last number is
// the upper bound: up to 10 reps -> 120s, 11-12 -> 90s, 13 or more -> 60s; no number in the text -> 90s.
export const restSecondsForReps = (reps: string): number => {
  const numbers = reps.match(/\d+/g);
  if (!numbers) return 90;
  const upperBound = Number(numbers[numbers.length - 1]);
  if (upperBound <= 10) return 120;
  if (upperBound <= 12) return 90;
  return 60;
};

export interface RestCountdown {
  endsAt: number; // when the rest is over (ms timestamp)
  durationMs: number; // total rest length including added time, for the progress bar
}

export const startRestCountdown = (seconds: number, now: number): RestCountdown => ({
  endsAt: now + seconds * 1000,
  durationMs: seconds * 1000,
});

export const restRemainingMs = (countdown: RestCountdown, now: number): number => Math.max(0, countdown.endsAt - now);

export const isRestOver = (countdown: RestCountdown, now: number): boolean => now >= countdown.endsAt;

// Whole seconds left, rounded up, so the display only reaches 00:00 when the rest is really over
export const restSecondsLeft = (countdown: RestCountdown, now: number): number =>
  Math.ceil(restRemainingMs(countdown, now) / 1000);

// 125 -> "02:05"
export const formatMmSs = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

// Share of the rest already done, from 0 to 1
export const restProgress = (countdown: RestCountdown, now: number): number => {
  if (countdown.durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - restRemainingMs(countdown, now) / countdown.durationMs));
};

// "+15s": moves the end time later (from now if it had already passed) and grows the total to match
export const addRestTime = (countdown: RestCountdown, now: number, seconds: number): RestCountdown => {
  const endsAt = Math.max(countdown.endsAt, now) + seconds * 1000;
  return { endsAt, durationMs: countdown.durationMs + (endsAt - countdown.endsAt) };
};
