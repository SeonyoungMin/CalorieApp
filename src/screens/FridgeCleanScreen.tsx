import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, Animated, Easing,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme';
import Icon, { IconName } from '../components/Icon';
import CuteLoader from '../components/CuteLoader';
import FadeInView from '../components/FadeInView';
import { recommendFridgeMenu, FridgeRecommendation } from '../services/claudeService';

const SUGGEST: { label: string; icon: IconName }[] = [
  { label: '계란',    icon: 'food' },
  { label: '두부',    icon: 'food' },
  { label: '닭가슴살', icon: 'fire' },
  { label: '브로콜리', icon: 'carrot' },
  { label: '양파',    icon: 'carrot' },
  { label: '당근',    icon: 'carrot' },
  { label: '토마토',  icon: 'apple' },
  { label: '버섯',    icon: 'food' },
  { label: '시금치',  icon: 'carrot' },
  { label: '오이',    icon: 'carrot' },
];

// ─── 둥둥 떠다니는 냉장고 아이콘 (귀여운 진입 모션) ───────────────────────
function BouncingFridge() {
  const float = useRef(new Animated.Value(0)).current;
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;
  const sparkle3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    const sparkleAnim = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 600, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.delay(1000 - delay),
        ]),
      );
    sparkleAnim(sparkle1, 0).start();
    sparkleAnim(sparkle2, 350).start();
    sparkleAnim(sparkle3, 700).start();
  }, [float, sparkle1, sparkle2, sparkle3]);

  const ty = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const rot = float.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });

  const sparkStyle = (v: Animated.Value, x: number, y: number, size: number) => ({
    position: 'absolute' as const,
    left: x,
    top: y,
    opacity: v,
    transform: [
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
    ],
  });

  return (
    <View style={bouncingStyles.wrap}>
      <Animated.View style={[bouncingStyles.center, { transform: [{ translateY: ty }, { rotate: rot }] }]}>
        <View style={bouncingStyles.circle}>
          <Icon name="fridge" size={56} color={COLORS.water} />
        </View>
      </Animated.View>
      <Animated.View style={sparkStyle(sparkle1, 18, 6, 18)}>
        <Icon name="sparkles" size={18} color={COLORS.warning} />
      </Animated.View>
      <Animated.View style={sparkStyle(sparkle2, 220, 24, 14)}>
        <Icon name="sparkles" size={14} color={COLORS.primary} />
      </Animated.View>
      <Animated.View style={sparkStyle(sparkle3, 200, 110, 16)}>
        <Icon name="sparkles" size={16} color={COLORS.secondary} />
      </Animated.View>
    </View>
  );
}

