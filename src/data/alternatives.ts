// Alternative exercises a slot can be swapped to. By default every slot does its own exercise; the user can
// pick an alternative for the current week only. An alternative uses the sets, reps and muscle tags of the
// slot it replaces. Its video is looked up by its id (none exist yet) and it has no description yet.

export interface AlternativeExercise {
  id: string;
  name: { en: string; zh: string };
}

const alternative = (id: string, en: string, zh: string): AlternativeExercise => ({ id, name: { en, zh } });

// Every alternative exactly once (some are used by two slots)
export const alternativeExercises: AlternativeExercise[] = [
  alternative('db-shoulder-press', 'Seated DB Shoulder Press', '坐姿哑铃肩推'),
  alternative('incline-machine-press', 'Incline Machine Press', '上斜器械推胸'),
  alternative('neutral-grip-pulldown', 'Neutral-Grip Pulldown', '对握高位下拉'),
  alternative('chest-supported-machine-row', 'Chest-Supported Machine Row', '胸托器械划船'),
  alternative('db-overhead-tricep-extension', 'DB Overhead Tricep Extension', '哑铃过头臂屈伸'),
  alternative('cable-curl', 'Cable Curl', '绳索弯举'),
  alternative('hack-squat', 'Hack Squat', '哈克深蹲'),
  alternative('smith-split-squat', 'Smith Split Squat', '史密斯分腿蹲'),
  alternative('lying-leg-curl', 'Lying Leg Curl', '俯卧腿弯举'),
  alternative('seated-calf-raise', 'Seated Calf Raise', '坐姿提踵'),
  alternative('machine-chest-press', 'Machine Chest Press', '器械推胸'),
  alternative('pec-deck', 'Pec Deck', '蝴蝶机夹胸'),
  alternative('db-lateral-raise', 'DB Lateral Raise', '哑铃侧平举'),
  alternative('db-pullover', 'DB Pullover', '哑铃仰卧上拉'),
  alternative('reverse-pec-deck', 'Reverse Pec Deck', '反向蝴蝶机'),
];

// Slot id -> the alternatives allowed in that slot. Slots not listed have no alternative
// (RDL, leg extensions, 45-degree back extensions, ab exercises, hammer curl, wrist curls).
export const slotAlternatives: Record<string, string[]> = {
  // Day 1
  'machine-shoulder-press': ['db-shoulder-press'],
  'incline-db-press': ['incline-machine-press'],
  'lat-pulldown': ['neutral-grip-pulldown'],
  'one-arm-dumbbell-row': ['chest-supported-machine-row'],
  'rope-cable-tricep-pushdown': ['db-overhead-tricep-extension'],
  'incline-db-supinated-wrist-curl': ['cable-curl'],
  // Day 2
  'leg-press': ['hack-squat'],
  'bulgarian-split-squat': ['smith-split-squat'],
  'seated-leg-curl': ['lying-leg-curl'],
  'standing-calf-raises': ['seated-calf-raise'],
  // Day 3
  'flat-db-press': ['machine-chest-press'],
  'standing-cable-fly': ['pec-deck'],
  'btb-lateral-raise': ['db-lateral-raise'],
  'cable-overhead-tricep-extension': ['db-overhead-tricep-extension'],
  // Day 4
  'seated-cable-row': ['chest-supported-machine-row'],
  'straight-arm-cable-pulldown': ['db-pullover'],
  'cable-facepull': ['reverse-pec-deck'],
  // Day 5
  'seated-leg-curl-lower-b': ['lying-leg-curl'],
  'leg-press-lower-b': ['hack-squat'],
};
