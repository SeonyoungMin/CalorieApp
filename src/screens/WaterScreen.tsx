import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getTodayWater, updateWater } from '../api/api';
import { COLORS } from '../theme';
import Icon from '../components/Icon';

const GOAL_ML = 2000;
const CUP_ML = 250;
const CUP_OPTIONS = [100, 150, 200, 250, 300, 500];

function WaterCupIcon({ filled, size = 48 }: { filled: boolean; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size * 1.2,
        borderWidth: 2.5,
        borderColor: filled ? COLORS.water : '#B0E0F7',
        borderRadius: 16,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        overflow: 'hidden',
        backgroundColor: filled ? COLORS.water : '#EBF8FF',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      {filled && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '80%',
            backgroundColor: COLORS.water,
            opacity: 0.8,
          }}
        />
      )}
      <Text style={{ fontSize: size * 0.45, zIndex: 1 }}></Text>
    </View>
  );
}

export default function WaterScreen({ navigation }: any) {
  const [totalMl, setTotalMl] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customModal, setCustomModal] = useState(false);
  const [customMl, setCustomMl] = useState('');

  // 애니메이션
  const fillAnim = useRef(new Animated.Value(0)).current;
  const numberScale = useRef(new Animated.Value(1)).current;
  const splashAnims = useRef(
    Array.from({ length: 6 }, () => ({
      y: new Animated.Value(0),
      x: (Math.random() - 0.5) * 50,
      delay: Math.random() * 150,
    }))
  ).current;

  const fetchData = useCallback(async () => {
    try {
      const res = await getTodayWater();
      setTotalMl(res.data?.totalMl || 0);
    } catch {
      Alert.alert('오류', '물 섭취 정보를 불러오지 못했습니다.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
    }, [fetchData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const triggerSplashAnim = () => {
    // 숫자 통통
    Animated.sequence([
      Animated.timing(numberScale, { toValue: 1.25, duration: 120, useNativeDriver: true }),
      Animated.spring(numberScale, { toValue: 1, friction: 3, tension: 80, useNativeDriver: true }),
    ]).start();
    // 물방울 splash
    splashAnims.forEach((s) => {
      s.y.setValue(0);
      Animated.timing(s.y, {
        toValue: 1,
        duration: 900,
        delay: s.delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const addWater = async (ml: number) => {
    const newTotal = Math.min(totalMl + ml, GOAL_ML * 2);
    triggerSplashAnim();
    setSaving(true);
    try {
      await updateWater(newTotal);
      setTotalMl(newTotal);
    } catch {
      Alert.alert('오류', '업데이트에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const removeWater = async () => {
    const newTotal = Math.max(totalMl - CUP_ML, 0);
    setSaving(true);
    try {
      await updateWater(newTotal);
      setTotalMl(newTotal);
    } catch {
      Alert.alert('오류', '업데이트에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const resetWater = () => {
    Alert.alert('초기화', '오늘 물 섭취량을 초기화할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await updateWater(0);
            setTotalMl(0);
          } catch {
            Alert.alert('오류', '초기화에 실패했습니다.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleCustomAdd = async () => {
    const ml = parseInt(customMl, 10);
    if (isNaN(ml) || ml <= 0) {
      Alert.alert('입력 오류', '유효한 ml를 입력해주세요.');
      return;
    }
    setCustomModal(false);
    setCustomMl('');
    await addWater(ml);
  };

  const pct = Math.min(totalMl / GOAL_ML, 1);
  const cups = Math.floor(totalMl / CUP_ML);
  const totalCups = Math.ceil(GOAL_ML / CUP_ML);

  // 물 차오름 부드러운 애니메이션 (pct 바뀔 때마다)
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: pct,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, fillAnim]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.water} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.water} />}
      >
        {/* 초기화 버튼 */}
        <View style={[styles.header, { justifyContent: 'flex-end' }]}>
          <TouchableOpacity onPress={resetWater}>
            <Text style={styles.resetText}>초기화</Text>
          </TouchableOpacity>
        </View>

        {/* Main Progress Card */}
        <View style={styles.mainCard}>
          <View style={styles.waterVisual}>
            {/* Water bottle visual */}
            <View style={styles.bottleOuter}>
              {/* splash 물방울 — bottleOuter 안에서 위로 튀어오름 */}
              {splashAnims.map((s, i) => (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    top: 14,
                    left: 35 + s.x,
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    backgroundColor: COLORS.water,
                    opacity: s.y.interpolate({ inputRange: [0, 0.2, 0.9, 1], outputRange: [0, 1, 1, 0] }),
                    transform: [
                      { translateY: s.y.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) },
                      { scale: s.y.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.2, 0.6] }) },
                    ],
                  }}
                />
              ))}
              <View style={styles.bottleNeck} />
              <View style={styles.bottleBody}>
                <Animated.View
                  style={[
                    styles.waterFill,
                    { height: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                  ]}
                />
                <View style={styles.waterTextOverlay}>
                  <Animated.Text style={[styles.waterAmount, { transform: [{ scale: numberScale }] }]}>
                    {totalMl}
                  </Animated.Text>
                  <Text style={styles.waterUnit}>ml</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.waterInfo}>
            <Text style={styles.goalText}>목표: {GOAL_ML} ml</Text>
            <Text style={styles.remainText}>
              {totalMl >= GOAL_ML
                ? '목표 달성!'
                : `${GOAL_ML - totalMl} ml 더 필요`}
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
            </View>
            <Text style={styles.progressPct}>{Math.round(pct * 100)}%</Text>
          </View>
        </View>

        {/* Cup Visual */}
        <View style={styles.cupsCard}>
          <Text style={styles.cupsTitle}>컵 ({CUP_ML}ml 기준)</Text>
          <View style={styles.cupsRow}>
            {Array.from({ length: totalCups }).map((_, i) => (
              <WaterCupIcon key={i} filled={i < cups} size={36} />
            ))}
          </View>
          <Text style={styles.cupsText}>{cups} / {totalCups} 컵</Text>
        </View>

        {/* Quick Add Buttons */}
        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>빠른 추가</Text>
          <View style={styles.quickGrid}>
            {CUP_OPTIONS.map((ml) => (
              <TouchableOpacity
                key={ml}
                style={[styles.cupBtn, saving && styles.cupBtnDisabled]}
                onPress={() => addWater(ml)}
                disabled={saving}
                activeOpacity={0.7}
              >
                
                <Text style={styles.cupBtnText}>+{ml}ml</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Action Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#FFD6E5' }]}
            onPress={removeWater}
            disabled={totalMl === 0 || saving}
          >
            <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>− {CUP_ML}ml</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#E6DAF5', flex: 2, marginHorizontal: 8 }]}
            onPress={() => setCustomModal(true)}
            disabled={saving}
          >
            <Text style={[styles.actionBtnText, { color: COLORS.waterDark }]}>직접 입력</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#E0F7FA' }]}
            onPress={() => addWater(CUP_ML)}
            disabled={saving}
          >
            <Text style={[styles.actionBtnText, { color: COLORS.secondary }]}>+ {CUP_ML}ml</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Custom Modal */}
      <Modal visible={customModal} animationType="slide" transparent onRequestClose={() => { setCustomModal(false); setCustomMl(''); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>직접 입력</Text>
              <TouchableOpacity onPress={() => { setCustomModal(false); setCustomMl(''); }}>
                <Icon name="close" size={18} color={COLORS.subText} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="마신 물의 양 (ml)"
              placeholderTextColor="#D4C5DC"
              keyboardType="numeric"
              value={customMl}
              onChangeText={setCustomMl}
              autoFocus
            />
            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleCustomAdd}>
              <Text style={styles.modalSaveBtnText}>추가</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 72 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, color: COLORS.water, fontWeight: '700' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  resetText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  mainCard: {
    backgroundColor: COLORS.card,
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  waterVisual: { alignItems: 'center' },
  bottleOuter: { alignItems: 'center' },
  bottleNeck: {
    width: 30,
    height: 14,
    backgroundColor: '#B0E0F7',
    borderRadius: 12,
    marginBottom: -2,
    zIndex: 1,
  },
  bottleBody: {
    width: 70,
    height: 120,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: COLORS.water,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#EBF8FF',
  },
  waterFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.water,
    opacity: 0.7,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  waterTextOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waterAmount: { fontSize: 19, fontWeight: '900', color: COLORS.waterDark },
  waterUnit: { fontSize: 13, color: COLORS.waterDark, fontWeight: '600' },
  waterInfo: { flex: 1 },
  goalText: { fontSize: 15, color: '#8A7C9C', fontWeight: '500' },
  remainText: { fontSize: 17, fontWeight: '700', color: COLORS.waterDark, marginTop: 4, marginBottom: 12 },
  progressBg: { height: 10, backgroundColor: '#E6DAF5', borderRadius: 12, overflow: 'hidden' },
  progressFill: { height: 10, backgroundColor: COLORS.water, borderRadius: 12 },
  progressPct: { fontSize: 15, color: COLORS.water, fontWeight: '700', marginTop: 4 },
  cupsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cupsTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  cupsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cupsText: { fontSize: 14, color: '#8A7C9C', marginTop: 8, textAlign: 'center' },
  quickCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  quickTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cupBtn: {
    width: '30%',
    backgroundColor: '#E6DAF5',
    borderRadius: 22,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  cupBtnDisabled: { opacity: 0.5 },
  cupBtnEmoji: { fontSize: 22 },
  cupBtnText: { fontSize: 15, color: COLORS.waterDark, fontWeight: '700', marginTop: 4 },
  actionRow: { flexDirection: 'row' },
  actionBtn: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 15,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  modalClose: { fontSize: 20, color: '#D4C5DC' },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#F0E1EC',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 17,
    fontSize: 20,
    color: COLORS.text,
    backgroundColor: '#FBF4F9',
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 16,
  },
  modalSaveBtn: {
    backgroundColor: COLORS.water,
    borderRadius: 22,
    paddingVertical: 15,
    alignItems: 'center',
  },
  modalSaveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
