import { useState, useCallback } from 'react';
import { getWeightGoal, updateUserWeight, getCalorieAverage, getWeightGoalHistory } from '../api/api';

export interface WeightGoalData {
  currentWeight: number | null;
  goalWeight: number | null;
  goalKcal: number;
  weightUpdatedAt: string | null;
}

export interface CalorieAverageData {
  days: number;
  goalKcal: number;
  averageEaten: number;
  averageDeficit: number; // 양수 = 칼로리 적자(감량중), 음수 = 과섭취
}

export interface WeightHistoryItem {
  weightId: number;
  weightKg: number;
  logDate: string;
}

export interface GoalPrediction {
  estimatedDays: number | null;     // 예상 달성 일수
  estimatedDate: string | null;     // 예상 달성일 (yyyy-mm-dd)
  daysLeft: number | null;          // D-day
  needsMoreData: boolean;           // 데이터 3일 미만
  tooLong: boolean;                 // 365일 초과
  progressPct: number;              // 달성률 %
}

/** 예상 달성일 계산 */
function calcPrediction(
  goal: WeightGoalData,
  avg: CalorieAverageData
): GoalPrediction {
  const { currentWeight, goalWeight } = goal;
  const { averageDeficit, days } = avg;

  const needsMoreData = days < 3;

  if (!currentWeight || !goalWeight) {
    return { estimatedDays: null, estimatedDate: null, daysLeft: null, needsMoreData, tooLong: false, progressPct: 0 };
  }

  const diff = currentWeight - goalWeight; // 감량해야 할 kg (양수 = 감량, 음수 = 증량)

  // 진행률: 목표까지 얼마나 왔는지 (체중 히스토리 없이 근사값)
  const progressPct = diff <= 0 ? 100 : 0; // 이미 달성했으면 100%

  if (diff <= 0) {
    // 이미 목표 달성
    return { estimatedDays: 0, estimatedDate: null, daysLeft: 0, needsMoreData: false, tooLong: false, progressPct: 100 };
  }

  if (needsMoreData || averageDeficit <= 0) {
    return { estimatedDays: null, estimatedDate: null, daysLeft: null, needsMoreData, tooLong: false, progressPct };
  }

  // 1kg = 7700 kcal
  const estimatedDays = Math.ceil((diff * 7700) / averageDeficit);
  const tooLong = estimatedDays > 365;

  const target = new Date();
  target.setDate(target.getDate() + estimatedDays);
  const estimatedDate = target.toISOString().split('T')[0];
  const daysLeft = estimatedDays;

  return { estimatedDays, estimatedDate, daysLeft, needsMoreData, tooLong, progressPct };
}

export function useWeightGoal() {
  const [goalData, setGoalData] = useState<WeightGoalData>({
    currentWeight: null,
    goalWeight: null,
    goalKcal: 2000,
    weightUpdatedAt: null,
  });
  const [avgData, setAvgData] = useState<CalorieAverageData>({
    days: 0, goalKcal: 2000, averageEaten: 0, averageDeficit: 0,
  });
  const [history, setHistory] = useState<WeightHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [goalRes, avgRes, histRes] = await Promise.allSettled([
        getWeightGoal(),
        getCalorieAverage(),
        getWeightGoalHistory(),
      ]);

      if (goalRes.status === 'fulfilled' && goalRes.value.data) {
        const d = goalRes.value.data;
        setGoalData({
          currentWeight: d.current_weight ? parseFloat(d.current_weight) : null,
          goalWeight:    d.goal_weight    ? parseFloat(d.goal_weight)    : null,
          goalKcal:      d.goal_kcal      || 2000,
          weightUpdatedAt: d.weight_updated_at || null,
        });
      }
      if (avgRes.status === 'fulfilled' && avgRes.value.data) {
        setAvgData(avgRes.value.data);
      }
      if (histRes.status === 'fulfilled') {
        setHistory(histRes.value.data || []);
      }
    } catch {
      // 실패 시 기본값 유지
    } finally {
      setLoading(false);
    }
  }, []);

  const saveWeightGoal = useCallback(async (currentWeight: number, goalWeight: number) => {
    await updateUserWeight({ currentWeight, goalWeight });
    setGoalData(prev => ({ ...prev, currentWeight, goalWeight }));
  }, []);

  const prediction = calcPrediction(goalData, avgData);

  return { goalData, avgData, history, loading, fetch, saveWeightGoal, prediction };
}
