import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useArchive } from '../hooks/useArchive';
import { ArchiveEntry } from '../types/archive';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMealsByDate, getWorkoutsByDate, getTodayWater } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { useWarningNotifications } from '../hooks/useWarningNotifications';
import { useCheatDay } from '../context/CheatDayContext';
import AiScanModal from '../components/AiScanModal';
import PremiumModal from '../components/PremiumModal';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../theme';
import { localDateStr, parseLocalDate } from '../utils/dateUtils';
import Icon from '../components/Icon';
import PressableScale from '../components/PressableScale';
import BadgeGrid from '../components/BadgeGrid';
import BadgeUnlockedModal from '../components/BadgeUnlockedModal';
import { Badge } from '../data/badges';
import { refreshBadges, getUnlockedIds } from '../services/badgeService';

interface WeeklyStat {
  date?: string;
  logDate?: string;
  foodKcal?: number;
  totalKcal?: number;
  burnedKcal?: number;
  kcalBurned?: number;
  netKcal?: number;
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
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#F0E1EC" strokeWidth={strokeWidth} />
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
        <Text style={{ fontSize: 14, color: '#8A7C9C', fontWeight: '500' }}>kcal</Text>
        <Text style={{ fontSize: 13, color: '#D4C5DC', marginTop: 2 }}>목표 {max}</Text>
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
          <Text style={{ fontSize: 15, color: '#D4C5DC' }}>아직 이번 주 기록이 없어요</Text>
        </View>
      </View>
    );
  }
  const normalized = data.map(d => ({
    date: d.date ?? d.logDate ?? '',
    foodKcal: d.foodKcal ?? d.totalKcal ?? 0,
    burnedKcal: d.burnedKcal ?? d.kcalBurned ?? 0,
  }));
  const maxVal = Math.max(...normalized.map((d) => Math.max(d.foodKcal, d.burnedKcal)), 1);
  const days = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.title}>주간 칼로리</Text>
      <View style={chartStyles.bars}>
        {normalized.map((d, i) => {
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
              <Text style={chartStyles.kcalLabel}>{d.foodKcal > 0 ? d.foodKcal : ''}</Text>
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
  title: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 120 },
  barCol: { flex: 1, alignItems: 'center' },
  barGroup: { flexDirection: 'row', alignItems: 'flex-end' },
  bar: { width: 10, borderRadius: 12 },
  dayLabel: { fontSize: 12, color: '#8A7C9C', marginTop: 4 },
  kcalLabel: { fontSize: 9, color: '#D4C5DC' },
  legend: { flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 12 },
  legendText: { fontSize: 13, color: '#8A7C9C' },
});

// ─── HomeScreen ───────────────────────────────────────────────────────────────
// ─── BMI 헬퍼 ────────────────────────────────────────────────────────────────
function getBmiInfo(bmi: number) {
  if (bmi < 18.5) return { label: '저체중', color: '#B5D8F5' };
  if (bmi < 23)   return { label: '정상', color: COLORS.success };
  if (bmi < 25)   return { label: '과체중', color: COLORS.warning };
  return           { label: '비만', color: COLORS.primary };
}

const ARCHIVE_CAT_COLORS: Record<string, string> = {
  '식단':  '#A98ED1',
  '오운완': '#A8D8B9',
  '술자리': '#A98ED1',
  '일상':  '#F5C99B',
};

