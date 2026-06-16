import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { setOnline, isNetworkError } from '../utils/offline';

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
    setOnline(true);
    return response;
  },
  async (error) => {
    if (isNetworkError(error)) setOnline(false);
    // 401 세션 만료 시 자동 재로그인 후 원래 요청 재시도
    if (!isWeb && error?.response?.status === 401 && !error.config?._retry) {
      try {
        const socialType = await AsyncStorage.getItem('@social_type');

        // 소셜 유저: 캐시된 SDK 토큰으로 silent 재인증
        if (socialType === 'google' || socialType === 'kakao') {
          await AsyncStorage.removeItem('JSESSIONID');
          try {
            if (socialType === 'google') {
              const googleModule = require('@react-native-google-signin/google-signin');
              const GoogleSignin = googleModule.GoogleSignin;
              // 기존 세션 있으면 silent sign-in 시도 → 새 idToken
              const userInfo = await GoogleSignin.signInSilently();
              const idToken: string | null =
                (userInfo as any)?.idToken ?? (userInfo as any)?.data?.idToken ?? null;
              if (idToken) {
                await api.post('/auth/google', { googleToken: idToken }, { _retry: true } as any);
              }
            } else if (socialType === 'kakao') {
              const kakaoModule = require('@react-native-seoul/kakao-login');
              // 카카오는 토큰 갱신 (자동) 후 새 accessToken 받기
              const tokenInfo = await kakaoModule.getAccessToken();
              const accessToken = tokenInfo?.accessToken;
              if (accessToken) {
                await api.post('/auth/kakao', { kakaoToken: accessToken }, { _retry: true } as any);
              }
            }
            // 새 JSESSIONID로 원래 요청 재시도
            const newSessionId = await AsyncStorage.getItem('JSESSIONID');
            if (newSessionId) {
              error.config._retry = true;
              error.config.headers['Cookie'] = `JSESSIONID=${newSessionId}`;
              return api(error.config);
            }
          } catch (_) {
            // silent 재인증 실패 → 원래 401 반환 (UI에서 재로그인 유도)
          }
          return Promise.reject(error);
        }

        // 이메일/비밀번호 유저: AUTO_EMAIL/AUTO_PWD로 재로그인
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
  if (isWeb) {
    // 웹: 브라우저가 리다이렉트를 자동 처리하므로 단순 POST
    return api.post('/login', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }
  return api.post('/login', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 400,
  });
};

export const registerApi = (email: string, password: string, nickname: string, phone?: string) => {
  // 전화번호가 있으면 새 JSON 엔드포인트 사용 (phone 저장 가능)
  if (phone && phone.trim()) {
    return api.post('/api/auth/register', { email, password, nickname, phone: phone.trim() });
  }
  // 전화번호 없으면 기존 form 엔드포인트 사용 (호환)
  const params = new URLSearchParams();
  params.append('email', email);
  params.append('password', password);
  params.append('nickname', nickname);
  return api.post('/register', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
};

export const logoutApi = () => api.post('/logout');

// ─── AI Proxy (Anthropic Messages API via backend) ───────────────────────────
export const callAiMessages = (payload: {
  model: string;
  max_tokens: number;
  messages: any[];
}) => api.post('/api/ai/messages', payload, { timeout: 60000 });

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

// ─── Archive ─────────────────────────────────────────────────────────────────
/**
 * 월별 사진 + 칼로리 조회
 * GET /api/archive/photos?year=&month=
 * → { photos: ArchivePhoto[], calories: [{logDate, eaten, burned}] }
 */
export const getArchivePhotos = (year: number, month: number) =>
  api.get('/api/archive/photos', { params: { year, month } });

/**
 * 사진 업로드 (multipart/form-data)
 * POST /api/archive/photo/upload
 * body: { image(file), logDate, category, isPremium }
 * → { photoId, imageUrl, imageType }
 */
export const uploadArchivePhoto = (formData: FormData) =>
  api.post('/api/archive/photo/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
    timeout: 30000,
  });

/**
 * 사진 삭제
 * DELETE /api/archive/photo/{photoId}
 */
export const deleteArchivePhoto = (photoId: number) =>
  api.delete(`/api/archive/photo/${photoId}`);

/**
 * 날짜별 일기 조회
 * GET /api/archive/diary/{logDate}
 * → { logDate, content }
 */
export const getArchiveDiary = (logDate: string) =>
  api.get(`/api/archive/diary/${logDate}`);

/**
 * 일기 저장/수정
 * POST /api/archive/diary
 * body: { logDate, content }
 */
export const saveArchiveDiary = (logDate: string, content: string) =>
  api.post('/api/archive/diary', { logDate, content });

// ─── Friend Feed ─────────────────────────────────────────────────────────────
/**
 * 친구 스토리 목록
 * GET /api/friend/stories
 */
export const getFriendStories = () =>
  api.get('/api/friend/stories');

/**
 * 친구 피드 (카테고리 필터 선택)
 * GET /api/friend/feed?category=식단
 */
export const getFriendFeed = (category?: string) =>
  api.get('/api/friend/feed', { params: category ? { category } : {} });

/**
 * 친구 24시간 스토리 상세 (사진 목록)
 * GET /api/friend/story/:userId
 */
export const getFriendStoryDetail = (userId: number) =>
  api.get(`/api/friend/story/${userId}`);

/**
 * 응원 전송 (푸시 알림)
 * POST /api/friend/cheer  { targetUserId }
 */
export const sendCheer = (targetUserId: number) =>
  api.post('/api/friend/cheer', { targetUserId });

/**
 * 피드 반응 (이모지 reaction)
 * POST /api/friend/react  { entryId, reaction }
 * reaction이 빈 문자열이면 반응 취소
 */
export const reactToEntry = (entryId: string, reaction: string) =>
  api.post('/api/friend/react', { entryId, reaction });

// ─── Friend ───────────────────────────────────────────────────────────────────
/**
 * 공개 프로필 조회 (딥링크용 — 비로그인 가능)
 * GET /api/user/public/:userId
 * → { id, nickname, recentEntries: [{date, category, photoUrl}] }
 */
export const getUserPublicProfile = (userId: number) =>
  api.get(`/api/user/public/${userId}`);

/**
 * 친구 요청 전송
 * POST /api/friend/request
 * body: { targetUserId }
 * → 200 OK
 */
export const sendFriendRequest = (targetUserId: number) =>
  api.post('/api/friend/request', { targetUserId });

/**
 * 친구 목록 조회
 * GET /api/friend/list
 * → [{ id, nickname, recentPhoto }]
 */
export const getFriendList = () =>
  api.get('/api/friend/list');

/**
 * 친구 삭제
 * DELETE /api/friend/:friendId
 */
export const deleteFriend = (friendId: number) =>
  api.delete(`/api/friend/${friendId}`);

/**
 * 받은 친구 요청 목록
 * GET /api/friend/requests/received
 * → [{ requestId, fromUserId, fromNickname, fromPhoto, createdAt }]
 */
export const getReceivedFriendRequests = () =>
  api.get('/api/friend/requests/received');

/**
 * 친구 요청 수락
 * POST /api/friend/accept  { requestId }
 */
export const acceptFriendRequest = (requestId: number) =>
  api.post('/api/friend/accept', { requestId });

/**
 * 친구 요청 거절
 * POST /api/friend/reject  { requestId }
 */
export const rejectFriendRequest = (requestId: number) =>
  api.post('/api/friend/reject', { requestId });

/**
 * 본인 게시물에 들어온 좋아요 알림
 * GET /api/friend/notifications
 * → [{ entryId, fromUserId, fromNickname, reaction, createdAt }]
 */
export const getMyNotifications = () =>
  api.get('/api/friend/notifications');

/**
 * 아이디 찾기 — 닉네임 또는 전화번호로 가입 이메일 찾기
 * POST /api/auth/find-id { nickname?, phone? }
 * → { emails: ["m***@gmail.com", ...] }
 */
export const findUserId = (params: { nickname?: string; phone?: string }) =>
  api.post('/api/auth/find-id', params);

/**
 * 비번 재설정 — 이메일 + (닉네임 또는 전화번호) 검증 후 임시 비번 발급
 * POST /api/auth/reset-password { email, nickname?, phone? }
 * → { message, tempPassword }
 */
export const resetPasswordByInfo = (params: { email: string; nickname?: string; phone?: string }) =>
  api.post('/api/auth/reset-password', params);

/**
 * 비번 변경 (로그인 상태)
 * POST /api/auth/change-password { currentPassword, newPassword }
 */
export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post('/api/auth/change-password', { currentPassword, newPassword });

/** 전화번호 등록/변경 (로그인 상태) */
export const setMyPhone = (phone: string) =>
  api.post('/api/auth/set-phone', { phone });

/** 본인 전화번호 조회 */
export const getMyPhone = () =>
  api.get('/api/auth/my-phone');

export default api;
