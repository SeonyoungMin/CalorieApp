import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { loginApi, logoutApi, registerApi, getUserProfile } from '../api/api';
import {
  signInWithKakao,
  signInWithGoogle,
  signOutSocial,
  isSocialUser,
  SOCIAL_TYPE_KEY,
} from '../services/socialAuthService';
import { consumePendingFriendUserId, navigateToFriendRequest } from '../navigation/navigationRef';
import Purchases from 'react-native-purchases';
import { EVENT_FREE_ACCESS } from '../config/eventFlags';

const isWeb = Platform.OS === 'web';

async function syncRevenueCatUser(userId: number | null) {
  if (EVENT_FREE_ACCESS) return; // 무료 이벤트 기간: RevenueCat 사용자 동기화 우회
  if (isWeb) return;
  try {
    if (userId != null) {
      await Purchases.logIn(String(userId));
    } else {
      await Purchases.logOut();
    }
  } catch {}
}

interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  goalKcal: number;
  userWeightKg: number | null;
  userHeightCm: number | null;
  nickname: string;
  userId: number | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithKakao: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, nickname: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [goalKcal, setGoalKcal] = useState(2000);
  const [userWeightKg, setUserWeightKg] = useState<number | null>(null);
  const [userHeightCm, setUserHeightCm] = useState<number | null>(null);
  const [nickname, setNickname] = useState('');
  const [userId, setUserId] = useState<number | null>(null);

  // 로그인 완료 후 펜딩 딥링크 처리
  const handlePendingDeepLink = () => {
    const pendingId = consumePendingFriendUserId();
    if (pendingId) {
      setTimeout(() => navigateToFriendRequest(pendingId), 300);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await getUserProfile();
      if (res.data) {
        setGoalKcal(res.data.goalKcal || 2000);
        setUserWeightKg(res.data.weightKg ? parseFloat(res.data.weightKg) : null);
        setUserHeightCm(res.data.heightCm ? parseFloat(res.data.heightCm) : null);
        setNickname(res.data.nickname || '');
        const newId = res.data.id ?? null;
        setUserId(newId);
        await syncRevenueCatUser(newId);
      }
    } catch (_) {}
  };

  useEffect(() => {
    const checkSession = async () => {
      if (isWeb) {
        // 웹: 브라우저 쿠키(withCredentials)로 세션 확인
        try {
          await fetchProfile();
          setIsLoggedIn(true);
        } catch {
          // 세션 없음 → 로그인 화면
        }
        setIsLoading(false);
        return;
      }
      try {
        // 네이티브: AsyncStorage JSESSIONID 확인
        const sessionId = await AsyncStorage.getItem('JSESSIONID');
        if (sessionId) {
          try {
            await fetchProfile();
            setIsLoggedIn(true);
            setIsLoading(false);
            return;
          } catch (_) {
            // 세션 만료 → 자동로그인 시도
            await AsyncStorage.removeItem('JSESSIONID');
          }
        }
      } catch (_) {}

      // 소셜 유저: JSESSIONID 만료 시 재로그인 필요 (자동 불가) → 로그인 화면으로
      const social = await isSocialUser();
      if (social) {
        // 세션이 살아있으면 이미 위에서 처리됨. 여기까지 오면 만료
        setIsLoading(false);
        return;
      }

      // 일반 유저: 저장된 자격증명으로 자동로그인 시도
      try {
        const autoEmail = await AsyncStorage.getItem('AUTO_EMAIL');
        const autoPwd = await AsyncStorage.getItem('AUTO_PWD');
        if (autoEmail && autoPwd) {
          const response = await loginApi(autoEmail, autoPwd);
          if (response.status === 200) {
            await fetchProfile();
            setIsLoggedIn(true);
            setIsLoading(false);
            return;
          }
        }
      } catch (_) {}

      setIsLoading(false);
    };
    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    let loginRes: any;
    try {
      loginRes = await loginApi(email, password);
    } catch (e: any) {
      throw e;
    }

    if (!isWeb) {
      // 네이티브: responseURL로 실패 감지 (Spring Security 리다이렉트)
      const responseURL: string = (loginRes.request as any)?.responseURL || '';
      if (responseURL.includes('error') || responseURL.match(/\/login[;?]/)) {
        throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    }

    let res;
    try {
      res = await getUserProfile();
    } catch (e: any) {
      throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    if (!isWeb) {
      await AsyncStorage.setItem('AUTO_EMAIL', email);
      await AsyncStorage.setItem('AUTO_PWD', password);
    }
    setGoalKcal(res.data.goalKcal || 2000);
    setUserWeightKg(res.data.weightKg ? parseFloat(res.data.weightKg) : null);
    setUserHeightCm(res.data.heightCm ? parseFloat(res.data.heightCm) : null);
    setNickname(res.data.nickname || '');
    setUserId(res.data.id ?? null);
    await syncRevenueCatUser(res.data.id ?? null);
    setIsLoggedIn(true);
    handlePendingDeepLink();
  };

  // ── 카카오 로그인 ────────────────────────────────────────────────────────
  const loginWithKakao = async () => {
    await signInWithKakao();                 // SDK → 백엔드 → JSESSIONID 저장
    const res = await getUserProfile();
    if (!res.data) throw new Error('프로필 정보를 가져오지 못했습니다.');
    setGoalKcal(res.data.goalKcal || 2000);
    setUserWeightKg(res.data.weightKg ? parseFloat(res.data.weightKg) : null);
    setUserHeightCm(res.data.heightCm ? parseFloat(res.data.heightCm) : null);
    setNickname(res.data.nickname || '');
    setUserId(res.data.id ?? null);
    await syncRevenueCatUser(res.data.id ?? null);
    setIsLoggedIn(true);
    handlePendingDeepLink();
  };

  // ── 구글 로그인 ─────────────────────────────────────────────────────────
  const loginWithGoogle = async () => {
    await signInWithGoogle();
    const res = await getUserProfile();
    if (!res.data) throw new Error('프로필 정보를 가져오지 못했습니다.');
    setGoalKcal(res.data.goalKcal || 2000);
    setUserWeightKg(res.data.weightKg ? parseFloat(res.data.weightKg) : null);
    setUserHeightCm(res.data.heightCm ? parseFloat(res.data.heightCm) : null);
    setNickname(res.data.nickname || '');
    setUserId(res.data.id ?? null);
    await syncRevenueCatUser(res.data.id ?? null);
    setIsLoggedIn(true);
    handlePendingDeepLink();
  };

  const register = async (email: string, password: string, nickname: string, phone?: string) => {
    const response = await registerApi(email, password, nickname, phone);
    if (response.status !== 200) {
      throw new Error('회원가입 실패');
    }
    // 회원가입 후 세션 초기화 → 이후 로그인이 새 세션으로 진행되도록
    await AsyncStorage.removeItem('JSESSIONID');
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (_) {}
    // 소셜 SDK 로그아웃 (구글)
    await signOutSocial();
    await syncRevenueCatUser(null);
    await AsyncStorage.removeItem('JSESSIONID');
    await AsyncStorage.removeItem('AUTO_EMAIL');
    await AsyncStorage.removeItem('AUTO_PWD');
    // 계정 전환 시 다른 계정의 로컬 데이터 누수 방지
    await AsyncStorage.removeItem('@archive_entries');
    await AsyncStorage.removeItem('AI_SCAN_COUNT');
    // 웹: 브라우저 쿠키 직접 만료 처리 (Spring Security GET logout이 세션을 종료 못할 경우 대비)
    if (isWeb) {
      document.cookie = 'JSESSIONID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
    setIsLoggedIn(false);
    setGoalKcal(2000);
    setUserWeightKg(null);
    setUserHeightCm(null);
    setNickname('');
    setUserId(null);
  };

  const refreshProfile = fetchProfile;

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, goalKcal, userWeightKg, userHeightCm, nickname, userId, login, loginWithKakao, loginWithGoogle, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
