import axios from 'axios';

// ✅ 여기에 본인 서버 IP/포트 입력
// 에뮬레이터: http://10.0.2.2:8080
// 실제 기기: http://192.168.x.x:8080
// AWS EC2: http://54.206.26.66:8080
const BASE_URL = 'http://54.206.26.66:8080';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 401 발생 시 호출할 핸들러 (App.js에서 등록)
let _unauthorizedHandler = null;
export const setUnauthorizedHandler = (handler) => {
  _unauthorizedHandler = handler;
};

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && _unauthorizedHandler) {
      _unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

// ────────────────────────────────────────────
// 인증
// ────────────────────────────────────────────
export const authAPI = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),

  logout: () =>
    api.post('/api/auth/logout'),

  register: (data) =>
    api.post('/api/auth/register', data),

  getProfile: () =>
    api.get('/api/user/me'),

  updateProfile: (data) =>
    api.put('/api/user/me', data),
};

// ────────────────────────────────────────────
// 음식 분석 (AI)
// ────────────────────────────────────────────
export const analyzeAPI = {
  // 이미지로 칼로리 분석
  analyzeImage: (imageBase64, mimeType = 'image/jpeg') =>
    api.post('/api/analyze/image', { imageBase64, mimeType }),

  // 텍스트로 칼로리 분석
  analyzeText: (text) =>
    api.post('/api/analyze/text', { text }),

  // 단일 음식 칼로리 조회
  lookupKcal: (foodName) =>
    api.post('/api/analyze/lookup', { foodName }),

  // AI 식단 총평
  getReview: (goal, total, burned, meals) =>
    api.post('/api/analyze/review', { goal, total, burned, meals }),
};

// ────────────────────────────────────────────
// 식사 기록
// ────────────────────────────────────────────
export const mealAPI = {
  getToday: () =>
    api.get('/api/meal/today'),

  save: (mealType, totalKcal, foods, isText = false) =>
    api.post('/api/meal/save', { mealType, totalKcal, foods, isText }),

  update: (mealId, mealType, totalKcal, foods) =>
    api.put(`/api/meal/${mealId}`, { mealType, totalKcal, foods }),

  delete: (mealId) =>
    api.delete(`/api/meal/${mealId}`),

  deleteToday: () =>
    api.delete('/api/meal/today'),
};

// ────────────────────────────────────────────
// AI 추천
// ────────────────────────────────────────────
export const aiAPI = {
  review: () =>
    api.post('/api/ai/review'),

  recommend: () =>
    api.post('/api/ai/recommend'),
};

// ────────────────────────────────────────────
// 체중 기록
// ────────────────────────────────────────────
export const weightAPI = {
  getList: () =>
    api.get('/api/weight/list'),

  save: (weightKg) =>
    api.post('/api/weight/save', { weightKg }),

  delete: (weightId) =>
    api.delete(`/api/weight/${weightId}`),
};

// ────────────────────────────────────────────
// 물 섭취
// ────────────────────────────────────────────
export const waterAPI = {
  getToday: () =>
    api.get('/api/water/today'),

  add: (amountMl) =>
    api.post('/api/water/add', { amountMl }),

  reset: () =>
    api.delete('/api/water/today'),
};

// ────────────────────────────────────────────
// 운동 기록
// ────────────────────────────────────────────
export const workoutAPI = {
  getToday: () =>
    api.get('/api/workout/today'),

  save: (workoutType, durationMin, burnedKcal) =>
    api.post('/api/workout/save', { workoutType, durationMin, burnedKcal }),

  delete: (workoutId) =>
    api.delete(`/api/workout/${workoutId}`),
};

export default api;
