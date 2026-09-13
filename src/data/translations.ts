export type Language = 'en' | 'zh';

export interface UiTranslations {
  appTitle: string;
  appSubTitle: string;
  programBadge: string;
  beginnerStandardTitle: string;
  beginnerStandardText: string;
  setsCompleted: string;
  resetDay: string;
  resetModalTitle: string;
  resetModalText: string;
  resetCurrentDayBtn: string;
  resetAllDaysBtn: string;
  cancel: string;
  dayRoutineTitle: (dayNum: number) => string;
  exercisesPrescribed: (count: number) => string;
  dayProgress: string;
  formDemoTab: string;
  muscleMapTab: string;
  volumeLabel: string;
  sets: string;
  reps: string;
  prevBest: (weight: string, unit: string, reps: string) => string;
  targetsLabel: string;
  coachingCueLabel: string;
  logSessionLabel: (completed: number, total: number) => string;
  setBtn: (setNum: number) => string;
  weightPlaceholder: string;
  repsPlaceholder: string;
  dayCompleteTitle: (dayNum: number) => string;
  dayCompleteText: (dayTitle: string) => string;
  footerTitle: string;
  footerSub: string;
  aboutTitle: string;
  aboutContent: string;
  close: string;
  mutedLoop: string;
  targetAnatomy: string;
  allView: string;
  frontView: string;
  backView: string;
  primaryTarget: string;
  secondaryTarget: string;
  hoverMuscleNotice: string;

  // Step 7: Weekly Report Additions
  weeklyReportBtn: string;
  weeklyReportTitle: string;
  weeklyReportSub: string;
  daysCleared: string;
  totalSetsLogged: string;
  movementsMastered: string;
  downloadReportImage: string;
  downloading: string;
  shareSuccess: string;
  weeklyQuote: string;
  verifiedBadge: string;
}

