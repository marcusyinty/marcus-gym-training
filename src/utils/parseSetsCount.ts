// Turns a sets string into a set count: "2–3" → 3, "3" → 3, anything invalid → 3
export const parseSetsCount = (setsStr: string): number => {
  if (setsStr.includes('–')) {
    const parts = setsStr.split('–');
    return parseInt(parts[1], 10) || 3;
  }
  return parseInt(setsStr, 10) || 3;
};
