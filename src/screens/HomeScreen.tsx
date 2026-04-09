import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMealsByDate, getWorkoutsByDate, getWeeklyStats, getTodayWater } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { useWarningNotifications } from '../hooks/useWarningNotifications';
import { useCheatDay } from '../context/CheatDayContext';
import AiScanModal from '../components/AiScanModal';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../theme';
import { localDateStr, parseLocalDate } from '../utils/dateUtils';

interface WeeklyStat {
  date: string;
  foodKcal: number;
  burnedKcal: number;
  netKcal: number;
}

interface Meal {
  mealId: number;
  mealType: string;
  totalKcal: number;
}

interface Workout {
  workoutId: number;
  exerciseName: string;
  kcalBurned: number;
}

// ─── Circular Progress ───────────────────────────────────────────────────────
function CircularProgress({ value, max, size = 180 }: { value: number; max: number; size?: number }) {
  const validMax = max && max > 0 ? max : 2000;
  const validValue = value || 0;
  const pct = Math.max(0, Math.min(validValue / validMax, 1));
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - pct);

  // 섭취량에 따라 색상 변화: 초록 → 노랑 → 빨강
  const ringColor = pct >= 1
    ? COLORS.primary          // 목표 초과: 빨강
    : pct >= 0.8
    ? COLORS.warning          // 80% 이상: 노랑
    : COLORS.success;         // 80% 미만: 초록

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        {/* 배경 링 */}
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#E8EDF2" strokeWidth={strokeWidth} />
        {/* 진행 호(arc) */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </Svg>
      {/* 가운데 텍스트 */}
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 32, fontWeight: '800', color: ringColor }}>{value}</Text>
        <Text style={{ fontSize: 12, color: '#78909C', fontWeight: '500' }}>kcal</Text>
        <Text style={{ fontSize: 11, color: '#B0BEC5', marginTop: 2 }}>목표 {max}</Text>
      </View>
    </View>
  );
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────
function WeeklyChart({ data }: { data: WeeklyStat[] }) {
  if (!data.length) {
    return (
      <View style={chartStyles.container}>
        <Text style={chartStyles.title}>주간 칼로리</Text>
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ fontSize: 13, color: '#B0BEC5' }}>아직 이번 주 기록이 없어요</Text>
        </View>
      </View>
    );
  }
  const maxVal = Math.max(...data.map((d) => Math.max(d.foodKcal, d.burnedKcal)), 1);
  const days = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.title}>주간 칼로리</Text>
      <View style={chartStyles.bars}>
        {data.map((d, i) => {
          const date = parseLocalDate(d.date);
          const day = days[date.getDay()];
          const barH = Math.max((d.foodKcal / maxVal) * 100, 4);
          const burnH = Math.max((d.burnedKcal / maxVal) * 100, 4);
          return (
            <View key={i} style={chartStyles.barCol}>
              <View style={chartStyles.barGroup}>
                <View style={[chartStyles.bar, { height: barH, backgroundColor: COLORS.primary }]} />
                <View style={[chartStyles.bar, { height: burnH, backgroundColor: COLORS.secondary, marginLeft: 2 }]} />
              </View>
              <Text style={chartStyles.dayLabel}>{day}</Text>
              <Text style={chartStyles.kcalLabel}>{d.foodKcal}</Text>
            </View>
          );
        })}
      </View>
      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: COLORS.primary }]} />
          <Text style={chartStyles.legendText}>섭취</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: COLORS.secondary }]} />
          <Text style={chartStyles.legendText}>소모</Text>
        </View>
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { marginTop: 8 },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 120 },
  barCol: { flex: 1, alignItems: 'center' },
  barGroup: { flexDirection: 'row', alignItems: 'flex-end' },
  bar: { width: 10, borderRadius: 4 },
  dayLabel: { fontSize: 10, color: '#78909C', marginTop: 4 },
  kcalLabel: { fontSize: 9, color: '#B0BEC5' },
  legend: { flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#78909C' },
});

// ─── HomeScreen ───────────────────────────────────────────────────────────────
// ─── BMI 헬퍼 ────────────────────────────────────────────────────────────────
function getBmiInfo(bmi: number) {
  if (bmi < 18.5) return { label: '저체중', color: '#4FC3F7' };
  if (bmi < 23)   return { label: '정상', color: COLORS.success };
  if (bmi < 25)   return { label: '과체중', color: COLORS.warning };
  return           { label: '비만', color: COLORS.primary };
}

