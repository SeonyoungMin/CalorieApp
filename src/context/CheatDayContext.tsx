/**
 * CheatDayContext
 *
 * 치팅데이 활성화 상태를 전역으로 관리.
 * - isTodayCheat: 오늘 코인 사용 여부 → 경고 알림 비활성화 등에 활용
 * - 로그인 후 앱 시작 시 status API 호출 + 스트릭 체크
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkStreak, getCheatStatus, useCoin } from '../api/api';
import { useAuth } from './AuthContext';

const MAX_COINS = 5;
const STREAK_CHECK_KEY = '@cheat_streak_checked_date';

export interface CheatStatus {
  cheatCoins: number;
  streakCount: number;
  lastStreakDate: string | null;
  isTodayCheat: boolean;
  coinEarned: boolean;
}

interface CheatDayContextType {
  status: CheatStatus;
  isLoading: boolean;
  refreshStatus: () => Promise<void>;
  activateCheatDay: () => Promise<{ success: boolean; message: string }>;
  MAX_COINS: number;
}

const DEFAULT_STATUS: CheatStatus = {
  cheatCoins: 0,
  streakCount: 0,
  lastStreakDate: null,
  isTodayCheat: false,
  coinEarned: false,
};

const CheatDayContext = createContext<CheatDayContextType | undefined>(undefined);

export function CheatDayProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [status, setStatus] = useState<CheatStatus>(DEFAULT_STATUS);
  const [isLoading, setIsLoading] = useState(false);

  // 로그인 시 자동으로 스트릭 체크 + 상태 로드
  useEffect(() => {
    if (isLoggedIn) {
      initCheatDay();
    } else {
      setStatus(DEFAULT_STATUS);
    }
  }, [isLoggedIn]);

  async function initCheatDay() {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const lastChecked = await AsyncStorage.getItem(STREAK_CHECK_KEY);

      if (lastChecked !== today) {
        // 오늘 아직 스트릭 체크 안 함 → API 호출
        const res = await checkStreak();
        if (res.data) {
          setStatus({
            cheatCoins: res.data.cheatCoins ?? 0,
            streakCount: res.data.streakCount ?? 0,
            lastStreakDate: res.data.lastStreakDate ?? null,
            isTodayCheat: res.data.todayCheat ?? false,
            coinEarned: res.data.coinEarned ?? false,
          });
        }
        await AsyncStorage.setItem(STREAK_CHECK_KEY, today);
      } else {
        // 이미 오늘 체크했으면 status만 조회
        await refreshStatusInternal();
      }
    } catch {
      // 네트워크 오류 무시
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshStatusInternal() {
    try {
      const res = await getCheatStatus();
      if (res.data) {
        setStatus({
          cheatCoins: res.data.cheatCoins ?? 0,
          streakCount: res.data.streakCount ?? 0,
          lastStreakDate: res.data.lastStreakDate ?? null,
          isTodayCheat: res.data.todayCheat ?? false,
          coinEarned: false,
        });
      }
    } catch {}
  }

  const refreshStatus = useCallback(async () => {
    await refreshStatusInternal();
  }, []);

  const activateCheatDay = useCallback(async () => {
    if (status.cheatCoins <= 0) {
      return { success: false, message: '보유한 코인이 없어요. 7일 연속 달성 시 코인이 지급돼요!' };
    }
    if (status.isTodayCheat) {
      return { success: false, message: '오늘은 이미 치팅데이예요! 떳떳하게 드세요 🍕' };
    }
    if (status.cheatCoins >= MAX_COINS) {
      // 가득 찬 경우도 사용 가능 (경고 문구만 별도 표시)
    }
    try {
      const res = await useCoin();
      if (res.data) {
        setStatus(prev => ({
          ...prev,
          cheatCoins: res.data.cheatCoins ?? prev.cheatCoins - 1,
          isTodayCheat: true,
          coinEarned: false,
        }));
        return { success: true, message: '오늘은 공식 치팅데이입니다. 떳떳하게 드세요 🍕' };
      }
      return { success: false, message: '잠시 후 다시 시도해주세요.' };
    } catch {
      return { success: false, message: '잠시 후 다시 시도해주세요.' };
    }
  }, [status]);

  return (
    <CheatDayContext.Provider value={{ status, isLoading, refreshStatus, activateCheatDay, MAX_COINS }}>
      {children}
    </CheatDayContext.Provider>
  );
}

export function useCheatDay() {
  const ctx = useContext(CheatDayContext);
  if (!ctx) throw new Error('useCheatDay must be used within CheatDayProvider');
  return ctx;
}
