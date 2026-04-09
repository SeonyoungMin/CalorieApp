/**
 * 술자리 모드 알림 서비스
 *
 * 채널: "drink" (meal-photo / medication 과 별도)
 *
 * [알림 3종]
 * 1. 전날 밤 21:00 - 회식 예정 경고 (예정일 저장 시 스케줄)
 * 2. 즉시 - 잔 수 누를 때마다 실시간 경고 (immediate display)
 * 3. 다음날 아침 08:00 - 해장 메뉴 추천 (예정일 저장 시 스케줄)
 *
 * [AsyncStorage 키]
 * @drink_reminder_{YYYY-MM-DD}  → notifee id: 전날 밤 알림 ("drink_eve_YYYY-MM-DD")
 * @drink_morning_{YYYY-MM-DD}   → notifee id: 다음날 아침 알림 ("drink_morning_YYYY-MM-DD")
 */

import notifee, {
  TriggerType,
  AndroidImportance,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { askChannelPermission } from './notificationPreferencesService';

export const DRINK_TYPES = [
  { id: 'soju',    name: '소주',       unit: '1잔',   kcal: 65 },
  { id: 'beer',    name: '맥주',       unit: '500cc', kcal: 210 },
  { id: 'makgeo',  name: '막걸리',     unit: '1잔',   kcal: 150 },
  { id: 'wine',    name: '와인',       unit: '1잔',   kcal: 120 },
  { id: 'whiskey', name: '양주',       unit: '1잔',   kcal: 100 },
  { id: 'soda',    name: '사이다/콜라', unit: '1잔',   kcal: 90  },
] as const;

export const COMPARE_ITEMS = [
  { name: '밥 한 공기', kcal: 300 },
  { name: '아메리카노', kcal: 10 },
  { name: '삼겹살 1인분', kcal: 600 },
] as const;

export const HANGOVER_MENUS = [
  { name: '콩나물국밥', kcal: 350 },
  { name: '북엇국', kcal: 200 },
  { name: '토스트', kcal: 300 },
] as const;

// ─── Channel ────────────────────────────────────────────────────────────────

export async function createDrinkChannel(): Promise<void> {
  await notifee.createChannel({
    id: 'drink',
    name: '술자리 알림',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });
}

// ─── 1. 전날 밤 21:00 알림 (스케줄) ────────────────────────────────────────

export async function scheduleEveNotification(drinkDate: string): Promise<void> {
  if (!(await askChannelPermission('drink'))) return;
  // drinkDate: "2026-04-15" → 전날 = "2026-04-14 21:00"
  const parts = drinkDate.split('-').map(Number);
  const eve = new Date(parts[0], parts[1] - 1, parts[2], 21, 0, 0, 0);
  eve.setDate(eve.getDate() - 1); // 하루 전

  if (eve.getTime() <= Date.now()) return; // 이미 지난 시간이면 스킵

  const id = `drink_eve_${drinkDate}`;
  await notifee.cancelNotification(id); // 중복 방지
  await notifee.createTriggerNotification(
    {
      id,
      title: '🍺 내일 회식 있죠?',
      body: '내일 회식이죠? 오늘 200kcal 미리 아껴드릴게요 🍺',
      android: { channelId: 'drink', pressAction: { id: 'default' }, smallIcon: 'ic_launcher' },
    },
    { type: TriggerType.TIMESTAMP, timestamp: eve.getTime() },
  );
  await AsyncStorage.setItem(`@drink_reminder_${drinkDate}`, id);
}

// ─── 3. 다음날 아침 08:00 알림 (스케줄) ────────────────────────────────────

export async function scheduleMorningNotification(drinkDate: string): Promise<void> {
  if (!(await askChannelPermission('drink'))) return;
  // drinkDate: "2026-04-15" → 다음날 아침 = "2026-04-16 08:00"
  const parts = drinkDate.split('-').map(Number);
  const morning = new Date(parts[0], parts[1] - 1, parts[2], 8, 0, 0, 0);
  morning.setDate(morning.getDate() + 1); // 하루 후

  if (morning.getTime() <= Date.now()) return;

  const menuList = HANGOVER_MENUS.map(m => `${m.name}(${m.kcal}kcal)`).join(' · ');
  const id = `drink_morning_${drinkDate}`;
  await notifee.cancelNotification(id);
  await notifee.createTriggerNotification(
    {
      id,
      title: '🌅 어젯밤 수고했어요!',
      body: `추천 해장 저칼로리 메뉴 👇 ${menuList}`,
      android: { channelId: 'drink', pressAction: { id: 'default' }, smallIcon: 'ic_launcher' },
    },
    { type: TriggerType.TIMESTAMP, timestamp: morning.getTime() },
  );
  await AsyncStorage.setItem(`@drink_morning_${drinkDate}`, id);
}

// ─── 2. 잔 수 누를 때 즉시 알림 ────────────────────────────────────────────

export async function notifyDrinkCount(
  drinkName: string,
  count: number,
  totalKcal: number,
): Promise<void> {
  const pork = COMPARE_ITEMS[2]; // 삼겹살 1인분 600kcal
  const exceeded = totalKcal >= pork.kcal;
  const ratio = (totalKcal / pork.kcal).toFixed(1);

  const body = exceeded
    ? `지금 ${drinkName} ${count}잔째. 삼겹살 ${ratio}인분 칼로리예요 🐷`
    : `지금 ${drinkName} ${count}잔째. 총 ${totalKcal}kcal 섭취 중이에요 🍺`;

  await notifee.displayNotification({
    title: '🍺 술자리 칼로리 체크',
    body,
    android: { channelId: 'drink', pressAction: { id: 'default' } },
  });
}

// ─── 예약된 drink 알림 전체 취소 ────────────────────────────────────────────

export async function cancelDrinkNotificationsForDate(drinkDate: string): Promise<void> {
  await notifee.cancelNotification(`drink_eve_${drinkDate}`);
  await notifee.cancelNotification(`drink_morning_${drinkDate}`);
  await AsyncStorage.removeItem(`@drink_reminder_${drinkDate}`);
  await AsyncStorage.removeItem(`@drink_morning_${drinkDate}`);
}
