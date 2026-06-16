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
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { getMealsByDate, saveMeal, deleteMeal, deleteAllTodayMeals } from '../api/api';
import { calculateCaloriesFromText } from '../services/claudeService';
import { useArchive } from '../hooks/useArchive';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { useCarryOver } from '../hooks/useCarryOver';
import { useWarningNotifications } from '../hooks/useWarningNotifications';
import { COLORS } from '../theme';
import Icon from '../components/Icon';
import { localDateStr, todayStr, dateLabel } from '../utils/dateUtils';
import CalendarPicker from '../components/CalendarPicker';
import CarryOverCard from '../components/CarryOverCard';
import MealGoalModal from '../components/MealGoalModal';

const MEAL_TYPES = ['아침', '점심', '저녁', '간식'];
const MEAL_EMOJI: Record<string, string> = {
  아침: '',
  점심: '',
  저녁: '',
  간식: '',
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
  const { goalKcal, userId } = useAuth();
  const { addPhotoToEntry } = useArchive();
  const { isPremium } = useSubscription();
  const { carryData, fetch: fetchCarryOver, effectiveBreakfastGoal, effectiveLunchGoal, effectiveDinnerGoal, updateMealGoals } = useCarryOver();
  const { checkExceed } = useWarningNotifications();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
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
  const [aiText, setAiText] = useState('');
  const [aiAmount, setAiAmount] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const handlePickPhoto = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.7, maxWidth: 800, maxHeight: 800 }, (res) => {
      if (!res.didCancel && res.assets?.[0]?.uri) setPhotoUri(res.assets[0].uri);
    });
  };

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
      setMeals([]);
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

  // 탭 포커스 시 오늘 날짜로 리셋 + carry-over fetch
  useFocusEffect(
    useCallback(() => {
      setViewDate(todayStr());
      fetchCarryOver();
    }, [fetchCarryOver])
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
    setAiText('');
    setAiAmount('');
    setPhotoUri(null);
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
      if (photoUri) {
        try { await addPhotoToEntry(logDate, '식단', photoUri, String(userId ?? '')); } catch {}
      }
      setModalVisible(false);
      resetForm();
      // 현재 보고 있는 날짜와 저장 날짜가 같으면 목록 새로고침
      if (logDate === viewDate) {
        await fetchMeals(viewDate);
      } else {
        Alert.alert('저장 완료', `${logDate} 날짜로 기록되었습니다.\n해당 날짜로 이동해서 확인하세요.`);
      }
    } catch (e: any) {
      console.error('[MealScreen] saveMeal error:', e?.response?.status, JSON.stringify(e?.response?.data), e?.message);
      Alert.alert('저장 실패', e?.response?.data?.message || `오류: ${e?.message || '다시 시도해주세요.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAiCalc = async () => {
    if (!aiText.trim()) {
      Alert.alert('입력 오류', '음식명을 입력해주세요.');
      return;
    }
    setAiLoading(true);
    try {
      const query = aiAmount.trim() ? `${aiText.trim()} ${aiAmount.trim()}` : aiText.trim();
      const result = await calculateCaloriesFromText(query);
      const newFoods = result.foods.map(f => ({
        foodName: f.name,
        kcal: String(f.kcal),
      }));
      setFoods(prev => {
        const nonEmpty = prev.filter(f => f.foodName.trim() || f.kcal.trim());
        return [...nonEmpty, ...newFoods];
      });
      setAiText('');
      setAiAmount('');
    } catch {
      Alert.alert('AI 계산 실패', '다시 시도해주세요.');
    } finally {
      setAiLoading(false);
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

  // 경고3: 오늘 날짜 + 목표 초과 시 즉시 알림 (치팅데이 여부는 훅 내부에서 판단)
  useEffect(() => {
    if (viewDate === todayStr()) {
      checkExceed(totalKcal, goalKcal);
    }
  }, [totalKcal, viewDate, goalKcal, checkExceed]);
  const kcalBarColor = kcalPct >= 0.9 ? COLORS.primary : kcalPct >= 0.6 ? COLORS.warning : COLORS.success;
  const modalTotalKcal = foods.reduce((s, f) => s + (parseInt(f.kcal, 10) || 0), 0);

  // 끼니별 섭취량 계산
  const eatenByType = meals.reduce((acc, m) => {
    acc[m.mealType] = (acc[m.mealType] || 0) + (Number(m.totalKcal) || 0);
    return acc;
  }, {} as Record<string, number>);

  // CarryOverCard 데이터
  const carryItems = [
    {
      label: '아침', emoji: '',
      goal: effectiveBreakfastGoal,
      eaten: eatenByType['아침'] || 0,
      carry: Math.max(0, effectiveBreakfastGoal - (eatenByType['아침'] || 0)),
    },
    {
      label: '점심', emoji: '',
      goal: effectiveLunchGoal,
      eaten: eatenByType['점심'] || 0,
      carry: Math.max(0, effectiveLunchGoal - (eatenByType['점심'] || 0)),
    },
    {
      label: '저녁', emoji: '',
      goal: effectiveDinnerGoal,
      eaten: eatenByType['저녁'] || 0,
      carry: 0,
    },
  ];


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
            <Text style={styles.dateLabel}>{dateLabel(viewDate)} </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => moveDate(1)}
            style={[styles.dateArrow, viewDate === todayStr() && styles.dateArrowDisabled]}
            disabled={viewDate === todayStr()}
          >
            <Text style={[styles.dateArrowText, viewDate === todayStr() && { color: '#F0E1EC' }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 과식 경고 - 프리미엄 전용 */}
        {isPremium && totalKcal > goalKcal * 1.1 && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>목표보다 {totalKcal - goalKcal}kcal 초과했어요!</Text>
            <Text style={styles.warningDesc}>가벼운 운동으로 소모해보는 건 어떨까요?</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1, flexShrink: 1, marginRight: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{dateLabel(viewDate)}의 식사</Text>
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
          
          {memoEdit ? (
            <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={styles.memoInput}
                value={memo}
                onChangeText={setMemo}
                placeholder="오늘 식단 한줄 요약..."
                placeholderTextColor="#D4C5DC"
                autoFocus
                maxLength={50}
              />
              <TouchableOpacity onPress={saveMemo} style={styles.memoSaveBtn}>
                <Text style={styles.memoSaveBtnText}>저장</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setMemoEdit(true)}>
              <Text style={[styles.memoText, !memo && { color: '#D4C5DC' }]}>
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

        {/* 끼니별 칼로리 이월 카드 (오늘 날짜만 표시) */}
        {viewDate === todayStr() && (
          <CarryOverCard
            items={carryItems}
            onSettingsPress={() => setGoalModalVisible(true)}
          />
        )}

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : meals.length === 0 ? (
          <View style={styles.emptyWrap}>
            
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
                      {isSelected && <Icon name="check" size={12} color={"#fff"} />}
                    </View>
                  )}
                  <View style={styles.mealTypeWrap}>
                    <Text style={styles.mealEmoji}>{MEAL_EMOJI[meal.mealType] || ''}</Text>
                    <Text style={styles.mealType}>{meal.mealType}</Text>
                  </View>
                  <View style={styles.mealRight}>
                    <Text style={styles.mealKcal}>{meal.totalKcal} kcal</Text>
                    {!editMode && (
                      <TouchableOpacity onPress={() => handleDelete(meal.mealId)} style={styles.delBtn}>
                        <Icon name="trash" size={14} color={"#fff"} />
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

      {/* 끼니별 목표 설정 모달 */}
      <MealGoalModal
        visible={goalModalVisible}
        breakfastGoal={carryData.breakfastGoal}
        lunchGoal={carryData.lunchGoal}
        dinnerGoal={carryData.dinnerGoal}
        onSave={async (b, l, d) => { await updateMealGoals(b, l, d); }}
        onClose={() => setGoalModalVisible(false)}
      />

      {/* Add Meal Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => { setModalVisible(false); resetForm(); }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>식사 추가</Text>
                <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                  <Icon name="close" size={18} color={COLORS.subText} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Date Selector */}
                <Text style={styles.label}>날짜</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={logDate}
                    max={todayStr()}
                    onChange={(e: any) => setLogDate(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', fontSize: 17,
                      border: '1.5px solid #F0E1EC', borderRadius: 20,
                      marginBottom: 12, color: '#4A3A5C', backgroundColor: '#FBF4F9',
                      boxSizing: 'border-box',
                    } as any}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setShowLogDateCalendar(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.datePickerBtnText}>{logDate}</Text>
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

                {/* AI 칼로리 자동 계산 섹션 */}
                <View style={styles.aiSection}>
                  <Text style={styles.label}>AI 칼로리 자동 계산</Text>
                  <Text style={styles.aiHint}>AI가 칼로리를 자동으로 계산해드립니다</Text>
                  <View style={styles.aiInputRow}>
                    <TextInput
                      style={[styles.foodInput, { flex: 2 }]}
                      placeholder="음식명 (예: 비빔밥)"
                      placeholderTextColor="#D4C5DC"
                      value={aiText}
                      onChangeText={setAiText}
                    />
                    <TextInput
                      style={[styles.foodInput, { flex: 1, marginLeft: 8 }]}
                      placeholder="양 (선택)"
                      placeholderTextColor="#D4C5DC"
                      value={aiAmount}
                      onChangeText={setAiAmount}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.aiBtn, aiLoading && { opacity: 0.6 }]}
                    onPress={handleAiCalc}
                    disabled={aiLoading}
                  >
                    {aiLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.aiBtnText}>AI 계산 후 자동 추가</Text>
                    }
                  </TouchableOpacity>
                </View>

                {/* Food Rows */}
                <Text style={styles.label}>음식 목록</Text>
                {foods.map((food, idx) => (
                  <View key={idx} style={styles.foodInputRow}>
                    <TextInput
                      style={[styles.foodInput, { flex: 2 }]}
                      placeholder="음식 이름"
                      placeholderTextColor="#D4C5DC"
                      value={food.foodName}
                      onChangeText={(v) => updateFood(idx, 'foodName', v)}
                    />
                    <TextInput
                      style={[styles.foodInput, { flex: 1, marginLeft: 8 }]}
                      placeholder="kcal"
                      placeholderTextColor="#D4C5DC"
                      keyboardType="numeric"
                      value={food.kcal}
                      onChangeText={(v) => updateFood(idx, 'kcal', v)}
                    />
                    <TouchableOpacity onPress={() => removeFoodRow(idx)} style={styles.removeBtn}>
                      <Text style={{ color: COLORS.primary, fontSize: 19 }}>−</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={styles.addFoodBtn} onPress={addFoodRow}>
                  <Text style={styles.addFoodBtnText}>+ 음식 추가</Text>
                </TouchableOpacity>

                {/* 실시간 합계 */}
                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalTotalLabel}>합계</Text>
                  <Text style={styles.modalTotalKcal}>{modalTotalKcal} kcal</Text>
                </View>

                {/* 사진 첨부 */}
                <Text style={styles.label}>사진 첨부 (선택)</Text>
                <Text style={styles.photoHint}>식단 사진을 추가하면 아카이브에서 확인할 수 있어요</Text>
                <TouchableOpacity style={styles.photoPickerBtn} onPress={handlePickPhoto}>
                  {photoUri
                    ? <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                    : <Text style={styles.photoPickerText}>사진 선택</Text>
                  }
                </TouchableOpacity>
                {photoUri && (
                  <TouchableOpacity onPress={() => setPhotoUri(null)} style={styles.photoRemoveBtn}>
                    <Text style={styles.photoRemoveText}>사진 제거</Text>
                  </TouchableOpacity>
                )}

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
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 72 },
  warningBanner: { backgroundColor: '#FFE8EF', borderRadius: 24, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#F5C99B' },
  warningText: { fontSize: 16, fontWeight: '700', color: '#A98ED1' },
  warningDesc: { fontSize: 14, color: '#8A7C9C', marginTop: 3 },
  datePickerBtn: {
    borderWidth: 1.5, borderColor: '#F0E1EC', borderRadius: 20,
    paddingHorizontal: 22, paddingVertical: 15, marginBottom: 12,
    backgroundColor: '#FBF4F9',
  },
  datePickerBtnText: { fontSize: 17, color: '#4A3A5C', fontWeight: '600' },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 16 },
  dateArrow: { padding: 8 },
  dateArrowDisabled: { opacity: 0.3 },
  dateArrowText: { fontSize: 28, color: COLORS.primary, fontWeight: '300', lineHeight: 32 },
  dateLabelBtn: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.card },
  dateLabel: { fontSize: 17, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  memoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: 22, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.secondary },
  memoIcon: { fontSize: 19 },
  memoText: { fontSize: 16, color: COLORS.text, fontWeight: '500', flex: 1 },
  memoInput: { flex: 1, fontSize: 16, color: COLORS.text, borderBottomWidth: 1.5, borderBottomColor: COLORS.secondary, paddingVertical: 2 },
  memoSaveBtn: { backgroundColor: COLORS.secondary, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 6 },
  memoSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 15, color: '#8A7C9C', marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editBtn: { backgroundColor: '#FFF5F8', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 11 },
  editBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  deleteAllBtn: {
    backgroundColor: '#FFD6E5',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  deleteAllText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  photoHint: { fontSize: 14, color: '#8A7C9C', marginBottom: 8, marginTop: -4 },
  photoPickerBtn: { borderWidth: 1.5, borderColor: '#F0E1EC', borderRadius: 20, borderStyle: 'dashed', height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: 8, backgroundColor: '#FBF4F9', overflow: 'hidden' },
  photoPickerText: { fontSize: 16, color: '#D4C5DC', fontWeight: '600' },
  photoPreview: { width: '100%', height: 90 },
  photoRemoveBtn: { alignItems: 'center', marginBottom: 14 },
  photoRemoveText: { fontSize: 15, color: COLORS.primary },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  kcalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  kcalBarBg: { height: 10, backgroundColor: '#F0E1EC', borderRadius: 12, overflow: 'hidden' },
  kcalBarFill: { height: 10, borderRadius: 12 },
  kcalBarText: { fontSize: 14, color: '#8A7C9C', marginTop: 6, textAlign: 'right', flexShrink: 1 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 17, color: COLORS.text, fontWeight: '600', marginTop: 12 },
  emptySubText: { fontSize: 15, color: '#8A7C9C', marginTop: 4 },
  mealCard: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
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
  mealType: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  mealRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealKcal: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
  delBtn: { padding: 4 },
  delBtnText: { color: '#D4C5DC', fontSize: 17 },
  foodList: { marginTop: 10 },
  foodRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  foodName: { fontSize: 15, color: '#546E7A', flex: 1, flexShrink: 1 },
  foodKcal: { fontSize: 15, color: '#8A7C9C' },
  mealTime: { fontSize: 13, color: '#D4C5DC', marginTop: 8, textAlign: 'right' },
  checkbox: { width: 22, height: 22, borderRadius: 18, borderWidth: 2, borderColor: '#F0E1EC', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  checkboxSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { fontSize: 14, color: '#fff', fontWeight: '700' },
  editActionBar: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: '#F0E1EC' },
  editCancelBtn: { flex: 1, paddingVertical: 15, borderRadius: 20, borderWidth: 1.5, borderColor: '#F0E1EC', alignItems: 'center' },
  editCancelText: { fontSize: 15, fontWeight: '600', color: '#8A7C9C' },
  editDeleteBtn: { flex: 2, paddingVertical: 15, borderRadius: 20, backgroundColor: COLORS.warning, alignItems: 'center' },
  editDeleteText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  editDeleteAllBtn: { flex: 1.5, paddingVertical: 15, borderRadius: 20, backgroundColor: '#F5A3B0', alignItems: 'center' },
  editDeleteAllText: { fontSize: 15, fontWeight: '700', color: '#fff' },
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
  modalClose: { fontSize: 20, color: '#D4C5DC' },
  label: { fontSize: 15, fontWeight: '600', color: '#8A7C9C', marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#F0E1EC',
    backgroundColor: '#FBF4F9',
  },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { fontSize: 15, color: '#8A7C9C', fontWeight: '600' },
  typeBtnTextActive: { color: '#fff' },
  foodInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  foodInput: {
    borderWidth: 1.5,
    borderColor: '#F0E1EC',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 13,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: '#FBF4F9',
  },
  removeBtn: { marginLeft: 8, padding: 4 },
  addFoodBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  addFoodBtnText: { color: COLORS.secondary, fontWeight: '700', fontSize: 16 },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  aiSection: {
    backgroundColor: '#E6DAF5',
    borderRadius: 22,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6DAF5',
  },
  aiHint: { fontSize: 13, color: '#5A8FCC', marginBottom: 10, marginTop: -4 },
  aiInputRow: { flexDirection: 'row', marginBottom: 10 },
  aiBtn: {
    backgroundColor: '#A98ED1',
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
  },
  aiBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#FFF5F8',
    marginBottom: 12,
  },
  modalTotalLabel: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  modalTotalKcal: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
});