export default function HomeScreen({ navigation }: any) {
  const { logout, goalKcal, userWeightKg, userHeightCm } = useAuth();
  const GOAL_KCAL = goalKcal && goalKcal > 0 ? goalKcal : 2000;
  const { isPremium, purchasePremium } = useSubscription();
  const { status: cheatStatus } = useCheatDay();
  const { checkLowCalorie, scheduleMotivation } = useWarningNotifications();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [totalKcal, setTotalKcal] = useState(0);
  const [burnedKcal, setBurnedKcal] = useState(0);
  const [waterMl, setWaterMl] = useState(0);
  const [weeklyData, setWeeklyData] = useState<WeeklyStat[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [scanVisible, setScanVisible] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  // D-day 캐시 읽기
  useEffect(() => {
    AsyncStorage.getItem('@weight_prediction_days').then(v => {
      if (v) setDaysLeft(parseInt(v, 10));
    });
  }, []);

  // BMI 계산
  const bmi = userWeightKg && userHeightCm
    ? parseFloat((userWeightKg / ((userHeightCm / 100) ** 2)).toFixed(1))
    : null;


  const fetchData = useCallback(async () => {
    setFetchError(false);
    try {
      const today = localDateStr();
      const [mealRes, workoutRes, weeklyRes, waterRes] = await Promise.allSettled([
        getMealsByDate(today),
        getWorkoutsByDate(today),
        getWeeklyStats(),
        getTodayWater(),
      ]);

      const allFailed = [mealRes, workoutRes, weeklyRes, waterRes].every(r => r.status === 'rejected');
      if (allFailed) {
        setFetchError(true);
        return;
      }

      if (mealRes.status === 'fulfilled') {
        const mealList: Meal[] = mealRes.value.data || [];
        setMeals(mealList);
        setTotalKcal(mealList.reduce((s: number, m: Meal) => s + m.totalKcal, 0));
      }
      if (workoutRes.status === 'fulfilled') {
        const workoutList: Workout[] = workoutRes.value.data || [];
        setWorkouts(workoutList);
        setBurnedKcal(workoutList.reduce((s: number, w: Workout) => s + w.kcalBurned, 0));
      }
      if (weeklyRes.status === 'fulfilled') {
        setWeeklyData(weeklyRes.value.data || []);
      }
      if (waterRes.status === 'fulfilled') {
        setWaterMl(waterRes.value.data?.totalMl || 0);
      }
    } catch (e: any) {
      setFetchError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData().finally(() => {
        setLoading(false);
        // 경고 알림: 저열량(14시 이후 조건) + 동기부여(15시 예약, 1회/일)
        checkLowCalorie(totalKcal, GOAL_KCAL);
        scheduleMotivation();
      });
    }, [fetchData, totalKcal, GOAL_KCAL, checkLowCalorie, scheduleMotivation])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const netKcal = totalKcal - burnedKcal;
  const remaining = GOAL_KCAL - netKcal;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>안녕하세요! 👋</Text>
          <Text style={styles.date}>{`${new Date().getMonth() + 1}월 ${new Date().getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()]}요일`}</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('More', { screen: 'Profile' })}
        >
          <Text style={styles.logoutBtn}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* 네트워크 오류 배너 */}
      {fetchError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠️ 데이터를 불러오지 못했습니다</Text>
          <TouchableOpacity onPress={fetchData}>
            <Text style={styles.errorBannerRetry}>재시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 과식 경고 - 프리미엄 전용 */}
      {isPremium && totalKcal > GOAL_KCAL * 1.1 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>⚠️ 오늘 목표보다 {totalKcal - GOAL_KCAL}kcal 초과했어요!</Text>
          <Text style={styles.warningDesc}>가벼운 운동으로 소모해보는 건 어떨까요?</Text>
        </View>
      )}

      {/* AI 스캔 배너 */}
      <TouchableOpacity style={styles.aiBanner} onPress={() => setScanVisible(true)} activeOpacity={0.85}>
        <View style={{ flex: 1, flexShrink: 1, marginRight: 8 }}>
          <Text style={styles.aiBannerTitle} numberOfLines={1}>🤖 AI 칼로리 스캔</Text>
          <Text style={styles.aiBannerDesc} numberOfLines={1}>사진 or 텍스트로 칼로리 자동 계산</Text>
        </View>
        <View style={styles.aiBannerBtn}>
          <Text style={styles.aiBannerBtnText}>스캔하기</Text>
        </View>
      </TouchableOpacity>

      {/* Calorie Ring */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>오늘의 칼로리</Text>
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <CircularProgress value={netKcal} max={GOAL_KCAL} />
        </View>
        <View style={styles.kcalRow}>
          <View style={styles.kcalItem}>
            <Text style={[styles.kcalNum, { color: COLORS.primary }]}>{totalKcal}</Text>
            <Text style={styles.kcalLabel}>섭취</Text>
          </View>
          <View style={styles.kcalDivider} />
          <View style={styles.kcalItem}>
            <Text style={[styles.kcalNum, { color: COLORS.secondary }]}>{burnedKcal}</Text>
            <Text style={styles.kcalLabel}>소모</Text>
          </View>
          <View style={styles.kcalDivider} />
          <View style={styles.kcalItem}>
            <Text style={[styles.kcalNum, { color: remaining >= 0 ? COLORS.success : COLORS.primary }]}>
              {remaining >= 0 ? remaining : `-${Math.abs(remaining)}`}
            </Text>
            <Text style={styles.kcalLabel}>{remaining >= 0 ? '남은 목표' : '초과'}</Text>
          </View>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <TouchableOpacity style={[styles.summaryCard, { borderLeftColor: COLORS.primary }]} onPress={() => navigation.navigate('Meal')}>
          <Text style={styles.summaryEmoji}>🍽️</Text>
          <Text style={styles.summaryNum}>{meals.length}</Text>
          <Text style={styles.summaryLabel}>식사 기록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.summaryCard, { borderLeftColor: COLORS.secondary }]} onPress={() => navigation.navigate('Workout')}>
          <Text style={styles.summaryEmoji}>💪</Text>
          <Text style={styles.summaryNum}>{workouts.length}</Text>
          <Text style={styles.summaryLabel}>운동 기록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.summaryCard, { borderLeftColor: '#4FC3F7' }]} onPress={() => navigation.navigate('More', { screen: 'Water' })}>
          <Text style={styles.summaryEmoji}>💧</Text>
          <Text style={styles.summaryNum}>{(waterMl / 1000).toFixed(1)}L</Text>
          <Text style={styles.summaryLabel}>물 섭취</Text>
        </TouchableOpacity>
      </View>

      {/* ─── 프리미엄 인사이트 ─────────────────────────────────────── */}
      {isPremium ? (
        <View style={styles.insightRow}>
          {/* D-day → 체중 목표 화면 */}
          <TouchableOpacity
            style={[styles.insightCard, { borderTopColor: '#9C88FF' }]}
            onPress={() => navigation.navigate('More', { screen: 'Weight' })}
            activeOpacity={0.75}
          >
            <Text style={styles.insightEmoji}>⚖️</Text>
            <Text style={[styles.insightNum, { color: '#9C88FF' }]}>
              {daysLeft && daysLeft > 0 ? `D-${daysLeft}` : '—'}
            </Text>
            <Text style={styles.insightLabel}>목표 달성</Text>
          </TouchableOpacity>

          {/* 치팅데이 코인 → 치팅데이 화면 */}
          <TouchableOpacity
            style={[styles.insightCard, { borderTopColor: COLORS.warning }]}
            onPress={() => navigation.navigate('More', { screen: 'CheatDay' })}
            activeOpacity={0.75}
          >
            <Text style={styles.insightEmoji}>🪙</Text>
            <Text style={[styles.insightNum, { color: COLORS.warning }]}>
              {cheatStatus.cheatCoins}개
            </Text>
            <Text style={styles.insightLabel}>코인 보유</Text>
          </TouchableOpacity>

          {/* BMI → 프로필 화면 */}
          <TouchableOpacity
            style={[styles.insightCard, { borderTopColor: bmi ? getBmiInfo(bmi).color : '#B0BEC5' }]}
            onPress={() => navigation.navigate('More', { screen: 'Profile' })}
            activeOpacity={0.75}
          >
            <Text style={styles.insightEmoji}>📊</Text>
            <Text style={[styles.insightNum, { color: bmi ? getBmiInfo(bmi).color : '#B0BEC5' }]}>
              {bmi ?? '—'}
            </Text>
            <Text style={styles.insightLabel}>{bmi ? getBmiInfo(bmi).label : 'BMI'}</Text>
          </TouchableOpacity>

          {/* 연속 기록 → 치팅데이 화면 */}
          <TouchableOpacity
            style={[styles.insightCard, { borderTopColor: COLORS.success }]}
            onPress={() => navigation.navigate('More', { screen: 'CheatDay' })}
            activeOpacity={0.75}
          >
            <Text style={styles.insightEmoji}>🔥</Text>
            <Text style={[styles.insightNum, { color: COLORS.success }]}>
              {cheatStatus.streakCount}일
            </Text>
            <Text style={styles.insightLabel}>연속 달성</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* 비프리미엄: 잠금 카드 (탭 → 즉시 해제) */
        <TouchableOpacity
          style={styles.insightLock}
          onPress={purchasePremium}
          activeOpacity={0.85}
        >
          <View style={styles.insightLockLeft}>
            <Text style={styles.insightLockTitle}>👑 프리미엄 인사이트</Text>
            <Text style={styles.insightLockDesc}>목표 달성 D-day · 치팅데이 코인 · BMI · 연속 달성</Text>
            <Text style={styles.insightLockCta}>탭하면 지금 바로 체험 →</Text>
          </View>
          <View style={styles.insightLockMini}>
            <Text style={styles.insightLockMiniItem}>⚖️ D-?</Text>
            <Text style={styles.insightLockMiniItem}>🪙 ?개</Text>
            <Text style={styles.insightLockMiniItem}>📊 BMI ?</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Weekly Chart */}
      <View style={styles.card}>
        <WeeklyChart data={weeklyData} />
      </View>

      {/* 빠른 메뉴 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>빠른 메뉴</Text>
        <View style={styles.quickGrid}>
          {[
            { emoji: '📷', label: 'AI 스캔', onPress: () => setScanVisible(true), color: COLORS.primary },
            { emoji: '🍽️', label: '식사 기록', onPress: () => navigation.navigate('Meal'), color: '#FCC419' },
            { emoji: '💪', label: '운동 기록', onPress: () => navigation.navigate('Workout'), color: COLORS.secondary },
            { emoji: '⚖️', label: '체중 기록', onPress: () => navigation.navigate('More', { screen: 'Weight' }), color: '#9C88FF' },
            { emoji: '💧', label: '물 섭취', onPress: () => navigation.navigate('More', { screen: 'Water' }), color: '#4FC3F7' },
            { emoji: '🌸', label: '생리주기', onPress: () => navigation.navigate('More', { screen: 'Cycle' }), color: '#FF8FAB' },
            { emoji: '👤', label: '프로필', onPress: () => navigation.navigate('More', { screen: 'Profile' }), color: '#78909C' },
            { emoji: '📊', label: '더보기', onPress: () => navigation.navigate('More'), color: '#51CF66' },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.quickBtn, { borderColor: item.color + '40' }]}
              onPress={item.onPress}
            >
              <View style={[styles.quickIconBg, { backgroundColor: item.color + '20' }]}>
                <Text style={styles.quickEmoji}>{item.emoji}</Text>
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>

    <AiScanModal
      visible={scanVisible}
      onClose={() => setScanVisible(false)}
      onSaved={() => { setScanVisible(false); fetchData(); }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  date: { fontSize: 13, color: '#78909C', marginTop: 2 },
  logoutBtn: { fontSize: 24 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  kcalRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  kcalItem: { alignItems: 'center' },
  kcalNum: { fontSize: 22, fontWeight: '800' },
  kcalLabel: { fontSize: 11, color: '#78909C', marginTop: 2 },
  kcalDivider: { width: 1, backgroundColor: '#E8EDF2', marginHorizontal: 8 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryEmoji: { fontSize: 24 },
  summaryNum: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  summaryLabel: { fontSize: 10, color: '#78909C', marginTop: 2 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  quickBtn: {
    width: '22%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  quickIconBg: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  quickEmoji: { fontSize: 22 },
  quickLabel: { fontSize: 10, color: COLORS.text, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    borderRadius: 20, padding: 20, marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  aiBannerTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  aiBannerDesc: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  aiBannerBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8,
  },
  aiBannerBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  errorBanner: {
    backgroundColor: '#FFF3E0', borderRadius: 12, padding: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 3, borderLeftColor: '#FF9800',
  },
  errorBannerText: { fontSize: 13, color: '#E65100', fontWeight: '600' },
  errorBannerRetry: { fontSize: 13, color: '#FF9800', fontWeight: '700' },
  warningBanner: {
    backgroundColor: '#FFF3E0', borderRadius: 16, padding: 14, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: '#FF9800',
  },
  warningText: { fontSize: 14, fontWeight: '700', color: '#E65100' },
  warningDesc: { fontSize: 12, color: '#78909C', marginTop: 3 },
  // ── 프리미엄 인사이트 ──────────────────────────────────────────────
  insightRow: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  insightCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  insightEmoji: { fontSize: 20, marginBottom: 4 },
  insightNum: { fontSize: 15, fontWeight: '800' },
  insightLabel: { fontSize: 9, color: '#78909C', marginTop: 2, fontWeight: '600' },
  insightLock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    gap: 12,
  },
  insightLockLeft: { flex: 1 },
  insightLockTitle: { fontSize: 14, fontWeight: '800', color: '#FFD700' },
  insightLockDesc: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3, lineHeight: 15 },
  insightLockCta: { fontSize: 11, color: '#FFD700', fontWeight: '700', marginTop: 6 },
  insightLockMini: { alignItems: 'flex-end', gap: 4 },
  insightLockMiniItem: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
});
