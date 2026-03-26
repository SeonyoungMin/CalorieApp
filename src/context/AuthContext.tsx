import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { loginApi, logoutApi, registerApi, getUserProfile } from '../api/api';

const MOCK_MODE = false;
const isWeb = Platform.OS === 'web';

interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  goalKcal: number;
  userWeightKg: number | null;
  userHeightCm: number | null;
  nickname: string;
  login: (email: string, password: string) => Promise<void>;
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

      // 저장된 자격증명으로 자동로그인 시도
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
    if (MOCK_MODE) {
      await AsyncStorage.setItem('JSESSIONID', 'mock-session');
      setIsLoggedIn(true);
      return;
    }
    const response = await loginApi(email, password);
    if (response.status === 200) {
      // 자동로그인용 자격증명 저장
      await AsyncStorage.setItem('AUTO_EMAIL', email);
      await AsyncStorage.setItem('AUTO_PWD', password);
      setIsLoggedIn(true);
      await fetchProfile();
    } else {
      throw new Error('로그인 실패');
    }
  };

  const register = async (email: string, password: string, nickname: string) => {
    if (MOCK_MODE) return;
    const response = await registerApi(email, password, nickname);
    if (response.status !== 200) {
      throw new Error('회원가입 실패');
    }
  };

  const logout = async () => {
    if (MOCK_MODE) {
      await AsyncStorage.removeItem('JSESSIONID');
      setIsLoggedIn(false);
      return;
    }
    try {
      await logoutApi();
    } catch (_) {}
    await AsyncStorage.removeItem('JSESSIONID');
    await AsyncStorage.removeItem('AUTO_EMAIL');
    await AsyncStorage.removeItem('AUTO_PWD');
    setIsLoggedIn(false);
    setGoalKcal(2000);
    setUserWeightKg(null);
    setUserHeightCm(null);
    setNickname('');
  };

  const refreshProfile = fetchProfile;

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, goalKcal, userWeightKg, userHeightCm, nickname, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
