import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// 웹: 프록시를 통해 같은 origin으로 요청 (CORS 우회)
// 네이티브: 직접 서버 주소로 요청
const BASE_URL = isWeb ? '' : 'http://54.252.162.73:8081';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  withCredentials: isWeb,
});

// Request interceptor: attach session cookie (네이티브 전용)
api.interceptors.request.use(
  async (config) => {
    if (!isWeb) {
      const sessionId = await AsyncStorage.getItem('JSESSIONID');
      if (sessionId) {
        config.headers['Cookie'] = `JSESSIONID=${sessionId}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: JSESSIONID 캡처 + 401 자동 재로그인 (네이티브 전용)
api.interceptors.response.use(
  async (response) => {
    if (!isWeb) {
      // 방법1: Set-Cookie 헤더
      const setCookie = response.headers?.['set-cookie'];
      if (setCookie) {
        const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
        const match = cookieStr.match(/JSESSIONID=([^;]+)/);
        if (match) await AsyncStorage.setItem('JSESSIONID', match[1]);
      }
      // 방법2: 리다이렉트 후 URL에서 jsessionid 추출
      const responseURL: string = (response.request as any)?.responseURL || '';
      if (responseURL) {
        const urlMatch = responseURL.match(/jsessionid=([^;?/\s]+)/i);
        if (urlMatch) await AsyncStorage.setItem('JSESSIONID', urlMatch[1]);
      }
    }
    return response;
  },
  async (error) => {
    // 401 세션 만료 시 저장된 자격증명으로 자동 재로그인 후 원래 요청 재시도
    // 소셜 유저(AUTO_EMAIL 없음)는 재로그인 불가 → 그대로 에러 반환
    if (!isWeb && error?.response?.status === 401 && !error.config?._retry) {
      try {
        const socialType = await AsyncStorage.getItem('@social_type');
        if (socialType) return Promise.reject(error); // 소셜 유저 → 바로 반환

        const autoEmail = await AsyncStorage.getItem('AUTO_EMAIL');
        const autoPwd = await AsyncStorage.getItem('AUTO_PWD');
        if (autoEmail && autoPwd) {
          const params = new URLSearchParams();
          params.append('email', autoEmail);
          params.append('password', autoPwd);
          const loginRes = await api.post('/login', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            maxRedirects: 0,
            validateStatus: (s) => s >= 200 && s < 400,
            _retry: true,
          } as any);
          // 새 JSESSIONID 캡처
          const setCookie = loginRes.headers?.['set-cookie'];
          if (setCookie) {
            const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
            const match = cookieStr.match(/JSESSIONID=([^;]+)/);
            if (match) await AsyncStorage.setItem('JSESSIONID', match[1]);
          }
          const responseURL: string = (loginRes.request as any)?.responseURL || '';
          if (responseURL) {
            const urlMatch = responseURL.match(/jsessionid=([^;?/\s]+)/i);
            if (urlMatch) await AsyncStorage.setItem('JSESSIONID', urlMatch[1]);
          }
          // 원래 요청 재시도
          const newSessionId = await AsyncStorage.getItem('JSESSIONID');
          error.config._retry = true;
          error.config.headers['Cookie'] = `JSESSIONID=${newSessionId}`;
          return api(error.config);
        }
      } catch (_) {}
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const loginApi = (email: string, password: string) => {
  const params = new URLSearchParams();
  params.append('email', email);
  params.append('password', password);
  return api.post('/login', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 400,
  });
};

export const registerApi = (email: string, password: string, nickname: string) => {
  const params = new URLSearchParams();
  params.append('email', email);
  params.append('password', password);
  params.append('nickname', nickname);
  return api.post('/register', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
};

export const logoutApi = () => api.post('/logout');

// ─── Meal ─────────────────────────────────────────────────────────────────────
export const getTodayMeals = () => api.get('/api/meal/today');
export const getMealsByDate = (date: string) => api.get('/api/meal/by-date', { params: { date } });
export const saveMeal = (data: {
  mealType: string;
  totalKcal: number;
  isText: boolean;
  foods: { foodName: string; kcal: number }[];
  logDate?: string;
}) => api.post('/api/meal/save', data);
export const deleteMeal = (mealId: number) => api.delete(`/api/meal/${mealId}`);
export const deleteAllTodayMeals = () => api.delete('/api/meal/today');

// ─── Workout ──────────────────────────────────────────────────────────────────
export const getTodayWorkouts = () => api.get('/api/workout/today');
export const getWorkoutsByDate = (date: string) => api.get('/api/workout/by-date', { params: { date } });
export const saveWorkout = (data: {
  exerciseName: string;
  durationMin: number;
  kcalBurned: number;
  logDate?: string;
}) => api.post('/api/workout/save', data);
export const deleteWorkout = (workoutId: number) => api.delete(`/api/workout/${workoutId}`);

// ─── Weight ───────────────────────────────────────────────────────────────────
export const getWeightList = () => api.get('/api/weight/list');
export const saveWeight = (weightKg: number, logDate?: string) => api.post('/api/weight/save', { weightKg, ...(logDate ? { logDate } : {}) });
export const deleteWeight = (weightId: number) => api.delete(`/api/weight/${weightId}`);

// ─── Water ────────────────────────────────────────────────────────────────────
export const getTodayWater = () => api.get('/api/water/today');
export const updateWater = (totalMl: number) => api.post('/api/water/update', { totalMl });

// ─── Cycle ────────────────────────────────────────────────────────────────────
export const getCycleInfo = () => api.get('/api/cycle/info');
export const saveCycle = (data: {
  lastPeriodDate: string;
  cycleLength: number;
  periodLength: number;
}) => api.post('/api/cycle/save', data);

// ─── User ─────────────────────────────────────────────────────────────────────
export const getUserProfile = () => api.get('/api/user/me');
export const setGoalKcal = (goalKcal: number) => api.post('/api/user/goal', { goalKcal });
export const setUserProfile = (weightKg: number, heightCm: number) => api.post('/api/user/profile', { weightKg, heightCm });
export const getWeeklyStats = () => api.get('/api/user/stats/weekly');

// ─── Weight Goal ─────────────────────────────────────────────────────────────
export const getWeightGoal = () => api.get('/api/user/weight/goal');
export const updateUserWeight = (data: {
  currentWeight?: number;
  goalWeight?: number;
}) => api.put('/api/user/weight', data);
export const getWeightGoalHistory = () => api.get('/api/user/weight/history');
export const getCalorieAverage = () => api.get('/api/calorie/average');

// ─── Carry Over ───────────────────────────────────────────────────────────────
export const getTodayCarryOver = () => api.get('/api/calorie/carry-over/today');
export const saveCarryOver = (data: {
  carryDate: string;
  breakfastCarry: number;
  lunchCarry: number;
}) => api.post('/api/calorie/carry-over', data);
export const saveMealGoals = (data: {
  breakfastGoal: number;
  lunchGoal: number;
  dinnerGoal: number;
}) => api.post('/api/calorie/meal-goals', data);

// ─── Drink ────────────────────────────────────────────────────────────────────
export const saveDrinkSchedule = (data: {
  scheduledDate: string;
  memo?: string;
}) => api.post('/api/drink/schedule', data);

export const getUpcomingDrinkSchedules = () => api.get('/api/drink/schedule/upcoming');

// ─── Cheat Day ────────────────────────────────────────────────────────────────
export const checkStreak     = () => api.post('/api/cheat/check-streak');
export const useCoin         = () => api.post('/api/cheat/use-coin');
export const getCheatStatus  = () => api.get('/api/cheat/status');
export const getCheatHistory = () => api.get('/api/cheat/history');

// ─── Social Auth ──────────────────────────────────────────────────────────────
export const kakaoLogin  = (kakaoToken: string) =>
  api.post('/auth/kakao', { kakaoToken });
export const googleLogin = (googleToken: string) =>
  api.post('/auth/google', { googleToken });

export default api;