const bouncingStyles = StyleSheet.create({
  wrap: { width: 260, height: 150, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 10 },
  center: { alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 120, height: 120, borderRadius: 999,
    backgroundColor: '#E3F2FD',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.water,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
});

// ─── 메인 화면 ───────────────────────────────────────────────────────────
export default function FridgeCleanScreen() {
  const { goalKcal } = useAuth();
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FridgeRecommendation | null>(null);

  const addIngredient = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (ingredients.includes(v)) {
      setInput('');
      return;
    }
    setIngredients(prev => [...prev, v]);
    setInput('');
  };

  const removeIngredient = (idx: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  const handleRecommend = async () => {
    if (ingredients.length === 0) {
      Alert.alert('재료를 추가해주세요', '냉장고에 있는 재료를 1개 이상 입력해주세요!');
      return;
    }
    setLoading(true);
    try {
      const res = await recommendFridgeMenu(ingredients, goalKcal || 2000);
      setResult(res);
    } catch (e: any) {
      Alert.alert('추천 실패', e?.message || 'AI가 잠시 쉬고 있어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
  };

  // 결과 화면
  if (result) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 88 }}>
        <FadeInView delay={0}>
          <View style={styles.resultHeader}>
            <View style={styles.resultHeaderIcon}>
              <Icon name="fridge" size={22} color={COLORS.water} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle}>AI 추천 메뉴 {result.menus.length}개</Text>
              <Text style={styles.resultSub}>{result.note}</Text>
            </View>
          </View>
        </FadeInView>

        {result.menus.map((menu, idx) => (
          <FadeInView key={idx} delay={120 + idx * 100}>
            <View style={styles.menuCard}>
              <View style={styles.menuHead}>
                <Text style={styles.menuName} numberOfLines={2}>{menu.name}</Text>
                <View style={styles.menuKcalBadge}>
                  <Text style={styles.menuKcalText}>{menu.kcal} kcal</Text>
                </View>
              </View>
              <Text style={styles.menuDesc}>{menu.description}</Text>

              <View style={styles.menuMetaRow}>
                <View style={styles.menuMeta}>
                  <Icon name="clock" size={12} color={COLORS.subText} />
                  <Text style={styles.menuMetaText}>{menu.time}</Text>
                </View>
                <View style={styles.menuMeta}>
                  <Icon name="fire" size={12} color={COLORS.warning} />
                  <Text style={styles.menuMetaText}>{menu.difficulty}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>재료</Text>
              <View style={styles.ingChips}>
                {menu.ingredients.map((ing, i) => (
                  <View key={i} style={styles.ingChip}>
                    <Text style={styles.ingChipText}>{ing}</Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>레시피</Text>
              <View style={{ gap: 8 }}>
                {menu.steps.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step.replace(/^\d+\.\s*/, '')}</Text>
                  </View>
                ))}
              </View>

              {menu.tip ? (
                <View style={styles.tipBox}>
                  <Icon name="sparkles" size={14} color={COLORS.primaryDark} />
                  <Text style={styles.tipText}>{menu.tip}</Text>
                </View>
              ) : null}
            </View>
          </FadeInView>
        ))}

        <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.85}>
          <Text style={styles.resetBtnText}>다른 재료로 다시 추천받기</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // 입력 화면
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 88 }} keyboardShouldPersistTaps="handled">
        {/* 헤더 */}
        <FadeInView delay={0}>
          <BouncingFridge />
          <Text style={styles.heroTitle}>냉장고 비우기</Text>
          <Text style={styles.heroDesc}>
            냉장고에 있는 재료를 알려주세요!{'\n'}AI가 다이어트 메뉴를 추천해드려요.
          </Text>
        </FadeInView>

        {loading && (
          <FadeInView delay={0}>
            <CuteLoader
              message="AI가 메뉴를 고르는 중이에요..."
              icon="fridge"
              color={COLORS.water}
              size="lg"
            />
          </FadeInView>
        )}

        {!loading && (
          <>
            {/* 입력 카드 */}
            <FadeInView delay={120}>
              <View style={styles.inputCard}>
                <Text style={styles.cardTitle}>재료 입력</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="예: 계란, 양파, 두부..."
                    placeholderTextColor={COLORS.inactive}
                    onSubmitEditing={() => addIngredient(input)}
                    returnKeyType="done"
                    blurOnSubmit={false}
                  />
                  <TouchableOpacity
                    style={[styles.addBtn, !input.trim() && { opacity: 0.4 }]}
                    onPress={() => addIngredient(input)}
                    disabled={!input.trim()}
                    activeOpacity={0.85}
                  >
                    <Icon name="plus" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* 빠른 추가 */}
                <Text style={styles.quickLabel}>자주 쓰는 재료</Text>
                <View style={styles.suggestRow}>
                  {SUGGEST.map(s => {
                    const added = ingredients.includes(s.label);
                    return (
                      <TouchableOpacity
                        key={s.label}
                        style={[styles.suggestChip, added && styles.suggestChipOn]}
                        onPress={() => added
                          ? removeIngredient(ingredients.indexOf(s.label))
                          : addIngredient(s.label)
                        }
                        activeOpacity={0.7}
                      >
                        <Icon
                          name={added ? 'check' : s.icon}
                          size={12}
                          color={added ? '#fff' : COLORS.water}
                        />
                        <Text style={[styles.suggestText, added && styles.suggestTextOn]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </FadeInView>

            {/* 추가된 재료 칩 */}
            {ingredients.length > 0 && (
              <FadeInView delay={120}>
                <View style={styles.selectedCard}>
                  <Text style={styles.cardTitle}>추가된 재료 ({ingredients.length})</Text>
                  <View style={styles.selectedChips}>
                    {ingredients.map((ing, i) => (
                      <TouchableOpacity
                        key={`${ing}-${i}`}
                        style={styles.selectedChip}
                        onPress={() => removeIngredient(i)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.selectedChipText}>{ing}</Text>
                        <Icon name="close" size={12} color={COLORS.primaryDark} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </FadeInView>
            )}

            {/* 추천 버튼 */}
            <FadeInView delay={240}>
              <TouchableOpacity
                style={[styles.recommendBtn, ingredients.length === 0 && { opacity: 0.45 }]}
                onPress={handleRecommend}
                disabled={ingredients.length === 0}
                activeOpacity={0.85}
              >
                <Icon name="sparkles" size={18} color="#fff" />
                <Text style={styles.recommendBtnText}>AI에게 메뉴 추천받기</Text>
              </TouchableOpacity>
            </FadeInView>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // 헤더
  heroTitle: {
    fontSize: 24, fontWeight: '900', color: COLORS.text,
    textAlign: 'center', marginBottom: 8,
  },
  heroDesc: {
    fontSize: 16, color: COLORS.subText, textAlign: 'center', lineHeight: 22,
    marginBottom: 24,
  },

  // 입력 카드
  inputCard: {
    backgroundColor: COLORS.card, borderRadius: 26, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  input: {
    flex: 1, backgroundColor: COLORS.cardSoft, borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 15,
    fontSize: 16, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 999, backgroundColor: COLORS.water,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.water, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },

  // 빠른 추가
  quickLabel: { fontSize: 14, fontWeight: '700', color: COLORS.subText, marginBottom: 8 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.water + '40',
  },
  suggestChipOn: {
    backgroundColor: COLORS.water,
    borderColor: COLORS.water,
  },
  suggestText: { fontSize: 14, fontWeight: '700', color: COLORS.water },
  suggestTextOn: { color: '#fff' },

  // 선택 재료
  selectedCard: {
    backgroundColor: COLORS.card, borderRadius: 26, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  selectedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.pinkSoft,
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 999,
  },
  selectedChipText: { fontSize: 15, fontWeight: '700', color: COLORS.primaryDark },

  // 추천 버튼
  recommendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 24, paddingVertical: 18,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  recommendBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },

  // 결과 헤더
  resultHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
  },
  resultHeaderIcon: {
    width: 48, height: 48, borderRadius: 999,
    backgroundColor: '#E3F2FD',
    alignItems: 'center', justifyContent: 'center',
  },
  resultTitle: { fontSize: 19, fontWeight: '900', color: COLORS.text },
  resultSub: { fontSize: 14, color: COLORS.subText, marginTop: 2 },

  // 메뉴 카드
  menuCard: {
    backgroundColor: COLORS.card, borderRadius: 26, padding: 20, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  menuHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  menuName: { flex: 1, fontSize: 18, fontWeight: '900', color: COLORS.text },
  menuKcalBadge: {
    backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
  },
  menuKcalText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  menuDesc: { fontSize: 15, color: COLORS.subText, lineHeight: 19, marginBottom: 10 },

  menuMetaRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  menuMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.cardSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  menuMetaText: { fontSize: 13, fontWeight: '700', color: COLORS.subText },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },

  sectionLabel: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  ingChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ingChip: {
    backgroundColor: COLORS.lavender,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  ingChipText: { fontSize: 13, fontWeight: '700', color: COLORS.purpleDark },

  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: {
    width: 24, height: 24, borderRadius: 999, backgroundColor: COLORS.pinkSoft,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  stepNumText: { fontSize: 13, fontWeight: '900', color: COLORS.primaryDark },
  stepText: { flex: 1, fontSize: 15, color: COLORS.text, lineHeight: 20 },

  tipBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.lavender,
    paddingHorizontal: 12, paddingVertical: 13, borderRadius: 16,
    marginTop: 14,
  },
  tipText: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.purpleDark, lineHeight: 18 },

  resetBtn: {
    backgroundColor: COLORS.cardSoft, borderRadius: 22, paddingVertical: 17,
    alignItems: 'center', marginTop: 8,
  },
  resetBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
});
