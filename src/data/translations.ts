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
  dayPill: (dayNum: number) => string;
  exerciseCount: (count: number) => string;
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
  weightInputLabel: (setNum: number, unit: string) => string;
  repsInputLabel: (setNum: number) => string;
  setDoneLabel: (setNum: number) => string;
  restLabel: string;
  restStarted: (time: string) => string;
  restOver: string;
  addRestTime: string;
  addRestTimeShort: string;
  skipRest: string;
  restSound: string;
  soundOn: string;
  soundOff: string;
  storageErrorBanner: string;
  dataSectionTitle: string;
  dataSectionText: string;
  backupButton: string;
  restoreButton: string;
  backupUnavailable: string;
  backupSaved: (fileName: string) => string;
  backupFailed: string;
  restoreConfirmTitle: string;
  restoreFromFile: string;
  restoreOnPhone: string;
  restoreOnPhoneUnreadable: string;
  restoreBackupDate: (date: string) => string;
  restoreUnknownDate: string;
  restoreCounts: (weeks: number, sets: number) => string;
  restoreDropped: string;
  restoreWarning: string;
  restoreConfirmButton: string;
  restoreDone: string;
  restoreErrors: {
    tooLarge: string;
    notJson: string;
    wrongApp: string;
    wrongVersion: string;
    missingData: string;
    invalidData: string;
    readFailed: string;
    safetyCopyFailed: string;
    saveFailed: string;
    noStorage: string;
  };
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
  totalVolumeLifted: string;
  peakLoadPerExercise: string;
  weekLabel: (n: number) => string;
  weekSince: (date: string) => string;
  weekDatesUnknown: string;
  movementsCount: (n: number) => string;
  reportSetsTicked: (n: number) => string;
  reportEmpty: string;
  startNewWeekButton: string;
  startNewWeekTitle: string;
  startNewWeekText: string;
  startNewWeekSummary: (week: number, sets: number) => string;
  startNewWeekEmpty: string;
  startNewWeekSavingOff: string;
  startNewWeekPastWeek: string;
  startNewWeekFailed: string;
  updatedFromOtherTab: string;
  weekStartedElsewhere: string;
  dismissNotice: string;
  pastWeeksButton: (n: number) => string;
  historyTitle: string;
  historyEmpty: string;
  historyEmptyHint: string;
  historyUnreadable: string;
  historyRowSets: (n: number) => string;
  reportBrand: string;
  reportCleared: (percent: number) => string;
  bodyweightShort: string;
  exerciseCountShort: (count: number) => string;
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
    resetModalText: 'Clear the current day, or all 5 days, of this week only. Your past weeks in history and your personal bests are not affected.',
    resetCurrentDayBtn: 'Clear Current Day Progress',
    resetAllDaysBtn: 'Clear All 5 Days (this week only)',
    cancel: 'Cancel',
    dayRoutineTitle: (dayNum) => `Day ${dayNum} Routine`,
    exercisesPrescribed: (count) => `${count} Exercises Prescribed`,
    dayPill: (dayNum) => `Day ${dayNum}`,
    exerciseCount: (count) => `${count} Exercises`,
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
    weightPlaceholder: '–',
    repsPlaceholder: '–',
    weightInputLabel: (setNum, unit) => `Set ${setNum} weight (${unit})`,
    repsInputLabel: (setNum) => `Set ${setNum} reps`,
    setDoneLabel: (setNum) => `Set ${setNum} done`,
    restLabel: 'Rest',
    restStarted: (time) => `Rest started: ${time}`,
    restOver: 'Rest over - next set!',
    addRestTime: 'Add 15 seconds',
    addRestTimeShort: '+15s',
    skipRest: 'Skip',
    restSound: 'Rest timer sound',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    storageErrorBanner:
      "We couldn't read your saved workouts, so nothing will be saved this session. Your data is not deleted. Please reload.",
    dataSectionTitle: 'Your data',
    dataSectionText: 'Your workouts are saved only on this phone. Save a backup file now and then.',
    backupButton: 'Back up my data',
    restoreButton: 'Restore from backup',
    backupUnavailable:
      "Backup is off for now: your saved workouts couldn't be read, so the file would be empty. You can still restore a backup.",
    backupSaved: (fileName) => `Backup file ${fileName} created. Look for it in your Downloads.`,
    backupFailed: "The backup file couldn't be created.",
    restoreConfirmTitle: 'Replace the data on this phone?',
    restoreFromFile: 'Backup file',
    restoreOnPhone: 'On this phone now',
    restoreOnPhoneUnreadable: "Couldn't be read",
    restoreBackupDate: (date) => `Made ${date}`,
    restoreUnknownDate: 'Date unknown',
    restoreCounts: (weeks, sets) => `${weeks} ${weeks === 1 ? 'week' : 'weeks'} · ${sets} ticked ${sets === 1 ? 'set' : 'sets'}`,
    restoreDropped: "Some damaged parts of the file can't be used and will be left out.",
    restoreWarning: 'This replaces the workout data now on this phone. A safety copy of the current data is kept on this phone.',
    restoreConfirmButton: 'Replace my data',
    restoreDone: 'Done! Your workouts were restored from the backup.',
    restoreErrors: {
      tooLarge: 'This file is too large (over 5 MB) to be a backup.',
      notJson: "This file can't be read as a backup.",
      wrongApp: "This file isn't a backup from this app.",
      wrongVersion: 'This backup comes from an unknown version of the app.',
      missingData: 'This backup file contains no workout data.',
      invalidData: "The workout data in this file can't be used.",
      readFailed: "The file couldn't be opened.",
      safetyCopyFailed: "A safety copy of your current data couldn't be saved, so nothing was changed.",
      saveFailed: "The restored data couldn't be saved on this phone, so nothing was changed.",
      noStorage: 'This browser blocks saving data, so nothing was changed.',
    },
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
    totalVolumeLifted: 'Total Volume Lifted',
    peakLoadPerExercise: 'Movement Peak Loads & Tonnage',
    weekLabel: (n) => `Week ${n}`,
    weekSince: (date) => `since ${date}`,
    weekDatesUnknown: 'dates unknown',
    movementsCount: (n) => `${n} Movements`,
    reportSetsTicked: (n) => `${n} ${n === 1 ? 'set' : 'sets'} ✓`,
    reportEmpty: 'No sets ticked this week yet. Tick sets as you train and this report fills in.',
    startNewWeekButton: 'Start new week',
    startNewWeekTitle: 'Start a new week?',
    startNewWeekText: 'This week will be saved to your history. A new empty week begins. Your personal bests are kept.',
    startNewWeekSummary: (week, sets) => `Week ${week} · ${sets} ticked ${sets === 1 ? 'set' : 'sets'}`,
    startNewWeekEmpty: 'Nothing to save this week yet. Tick at least one set first.',
    startNewWeekSavingOff: "Saving is off right now (your saved workouts couldn't be read), so a new week can't be started.",
    startNewWeekPastWeek: "This is a past week from your history. It can't be changed.",
    startNewWeekFailed: "The new week couldn't be saved on this phone, so nothing was changed.",
    updatedFromOtherTab: "Updated from another tab. Your last change here wasn't saved.",
    weekStartedElsewhere: 'Updated from another tab: a new week was already started there.',
    dismissNotice: 'Dismiss',
    pastWeeksButton: (n) => `Past weeks (${n})`,
    historyTitle: 'Past weeks',
    historyEmpty: 'No past weeks yet',
    historyEmptyHint: 'When you start a new week, the finished week appears here.',
    historyUnreadable: "Your saved weeks couldn't be read right now, so they can't be shown.",
    historyRowSets: (n) => `${n} ticked ${n === 1 ? 'set' : 'sets'}`,
    reportBrand: 'MARCUS HYPERTROPHY',
    reportCleared: (percent) => `${percent}% Cleared`,
    bodyweightShort: 'BW',
    exerciseCountShort: (count) => `${count} Ex`,
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
    resetModalText: '可清空当前训练日，或清空本周全部5天的记录（仅限本周）。历史中的过去周和您的个人最佳记录不受影响。',
    resetCurrentDayBtn: '清空本日进度',
    resetAllDaysBtn: '清空本周全部5天（仅限本周）',
    cancel: '取消',
    dayRoutineTitle: (dayNum) => `第 ${dayNum} 天训练`,
    exercisesPrescribed: (count) => `包含 ${count} 项动作`,
    dayPill: (dayNum) => `第 ${dayNum} 天`,
    exerciseCount: (count) => `${count} 项动作`,
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
    weightPlaceholder: '–',
    repsPlaceholder: '–',
    weightInputLabel: (setNum, unit) => `第 ${setNum} 组 重量（${unit}）`,
    repsInputLabel: (setNum) => `第 ${setNum} 组 次数`,
    setDoneLabel: (setNum) => `第 ${setNum} 组 已完成`,
    restLabel: '休息',
    restStarted: (time) => `开始休息：${time}`,
    restOver: '休息结束，开始下一组！',
    addRestTime: '增加 15 秒',
    addRestTimeShort: '+15秒',
    skipRest: '跳过',
    restSound: '休息提示音',
    soundOn: '声音开',
    soundOff: '声音关',
    storageErrorBanner: '无法读取已保存的训练记录，本次使用期间不会保存任何内容。您的数据没有被删除，请刷新页面。',
    dataSectionTitle: '我的数据',
    dataSectionText: '训练记录只保存在这台手机上。请不时保存一份备份文件。',
    backupButton: '备份我的数据',
    restoreButton: '从备份恢复',
    backupUnavailable: '暂时无法备份：已保存的训练记录无法读取，备份文件会是空的。您仍然可以从备份恢复。',
    backupSaved: (fileName) => `已生成备份文件 ${fileName}，请在“下载”中查看。`,
    backupFailed: '无法生成备份文件。',
    restoreConfirmTitle: '用备份替换这台手机上的数据？',
    restoreFromFile: '备份文件',
    restoreOnPhone: '这台手机上现有',
    restoreOnPhoneUnreadable: '无法读取',
    restoreBackupDate: (date) => `备份时间：${date}`,
    restoreUnknownDate: '备份时间未知',
    restoreCounts: (weeks, sets) => `${weeks} 周 · ${sets} 组已完成`,
    restoreDropped: '文件中有部分损坏的内容无法使用，将被略过。',
    restoreWarning: '这会替换这台手机上现有的训练数据。当前数据会在手机上保留一份安全副本。',
    restoreConfirmButton: '替换我的数据',
    restoreDone: '完成！训练记录已从备份恢复。',
    restoreErrors: {
      tooLarge: '文件太大（超过 5 MB），不是有效的备份。',
      notJson: '无法读取这个文件，它不是有效的备份。',
      wrongApp: '这个文件不是本应用的备份。',
      wrongVersion: '这个备份来自未知版本的应用。',
      missingData: '这个备份文件里没有训练数据。',
      invalidData: '文件中的训练数据无法使用。',
      readFailed: '无法打开这个文件。',
      safetyCopyFailed: '无法保存当前数据的安全副本，因此没有做任何更改。',
      saveFailed: '无法在这台手机上保存恢复的数据，因此没有做任何更改。',
      noStorage: '此浏览器禁止保存数据，因此没有做任何更改。',
    },
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
    totalVolumeLifted: '全周总容量',
    peakLoadPerExercise: '各动作极限重量榜',
    weekLabel: (n) => `第 ${n} 周`,
    weekSince: (date) => `${date} 起`,
    weekDatesUnknown: '日期未知',
    movementsCount: (n) => `${n} 个动作`,
    reportSetsTicked: (n) => `${n} 组 ✓`,
    reportEmpty: '本周还没有完成的组。训练时打勾，这份战报就会自动填好。',
    startNewWeekButton: '开始新的一周',
    startNewWeekTitle: '开始新的一周？',
    startNewWeekText: '本周记录将保存到历史中，新的一周从空白开始。您的个人最佳记录会保留。',
    startNewWeekSummary: (week, sets) => `第 ${week} 周 · ${sets} 组已完成`,
    startNewWeekEmpty: '本周还没有可保存的内容。请先完成至少一组。',
    startNewWeekSavingOff: '目前无法保存（已保存的训练记录无法读取），因此不能开始新的一周。',
    startNewWeekPastWeek: '这是历史中的过去一周，无法更改。',
    startNewWeekFailed: '无法在这台手机上保存新的一周，因此没有做任何更改。',
    updatedFromOtherTab: '已从另一个标签页更新，您在此页的最后一次更改未保存。',
    weekStartedElsewhere: '已从另一个标签页更新：那里已经开始了新的一周。',
    dismissNotice: '关闭提示',
    pastWeeksButton: (n) => `历史周（${n}）`,
    historyTitle: '历史周',
    historyEmpty: '还没有过去的周',
    historyEmptyHint: '开始新的一周后，已完成的一周会显示在这里。',
    historyUnreadable: '目前无法读取已保存的周记录，因此无法显示。',
    historyRowSets: (n) => `${n} 组已完成`,
    reportBrand: 'MARCUS 增肌站',
    reportCleared: (percent) => `完成 ${percent}%`,
    bodyweightShort: '自重',
    exerciseCountShort: (count) => `${count} 项`,
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
