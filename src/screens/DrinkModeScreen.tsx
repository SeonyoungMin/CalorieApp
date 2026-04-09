import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../theme';
import { useSubscription } from '../hooks/useSubscription';
import PremiumModal from '../components/PremiumModal';
import { saveMeal, saveDrinkSchedule, getUpcomingDrinkSchedules } from '../api/api';
import {
  DRINK_TYPES,
  COMPARE_ITEMS,
  HANGOVER_MENUS,
  createDrinkChannel,
  scheduleEveNotification,
  scheduleMorningNotification,
  notifyDrinkCount,
  cancelDrinkNotificationsForDate,
} from '../services/drinkNotificationService';
import { requestNotificationPermission } from '../services/mealPhotoNotificationService';

type Tab = 'calc' | 'schedule';

interface DrinkItem {
  id: string;
  name: string;
  unit: string;
  kcal: number;
  count: number;
}

interface UpcomingSchedule {
  id: number;
  scheduledDate: string;
  memo: string;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function getCompareText(totalKcal: number): string {
  if (totalKcal === 0) return '';
  for (const item of [...COMPARE_ITEMS].sort((a, b) => b.kcal - a.kcal)) {
    if (totalKcal >= item.kcal * 0.9) {
      const ratio = (totalKcal / item.kcal).toFixed(1);
      return `${item.name} ${ratio}개 분량이에요`;
    }
  }
  const espresso = COMPARE_ITEMS[1]; // 아메리카노 10kcal
  const cups = Math.round(totalKcal / espresso.kcal);
  return `아메리카노 ${cups}잔 분량이에요`;
}

function getWarningText(drinkName: string, count: number, totalKcal: number): string {
  const pork = COMPARE_ITEMS[2].kcal; // 삼겹살 600kcal
  const rice = COMPARE_ITEMS[0].kcal; // 밥 300kcal
  if (totalKcal >= pork) {
    const ratio = (totalKcal / pork).toFixed(1);
    return `${drinkName} ${count}잔 = 삼겹살 ${ratio}인분. 그래도 드실 건가요? 🐷`;
  }
  if (totalKcal >= rice) {
    const cnt = (totalKcal / rice).toFixed(1);
    return `${drinkName} ${count}잔 = 밥 ${cnt}공기. 그래도 드실 건가요? 🍚`;
  }
  return '';
}

export default function DrinkModeScreen() {
  const { isPremium, purchasePremium, cancelPremium } = useSubscription();
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [tab, setTab] = useState<Tab>('calc');

  // ── 계산기 상태 ───────────────────────────────────────────────────────────
  const [drinks, setDrinks] = useState<DrinkItem[]>(
    DRINK_TYPES.map(d => ({ ...d, count: 0 })),
  );
  const [saving, setSaving] = useState(false);

  // ── 예정일 상태 ───────────────────────────────────────────────────────────
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleMemo, setScheduleMemo] = useState('');
  const [upcomingList, setUpcomingList] = useState<UpcomingSchedule[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      createDrinkChannel().catch(() => {});
      fetchUpcoming();
    }, []),
  );

  async function fetchUpcoming() {
    try {
      const res = await getUpcomingDrinkSchedules();
      setUpcomingList(res.data || []);
    } catch {}
  }

  // ── 잔 수 증감 ────────────────────────────────────────────────────────────
  async function changeCount(id: string, delta: number) {
    const updated = drinks.map(d =>
      d.id === id ? { ...d, count: Math.max(0, d.count + delta) } : d,
    );
    setDrinks(updated);

    // 실시간 알림 (프리미엄 + 잔 수 증가 시)
    if (delta > 0 && isPremium) {
      const drink = updated.find(d => d.id === id)!;
      if (drink.count > 0) {
        const total = updated.reduce((sum, d) => sum + d.kcal * d.count, 0);
        try {
          await notifyDrinkCount(drink.name, drink.count, total);
        } catch {}
      }
    }
  }

  // ── 총 칼로리 ─────────────────────────────────────────────────────────────
  const totalKcal = drinks.reduce((sum, d) => sum + d.kcal * d.count, 0);
  const activeDrink = drinks.filter(d => d.count > 0).sort((a, b) => b.count - a.count)[0];
  const warningText =
    activeDrink && totalKcal > 0
      ? getWarningText(activeDrink.name, activeDrink.count, totalKcal)
      : '';
  const compareText = getCompareText(totalKcal);

  // ── 칼로리 저장 (오늘 식사에 합산) ───────────────────────────────────────
  async function handleSaveCalories() {
    if (totalKcal === 0) {
      Alert.alert('잔 수를 입력해주세요', '술 종류와 잔 수를 선택하세요.');
      return;
    }
    setSaving(true);
    try {
      const foods = drinks
        .filter(d => d.count > 0)
        .map(d => ({ foodName: `${d.name} ${d.count}${d.unit}`, kcal: d.kcal * d.count }));

      await saveMeal({
        mealType: 'SNACK',
        totalKcal,
        isText: false,
        foods,
        logDate: todayStr(),
      });
      Alert.alert('저장 완료 🍺', `${totalKcal}kcal가 오늘 식사에 추가됐어요!`);
      setDrinks(drinks.map(d => ({ ...d, count: 0 })));
    } catch {
      Alert.alert('저장 실패', '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  // ── 예정일 저장 ────────────────────────────────────────────────────────────
  async function handleSaveSchedule() {
    if (!scheduleDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('날짜 형식 오류', 'YYYY-MM-DD 형식으로 입력해주세요. 예: 2026-04-15');
      return;
    }
    setScheduleLoading(true);
    try {
      await saveDrinkSchedule({ scheduledDate: scheduleDate, memo: scheduleMemo });

      // 프리미엄: 알림 스케줄
      if (isPremium) {
        const granted = await requestNotificationPermission();
        if (granted) {
          await scheduleEveNotification(scheduleDate);
          await scheduleMorningNotification(scheduleDate);
        }
      }

      Alert.alert(
        '회식 예정일 저장 완료! 🍺',
        isPremium
          ? '전날 밤 9시, 다음날 아침 8시 알림이 설정됐어요!'
          : '저장됐어요!\n(알림 기능은 프리미엄에서 사용 가능해요)',
      );
      setScheduleDate('');
      setScheduleMemo('');
      fetchUpcoming();
    } catch {
      Alert.alert('저장 실패', '잠시 후 다시 시도해주세요.');
    } finally {
      setScheduleLoading(false);
    }
  }

  // ── 예정일 취소 ────────────────────────────────────────────────────────────
  async function handleCancelSchedule(item: UpcomingSchedule) {
    Alert.alert('예정일 취소', `${item.scheduledDate} 회식 예정을 취소할까요?`, [
      { text: '아니오', style: 'cancel' },
      {
        text: '취소',
        style: 'destructive',
        onPress: async () => {
          await cancelDrinkNotificationsForDate(item.scheduledDate);
          fetchUpcoming();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🍺 술자리 모드</Text>
        <Text style={styles.subtitle}>칼로리 계산 + 회식 알림</Text>
      </View>

      {/* Tab */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'calc' && styles.tabActive]}
          onPress={() => setTab('calc')}
        >
          <Text style={[styles.tabText, tab === 'calc' && styles.tabTextActive]}>
            칼로리 계산
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'schedule' && styles.tabActive]}
          onPress={() => setTab('schedule')}
        >
          <Text style={[styles.tabText, tab === 'schedule' && styles.tabTextActive]}>
            회식 예정일
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── 계산기 탭 ───────────────────────────────────────────────────── */}
        {tab === 'calc' && (
          <>
            {/* 총 칼로리 카드 */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>총 섭취 칼로리</Text>
              <Text style={styles.totalKcal}>{totalKcal.toLocaleString()} kcal</Text>
              {compareText ? (
                <Text style={styles.compareText}>≈ {compareText}</Text>
              ) : null}
            </View>

            {/* 경고 문구 */}
            {warningText ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningText}>{warningText}</Text>
              </View>
            ) : null}

            {/* 술 종류 목록 */}
            {drinks.map(drink => (
              <View key={drink.id} style={styles.drinkRow}>
                <View style={styles.drinkInfo}>
                  <Text style={styles.drinkName}>{drink.name}</Text>
                  <Text style={styles.drinkMeta}>
                    {drink.unit} · {drink.kcal}kcal
                  </Text>
                </View>
                <View style={styles.counter}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => changeCount(drink.id, -1)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.counterBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterCount}>{drink.count}</Text>
                  <TouchableOpacity
                    style={[styles.counterBtn, styles.counterBtnPlus]}
                    onPress={() => changeCount(drink.id, 1)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.counterBtnText, { color: '#fff' }]}>＋</Text>
                  </TouchableOpacity>
                </View>
                {drink.count > 0 && (
                  <Text style={styles.drinkSubtotal}>
                    {(drink.kcal * drink.count).toLocaleString()}
                  </Text>
                )}
              </View>
            ))}

            {/* 비교 기준 안내 */}
            <View style={styles.compareBox}>
              <Text style={styles.compareTitle}>📊 비교 기준</Text>
              {COMPARE_ITEMS.map(item => (
                <Text key={item.name} style={styles.compareItem}>
                  {item.name}: {item.kcal}kcal
                </Text>
              ))}
            </View>

            {/* 저장 버튼 */}
            <TouchableOpacity
              style={[styles.saveBtn, totalKcal === 0 && styles.saveBtnDisabled]}
              onPress={handleSaveCalories}
              disabled={totalKcal === 0 || saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  오늘 칼로리에 합산하기 ({totalKcal}kcal)
                </Text>
              )}
            </TouchableOpacity>

            {/* 프리미엄: 실시간 알림 안내 */}
            {!isPremium && (
              <TouchableOpacity
                style={styles.premiumHint}
                onPress={() => setPremiumVisible(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.premiumHintText}>
                  👑 프리미엄: 잔 수 누를 때마다 실시간 알림 받기
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── 예정일 탭 ───────────────────────────────────────────────────── */}
        {tab === 'schedule' && (
          <>
            {/* 날짜 입력 */}
            <View style={styles.scheduleCard}>
              <Text style={styles.sectionTitle}>회식 날짜 추가</Text>
              <Text style={styles.inputLabel}>날짜 (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={scheduleDate}
                onChangeText={setScheduleDate}
                placeholder="예: 2026-04-15"
                placeholderTextColor="#B0BEC5"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
              <Text style={styles.inputLabel}>메모 (선택)</Text>
              <TextInput
                style={styles.input}
                value={scheduleMemo}
                onChangeText={setScheduleMemo}
                placeholder="예: 팀 회식, 친구 모임"
                placeholderTextColor="#B0BEC5"
                maxLength={50}
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveSchedule}
                disabled={scheduleLoading}
                activeOpacity={0.85}
              >
                {scheduleLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>저장하기</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* 프리미엄 알림 안내 */}
            {!isPremium ? (
              <TouchableOpacity
                style={styles.premiumScheduleBanner}
                onPress={() => setPremiumVisible(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.premiumScheduleEmoji}>👑</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.premiumScheduleTitle}>프리미엄: 알림 3종 자동 설정</Text>
                  <Text style={styles.premiumScheduleDesc}>
                    전날 밤 9시 절약 알림 · 다음날 아침 해장 추천
                  </Text>
                </View>
                <Text style={styles.premiumScheduleArrow}>›</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.premiumActiveBox}>
                <Text style={styles.premiumActiveText}>
                  ✅ 프리미엄: 저장 시 알림 2개가 자동 설정돼요
                </Text>
                <Text style={styles.premiumActiveDesc}>
                  • 전날 밤 9시: 칼로리 절약 알림{'\n'}
                  • 다음날 아침 8시: 해장 메뉴 추천
                </Text>
              </View>
            )}

            {/* 예정 목록 */}
            {upcomingList.length > 0 && (
              <View style={styles.upcomingSection}>
                <Text style={styles.sectionTitle}>예정된 회식</Text>
                {upcomingList.map(item => (
                  <View key={item.id} style={styles.upcomingItem}>
                    <Text style={styles.upcomingDate}>🍺 {item.scheduledDate}</Text>
                    {item.memo ? (
                      <Text style={styles.upcomingMemo}>{item.memo}</Text>
                    ) : null}
                    <TouchableOpacity
                      onPress={() => handleCancelSchedule(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.upcomingCancel}>취소</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* 해장 메뉴 안내 */}
            <View style={styles.hangoverBox}>
              <Text style={styles.sectionTitle}>🌅 해장 메뉴 추천</Text>
              {HANGOVER_MENUS.map(m => (
                <View key={m.name} style={styles.hangoverRow}>
                  <Text style={styles.hangoverName}>{m.name}</Text>
                  <Text style={styles.hangoverKcal}>{m.kcal}kcal</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <PremiumModal
        visible={premiumVisible}
        onClose={() => setPremiumVisible(false)}
        isPremium={isPremium}
        onSubscribe={async () => { await purchasePremium(); setPremiumVisible(false); }}
        onCancel={async () => { await cancelPremium(); setPremiumVisible(false); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: '#78909C', marginTop: 4 },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#E8EEF4',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#78909C' },
  tabTextActive: { color: COLORS.text, fontWeight: '800' },

  content: { paddingHorizontal: 16, paddingBottom: 60 },

  // 총 칼로리 카드
  totalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
  },
  totalLabel: { fontSize: 13, color: '#78909C', fontWeight: '600' },
  totalKcal: { fontSize: 42, fontWeight: '900', color: COLORS.primary, marginTop: 4 },
  compareText: { fontSize: 13, color: '#78909C', marginTop: 4 },

  // 경고 카드
  warningCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  warningText: { fontSize: 14, color: '#E65100', fontWeight: '600', lineHeight: 20 },

  // 술 종류 행
  drinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    elevation: 2,
    gap: 10,
  },
  drinkInfo: { flex: 1 },
  drinkName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  drinkMeta: { fontSize: 12, color: '#78909C', marginTop: 2 },
  drinkSubtotal: { fontSize: 13, fontWeight: '700', color: COLORS.primary, minWidth: 44, textAlign: 'right' },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F0F4F8',
    justifyContent: 'center', alignItems: 'center',
  },
  counterBtnPlus: { backgroundColor: COLORS.primary },
  counterBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  counterCount: { fontSize: 18, fontWeight: '800', color: COLORS.text, minWidth: 28, textAlign: 'center' },

  // 비교 기준
  compareBox: {
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  compareTitle: { fontSize: 13, fontWeight: '700', color: '#78909C', marginBottom: 6 },
  compareItem: { fontSize: 13, color: '#78909C', marginTop: 2 },

  // 저장 버튼
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveBtnDisabled: { backgroundColor: '#B0BEC5' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // 프리미엄 힌트 (계산기 탭)
  premiumHint: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCC419',
    marginBottom: 8,
  },
  premiumHintText: { fontSize: 13, color: '#F59F00', fontWeight: '600' },

  // 예정일 탭
  scheduleCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#78909C', marginBottom: 6 },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 14,
  },

  premiumScheduleBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF8E1', borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1.5, borderColor: '#FCC419',
  },
  premiumScheduleEmoji: { fontSize: 26 },
  premiumScheduleTitle: { fontSize: 14, fontWeight: '800', color: '#2C3E50' },
  premiumScheduleDesc: { fontSize: 12, color: '#78909C', marginTop: 2, flexShrink: 1 },
  premiumScheduleArrow: { fontSize: 20, color: '#FCC419', fontWeight: '700' },

  premiumActiveBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  premiumActiveText: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
  premiumActiveDesc: { fontSize: 12, color: '#4CAF50', marginTop: 6, lineHeight: 20 },

  upcomingSection: { marginBottom: 14 },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    elevation: 2,
    gap: 10,
  },
  upcomingDate: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  upcomingMemo: { fontSize: 12, color: '#78909C', flexShrink: 1 },
  upcomingCancel: { fontSize: 13, color: '#FF5252', fontWeight: '700' },

  hangoverBox: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    elevation: 2,
  },
  hangoverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F7FA',
  },
  hangoverName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  hangoverKcal: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
});
