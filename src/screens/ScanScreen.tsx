import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Platform,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import {
  scanNutritionLabel, scanFoodImage, scanReceipt,
  calculateCaloriesFromText,
  NutritionLabelResult,
} from '../services/claudeService';
import { saveMeal } from '../api/api';
import { useSubscription } from '../hooks/useSubscription';
import { useArchive } from '../hooks/useArchive';
import PremiumModal from '../components/PremiumModal';
import { COLORS } from '../theme';
import Icon from '../components/Icon';
import CuteLoader from '../components/CuteLoader';
import { localDateStr } from '../utils/dateUtils';

type ScanType = 'nutrition' | 'food' | 'receipt';

interface EditableFood {
  name: string;
  amount: string;
  kcal: string;
  confidence?: number;
}

interface NutritionDetail {
  productName: string;
  servingSize: string;
  calories: number;
  nutrients: { label: string; value: string }[];
}

const SCAN_ITEMS: { type: ScanType; icon: 'chart' | 'food' | 'bookmark'; title: string; desc: string; color: string }[] = [
  { type: 'nutrition', icon: 'chart',    title: '영양성분표 스캔', desc: '제품 뒷면으로 영양소 자동 파싱',     color: COLORS.secondary },
  { type: 'food',      icon: 'food',     title: '음식 사진 스캔', desc: 'AI가 음식 사진으로 칼로리 추정',     color: COLORS.warning   },
  { type: 'receipt',   icon: 'bookmark', title: '영수증 스캔',     desc: '영수증으로 먹은 음식 자동 기록',     color: COLORS.purple    },
];

const MEAL_TYPES = ['아침', '점심', '저녁', '간식'];

