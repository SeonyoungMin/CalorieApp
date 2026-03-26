import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import {
  analyzeDiet, getMealRecommendation, getWorkoutRecommendation, getWeeklyReport,
  DietFeedback, MealPlan, WorkoutPlan, WeeklyReport,
} from '../services/claudeService';
import { getTodayMeals, getTodayWorkouts, getWeeklyStats } from '../api/api';
import PremiumModal from '../components/PremiumModal';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../context/AuthContext';

const COLORS = {
  primary: '#FF6B6B', secondary: '#4ECDC4', gold: '#FCC419',
  purple: '#9C88FF', green: '#51CF66', bg: '#F0F4F8',
  card: '#FFFFFF', text: '#2C3E50',
};

const TABS = [
  { key: 'diet', label: '식단 분석', emoji: '🍽️' },
  { key: 'mealplan', label: '식단 추천', emoji: '📋' },
  { key: 'workout', label: '운동 추천', emoji: '💪' },
  { key: 'weekly', label: '주간 리포트', emoji: '📊' },
];

export default function AiInsightScreen() {
  const { goalKcal: GOAL_KCAL, userWeightKg, userHeightCm } = useAuth();
  const { isPremium, activatePremium, cancelPremium } = useSubscription();
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [tab, setTab] = useState('diet');
  const [loading, setLoading] = useState(false);
  const [dietResult, setDietResult] = useState<DietFeedback | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert('오류', e.message || 'AI 분석 실패');
    } finally {
      setLoading(false);
    }
  };

  const runDietAnalysis = () => run(async () => {
    const mealsRes = await getTodayMeals();
    const meals = mealsRes.data || [];
    const totalKcal = meals.reduce((s: number, m: any) => s + m.totalKcal, 0);
    const result = await analyzeDiet(meals, totalKcal, GOAL_KCAL);
    setDietResult(result);
  });

  const runMealPlan = () => run(async () => {
    const result = await getMealRecommendation(GOAL_KCAL, userWeightKg || 65, userHeightCm || 170);
    setMealPlan(result);
  });

  const runWorkoutPlan = () => run(async () => {
    const workoutsRes = await getTodayWorkouts();
    const result = await getWorkoutRecommendation(userWeightKg || 65, GOAL_KCAL, workoutsRes.data || []);
    setWorkoutPlan(result);
  });

  const runWeeklyReport = () => run(async () => {
    const res = await getWeeklyStats();
    const result = await getWeeklyReport(res.data || [], GOAL_KCAL);
    setWeeklyReport(result);
  });

  if (!isPremium) {
    return (
      <View style={styles.container}>
        <View style={styles.gateWrap}>
          <Text style={{ fontSize: 64 }}>👑</Text>
          <Text style={styles.gateTitle}>프리미엄 전용 기능</Text>
          <Text style={styles.gateDesc}>AI 식단 분석, 식단 추천, 운동 추천,{'\n'}주간 리포트는 프리미엄 회원만 이용 가능합니다.</Text>
          <TouchableOpacity style={styles.gateBtn} onPress={() => setPremiumVisible(true)}>
            <Text style={styles.gateBtnText}>👑 프리미엄 구독하기</Text>
          </TouchableOpacity>
        </View>
        <PremiumModal
          visible={premiumVisible}
          onClose={() => setPremiumVisible(false)}
          isPremium={false}
          onSubscribe={async () => { await activatePremium(); setPremiumVisible(false); }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 탭 */}
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

      <ScrollView style={styles.body} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        {/* 식단 분석 */}
        {tab === 'diet' && (
          <View>
            <Text style={styles.pageTitle}>🍽️ 오늘 식단 분석</Text>
            <Text style={styles.pageDesc}>오늘 먹은 식사를 AI가 분석해드려요</Text>
            {!dietResult && !loading && (
              <TouchableOpacity style={styles.runBtn} onPress={runDietAnalysis}>
                <Text style={styles.runBtnText}>AI 분석 시작</Text>
              </TouchableOpacity>
            )}
            {loading && tab === 'diet' && <LoadingView />}
            {dietResult && (
              <>
                {/* 점수 */}
                <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
                  <Text style={styles.scoreLabel}>오늘의 식단 점수</Text>
                  <Text style={[styles.scoreNum, { color: dietResult.score >= 70 ? COLORS.green : dietResult.score >= 50 ? COLORS.gold : COLORS.primary }]}>
                    {dietResult.score}점
                  </Text>
                  <Text style={styles.scoreSummary}>{dietResult.summary}</Text>
                </View>

                {/* 영양소 비율 */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>영양소 비율</Text>
                  <NutrientBar label="탄수화물" value={dietResult.nutrients.carb} color={COLORS.gold} />
                  <NutrientBar label="단백질" value={dietResult.nutrients.protein} color={COLORS.secondary} />
                  <NutrientBar label="지방" value={dietResult.nutrients.fat} color={COLORS.primary} />
                </View>

                {/* 잘한 점 */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>✅ 잘한 점</Text>
                  {dietResult.good.map((g, i) => <BulletItem key={i} text={g} color={COLORS.green} />)}
                </View>

                {/* 개선할 점 */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>💡 개선할 점</Text>
                  {dietResult.improve.map((g, i) => <BulletItem key={i} text={g} color={COLORS.gold} />)}
                </View>

                {/* 경고 */}
                {dietResult.warning && (
                  <View style={[styles.card, { backgroundColor: '#FFF3F3', borderColor: COLORS.primary, borderWidth: 1.5 }]}>
                    <Text style={[styles.cardTitle, { color: COLORS.primary }]}>⚠️ 주의</Text>
                    <Text style={{ fontSize: 14, color: '#E53935', lineHeight: 20 }}>{dietResult.warning}</Text>
                  </View>
                )}

                <TouchableOpacity style={[styles.runBtn, { backgroundColor: '#F0F4F8' }]} onPress={() => setDietResult(null)}>
                  <Text style={[styles.runBtnText, { color: COLORS.text }]}>다시 분석</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* 식단 추천 */}
        {tab === 'mealplan' && (
          <View>
            <Text style={styles.pageTitle}>📋 오늘의 맞춤 식단</Text>
            <Text style={styles.pageDesc}>목표 칼로리에 맞는 하루 식단을 추천해드려요</Text>
            {!mealPlan && !loading && (
              <TouchableOpacity style={styles.runBtn} onPress={runMealPlan}>
                <Text style={styles.runBtnText}>식단 추천 받기</Text>
              </TouchableOpacity>
            )}
            {loading && tab === 'mealplan' && <LoadingView />}
            {mealPlan && (
              <>
                {[
                  { label: '아침 🌅', data: mealPlan.breakfast },
                  { label: '점심 ☀️', data: mealPlan.lunch },
                  { label: '저녁 🌙', data: mealPlan.dinner },
                  { label: '간식 🍎', data: mealPlan.snack },
                ].map(({ label, data }) => (
                  <View key={label} style={styles.card}>
                    <View style={styles.mealPlanHeader}>
                      <Text style={styles.cardTitle}>{label}</Text>
                      <Text style={styles.mealKcal}>{data.kcal} kcal</Text>
                    </View>
                    <Text style={styles.mealMenu}>{data.menu}</Text>
                    <Text style={styles.mealDesc}>{data.desc}</Text>
                  </View>
                ))}
                <View style={[styles.card, { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary, borderWidth: 1 }]}>
                  <Text style={[styles.cardTitle, { color: COLORS.primary }]}>총 {mealPlan.totalKcal} kcal</Text>
                  <Text style={{ fontSize: 13, color: '#78909C', marginTop: 4 }}>💡 {mealPlan.tip}</Text>
                </View>
                <TouchableOpacity style={[styles.runBtn, { backgroundColor: '#F0F4F8' }]} onPress={() => setMealPlan(null)}>
                  <Text style={[styles.runBtnText, { color: COLORS.text }]}>다시 추천</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* 운동 추천 */}
        {tab === 'workout' && (
          <View>
            <Text style={styles.pageTitle}>💪 오늘의 운동 루틴</Text>
            <Text style={styles.pageDesc}>내 체형과 목표에 맞는 운동을 추천해드려요</Text>
            {!workoutPlan && !loading && (
              <TouchableOpacity style={styles.runBtn} onPress={runWorkoutPlan}>
                <Text style={styles.runBtnText}>운동 루틴 추천 받기</Text>
              </TouchableOpacity>
            )}
            {loading && tab === 'workout' && <LoadingView />}
            {workoutPlan && (
              <>
                <View style={styles.card}>
                  <View style={styles.row}>
                    <InfoChip label="난이도" value={workoutPlan.level} color={COLORS.purple} />
                    <InfoChip label="총 시간" value={`${workoutPlan.duration}분`} color={COLORS.secondary} />
                    <InfoChip label="소모" value={`${workoutPlan.totalKcal}kcal`} color={COLORS.primary} />
                  </View>
                </View>
                {workoutPlan.exercises.map((ex, i) => (
                  <View key={i} style={styles.card}>
                    <View style={styles.mealPlanHeader}>
                      <Text style={styles.cardTitle}>{ex.name}</Text>
                      <Text style={styles.mealKcal}>{ex.kcal} kcal</Text>
                    </View>
                    <Text style={[styles.mealMenu, { color: COLORS.purple }]}>{ex.sets}</Text>
                    <Text style={styles.mealDesc}>{ex.desc}</Text>
                  </View>
                ))}
                <View style={[styles.card, { backgroundColor: COLORS.secondary + '15' }]}>
                  <Text style={{ fontSize: 13, color: '#455A64' }}>💡 {workoutPlan.tip}</Text>
                </View>
                <TouchableOpacity style={[styles.runBtn, { backgroundColor: '#F0F4F8' }]} onPress={() => setWorkoutPlan(null)}>
                  <Text style={[styles.runBtnText, { color: COLORS.text }]}>다시 추천</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* 주간 리포트 */}
        {tab === 'weekly' && (
          <View>
            <Text style={styles.pageTitle}>📊 이번 주 리포트</Text>
            <Text style={styles.pageDesc}>이번 주 식단 패턴을 분석해드려요</Text>
            {!weeklyReport && !loading && (
              <TouchableOpacity style={styles.runBtn} onPress={runWeeklyReport}>
                <Text style={styles.runBtnText}>주간 리포트 생성</Text>
              </TouchableOpacity>
            )}
            {loading && tab === 'weekly' && <LoadingView />}
            {weeklyReport && (
              <>
                <View style={styles.card}>
                  <View style={styles.row}>
                    <InfoChip label="평균 섭취" value={`${weeklyReport.avgKcal}kcal`} color={COLORS.primary} />
                    <InfoChip label="목표 달성" value={`${weeklyReport.goalAchievement}%`} color={COLORS.green} />
                    <InfoChip label="트렌드" value={weeklyReport.trend} color={COLORS.secondary} />
                  </View>
                </View>
                <View style={styles.card}>
                  <View style={styles.row}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#78909C' }}>최고의 날</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.green, marginTop: 4 }}>{weeklyReport.bestDay}</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: '#E0E7EF' }} />
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#78909C' }}>아쉬운 날</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 4 }}>{weeklyReport.worstDay}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>📝 종합 분석</Text>
                  <Text style={{ fontSize: 14, color: '#455A64', lineHeight: 22, marginTop: 8 }}>{weeklyReport.analysis}</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>🎯 다음 주 목표</Text>
                  {weeklyReport.nextWeekTips.map((tip, i) => <BulletItem key={i} text={tip} color={COLORS.secondary} />)}
                </View>
                <TouchableOpacity style={[styles.runBtn, { backgroundColor: '#F0F4F8' }]} onPress={() => setWeeklyReport(null)}>
                  <Text style={[styles.runBtnText, { color: COLORS.text }]}>다시 생성</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function LoadingView() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={{ marginTop: 16, fontSize: 14, color: '#78909C' }}>AI가 분석 중이에요...</Text>
    </View>
  );
}

function NutrientBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 13, color: '#78909C', fontWeight: '600' }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color }}>{value}%</Text>
      </View>
      <View style={{ height: 8, backgroundColor: '#F0F4F8', borderRadius: 4 }}>
        <View style={{ height: 8, width: `${Math.min(value, 100)}%`, backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}

function BulletItem({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, gap: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginTop: 5 }} />
      <Text style={{ flex: 1, fontSize: 14, color: '#455A64', lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

function InfoChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontSize: 11, color: '#78909C', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '800', color }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  gateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  gateTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 16, marginBottom: 12 },
  gateDesc: { fontSize: 14, color: '#78909C', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  gateBtn: { backgroundColor: COLORS.primary, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 32 },
  gateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  tabBar: { backgroundColor: COLORS.card, maxHeight: 72, borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  tabContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F4F8', flexShrink: 0 },
  tabActive: { backgroundColor: COLORS.primary },
  tabEmoji: { fontSize: 18 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#78909C', marginTop: 2 },
  tabLabelActive: { color: '#fff' },
  body: { flex: 1 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  pageDesc: { fontSize: 13, color: '#78909C', marginBottom: 20 },
  runBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginBottom: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  runBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  card: {
    backgroundColor: COLORS.card, borderRadius: 18, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  scoreLabel: { fontSize: 13, color: '#78909C', marginBottom: 8 },
  scoreNum: { fontSize: 56, fontWeight: '900' },
  scoreSummary: { fontSize: 14, color: '#78909C', marginTop: 8, textAlign: 'center' },
  mealPlanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  mealMenu: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  mealKcal: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  mealDesc: { fontSize: 13, color: '#78909C', marginTop: 4, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8 },
});
