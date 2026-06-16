/**
 * 뱃지/포인트 시스템.
 *
 * 포인트 산정 (단순 휴리스틱):
 *   - 식사 1회 기록            +10
 *   - 운동 1회 기록            +15
 *   - AI 스캔 1회              +5
 *   - 포토 다이어리 1회        +5
 *   - 체중 1회 기록            +5
 *   - 친구 1명                 +20
 *   - 연속 기록 일수          ×5 (보너스)
 *   - 걸음 (오늘)             +1 per 1000보
 *   - 목표 칼로리 달성        +30 per 회
 *
 * 영구화: AsyncStorage
 *   @badges_unlocked  — 획득한 뱃지 id 배열
 *   @badges_steps_total — 누적 걸음수 (Health Connect 데이터 일일 합산)
 *   @badges_steps_last_date — 마지막으로 누적한 날짜 (중복 방지)
 *   @badges_goal_achieved — 목표 달성 횟수
 *   @badges_streak — { count, lastDate }
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Badge, BADGES, Snapshot, evaluateBadge } from '../data/badges';

const K_UNLOCKED       = '@badges_unlocked';
const K_STEPS_TOTAL    = '@badges_steps_total';
const K_STEPS_LAST_DT  = '@badges_steps_last_date';
const K_GOAL_ACHIEVED  = '@badges_goal_achieved';
const K_STREAK         = '@badges_streak';
const K_LAST_LOG_DATE  = '@badges_last_log_date';

export type RawInputs = {
  totalMeals: number;
  totalWorkouts: number;
  totalScans: number;
  totalArchives: number;
  totalWeightLogs: number;
  totalFriends: number;
  stepsToday: number;
  waterCupsToday: number;
  /** 오늘 목표 칼로리 달성했는지 (이번 호출에서 처음 달성 시 카운터 증가) */
  goalAchievedToday: boolean;
  todayStr: string; // YYYY-MM-DD (오늘 날짜)
};

export function computePoints(s: Snapshot): number {
  return (
    s.totalMeals       * 10 +
    s.totalWorkouts    * 15 +
    s.totalScans       * 5  +
    s.totalArchives    * 5  +
    s.totalWeightLogs  * 5  +
    s.totalFriends     * 20 +
    s.streakDays       * 5  +
    Math.floor(s.stepsToday / 1000) +
    s.goalAchievedCount * 30
  );
}

async function loadUnlocked(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(K_UNLOCKED);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function saveUnlocked(set: Set<string>) {
  try {
    await AsyncStorage.setItem(K_UNLOCKED, JSON.stringify([...set]));
  } catch {}
}

async function loadInt(key: string): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch { return 0; }
}

async function saveInt(key: string, n: number) {
  try { await AsyncStorage.setItem(key, String(n)); } catch {}
}

/** 일일 걸음수를 누적 카운터에 합산 (같은 날 중복 합산 방지) */
async function accumulateStepsToday(stepsToday: number, todayStr: string): Promise<number> {
  const lastDate = (await AsyncStorage.getItem(K_STEPS_LAST_DT)) || '';
  const prevTotal = await loadInt(K_STEPS_TOTAL);
  if (lastDate === todayStr) {
    // 같은 날 — 이전 prevTotal에 더해진 어제 분량 빼고 다시 더함은 복잡하므로
    // 단순화: 오늘은 기록 안 하고, 다음 날 첫 호출 시 한 번에 추가
    return prevTotal;
  }
  // 다른 날이면 prevTotal에 오늘 걸음수 추가
  const next = prevTotal + (stepsToday || 0);
  await saveInt(K_STEPS_TOTAL, next);
  await AsyncStorage.setItem(K_STEPS_LAST_DT, todayStr);
  return next;
}

