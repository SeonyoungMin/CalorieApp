import React, { useEffect } from 'react';
import { StatusBar, Platform, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CheatDayProvider } from './src/context/CheatDayContext';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef, navigateToCheatDay } from './src/navigation/navigationRef';
import {
  isBatteryOptimShown,
  markBatteryOptimShown,
} from './src/services/mealPhotoNotificationService';

function App(): React.JSX.Element {
  useEffect(() => {
    if (Platform.OS === 'android') {
      checkBatteryOptimization();
    }
    setupNotificationHandlers();
  }, []);

  async function checkBatteryOptimization() {
    try {
      const shown = await isBatteryOptimShown();
      if (shown) return;
      const notifeeLib = (await import('@notifee/react-native')).default;
      const isOptimized = await notifeeLib.isBatteryOptimizationEnabled();
      if (isOptimized) {
        await markBatteryOptimShown();
        Alert.alert(
          '배터리 최적화 해제 권장',
          '삼성 등 일부 기기에서 배터리 최적화가 켜져 있으면 알림이 제때 오지 않을 수 있어요.\n\n설정에서 "칼스" 앱의 배터리 최적화를 해제해주세요.',
          [
            { text: '나중에', style: 'cancel' },
            {
              text: '설정 열기',
              onPress: async () => { await notifeeLib.openBatteryOptimizationSettings(); },
            },
          ],
        );
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
        <CheatDayProvider>
          <NavigationContainer ref={navigationRef}>
            <StatusBar barStyle="dark-content" backgroundColor="#F0F4F8" />
            <AppNavigator />
          </NavigationContainer>
        </CheatDayProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
