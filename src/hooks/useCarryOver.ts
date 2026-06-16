import { useState, useCallback } from 'react';
import { getTodayCarryOver, saveCarryOver, saveMealGoals } from '../api/api';
import { localDateStr } from '../utils/dateUtils';

export interface CarryOverData {
  breakfastGoal: number;
  lunchGoal: number;
  dinnerGoal: number;
  breakfastCarry: number;
  lunchCarry: number;
  carryDate: string;
}

const DEFAULT_DATA: CarryOverData = {
  breakfastGoal: 600,
  lunchGoal: 700,
  dinnerGoal: 700,
  breakfastCarry: 0,
  lunchCarry: 0,
  carryDate: '',
};

export function useCarryOver() {
  const [data, setData] = useState<CarryOverData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTodayCarryOver();
      setData({ ...DEFAULT_DATA, ...res.data });
    } catch {
      // 실패 시 기본값 유지
    } finally {
      setLoading(false);
    }
  }, []);

  // 아침 식사 후 남은 칼로리 → 점심으로 이월
  const computeAndSaveBreakfastCarry = useCallback(
    async (breakfastEaten: number, currentLunchCarry: number) => {
      const effective = data.breakfastGoal + data.breakfastCarry;
      const surplus = Math.max(0, effective - breakfastEaten);
      const today = localDateStr();
      try {
        await saveCarryOver({ carryDate: today, breakfastCarry: surplus, lunchCarry: currentLunchCarry });
        setData(prev => ({ ...prev, breakfastCarry: surplus }));
      } catch {}
    },
    [data.breakfastGoal, data.breakfastCarry]
  );

  // 점심 식사 후 남은 칼로리 → 저녁으로 이월
  const computeAndSaveLunchCarry = useCallback(
    async (lunchEaten: number, currentBreakfastCarry: number) => {
      const effective = data.lunchGoal + data.breakfastCarry;
      const surplus = Math.max(0, effective - lunchEaten);
      const today = localDateStr();
      try {
        await saveCarryOver({ carryDate: today, breakfastCarry: currentBreakfastCarry, lunchCarry: surplus });
        setData(prev => ({ ...prev, lunchCarry: surplus }));
      } catch {}
    },
    [data.lunchGoal, data.breakfastCarry]
  );

  const updateMealGoals = useCallback(
    async (breakfastGoal: number, lunchGoal: number, dinnerGoal: number) => {
      await saveMealGoals({ breakfastGoal, lunchGoal, dinnerGoal });
      setData(prev => ({ ...prev, breakfastGoal, lunchGoal, dinnerGoal }));
    },
    []
  );

  // 끼니별 유효 목표 (기본 목표 + 이월)
  const effectiveBreakfastGoal = data.breakfastGoal + data.breakfastCarry;
  const effectiveLunchGoal     = data.lunchGoal + data.breakfastCarry;
  const effectiveDinnerGoal    = data.dinnerGoal + data.lunchCarry;

  return {
    carryData: data,
    loading,
    fetch,
    effectiveBreakfastGoal,
    effectiveLunchGoal,
    effectiveDinnerGoal,
    computeAndSaveBreakfastCarry,
    computeAndSaveLunchCarry,
    updateMealGoals,
  };
}
