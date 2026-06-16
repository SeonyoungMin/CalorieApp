import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, Platform, Alert, AppState, Linking } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/context/AuthContext';
import { CheatDayProvider } from './src/context/CheatDayContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import AppNavigator from './src/navigation/AppNavigator';
import EventModal from './src/components/EventModal';
import PermissionModal from './src/components/PermissionModal';
import OfflineModal from './src/components/OfflineModal';
import {
  navigationRef,
  navigateToCheatDay,
  setPendingFriendUserId,
  navigateToFriendRequest,
} from './src/navigation/navigationRef';
import {
  isBatteryOptimShown,
  markBatteryOptimShown,
} from './src/services/mealPhotoNotificationService';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { COLORS } from './src/theme';
import { EVENT_FREE_ACCESS } from './src/config/eventFlags';

const REVENUECAT_ANDROID_KEY = 'goog_fvpmFxidWFfYpdKcTFTdsgmzTMC';

// 무료 이벤트 기간(EVENT_FREE_ACCESS=true)에는 RevenueCat 초기화도 건너뜀.
// 7-8월 정식 결제 도입 시 eventFlags.ts에서 EVENT_FREE_ACCESS=false로 변경하면 복원됨.
if (!EVENT_FREE_ACCESS && Platform.OS === 'android') {
  Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey: REVENUECAT_ANDROID_KEY });
}

const linking: LinkingOptions<any> = {
  prefixes: ['cals://', 'kals://'],
  config: {
    screens: {
      FriendRequest: {
        path: 'add-friend',
        parse: { userId: (id: string) => parseInt(id, 10) },
      },
    },
  },
};

const EVENT_MODAL_KEY = '@event_free_access_modal_shown_v1';

function App(): React.JSX.Element {
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [batteryModalVisible, setBatteryModalVisible] = useState(false);
  const batteryOpenRef = useRef<null | (() => Promise<void>)>(null);

  useEffect(() => {
    if (!EVENT_FREE_ACCESS) return;
    AsyncStorage.getItem(EVENT_MODAL_KEY).then(v => {
      if (!v) setEventModalVisible(true);
    }).catch(() => {});
  }, []);

  const dismissEventModal = () => {
    setEventModalVisible(false);
    AsyncStorage.setItem(EVENT_MODAL_KEY, '1').catch(() => {});
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      checkBatteryOptimization();
    }
    setupNotificationHandlers();
    const cleanupDeepLink = setupDeepLinkHandler();

    // 앱 포그라운드 진입 시 배지 초기화
    const clearBadge = async () => {
      try {
        const notifeeLib = (await import('@notifee/react-native')).default;
        await notifeeLib.setBadgeCount(0);
      } catch {}
    };
    clearBadge();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') clearBadge();
    });
    return () => {
      sub.remove();
      cleanupDeepLink?.();
    };
  }, []);

  function handleDeepLinkUrl(url: string | null) {
    if (!url) return;
    // cals://add-friend?userId=123
    const match = url.match(/add-friend\?userId=(\d+)/);
    if (!match) return;
    const userId = parseInt(match[1], 10);
    if (navigationRef.isReady()) {
      // 네비게이터 준비됐으면 바로 이동 (로그인 상태면 화면 있음)
      navigateToFriendRequest(userId);
    } else {
      // 아직 준비 안 됐거나 비로그인 → 펜딩 저장
      setPendingFriendUserId(userId);
    }
  }

  function setupDeepLinkHandler(): () => void {
    // 앱이 종료 상태에서 딥링크로 열린 경우
    Linking.getInitialURL().then(url => handleDeepLinkUrl(url)).catch(() => {});
    // 앱이 백그라운드에서 딥링크로 포그라운드 전환된 경우
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLinkUrl(url));
    return () => sub.remove();
  }

  async function checkBatteryOptimization() {
    try {
      const shown = await isBatteryOptimShown();
      if (shown) return;
      const notifeeLib = (await import('@notifee/react-native')).default;
      const isOptimized = await notifeeLib.isBatteryOptimizationEnabled();
      if (isOptimized) {
        await markBatteryOptimShown();
        batteryOpenRef.current = async () => {
          try { await notifeeLib.openBatteryOptimizationSettings(); } catch {}
        };
        setBatteryModalVisible(true);
      }
    } catch {}
  }

  async function setupNotificationHandlers() {
    try {
      const { default: notifeeLib, EventType } = await import('@notifee/react-native');

      // 앱이 종료된 상태에서 알림 탭으로 실행된 경우
      const initial = await notifeeLib.getInitialNotification();
      if (initial?.notification?.data?.action === 'open_cheat_day') {
        // NavigationContainer가 준비될 때까지 약간 지연
        setTimeout(() => navigateToCheatDay(), 500);
      }

      // 앱이 포그라운드 상태에서 알림 탭한 경우
      notifeeLib.onForegroundEvent(({ type, detail }) => {
        const isPress = type === EventType.PRESS || type === EventType.ACTION_PRESS;
        if (!isPress) return;
        const action = detail.notification?.data?.action
          ?? detail.pressAction?.id;
        if (action === 'open_cheat_day') {
          navigateToCheatDay();
        }
      });
    } catch {}
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <CheatDayProvider>
            <NavigationContainer ref={navigationRef} linking={linking}>
              <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
              <AppNavigator />
              <EventModal visible={eventModalVisible} onConfirm={dismissEventModal} />
              <PermissionModal
                visible={batteryModalVisible}
                variant="warning"
                icon="bell"
                title="배터리 최적화 해제 권장"
                desc={'삼성 등 일부 기기에서 배터리 최적화가 켜져 있으면\n알림이 제때 오지 않을 수 있어요.\n설정에서 "칼스" 앱의 최적화를 해제해주세요.'}
                primaryLabel="설정 열기"
                secondaryLabel="나중에"
                onPrimary={async () => { await batteryOpenRef.current?.(); setBatteryModalVisible(false); }}
                onSecondary={() => setBatteryModalVisible(false)}
              />
              <OfflineModal />
            </NavigationContainer>
          </CheatDayProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
