import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getWeightList, getWeeklyStats } from '../api/api';
import { useAuth } from '../context/AuthContext';
import PremiumModal from '../components/PremiumModal';
import { useSubscription } from '../hooks/useSubscription';

const COLORS = {
  primary: '#FF6B6B', secondary: '#4ECDC4', gold: '#FCC419',
  purple: '#9C88FF', green: '#51CF66', bg: '#F0F4F8',
  card: '#FFFFFF', text: '#2C3E50',
};

const TABS = [
  { key: 'nutrients', label: '영양소', emoji: '🥗' },
  { key: 'calendar', label: '캘린더', emoji: '🗓️' },
  { key: 'weight', label: '체중 그래프', emoji: '📉' },
];

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

export default function StatsScreen() {
  const { goalKcal: GOAL_KCAL, userWeightKg } = useAuth();
  const { isPremium, activatePremium, cancelPremium } = useSubscription();
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [tab, setTab] = useState('nutrients');
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [weightList, setWeightList] = useState<any[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [wRes, wgRes] = await Promise.all([getWeeklyStats(), getWeightList()]);
        setWeeklyData(wRes.data || []);
        const sorted = (wgRes.data || []).sort(
          (a: any, b: any) => new Date(a.logDate).getTime() - new Date(b.logDate).getTime()
        );
        setWeightList(sorted);
      } catch (_) {}
      setLoading(false);
    };
    load();
  }, []));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (!isPremium) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 64 }}>📊</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 16, marginBottom: 12 }}>프리미엄 전용 기능</Text>
        <Text style={{ fontSize: 14, color: '#78909C', textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
          영양소 분석, 캘린더, 체중 그래프는{'\n'}프리미엄 회원만 이용 가능합니다.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: COLORS.primary, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 32 }}
          onPress={() => setPremiumVisible(true)}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>👑 프리미엄 구독하기</Text>
        </TouchableOpacity>
        <PremiumModal
          visible={premiumVisible}
          onClose={() => setPremiumVisible(false)}
          isPremium={false}
          onSubscribe={async () => { await activatePremium(); setPremiumVisible(false); }}
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
  const maxW = weightList.length > 0 ? Math.max(...weightList.map((w: any) => w.weightKg)) + 2 : 80;
  const minW = weightList.length > 0 ? Math.min(...weightList.map((w: any) => w.weightKg)) - 2 : 50;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabContent}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={styles.tabEmoji}>{t.emoji}</Text>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {/* 영양소 분석 */}
        {tab === 'nutrients' && (
          <View>
            <Text style={styles.pageTitle}>🥗 영양소 분석</Text>
            <Text style={styles.pageDesc}>이번 주 평균 영양소 섭취 비율</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>이번 주 평균 섭취</Text>
              <Text style={styles.bigNum}>{avgKcal} <Text style={styles.bigNumUnit}>kcal/일</Text></Text>
              <View style={styles.progressWrap}>
                <View style={[styles.progressBar, { width: `${Math.min((avgKcal / GOAL_KCAL) * 100, 100)}%`, backgroundColor: avgKcal > GOAL_KCAL ? COLORS.primary : COLORS.green }]} />
              </View>
              <Text style={{ fontSize: 12, color: '#78909C', marginTop: 4 }}>목표 {GOAL_KCAL}kcal 대비 {Math.round((avgKcal / GOAL_KCAL) * 100)}%</Text>
            </View>

            {/* 영양소 도넛 시뮬레이션 */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>영양소 비율</Text>
              <Text style={{ fontSize: 11, color: '#B0BEC5', marginBottom: 8 }}>※ 권장 비율 기준 (음식별 실측값 미지원)</Text>
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
                  const h = Math.max((d.foodKcal / GOAL_KCAL) * 100, 4);
                  const day = DAYS_KR[new Date(d.date).getDay()];
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
            <Text style={styles.pageTitle}>🗓️ 월간 칼로리 캘린더</Text>

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
                <View style={[styles.calCell, { backgroundColor: '#F0F4F8' }]}>
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
            <Text style={styles.pageTitle}>📉 체중 변화 그래프</Text>
            <Text style={styles.pageDesc}>목표 체중까지의 변화를 확인해요</Text>

            {weightList.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>체중 기록이 없어요{'\n'}체중 탭에서 기록을 추가해보세요!</Text>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <View style={styles.row}>
                    <InfoChip label="현재" value={`${weightList[weightList.length - 1]?.weightKg}kg`} color={COLORS.primary} />
                    <InfoChip label="최저" value={`${Math.min(...weightList.map((w: any) => w.weightKg))}kg`} color={COLORS.green} />
                    <InfoChip label="변화" value={`${(weightList[weightList.length - 1]?.weightKg - weightList[0]?.weightKg).toFixed(1)}kg`} color={COLORS.secondary} />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>체중 추이</Text>
                  <WeightChart data={weightList} min={minW} max={maxW} goal={weightGoal} />
                </View>

                {weightGoal !== null && (
                  <View style={[styles.card, { backgroundColor: COLORS.green + '15' }]}>
                    <Text style={styles.cardTitle}>🎯 목표 달성 예측</Text>
                    <Text style={{ fontSize: 13, color: '#455A64', marginTop: 4, lineHeight: 20 }}>
                      신체 정보 기반 목표 ({weightGoal}kg)까지{'\n'}
                      약 <Text style={{ fontWeight: '800', color: COLORS.green }}>
                        {Math.max(0, Math.abs(Math.round((weightList[weightList.length - 1]?.weightKg - weightGoal) / 0.5)))}주
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

function CalendarGrid({ year, month, data, goalKcal }: any) {
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

function WeightChart({ data, min, max, goal }: any) {
  const h = 120;
  const range = max - min;
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
          {data.map((w: any, i: number) => {
            const barH = Math.max(((w.weightKg - min) / range) * h, 4);
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: h }}>
                <View style={{ width: '80%', height: barH, backgroundColor: COLORS.secondary, borderRadius: 4 }} />
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {data.map((w: any, i: number) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: '#B0BEC5' }}>{new Date(w.logDate).getDate()}일</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.text }}>{w.weightKg}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
        <View style={{ width: 20, borderWidth: 1, borderColor: COLORS.green, borderStyle: 'dashed' }} />
        <Text style={{ fontSize: 11, color: '#78909C' }}>목표 {goal}kg</Text>
      </View>
    </View>
  );
}

function InfoChip({ label, value, color }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, color: '#78909C', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '800', color }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: { backgroundColor: COLORS.card, maxHeight: 72, borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  tabContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F4F8', flexShrink: 0 },
  tabActive: { backgroundColor: COLORS.primary },
  tabEmoji: { fontSize: 18 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#78909C', marginTop: 2 },
  tabLabelActive: { color: '#fff' },
  pageTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  pageDesc: { fontSize: 13, color: '#78909C', marginBottom: 20 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 18, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  bigNum: { fontSize: 40, fontWeight: '900', color: COLORS.text, marginVertical: 8 },
  bigNumUnit: { fontSize: 16, fontWeight: '400', color: '#78909C' },
  progressWrap: { height: 8, backgroundColor: '#F0F4F8', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: 8, borderRadius: 4 },
  nutrientVisual: { gap: 16 },
  donutWrap: { marginBottom: 8 },
  segmentBar: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden' },
  segment: { height: 16 },
  legendWrap: { gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, color: COLORS.text },
  legendValue: { fontSize: 13, fontWeight: '700' },
  legendIdeal: { fontSize: 11, color: '#B0BEC5' },
  barChartWrap: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '80%', borderRadius: 4, minHeight: 4 },
  barDay: { fontSize: 10, color: '#78909C', marginTop: 4 },
  barKcal: { fontSize: 8, color: '#B0BEC5', marginBottom: 2 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  navBtn: { fontSize: 28, color: COLORS.primary, paddingHorizontal: 8 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  calRow: { flexDirection: 'row', marginBottom: 4 },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 11, color: '#78909C', fontWeight: '600', paddingBottom: 8 },
  calCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, margin: 1 },
  calDate: { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  calDateSmall: { fontSize: 11, color: COLORS.text },
  calKcal: { fontSize: 8, color: '#78909C' },
  emptyText: { textAlign: 'center', color: '#B0BEC5', fontSize: 14, lineHeight: 22, paddingVertical: 20 },
  row: { flexDirection: 'row' },
});
