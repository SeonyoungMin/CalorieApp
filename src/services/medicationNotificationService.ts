/**
 * 약 복용 알림 서비스
 *
 * 채널: "medication" (식사 알림 "meal-photo"와 별도)
 *
 * [알림 소리 다르게 설정하는 방법]
 * 1. android/app/src/main/res/raw/ 폴더에 소리 파일 추가
 *    예: android/app/src/main/res/raw/medication_sound.mp3
 * 2. createMedicationChannel() 의 sound 필드에 파일명(확장자 제외) 지정
 *    sound: 'medication_sound'
 * 3. 주의: 채널은 앱 설치 후 최초 1회만 생성됨.
 *    소리를 바꾸려면 앱을 재설치하거나 channelId를 변경해야 함.
 *
 * [AsyncStorage 키 구조 (전체 앱 통일)]
 * @meal_photo_alarms            → 식사 사진 알림 목록
 * @meal_photo_checked_YYYY-MM-DD → 식사 알림 일별 체크
 * @battery_optim_shown          → 배터리 최적화 팝업 노출 여부
 * @medication_alarms            → 약 알림 목록  ← 이 파일
 * @medication_checked_YYYY-MM-DD → 약 알림 일별 체크  ← 이 파일
 */

import notifee, {
  TriggerType,
  RepeatFrequency,
  AndroidImportance,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { askChannelPermission } from './notificationPreferencesService';

export interface MedicationAlarm {
  id: string;
  name: string;   // 약 이름 (예: "혈압약", "유산균", "비타민D")
  hour: number;
  minute: number;
  enabled: boolean;
}

const ALARMS_KEY = '@medication_alarms';
const checkedKey = (date: string) => `@medication_checked_${date}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── Channel ────────────────────────────────────────────────────────────────

export async function createMedicationChannel(): Promise<void> {
  await notifee.createChannel({
    id: 'medication',
    name: '약 복용 알림',
    importance: AndroidImportance.HIGH,
    vibration: true,
    // sound: 'medication_sound', // res/raw/medication_sound.mp3 추가 시 활성화
  });
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function loadMedicationAlarms(): Promise<MedicationAlarm[]> {
  const raw = await AsyncStorage.getItem(ALARMS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveMedicationAlarms(alarms: MedicationAlarm[]): Promise<void> {
  await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

export async function scheduleMedicationAlarms(alarms: MedicationAlarm[]): Promise<void> {
  if (!(await askChannelPermission('medication'))) return;
  // 기존 medication 채널 알림 전부 취소
  try {
    const existing = await notifee.getTriggerNotifications();
    for (const n of existing) {
      if ((n.notification.android?.channelId ?? '') === 'medication') {
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
        title: '약 복용 시간',
        body: `${alarm.name} 드실 시간이에요!`,
        android: {
          channelId: 'medication',
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

export async function testMedicationAlarm(alarm: MedicationAlarm): Promise<void> {
  await notifee.displayNotification({
    title: '약 복용 시간 [테스트]',
    body: `${alarm.name} 드실 시간이에요!`,
    android: {
      channelId: 'medication',
      pressAction: { id: 'default' },
    },
  });
}

// ─── Checked state (daily, midnight auto-reset) ──────────────────────────────

export async function loadMedicationChecked(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(checkedKey(todayStr()));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function toggleMedicationChecked(alarmId: string): Promise<string[]> {
  const today = todayStr();
  const current = await loadMedicationChecked();
  const updated = current.includes(alarmId)
    ? current.filter(id => id !== alarmId)
    : [...current, alarmId];
  await AsyncStorage.setItem(checkedKey(today), JSON.stringify(updated));
  return updated;
}
