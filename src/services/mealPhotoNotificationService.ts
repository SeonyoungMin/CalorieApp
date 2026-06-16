import notifee, {
  TriggerType,
  RepeatFrequency,
  AndroidImportance,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { askChannelPermission } from './notificationPreferencesService';

export interface MealPhotoAlarm {
  id: string;
  name: string;
  hour: number;
  minute: number;
  enabled: boolean;
}

const ALARMS_KEY = '@meal_photo_alarms';
const BATTERY_SHOWN_KEY = '@battery_optim_shown';

const checkedKey = (date: string) => `@meal_photo_checked_${date}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

export const DEFAULT_ALARMS: MealPhotoAlarm[] = [
  { id: 'default_breakfast', name: '아침 식사', hour: 8, minute: 0, enabled: true },
  { id: 'default_lunch', name: '점심 식사', hour: 12, minute: 30, enabled: true },
  { id: 'default_dinner', name: '저녁 식사', hour: 19, minute: 0, enabled: true },
];

export async function loadMealPhotoAlarms(): Promise<MealPhotoAlarm[]> {
  const raw = await AsyncStorage.getItem(ALARMS_KEY);
  if (!raw) return [...DEFAULT_ALARMS];
  try {
    return JSON.parse(raw);
  } catch {
    return [...DEFAULT_ALARMS];
  }
}

export async function saveMealPhotoAlarms(alarms: MealPhotoAlarm[]): Promise<void> {
  await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
}

export async function createMealPhotoChannel(): Promise<void> {
  await notifee.createChannel({
    id: 'meal-photo',
    name: '식사 사진 촬영 알림',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });
}

export async function cancelMealPhotoAlarms(): Promise<void> {
  try {
    const existing = await notifee.getTriggerNotifications();
    for (const n of existing) {
      if ((n.notification.android?.channelId ?? '') === 'meal-photo') {
        await notifee.cancelNotification(n.notification.id!);
      }
    }
  } catch {}
}

export async function scheduleMealPhotoAlarms(alarms: MealPhotoAlarm[]): Promise<void> {
  if (!(await askChannelPermission('meal_photo'))) return;
  // Cancel existing meal-photo notifications
  try {
    const existing = await notifee.getTriggerNotifications();
    for (const n of existing) {
      if ((n.notification.android?.channelId ?? '') === 'meal-photo') {
        await notifee.cancelNotification(n.notification.id!);
      }
    }
  } catch {}

  for (const alarm of alarms) {
    if (!alarm.enabled) continue;

    const now = new Date();
    const trigger = new Date();
    trigger.setHours(alarm.hour, alarm.minute, 0, 0);
    if (trigger.getTime() <= now.getTime()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    await notifee.createTriggerNotification(
      {
        id: alarm.id,
        title: '식사 사진 촬영',
        body: `${alarm.name} 시간이에요! 식사 사진을 찍어보세요 `,
        android: {
          channelId: 'meal-photo',
          pressAction: { id: 'default' },
          smallIcon: 'ic_launcher',
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: trigger.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
      },
    );
  }
}

export async function testMealPhotoAlarm(alarm: MealPhotoAlarm): Promise<void> {
  await notifee.displayNotification({
    title: '식사 사진 촬영 [테스트]',
    body: `${alarm.name} 알림 테스트입니다! `,
    android: {
      channelId: 'meal-photo',
      pressAction: { id: 'default' },
    },
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return (settings.authorizationStatus ?? 0) >= 1;
}

// --- Checked state (daily) ---

export async function loadCheckedAlarms(): Promise<string[]> {
  const today = todayStr();
  const raw = await AsyncStorage.getItem(checkedKey(today));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function toggleCheckedAlarm(alarmId: string): Promise<string[]> {
  const today = todayStr();
  const current = await loadCheckedAlarms();
  const updated = current.includes(alarmId)
    ? current.filter(id => id !== alarmId)
    : [...current, alarmId];
  await AsyncStorage.setItem(checkedKey(today), JSON.stringify(updated));
  return updated;
}

// --- Battery optimization ---

export async function isBatteryOptimShown(): Promise<boolean> {
  const val = await AsyncStorage.getItem(BATTERY_SHOWN_KEY);
  return val === 'true';
}

export async function markBatteryOptimShown(): Promise<void> {
  await AsyncStorage.setItem(BATTERY_SHOWN_KEY, 'true');
}
