import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// 웹: 프록시를 통해 같은 origin으로 요청 (CORS 우회)
// 네이티브: 직접 서버 주소로 요청
export const BASE_URL = isWeb ? '' : 'http://54.206.26.66:8081';

// UI 테스트용 목 모드 (서버 연결 불가 시 true)
const MOCK_MODE = false;

const mockResponse = (data: any) =>
  Promise.resolve({ status: 200, data, headers: {} });

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

// Response interceptor: capture Set-Cookie header (네이티브 전용)
api.interceptors.response.use(
  async (response) => {
    if (!isWeb) {
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
        const match = cookieStr.match(/JSESSIONID=([^;]+)/);
        if (match) {
          await AsyncStorage.setItem('JSESSIONID', match[1]);
        }
      }
    }
    return response;
  },
  (error) => Promise.reject(error)
);

// ─── Auth ───────────────────────────────────────────────────────────────────
export const loginApi = (email: string, password: string) => {
  const params = new URLSearchParams();
  params.append('email', email);
  params.append('password', password);
  return api.post('/login', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

export const logoutApi = () => api.get('/logout');

// ─── Meal ────────────────────────────────────────────────────────────────────
export const getTodayMeals = () => MOCK_MODE ? mockResponse([]) : api.get('/api/meal/today');
export const getMealsByDate = (date: string) => MOCK_MODE ? mockResponse([]) : api.get('/api/meal/by-date', { params: { date } });
export const saveMeal = (data: {
  mealType: string;
  totalKcal: number;
  isText: boolean;
  foods: { foodName: string; kcal: number }[];
  logDate?: string;
}) => MOCK_MODE ? mockResponse({}) : api.post('/api/meal/save', data);
export const updateMeal = (mealId: number, data: object) =>
  MOCK_MODE ? mockResponse({}) : api.put(`/api/meal/${mealId}`, data);
export const deleteMeal = (mealId: number) => MOCK_MODE ? mockResponse({}) : api.delete(`/api/meal/${mealId}`);
export const deleteAllTodayMeals = () => MOCK_MODE ? mockResponse({}) : api.delete('/api/meal/today');

// ─── Workout ─────────────────────────────────────────────────────────────────
export const getTodayWorkouts = () => MOCK_MODE ? mockResponse([]) : api.get('/api/workout/today');
export const getWorkoutsByDate = (date: string) => MOCK_MODE ? mockResponse([]) : api.get('/api/workout/by-date', { params: { date } });
export const saveWorkout = (data: {
  exerciseName: string;
  durationMin: number;
  kcalBurned: number;
  logDate?: string;
}) => MOCK_MODE ? mockResponse({}) : api.post('/api/workout/save', data);
export const deleteWorkout = (workoutId: number) =>
  MOCK_MODE ? mockResponse({}) : api.delete(`/api/workout/${workoutId}`);

// ─── Weight ──────────────────────────────────────────────────────────────────
export const getWeightList = () => MOCK_MODE ? mockResponse([]) : api.get('/api/weight/list');
export const saveWeight = (weightKg: number) =>
  MOCK_MODE ? mockResponse({}) : api.post('/api/weight/save', { weightKg });
export const deleteWeight = (weightId: number) =>
  MOCK_MODE ? mockResponse({}) : api.delete(`/api/weight/${weightId}`);

// ─── Water ───────────────────────────────────────────────────────────────────
export const getTodayWater = () => MOCK_MODE ? mockResponse({ totalMl: 0 }) : api.get('/api/water/today');
export const updateWater = (totalMl: number) =>
  MOCK_MODE ? mockResponse({}) : api.post('/api/water/update', { totalMl });

// ─── Cycle ───────────────────────────────────────────────────────────────────
export const getCycleInfo = () => MOCK_MODE ? mockResponse(null) : api.get('/api/cycle/info');
export const saveCycle = (data: {
  lastPeriodDate: string;
  cycleLength: number;
  periodLength: number;
}) => MOCK_MODE ? mockResponse({}) : api.post('/api/cycle/save', data);

// ─── User ─────────────────────────────────────────────────────────────────────
export const getUserProfile = () =>
  MOCK_MODE ? mockResponse({ goalKcal: 2000, weightKg: null, heightCm: null, nickname: '사용자' }) : api.get('/api/user/me');
export const setGoalKcal = (goalKcal: number) =>
  MOCK_MODE ? mockResponse({}) : api.post('/api/user/goal', { goalKcal });
export const setUserProfile = (weightKg: number, heightCm: number) =>
  MOCK_MODE ? mockResponse({}) : api.post('/api/user/profile', { weightKg, heightCm });
export const getWeeklyStats = () => MOCK_MODE ? mockResponse([]) : api.get('/api/user/stats/weekly');

export default api;
