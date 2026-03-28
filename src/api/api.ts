import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// 웹: 프록시를 통해 같은 origin으로 요청 (CORS 우회)
// 네이티브: 직접 서버 주소로 요청
const BASE_URL = isWeb ? '' : 'http://54.206.26.66:8081';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  withCredentials: isWeb, // 웹: 브라우저 쿠키 자동 처리
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

// Response interceptor: JSESSIONID 캡처 (네이티브 전용)
// React Native OkHttp가 302를 자동으로 따라가므로 Set-Cookie 대신
// Spring Boot가 URL에 포함시키는 jsessionid를 responseURL에서 추출
api.interceptors.response.use(
  async (response) => {
    if (!isWeb) {
      // 방법1: Set-Cookie 헤더 (직접 응답인 경우)
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
        const match = cookieStr.match(/JSESSIONID=([^;]+)/);
        if (match) {
          await AsyncStorage.setItem('JSESSIONID', match[1]);
        }
      }
      // 방법2: 리다이렉트 후 최종 URL에서 jsessionid 추출
      const responseURL: string = (response.request as any)?.responseURL || '';
      if (responseURL) {
        const urlMatch = responseURL.match(/jsessionid=([^;?/\s]+)/i);
        if (urlMatch) {
          await AsyncStorage.setItem('JSESSIONID', urlMatch[1]);
        }
      }
    }
    return response;
  },
  (error) => Promise.reject(error)
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const loginApi = (email: string, password: string) => {
  const params = new URLSearchParams();
  params.append('email', email);
  params.append('password', password);
  return api.post('/login', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    // 302 리다이렉트를 직접 받아서 Set-Cookie(JSESSIONID) 캡처
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

export default api;
