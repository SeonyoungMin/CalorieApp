import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import {
  analyzeDiet, getMealRecommendation, getWorkoutRecommendation, getWeeklyReport,
  DietFeedback, MealPlan, WorkoutPlan, WeeklyReport,
} from '../services/claudeService';
import { getTodayMeals, getTodayWorkouts, getWeeklyStats } from '../api/api';
import PremiumModal from '../components/PremiumModal';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme';
import Icon, { IconName } from '../components/Icon';
import CuteLoader from '../components/CuteLoader';
import FadeInView from '../components/FadeInView';

type Tab = { key: string; label: string; icon: IconName };
const TABS: Tab[] = [
  { key: 'diet',     label: '식단 분석',   icon: 'food' },
  { key: 'mealplan', label: '식단 추천',   icon: 'meal' },
  { key: 'workout',  label: '운동 추천',   icon: 'workout' },
  { key: 'weekly',   label: '주간 리포트', icon: 'chart' },
];

export default function AiInsightScreen() {
  const { goalKcal: GOAL_KCAL, userWeightKg, userHeightCm } = useAuth();
  const { isPremium } = useSubscription();
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
        <FadeInView style={styles.gateWrap}>
          <View style={styles.gateIconCircle}>
            <Icon name="crown" size={32} color="#fff" />
          </View>
          <Text style={styles.gateTitle}>프리미엄 전용 기능</Text>
          <Text style={styles.gateDesc}>AI 식단 분석, 식단 추천, 운동 추천,{'\n'}주간 리포트는 프리미엄 회원만 이용 가능합니다.</Text>
          <TouchableOpacity style={styles.gateBtn} onPress={() => setPremiumVisible(true)}>
            <Text style={styles.gateBtnText}>프리미엄 구독하기</Text>
          </TouchableOpacity>
        </FadeInView>
        <PremiumModal
          visible={premiumVisible}
          onClose={() => setPremiumVisible(false)}
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
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 88 }}>

        {/* 식단 분석 */}
        {tab === 'diet' && (
          <View>
            {!dietResult && !loading && (
              <EmptyHero
                icon="food"
                iconColor={COLORS.primary}
                title="오늘 식단 분석"
                desc="오늘 먹은 식사를 AI가 점수로 평가하고 영양소 분석을 해드려요"
                features={['100점 만점 식단 점수', '탄/단/지 영양소 비율', '잘한 점 & 개선할 점', '주의 알림']}
                buttonText="AI 분석 시작"
                onPress={runDietAnalysis}
              />
            )}
            {loading && tab === 'diet' && <LoadingView />}
            {dietResult && (
              <>
                {/* 점수 */}
                <FadeInView delay={0}>
                  <View style={[styles.card, { alignItems: 'center', paddingVertical: 22 }]}>
                    <Text style={styles.scoreLabel}>오늘의 식단 점수</Text>
                    <Text style={[styles.scoreNum, { color: dietResult.score >= 70 ? COLORS.green : dietResult.score >= 50 ? COLORS.gold : COLORS.primary }]}>
                      {dietResult.score}점
                    </Text>
                    <Text style={styles.scoreSummary}>{dietResult.summary}</Text>
                  </View>
                </FadeInView>

                {/* 영양소 비율 */}
                <FadeInView delay={80}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>영양소 비율</Text>
                    <NutrientBar label="탄수화물" value={dietResult.nutrients.carb} color={COLORS.gold} />
                    <NutrientBar label="단백질" value={dietResult.nutrients.protein} color={COLORS.secondary} />
                    <NutrientBar label="지방" value={dietResult.nutrients.fat} color={COLORS.primary} />
                  </View>
                </FadeInView>

                {/* 잘한 점 */}
                <FadeInView delay={160}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>잘한 점</Text>
                    {dietResult.good.map((g, i) => <BulletItem key={i} text={g} color={COLORS.green} />)}
                  </View>
                </FadeInView>

                {/* 개선할 점 */}
                <FadeInView delay={240}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>개선할 점</Text>
                    {dietResult.improve.map((g, i) => <BulletItem key={i} text={g} color={COLORS.gold} />)}
                  </View>
                </FadeInView>

                {/* 경고 */}
                {dietResult.warning && (
                  <FadeInView delay={320}>
                    <View style={[styles.card, { backgroundColor: '#FFF3F3', borderColor: COLORS.primary, borderWidth: 1.5 }]}>
                      <Text style={[styles.cardTitle, { color: COLORS.primary }]}>주의</Text>
                      <Text style={{ fontSize: 16, color: '#E53935', lineHeight: 20 }}>{dietResult.warning}</Text>
                    </View>
                  </FadeInView>
                )}

                <TouchableOpacity style={[styles.runBtn, { backgroundColor: '#FFF5F8' }]} onPress={() => setDietResult(null)}>
                  <Text style={[styles.runBtnText, { color: COLORS.text }]}>다시 분석</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* 식단 추천 */}
        {tab === 'mealplan' && (
          <View>
            {!mealPlan && !loading && (
              <EmptyHero
                icon="meal"
                iconColor={COLORS.secondary}
                title="맞춤 식단 추천"
                desc="목표 칼로리에 딱 맞는 하루 식단을 AI가 추천해드려요"
                features={['아침/점심/저녁/간식 메뉴', '각 식단별 칼로리', '건강한 식단 팁', '내 체형 기반 맞춤']}
                buttonText="식단 추천 받기"
                onPress={runMealPlan}
              />
            )}
            {loading && tab === 'mealplan' && <LoadingView />}
            {mealPlan && (
              <>
                {[
                  { label: '아침', data: mealPlan.breakfast },
                  { label: '점심', data: mealPlan.lunch },
                  { label: '저녁', data: mealPlan.dinner },
                  { label: '간식', data: mealPlan.snack },
                ].map(({ label, data }, idx) => (
                  <FadeInView key={label} delay={idx * 80}>
                    <View style={styles.card}>
                      <View style={styles.mealPlanHeader}>
                        <Text style={styles.cardTitle}>{label}</Text>
                        <Text style={styles.mealKcal}>{data.kcal} kcal</Text>
                      </View>
                      <Text style={styles.mealMenu}>{data.menu}</Text>
                      <Text style={styles.mealDesc}>{data.desc}</Text>
                    </View>
                  </FadeInView>
                ))}
                <FadeInView delay={320}>
                  <View style={[styles.card, { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary, borderWidth: 1 }]}>
                    <Text style={[styles.cardTitle, { color: COLORS.primary }]}>총 {mealPlan.totalKcal} kcal</Text>
                    <Text style={{ fontSize: 15, color: '#8A7C9C', marginTop: 4 }}>{mealPlan.tip}</Text>
                  </View>
                </FadeInView>
                <TouchableOpacity style={[styles.runBtn, { backgroundColor: '#FFF5F8' }]} onPress={() => setMealPlan(null)}>
                  <Text style={[styles.runBtnText, { color: COLORS.text }]}>다시 추천</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* 운동 추천 */}
        {tab === 'workout' && (
          <View>
            {!workoutPlan && !loading && (
              <EmptyHero
                icon="workout"
                iconColor={COLORS.purpleDark}
                title="운동 루틴 추천"
                desc="내 체형과 목표에 맞는 운동을 AI가 추천해드려요"
                features={['난이도 / 시간 / 소모 칼로리', '구체적인 운동 동작', '세트 & 반복 안내', '운동 팁']}
                buttonText="운동 루틴 추천 받기"
                onPress={runWorkoutPlan}
              />
            )}
            {loading && tab === 'workout' && <LoadingView />}
            {workoutPlan && (
              <>
                <FadeInView delay={0}>
                  <View style={styles.card}>
                    <View style={styles.row}>
                      <InfoChip label="난이도" value={workoutPlan.level} color={COLORS.purple} />
                      <InfoChip label="총 시간" value={`${workoutPlan.duration}분`} color={COLORS.secondary} />
                      <InfoChip label="소모" value={`${workoutPlan.totalKcal}kcal`} color={COLORS.primary} />
                    </View>
                  </View>
                </FadeInView>
                {workoutPlan.exercises.map((ex, i) => (
                  <FadeInView key={i} delay={80 + i * 80}>
                    <View style={styles.card}>
                      <View style={styles.mealPlanHeader}>
                        <Text style={styles.cardTitle}>{ex.name}</Text>
                        <Text style={styles.mealKcal}>{ex.kcal} kcal</Text>
                      </View>
                      <Text style={[styles.mealMenu, { color: COLORS.purple }]}>{ex.sets}</Text>
                      <Text style={styles.mealDesc}>{ex.desc}</Text>
                    </View>
                  </FadeInView>
                ))}
                <FadeInView delay={80 + workoutPlan.exercises.length * 80}>
                  <View style={[styles.card, { backgroundColor: COLORS.secondary + '15' }]}>
                    <Text style={{ fontSize: 15, color: '#455A64' }}>{workoutPlan.tip}</Text>
                  </View>
                </FadeInView>
                <TouchableOpacity style={[styles.runBtn, { backgroundColor: '#FFF5F8' }]} onPress={() => setWorkoutPlan(null)}>
                  <Text style={[styles.runBtnText, { color: COLORS.text }]}>다시 추천</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* 주간 리포트 */}
        {tab === 'weekly' && (
          <View>
            {!weeklyReport && !loading && (
              <EmptyHero
                icon="chart"
                iconColor={COLORS.warning}
                title="주간 리포트"
                desc="이번 주 식단 패턴과 트렌드를 AI가 분석해드려요"
                features={['평균 섭취 & 목표 달성률', '최고의 날 & 아쉬운 날', '종합 분석 리포트', '다음 주 가이드']}
                buttonText="주간 리포트 생성"
                onPress={runWeeklyReport}
              />
            )}
            {loading && tab === 'weekly' && <LoadingView />}
            {weeklyReport && (
              <>
                <FadeInView delay={0}>
                  <View style={styles.card}>
                    <View style={styles.row}>
                      <InfoChip label="평균 섭취" value={`${weeklyReport.avgKcal}kcal`} color={COLORS.primary} />
                      <InfoChip label="목표 달성" value={`${weeklyReport.goalAchievement}%`} color={COLORS.green} />
                      <InfoChip label="트렌드" value={weeklyReport.trend} color={COLORS.secondary} />
                    </View>
                  </View>
                </FadeInView>
                <FadeInView delay={80}>
                  <View style={styles.card}>
                    <View style={styles.row}>
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: '#8A7C9C' }}>최고의 날</Text>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.green, marginTop: 4 }}>{weeklyReport.bestDay}</Text>
                      </View>
                      <View style={{ width: 1, backgroundColor: '#F0E1EC' }} />
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: '#8A7C9C' }}>아쉬운 날</Text>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.primary, marginTop: 4 }}>{weeklyReport.worstDay}</Text>
                      </View>
                    </View>
                  </View>
                </FadeInView>
                <FadeInView delay={160}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>종합 분석</Text>
                    <Text style={{ fontSize: 16, color: '#455A64', lineHeight: 22, marginTop: 8 }}>{weeklyReport.analysis}</Text>
                  </View>
                </FadeInView>
                <FadeInView delay={240}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>다음 주 목표</Text>
                    {weeklyReport.nextWeekTips.map((tip, i) => <BulletItem key={i} text={tip} color={COLORS.secondary} />)}
                  </View>
                </FadeInView>
                <TouchableOpacity style={[styles.runBtn, { backgroundColor: '#FFF5F8' }]} onPress={() => setWeeklyReport(null)}>
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
  return <CuteLoader message="AI가 분석 중이에요..." icon="sparkles" />;
}

type EmptyHeroProps = {
  icon: IconName;
  iconColor: string;
  title: string;
  desc: string;
  features: string[];
  buttonText: string;
  onPress: () => void;
};

function EmptyHero({ icon, iconColor, title, desc, buttonText, onPress }: EmptyHeroProps) {
  return (
    <FadeInView style={styles.heroWrap}>
      {/* 큰 동그라미 아이콘 + 그라데이션 느낌 */}
      <View style={[styles.heroBigIcon, { backgroundColor: iconColor + '22', borderColor: iconColor + '40' }]}>
        <Icon name={icon} size={48} color={iconColor} />
      </View>
      <Text style={styles.heroTitleNew}>{title}</Text>
      <Text style={styles.heroDescNew}>{desc}</Text>
      <TouchableOpacity
        style={[styles.heroBtnNew, { backgroundColor: iconColor, shadowColor: iconColor }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Icon name="sparkles" size={20} color="#fff" />
        <Text style={styles.heroBtnTextNew}>{buttonText}</Text>
      </TouchableOpacity>
    </FadeInView>
  );
}

function NutrientBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 15, color: '#8A7C9C', fontWeight: '600' }}>{label}</Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color }}>{value}%</Text>
      </View>
      <View style={{ height: 8, backgroundColor: '#FFF5F8', borderRadius: 12 }}>
        <View style={{ height: 8, width: `${Math.min(value, 100)}%`, backgroundColor: color, borderRadius: 12 }} />
      </View>
    </View>
  );
}

