/**
 * useWarningNotifications
 *
 * 경고 알림 3종을 조건에 맞게 발송하는 훅.
 * - isTodayCheat가 true이면 모든 경고 차단
 * - 각 화면에서 적절한 시점에 호출
 *
 * [사용처]
 * HomeScreen  → checkLowCalorie(totalKcal, goalKcal)  [useFocusEffect]
 *             → scheduleMotivation()                  [useFocusEffect, 1회/일]
 * MealScreen  → checkExceed(totalKcal, goalKcal)      [useEffect on totalKcal]
 */

import { useCallback } from 'react';
import { useCheatDay } from '../context/CheatDayContext';
import {
  createWarningChannel,
  checkAndSendLowCalorieWarning,
  scheduleMotivationNotification,
  checkAndSendExceedWarning,
} from '../services/warningNotificationService';

export function useWarningNotifications() {
  const { status } = useCheatDay();

  const checkLowCalorie = useCallback(
    async (totalKcal: number, goalKcal: number) => {
      if (status.isTodayCheat) return;           // 치팅데이 → 전부 off
      if (goalKcal <= 0) return;
      try {
        await createWarningChannel();
        await checkAndSendLowCalorieWarning(totalKcal, goalKcal);
      } catch {}
    },
    [status.isTodayCheat],
  );

  const scheduleMotivation = useCallback(async () => {
    if (status.isTodayCheat) return;
    try {
      await createWarningChannel();
      await scheduleMotivationNotification();
    } catch {}
  }, [status.isTodayCheat]);

  const checkExceed = useCallback(
    async (totalKcal: number, goalKcal: number) => {
      if (status.isTodayCheat) return;           // 치팅데이 → 전부 off
      if (goalKcal <= 0) return;
      try {
        await createWarningChannel();
        await checkAndSendExceedWarning(totalKcal, goalKcal);
      } catch {}
    },
    [status.isTodayCheat],
  );

  return { checkLowCalorie, scheduleMotivation, checkExceed };
}
