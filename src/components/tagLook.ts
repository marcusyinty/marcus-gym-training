// How the three set tags look everywhere (prompt, sheet, help text). Outlined pills, so they never look like the
// grey filled +15s / Skip buttons of the rest timer.
import type { SetTag } from '../lib/store/reducer';

export const TAG_ORDER: readonly SetTag[] = ['easy', 'good', 'max'];

export const tagText: Record<SetTag, string> = {
  easy: 'text-sky-300',
  good: 'text-emerald-300',
  max: 'text-amber-300',
};

export const tagOutline: Record<SetTag, string> = {
  easy: 'border-sky-400/70 text-sky-200 hover:bg-sky-400/10',
  good: 'border-emerald-400/70 text-emerald-200 hover:bg-emerald-400/10',
  max: 'border-amber-400/80 text-amber-200 hover:bg-amber-400/10',
};

export const tagFilled: Record<SetTag, string> = {
  easy: 'border-sky-400 bg-sky-400 text-black',
  good: 'border-emerald-400 bg-emerald-400 text-black',
  max: 'border-amber-400 bg-amber-400 text-black',
};
