/**
 * 스마트 경고 & 위트 알림 서비스
 *
 * 채널: "warning" (meal-photo / medication / drink 과 완전 별도)
 *
 * [경고 3종]
 * 1. 초저열량 경고  — 14:00 이후, 목표 50% 미만 섭취 시
 * 2. 목표 동기부여  — 매일 15:00 예약 (D-day 포함)
 * 3. 초과 섭취 경고 — 목표 초과 즉시, 코인 화면 딥링크 포함
 *
 * [중복 방지 AsyncStorage 키]
 * @warning_low_calorie_YYYY-MM-DD   → "true"
 * @warning_motivation_YYYY-MM-DD   → "true"  (스케줄 완료 표시)
 * @warning_exceed_YYYY-MM-DD       → "true"
 * @weight_prediction_days          → 예상 달성 일수 (WeightGoalCard가 저장)
 */

import notifee, {
  TriggerType,
  AndroidImportance,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { askChannelPermission } from './notificationPreferencesService';

const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── Channel ────────────────────────────────────────────────────────────────

export async function createWarningChannel(): Promise<void> {
  await notifee.createChannel({
    id: 'warning',
    name: '칼로리 경고 알림',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });
}

// ─── 중복 방지 ───────────────────────────────────────────────────────────────

type WarningType = 'low_calorie' | 'motivation' | 'exceed';

async function isWarningSentToday(type: WarningType): Promise<boolean> {
  const val = await AsyncStorage.getItem(`@warning_${type}_${todayStr()}`);
  return val === 'true';
}

async function markWarningSent(type: WarningType): Promise<void> {
  await AsyncStorage.setItem(`@warning_${type}_${todayStr()}`, 'true');
}

// ─── 1. 초저열량 경고 ────────────────────────────────────────────────────────

export async function sendLowCalorieWarning(): Promise<void> {
  await notifee.displayNotification({
    id: `low_calorie_${todayStr()}`,
    title: '초저열량 경고',
    body: '현재 식단은 초저열량입니다. 근손실 방지를 위해 단백질 섭취를 늘려보세요 ',
    android: {
      channelId: 'warning',
      pressAction: { id: 'default' },
      smallIcon: 'ic_launcher',
    },
  });
  await markWarningSent('low_calorie');
}

/**
 * 호출 위치: HomeScreen useFocusEffect (14:00 이후 + 오늘 날짜)
 * isTodayCheat가 true면 전달하지 말 것 (호출 전 체크)
 */
export async function checkAndSendLowCalorieWarning(
  totalKcal: number,
  goalKcal: number,
): Promise<void> {
  const hour = new Date().getHours();
  if (hour < 14) return;
  if (totalKcal >= goalKcal * 0.5) return;
  if (await isWarningSentToday('low_calorie')) return;
  if (!(await askChannelPermission('warning'))) return;
  await sendLowCalorieWarning();
}

// ─── 2. 목표 동기부여 알림 (오늘 15:00 예약) ─────────────────────────────────

export async function scheduleMotivationNotification(): Promise<void> {
  if (await isWarningSentToday('motivation')) return;
  if (!(await askChannelPermission('warning'))) return;

  // 캐시된 예상 달성 일수 읽기 (WeightGoalCard에서 저장)
  const cached = await AsyncStorage.getItem('@weight_prediction_days');
  const daysLeft = cached ? parseInt(cached, 10) : null;

  const body =
    daysLeft && !isNaN(daysLeft) && daysLeft > 0
      ? `목표일까지 D-${daysLeft}! 오늘 라면 국물을 남기면 2일 단축됩니다! `
      : '오늘도 목표를 향해 한 걸음! 라면 국물만 남겨도 목표가 당겨져요 ';

  // 오늘 15:00 타임스탬프 계산
  const trigger15 = new Date();
  trigger15.setHours(15, 0, 0, 0);

  // 이미 15시가 지났으면 스킵 (내일 스케줄링은 다음날 앱 진입 시)
  if (trigger15.getTime() <= Date.now()) {
    await markWarningSent('motivation');
    return;
  }

  await notifee.createTriggerNotification(
    {
      id: `motivation_${todayStr()}`,
      title: '오늘의 목표 동기부여',
      body,
      android: {
        channelId: 'warning',
        pressAction: { id: 'default' },
        smallIcon: 'ic_launcher',
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: trigger15.getTime(),
    },
  );
  await markWarningSent('motivation');
}

// ─── 3. 초과 섭취 경고 (즉시, 코인 딥링크 포함) ──────────────────────────────

export async function checkAndSendExceedWarning(
  totalKcal: number,
  goalKcal: number,
): Promise<void> {
  if (totalKcal <= goalKcal) return;
  if (await isWarningSentToday('exceed')) return;
  if (!(await askChannelPermission('warning'))) return;

  await notifee.displayNotification({
    id: `exceed_${todayStr()}`,
    title: '목표 칼로리 초과!',
    body: `오늘 목표 칼로리를 넘겼어요 내일 다시 시작해요! 치팅데이 코인 쓸까요?`,
    data: { action: 'open_cheat_day' },
    android: {
      channelId: 'warning',
      pressAction: { id: 'default' },
      smallIcon: 'ic_launcher',
      actions: [
        {
          title: '코인 사용하기',
          pressAction: { id: 'open_cheat_day' },
        },
      ],
    },
  });
  await markWarningSent('exceed');
}

// ─── 예상 달성일 캐시 저장 (WeightGoalCard에서 호출) ────────────────────────

export async function cachePredictionDays(days: number | null): Promise<void> {
  if (days !== null && !isNaN(days)) {
    await AsyncStorage.setItem('@weight_prediction_days', String(days));
  }
}
