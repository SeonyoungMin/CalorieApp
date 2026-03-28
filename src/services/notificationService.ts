import notifee, {
  AndroidImportance,
  TriggerType,
  RepeatFrequency,
  TimestampTrigger,
  IntervalTrigger,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@notification_settings';

export interface NotificationSettings {
  cycleEnabled: boolean;
  waterEnabled: boolean;
  waterIntervalHours: number; // 1~4
  waterStartHour: number;
  waterEndHour: number;
  mealEnabled: boolean;
  breakfastHour: number;
  breakfastMinute: number;
  lunchHour: number;
  lunchMinute: number;
  dinnerHour: number;
  dinnerMinute: number;
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  cycleEnabled: true,
  waterEnabled: true,
  waterIntervalHours: 2,
  waterStartHour: 8,
  waterEndHour: 22,
  mealEnabled: true,
  breakfastHour: 8,
  breakfastMinute: 0,
  lunchHour: 12,
  lunchMinute: 0,
  dinnerHour: 18,
  dinnerMinute: 30,
};

export async function loadSettings(): Promise<NotificationSettings> {
  try {
    const json = await AsyncStorage.getItem(SETTINGS_KEY);
    if (json) return { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: NotificationSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

async function ensureChannel(): Promise<string> {
  return await notifee.createChannel({
    id: 'calorie_app',
    name: 'CalorieApp 알림',
    importance: AndroidImportance.HIGH,
  });
}

async function cancelByPrefix(prefix: string): Promise<void> {
  const triggers = await notifee.getTriggerNotifications();
  for (const t of triggers) {
    if (t.notification.id?.startsWith(prefix)) {
      await notifee.cancelNotification(t.notification.id);
    }
  }
}

export async function scheduleCycleNotification(nextPeriodDateStr: string): Promise<void> {
  await cancelByPrefix('cycle_');
  const channelId = await ensureChannel();
  const nextDate = new Date(nextPeriodDateStr);

  for (const daysBefore of [2, 1]) {
    const triggerDate = new Date(nextDate);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);
    triggerDate.setHours(9, 0, 0, 0);

    if (triggerDate.getTime() <= Date.now()) continue;

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: triggerDate.getTime(),
    };

    await notifee.createTriggerNotification(
      {
        id: `cycle_${daysBefore}`,
        title: '생리 예정 알림',
        body: `${daysBefore}일 후 생리 예정일이에요. 미리 준비하세요!`,
        android: { channelId, pressAction: { id: 'default' } },
      },
      trigger,
    );
  }
}

export async function scheduleWaterNotifications(settings: NotificationSettings): Promise<void> {
  await cancelByPrefix('water_');
  if (!settings.waterEnabled) return;
  const channelId = await ensureChannel();

  const intervalMs = settings.waterIntervalHours * 60 * 60 * 1000;
  const startHour = settings.waterStartHour;
  const endHour = settings.waterEndHour;

  let slot = 0;
  for (let hour = startHour; hour < endHour; hour += settings.waterIntervalHours) {
    const trigger: IntervalTrigger = {
      type: TriggerType.INTERVAL,
      interval: intervalMs,
      repeatFrequency: RepeatFrequency.HOURLY,
    };

    // Use timestamp-based daily repeat for exact hour scheduling
    const now = new Date();
    const fireTime = new Date();
    fireTime.setHours(hour, 0, 0, 0);
    if (fireTime.getTime() <= now.getTime()) {
      fireTime.setDate(fireTime.getDate() + 1);
    }

    const tstrigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: fireTime.getTime(),
      repeatFrequency: RepeatFrequency.DAILY,
    };

    await notifee.createTriggerNotification(
      {
        id: `water_${slot++}`,
        title: '물 마실 시간!',
        body: '충분한 수분 섭취는 건강의 기본이에요. 물 한 잔 마셔볼까요?',
        android: { channelId, pressAction: { id: 'default' } },
      },
      tstrigger,
    );
  }
}

export async function scheduleMealNotifications(settings: NotificationSettings): Promise<void> {
  await cancelByPrefix('meal_');
  if (!settings.mealEnabled) return;
  const channelId = await ensureChannel();

  const meals: Array<{ id: string; title: string; hour: number; minute: number }> = [
    { id: 'meal_breakfast', title: '아침 식사 시간', hour: settings.breakfastHour, minute: settings.breakfastMinute },
    { id: 'meal_lunch', title: '점심 식사 시간', hour: settings.lunchHour, minute: settings.lunchMinute },
    { id: 'meal_dinner', title: '저녁 식사 시간', hour: settings.dinnerHour, minute: settings.dinnerMinute },
  ];

  for (const meal of meals) {
    const now = new Date();
    const fireTime = new Date();
    fireTime.setHours(meal.hour, meal.minute, 0, 0);
    if (fireTime.getTime() <= now.getTime()) {
      fireTime.setDate(fireTime.getDate() + 1);
    }

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: fireTime.getTime(),
      repeatFrequency: RepeatFrequency.DAILY,
    };

    await notifee.createTriggerNotification(
      {
        id: meal.id,
        title: meal.title,
        body: '균형 잡힌 식사로 하루 영양을 채워보세요!',
        android: { channelId, pressAction: { id: 'default' } },
      },
      trigger,
    );
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1;
}
