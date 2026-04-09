import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

/** 알림 탭 → CheatDay 화면으로 딥링크 */
export function navigateToCheatDay() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main' as never, {
      screen: 'More',
      params: { screen: 'CheatDay' },
    } as never);
  }
}