/** 연속 기록 streak 갱신: 오늘 식사/운동 기록이 있으면 호출 */
async function bumpStreakIfLoggedToday(loggedToday: boolean, todayStr: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(K_STREAK);
    let streak = { count: 0, lastDate: '' };
    if (raw) streak = JSON.parse(raw);

    if (!loggedToday) return streak.count;
    if (streak.lastDate === todayStr) return streak.count;

    // 어제 날짜 계산
    const yest = new Date(todayStr);
    yest.setDate(yest.getDate() - 1);
    const yyyy = yest.getFullYear();
    const mm = String(yest.getMonth() + 1).padStart(2, '0');
    const dd = String(yest.getDate()).padStart(2, '0');
    const yestStr = `${yyyy}-${mm}-${dd}`;

    if (streak.lastDate === yestStr) {
      streak.count += 1;
    } else {
      streak.count = 1;
    }
    streak.lastDate = todayStr;
    await AsyncStorage.setItem(K_STREAK, JSON.stringify(streak));
    return streak.count;
  } catch {
    return 0;
  }
}

/** 목표 달성 카운터 갱신 (오늘 한 번만) */
async function bumpGoalAchievedToday(achievedToday: boolean, todayStr: string): Promise<number> {
  const lastLog = (await AsyncStorage.getItem(K_LAST_LOG_DATE)) || '';
  const prev = await loadInt(K_GOAL_ACHIEVED);
  if (achievedToday && lastLog !== todayStr) {
    const next = prev + 1;
    await saveInt(K_GOAL_ACHIEVED, next);
    await AsyncStorage.setItem(K_LAST_LOG_DATE, todayStr);
    return next;
  }
  return prev;
}

/** 메인 평가 함수. 호출 시점의 입력으로 Snapshot 생성, 새로 획득한 뱃지를 반환 */
export async function refreshBadges(input: RawInputs): Promise<{
  snapshot: Snapshot;
  points: number;
  newlyUnlocked: Badge[];
  allUnlocked: string[];
}> {
  const stepsTotal = await accumulateStepsToday(input.stepsToday, input.todayStr);
  const loggedToday = input.totalMeals > 0 || input.totalWorkouts > 0;
  const streakDays = await bumpStreakIfLoggedToday(loggedToday, input.todayStr);
  const goalAchievedCount = await bumpGoalAchievedToday(input.goalAchievedToday, input.todayStr);

  // points는 snapshot에 의존하지만 snapshot도 points에 의존(보너스) → 2단계로
  const baseSnap: Snapshot = {
    totalMeals: input.totalMeals,
    totalWorkouts: input.totalWorkouts,
    totalScans: input.totalScans,
    totalArchives: input.totalArchives,
    totalWeightLogs: input.totalWeightLogs,
    totalFriends: input.totalFriends,
    stepsToday: input.stepsToday,
    stepsTotal,
    streakDays,
    totalPoints: 0,
    goalAchievedCount,
    waterCupsToday: input.waterCupsToday,
  };
  const points = computePoints(baseSnap);
  const snapshot: Snapshot = { ...baseSnap, totalPoints: points };

  const unlocked = await loadUnlocked();
  const newly: Badge[] = [];
  for (const b of BADGES) {
    if (unlocked.has(b.id)) continue;
    if (evaluateBadge(b, snapshot)) {
      unlocked.add(b.id);
      newly.push(b);
    }
  }
  if (newly.length > 0) await saveUnlocked(unlocked);

  return { snapshot, points, newlyUnlocked: newly, allUnlocked: [...unlocked] };
}

/** 획득 목록만 빠르게 로드 (UI 초기 렌더용) */
export async function getUnlockedIds(): Promise<string[]> {
  const set = await loadUnlocked();
  return [...set];
}

/** 디버그/이벤트 리셋용 */
export async function resetBadges() {
  await AsyncStorage.multiRemove([
    K_UNLOCKED, K_STEPS_TOTAL, K_STEPS_LAST_DT, K_GOAL_ACHIEVED, K_STREAK, K_LAST_LOG_DATE,
  ]);
}
