import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, ScrollView, Alert, Platform,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { scanFoodImage, calculateCaloriesFromText, FoodCalorieResult } from '../services/claudeService';
import { saveMeal } from '../api/api';
import { useSubscription } from '../hooks/useSubscription';
import PremiumModal from './PremiumModal';
import CalendarPicker from './CalendarPicker';
import { COLORS } from '../theme';
import { localDateStr } from '../utils/dateUtils';

interface EditableFood {
  name: string;
  amount: string;
  kcal: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const todayStr = () => localDateStr();

export default function AiScanModal({ visible, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<'select' | 'text' | 'result'>('select');
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mealType, setMealType] = useState('아침');
  const [logDate, setLogDate] = useState(todayStr());
  const [showCalendar, setShowCalendar] = useState(false);
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [editableFoods, setEditableFoods] = useState<EditableFood[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [aiAddText, setAiAddText] = useState('');
  const [aiAddAmount, setAiAddAmount] = useState('');
  const [aiAddLoading, setAiAddLoading] = useState(false);
  const { canScan, remainingFreeScans, isPremium, incrementScanCount, purchasePremium, cancelPremium } = useSubscription();

  // 모달이 열릴 때마다 오늘 날짜로 리셋 (앱이 오래 떠있어도 날짜 오류 방지)
  useEffect(() => {
    if (visible) setLogDate(todayStr());
  }, [visible]);

  const totalKcal = editableFoods.reduce((s, f) => s + (parseInt(f.kcal) || 0), 0);

  const checkScanLimit = () => {
    if (!canScan) { setPremiumVisible(true); return false; }
    return true;
  };

  const reset = () => {
    setMode('select');
    setTextInput('');
    setEditableFoods([]);
    setLoading(false);
    setLogDate(todayStr());
    setEditMode(false);
    setSelectedIndices([]);
    setAiAddText('');
    setAiAddAmount('');
  };

  const handleAiAdd = async () => {
    if (!aiAddText.trim()) return;
    setAiAddLoading(true);
    try {
      const query = aiAddAmount.trim() ? `${aiAddText.trim()} ${aiAddAmount.trim()}` : aiAddText.trim();
      const res = await calculateCaloriesFromText(query);
      setEditableFoods(prev => [
        ...prev,
        ...res.foods.map(f => ({ name: f.name, amount: f.amount || '', kcal: String(f.kcal) })),
      ]);
      setAiAddText('');
      setAiAddAmount('');
    } catch {
      Alert.alert('AI 계산 실패', '다시 시도해주세요.');
    } finally {
      setAiAddLoading(false);
    }
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

  const handleClose = () => { reset(); onClose(); };

  const applyResult = (res: FoodCalorieResult) => {
    setEditableFoods(res.foods.map(f => ({
      name: f.name,
      amount: f.amount || '',
      kcal: String(f.kcal),
    })));
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleImagePick = async (useCamera: boolean) => {
    if (!checkScanLimit()) return;
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (useCamera) input.capture = 'environment';
      input.style.position = 'fixed';
      input.style.opacity = '0';
      input.style.pointerEvents = 'none';
      const removeInput = () => {
        if (document.body.contains(input)) document.body.removeChild(input);
      };
      document.body.appendChild(input);
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        removeInput();
        if (!file) return;
        setLoading(true);
        setMode('result');
        try {
          const base64 = await fileToBase64(file);
          const res = await scanFoodImage(base64, file.type);
          applyResult(res);
          await incrementScanCount();
        } catch (err: any) {
          Alert.alert('오류', err.message || 'AI 분석 실패');
          setMode('select');
        } finally {
          setLoading(false);
        }
      };
      input.addEventListener('cancel', removeInput);
      input.click();
      return;
    }
    const picker = useCamera ? launchCamera : launchImageLibrary;
    const quality = useCamera ? 0.2 : 0.4;
    const maxSize = useCamera ? 800 : 1280;
    picker({ mediaType: 'photo', includeBase64: true, quality, maxWidth: maxSize, maxHeight: maxSize }, async (res) => {
      if (res.didCancel || !res.assets?.[0]?.base64) return;
      setLoading(true);
      setMode('result');
      try {
        const asset = res.assets[0];
        const scanResult = await scanFoodImage(asset.base64!, 'image/jpeg');
        applyResult(scanResult);
        await incrementScanCount();
      } catch (err: any) {
        Alert.alert('오류', err.message || 'AI 분석 실패');
        setMode('select');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleTextScan = async () => {
    if (!textInput.trim() || !checkScanLimit()) return;
    setLoading(true);
    setMode('result');
    try {
      const res = await calculateCaloriesFromText(textInput.trim());
      applyResult(res);
      await incrementScanCount();
    } catch (err: any) {
      Alert.alert('오류', err.message || 'AI 분석 실패');
      setMode('select');
    } finally {
      setLoading(false);
    }
  };

  const updateFood = (idx: number, field: keyof EditableFood, value: string) => {
    setEditableFoods(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f));
  };

  const addFood = () => {
    setEditableFoods(prev => [...prev, { name: '', amount: '', kcal: '' }]);
  };

  const removeFood = (idx: number) => {
    if (editableFoods.length <= 1) return;
    setEditableFoods(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    const validFoods = editableFoods.filter(f => f.name.trim());
    if (!validFoods.length) {
      Alert.alert('입력 오류', '음식 이름을 입력해주세요.');
      return;
    }
    try {
      await saveMeal({
        mealType,
        totalKcal,
        isText: true,
        logDate,
        foods: validFoods.map(f => ({ foodName: f.name.trim(), kcal: parseInt(f.kcal) || 0 })),
      });
      const isToday = logDate === todayStr();
      Alert.alert('저장 완료', isToday ? '식사가 기록되었습니다!' : `${logDate} 날짜로 기록되었습니다.`);
      if (isToday) onSaved();
      handleClose();
    } catch {
      Alert.alert('오류', '저장 실패');
    }
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🤖 AI 칼로리 스캔</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Select Mode */}
          {mode === 'select' && (
            <ScrollView>
              {!isPremium && (
                <TouchableOpacity style={styles.scanCountBadge} onPress={() => setPremiumVisible(true)}>
                  <Text style={styles.scanCountText}>
                    {remainingFreeScans > 0 ? `무료 스캔 ${remainingFreeScans}회 남음` : '무료 스캔 소진 · 프리미엄 필요'}
                  </Text>
                  <Text style={styles.scanCountUpgrade}>👑 업그레이드</Text>
                </TouchableOpacity>
              )}
              {isPremium && (
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>👑 프리미엄 · 무제한 스캔</Text>
                </View>
              )}
              <Text style={styles.desc}>음식 사진을 찍거나 텍스트로 입력하면{'\n'}AI가 자동으로 칼로리를 계산해요</Text>
              <TouchableOpacity style={[styles.optionBtn, { borderColor: COLORS.primary }]} onPress={() => handleImagePick(true)}>
                <Text style={styles.optionEmoji}>📷</Text>
                <View style={{ flex: 1, flexShrink: 1 }}><Text style={styles.optionLabel} numberOfLines={1}>카메라로 촬영</Text><Text style={styles.optionDesc} numberOfLines={1}>지금 음식을 촬영해서 분석</Text></View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.optionBtn, { borderColor: COLORS.secondary }]} onPress={() => handleImagePick(false)}>
                <Text style={styles.optionEmoji}>🖼️</Text>
                <View style={{ flex: 1, flexShrink: 1 }}><Text style={styles.optionLabel} numberOfLines={1}>갤러리에서 선택</Text><Text style={styles.optionDesc} numberOfLines={1}>저장된 음식 사진으로 분석</Text></View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.optionBtn, { borderColor: '#9C88FF' }]} onPress={() => setMode('text')}>
                <Text style={styles.optionEmoji}>✏️</Text>
                <View style={{ flex: 1, flexShrink: 1 }}><Text style={styles.optionLabel} numberOfLines={1}>텍스트로 입력</Text><Text style={styles.optionDesc} numberOfLines={1}>음식명을 직접 입력해서 계산</Text></View>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Text Mode */}
          {mode === 'text' && (
            <View>
              <Text style={styles.desc}>먹은 음식을 입력하세요{'\n'}예: 공기밥 1공기, 된장찌개, 삼겹살 200g</Text>
              <TextInput
                style={styles.textInput}
                placeholder="음식을 입력하세요..."
                placeholderTextColor="#B0BEC5"
                value={textInput}
                onChangeText={setTextInput}
                multiline
                numberOfLines={3}
                autoFocus
              />
              <View style={styles.row}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode('select')}>
                  <Text style={styles.cancelText}>뒤로</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.scanBtn, !textInput.trim() && styles.btnDisabled]}
                  onPress={handleTextScan}
                  disabled={!textInput.trim()}
                >
                  <Text style={styles.scanBtnText}>AI 분석</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Result Mode */}
          {mode === 'result' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>AI가 분석 중이에요...</Text>
                </View>
              ) : (
                <>
                  {/* 총 칼로리 + 편집 버튼 */}
                  <View style={styles.resultHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.totalKcal}>{totalKcal} kcal</Text>
                      <Text style={styles.summary}>아래 내용을 수정할 수 있어요</Text>
                    </View>
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

                  {/* 편집 모드 액션바 */}
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

                  {/* 음식 항목 (편집 가능) */}
                  {editableFoods.map((food, i) => (
                    editMode ? (
                      <TouchableOpacity key={i} style={[styles.editRow, selectedIndices.includes(i) && styles.editRowSelected]} onPress={() => toggleSelect(i)} activeOpacity={0.7}>
                        <View style={[styles.checkbox, selectedIndices.includes(i) && styles.checkboxOn]}>
                          {selectedIndices.includes(i) && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={[styles.editInput, { flex: 2, paddingVertical: 8 }]} numberOfLines={1}>{food.name || '(음식명 없음)'}</Text>
                        <Text style={[styles.editInput, { flex: 1, textAlign: 'right', paddingVertical: 8 }]}>{food.kcal || '0'} kcal</Text>
                      </TouchableOpacity>
                    ) : (
                      <View key={i} style={styles.editRow}>
                        <TextInput
                          style={[styles.editInput, { flex: 2 }]}
                          value={food.name}
                          onChangeText={v => updateFood(i, 'name', v)}
                          placeholder="음식명"
                          placeholderTextColor="#B0BEC5"
                        />
                        <TextInput
                          style={[styles.editInput, { flex: 1 }]}
                          value={food.kcal}
                          onChangeText={v => updateFood(i, 'kcal', v.replace(/[^0-9]/g, ''))}
                          placeholder="kcal"
                          placeholderTextColor="#B0BEC5"
                          keyboardType="numeric"
                        />
                        <TouchableOpacity onPress={() => removeFood(i)} style={styles.removeBtn}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  ))}

                  {!editMode && (
                    <>
                      <TouchableOpacity style={styles.addFoodBtn} onPress={addFood}>
                        <Text style={styles.addFoodText}>+ 수동 추가</Text>
                      </TouchableOpacity>

                      {/* AI로 추가 */}
                      <View style={styles.aiAddSection}>
                        <Text style={styles.aiAddTitle}>🤖 AI로 추가</Text>
                        <Text style={styles.aiAddHint}>음식명을 입력하면 AI가 칼로리를 자동으로 계산해드립니다</Text>
                        <View style={styles.aiAddRow}>
                          <TextInput
                            style={[styles.editInput, { flex: 2 }]}
                            value={aiAddText}
                            onChangeText={setAiAddText}
                            placeholder="음식명 (예: 된장찌개)"
                            placeholderTextColor="#B0BEC5"
                          />
                          <TextInput
                            style={[styles.editInput, { flex: 1 }]}
                            value={aiAddAmount}
                            onChangeText={setAiAddAmount}
                            placeholder="양 (선택)"
                            placeholderTextColor="#B0BEC5"
                          />
                        </View>
                        <TouchableOpacity
                          style={[styles.aiAddBtn, aiAddLoading && { opacity: 0.6 }]}
                          onPress={handleAiAdd}
                          disabled={aiAddLoading}
                        >
                          {aiAddLoading
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={styles.aiAddBtnText}>🤖 AI 계산 후 추가</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* 식사 구분 */}
                  <Text style={styles.mealLabel}>식사 구분</Text>
                  <View style={styles.mealTypeRow}>
                    {['아침', '점심', '저녁', '간식'].map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.mealTypeBtn, mealType === t && styles.mealTypeBtnActive]}
                        onPress={() => setMealType(t)}
                      >
                        <Text style={[styles.mealTypeText, mealType === t && styles.mealTypeTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 날짜 선택 */}
                  <Text style={styles.mealLabel}>날짜</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={logDate}
                      max={todayStr()}
                      onChange={e => setLogDate(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 14px', fontSize: 15,
                        border: '1.5px solid #E0E7EF', borderRadius: 12,
                        marginBottom: 16, color: '#2C3E50', backgroundColor: '#FAFBFD',
                        boxSizing: 'border-box',
                      } as any}
                    />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.datePickerBtn}
                        onPress={() => setShowCalendar(true)}
                      >
                        <Text style={styles.datePickerBtnText}>📅 {logDate}</Text>
                      </TouchableOpacity>
                      <CalendarPicker
                        visible={showCalendar}
                        value={logDate}
                        maxDate={todayStr()}
                        onSelect={d => { setLogDate(d); setShowCalendar(false); }}
                        onClose={() => setShowCalendar(false)}
                      />
                    </>
                  )}

                  <View style={styles.row}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
                      <Text style={styles.cancelText}>다시 스캔</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.scanBtn} onPress={handleSave}>
                      <Text style={styles.scanBtnText}>식사 저장</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>

    <PremiumModal
      visible={premiumVisible}
      onClose={() => setPremiumVisible(false)}
      isPremium={isPremium}
      onSubscribe={async () => { await purchasePremium(); setPremiumVisible(false); }}
      onCancel={async () => { await cancelPremium(); setPremiumVisible(false); }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  closeBtn: { fontSize: 20, color: '#B0BEC5', padding: 4 },
  desc: { fontSize: 14, color: '#78909C', lineHeight: 20, marginBottom: 20 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1.5, borderRadius: 16, padding: 18, marginBottom: 12, backgroundColor: '#FAFBFD' },
  optionEmoji: { fontSize: 32 },
  optionLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  optionDesc: { fontSize: 12, color: '#78909C', marginTop: 2, flexShrink: 1 },
  textInput: { borderWidth: 1.5, borderColor: '#E0E7EF', borderRadius: 14, padding: 16, fontSize: 15, color: COLORS.text, backgroundColor: '#FAFBFD', minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: '#E0E7EF', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#78909C' },
  scanBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  scanBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 16, fontSize: 15, color: '#78909C' },
  resultHeader: { backgroundColor: COLORS.primary + '15', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16 },
  totalKcal: { fontSize: 36, fontWeight: '900', color: COLORS.primary },
  summary: { fontSize: 13, color: '#78909C', marginTop: 4 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  editInput: { borderWidth: 1.5, borderColor: '#E0E7EF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: COLORS.text, backgroundColor: '#FAFBFD' },
  removeBtn: { padding: 6 },
  removeBtnText: { fontSize: 16, color: '#B0BEC5', fontWeight: '700' },
  addFoodBtn: { borderWidth: 1.5, borderColor: COLORS.secondary, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 16, borderStyle: 'dashed' },
  addFoodText: { fontSize: 14, fontWeight: '600', color: COLORS.secondary },
  mealLabel: { fontSize: 13, fontWeight: '600', color: '#78909C', marginBottom: 8 },
  mealTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  mealTypeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#E0E7EF', alignItems: 'center' },
  mealTypeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  mealTypeText: { fontSize: 13, fontWeight: '600', color: '#78909C' },
  mealTypeTextActive: { color: '#fff' },
  datePickerBtn: { borderWidth: 1.5, borderColor: '#E0E7EF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, backgroundColor: '#FAFBFD' },
  datePickerBtnText: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  editToggleBtn: { backgroundColor: '#F0F4F8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 12 },
  editToggleText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  editActionBar: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  editActionBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  editActionText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  editRowSelected: { backgroundColor: COLORS.primary + '15', borderRadius: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D0D8E4', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { fontSize: 12, color: '#fff', fontWeight: '700' },
  aiAddSection: { backgroundColor: '#F0F7FF', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#DCEEFF' },
  aiAddTitle: { fontSize: 13, fontWeight: '700', color: '#2C6FAC', marginBottom: 4 },
  aiAddHint: { fontSize: 11, color: '#5A8FCC', marginBottom: 10 },
  aiAddRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  aiAddBtn: { backgroundColor: '#4A90D9', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  aiAddBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  scanCountBadge: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF3E0', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FFB74D' },
  scanCountText: { fontSize: 13, fontWeight: '600', color: '#E65100' },
  scanCountUpgrade: { fontSize: 12, fontWeight: '700', color: '#FF6B6B' },
  premiumBadge: { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FCC419' },
  premiumBadgeText: { fontSize: 13, fontWeight: '700', color: '#F59F00' },
});
