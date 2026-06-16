/**
 * Health Connect 연동 — v18에선 비활성 (스텁).
 *
 * react-native-health-connect 라이브러리가 RN New Architecture 전제로 만들어진 최신 버전이라
 * 우리 Old Architecture 프로젝트와 native 통합이 안 됨 (cmake configureCMakeDebug FAIL).
 * 9번째 빌드 시도 후 패키지 제거 결정. v19에서 New Arch 전환 또는 옛 v2.x 시도.
 *
 * 호출부 (HomeScreen)는 그대로 두고 stub만 항상 EMPTY 반환 → 걸음수=0 → 걸음 뱃지 3개만 미트리거.
 * 나머지 19개 뱃지(식사/운동/streak/포인트/목표/물)는 정상 동작.
 */

export type FitnessSnapshot = {
  steps: number;
  activeKcal: number;
  totalKcal: number;
  exerciseMinutes: number;
  distanceMeters: number;
  source: 'health-connect' | 'unavailable';
};

const EMPTY: FitnessSnapshot = {
  steps: 0,
  activeKcal: 0,
  totalKcal: 0,
  exerciseMinutes: 0,
  distanceMeters: 0,
  source: 'unavailable',
};

export async function isFitnessAvailable(): Promise<boolean> {
  return false;
}

export async function requestFitnessPermissions(): Promise<boolean> {
  return false;
}

export async function hasFitnessPermissions(): Promise<boolean> {
  return false;
}

export async function getTodayFitness(): Promise<FitnessSnapshot> {
  return EMPTY;
}

export async function openHealthConnectInstall(): Promise<void> {
  // no-op
}
