import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Animated, Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSubscription } from '../hooks/useSubscription';
import { useWeightGoal } from '../hooks/useWeightGoal';
import { COLORS } from '../theme';
import Icon, { IconName } from '../components/Icon';
import FadeInView from '../components/FadeInView';

// ─── 데이터 ────────────────────────────────────────────────────────────────────
interface FoodItem {
  id: string;
  icon: IconName;
  name: string;
  kcal: number;
}

interface ExerciseItem {
  id: string;
  icon: IconName;
  name: string;
  kcal: number;
}

const FOODS: FoodItem[] = [
  { id: 'chicken', icon: 'fire',     name: '치킨 한 마리',   kcal: 1800 },
  { id: 'ramyun',  icon: 'food',     name: '라면 1개',        kcal: 500  },
  { id: 'soju',    icon: 'drink',    name: '소주 1잔',        kcal: 65   },
  { id: 'pizza',   icon: 'food',     name: '피자 1조각',      kcal: 300  },
  { id: 'pork',    icon: 'fire',     name: '삼겹살 1인분',    kcal: 600  },
  { id: 'tteok',   icon: 'food',     name: '떡볶이 1인분',    kcal: 400  },
  { id: 'icecream',icon: 'star',     name: '아이스크림 1개',  kcal: 250  },
];

const EXERCISES: ExerciseItem[] = [
  { id: 'walk',    icon: 'fire',    name: '걷기 30분',    kcal: 150 },
  { id: 'run',     icon: 'fire',    name: '달리기 30분',  kcal: 300 },
  { id: 'gym',     icon: 'workout', name: '헬스 1시간',   kcal: 400 },
  { id: 'bike',    icon: 'fire',    name: '자전거 30분',  kcal: 200 },
  { id: 'swim',    icon: 'water',   name: '수영 30분',    kcal: 250 },
];

const FREE_FOOD_COUNT     = 3;
const FREE_EXERCISE_COUNT = 3;

// ─── 위트 문구 생성 ───────────────────────────────────────────────────────────
function getFoodWitMessage(foodName: string, kcal: number, delayDays: number): string {
  if (delayDays <= 0) return `${foodName}? 오늘 운동했으면 괜찮아요! `;
  if (delayDays === 1) return `${foodName}... 딱 하루만 늦춰지네요. 뭐, 인생은 한 번이잖아요? `;
  if (delayDays <= 3) return `${foodName} 먹으면 목표일이 ${delayDays}일 뒤로 밀려요. 내일 좀 더 열심히 해요! `;
  if (delayDays <= 7) return `${foodName} 한 번에 ${delayDays}일... 한 주가 날아가요! 정말 먹을 건가요? `;
  if (delayDays <= 14) return `${foodName} 먹으면 ${delayDays}일이나 늦어져요. 2주가 증발합니다 `;
  return `${foodName}은 ${delayDays}일짜리 폭탄이에요 목표일이 한 달 가까이 늦춰집니다!`;
}

function getExerciseWitMessage(exerciseName: string, exerciseKcal: number, foodName: string, foodKcal: number): string {
  const ratio = exerciseKcal / foodKcal;
  if (ratio >= 1) {
    const times = Math.floor(ratio);
    return `${exerciseName}으로 ${foodName} ${times}개 이상 태울 수 있어요! 완벽해요 `;
  }
  const needed = Math.ceil(foodKcal / exerciseKcal);
  if (needed === 2) return `${exerciseName} 두 번이면 ${foodName} 한 개 상쇄 가능! 할 만하죠? `;
  if (needed <= 4) return `${exerciseName}을 ${needed}번 해야 ${foodName} 한 개를 태울 수 있어요. 의지가 필요해요 `;
  return `${exerciseName} ${needed}번이 필요해요... ${foodName}은 정말 강력한 상대네요 `;
}

function getCancelMessage(exerciseName: string, exerciseKcal: number, targetKcal: number, targetName: string): string {
  const count = exerciseKcal / targetKcal;
  if (count >= 1) {
    return `${exerciseName} 하면 ${targetName} ${count.toFixed(count >= 2 ? 0 : 1)}잔 이상 상쇄!`;
  }
  const needed = Math.ceil(targetKcal / exerciseKcal);
  return `${exerciseName} ${needed}번 해야 ${targetName} 1개 상쇄`;
}

