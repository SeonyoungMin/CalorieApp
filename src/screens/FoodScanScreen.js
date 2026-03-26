import React, {useState} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, ActivityIndicator,
  Image,
} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {analyzeAPI, mealAPI} from '../services/api';

const GREEN = '#4CAF50';

export default function FoodScanScreen() {
  const [mode, setMode] = useState('image'); // 'image' | 'text'
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mealType, setMealType] = useState('점심');

  const MEAL_TYPES = ['아침', '점심', '저녁', '간식'];

  const pickImage = async (useCamera) => {
    const options = {
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.8,
    };
    try {
      const fn = useCamera ? launchCamera : launchImageLibrary;
      const response = await fn(options);
      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert('오류', '이미지를 불러올 수 없습니다.');
        return;
      }
      const asset = response.assets?.[0];
      if (asset) {
        setImageUri(asset.uri);
        setImageBase64(asset.base64);
        setResult(null);
      }
    } catch (err) {
      Alert.alert('오류', '이미지를 불러올 수 없습니다.');
    }
  };

  const analyzeImage = async () => {
    if (!imageBase64) {
      Alert.alert('사진을 선택해주세요');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await analyzeAPI.analyzeImage(imageBase64);
      setResult(res.data);
    } catch (err) {
      Alert.alert('분석 실패', err.response?.data?.error || '다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const analyzeText = async () => {
    if (!textInput.trim()) {
      Alert.alert('음식명을 입력해주세요');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await analyzeAPI.analyzeText(textInput.trim());
      setResult(res.data);
    } catch (err) {
      Alert.alert('분석 실패', err.response?.data?.error || '다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const saveMeal = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await mealAPI.save(
        mealType,
        result.total_kcal,
        result.foods,
        mode === 'text',
      );
      Alert.alert('저장 완료', `${mealType} 식사가 기록되었습니다!`);
      setResult(null);
      setImageUri(null);
      setImageBase64(null);
      setTextInput('');
    } catch (err) {
      Alert.alert('저장 실패', err.response?.data?.error || '다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* 모드 탭 */}
      <View style={styles.modeTab}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'image' && styles.modeBtnActive]}
          onPress={() => {setMode('image'); setResult(null);}}>
          <Text style={[styles.modeBtnText, mode === 'image' && styles.modeBtnTextActive]}>
            📸 사진 분석
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'text' && styles.modeBtnActive]}
          onPress={() => {setMode('text'); setResult(null);}}>
          <Text style={[styles.modeBtnText, mode === 'text' && styles.modeBtnTextActive]}>
            ✏ 텍스트 분석
          </Text>
        </TouchableOpacity>
      </View>

      {/* 이미지 모드 */}
      {mode === 'image' && (
        <View>
          <TouchableOpacity style={styles.imageBox} onPress={() => pickImage(false)}>
            {imageUri
              ? <Image source={{uri: imageUri}} style={styles.previewImg} />
              : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderIcon}>📷</Text>
                  <Text style={styles.imagePlaceholderText}>탭하여 사진 선택</Text>
                </View>
              )}
          </TouchableOpacity>
          <View style={styles.imageRow}>
            <TouchableOpacity style={styles.imageBtn} onPress={() => pickImage(false)}>
              <Text style={styles.imageBtnText}>갤러리</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageBtn} onPress={() => pickImage(true)}>
              <Text style={styles.imageBtnText}>카메라</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.analyzeBtn, !imageBase64 && {opacity: 0.5}]}
            onPress={analyzeImage}
            disabled={loading || !imageBase64}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.analyzeBtnText}>🤖 AI 칼로리 분석</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* 텍스트 모드 */}
      {mode === 'text' && (
        <View>
          <TextInput
            style={styles.textInput}
            placeholder="예: 비빔밥 1공기, 된장국 1그릇, 김치"
            placeholderTextColor="#aaa"
            multiline
            value={textInput}
            onChangeText={setTextInput}
          />
          <TouchableOpacity
            style={[styles.analyzeBtn, !textInput.trim() && {opacity: 0.5}]}
            onPress={analyzeText}
            disabled={loading || !textInput.trim()}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.analyzeBtnText}>🤖 AI 칼로리 분석</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* 분석 결과 */}
      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>📊 분석 결과</Text>
          <Text style={styles.totalKcal}>{result.total_kcal} kcal</Text>

          {result.foods?.map((food, idx) => (
            <View key={idx} style={styles.foodRow}>
              <Text style={styles.foodName}>{food.name}</Text>
              <Text style={styles.foodKcal}>{food.kcal} kcal</Text>
            </View>
          ))}

          {/* 식사 타입 선택 */}
          <Text style={styles.mealTypeLabel}>식사 종류</Text>
          <View style={styles.mealTypeRow}>
            {MEAL_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.mealTypeBtn, mealType === t && styles.mealTypeBtnActive]}
                onPress={() => setMealType(t)}>
                <Text style={[styles.mealTypeBtnText, mealType === t && {color: '#fff'}]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={saveMeal} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>식단에 저장하기 💾</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f0f9f0'},
  content: {padding: 16},
  modeTab: {
    flexDirection: 'row', backgroundColor: '#eee',
    borderRadius: 12, padding: 4, marginBottom: 16,
  },
  modeBtn: {flex: 1, padding: 10, borderRadius: 10, alignItems: 'center'},
  modeBtnActive: {backgroundColor: '#fff', elevation: 2},
  modeBtnText: {color: '#888', fontSize: 14},
  modeBtnTextActive: {color: GREEN, fontWeight: 'bold'},
  imageBox: {
    backgroundColor: '#fff', borderRadius: 16, height: 200,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed', overflow: 'hidden',
  },
  previewImg: {width: '100%', height: '100%', resizeMode: 'cover'},
  imagePlaceholder: {alignItems: 'center'},
  imagePlaceholderIcon: {fontSize: 48},
  imagePlaceholderText: {color: '#aaa', marginTop: 8, fontSize: 14},
  imageRow: {flexDirection: 'row', gap: 8, marginTop: 10},
  imageBtn: {
    flex: 1, backgroundColor: '#e8f5e9', borderRadius: 10,
    padding: 12, alignItems: 'center',
  },
  imageBtnText: {color: GREEN, fontWeight: '600'},
  analyzeBtn: {
    backgroundColor: GREEN, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 12,
  },
  analyzeBtnText: {color: '#fff', fontSize: 16, fontWeight: 'bold'},
  textInput: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    fontSize: 15, color: '#333', minHeight: 100, textAlignVertical: 'top',
    borderWidth: 1, borderColor: '#ddd',
  },
  resultCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    marginTop: 16, elevation: 3,
  },
  resultTitle: {fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8},
  totalKcal: {
    fontSize: 32, fontWeight: 'bold', color: GREEN,
    textAlign: 'center', marginBottom: 16,
  },
  foodRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  foodName: {fontSize: 14, color: '#444'},
  foodKcal: {fontSize: 14, fontWeight: '600', color: '#333'},
  mealTypeLabel: {fontSize: 13, color: '#666', marginTop: 16, marginBottom: 8},
  mealTypeRow: {flexDirection: 'row', gap: 8, marginBottom: 16},
  mealTypeBtn: {
    flex: 1, padding: 8, borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: GREEN,
  },
  mealTypeBtnActive: {backgroundColor: GREEN},
  mealTypeBtnText: {color: GREEN, fontSize: 13, fontWeight: '600'},
  saveBtn: {
    backgroundColor: '#2196F3', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  saveBtnText: {color: '#fff', fontSize: 15, fontWeight: 'bold'},
});
