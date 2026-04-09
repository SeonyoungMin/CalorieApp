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

const isWeb = Platform.OS === 'web';

interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  goalKcal: number;
  userWeightKg: number | null;
  userHeightCm: number | null;
  nickname: string;
  login: (email: string, password: string) => Promise<void>;
  loginWithKakao: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<void>;
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

  const fetchProfile = async () => {
    try {
      const res = await getUserProfile();
      if (res.data) {
        setGoalKcal(res.data.goalKcal || 2000);
        setUserWeightKg(res.data.weightKg ? parseFloat(res.data.weightKg) : null);
        setUserHeightCm(res.data.heightCm ? parseFloat(res.data.heightCm) : null);
        setNickname(res.data.nickname || '');
      }
    } catch (_) {}
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        if (isWeb) {
          // 웹: 브라우저 쿠키로 세션 유효성 확인
          const res = await getUserProfile();
          if (res.status === 200 && res.data) {
            setGoalKcal(res.data.goalKcal || 2000);
            setUserWeightKg(res.data.weightKg ? parseFloat(res.data.weightKg) : null);
            setUserHeightCm(res.data.heightCm ? parseFloat(res.data.heightCm) : null);
            setNickname(res.data.nickname || '');
            setIsLoggedIn(true);
            setIsLoading(false);
            return;
          }
        } else {
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
    const responseURL: string = (loginRes.request as any)?.responseURL || '';
    // responseURL에 error 또는 /login 경로가 있으면 인증 실패
    if (responseURL.includes('error') || responseURL.match(/\/login[;?]/)) {
      throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    let res;
    try {
      res = await getUserProfile();
    } catch (e: any) {
      throw new Error('로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.');
    }
    await AsyncStorage.setItem('AUTO_EMAIL', email);
    await AsyncStorage.setItem('AUTO_PWD', password);
    setGoalKcal(res.data.goalKcal || 2000);
    setUserWeightKg(res.data.weightKg ? parseFloat(res.data.weightKg) : null);
    setUserHeightCm(res.data.heightCm ? parseFloat(res.data.heightCm) : null);
    setNickname(res.data.nickname || '');
    setIsLoggedIn(true);
  };

  // ── 카카오 로그인 ────────────────────────────────────────────────────────
  const loginWithKakao = async () => {
    await signInWithKakao();                 // SDK → 백엔드 → JSESSIONID 저장
    const res = await getUserProfile();
    setGoalKcal(res.data.goalKcal || 2000);
    setUserWeightKg(res.data.weightKg ? parseFloat(res.data.weightKg) : null);
    setUserHeightCm(res.data.heightCm ? parseFloat(res.data.heightCm) : null);
    setNickname(res.data.nickname || '');
    setIsLoggedIn(true);
  };

  // ── 구글 로그인 ─────────────────────────────────────────────────────────
  const loginWithGoogle = async () => {
    await signInWithGoogle();
    const res = await getUserProfile();
    setGoalKcal(res.data.goalKcal || 2000);
    setUserWeightKg(res.data.weightKg ? parseFloat(res.data.weightKg) : null);
    setUserHeightCm(res.data.heightCm ? parseFloat(res.data.heightCm) : null);
    setNickname(res.data.nickname || '');
    setIsLoggedIn(true);
  };

  const register = async (email: string, password: string, nickname: string) => {
    const response = await registerApi(email, password, nickname);
    if (response.status !== 200) {
      throw new Error('회원가입 실패');
    }
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (_) {}
    // 소셜 SDK 로그아웃 (구글)
    await signOutSocial();
    await AsyncStorage.removeItem('JSESSIONID');
    await AsyncStorage.removeItem('AUTO_EMAIL');
    await AsyncStorage.removeItem('AUTO_PWD');
    // 웹: 브라우저 쿠키 직접 만료 처리 (Spring Security GET logout이 세션을 종료 못할 경우 대비)
    if (isWeb) {
      document.cookie = 'JSESSIONID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
    setIsLoggedIn(false);
    setGoalKcal(2000);
    setUserWeightKg(null);
    setUserHeightCm(null);
    setNickname('');
  };

  const refreshProfile = fetchProfile;

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, goalKcal, userWeightKg, userHeightCm, nickname, login, loginWithKakao, loginWithGoogle, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