// ─── 결과 팝업 ────────────────────────────────────────────────────────────────
interface ResultPopupProps {
  visible: boolean;
  type: 'food' | 'exercise';
  item: FoodItem | ExerciseItem | null;
  compareItem: FoodItem | null;   // 운동일 때 비교 음식 (소주)
  averageDeficit: number;
  onClose: () => void;
}

function ResultPopup({ visible, type, item, compareItem, averageDeficit, onClose }: ResultPopupProps) {
  if (!item) return null;

  let bigIcon: IconName = 'sparkles';
  let mainText = '';
  let subText = '';
  let witText = '';
  let accentColor = COLORS.primary;

  if (type === 'food') {
    const food = item as FoodItem;
    const deficit = Math.max(averageDeficit, 1);
    const delayDays = Math.round(food.kcal / deficit);
    bigIcon = food.icon;
    mainText = delayDays <= 0
      ? '목표일에 영향 없어요!'
      : `목표일이 약 ${delayDays}일 늦춰져요`;
    subText = `${food.kcal}kcal ÷ 일평균 ${Math.round(deficit)}kcal 적자`;
    witText = getFoodWitMessage(food.name, food.kcal, delayDays);
    accentColor = delayDays >= 7 ? COLORS.primary : delayDays >= 3 ? COLORS.warning : COLORS.success;
  } else {
    const exercise = item as ExerciseItem;
    const soju = FOODS.find(f => f.id === 'soju')!;
    const compare = compareItem || soju;
    bigIcon = exercise.icon;
    const cancelCount = (exercise.kcal / compare.kcal).toFixed(1);
    mainText = `${compare.name} ${cancelCount}개 상쇄!`;
    subText = `${exercise.kcal}kcal 소모 / ${compare.name} ${compare.kcal}kcal`;
    witText = getExerciseWitMessage(exercise.name, exercise.kcal, compare.name, compare.kcal);
    accentColor = COLORS.success;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={popStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={popStyles.card} onPress={() => {}}>
          {/* 닫기 */}
          <TouchableOpacity style={popStyles.closeBtn} onPress={onClose}>
            <Icon name="close" size={18} color="#D4C5DC" />
          </TouchableOpacity>

          {/* 아이콘 */}
          <View style={[popStyles.iconCircle, { backgroundColor: accentColor + '18' }]}>
            <Icon name={bigIcon} size={40} color={accentColor} />
          </View>

          {/* 메인 텍스트 */}
          <Text style={[popStyles.mainText, { color: accentColor }]}>{mainText}</Text>
          <Text style={popStyles.subText}>{subText}</Text>

          {/* 구분선 */}
          <View style={popStyles.divider} />

          {/* 위트 문구 */}
          <Text style={popStyles.witText}>{witText}</Text>

          {/* 확인 버튼 */}
          <TouchableOpacity style={[popStyles.okBtn, { backgroundColor: accentColor }]} onPress={onClose}>
            <Text style={popStyles.okTxt}>알겠어요!</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const popStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff', borderRadius: 36, padding: 28,
    width: '85%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 12,
  },
  closeBtn: { position: 'absolute', top: 16, right: 16, padding: 4, zIndex: 10 },
  iconCircle: {
    width: 84, height: 84, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  mainText: { fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  subText: { fontSize: 14, color: '#8A7C9C', textAlign: 'center', marginBottom: 14 },
  divider: { width: '100%', height: 1, backgroundColor: '#FFF5F8', marginBottom: 14 },
  witText: { fontSize: 16, color: COLORS.text, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  okBtn: { borderRadius: 24, paddingHorizontal: 36, paddingVertical: 17 },
  okTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
});

// ─── 음식 카드 ────────────────────────────────────────────────────────────────
function FoodCard({ item, locked, onPress }: { item: FoodItem; locked: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[cardStyles.card, locked && cardStyles.lockedCard]}
      onPress={onPress}
      activeOpacity={locked ? 1 : 0.7}
    >
      {locked && (
        <View style={cardStyles.lockOverlay}>
          <Icon name="lock" size={20} color={COLORS.primary} />
        </View>
      )}
      <View style={[cardStyles.iconWrap, { backgroundColor: COLORS.primary + '15' }]}>
        <Icon name={item.icon} size={26} color={COLORS.primary} />
      </View>
      <Text style={[cardStyles.name, locked && cardStyles.lockedText]} numberOfLines={2}>{item.name}</Text>
      <Text style={[cardStyles.kcal, locked && cardStyles.lockedText]}>{item.kcal}kcal</Text>
    </TouchableOpacity>
  );
}

// ─── 운동 카드 ────────────────────────────────────────────────────────────────
function ExerciseCard({ item, locked, onPress }: { item: ExerciseItem; locked: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[cardStyles.card, cardStyles.exerciseCard, locked && cardStyles.lockedCard]}
      onPress={onPress}
      activeOpacity={locked ? 1 : 0.7}
    >
      {locked && (
        <View style={cardStyles.lockOverlay}>
          <Icon name="lock" size={20} color={COLORS.success} />
        </View>
      )}
      <View style={[cardStyles.iconWrap, { backgroundColor: COLORS.success + '15' }]}>
        <Icon name={item.icon} size={26} color={COLORS.success} />
      </View>
      <Text style={[cardStyles.name, locked && cardStyles.lockedText]} numberOfLines={2}>{item.name}</Text>
      <Text style={[cardStyles.kcalEx, locked && cardStyles.lockedText]}>-{item.kcal}kcal</Text>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: '31%',
    backgroundColor: '#FFF5F5',
    borderRadius: 24, paddingVertical: 17, paddingHorizontal: 10,
    alignItems: 'center', marginBottom: 10,
    borderWidth: 1.5, borderColor: COLORS.primary + '30',
    position: 'relative', overflow: 'hidden',
    minHeight: 124,
    justifyContent: 'center',
  },
  exerciseCard: {
    backgroundColor: '#F0FFF4',
    borderColor: COLORS.success + '40',
  },
  lockedCard: { opacity: 0.55 },
  lockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 10,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 4 },
  lockedText: { color: '#D4C5DC' },
  kcal: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  kcalEx: { fontSize: 15, fontWeight: '800', color: COLORS.success },
});