export const uiTranslations: Record<Language, UiTranslations> = {
  en: {
    appTitle: 'AESTHETIC RECOMP',
    appSubTitle: 'Physique Recomposition Guide',
    programBadge: '5-Day Hypertrophy',
    beginnerStandardTitle: 'Beginner Form & Progression Standard',
    beginnerStandardText:
      'Follow prescribed workout day-by-day. Complete all sets & reps with strict tempo as demonstrated in the videos.',
    setsCompleted: 'Sets',
    resetDay: 'Reset Day',
    resetModalTitle: 'Reset Workout Memory?',
    resetModalText: 'Choose to reset completed sets for current day or clear all program logs to start a new training week.',
    resetCurrentDayBtn: 'Clear Current Day Progress',
    resetAllDaysBtn: 'Clear All 5 Days (Full Program Reset)',
    cancel: 'Cancel',
    dayRoutineTitle: (dayNum) => `Day ${dayNum} Routine`,
    exercisesPrescribed: (count) => `${count} Exercises Prescribed`,
    dayProgress: 'Day Progress',
    formDemoTab: 'Form Demo',
    muscleMapTab: 'Muscle Map',
    volumeLabel: 'Volume',
    sets: 'SETS',
    reps: 'REPS',
    prevBest: (weight, unit, reps) => `Prev: ${weight} ${unit} × ${reps}`,
    targetsLabel: 'Targets:',
    coachingCueLabel: 'COACHING CUE',
    logSessionLabel: (completed, total) => `Log Session (${completed}/${total} Sets)`,
    setBtn: (setNum) => `Set ${setNum}`,
    weightPlaceholder: '0',
    repsPlaceholder: '0',
    dayCompleteTitle: (dayNum) => `Day ${dayNum} Complete! 🎉`,
    dayCompleteText: (dayTitle) =>
      `Outstanding work on ${dayTitle}. Fuel up with protein and rest up for your next training session.`,
    footerTitle: 'Aesthetic 5-Day Recomposition Hypertrophy System',
    footerSub: 'Hosted on GitHub & Deployed on Vercel • Cloudinary Media Engine',
    aboutTitle: "About Marcus' Hypertrophy Hub",
    aboutContent:
      "Hey, this is Marcus' personal hypertrophy hub. Built purely for fun, tracking the grind, and dialing in form. Using this split until the day I die. Follow along, train hard, and don't skip your sets.",
    close: 'Close',
    mutedLoop: 'Muted Loop',
    targetAnatomy: 'Target Anatomy',
    allView: 'All',
    frontView: 'Front',
    backView: 'Back',
    primaryTarget: 'Primary',
    secondaryTarget: 'Secondary',
    hoverMuscleNotice: 'Hover muscle',

    weeklyReportBtn: 'Weekly Report',
    weeklyReportTitle: 'WEEKLY COMPLETION REPORT',
    weeklyReportSub: '5-Day Hypertrophy Recomp Summary',
    daysCleared: 'Days Cleared',
    totalSetsLogged: 'Total Sets Logged',
    movementsMastered: 'Movements Mastered',
    downloadReportImage: 'Download Image',
    downloading: 'Exporting PNG...',
    shareSuccess: 'Report Image Downloaded!',
    weeklyQuote:
      'Consistency compounds. Form stayed strict, zero sets skipped. Ready for progressive overload next week.',
    verifiedBadge: 'Verified Aesthetic Routine by Marcus',
  },
  zh: {
    appTitle: '美学型体塑造',
    appSubTitle: '5天高效增肌减脂训练指南',
    programBadge: '5天增肌分化',
    beginnerStandardTitle: '新手动作标准与进阶原则',
    beginnerStandardText: '严格按日程执行训练。遵循视频中的动作标准，保质保量完成每一组与目标次数。',
    setsCompleted: '组数',
    resetDay: '重置本日',
    resetModalTitle: '重置训练记录？',
    resetModalText: '您可以重置当前训练日的完成进度，或清空全部5天记录开启新一轮周期。',
    resetCurrentDayBtn: '清空本日进度',
    resetAllDaysBtn: '重置全部5天 (开启新周期)',
    cancel: '取消',
    dayRoutineTitle: (dayNum) => `第 ${dayNum} 天训练`,
    exercisesPrescribed: (count) => `包含 ${count} 项动作`,
    dayProgress: '本日进度',
    formDemoTab: '动作示范',
    muscleMapTab: '目标肌群',
    volumeLabel: '容量',
    sets: '组',
    reps: '次',
    prevBest: (weight, unit, reps) => `上次: ${weight} ${unit} × ${reps}次`,
    targetsLabel: '主/辅肌群:',
    coachingCueLabel: '动作要领',
    logSessionLabel: (completed, total) => `训练打卡 (${completed}/${total} 组)`,
    setBtn: (setNum) => `第 ${setNum} 组`,
    weightPlaceholder: '0',
    repsPlaceholder: '0',
    dayCompleteTitle: (dayNum) => `第 ${dayNum} 天训练打卡完成！🎉`,
    dayCompleteText: (dayTitle) => `【${dayTitle}】训练顺利完成！及时补充蛋白质与碳水，保持充足休息。`,
    footerTitle: 'Marcus 5天美学形体增肌训练系统',
    footerSub: 'GitHub 开源 & Vercel 部署 • Cloudinary 高清视频引擎',
    aboutTitle: '关于 Marcus 增肌站',
    aboutContent:
      '嗨，这是 Marcus 的个人健美增肌站。纯属自娱自乐兼记录日常训练。这套 5 天分化计划我会一直练下去。跟着练、抓紧动作细节、别偷懒漏组。',
    close: '关闭',
    mutedLoop: '无音循环',
    targetAnatomy: '解剖目标图',
    allView: '全景',
    frontView: '正面',
    backView: '背面',
    primaryTarget: '主目标',
    secondaryTarget: '辅目标',
    hoverMuscleNotice: '悬停查看肌群',

    weeklyReportBtn: '本周战报',
    weeklyReportTitle: '本周训练完成战报',
    weeklyReportSub: '5天增肌分化全满贯总结',
    daysCleared: '完成天数',
    totalSetsLogged: '打卡组数',
    movementsMastered: '动作项',
    downloadReportImage: '下载战报图片',
    downloading: '导出图片中...',
    shareSuccess: '战报图片已保存！',
    weeklyQuote: '自律铸就体态。动作标准，未漏一组。下周继续渐进超负荷！',
    verifiedBadge: 'Marcus 美学增肌认证战报',
  },
};

export interface ExerciseTranslation {
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  coachingCue: string;
}

export interface DayTranslation {
  title: string;
  focus: string;
  description: string;
}

export const dayTranslationsZh: Record<string, DayTranslation> = {
  'day-1': {
    title: '第一天：上肢 A',
    focus: '上肢肥大 & 上胸/背阔偏置',
    description: '重点强化上胸、背阔肌、三角肌前束与双臂，保持标准轨迹。',
  },
  'day-2': {
    title: '第二天：下肢 A',
    focus: '股四头肌 & 腘绳肌基础',
    description: '复合推腿与腘绳肌髋屈伸重负荷结合。',
  },
  'day-3': {
    title: '第三天：推特化 (+ 腹肌 A)',
    focus: '胸肌、肩中束、三头肌 & 腹肌下部',
    description: '针对推系肌群孤立增肌，配合核心下部撕裂。',
  },
  'day-4': {
    title: '第四天：拉特化 (+ 腹肌 B)',
    focus: '背部厚度、肩后束、前臂 & 斜腹肌',
    description: '打造 V 型倒三角厚度与前臂强握力，配合斜腹肌雕琢。',
  },
  'day-5': {
    title: '第五天：下肢 B',
    focus: '后链链条 & 股四头肌泵感力竭',
    description: '强化腘绳肌、臀肌与竖脊肌后链，辅以股四头肌离心泵感。',
  },
};

