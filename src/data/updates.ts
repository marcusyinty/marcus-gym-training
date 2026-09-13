export interface LogEntry {
  id: string;
  date: string;
  timestamp: string;
  title: { en: string; zh: string };
  content: { en: string; zh: string };
  tag?: string;
}

export const updateLogs: LogEntry[] = [
  {
    id: "v1-launch",
    date: "September 13, 2026",
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