// ─── 메인 화면 ────────────────────────────────────────────────────────────────
export default function IfCalcScreen() {
  const navigation = useNavigation<any>();
  const { isPremium } = useSubscription();
  const { goalData, avgData, fetch: fetchGoal } = useWeightGoal();

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupType, setPopupType] = useState<'food' | 'exercise'>('food');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseItem | null>(null);

  // 운동 탭에서 비교할 기준 음식 (소주 기본값)
  const [compareFood] = useState<FoodItem>(FOODS.find(f => f.id === 'soju')!);

  useFocusEffect(
    useCallback(() => {
      fetchGoal();
    }, [fetchGoal])
  );

  const hasGoal = goalData.currentWeight != null && goalData.goalWeight != null;
  const hasDeficit = avgData.averageDeficit > 0;

  const handleFoodPress = (item: FoodItem, locked: boolean) => {
    if (locked) {
      // 프리미엄 안내 (PremiumModal 없이 간단히)
      return;
    }
    if (!hasGoal) return; // 목표 미설정 시 무시 (배너에서 처리)
    setSelectedFood(item);
    setPopupType('food');
    setPopupVisible(true);
  };

  const handleExercisePress = (item: ExerciseItem, locked: boolean) => {
    if (locked) return;
    if (!hasGoal) return;
    setSelectedExercise(item);
    setPopupType('exercise');
    setPopupVisible(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Icon name="calc" size={22} color={COLORS.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>만약에 계산기</Text>
            <Text style={styles.headerSub}>먹으면? 운동하면? 결과를 확인해보세요</Text>
          </View>
        </View>

        {/* 목표 체중 미설정 잠금 배너 */}
        {!hasGoal && (
          <TouchableOpacity
            style={styles.lockBanner}
            onPress={() => navigation.navigate('Weight')}
            activeOpacity={0.8}
          >
            <Icon name="lock" size={18} color={COLORS.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lockBannerTitle}>목표 체중을 먼저 설정해주세요</Text>
              <Text style={styles.lockBannerSub}>탭해서 체중 목표 설정하기 →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 데이터 부족 안내 */}
        {hasGoal && !hasDeficit && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>식사 기록이 쌓이면 더 정확해져요</Text>
            <Text style={styles.infoBannerSub}>현재 평균 칼로리 적자 기준으로 계산돼요</Text>
          </View>
        )}

        {/* 칼로리 현황 */}
        {hasGoal && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>현재 체중</Text>
              <Text style={styles.statVal}>{goalData.currentWeight}kg</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>목표 체중</Text>
              <Text style={[styles.statVal, { color: COLORS.success }]}>{goalData.goalWeight}kg</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>일평균 적자</Text>
              <Text style={[styles.statVal, { color: avgData.averageDeficit > 0 ? COLORS.success : COLORS.primary }]}>
                {avgData.averageDeficit > 0 ? avgData.averageDeficit : 0}kcal
              </Text>
            </View>
          </View>
        )}

        {/* ─── 음식 섹션 ─── */}
        <FadeInView delay={0}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>만약에 내가 먹으면?</Text>
            <Text style={styles.sectionDesc}>카드를 탭해서 목표일 변화를 확인해보세요</Text>
            <View style={styles.cardGrid}>
              {FOODS.map((food, idx) => {
                const locked = !isPremium && idx >= FREE_FOOD_COUNT;
                return (
                  <FoodCard
                    key={food.id}
                    item={food}
                    locked={locked}
                    onPress={() => handleFoodPress(food, locked)}
                  />
                );
              })}
            </View>
            {!isPremium && (
              <View style={styles.premiumHint}>
                <Text style={styles.premiumHintText}>프리미엄: 모든 음식 카드 보기</Text>
              </View>
            )}
          </View>
        </FadeInView>

        {/* ─── 운동 섹션 ─── */}
        <FadeInView delay={120}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>만약에 운동하면?</Text>
            <Text style={styles.sectionDesc}>운동 후 소주 1잔 기준으로 상쇄량을 계산해요</Text>
            <View style={styles.cardGrid}>
              {EXERCISES.map((ex, idx) => {
                const locked = !isPremium && idx >= FREE_EXERCISE_COUNT;
                return (
                  <ExerciseCard
                    key={ex.id}
                    item={ex}
                    locked={locked}
                    onPress={() => handleExercisePress(ex, locked)}
                  />
                );
              })}
            </View>
            {!isPremium && (
              <View style={styles.premiumHint}>
                <Text style={styles.premiumHintText}>프리미엄: 모든 운동 카드 보기</Text>
              </View>
            )}
          </View>
        </FadeInView>
      </ScrollView>

      {/* 결과 팝업 */}
      <ResultPopup
        visible={popupVisible}
        type={popupType}
        item={popupType === 'food' ? selectedFood : selectedExercise}
        compareItem={compareFood}
        averageDeficit={avgData.averageDeficit}
        onClose={() => setPopupVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 88 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22,
  },
  headerIconWrap: {
    width: 48, height: 48, borderRadius: 999,
    backgroundColor: COLORS.lavender, alignItems: 'center', justifyContent: 'center',
  },
  backBtn: { padding: 4 },
  backTxt: { fontSize: 32, color: COLORS.text, fontWeight: '300', lineHeight: 36 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 15, color: '#8A7C9C', marginTop: 2 },
  lockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFE8EF', borderRadius: 24, padding: 16, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#F5C99B',
  },
  lockBannerEmoji: { fontSize: 28 },
  lockBannerTitle: { fontSize: 16, fontWeight: '700', color: '#A98ED1' },
  lockBannerSub: { fontSize: 14, color: '#F5C99B', marginTop: 2 },
  infoBanner: {
    backgroundColor: '#E6DAF5', borderRadius: 22, padding: 14, marginBottom: 12,
  },
  infoBannerText: { fontSize: 15, fontWeight: '700', color: '#1565C0' },
  infoBannerSub: { fontSize: 13, color: '#1565C0', marginTop: 3, opacity: 0.8 },
  statsRow: {
    flexDirection: 'row', gap: 8, marginBottom: 20,
  },
  statBox: {
    flex: 1, backgroundColor: '#fff', borderRadius: 22, padding: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statLabel: { fontSize: 13, color: '#8A7C9C', fontWeight: '600', marginBottom: 4 },
  statVal: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  section: {
    backgroundColor: '#fff', borderRadius: 28, padding: 18, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  sectionDesc: { fontSize: 15, color: '#8A7C9C', marginBottom: 16 },
  cardGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', gap: 0,
    rowGap: 8,
  },
  premiumHint: {
    backgroundColor: '#FFE8EF', borderRadius: 18,
    padding: 10, alignItems: 'center', marginTop: 4,
    borderWidth: 1, borderColor: '#FFE082',
  },
  premiumHintText: { fontSize: 14, color: '#F57F17', fontWeight: '600' },
});
