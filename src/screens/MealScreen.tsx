import React, { useState, useCallback, useEffect } from 'react';
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
import { getMealsByDate, saveMeal, deleteMeal, deleteAllTodayMeals } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { COLORS } from '../theme';
import { localDateStr, todayStr, dateLabel } from '../utils/dateUtils';
import CalendarPicker from '../components/CalendarPicker';

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
  const [showCalendar, setShowCalendar] = useState(false);
  const [showLogDateCalendar, setShowLogDateCalendar] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedMealIds, setSelectedMealIds] = useState<number[]>([]);

  // Form state
  const [mealType, setMealType] = useState('아침');
  const [logDate, setLogDate] = useState(todayStr());
  const [foods, setFoods] = useState<{ foodName: string; kcal: string }[]>([
    { foodName: '', kcal: '' },
  ]);

  const fetchMeals = useCallback(async (date: string) => {
    try {
      const [res, savedMemo] = await Promise.all([
        getMealsByDate(date),
        AsyncStorage.getItem(`meal_memo_${date}`),
      ]);
      setMeals(res.data || []);
      setMemo(savedMemo || '');
      setMemoEdit(false);
    } catch {
      Alert.alert('오류', '식사 기록을 불러오지 못했습니다.');
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
      input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
      document.body.appendChild(input);
      input.onchange = (e: any) => {
        if ((e.target as HTMLInputElement).value) setViewDate((e.target as HTMLInputElement).value);
        document.body.removeChild(input);
      };
      input.click();
    } else {
      setShowCalendar(true);
    }
  };

  // 탭 포커스 시 오늘 날짜로 리셋
  useFocusEffect(
    useCallback(() => {
      setViewDate(todayStr());
    }, [])
  );

  // viewDate 변경 시 (날짜 네비 or 포커스 리셋) 식사 목록 fetch
  useEffect(() => {
    setLoading(true);
    fetchMeals(viewDate).finally(() => setLoading(false));
  }, [viewDate, fetchMeals]);

  const moveDate = (delta: number) => {
    const d = new Date(viewDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const next = localDateStr(d);
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
    setLogDate(todayStr());
    setFoods([{ foodName: '', kcal: '' }]);
  };

  const handleSave = async () => {
    const validFoods = foods.filter((f) => f.foodName.trim() && f.kcal.trim());
    if (!validFoods.length) {
      Alert.alert('입력 오류', '음식 이름과 칼로리를 입력해주세요.');
      return;
    }
    const hasInvalidKcal = validFoods.some((f) => {
      const kcal = parseInt(f.kcal, 10);
      return isNaN(kcal) || kcal < 0 || kcal > 9999;
    });
    if (hasInvalidKcal) {
      Alert.alert('입력 오류', '칼로리는 0~9999 범위로 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const foodData = validFoods.map((f) => ({
        foodName: f.foodName.trim(),
        kcal: parseInt(f.kcal, 10),
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
      await fetchMeals(viewDate);
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
      await fetchMeals(viewDate);
    } catch {
      Alert.alert('오류', '삭제에 실패했습니다.');
    }
  };

  const toggleSelectMeal = (id: number) => {
    setSelectedMealIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedMeals = () => {
    if (!selectedMealIds.length) return;
    Alert.alert('삭제', `${selectedMealIds.length}개를 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          await Promise.all(selectedMealIds.map(id => deleteMeal(id)));
          setSelectedMealIds([]);
          setEditMode(false);
          await fetchMeals(viewDate);
        } catch {
          Alert.alert('오류', '삭제에 실패했습니다.');
        }
      }},
    ]);
  };

  const handleDeleteAllMeals = () => {
    if (!meals.length) return;
    Alert.alert('전체 삭제', '현재 날짜의 모든 식사 기록을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '전체 삭제', style: 'destructive', onPress: async () => {
        try {
          await Promise.all(meals.map(m => deleteMeal(m.mealId)));
          setSelectedMealIds([]);
          setEditMode(false);
          await fetchMeals(viewDate);
        } catch {
          Alert.alert('오류', '삭제에 실패했습니다.');
        }
      }},
    ]);
  };

  const totalKcal = meals.reduce((s, m) => s + (Number(m.totalKcal) || 0), 0);
  const kcalPct = goalKcal > 0 ? totalKcal / goalKcal : 0;
  const kcalBarColor = kcalPct >= 0.9 ? COLORS.primary : kcalPct >= 0.6 ? COLORS.warning : COLORS.success;


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
          <View style={{ flex: 1, flexShrink: 1, marginRight: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>🍽️ {dateLabel(viewDate)}의 식사</Text>
            <Text style={styles.headerSub} numberOfLines={1}>총 {totalKcal} kcal 섭취</Text>
          </View>
          <View style={styles.headerBtns}>
            {meals.length > 0 && (
              <TouchableOpacity style={styles.editBtn} onPress={() => { setEditMode(!editMode); setSelectedMealIds([]); }}>
                <Text style={styles.editBtnText}>{editMode ? '완료' : '편집'}</Text>
              </TouchableOpacity>
            )}
            {!editMode && meals.length > 0 && viewDate === todayStr() && (
              <TouchableOpacity style={styles.deleteAllBtn} onPress={handleDeleteAll}>
                <Text style={styles.deleteAllText}>전체삭제</Text>
              </TouchableOpacity>
            )}
            {!editMode && (
              <TouchableOpacity style={styles.addBtn} onPress={() => { setLogDate(todayStr()); setModalVisible(true); }}>
                <Text style={styles.addBtnText}>+ 추가</Text>
              </TouchableOpacity>
            )}
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
                { width: `${Math.min(kcalPct * 100, 100)}%`, backgroundColor: kcalBarColor },
              ]}
            />
          </View>
          <Text style={styles.kcalBarText}>{totalKcal} / {goalKcal} kcal</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : meals.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyText}>{dateLabel(viewDate)} 식사 기록이 없어요</Text>
            <Text style={styles.emptySubText}>+ 추가 버튼으로 기록해보세요!</Text>
          </View>
        ) : (
          meals.map((meal) => {
            const isSelected = selectedMealIds.includes(meal.mealId);
            const cardContent = (
              <View
                key={meal.mealId}
                style={[
                  styles.mealCard,
                  editMode && isSelected && { backgroundColor: COLORS.primary + '15' },
                ]}
              >
                <View style={styles.mealHeader}>
                  {editMode && (
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  )}
                  <View style={styles.mealTypeWrap}>
                    <Text style={styles.mealEmoji}>{MEAL_EMOJI[meal.mealType] || '🍴'}</Text>
                    <Text style={styles.mealType}>{meal.mealType}</Text>
                  </View>
                  <View style={styles.mealRight}>
                    <Text style={styles.mealKcal}>{meal.totalKcal} kcal</Text>
                    {!editMode && (
                      <TouchableOpacity onPress={() => handleDelete(meal.mealId)} style={styles.delBtn}>
                        <Text style={styles.delBtnText}>✕</Text>
                      </TouchableOpacity>
                    )}
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
            );

            if (editMode) {
              return (
                <TouchableOpacity key={meal.mealId} activeOpacity={0.7} onPress={() => toggleSelectMeal(meal.mealId)}>
                  {cardContent}
                </TouchableOpacity>
              );
            }
            return cardContent;
          })
        )}
      </ScrollView>

      {/* Edit Action Bar */}
      {editMode && (
        <View style={styles.editActionBar}>
          <TouchableOpacity style={styles.editCancelBtn} onPress={() => { setEditMode(false); setSelectedMealIds([]); }}>
            <Text style={styles.editCancelText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.editDeleteBtn, !selectedMealIds.length && { opacity: 0.4 }]}
            onPress={handleDeleteSelectedMeals}
            disabled={!selectedMealIds.length}
          >
            <Text style={styles.editDeleteText}>선택 삭제{selectedMealIds.length > 0 ? ` (${selectedMealIds.length})` : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editDeleteAllBtn} onPress={handleDeleteAllMeals}>
            <Text style={styles.editDeleteAllText}>모두 삭제</Text>
          </TouchableOpacity>
        </View>
      )}

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
                max={todayStr()}
                onChange={(e: any) => setLogDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 15,
                  border: '1.5px solid #E0E7EF', borderRadius: 12,
                  marginBottom: 12, color: '#2C3E50', backgroundColor: '#FAFBFD',
                  boxSizing: 'border-box',
                } as any}
              />
            ) : (
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowLogDateCalendar(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.datePickerBtnText}>📅 {logDate}</Text>
              </TouchableOpacity>
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

      {/* 날짜 달력 (헤더) */}
      <CalendarPicker
        visible={showCalendar}
        value={viewDate}
        maxDate={todayStr()}
        onSelect={setViewDate}
        onClose={() => setShowCalendar(false)}
      />

      {/* 날짜 달력 (식사 추가 모달용) */}
      <CalendarPicker
        visible={showLogDateCalendar}
        value={logDate}
        maxDate={todayStr()}
        onSelect={setLogDate}
        onClose={() => setShowLogDateCalendar(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 32 },
  warningBanner: { backgroundColor: '#FFF3E0', borderRadius: 16, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#FF9800' },
  warningText: { fontSize: 14, fontWeight: '700', color: '#E65100' },
  warningDesc: { fontSize: 12, color: '#78909C', marginTop: 3 },
  datePickerBtn: {
    borderWidth: 1.5, borderColor: '#E0E7EF', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12,
    backgroundColor: '#FAFBFD',
  },
  datePickerBtnText: { fontSize: 15, color: '#2C3E50', fontWeight: '600' },
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
  editBtn: { backgroundColor: '#F0F4F8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  editBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
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
  kcalBarFill: { height: 10, borderRadius: 5 },
  kcalBarText: { fontSize: 12, color: '#78909C', marginTop: 6, textAlign: 'right', flexShrink: 1 },
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
  foodName: { fontSize: 13, color: '#546E7A', flex: 1, flexShrink: 1 },
  foodKcal: { fontSize: 13, color: '#78909C' },
  mealTime: { fontSize: 11, color: '#B0BEC5', marginTop: 8, textAlign: 'right' },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D0D8E4', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  checkboxSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { fontSize: 12, color: '#fff', fontWeight: '700' },
  editActionBar: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: '#E0E7EF' },
  editCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E0E7EF', alignItems: 'center' },
  editCancelText: { fontSize: 13, fontWeight: '600', color: '#78909C' },
  editDeleteBtn: { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.warning, alignItems: 'center' },
  editDeleteText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  editDeleteAllBtn: { flex: 1.5, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FF6B6B', alignItems: 'center' },
  editDeleteAllText: { fontSize: 13, fontWeight: '700', color: '#fff' },
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
