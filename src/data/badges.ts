import { IconName } from '../components/Icon';

export type BadgeCondition =
  | { type: 'first_meal' }
  | { type: 'meals_count'; n: number }
  | { type: 'first_workout' }
  | { type: 'workouts_count'; n: number }
  | { type: 'steps_today'; n: number }
  | { type: 'steps_total'; n: number }
  | { type: 'streak_days'; n: number }
  | { type: 'points_total'; n: number }
  | { type: 'goal_achieved'; n: number }
  | { type: 'first_scan' }
  | { type: 'first_archive' }
  | { type: 'water_cups'; n: number }
  | { type: 'first_weight' }
  | { type: 'first_friend' };

export type Badge = {
  id: string;
  name: string;
  desc: string;
  icon: IconName;
  color: string;
  bg: string;
  condition: BadgeCondition;
};

// 파스텔 컬러 팔레트 (theme.ts와 호환). 여성향 귀여운 톤.
const PINK   = { color: '#E58FB5', bg: '#FFD6E5' };
const LAV    = { color: '#A98ED1', bg: '#E6DAF5' };
const PEACH  = { color: '#E8A87C', bg: '#FFE5D4' };
const MINT   = { color: '#7BC4A4', bg: '#D4F0DD' };
const SKY    = { color: '#8FB8E8', bg: '#D8E8FA' };
const SUN    = { color: '#D4A95B', bg: '#FFEEBC' };

export const BADGES: Badge[] = [
  // ── 첫 시작 시리즈 ───────────────────────────────
  { id: 'first_meal',    name: '첫 한 끼',    desc: '첫 식사 기록',                icon: 'meal',     ...PINK,  condition: { type: 'first_meal' } },
  { id: 'first_workout', name: '첫 운동',     desc: '첫 운동 기록',                icon: 'workout',  ...MINT,  condition: { type: 'first_workout' } },
  { id: 'first_scan',    name: '첫 AI 스캔', desc: 'AI 칼로리 스캔 처음 사용',     icon: 'camera',   ...LAV,   condition: { type: 'first_scan' } },
  { id: 'first_archive', name: '첫 다이어리', desc: '포토 다이어리 첫 사진',        icon: 'image',    ...PEACH, condition: { type: 'first_archive' } },
  { id: 'first_weight',  name: '체중 시작',   desc: '체중 첫 기록',                icon: 'weight',   ...SKY,   condition: { type: 'first_weight' } },
  { id: 'first_friend',  name: '첫 친구',     desc: '친구 첫 추가',                icon: 'users',    ...PINK,  condition: { type: 'first_friend' } },

  // ── 식사 누적 ────────────────────────────────────
  { id: 'meals_10',  name: '꾸준한 식사',   desc: '식사 10번 기록',  icon: 'food',  ...PINK, condition: { type: 'meals_count', n: 10 } },
  { id: 'meals_50',  name: '식사 마스터',   desc: '식사 50번 기록',  icon: 'food',  ...PINK, condition: { type: 'meals_count', n: 50 } },
  { id: 'meals_100', name: '식사 100번',   desc: '식사 100번 기록', icon: 'food',  ...LAV,  condition: { type: 'meals_count', n: 100 } },

  // ── 운동 누적 ────────────────────────────────────
  { id: 'workouts_10',  name: '운동 마니아',  desc: '운동 10번 기록',  icon: 'workout', ...MINT, condition: { type: 'workouts_count', n: 10 } },
  { id: 'workouts_50',  name: '운동 고수',    desc: '운동 50번 기록',  icon: 'workout', ...MINT, condition: { type: 'workouts_count', n: 50 } },

  // ── 걸음 (Health Connect) ─────────────────────────
  { id: 'steps_5k',     name: '산책러',       desc: '하루 5,000보 달성',   icon: 'fire', ...SUN,  condition: { type: 'steps_today', n: 5000 } },
  { id: 'steps_10k',    name: '만보 챔피언',  desc: '하루 10,000보 달성',  icon: 'fire', ...SUN,  condition: { type: 'steps_today', n: 10000 } },
  { id: 'steps_100k',   name: '걸음 누적 10만', desc: '누적 100,000보',     icon: 'fire', ...PEACH, condition: { type: 'steps_total', n: 100000 } },

  // ── 연속 기록 (streak) ───────────────────────────
  { id: 'streak_3',  name: '3일 연속',  desc: '3일 연속 기록',  icon: 'star', ...SUN, condition: { type: 'streak_days', n: 3 } },
  { id: 'streak_7',  name: '일주일 개근', desc: '7일 연속 기록', icon: 'star', ...SUN, condition: { type: 'streak_days', n: 7 } },
  { id: 'streak_30', name: '한 달 개근',  desc: '30일 연속 기록', icon: 'crown', ...SUN, condition: { type: 'streak_days', n: 30 } },

  // ── 포인트 ───────────────────────────────────────
  { id: 'points_1k', name: '포인트 1,000', desc: '누적 1,000 포인트',  icon: 'sparkles', ...LAV,  condition: { type: 'points_total', n: 1000 } },
  { id: 'points_5k', name: '포인트 5,000', desc: '누적 5,000 포인트',  icon: 'sparkles', ...LAV,  condition: { type: 'points_total', n: 5000 } },
  { id: 'points_10k', name: '포인트 1만', desc: '누적 10,000 포인트', icon: 'crown',    ...PINK, condition: { type: 'points_total', n: 10000 } },

  // ── 목표 달성 ────────────────────────────────────
  { id: 'goal_first', name: '첫 목표 달성',     desc: '목표 칼로리 달성 1회',     icon: 'check', ...MINT, condition: { type: 'goal_achieved', n: 1 } },
  { id: 'goal_10',    name: '목표 10회',        desc: '목표 칼로리 달성 10회',    icon: 'check', ...MINT, condition: { type: 'goal_achieved', n: 10 } },

  // ── 기타 ─────────────────────────────────────────
  { id: 'water_8',    name: '물 8잔',           desc: '하루 8잔 (2L) 마시기',     icon: 'water', ...SKY, condition: { type: 'water_cups', n: 8 } },
];

export type Snapshot = {
  totalMeals: number;
  totalWorkouts: number;
  totalScans: number;
  totalArchives: number;
  totalWeightLogs: number;
  totalFriends: number;
  stepsToday: number;
  stepsTotal: number;
  streakDays: number;
  totalPoints: number;
  goalAchievedCount: number;
  waterCupsToday: number;
};

export function evaluateBadge(b: Badge, s: Snapshot): boolean {
  const c = b.condition;
  switch (c.type) {
    case 'first_meal':    return s.totalMeals       > 0;
    case 'first_workout': return s.totalWorkouts    > 0;
    case 'first_scan':    return s.totalScans       > 0;
    case 'first_archive': return s.totalArchives    > 0;
    case 'first_weight':  return s.totalWeightLogs  > 0;
    case 'first_friend':  return s.totalFriends     > 0;
    case 'meals_count':    return s.totalMeals       >= c.n;
    case 'workouts_count': return s.totalWorkouts    >= c.n;
    case 'steps_today':    return s.stepsToday       >= c.n;
    case 'steps_total':    return s.stepsTotal       >= c.n;
    case 'streak_days':    return s.streakDays       >= c.n;
    case 'points_total':   return s.totalPoints      >= c.n;
    case 'goal_achieved':  return s.goalAchievedCount >= c.n;
    case 'water_cups':     return s.waterCupsToday   >= c.n;
  }
}
