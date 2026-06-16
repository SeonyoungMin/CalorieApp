import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getWeightList, getMealsByDate, getWorkoutsByDate } from '../api/api';
import { useAuth } from '../context/AuthContext';
import PremiumModal from '../components/PremiumModal';
import { useSubscription } from '../hooks/useSubscription';
import { COLORS } from '../theme';
import CuteLoader from '../components/CuteLoader';
import { localDateStr } from '../utils/dateUtils';

interface WeeklyStat {
  date: string;
  foodKcal: number;
  burnedKcal: number;
  netKcal: number;
}

interface WeightRecord {
  weightId: number;
  weightKg: number;
  logDate: string;
  recordedAt: string;
}

const TABS = [
  { key: 'nutrients', label: '영양소' },
  { key: 'calendar', label: '캘린더' },
  { key: 'weight', label: '체중 그래프' },
];

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

export default function StatsScreen() {
  const { goalKcal: GOAL_KCAL, userWeightKg } = useAuth();
  const { isPremium } = useSubscription();
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [tab, setTab] = useState('nutrients');
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<WeeklyStat[]>([]);
  const [weightList, setWeightList] = useState<WeightRecord[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      try {
        // 7일(일~토) 날짜 생성 후 각각 식사/운동 직접 fetch.
        // 백엔드 weekly endpoint의 timezone/집계 이슈 우회 (HomeScreen과 동일 패턴).
        const todayDate = new Date();
        const dow = todayDate.getDay();
        const weekDates: string[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(todayDate);
          d.setDate(todayDate.getDate() - dow + i);
          weekDates.push(localDateStr(d));
        }
        const weekRequests = weekDates.flatMap(d => [getMealsByDate(d), getWorkoutsByDate(d)]);
        const [settled, wgRes] = await Promise.all([
          Promise.allSettled(weekRequests),
          getWeightList().catch(() => ({ data: [] })),
        ]);

        const filled: WeeklyStat[] = weekDates.map((dateStr, i) => {
          const mealRes = settled[i * 2];
          const workoutRes = settled[i * 2 + 1];
          let foodKcal = 0;
          let burnedKcal = 0;
          if (mealRes.status === 'fulfilled') {
            const mealList: any[] = mealRes.value.data || [];
            foodKcal = mealList.reduce((s: number, m: any) => s + (m.totalKcal || 0), 0);
          }
          if (workoutRes.status === 'fulfilled') {
            const workoutList: any[] = workoutRes.value.data || [];
            burnedKcal = workoutList.reduce((s: number, w: any) => s + (w.kcalBurned || 0), 0);
          }
          return { date: dateStr, foodKcal, burnedKcal, netKcal: foodKcal - burnedKcal };
        });
        setWeeklyData(filled);

        const list: WeightRecord[] = Array.isArray((wgRes as any)?.data) ? (wgRes as any).data : [];
        const sorted = list.sort(
          (a, b) => new Date(a.recordedAt || a.logDate).getTime() - new Date(b.recordedAt || b.logDate).getTime()
        );
        setWeightList(sorted);
      } catch (e) {
        console.warn('[StatsScreen] load failed', e);
      }
      setLoading(false);
    };
    load();
  }, []));

  if (loading) {
    return (
      <View style={styles.center}>
        <CuteLoader message="통계를 불러오는 중이에요..." icon="chart" />
      </View>
    );
  }

  if (!isPremium) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 64 }}></Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 16, marginBottom: 12 }}>프리미엄 전용 기능</Text>
        <Text style={{ fontSize: 16, color: '#8A7C9C', textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
          영양소 분석, 캘린더, 체중 그래프는{'\n'}프리미엄 회원만 이용 가능합니다.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: COLORS.primary, borderRadius: 26, paddingVertical: 16, paddingHorizontal: 32 }}
          onPress={() => setPremiumVisible(true)}
        >
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>프리미엄 구독하기</Text>
        </TouchableOpacity>
        <PremiumModal
          visible={premiumVisible}
          onClose={() => setPremiumVisible(false)}
        />
      </View>
    );
  }

  // 영양소 추정 (식사 데이터 기반 평균 비율 사용)
  const avgKcal = weeklyData.length > 0
    ? Math.round(weeklyData.reduce((s, d) => s + d.foodKcal, 0) / weeklyData.length)
    : 0;
  const nutrients = { carb: 55, protein: 20, fat: 25 }; // 일반적인 권장 비율 (음식별 실측 불가)

  // 캘린더 데이터
  const calendarData: Record<string, number> = {};
  weeklyData.forEach(d => { calendarData[d.date] = d.foodKcal; });

  // 체중 그래프
  const weightGoal = userWeightKg ? Math.max(userWeightKg - 5, 40) : null; // 현재체중 -5kg 목표 (설정 전)
  const maxW = weightList.length > 0 ? Math.max(...weightList.map((w) => Number(w.weightKg) || 0)) + 2 : 80;
  const minW = weightList.length > 0 ? Math.min(...weightList.map((w) => Number(w.weightKg) || 0)) - 2 : 50;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabContent}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 88 }}>

        {/* 영양소 분석 */}
        {tab === 'nutrients' && (
          <View>
            <Text style={styles.pageTitle}>영양소 분석</Text>
            <Text style={styles.pageDesc}>이번 주 평균 영양소 섭취 비율</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>이번 주 평균 섭취</Text>
              <Text style={styles.bigNum}>{avgKcal} <Text style={styles.bigNumUnit}>kcal/일</Text></Text>
              <View style={styles.progressWrap}>
                <View style={[styles.progressBar, { width: `${GOAL_KCAL > 0 ? Math.min((avgKcal / GOAL_KCAL) * 100, 100) : 0}%`, backgroundColor: avgKcal > GOAL_KCAL ? COLORS.primary : COLORS.green }]} />
              </View>
              <Text style={{ fontSize: 14, color: '#8A7C9C', marginTop: 4 }}>목표 {GOAL_KCAL}kcal 대비 {GOAL_KCAL > 0 ? Math.round((avgKcal / GOAL_KCAL) * 100) : 0}%</Text>
            </View>

            {/* 영양소 도넛 시뮬레이션 */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>영양소 비율</Text>
              <Text style={{ fontSize: 13, color: '#D4C5DC', marginBottom: 8 }}>※ 권장 비율 기준 (음식별 실측값 미지원)</Text>
              <View style={styles.nutrientVisual}>
                <View style={styles.donutWrap}>
                  {/* 간단한 세그먼트 바 */}
                  <View style={styles.segmentBar}>
                    <View style={[styles.segment, { flex: nutrients.carb, backgroundColor: COLORS.gold }]} />
                    <View style={[styles.segment, { flex: nutrients.protein, backgroundColor: COLORS.secondary }]} />
                    <View style={[styles.segment, { flex: nutrients.fat, backgroundColor: COLORS.primary }]} />
                  </View>
                </View>
                <View style={styles.legendWrap}>
                  {[
                    { label: '탄수화물', value: nutrients.carb, color: COLORS.gold, ideal: '45~65%' },
                    { label: '단백질', value: nutrients.protein, color: COLORS.secondary, ideal: '15~25%' },
                    { label: '지방', value: nutrients.fat, color: COLORS.primary, ideal: '20~35%' },
                  ].map(n => (
                    <View key={n.label} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: n.color }]} />
                      <Text style={styles.legendLabel}>{n.label}</Text>
                      <Text style={[styles.legendValue, { color: n.color }]}>{n.value}%</Text>
                      <Text style={styles.legendIdeal}>권장 {n.ideal}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* 요일별 칼로리 */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>요일별 섭취 칼로리</Text>
              <View style={styles.barChartWrap}>
                {weeklyData.length > 0 ? weeklyData.map((d, i) => {
                  const h = Math.max(GOAL_KCAL > 0 ? (d.foodKcal / GOAL_KCAL) * 100 : 4, 4);
                  const day = DAYS_KR[new Date(d.date + 'T12:00:00').getDay()];
                  return (
                    <View key={i} style={styles.barCol}>
                      <Text style={styles.barKcal}>{d.foodKcal > 0 ? d.foodKcal : ''}</Text>
                      <View style={[styles.bar, { height: h, backgroundColor: d.foodKcal > GOAL_KCAL ? COLORS.primary : COLORS.secondary }]} />
                      <Text style={styles.barDay}>{day}</Text>
                    </View>
                  );
                }) : (
                  <Text style={styles.emptyText}>이번 주 데이터가 없어요</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* 캘린더 */}
        {tab === 'calendar' && (
          <View>
            <Text style={styles.pageTitle}>월간 칼로리 캘린더</Text>

            <View style={styles.card}>
              {/* 월 선택 */}
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={() => {
                  if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
                  else setCalendarMonth(m => m - 1);
                }}>
                  <Text style={styles.navBtn}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.monthLabel}>{calendarYear}년 {calendarMonth + 1}월</Text>
                <TouchableOpacity onPress={() => {
                  if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
                  else setCalendarMonth(m => m + 1);
                }}>
                  <Text style={styles.navBtn}>›</Text>
                </TouchableOpacity>
              </View>

              {/* 요일 헤더 */}
              <View style={styles.calRow}>
                {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                  <Text key={d} style={styles.calDayHeader}>{d}</Text>
                ))}
              </View>

              {/* 날짜 그리드 */}
              <CalendarGrid year={calendarYear} month={calendarMonth} data={calendarData} goalKcal={GOAL_KCAL} />
            </View>

            {/* 범례 */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>범례</Text>
              <View style={styles.legendRow}>
                <View style={[styles.calCell, { backgroundColor: COLORS.green + '40' }]}>
                  <Text style={styles.calDateSmall}>1</Text>
                </View>
                <Text style={styles.legendLabel}>목표 달성</Text>
                <View style={[styles.calCell, { backgroundColor: COLORS.primary + '40' }]}>
                  <Text style={styles.calDateSmall}>2</Text>
                </View>
                <Text style={styles.legendLabel}>초과 섭취</Text>
                <View style={[styles.calCell, { backgroundColor: '#FFF5F8' }]}>
                  <Text style={styles.calDateSmall}>3</Text>
                </View>
                <Text style={styles.legendLabel}>기록 없음</Text>
              </View>
            </View>
          </View>
        )}

        {/* 체중 그래프 */}
        {tab === 'weight' && (
          <View>
            <Text style={styles.pageTitle}>체중 변화 그래프</Text>
            <Text style={styles.pageDesc}>목표 체중까지의 변화를 확인해요</Text>

            {weightList.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>체중 기록이 없어요{'\n'}체중 탭에서 기록을 추가해보세요!</Text>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <View style={styles.row}>
                    <InfoChip label="현재" value={`${Number(weightList[weightList.length - 1]?.weightKg) || '-'}kg`} color={COLORS.primary} />
                    <InfoChip label="최저" value={`${Math.min(...weightList.map((w) => Number(w.weightKg) || 0))}kg`} color={COLORS.green} />
                    <InfoChip label="변화" value={`${((Number(weightList[weightList.length - 1]?.weightKg) || 0) - (Number(weightList[0]?.weightKg) || 0)).toFixed(1)}kg`} color={COLORS.secondary} />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>체중 추이</Text>
                  <WeightChart data={weightList} min={minW} max={maxW} goal={weightGoal} />
                </View>

                {weightGoal !== null && (
                  <View style={[styles.card, { backgroundColor: COLORS.green + '15' }]}>
                    <Text style={styles.cardTitle}>목표 달성 예측</Text>
                    <Text style={{ fontSize: 15, color: '#455A64', marginTop: 4, lineHeight: 20 }}>
                      신체 정보 기반 목표 ({weightGoal}kg)까지{'\n'}
                      약 <Text style={{ fontWeight: '800', color: COLORS.green }}>
                        {Math.max(0, Math.abs(Math.round(((Number(weightList[weightList.length - 1]?.weightKg) || 0) - (weightGoal ?? 0)) / 0.5)))}주
                      </Text> 소요 예상이에요
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function CalendarGrid({ year, month, data, goalKcal }: { year: number; month: number; data: Record<string, number>; goalKcal: number }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const today = new Date();

  return (
    <>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.calRow}>
          {row.map((day, di) => {
            if (!day) return <View key={di} style={styles.calCell} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const kcal = data[dateStr];
            const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
            const bg = kcal ? (kcal <= goalKcal ? COLORS.green + '40' : COLORS.primary + '40') : 'transparent';
            return (
              <View key={di} style={[styles.calCell, { backgroundColor: bg, borderWidth: isToday ? 2 : 0, borderColor: COLORS.primary }]}>
                <Text style={[styles.calDate, isToday && { color: COLORS.primary, fontWeight: '800' }]}>{day}</Text>
                {kcal ? <Text style={styles.calKcal}>{kcal}</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
}

function WeightChart({ data, min, max, goal }: { data: WeightRecord[]; min: number; max: number; goal: number | null }) {
  const h = 120;
  const range = max - min || 1;
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ height: h, position: 'relative' }}>
        {/* 목표선 */}
        {goal !== null && goal >= min && goal <= max && (
          <View style={{
            position: 'absolute', left: 0, right: 0,
            top: ((max - goal) / range) * h,
            borderWidth: 1, borderColor: COLORS.green, borderStyle: 'dashed',
          }} />
        )}
        {/* 포인트들 */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: h, gap: 8 }}>
          {data.map((w, i) => {
            const kg = Number(w.weightKg) || 0;
            const barH = Math.max(((kg - min) / range) * h, 4);
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: h }}>
                <View style={{ width: '80%', height: barH, backgroundColor: COLORS.secondary, borderRadius: 12 }} />
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {data.map((w, i) => {
          const dateVal = w.recordedAt || w.logDate;
          const d = dateVal ? new Date(String(dateVal)) : null;
          const dayNum = d && !isNaN(d.getTime()) ? d.getDate() : '';
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: '#D4C5DC' }}>{dayNum}일</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text }}>{Number(w.weightKg) || w.weightKg}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
        <View style={{ width: 20, borderWidth: 1, borderColor: COLORS.green, borderStyle: 'dashed' }} />
        <Text style={{ fontSize: 13, color: '#8A7C9C' }}>목표 {goal}kg</Text>
      </View>
    </View>
  );
}

function InfoChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: '#8A7C9C', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 17, fontWeight: '800', color }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: { backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: '#FFF5F8' },
  tabContent: { paddingHorizontal: 22, paddingVertical: 13, gap: 8, alignItems: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 28, backgroundColor: '#FFF5F8', flexShrink: 0, gap: 4 },
  tabActive: { backgroundColor: COLORS.primary },
  tabEmoji: { fontSize: 17 },
  tabLabel: { fontSize: 14, fontWeight: '600', color: '#8A7C9C' },
  tabLabelActive: { color: '#fff' },
  pageTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  pageDesc: { fontSize: 15, color: '#8A7C9C', marginBottom: 20 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 26, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  bigNum: { fontSize: 40, fontWeight: '900', color: COLORS.text, marginVertical: 8 },
  bigNumUnit: { fontSize: 17, fontWeight: '400', color: '#8A7C9C' },
  progressWrap: { height: 8, backgroundColor: '#FFF5F8', borderRadius: 12, overflow: 'hidden' },
  progressBar: { height: 8, borderRadius: 12 },
  nutrientVisual: { gap: 16 },
  donutWrap: { marginBottom: 8 },
  segmentBar: { flexDirection: 'row', height: 16, borderRadius: 16, overflow: 'hidden' },
  segment: { height: 16 },
  legendWrap: { gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 12 },
  legendLabel: { flex: 1, fontSize: 15, color: COLORS.text },
  legendValue: { fontSize: 15, fontWeight: '700' },
  legendIdeal: { fontSize: 13, color: '#D4C5DC' },
  barChartWrap: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '80%', borderRadius: 12, minHeight: 4 },
  barDay: { fontSize: 12, color: '#8A7C9C', marginTop: 4 },
  barKcal: { fontSize: 8, color: '#D4C5DC', marginBottom: 2 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  navBtn: { fontSize: 28, color: COLORS.primary, paddingHorizontal: 14 },
  monthLabel: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  calRow: { flexDirection: 'row', marginBottom: 4 },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 13, color: '#8A7C9C', fontWeight: '600', paddingBottom: 8 },
  calCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, margin: 1 },
  calDate: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  calDateSmall: { fontSize: 13, color: COLORS.text },
  calKcal: { fontSize: 8, color: '#8A7C9C' },
  emptyText: { textAlign: 'center', color: '#D4C5DC', fontSize: 16, lineHeight: 22, paddingVertical: 20 },
  row: { flexDirection: 'row' },
});
