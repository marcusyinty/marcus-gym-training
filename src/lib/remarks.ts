// Exercise remarks: a short permanent note per exercise (e.g. "incline bench: 3 holes up"). Stored per exercise
// id actually done (an alternative has its own remark; Day 2 and Day 5 Leg Press share one). Not weekly data:
// new weeks and resets never touch them.
import { knownExerciseIds } from './exerciseVariants';

export const REMARK_MAX_LENGTH = 200; // characters as people see them (an emoji or a Chinese character is one)
export const REMARK_MAX_LINES = 3;
export const MAX_REMARKS = 100;

// Splits text into the characters people see, so a cut never breaks an emoji or a character in half
const characters = (text: string): string[] => {
  const Segmenter = (Intl as { Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => { segment: (t: string) => Iterable<{ segment: string }> } }).Segmenter;
  return Segmenter ? Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment) : Array.from(text);
};

// Trimmed; at most 3 lines (extra line breaks become spaces, so no words are lost); at most 200 characters.
// Empty or only spaces means "no remark".
export const normalizeRemark = (text: string): string => {
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n');
  const limited =
    lines.length > REMARK_MAX_LINES ? [...lines.slice(0, REMARK_MAX_LINES - 1), lines.slice(REMARK_MAX_LINES - 1).join(' ')] : lines;
  return characters(limited.join('\n')).slice(0, REMARK_MAX_LENGTH).join('').trim();
};

// While typing in the editor: the same 3-line and 200-character limits, but nothing is trimmed yet (a space
// typed at the end must stay); pasted text over the limits is cut the same way
export const limitRemarkInput = (text: string): string => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const limited =
    lines.length > REMARK_MAX_LINES ? [...lines.slice(0, REMARK_MAX_LINES - 1), lines.slice(REMARK_MAX_LINES - 1).join(' ')] : lines;
  return characters(limited.join('\n')).slice(0, REMARK_MAX_LENGTH).join('');
};

// Characters as people count them (for the "n/200" counter)
export const remarkLength = (text: string): number => characters(text).length;

// Saved remarks as loaded: only text, only for exercise ids the app knows, cleaned like a new remark, at most
// 100. `dropped` is true when anything had to be removed or changed (then the original text is backed up).
export const cleanRemarks = (
  raw: Record<string, unknown>,
  isKnown: (exerciseId: string) => boolean = (exerciseId) => knownExerciseIds.has(exerciseId)
): { remarks: Record<string, string>; dropped: boolean } => {
  const entries: [string, string][] = [];
  let dropped = false;
  for (const [exerciseId, value] of Object.entries(raw)) {
    const text = typeof value === 'string' ? normalizeRemark(value) : '';
    if (!isKnown(exerciseId) || text === '' || entries.length >= MAX_REMARKS) {
      dropped = true;
      continue;
    }
    if (text !== value) dropped = true;
    entries.push([exerciseId, text]);
  }
  // Object.fromEntries keeps odd keys such as "__proto__" as plain keys (they are unknown ids anyway)
  return { remarks: Object.fromEntries(entries), dropped };
};
