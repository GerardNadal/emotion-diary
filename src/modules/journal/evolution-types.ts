export type PeriodMetrics = {
  entries: number;
  recorded_days: number;
  mood_average: number | null;
  intensity_average: number | null;
};
export type Statistics = {
  from: string;
  to: string;
  previous_from: string;
  previous_to: string;
  timezone: string;
  current: PeriodMetrics;
  previous: PeriodMetrics;
  days: {
    day: string;
    count: number;
    mood_average: number | null;
    intensity_average: number | null;
  }[];
  distributions: {
    present: boolean;
    kind: "mood" | "emotion" | "intensity";
    value: string;
    count: number;
  }[];
  triggers: {
    category: string | null;
    reason: string | null;
    custom: string | null;
    count: number;
  }[];
  without_trigger: number;
};
export type Progress = {
  timezone: string;
  today: string;
  month: string;
  current: number;
  best: number;
  active_days: number;
  days: string[];
  week: string[];
  rewards: { milestone: number; earned_on: string }[];
};
export type Evolution = { statistics: Statistics; progress: Progress };