export default function ScanScreen() {
  const { canScan, remainingFreeScans, isPremium, incrementScanCount } = useSubscription();
  const { addPhotoToEntry } = useArchive();
  const [mode, setMode] = useState<'select' | 'result'>('select');
  const [currentType, setCurrentType] = useState<ScanType | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [editableFoods, setEditableFoods] = useState<EditableFood[]>([]);
  const [nutritionDetail, setNutritionDetail] = useState<NutritionDetail | null>(null);
  const [mealType, setMealType] = useState('아침');
  const [selectedCard, setSelectedCard] = useState<ScanType | null>(null);
  const [aiText, setAiText] = useState('');
  const [aiAmount, setAiAmount] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [scannedImageUri, setScannedImageUri] = useState<string | null>(null);

  const totalKcal = editableFoods.reduce((s, f) => s + (parseInt(f.kcal) || 0), 0);

  const applyFoodResult = (foods: { name: string; kcal: number; amount: string; confidence?: number }[]) => {
    setEditableFoods(foods.map(f => ({ name: f.name, amount: f.amount || '', kcal: String(f.kcal), confidence: f.confidence })));
  };

  const applyNutritionResult = (res: NutritionLabelResult) => {
    setNutritionDetail({
      productName: res.productName,
      servingSize: res.servingSize,
      calories: res.calories,
      nutrients: [
        { label: '탄수화물', value: `${res.nutrients.carb}g` },
        { label: '당류',     value: `${res.nutrients.sugar}g` },
        { label: '단백질',   value: `${res.nutrients.protein}g` },
        { label: '지방',     value: `${res.nutrients.fat}g` },
        { label: '포화지방', value: `${res.nutrients.saturatedFat}g` },
        { label: '나트륨',   value: `${res.nutrients.sodium}mg` },
      ],
    });
    setEditableFoods([{ name: res.productName, amount: res.servingSize, kcal: String(res.calories) }]);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const normalizeMime = (mime: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' => {
    if (mime === 'image/png') return 'image/png';
    if (mime === 'image/gif') return 'image/gif';
    if (mime === 'image/webp') return 'image/webp';
    return 'image/jpeg'; // jpg, heic, heif 등 모두 jpeg로
  };

  const runScan = async (base64: string, mime: string, type: ScanType) => {
    const normalizedMime = normalizeMime(mime);
    setLoading(true);
    setMode('result');
    setSelectedCard(null);
    try {
      if (type === 'nutrition') {
        applyNutritionResult(await scanNutritionLabel(base64, normalizedMime));
      } else if (type === 'food') {
        const res = await scanFoodImage(base64, normalizedMime);
        applyFoodResult(res.foods);
      } else {
        const res = await scanReceipt(base64, normalizedMime);
        applyFoodResult(res.foods);
      }
      await incrementScanCount();
    } catch (err: any) {
      Alert.alert('분석 실패', err.message || 'AI 분석에 실패했습니다. 다시 시도해주세요.');
      reset();
    } finally {
      setLoading(false);
    }
  };

  const pickImage = (type: ScanType, useCamera: boolean) => {
    if (!canScan) { setPremiumVisible(true); return; }
    setCurrentType(type);
    setNutritionDetail(null);
    setEditableFoods([]);

    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (useCamera) input.capture = 'environment';
      input.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      const removeInput = () => {
        if (document.body.contains(input)) document.body.removeChild(input);
      };
      document.body.appendChild(input);
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        removeInput();
        if (!file) return;
        const base64 = await fileToBase64(file);
        runScan(base64, file.type, type);
      };
      input.addEventListener('cancel', removeInput);
      input.click();
      return;
    }

    const picker = useCamera ? launchCamera : launchImageLibrary;
    const quality = useCamera ? 0.2 : 0.4;
    const maxSize = useCamera ? 800 : 1280;
    picker({ mediaType: 'photo', includeBase64: true, quality, maxWidth: maxSize, maxHeight: maxSize }, (res) => {
      if (res.didCancel || !res.assets?.[0]?.base64) return;
      const asset = res.assets[0];
      setScannedImageUri(asset.uri ?? null);
      // 네이티브 피커는 mime 타입을 잘못 보고하는 경우가 있어 항상 jpeg로 고정
      runScan(asset.base64!, 'image/jpeg', type);
    });
  };

  const reset = () => {
    setMode('select');
    setCurrentType(null);
    setEditableFoods([]);
    setNutritionDetail(null);
    setLoading(false);
    setSelectedCard(null);
    setAiText('');
    setAiAmount('');
    setEditMode(false);
    setSelectedIndices([]);
    setScannedImageUri(null);
  };

  const toggleSelect = (idx: number) => {
    setSelectedIndices(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const deleteSelected = () => {
    setEditableFoods(prev => prev.filter((_, i) => !selectedIndices.includes(i)));
    setSelectedIndices([]);
    setEditMode(false);
  };

  const deleteAll = () => {
    setEditableFoods([]);
    setSelectedIndices([]);
    setEditMode(false);
  };

  const handleAiAdd = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const query = aiAmount.trim() ? `${aiText.trim()} ${aiAmount.trim()}` : aiText.trim();
      const result = await calculateCaloriesFromText(query);
      setEditableFoods(prev => [
        ...prev,
        ...result.foods.map(f => ({ name: f.name, amount: f.amount || '', kcal: String(f.kcal) })),
      ]);
      setAiText('');
      setAiAmount('');
    } catch {
      Alert.alert('AI 계산 실패', '다시 시도해주세요.');
    } finally {
      setAiLoading(false);
    }
  };

  const updateFood = (idx: number, field: keyof EditableFood, value: string) => {
    setEditableFoods(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f));
  };

  const removeFood = (idx: number) => {
    setEditableFoods(prev => prev.filter((_, i) => i !== idx));
  };

  const addFood = () => {
    setEditableFoods(prev => [...prev, { name: '', amount: '', kcal: '' }]);
  };

  const handleSave = async () => {
    const validFoods = editableFoods.filter(f => f.name.trim());
    if (!validFoods.length) {
      Alert.alert('입력 오류', '음식 이름을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const today = localDateStr();
      await saveMeal({
        mealType,
        totalKcal,
        isText: true,
        logDate: today,
        foods: validFoods.map(f => ({ foodName: f.name.trim(), kcal: parseInt(f.kcal) || 0 })),
      });
      // 캘린더 아카이브에 식단 사진 기록 (네이티브 URI가 있을 때만)
      if (scannedImageUri) {
        await addPhotoToEntry(today, '식단', scannedImageUri);
      }
      Alert.alert('저장 완료', '식사가 기록되었습니다!', [{ text: '확인', onPress: reset }]);
    } catch {
      Alert.alert('오류', '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const currentItem = SCAN_ITEMS.find(s => s.type === currentType);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>스캔</Text>
          <Text style={styles.headerSub}>AI로 칼로리를 자동으로 분석해요</Text>
        </View>

        {/* 스캔 제한 배너 */}
        {!isPremium && mode === 'select' && (
          <TouchableOpacity style={styles.limitBanner} onPress={() => setPremiumVisible(true)}>
            <Text style={styles.limitText}>
              {remainingFreeScans > 0
                ? `무료 스캔 ${remainingFreeScans}회 남음`
                : '무료 스캔 소진 · 프리미엄 필요'}
            </Text>
            <Text style={styles.limitUpgrade}>업그레이드</Text>
          </TouchableOpacity>
        )}
        {isPremium && mode === 'select' && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>프리미엄 · 무제한 스캔</Text>
          </View>
        )}

        {/* ── Select Mode ── */}
        {mode === 'select' && (
          <View style={styles.grid}>
            {SCAN_ITEMS.map(item => (
              <View key={item.type} style={styles.cardWrap}>
                <TouchableOpacity
                  style={[styles.card, selectedCard === item.type && { borderColor: item.color, borderWidth: 2 }]}
                  onPress={() => setSelectedCard(selectedCard === item.type ? null : item.type)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.cardIconBg, { backgroundColor: item.color + '18' }]}>
                    <Icon name={item.icon} size={24} color={item.color} />
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>{item.desc}</Text>
                </TouchableOpacity>

                {selectedCard === item.type && (
                  <View style={[styles.pickPanel, { borderColor: item.color }]}>
                    <TouchableOpacity
                      style={[styles.pickBtn, { backgroundColor: item.color }]}
                      onPress={() => pickImage(item.type, true)}
                    >
                      <Text style={styles.pickBtnText}>카메라</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pickBtn, { backgroundColor: item.color + 'CC' }]}
                      onPress={() => pickImage(item.type, false)}
                    >
                      <Text style={styles.pickBtnText}>갤러리</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Result Mode ── */}
        {mode === 'result' && (
          <View>
            {/* 뒤로 */}
            <TouchableOpacity style={styles.backBtn} onPress={reset}>
              <Text style={styles.backBtnText}>← 다시 스캔</Text>
            </TouchableOpacity>

            {loading ? (
              <View style={styles.loadingWrap}>
                <CuteLoader
                  message="AI가 사진을 분석 중이에요..."
                  icon={currentType === 'food' ? 'food' : currentType === 'receipt' ? 'bookmark' : 'chart'}
                  color={currentItem?.color ?? COLORS.primary}
                  size="lg"
                />
              </View>
            ) : (
              <>
                {/* 영양성분 상세 (바코드 / 영양성분표) */}
                {nutritionDetail && (
                  <View style={styles.nutriCard}>
                    <Text style={styles.nutriProductName}>{nutritionDetail.productName}</Text>
                    <Text style={styles.nutriServing}>1회 제공량: {nutritionDetail.servingSize}</Text>
                    <View style={styles.nutriKcalRow}>
                      <Text style={styles.nutriKcalLabel}>칼로리</Text>
                      <Text style={[styles.nutriKcalValue, { color: currentItem?.color ?? COLORS.primary }]}>
                        {nutritionDetail.calories} kcal
                      </Text>
                    </View>
                    <View style={styles.nutriDivider} />
                    {nutritionDetail.nutrients.map(n => (
                      <View key={n.label} style={styles.nutriRow}>
                        <Text style={styles.nutriLabel}>{n.label}</Text>
                        <Text style={styles.nutriValue}>{n.value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* 식사로 저장할 음식 목록 */}
                <View style={styles.resultCard}>
                  <View style={styles.resultCardHeader}>
                    <Text style={styles.resultCardTitle}>
                      {currentType === 'receipt' ? '인식된 음식 목록' : '식사로 저장'}
                    </Text>
                    {!editMode ? (
                      <TouchableOpacity style={styles.editToggleBtn} onPress={() => setEditMode(true)}>
                        <Text style={styles.editToggleText}>편집</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.editToggleBtn} onPress={() => { setEditMode(false); setSelectedIndices([]); }}>
                        <Text style={styles.editToggleText}>완료</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {editMode && (
                    <View style={styles.editActionBar}>
                      <TouchableOpacity
                        style={[styles.editActionBtn, { backgroundColor: COLORS.warning }, !selectedIndices.length && { opacity: 0.4 }]}
                        onPress={deleteSelected}
                        disabled={!selectedIndices.length}
                      >
                        <Text style={styles.editActionText}>선택 삭제 {selectedIndices.length > 0 ? `(${selectedIndices.length})` : ''}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.editActionBtn, { backgroundColor: COLORS.primary }]} onPress={deleteAll}>
                        <Text style={styles.editActionText}>전체 삭제</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* 식사 유형 선택 */}
                  <View style={styles.mealTypeRow}>
                    {MEAL_TYPES.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.mealTypeBtn, mealType === t && styles.mealTypeBtnActive]}
                        onPress={() => setMealType(t)}
                      >
                        <Text style={[styles.mealTypeBtnText, mealType === t && styles.mealTypeBtnTextActive]} numberOfLines={1}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 음식 아이템 */}
                  {editableFoods.map((food, idx) => (
                    editMode ? (
                      <TouchableOpacity key={idx} style={[styles.foodItem, selectedIndices.includes(idx) && styles.foodItemSelected]} onPress={() => toggleSelect(idx)} activeOpacity={0.7}>
                        <View style={styles.foodItemMain}>
                          <View style={[styles.scanCheckbox, selectedIndices.includes(idx) && styles.scanCheckboxOn]}>
                            {selectedIndices.includes(idx) && <Icon name="check" size={12} color={"#fff"} />}
                          </View>
                          <Text style={[styles.foodNameInput, { flex: 2, paddingVertical: 11 }]} numberOfLines={1}>{food.name || '(음식명 없음)'}</Text>
                          <Text style={styles.foodAmountInput} numberOfLines={1}>{food.amount}</Text>
                        </View>
                        <Text style={{ fontSize: 15, color: COLORS.primary, fontWeight: '700', textAlign: 'right', marginTop: 4 }}>{food.kcal || '0'} kcal</Text>
                      </TouchableOpacity>
                    ) : (
                      <View key={idx} style={styles.foodItem}>
                        {food.confidence !== undefined && food.confidence < 0.6 && (
                          <View style={styles.uncertainBadge}>
                            <Text style={styles.uncertainBadgeText}>불확실 — 직접 확인해주세요</Text>
                          </View>
                        )}
                        <View style={styles.foodItemMain}>
                          <TextInput
                            style={styles.foodNameInput}
                            value={food.name}
                            onChangeText={v => updateFood(idx, 'name', v)}
                            placeholder="음식명"
                            placeholderTextColor="#D4C5DC"
                          />
                          <TextInput
                            style={styles.foodAmountInput}
                            value={food.amount}
                            onChangeText={v => updateFood(idx, 'amount', v)}
                            placeholder="양"
                            placeholderTextColor="#D4C5DC"
                          />
                        </View>
                        <View style={styles.foodItemBottom}>
                          <TextInput
                            style={styles.foodKcalInput}
                            value={food.kcal}
                            onChangeText={v => updateFood(idx, 'kcal', v)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#D4C5DC"
                          />
                          <Text style={styles.foodKcalUnit}>kcal</Text>
                          <TouchableOpacity onPress={() => removeFood(idx)} style={styles.removeBtn}>
                            <Icon name="trash" size={14} color={"#fff"} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )
                  ))}

                  {!editMode && (
                    <TouchableOpacity style={styles.addFoodBtn} onPress={addFood}>
                      <Text style={styles.addFoodBtnText}>+ 수동 추가</Text>
                    </TouchableOpacity>
                  )}

                  {/* AI 텍스트 칼로리 계산 */}
                  <View style={styles.aiSection}>
                    <Text style={styles.aiSectionTitle}>AI로 추가</Text>
                    <Text style={styles.aiSectionHint}>음식명을 입력하면 AI가 칼로리를 자동으로 계산해드립니다</Text>
                    <View style={styles.aiInputRow}>
                      <TextInput
                        style={[styles.foodNameInput, { flex: 2 }]}
                        value={aiText}
                        onChangeText={setAiText}
                        placeholder="음식명 (예: 된장찌개)"
                        placeholderTextColor="#D4C5DC"
                      />
                      <TextInput
                        style={[styles.foodAmountInput, { flex: 1 }]}
                        value={aiAmount}
                        onChangeText={setAiAmount}
                        placeholder="양 (선택)"
                        placeholderTextColor="#D4C5DC"
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.aiCalcBtn, aiLoading && { opacity: 0.6 }]}
                      onPress={handleAiAdd}
                      disabled={aiLoading}
                    >
                      {aiLoading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.aiCalcBtnText}>AI 계산 후 추가</Text>
                      }
                    </TouchableOpacity>
                  </View>

                  {/* 총 칼로리 */}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>합계</Text>
                    <Text style={[styles.totalKcal, { color: currentItem?.color ?? COLORS.primary }]}>
                      {totalKcal} kcal
                    </Text>
                  </View>

                  {/* 저장 버튼 */}
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: currentItem?.color ?? COLORS.primary }, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>식사로 저장</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>

      <PremiumModal
        visible={premiumVisible}
        onClose={() => setPremiumVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg },
  content:    { padding: 20, paddingBottom: 88 },

  header:     { marginBottom: 20 },
  headerTitle:{ fontSize: 26, fontWeight: '800', color: COLORS.text },
  headerSub:  { fontSize: 15, color: '#8A7C9C', marginTop: 3 },

  limitBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFE8EF', borderRadius: 20, padding: 12, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: COLORS.warning,
  },
  limitText:    { fontSize: 15, color: '#A98ED1', fontWeight: '600' },
  limitUpgrade: { fontSize: 15, color: COLORS.warning, fontWeight: '700' },
  premiumBadge: {
    backgroundColor: '#FFF9E6', borderRadius: 20, padding: 10, marginBottom: 16,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.warning,
  },
  premiumBadgeText: { fontSize: 15, color: COLORS.warning, fontWeight: '700' },

  // 2열 그리드
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cardWrap: { width: '47.5%' },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 26, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    borderWidth: 2, borderColor: 'transparent',
  },
  cardIconBg: {
    width: 52, height: 52, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  cardEmoji:  { fontSize: 26 },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4, flexShrink: 1 },
  cardDesc:   { fontSize: 12, color: '#8A7C9C', lineHeight: 14, flexShrink: 1 },

  pickPanel: {
    marginTop: 8, borderRadius: 20, borderWidth: 1.5,
    overflow: 'hidden',
  },
  pickBtn: {
    paddingVertical: 13, alignItems: 'center',
  },
  pickBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  barcodeNumberInput: {
    borderWidth: 1.5, borderColor: '#F0E1EC', borderRadius: 18,
    paddingHorizontal: 18, paddingVertical: 13,
    fontSize: 16, color: '#4A3A5C', backgroundColor: '#FBF4F9',
  },

  // Result
  backBtn: { marginBottom: 16 },
  backBtnText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },

  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingTitle:{ fontSize: 19, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  loadingDesc: { fontSize: 15, color: '#8A7C9C', marginTop: 6 },

  // 영양성분 상세 카드
  nutriCard: {
    backgroundColor: COLORS.card, borderRadius: 26, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  nutriProductName: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  nutriServing:     { fontSize: 14, color: '#8A7C9C', marginBottom: 14 },
  nutriKcalRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nutriKcalLabel:   { fontSize: 17, fontWeight: '700', color: COLORS.text },
  nutriKcalValue:   { fontSize: 22, fontWeight: '800' },
  nutriDivider:     { height: 1, backgroundColor: '#FFF5F8', marginBottom: 12 },
  nutriRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  nutriLabel:       { fontSize: 15, color: '#8A7C9C' },
  nutriValue:       { fontSize: 15, fontWeight: '600', color: COLORS.text },

  // 음식 편집 카드
  resultCard: {
    backgroundColor: COLORS.card, borderRadius: 26, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  resultCardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  mealTypeRow:         { flexDirection: 'row', gap: 8, marginBottom: 16 },
  mealTypeBtn:         { flex: 1, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5, borderColor: '#F0E1EC', alignItems: 'center' },
  mealTypeBtnActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  mealTypeBtnText:     { fontSize: 14, fontWeight: '600', color: '#8A7C9C' },
  mealTypeBtnTextActive: { color: '#fff' },

  foodItem: {
    backgroundColor: '#FBF4F9', borderRadius: 20, padding: 12, marginBottom: 8,
  },
  foodItemMain:    { flexDirection: 'row', gap: 8, marginBottom: 6 },
  foodNameInput:   { flex: 2, borderWidth: 1, borderColor: '#F0E1EC', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 7, fontSize: 15, color: COLORS.text, backgroundColor: '#fff' },
  foodAmountInput: { flex: 1, borderWidth: 1, borderColor: '#F0E1EC', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 7, fontSize: 15, color: COLORS.text, backgroundColor: '#fff' },
  foodItemBottom:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  foodKcalInput:   { flex: 1, borderWidth: 1, borderColor: '#F0E1EC', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 7, fontSize: 15, color: COLORS.text, backgroundColor: '#fff', textAlign: 'right' },
  foodKcalUnit:    { fontSize: 14, color: '#8A7C9C', fontWeight: '600' },
  removeBtn:       { paddingHorizontal: 14, paddingVertical: 6 },
  removeBtnText:   { fontSize: 16, color: '#D4C5DC', fontWeight: '700' },

  addFoodBtn:     { alignItems: 'center', paddingVertical: 13, marginBottom: 8 },
  addFoodBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '700' },

  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#FFF5F8', marginTop: 4 },
  totalLabel: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  totalKcal:  { fontSize: 22, fontWeight: '800' },

  saveBtn:     { borderRadius: 22, paddingVertical: 17, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  uncertainBadge: {
    backgroundColor: '#FFF3CD',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F5C99B',
  },
  uncertainBadgeText: { fontSize: 13, color: '#856404', fontWeight: '600' },

  resultCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  editToggleBtn: { backgroundColor: '#FFF5F8', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 6 },
  editToggleText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  editActionBar: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  editActionBtn: { flex: 1, borderRadius: 18, paddingVertical: 12, alignItems: 'center' },
  editActionText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  foodItemSelected: { backgroundColor: COLORS.primary + '15' },
  scanCheckbox: { width: 22, height: 22, borderRadius: 18, borderWidth: 2, borderColor: '#F0E1EC', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  scanCheckboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  scanCheckmark: { fontSize: 14, color: '#fff', fontWeight: '700' },
  aiSection: {
    backgroundColor: '#E6DAF5',
    borderRadius: 20,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E6DAF5',
  },
  aiSectionTitle: { fontSize: 15, fontWeight: '700', color: '#2C6FAC', marginBottom: 4 },
  aiSectionHint: { fontSize: 13, color: '#5A8FCC', marginBottom: 10 },
  aiInputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  aiCalcBtn: {
    backgroundColor: '#A98ED1',
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
  },
  aiCalcBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
