export interface LogEntry {
  id: string;
  date: string; // as shown in English
  isoDate: string; // the same day as YYYY-MM-DD, used to show it in 中文
  timestamp: string;
  version?: string; // a release, e.g. "v1.3.0" (shown as written)
  title?: { en: string; zh: string };
  content?: { en: string; zh: string };
  bullets?: { en: string[]; zh: string[] }; // a release's changes, at most 5
  tag?: string;
}

// Newest first
export const updateLogs: LogEntry[] = [
  {
    id: "v1.4.0",
    date: "October 6, 2026",
    isoDate: "2026-10-06",
    timestamp: "06:05",
    version: "v1.4.0",
    bullets: {
      en: [
        "Body measurements: record weight, waist and hips with a date, see a chart and your changes over time",
        "Easier to tap: bigger buttons in dialogs and the muscle map",
        "Fixes: rest timer no longer overlaps buttons in 中文 on small phones, report image footer spacing, and the day description closes when you change day"
      ],
      zh: [
        "身体数据：记录体重、腰围和臀围及日期，查看图表与变化趋势",
        "更易点按：对话框和肌肉图的按钮更大",
        "修复：小屏手机中文版休息计时不再与按钮重叠，周报图片页脚间距，切换日期时自动收起说明"
      ]
    }
  },
  {
    id: "v1.3.0",
    date: "October 5, 2026",
    isoDate: "2026-10-05",
    timestamp: "20:45",
    version: "v1.3.0",
    bullets: {
      en: [
        "Swap an exercise when the machine is taken (either one counts)",
        "Save notes per exercise, like seat height or incline holes",
        "Mark each set Easy / Good / Max, and see what you did last time",
        "Weekly report fits phone screens, is fully translated in 中文, and shows Max sets",
        "About shows the real app version"
      ],
      zh: [
        "器械被占用时可替换动作（做哪个都算完成）",
        "每个动作可保存备注，例如座椅高度或上斜孔位",
        "每组可标记 轻松 / 刚好 / 极限，并显示上次的表现",
        "周报适配手机屏幕，中文版完整翻译，并显示极限组数",
        "「关于」显示真实的应用版本"
      ]
    }
  },
  {
    id: "v1.2.0",
    date: "October 4, 2026",
    isoDate: "2026-10-04",
    timestamp: "18:04",
    version: "v1.2.0",
    bullets: {
      en: [
        "Back up your data to a file and restore it any time",
        "\"Start new week\" saves the finished week to your history",
        "\"Past weeks\" shows every earlier week and its report",
        "Weekly report counts exercises correctly and shows clear empty states",
        "Safer if the app is open in two tabs: older data can't overwrite newer data"
      ],
      zh: [
        "可将数据备份为文件，随时还原",
        "「开始新的一周」会把完成的一周存入历史",
        "「过往周次」可查看每一周及其报告",
        "周报动作数量计算正确，空白状态更清楚",
        "同时开多个分页时更安全，旧数据不会覆盖新数据"
      ]
    }
  },
  {
    id: "v1.1.0",
    date: "October 3, 2026",
    isoDate: "2026-10-03",
    timestamp: "09:19",
    version: "v1.1.0",
    bullets: {
      en: [
        "Phone-friendly layout: slimmer header, compact exercise cards, tap a poster to watch the video full screen",
        "Rest timer after each set (120 / 90 / 60 seconds by rep range) with +15s, Skip and sound",
        "Safer saving, with a backup kept before anything unreadable is dropped",
        "\"New best\" now compares kg and lbs correctly",
        "Weekly report counts only ticked sets, shows once per week, and uses your unit"
      ],
      zh: [
        "手机友好版面：更精简的页首、紧凑的动作卡片，点海报即可全屏看视频",
        "每组之后的休息计时（按次数范围 120 / 90 / 60 秒），可 +15 秒、跳过和提示音",
        "更安全的储存，无法读取的数据会先备份再处理",
        "「新纪录」现在正确比较 kg 和 lbs",
        "周报只计算已勾选的组数，每周只弹出一次，并使用你的单位"
      ]
    }
  },
  {
    id: "v1-launch",
    date: "September 13, 2026",
    isoDate: "2026-09-13",
    timestamp: "15:00",
    tag: "Launch",
    title: {
      en: "Official Launch & Welcome",
      zh: "网站正式上线与欢迎"
    },
    content: {
      en: "Website officially created on September 13, 2026! Welcome to everyone using this routine. Built for pure tracking, dialing in form, and daily consistency. Stay tuned: I am currently designing a dedicated Women's Aesthetic Hypertrophy routine—look forward to it soon!",
      zh: "网站于 2026 年 9 月 13 日正式上线！欢迎所有跟着练的朋友。创建本站纯属记录训练与打磨动作细节。敬请期待：目前我正在规划一套专属女性的体态增肌塑形分化训练，很快就来！"
    }
  }
];
