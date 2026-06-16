/**
 * 알림 채널별 ON/OFF 설정 관리
 *
 * [첫 사용 시 "켜시겠어요?" 프롬프트]
 * - 앱 설치 후 해당 채널의 알림이 처음 발송될 때 한 번 물어봄
 * - 사용자가 "켜기"를 누르면 enabled=true, "끄기"를 누르면 false
 * - 이후에는 NotificationSettingsScreen에서 토글로 관리
 *
 * [AsyncStorage 키]
 * @notif_enabled_{channel}   → "true" | "false" | null(미설정)
 * @notif_asked_{channel}     → "true" (프롬프트 이미 표시됨)
 */

import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotifChannel = 'meal_photo' | 'medication' | 'drink' | 'warning';

const PREF_KEY  = (ch: NotifChannel) => `@notif_enabled_${ch}`;
const ASKED_KEY = (ch: NotifChannel) => `@notif_asked_${ch}`;

const CHANNEL_INFO: Record<NotifChannel, { title: string; desc: string; emoji: string }> = {
  meal_photo: {
    emoji: '',
    title: '식사 사진 알림을 켜시겠어요?',
    desc: '설정한 시간에 "식사 사진을 찍어보세요!" 알림을 보내드려요.',
  },
  medication: {
    emoji: '',
    title: '약 복용 알림을 켜시겠어요?',
    desc: '설정한 시간에 약 복용을 잊지 않도록 알려드려요.',
  },
  drink: {
    emoji: '',
    title: '술자리 알림을 켜시겠어요?',
    desc: '회식 전날 절약 알림, 다음날 해장 추천을 보내드려요.\n원치 않으시면 끄셔도 됩니다.',
  },
  warning: {
    emoji: '',
    title: '칼로리 경고 알림을 켜시겠어요?',
    desc: '목표 초과, 저열량 경고, 매일 동기부여 알림을 보내드려요.',
  },
};

// ─── 읽기 ───────────────────────────────────────────────────────────────────

/** null = 아직 묻지 않음, true/false = 사용자 선택 완료 */
export async function getChannelEnabled(ch: NotifChannel): Promise<boolean | null> {
  const val = await AsyncStorage.getItem(PREF_KEY(ch));
  if (val === null) return null;
  return val === 'true';
}

export async function setChannelEnabled(ch: NotifChannel, enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PREF_KEY(ch), enabled ? 'true' : 'false');
  await AsyncStorage.setItem(ASKED_KEY(ch), 'true'); // 선택했으면 "물어봤음"으로도 표시
}

// ─── 첫 사용 시 프롬프트 포함한 "보내도 될까?" 체크 ──────────────────────────

/**
 * 알림 발송 전에 항상 이 함수를 호출.
 * - enabled=true → true (발송 OK)
 * - enabled=false → false (발송 안 함)
 * - null (첫 사용) → Alert으로 물어보고 결과 반환
 */
export function askChannelPermission(ch: NotifChannel): Promise<boolean> {
  return new Promise(async (resolve) => {
    const enabled = await getChannelEnabled(ch);

    if (enabled === true)  { resolve(true);  return; }
    if (enabled === false) { resolve(false); return; }

    // 첫 사용: 물어보기
    const info = CHANNEL_INFO[ch];
    Alert.alert(
      `${info.emoji} ${info.title}`,
      info.desc,
      [
        {
          text: '끄기',
          style: 'cancel',
          onPress: async () => {
            await setChannelEnabled(ch, false);
            resolve(false);
          },
        },
        {
          text: '켜기',
          onPress: async () => {
            await setChannelEnabled(ch, true);
            resolve(true);
          },
        },
      ],
      { cancelable: false },
    );
  });
}

// ─── 설정 화면용: 전체 상태 한번에 읽기 ──────────────────────────────────────

export interface NotifPrefs {
  meal_photo: boolean;
  medication: boolean;
  drink:      boolean;
  warning:    boolean;
}

/** null인 채널은 기본값 true로 처리 (설정 화면에서는 활성화 상태로 표시) */
export async function loadNotifPrefs(): Promise<NotifPrefs> {
  const [mp, med, dr, warn] = await Promise.all([
    getChannelEnabled('meal_photo'),
    getChannelEnabled('medication'),
    getChannelEnabled('drink'),
    getChannelEnabled('warning'),
  ]);
  return {
    meal_photo: mp  !== false,
    medication: med !== false,
    drink:      dr  !== false,
    warning:    warn !== false,
  };
}

export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  await Promise.all([
    setChannelEnabled('meal_photo', prefs.meal_photo),
    setChannelEnabled('medication', prefs.medication),
    setChannelEnabled('drink',      prefs.drink),
    setChannelEnabled('warning',    prefs.warning),
  ]);
}
