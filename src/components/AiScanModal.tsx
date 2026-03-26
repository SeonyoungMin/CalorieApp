import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, ScrollView, Alert, Platform,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { scanFoodImage, calculateCaloriesFromText, FoodCalorieResult } from '../services/claudeService';
import { saveMeal } from '../api/api';
import { useSubscription } from '../hooks/useSubscription';
import PremiumModal from './PremiumModal';

const COLORS = {
  primary: '#FF6B6B',
  secondary: '#4ECDC4',
  bg: '#F0F4F8',
  card: '#FFFFFF',
  text: '#2C3E50',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function AiScanModal({ visible, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<'select' | 'text' | 'result'>('select');
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FoodCalorieResult | null>(null);
  const [mealType, setMealType] = useState('아침');
  const [premiumVisible, setPremiumVisible] = useState(false);
  const { canScan, remainingFreeScans, isPremium, incrementScanCount, activatePremium, cancelPremium } = useSubscription();

  const checkScanLimit = () => {
    if (!canScan) {
      setPremiumVisible(true);
      return false;
    }
    return true;
  };

  const reset = () => {
    setMode('select');
    setTextInput('');
    setResult(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
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
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        setLoading(true);
        setMode('result');
        try {
          const base64 = await fileToBase64(file);
          const res = await scanFoodImage(base64, file.type);
          setResult(res);
          await incrementScanCount();
        } catch (err: any) {
          Alert.alert('오류', err.message || 'AI 분석 실패');
          setMode('select');
        } finally {
          setLoading(false);
        }
      };
      input.click();
      return;
    }

    const picker = useCamera ? launchCamera : launchImageLibrary;
    picker({ mediaType: 'photo', includeBase64: true, quality: 0.7 }, async (res) => {
      if (res.didCancel || !res.assets?.[0]?.base64) return;
      setLoading(true);
      setMode('result');
      try {
        const asset = res.assets[0];
        const scanResult = await scanFoodImage(asset.base64!, asset.type || 'image/jpeg');
        setResult(scanResult);
      } catch (err: any) {
        Alert.alert('오류', err.message || 'AI 분석 실패');
        setMode('select');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleTextScan = async () => {
    if (!textInput.trim()) return;
    if (!checkScanLimit()) return;
    setLoading(true);
    setMode('result');
    try {
      const res = await calculateCaloriesFromText(textInput.trim());
      setResult(res);
      await incrementScanCount();
    } catch (err: any) {
      Alert.alert('오류', err.message || 'AI 분석 실패');
      setMode('select');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      await saveMeal({
        mealType,
        totalKcal: result.totalKcal,
        isText: true,
        foods: result.foods.map(f => ({ foodName: f.name, kcal: f.kcal })),
      });
      Alert.alert('저장 완료', '식사가 기록되었습니다!');
      onSaved();
      handleClose();
    } catch (err) {
      Alert.alert('오류', '저장 실패');
    }
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
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
                    {remainingFreeScans > 0
                      ? `무료 스캔 ${remainingFreeScans}회 남음`
                      : '무료 스캔 소진 · 프리미엄 필요'}
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
                <View>
                  <Text style={styles.optionLabel}>카메라로 촬영</Text>
                  <Text style={styles.optionDesc}>지금 음식을 촬영해서 분석</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.optionBtn, { borderColor: COLORS.secondary }]} onPress={() => handleImagePick(false)}>
                <Text style={styles.optionEmoji}>🖼️</Text>
                <View>
                  <Text style={styles.optionLabel}>갤러리에서 선택</Text>
                  <Text style={styles.optionDesc}>저장된 음식 사진으로 분석</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.optionBtn, { borderColor: '#9C88FF' }]} onPress={() => setMode('text')}>
                <Text style={styles.optionEmoji}>✏️</Text>
                <View>
                  <Text style={styles.optionLabel}>텍스트로 입력</Text>
                  <Text style={styles.optionDesc}>음식명을 직접 입력해서 계산</Text>
                </View>
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
            <ScrollView>
              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>AI가 분석 중이에요...</Text>
                </View>
              ) : result ? (
                <>
                  <View style={styles.resultHeader}>
                    <Text style={styles.totalKcal}>{result.totalKcal} kcal</Text>
                    <Text style={styles.summary}>{result.summary}</Text>
                  </View>

                  {result.foods.map((food, i) => (
                    <View key={i} style={styles.foodRow}>
                      <Text style={styles.foodName}>{food.name}</Text>
                      <Text style={styles.foodAmount}>{food.amount}</Text>
                      <Text style={styles.foodKcal}>{food.kcal} kcal</Text>
                    </View>
                  ))}

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

                  <View style={styles.row}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
                      <Text style={styles.cancelText}>다시 스캔</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.scanBtn} onPress={handleSave}>
                      <Text style={styles.scanBtnText}>식사 저장</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>

    <PremiumModal
      visible={premiumVisible}
      onClose={() => setPremiumVisible(false)}
      isPremium={isPremium}
      onSubscribe={async () => {
        await activatePremium();
        setPremiumVisible(false);
      }}
      onCancel={async () => {
        await cancelPremium();
        setPremiumVisible(false);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '85%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  closeBtn: { fontSize: 20, color: '#B0BEC5', padding: 4 },
  desc: { fontSize: 14, color: '#78909C', lineHeight: 20, marginBottom: 20 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 1.5, borderRadius: 16, padding: 18, marginBottom: 12,
    backgroundColor: '#FAFBFD',
  },
  optionEmoji: { fontSize: 32 },
  optionLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  optionDesc: { fontSize: 12, color: '#78909C', marginTop: 2 },
  textInput: {
    borderWidth: 1.5, borderColor: '#E0E7EF', borderRadius: 14,
    padding: 16, fontSize: 15, color: COLORS.text,
    backgroundColor: '#FAFBFD', minHeight: 80, textAlignVertical: 'top',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#E0E7EF',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#78909C' },
  scanBtn: {
    flex: 2, backgroundColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  scanBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 16, fontSize: 15, color: '#78909C' },
  resultHeader: {
    backgroundColor: COLORS.primary + '15', borderRadius: 16,
    padding: 20, alignItems: 'center', marginBottom: 16,
  },
  totalKcal: { fontSize: 36, fontWeight: '900', color: COLORS.primary },
  summary: { fontSize: 13, color: '#78909C', marginTop: 4, textAlign: 'center' },
  foodRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F4F8',
  },
  foodName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  foodAmount: { fontSize: 13, color: '#78909C', marginHorizontal: 8 },
  foodKcal: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  mealLabel: { fontSize: 13, fontWeight: '600', color: '#78909C', marginTop: 16, marginBottom: 8 },
  mealTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  mealTypeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E0E7EF', alignItems: 'center',
  },
  mealTypeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  mealTypeText: { fontSize: 13, fontWeight: '600', color: '#78909C' },
  mealTypeTextActive: { color: '#fff' },
  scanCountBadge: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFF3E0', borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#FFB74D',
  },
  scanCountText: { fontSize: 13, fontWeight: '600', color: '#E65100' },
  scanCountUpgrade: { fontSize: 12, fontWeight: '700', color: '#FF6B6B' },
  premiumBadge: {
    backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12,
    marginBottom: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#FCC419',
  },
  premiumBadgeText: { fontSize: 13, fontWeight: '700', color: '#F59F00' },
});