export default function HomeScreen({ navigation }: any) {
  const { logout, goalKcal, userWeightKg, userHeightCm } = useAuth();
  const { reload: reloadArchive, getEntries, syncFromServer } = useArchive();
  const GOAL_KCAL = goalKcal && goalKcal > 0 ? goalKcal : 2000;
  const { isPremium } = useSubscription();
  const [premiumVisible, setPremiumVisible] = useState(false);
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

  // 뱃지 상태
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [points, setPoints] = useState(0);
  const [newBadges, setNewBadges] = useState<Badge[]>([]);
  const [stepsToday, setStepsToday] = useState(0);

  // 서버 → 로컬 사진 동기화 (재설치/타기기 로그인 후 사진 복원)
  useEffect(() => {
    syncFromServer(3).catch(() => {});
  }, [syncFromServer]);

  // D-day 캐시 읽기
  useEffect(() => {
    AsyncStorage.getItem('@weight_prediction_days').then(v => {
      if (v) setDaysLeft(parseInt(v, 10));
    });
  }, []);

  // 마운트 시 획득 뱃지 초기 로드
  useEffect(() => {
    getUnlockedIds().then(setUnlockedIds).catch(() => {});
  }, []);


  // BMI 계산
  const bmi = userWeightKg && userHeightCm
    ? parseFloat((userWeightKg / ((userHeightCm / 100) ** 2)).toFixed(1))
    : null;


  const fetchData = useCallback(async () => {
    setFetchError(false);
    try {
      const today = localDateStr();

      // 이번 주 7일(일~토) 날짜 생성
      const todayDate = new Date();
      const dow = todayDate.getDay(); // 0=일
      const weekDates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(todayDate);
        d.setDate(todayDate.getDate() - dow + i);
        weekDates.push(localDateStr(d));
      }

      // 7일 각각 식사·운동 직접 fetch + 오늘 water → 백엔드 weekly endpoint 의존 제거 (timezone/집계 이슈 영구 우회)
      const weekRequests = weekDates.flatMap(d => [getMealsByDate(d), getWorkoutsByDate(d)]);
      const settled = await Promise.allSettled([...weekRequests, getTodayWater()]);
      const waterRes = settled[settled.length - 1];
      const dayResults = settled.slice(0, -1);

      const allFailed = dayResults.every(r => r.status === 'rejected');
      if (allFailed) {
        setFetchError(true);
        return;
      }

      const todayIdx = weekDates.indexOf(today);
      let todayFood = 0;
      let todayBurn = 0;
      let todayMealList: any[] = [];
      let todayWorkoutList: any[] = [];

      const filled: WeeklyStat[] = weekDates.map((dateStr, i) => {
        const mealRes = dayResults[i * 2];
        const workoutRes = dayResults[i * 2 + 1];
        let foodKcal = 0;
        let burnedKcal = 0;
        let mealList: any[] = [];
        let workoutList: any[] = [];
        if (mealRes.status === 'fulfilled') {
          mealList = mealRes.value.data || [];
          foodKcal = mealList.reduce((s: number, m: any) => s + (m.totalKcal || 0), 0);
        }
        if (workoutRes.status === 'fulfilled') {
          workoutList = workoutRes.value.data || [];
          burnedKcal = workoutList.reduce((s: number, w: any) => s + (w.kcalBurned || 0), 0);
        }
        if (i === todayIdx) {
          setMeals(mealList as Meal[]);
          setWorkouts(workoutList as Workout[]);
          todayMealList = mealList;
          todayWorkoutList = workoutList;
          todayFood = foodKcal;
          todayBurn = burnedKcal;
        }
        return { date: dateStr, foodKcal, burnedKcal };
      });

      setTotalKcal(todayFood);
      setBurnedKcal(todayBurn);
      setWeeklyData(filled);
      const waterMlNow = waterRes.status === 'fulfilled' ? (waterRes.value.data?.totalMl || 0) : 0;
      if (waterRes.status === 'fulfilled') {
        setWaterMl(waterMlNow);
      }

      // 뱃지 평가 — 새 뱃지 있으면 popup
      // (archiveCount/meals/workouts state 의존성 제거: state ref가 deps에 들어가면 fetchData가 매 렌더마다 새로 생성되어 useFocusEffect 무한 루프)
      try {
        const result = await refreshBadges({
          totalMeals: todayMealList.length,
          totalWorkouts: todayWorkoutList.length,
          totalScans: 0,
          totalArchives: 0,
          totalWeightLogs: 0,
          totalFriends: 0,
          stepsToday,
          waterCupsToday: Math.floor(waterMlNow / 250),
          goalAchievedToday: todayFood >= GOAL_KCAL && GOAL_KCAL > 0,
          todayStr: today,
        });
        setUnlockedIds(result.allUnlocked);
        setPoints(result.points);
        if (result.newlyUnlocked.length > 0) {
          setNewBadges(result.newlyUnlocked);
        }
      } catch {}
    } catch (e: any) {
      setFetchError(true);
    }
  }, [stepsToday, GOAL_KCAL]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      reloadArchive();
      fetchData().finally(() => setLoading(false));
    }, [fetchData, reloadArchive])
  );

  // 데이터 로드 끝나면 경고/동기부여 알림 처리 (focus effect deps에 totalKcal 넣으면 무한 루프)
  useEffect(() => {
    if (loading) return;
    checkLowCalorie(totalKcal, GOAL_KCAL);
    scheduleMotivation();
  }, [loading, totalKcal, GOAL_KCAL, checkLowCalorie, scheduleMotivation]);

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
          <Text style={styles.greeting}>안녕하세요</Text>
          <Text style={styles.date}>{`${new Date().getMonth() + 1}월 ${new Date().getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()]}요일`}</Text>
        </View>
        <PressableScale
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('More', { screen: 'Profile' })}
        >
          <Icon name="gear" size={22} color={COLORS.subText} />
        </PressableScale>
      </View>

      {/* 네트워크 오류 배너 */}
      {fetchError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>데이터를 불러오지 못했습니다</Text>
          <TouchableOpacity onPress={fetchData}>
            <Text style={styles.errorBannerRetry}>재시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 과식 경고 - 프리미엄 전용 */}
      {isPremium && totalKcal > GOAL_KCAL * 1.1 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>오늘 목표보다 {totalKcal - GOAL_KCAL}kcal 초과했어요</Text>
          <Text style={styles.warningDesc}>가벼운 운동으로 소모해보는 건 어떨까요?</Text>
        </View>
      )}

      {/* AI 스캔 배너 */}
      <PressableScale style={styles.aiBanner} onPress={() => setScanVisible(true)}>
        <View style={{ flex: 1, flexShrink: 1, marginRight: 8 }}>
          <Text style={styles.aiBannerTitle} numberOfLines={1}>AI 칼로리 스캔</Text>
          <Text style={styles.aiBannerDesc} numberOfLines={1}>사진 or 텍스트로 칼로리 자동 계산</Text>
        </View>
        <View style={styles.aiBannerBtn}>
          <Icon name="camera" size={14} color="#fff" />
          <Text style={styles.aiBannerBtnText}>스캔하기</Text>
        </View>
      </PressableScale>

      {/* Calorie Ring */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>오늘의 칼로리</Text>
        <View style={{ alignItems: 'center', paddingVertical: 15 }}>
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

      {/* 캘린더 아카이브 빠른 접근 */}
      {(() => {
        const recentEntries = [...getEntries()]
          .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
          .slice(0, 8);
        return (
          <View style={styles.archiveSection}>
            <View style={styles.archiveHeader}>
              <Text style={styles.archiveTitle}>캘린더 아카이브</Text>
              <TouchableOpacity onPress={() => navigation.navigate('More', { screen: 'CalendarArchive' })}>
                <Text style={styles.archiveMore}>전체보기</Text>
              </TouchableOpacity>
            </View>
            {recentEntries.length === 0 ? (
              <Text style={styles.archiveEmpty}>아직 기록이 없어요</Text>
            ) : (
              <FlatList
                data={recentEntries}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingVertical: 4 }}
                renderItem={({ item }: { item: ArchiveEntry }) => (
                  <TouchableOpacity
                    style={styles.archiveItem}
                    onPress={() => navigation.navigate('More', {
                      screen: 'CalendarArchive',
                      params: { initialDate: item.date },
                    })}
                    activeOpacity={0.8}
                  >
                    {item.photos[0] ? (
                      <Image source={{ uri: item.photos[0] }} style={styles.archiveThumb} />
                    ) : (
                      <View style={[styles.archiveThumb, styles.archiveThumbEmpty, { backgroundColor: ARCHIVE_CAT_COLORS[item.category] ?? '#999' }]}>
                        <Text style={{ fontSize: 14, color: '#fff', fontWeight: '700' }}>
                          {item.category}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.archiveDot, { backgroundColor: ARCHIVE_CAT_COLORS[item.category] ?? '#999' }]} />
                    <Text style={styles.archiveDate}>{item.date.slice(5)}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        );
      })()}

      {/* 뱃지 미리보기 */}
      <BadgeGrid unlockedIds={unlockedIds} points={points} compact />

      {/* 친구 피드 바로가기 */}
      <PressableScale
        style={styles.friendFeedBanner}
        onPress={() => navigation.navigate('More', { screen: 'FriendFeed' })}
      >
        <View style={styles.friendFeedLeft}>
          <Text style={styles.friendFeedTitle}>친구 피드</Text>
          <Text style={styles.friendFeedDesc}>오늘 기록한 친구들 · 응원 · 베스트 식단</Text>
        </View>
        <View style={styles.friendFeedBtn}>
          <Icon name="users" size={12} color="#fff" />
          <Text style={styles.friendFeedBtnText}>보러가기</Text>
        </View>
      </PressableScale>

      {/* 냉장고 비우기 (AI 메뉴 추천) */}
      <PressableScale
        style={styles.fridgeBanner}
        onPress={() => navigation.navigate('More', { screen: 'FridgeClean' })}
      >
        <View style={styles.fridgeIconWrap}>
          <Icon name="fridge" size={28} color={COLORS.water} />
        </View>
        <View style={styles.fridgeLeft}>
          <Text style={styles.fridgeTitle}>냉장고 비우기</Text>
          <Text style={styles.fridgeDesc}>가진 재료로 AI가 다이어트 메뉴 추천</Text>
        </View>
        <View style={styles.fridgeBtn}>
          <Icon name="sparkles" size={11} color="#fff" />
          <Text style={styles.fridgeBtnText}>시작</Text>
        </View>
      </PressableScale>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <PressableScale style={[styles.summaryCard, { borderLeftColor: COLORS.primary }]} onPress={() => navigation.navigate('Meal')}>
          <Text style={styles.summaryLabel} numberOfLines={1}>식사 기록</Text>
          <Text style={styles.summaryNum} numberOfLines={1} adjustsFontSizeToFit>{meals.length}</Text>
        </PressableScale>
        <PressableScale style={[styles.summaryCard, { borderLeftColor: COLORS.secondary }]} onPress={() => navigation.navigate('Workout')}>
          <Text style={styles.summaryLabel} numberOfLines={1}>운동 기록</Text>
          <Text style={styles.summaryNum} numberOfLines={1} adjustsFontSizeToFit>{workouts.length}</Text>
        </PressableScale>
        <PressableScale style={[styles.summaryCard, { borderLeftColor: COLORS.water }]} onPress={() => navigation.navigate('More', { screen: 'Water' })}>
          <Text style={styles.summaryLabel} numberOfLines={1}>물 섭취</Text>
          <Text style={styles.summaryNum} numberOfLines={1} adjustsFontSizeToFit>{(waterMl / 1000).toFixed(1)}L</Text>
        </PressableScale>
      </View>

      {/* ─── 프리미엄 인사이트 ─────────────────────────────────────── */}
      {isPremium ? (
        <View style={styles.insightRow}>
          <PressableScale
            style={[styles.insightCard, { borderTopColor: COLORS.purpleDark }]}
            onPress={() => navigation.navigate('More', { screen: 'Weight' })}
          >
            <Text style={[styles.insightNum, { color: COLORS.purpleDark }]} numberOfLines={1} adjustsFontSizeToFit>
              {daysLeft && daysLeft > 0 ? `D-${daysLeft}` : '—'}
            </Text>
            <Text style={styles.insightLabel} numberOfLines={1}>목표 달성</Text>
          </PressableScale>

          <PressableScale
            style={[styles.insightCard, { borderTopColor: COLORS.warning }]}
            onPress={() => navigation.navigate('More', { screen: 'CheatDay' })}
          >
            <Text style={[styles.insightNum, { color: COLORS.warning }]} numberOfLines={1} adjustsFontSizeToFit>
              {cheatStatus.cheatCoins}개
            </Text>
            <Text style={styles.insightLabel} numberOfLines={1}>코인 보유</Text>
          </PressableScale>

          <PressableScale
            style={[styles.insightCard, { borderTopColor: bmi ? getBmiInfo(bmi).color : COLORS.inactive }]}
            onPress={() => navigation.navigate('More', { screen: 'Profile' })}
          >
            <Text style={[styles.insightNum, { color: bmi ? getBmiInfo(bmi).color : COLORS.inactive }]} numberOfLines={1} adjustsFontSizeToFit>
              {bmi ?? '—'}
            </Text>
            <Text style={styles.insightLabel} numberOfLines={1}>{bmi ? getBmiInfo(bmi).label : 'BMI'}</Text>
          </PressableScale>

          <PressableScale
            style={[styles.insightCard, { borderTopColor: COLORS.success }]}
            onPress={() => navigation.navigate('More', { screen: 'CheatDay' })}
          >
            <Text style={[styles.insightNum, { color: COLORS.success }]} numberOfLines={1} adjustsFontSizeToFit>
              {cheatStatus.streakCount}일
            </Text>
            <Text style={styles.insightLabel} numberOfLines={1}>연속 달성</Text>
          </PressableScale>
        </View>
      ) : (
        <PressableScale
          style={styles.insightLock}
          onPress={() => setPremiumVisible(true)}
        >
          <View style={styles.insightLockLeft}>
            <Text style={styles.insightLockTitle}>프리미엄 인사이트</Text>
            <Text style={styles.insightLockDesc}>목표 달성 D-day · 치팅데이 코인 · BMI · 연속 달성</Text>
            <Text style={styles.insightLockCta}>탭하면 지금 바로 체험</Text>
          </View>
          <View style={styles.insightLockMini}>
            <Icon name="crown" size={18} color={COLORS.warning} />
          </View>
        </PressableScale>
      )}

      {/* Weekly Chart */}
      <View style={styles.card}>
        <WeeklyChart data={weeklyData} />
      </View>

      {/* 빠른 메뉴 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>빠른 메뉴</Text>
        <View style={styles.quickGrid}>
          {([
            { label: 'AI 스캔', icon: 'camera', onPress: () => setScanVisible(true), color: COLORS.primary },
            { label: '식사', icon: 'meal', onPress: () => navigation.navigate('Meal'), color: COLORS.warning },
            { label: '운동', icon: 'workout', onPress: () => navigation.navigate('Workout'), color: COLORS.secondary },
            { label: '체중', icon: 'weight', onPress: () => navigation.navigate('More', { screen: 'Weight' }), color: COLORS.purpleDark },
            { label: '물 섭취', icon: 'water', onPress: () => navigation.navigate('More', { screen: 'Water' }), color: COLORS.water },
            { label: '생리주기', icon: 'heart', onPress: () => navigation.navigate('More', { screen: 'Cycle' }), color: COLORS.pink },
            { label: '프로필', icon: 'user', onPress: () => navigation.navigate('More', { screen: 'Profile' }), color: COLORS.subText },
            { label: '더보기', icon: 'more', onPress: () => navigation.navigate('More'), color: COLORS.success },
          ] as const).map((item) => (
            <PressableScale
              key={item.label}
              style={[styles.quickBtn, { borderColor: item.color + '40' }]}
              onPress={item.onPress}
            >
              <View style={[styles.quickIconBg, { backgroundColor: item.color + '20' }]}>
                <Icon name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1} adjustsFontSizeToFit>{item.label}</Text>
            </PressableScale>
          ))}
        </View>
      </View>
    </ScrollView>

    <AiScanModal
      visible={scanVisible}
      onClose={() => setScanVisible(false)}
      onSaved={() => { setScanVisible(false); fetchData(); }}
    />
    <PremiumModal
      visible={premiumVisible}
      onClose={() => setPremiumVisible(false)}
    />
    <BadgeUnlockedModal
      badges={newBadges}
      onClose={() => setNewBadges([])}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 72 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  date: { fontSize: 15, color: COLORS.subText, marginTop: 2 },
  logoutBtn: { fontSize: 24 },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: COLORS.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  kcalRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  kcalItem: { alignItems: 'center' },
  kcalNum: { fontSize: 22, fontWeight: '800' },
  kcalLabel: { fontSize: 13, color: '#8A7C9C', marginTop: 2 },
  kcalDivider: { width: 1, backgroundColor: '#F0E1EC', marginHorizontal: 8 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryEmoji: { fontSize: 24 },
  summaryNum: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 6 },
  summaryLabel: { fontSize: 14, color: COLORS.subText, fontWeight: '700', textAlign: 'center' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'space-between' },
  quickBtn: {
    width: '23%',
    backgroundColor: COLORS.cardSoft,
    borderRadius: 20,
    paddingVertical: 17,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  quickIconBg: {
    width: 40, height: 40, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  quickEmoji: { fontSize: 22 },
  quickLabel: { fontSize: 13, color: COLORS.text, fontWeight: '700', textAlign: 'center', width: '100%' },
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    borderRadius: 28, padding: 20, marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  aiBannerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  aiBannerDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  aiBannerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12,
  },
  aiBannerBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorBanner: {
    backgroundColor: '#FFE8EF', borderRadius: 20, padding: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 3, borderLeftColor: '#F5C99B',
  },
  errorBannerText: { fontSize: 15, color: '#A98ED1', fontWeight: '600' },
  errorBannerRetry: { fontSize: 15, color: '#F5C99B', fontWeight: '700' },
  warningBanner: {
    backgroundColor: '#FFE8EF', borderRadius: 24, padding: 14, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: '#F5C99B',
  },
  warningText: { fontSize: 16, fontWeight: '700', color: '#A98ED1' },
  warningDesc: { fontSize: 14, color: '#8A7C9C', marginTop: 3 },
  // ── 프리미엄 인사이트 ──────────────────────────────────────────────
  insightRow: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  insightCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.card,
    borderRadius: 22,
    paddingVertical: 17,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  insightEmoji: { fontSize: 20, marginBottom: 4 },
  insightNum: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  insightLabel: { fontSize: 13, color: COLORS.subText, marginTop: 4, fontWeight: '700', textAlign: 'center' },
  insightLock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lavender,
    borderRadius: 26,
    padding: 18,
    marginBottom: 16,
    gap: 12,
  },
  insightLockLeft: { flex: 1 },
  insightLockTitle: { fontSize: 16, fontWeight: '800', color: COLORS.purpleDark },
  insightLockDesc: { fontSize: 13, color: COLORS.subText, marginTop: 3, lineHeight: 15 },
  insightLockCta: { fontSize: 13, color: COLORS.primaryDark, fontWeight: '700', marginTop: 6 },
  insightLockMini: { alignItems: 'flex-end', gap: 4 },
  insightLockMiniItem: { fontSize: 13, color: COLORS.subText, fontWeight: '600' },
  // ── 캘린더 아카이브 섹션 ───────────────────────────────────────
  archiveSection: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  archiveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  archiveTitle:  { fontSize: 17, fontWeight: '700', color: COLORS.text },
  archiveMore:   { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  archiveEmpty:  { fontSize: 15, color: '#D4C5DC', textAlign: 'center', paddingVertical: 16 },
  archiveItem:   { alignItems: 'center', marginRight: 12 },
  archiveThumb:  { width: 62, height: 62, borderRadius: 18, backgroundColor: '#FFF5F8' },
  archiveThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  archiveDot:    { width: 6, height: 6, borderRadius: 10, marginTop: 5 },
  archiveDate:   { fontSize: 12, color: '#8A7C9C', marginTop: 3, fontWeight: '500' },
  // ── 친구 피드 바로가기 ─────────────────────────────────────────
  friendFeedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.purple,
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
    shadowColor: COLORS.purpleDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  friendFeedLeft:    { flex: 1, marginRight: 12 },
  friendFeedTitle:   { fontSize: 17, fontWeight: '800', color: '#fff' },
  friendFeedDesc:    { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  friendFeedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.pinkSoft, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 11,
  },
  friendFeedBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.text },

  // ── 냉장고 비우기 배너 ────────────────────────────────────────────
  fridgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    shadowColor: COLORS.water,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  fridgeIconWrap: {
    width: 54, height: 54, borderRadius: 999,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.water, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  fridgeLeft: { flex: 1 },
  fridgeTitle: { fontSize: 17, fontWeight: '900', color: COLORS.text },
  fridgeDesc: { fontSize: 14, color: COLORS.subText, marginTop: 3 },
  fridgeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.water, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11,
    shadowColor: COLORS.water, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 3,
  },
  fridgeBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
