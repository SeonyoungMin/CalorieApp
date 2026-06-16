/**
 * 이벤트성 / 임시 기능 토글
 *
 * EVENT_FREE_ACCESS:
 *   2026-06 ~ 2026-07 사전 출시 무료 이벤트.
 *   true → 모든 사용자가 프리미엄으로 취급되고 RevenueCat 호출은 모두 우회.
 *   false → 정상 RevenueCat 결제 흐름으로 복귀 (2026-08 정식 결제 도입 시).
 *
 * 변경 시 영향 범위:
 *   - src/context/SubscriptionContext.tsx (isPremium 강제 true, RevenueCat 호출 우회)
 *   - src/context/AuthContext.tsx (Purchases.logIn/logOut 우회)
 *   - App.tsx (Purchases.configure 우회)
 */
export const EVENT_FREE_ACCESS = true;
