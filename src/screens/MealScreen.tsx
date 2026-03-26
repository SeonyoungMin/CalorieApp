import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayMeals, getMealsByDate, saveMeal, deleteMeal, deleteAllTodayMeals } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';

const COLORS = {
  primary: '#FF6B6B',
  secondary: '#4ECDC4',
  success: '#51CF66',
  warning: '#FCC419',
  bg: '#F0F4F8',
  card: '#FFFFFF',
  text: '#2C3E50',
};

const MEAL_TYPES = ['아침', '점심', '저녁', '간식'];
const MEAL_EMOJI: Record<string, string> = {
  아침: '🌅',
  점심: '☀️',
  저녁: '🌙',
  간식: '🍪',
};

interface Food {
  foodId?: number;
  foodName: string;
  kcal: number;
}

interface Meal {
  mealId: number;
  mealType: string;
  totalKcal: number;
  isText: boolean;
  logDate: string;
  logTime: string;
  foods: Food[];
}

const todayStr = () => new Date().toISOString().split('T')[0];

const dateLabel = (d: string) => {
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (d === today) return '오늘';
  if (d === yesterday) return '어제';
  return d;
};

export default function MealScreen() {
  const { goalKcal } = useAuth();
  const { isPremium } = useSubscription();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewDate, setViewDate] = useState(todayStr());
  const [memo, setMemo] = useState('');
  const [memoEdit, setMemoEdit] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [datePickerInput, setDatePickerInput] = useState('');

  // Form state
  const [mealType, setMealType] = useState('아침');
  const [logDate, setLogDate] = useState(todayStr());
  const [foods, setFoods] = useState<{ foodName: string; kcal: string }[]>([
    { foodName: '', kcal: '' },
  ]);

  const fetchMeals = useCallback(async (date: string) => {
    try {
      const [res, savedMemo] = await Promise.all([
        date === todayStr() ? getTodayMeals() : getMealsByDate(date),
        AsyncStorage.getItem(`meal_memo_${date}`),
      ]);
      setMeals(res.data || []);
      setMemo(savedMemo || '');
      setMemoEdit(false);
    } catch {
      //
    }
  }, []);

  const saveMemo = async () => {
    await AsyncStorage.setItem(`meal_memo_${viewDate}`, memo);
    setMemoEdit(false);
  };

  const openDatePicker = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'date';
      input.max = todayStr();
      input.value = viewDate;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      input.style.pointerEvents = 'none';
      document.body.appendChild(input);
      input.onchange = (e: any) => {
        if ((e.target as HTMLInputElement).value) setViewDate((e.target as HTMLInputElement).value);
        document.body.removeChild(input);
      };
      input.click();
    } else {
      setDatePickerInput(viewDate);
      setShowDatePickerModal(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchMeals(viewDate).finally(() => setLoading(false));
    }, [fetchMeals, viewDate])
  );

  const moveDate = (delta: number) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + delta);
    const next = d.toISOString().split('T')[0];
    if (next <= todayStr()) setViewDate(next);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMeals(viewDate);
    setRefreshing(false);
  };

  const addFoodRow = () => {
    setFoods([...foods, { foodName: '', kcal: '' }]);
  };

  const removeFoodRow = (idx: number) => {
    if (foods.length === 1) return;
    setFoods(foods.filter((_, i) => i !== idx));
  };

  const updateFood = (idx: number, field: 'foodName' | 'kcal', value: string) => {
    const updated = [...foods];
    updated[idx][field] = value;
    setFoods(updated);
  };

  const resetForm = () => {
    setMealType('아침');
    setLogDate(new Date().toISOString().split('T')[0]);
    setFoods([{ foodName: '', kcal: '' }]);
  };

  const handleSave = async () => {
    const validFoods = foods.filter((f) => f.foodName.trim() && f.kcal.trim());
    if (!validFoods.length) {
      Alert.alert('입력 오류', '음식 이름과 칼로리를 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const foodData = validFoods.map((f) => ({
        foodName: f.foodName.trim(),
        kcal: parseInt(f.kcal, 10) || 0,
      }));
      const totalKcal = foodData.reduce((s, f) => s + f.kcal, 0);
      await saveMeal({ mealType, totalKcal, isText: true, foods: foodData, logDate });
      setModalVisible(false);
      resetForm();
      // 현재 보고 있는 날짜와 저장 날짜가 같으면 목록 새로고침
      if (logDate === viewDate) {
        await fetchMeals(viewDate);
      } else {
        Alert.alert('저장 완료', `${logDate} 날짜로 기록되었습니다.\n해당 날짜로 이동해서 확인하세요.`);
      }
    } catch (e: any) {
      Alert.alert('저장 실패', e?.response?.data?.message || '다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mealId: number) => {
    const ok = Platform.OS === 'web'
      ? window.confirm('이 식사 기록을 삭제하시겠습니까?')
      : await new Promise<boolean>((resolve) =>
          Alert.alert('삭제', '이 식사 기록을 삭제하시겠습니까?', [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!ok) return;
    try {
      await deleteMeal(mealId);
      await fetchMeals();
    } catch {
      Alert.alert('오류', '삭제에 실패했습니다.');
    }
  };

  const handleDeleteAll = async () => {
    const ok = Platform.OS === 'web'
      ? window.confirm('오늘의 모든 식사 기록을 삭제하시겠습니까?')
      : await new Promise<boolean>((resolve) =>
          Alert.alert('전체 삭제', '오늘의 모든 식사 기록을 삭제하시겠습니까?', [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            { text: '전체 삭제', style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!ok) return;
    try {
      await deleteAllTodayMeals();
      await fetchMeals();
    } catch {
      Alert.alert('오류', '삭제에 실패했습니다.');
    }
  };

  const totalKcal = meals.reduce((s, m) => s + m.totalKcal, 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* 날짜 네비게이션 */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => moveDate(-1)} style={styles.dateArrow}>
            <Text style={styles.dateArrowText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openDatePicker} style={styles.dateLabelBtn}>
            <Text style={styles.dateLabel}>{dateLabel(viewDate)} 📅</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => moveDate(1)}
            style={[styles.dateArrow, viewDate === todayStr() && styles.dateArrowDisabled]}
            disabled={viewDate === todayStr()}
          >
            <Text style={[styles.dateArrowText, viewDate === todayStr() && { color: '#D0D8E4' }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 과식 경고 - 프리미엄 전용 */}
        {isPremium && totalKcal > goalKcal * 1.1 && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>⚠️ 목표보다 {totalKcal - goalKcal}kcal 초과했어요!</Text>
            <Text style={styles.warningDesc}>가벼운 운동으로 소모해보는 건 어떨까요?</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>🍽️ {dateLabel(viewDate)}의 식사</Text>
            <Text style={styles.headerSub}>총 {totalKcal} kcal 섭취</Text>
          </View>
          <View style={styles.headerBtns}>
            {meals.length > 0 && viewDate === todayStr() && (
              <TouchableOpacity style={styles.deleteAllBtn} onPress={handleDeleteAll}>
                <Text style={styles.deleteAllText}>전체삭제</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.addBtn} onPress={() => { setLogDate(viewDate); setModalVisible(true); }}>
              <Text style={styles.addBtnText}>+ 추가</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 한줄 요약 */}
        <View style={styles.memoCard}>
          <Text style={styles.memoIcon}>📝</Text>
          {memoEdit ? (
            <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={styles.memoInput}
                value={memo}
                onChangeText={setMemo}
                placeholder="오늘 식단 한줄 요약..."
                placeholderTextColor="#B0BEC5"
                autoFocus
                maxLength={50}
              />
              <TouchableOpacity onPress={saveMemo} style={styles.memoSaveBtn}>
                <Text style={styles.memoSaveBtnText}>저장</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setMemoEdit(true)}>
              <Text style={[styles.memoText, !memo && { color: '#B0BEC5' }]}>
                {memo || '한줄 요약을 남겨보세요 (탭해서 입력)'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Total Kcal Bar */}
        <View style={styles.kcalCard}>
          <View style={styles.kcalBarBg}>
            <View
              style={[
                styles.kcalBarFill,
                { width: `${Math.min((totalKcal / 2000) * 100, 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.kcalBarText}>{totalKcal} / 2000 kcal</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : meals.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyText}>오늘 식사 기록이 없어요</Text>
            <Text style={styles.emptySubText}>+ 추가 버튼으로 기록해보세요!</Text>
          </View>
        ) : (
          meals.map((meal) => (
            <View key={meal.mealId} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <View style={styles.mealTypeWrap}>
                  <Text style={styles.mealEmoji}>{MEAL_EMOJI[meal.mealType] || '🍴'}</Text>
                  <Text style={styles.mealType}>{meal.mealType}</Text>
                </View>
                <View style={styles.mealRight}>
                  <Text style={styles.mealKcal}>{meal.totalKcal} kcal</Text>
                  <TouchableOpacity onPress={() => handleDelete(meal.mealId)} style={styles.delBtn}>
                    <Text style={styles.delBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.foodList}>
                {meal.foods.map((food, idx) => (
                  <View key={idx} style={styles.foodRow}>
                    <Text style={styles.foodName}>• {food.foodName}</Text>
                    <Text style={styles.foodKcal}>{food.kcal} kcal</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.mealTime}>{meal.logTime}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Meal Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>식사 추가</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Date Selector */}
            <Text style={styles.label}>날짜</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={logDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e: any) => setLogDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 15,
                  border: '1.5px solid #E0E7EF', borderRadius: 12,
                  marginBottom: 12, color: '#2C3E50', backgroundColor: '#FAFBFD',
                  boxSizing: 'border-box',
                } as any}
              />
            ) : (
              <TextInput
                style={[styles.foodInput, { marginBottom: 12 }]}
                value={logDate}
                onChangeText={setLogDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#B0BEC5"
                maxLength={10}
              />
            )}

            {/* Meal Type Selector */}
            <Text style={styles.label}>식사 유형</Text>
            <View style={styles.typeRow}>
              {MEAL_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeBtn, mealType === type && styles.typeBtnActive]}
                  onPress={() => setMealType(type)}
                >
                  <Text style={[styles.typeBtnText, mealType === type && styles.typeBtnTextActive]}>
                    {MEAL_EMOJI[type]} {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Food Rows */}
            <Text style={styles.label}>음식 목록</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {foods.map((food, idx) => (
                <View key={idx} style={styles.foodInputRow}>
                  <TextInput
                    style={[styles.foodInput, { flex: 2 }]}
                    placeholder="음식 이름"
                    placeholderTextColor="#B0BEC5"
                    value={food.foodName}
                    onChangeText={(v) => updateFood(idx, 'foodName', v)}
                  />
                  <TextInput
                    style={[styles.foodInput, { flex: 1, marginLeft: 8 }]}
                    placeholder="kcal"
                    placeholderTextColor="#B0BEC5"
                    keyboardType="numeric"
                    value={food.kcal}
                    onChangeText={(v) => updateFood(idx, 'kcal', v)}
                  />
                  <TouchableOpacity onPress={() => removeFoodRow(idx)} style={styles.removeBtn}>
                    <Text style={{ color: COLORS.primary, fontSize: 18 }}>−</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.addFoodBtn} onPress={addFoodRow}>
              <Text style={styles.addFoodBtnText}>+ 음식 추가</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>저장</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 날짜 선택 모달 (네이티브) */}
      <Modal visible={showDatePickerModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: 24 }]}>
            <Text style={styles.modalTitle}>날짜 선택</Text>
            <TextInput
              style={styles.input}
              value={datePickerInput}
              onChangeText={setDatePickerInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#B0BEC5"
              keyboardType="numeric"
              maxLength={10}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: '#E0E7EF' }]} onPress={() => setShowDatePickerModal(false)}>
                <Text style={[styles.saveBtnText, { color: '#78909C' }]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { flex: 2 }]}
                onPress={() => {
                  if (datePickerInput && datePickerInput <= todayStr()) {
                    setViewDate(datePickerInput);
                    setShowDatePickerModal(false);
                  }
                }}
              >
                <Text style={styles.saveBtnText}>이동</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 32 },
  warningBanner: { backgroundColor: '#FFF3E0', borderRadius: 16, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#FF9800' },
  warningText: { fontSize: 14, fontWeight: '700', color: '#E65100' },
  warningDesc: { fontSize: 12, color: '#78909C', marginTop: 3 },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 16 },
  dateArrow: { padding: 8 },
  dateArrowDisabled: { opacity: 0.3 },
  dateArrowText: { fontSize: 28, color: COLORS.primary, fontWeight: '300', lineHeight: 32 },
  dateLabelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: COLORS.card },
  dateLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  memoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.secondary },
  memoIcon: { fontSize: 18 },
  memoText: { fontSize: 14, color: COLORS.text, fontWeight: '500', flex: 1 },
  memoInput: { flex: 1, fontSize: 14, color: COLORS.text, borderBottomWidth: 1.5, borderBottomColor: COLORS.secondary, paddingVertical: 2 },
  memoSaveBtn: { backgroundColor: COLORS.secondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  memoSaveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 13, color: '#78909C', marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  deleteAllBtn: {
    backgroundColor: '#FFE5E5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteAllText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  kcalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  kcalBarBg: { height: 10, backgroundColor: '#E8EDF2', borderRadius: 5, overflow: 'hidden' },
  kcalBarFill: { height: 10, backgroundColor: COLORS.primary, borderRadius: 5 },
  kcalBarText: { fontSize: 12, color: '#78909C', marginTop: 6, textAlign: 'right' },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 16, color: COLORS.text, fontWeight: '600', marginTop: 12 },
  emptySubText: { fontSize: 13, color: '#78909C', marginTop: 4 },
  mealCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealTypeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mealEmoji: { fontSize: 20 },
  mealType: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  mealRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealKcal: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  delBtn: { padding: 4 },
  delBtnText: { color: '#B0BEC5', fontSize: 16 },
  foodList: { marginTop: 10 },
  foodRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  foodName: { fontSize: 13, color: '#546E7A' },
  foodKcal: { fontSize: 13, color: '#78909C' },
  mealTime: { fontSize: 11, color: '#B0BEC5', marginTop: 8, textAlign: 'right' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  modalClose: { fontSize: 20, color: '#B0BEC5' },
  label: { fontSize: 13, fontWeight: '600', color: '#78909C', marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E7EF',
    backgroundColor: '#FAFBFD',
  },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { fontSize: 13, color: '#78909C', fontWeight: '600' },
  typeBtnTextActive: { color: '#fff' },
  foodInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  foodInput: {
    borderWidth: 1.5,
    borderColor: '#E0E7EF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: '#FAFBFD',
  },
  removeBtn: { marginLeft: 8, padding: 4 },
  addFoodBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  addFoodBtnText: { color: COLORS.secondary, fontWeight: '700', fontSize: 14 },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