function BulletItem({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, gap: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 12, backgroundColor: color, marginTop: 5 }} />
      <Text style={{ flex: 1, fontSize: 16, color: '#455A64', lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

function InfoChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontSize: 13, color: '#8A7C9C', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: '800', color }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  gateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  gateIconCircle: {
    width: 76, height: 76, borderRadius: 999,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  gateTitle: { fontSize: 21, fontWeight: '800', color: COLORS.text, marginTop: 8, marginBottom: 10 },
  gateDesc: { fontSize: 16, color: '#8A7C9C', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  gateBtn: { backgroundColor: COLORS.primary, borderRadius: 26, paddingVertical: 17, paddingHorizontal: 30 },
  gateBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  tabBar: { backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: '#FFF5F8' },
  tabContent: { paddingHorizontal: 22, paddingVertical: 13, gap: 8, alignItems: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 28, backgroundColor: '#FFF5F8', flexShrink: 0, gap: 4 },
  tabActive: { backgroundColor: COLORS.primary },
  tabEmoji: { fontSize: 17 },
  tabLabel: { fontSize: 15, fontWeight: '600', color: '#8A7C9C' },
  tabLabelActive: { color: '#fff' },
  body: { flex: 1 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  pageDesc: { fontSize: 15, color: '#8A7C9C', marginBottom: 20 },
  // 새 EmptyHero — 흰 카드 박스 없이 본문 배경에 직접
  heroWrap: {
    alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24,
  },
  heroBigIcon: {
    width: 110, height: 110, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, marginBottom: 20,
  },
  heroTitleNew: {
    fontSize: 22, fontWeight: '900', color: COLORS.text,
    marginBottom: 10, textAlign: 'center',
  },
  heroDescNew: {
    fontSize: 15, color: COLORS.subText,
    textAlign: 'center', lineHeight: 22, marginBottom: 32,
    paddingHorizontal: 8,
  },
  heroBtnNew: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    borderRadius: 28, paddingVertical: 20, paddingHorizontal: 32,
    alignSelf: 'stretch',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  heroBtnTextNew: { color: '#fff', fontSize: 18, fontWeight: '900' },
  // 옛 hero (현재 미사용, 호환용)
  heroCard: {
    backgroundColor: COLORS.card, borderRadius: 14,
    paddingVertical: 11, paddingHorizontal: 10,
  },
  heroRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6,
  },
  heroIcon: {
    width: 30, height: 30, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 15, fontWeight: '800', color: COLORS.text,
  },
  heroDesc: {
    fontSize: 12, color: COLORS.subText, lineHeight: 13,
  },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 22, paddingVertical: 18, paddingHorizontal: 24,
    alignSelf: 'stretch',
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  heroBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  runBtn: {
    backgroundColor: COLORS.primary, borderRadius: 24,
    paddingVertical: 16, alignItems: 'center', marginBottom: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  runBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  card: {
    backgroundColor: COLORS.card, borderRadius: 24, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  scoreLabel: { fontSize: 15, color: '#8A7C9C', marginBottom: 8 },
  scoreNum: { fontSize: 56, fontWeight: '900' },
  scoreSummary: { fontSize: 16, color: '#8A7C9C', marginTop: 8, textAlign: 'center' },
  mealPlanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  mealMenu: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  mealKcal: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  mealDesc: { fontSize: 15, color: '#8A7C9C', marginTop: 4, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8 },
});