export const exerciseTranslationsZh: Record<string, ExerciseTranslation> = {
  'incline-db-press': {
    name: '上斜哑铃卧推',
    primaryMuscles: ['上胸 (锁骨头)'],
    secondaryMuscles: ['三角肌前束', '肱三头肌'],
    coachingCue: '大臂与躯干夹角保持约 45-60°，沉肩夹背，顶部充分挤压上胸。',
  },
  'lat-pulldown': {
    name: '高位下拉',
    primaryMuscles: ['背阔肌'],
    secondaryMuscles: ['上背肌群', '肱二头肌'],
    coachingCue: '驱动双肘垂直向下压入裤兜方向，避免身体过度后仰代偿。',
  },
  'machine-shoulder-press': {
    name: '器械推肩',
    primaryMuscles: ['三角肌前束'],
    secondaryMuscles: ['三角肌中束', '肱三头肌'],
    coachingCue: '控制离心缓慢下放至下巴高度，再垂直发力推起。',
  },
  'one-arm-dumbbell-row': {
    name: '单臂哑铃划船',
    primaryMuscles: ['中下背阔肌'],
    secondaryMuscles: ['菱形肌', '核心稳定肌'],
    coachingCue: '向髋关节褶皱方向拉动哑铃，保持躯干稳定与脊柱中立。',
  },
  'rope-cable-tricep-pushdown': {
    name: '绳索三头下压',
    primaryMuscles: ['肱三头肌 (外侧头与内侧头)'],
    secondaryMuscles: [],
    coachingCue: '大臂紧贴肋骨锁定；底部完全伸展时向两侧外展绳索。',
  },
  'incline-db-supinated-wrist-curl': {
    name: '上斜哑铃旋前弯举',
    primaryMuscles: ['肱二头肌 (长头)'],
    secondaryMuscles: ['前臂'],
    coachingCue: '起始掌心相对，向上弯举过程中用力向外旋转手腕挤压二头肌。',
  },
  'leg-press': {
    name: '倒蹬机 Leg Press',
    primaryMuscles: ['股四头肌'],
    secondaryMuscles: ['臀大肌', '内收肌群'],
    coachingCue: '深度下放至膝关节呈 90°，切勿让臀部离开靠背。',
  },
  'rdl': {
    name: '罗马尼亚硬拉 (RDL)',
    primaryMuscles: ['腘绳肌'],
    secondaryMuscles: ['臀大肌', '竖脊肌'],
    coachingCue: '以髋关节为轴做折叠屈髋，臀部向后推，膝盖微屈保持张力。',
  },
  'bulgarian-split-squat': {
    name: '保加利亚分腿蹲',
    primaryMuscles: ['股四头肌', '臀大肌'],
    secondaryMuscles: ['臀中肌稳定肌'],
    coachingCue: '躯干微前倾偏置臀部发力；后腿膝盖垂直下沉接近地面。',
  },
  'seated-leg-curl': {
    name: '坐姿腿弯举',
    primaryMuscles: ['腘绳肌 (屈膝)'],
    secondaryMuscles: [],
    coachingCue: '压板紧锁大腿；控制节奏拉动脚踝下收至座位底部。',
  },
  'standing-calf-raises': {
    name: '站姿提踵',
    primaryMuscles: ['小腿腓肠肌'],
    secondaryMuscles: ['比目鱼肌'],
    coachingCue: '底部保持 2 秒充分拉伸，脚掌发力顶峰收缩 1 秒。',
  },
  'flat-db-press': {
    name: '平板哑铃卧推',
    primaryMuscles: ['胸大肌中下部'],
    secondaryMuscles: ['三角肌前束', '肱三头肌'],
    coachingCue: '保持自然拱背，双脚踩实地面，于胸前上方推起哑铃。',
  },
  'standing-cable-fly': {
    name: '站姿绳索夹胸',
    primaryMuscles: ['胸大肌'],
    secondaryMuscles: ['三角肌前束'],
    coachingCue: '想象环抱大树；注意力集中在双臂二头肌在胸前靠近。',
  },
  'btb-lateral-raise': {
    name: '背后绳索侧平举',
    primaryMuscles: ['三角肌中束'],
    secondaryMuscles: [],
    coachingCue: '滑轮定于手腕高度；向两侧弧线扫出手臂，减少斜方肌耸肩。',
  },
  'cable-overhead-tricep-extension': {
    name: '绳索过顶三头伸展',
    primaryMuscles: ['肱三头肌 (长头)'],
    secondaryMuscles: [],
    coachingCue: '肘部固定于耳侧上方；头部后方深度拉伸后再发力伸展。',
  },
  'reverse-crunch-abs-a': {
    name: '反向卷腹',
    primaryMuscles: ['腹直肌下部'],
    secondaryMuscles: ['屈髋肌'],
    coachingCue: '尾骨向上卷起离开垫子朝向肋骨；切勿靠甩腿借力。',
  },
  'decline-ab-crunch': {
    name: '下斜卷腹',
    primaryMuscles: ['腹直肌上部'],
    secondaryMuscles: ['核心稳定肌'],
    coachingCue: '胸椎控制屈曲；将肋骨向下卷向盆骨，底部感受深度拉伸。',
  },
  'seated-cable-row': {
    name: '坐姿绳索划船',
    primaryMuscles: ['上背肌群 (菱形肌、斜方肌中束)'],
    secondaryMuscles: ['三角肌后束', '背阔肌', '二头肌'],
    coachingCue: '先收拢肩胛骨启动，随后将手柄拉向胸骨方向。',
  },
  'straight-arm-cable-pulldown': {
    name: '直臂绳索下拉',
    primaryMuscles: ['背阔肌'],
    secondaryMuscles: ['大圆肌', '核心'],
    coachingCue: '躯干微前倾；双臂保持直臂僵直，沿弧线压至大腿前侧。',
  },
  'cable-facepull': {
    name: '绳索面拉',
    primaryMuscles: ['三角肌后束', '肩袖肌群'],
    secondaryMuscles: ['斜方肌上束'],
    coachingCue: '将绳索拉向鼻梁/前额高度，双手外旋向后过耳。',
  },
  'db-hammer-curl': {
    name: '哑铃锤式弯举',
    primaryMuscles: ['肱肌', '肱桡肌'],
    secondaryMuscles: ['肱二头肌'],
    coachingCue: '全程保持大拇指朝上的中立握法；严禁前后晃动肩膀借力。',
  },
  'seated-db-supinated-wrist-curls': {
    name: '坐姿哑铃正握腕弯举',
    primaryMuscles: ['前臂屈肌群'],
    secondaryMuscles: ['握力'],
    coachingCue: '前臂平放在大腿上，手腕向上弯举并缓慢控节奏下放。',
  },
  'seated-db-pronated-wrist-curls': {
    name: '坐姿哑铃反握腕弯举',
    primaryMuscles: ['前臂伸肌群'],
    secondaryMuscles: ['握力'],
    coachingCue: '掌心朝下，在严格控制下将手背向上抬起朝向天花板。',
  },
  'bicycle-crunches': {
    name: '慢速交叉卷腹 (单车卷腹)',
    primaryMuscles: ['腹斜肌'],
    secondaryMuscles: ['腹直肌'],
    coachingCue: '2秒节奏、顶峰停顿1秒；用肩膀（而非肘部）靠近对侧膝盖。',
  },
  'reverse-crunch-abs-b': {
    name: '反向卷腹',
    primaryMuscles: ['腹直肌下部'],
    secondaryMuscles: ['屈髋肌'],
    coachingCue: '控制尾骨平稳抬起；下放离心过程严禁依赖惯性。',
  },
  'rdl-lower-b': {
    name: '罗马尼亚硬拉 (RDL)',
    primaryMuscles: ['腘绳肌'],
    secondaryMuscles: ['臀大肌', '竖脊肌'],
    coachingCue: '向后加载髋关节，体会腘绳肌强烈拉伸感，收紧臀部锁定。',
  },
  'seated-leg-curl-lower-b': {
    name: '坐姿腿弯举',
    primaryMuscles: ['腘绳肌 (屈膝)'],
    secondaryMuscles: ['小腿'],
    coachingCue: '脚尖微朝向胫骨，保持 3 秒慢节奏离心下放。',
  },
  'leg-press-lower-b': {
    name: '倒蹬机 Leg Press',
    primaryMuscles: ['股四头肌'],
    secondaryMuscles: ['臀大肌', '内收肌群'],
    coachingCue: '双脚与肩同宽踩在踏板中部；中脚掌发力，切勿锁死膝盖。',
  },
  'seated-leg-extension': {
    name: '腿伸展 (踢腿机)',
    primaryMuscles: ['股直肌 & 股四头肌泵感'],
    secondaryMuscles: [],
    coachingCue: '顶点伸直锁定位置停顿 1 秒挤压股四头肌，再缓慢下放。',
  },
  '45-degree-back-extension': {
    name: '45度山羊挺身 (背伸展)',
    primaryMuscles: ['竖脊肌', '臀大肌'],
    secondaryMuscles: ['腘绳肌上部'],
    coachingCue: '以髋部折叠；顶部保持脊柱中立或微含胸以偏置臀大肌与下背。',
  },
};
