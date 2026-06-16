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

// 로그인 전 딥링크로 들어온 친구 추가 userId 임시 저장
let _pendingFriendUserId: number | null = null;

export function setPendingFriendUserId(id: number) {
  _pendingFriendUserId = id;
}

export function consumePendingFriendUserId(): number | null {
  const id = _pendingFriendUserId;
  _pendingFriendUserId = null;
  return id;
}

/** 로그인 후 → FriendRequest 화면으로 */
export function navigateToFriendRequest(userId: number) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('FriendRequest' as never, { userId } as never);
  }
}
