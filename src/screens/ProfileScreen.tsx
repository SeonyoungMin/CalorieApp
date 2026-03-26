import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { setGoalKcal, setUserProfile } from '../api/api';
import { useAuth } from '../context/AuthContext';

const COLORS = {
  primary: '#FF6B6B',
  secondary: '#4ECDC4',
  success: '#51CF66',
  warning: '#FCC419',
  purple: '#9C88FF',
  bg: '#F0F4F8',
  card: '#FFFFFF',
  text: '#2C3E50',
};

const MENU_ITEMS = [
  { id: 'goal', emoji: '🎯', label: '칼로리 목표 설정', sub: '일일 목표 칼로리를 설정하세요', color: COLORS.primary },
  { id: 'profile', emoji: '👤', label: '신체 정보 설정', sub: '체중, 키를 입력하세요', color: COLORS.secondary },
  { id: 'water', emoji: '💧', label: '물 섭취 기록', sub: '오늘의 수분 섭취를 확인하세요', color: '#4FC3F7' },
  { id: 'cycle', emoji: '🌸', label: '생리주기 관리', sub: '주기를 추적하세요', color: '#FF8FAB' },
];

export default function ProfileScreen({ navigation }: any) {
  const { logout, goalKcal: contextGoal, userWeightKg, userHeightCm, nickname, refreshProfile } = useAuth();
  const [goalModal, setGoalModal] = useState(false);
  const [profileModal, setProfileModal] = useState(false);

  const [goalKcal, setGoalKcalInput] = useState(String(contextGoal || 2000));
  const [weightKg, setWeightKgInput] = useState(userWeightKg ? String(userWeightKg) : '');
  const [heightCm, setHeightCmInput] = useState(userHeightCm ? String(userHeightCm) : '');
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setGoalKcalInput(String(contextGoal || 2000));
  }, [contextGoal]);

  useEffect(() => {
    if (userWeightKg) setWeightKgInput(String(userWeightKg));
    if (userHeightCm) setHeightCmInput(String(userHeightCm));
  }, [userWeightKg, userHeightCm]);

  const handleSaveGoal = async () => {
    const kcal = parseInt(goalKcal, 10);
    if (isNaN(kcal) || kcal < 500 || kcal > 10000) {
      Alert.alert('입력 오류', '유효한 칼로리를 입력해주세요. (500~10000 kcal)');
      return;
    }
    setSavingGoal(true);
    try {
      await setGoalKcal(kcal);
      await refreshProfile();
      Alert.alert('저장 완료', `일일 목표 칼로리가 ${kcal} kcal로 설정되었습니다.`);
      setGoalModal(false);
    } catch (e: any) {
      Alert.alert('저장 실패', e?.response?.data?.message || '다시 시도해주세요.');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleSaveProfile = async () => {
    const kg = parseFloat(weightKg);
    const cm = parseFloat(heightCm);
    if (isNaN(kg) || kg <= 0 || isNaN(cm) || cm <= 0) {
      Alert.alert('입력 오류', '체중과 키를 올바르게 입력해주세요.');
      return;
    }
    setSavingProfile(true);
    try {
      await setUserProfile(kg, cm);
      await refreshProfile();
      const heightM = cm / 100;
      const bmi = (kg / (heightM * heightM)).toFixed(1);
      Alert.alert('저장 완료', `신체 정보가 저장되었습니다.\nBMI: ${bmi}`);
      setProfileModal(false);
    } catch (e: any) {
      Alert.alert('저장 실패', e?.response?.data?.message || '다시 시도해주세요.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleMenuPress = (id: string) => {
    if (id === 'goal') setGoalModal(true);
    else if (id === 'profile') setProfileModal(true);
    else if (id === 'water') navigation.navigate('Water');
    else if (id === 'cycle') navigation.navigate('Cycle');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
          <Text style={styles.username}>{nickname || '내 프로필'}</Text>
          <Text style={styles.usernameSubt}>목표 {contextGoal} kcal · 건강 목표를 설정하고 관리하세요</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, idx < MENU_ITEMS.length - 1 && styles.menuBorder]}
              onPress={() => handleMenuPress(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: item.color + '22' }]}>
                <Text style={styles.menuIcon}>{item.emoji}</Text>
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSub}>{item.sub}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* BMI Calculator shortcut */}
        <View style={styles.bmiCard}>
          <Text style={styles.bmiTitle}>BMI 계산기</Text>
          <Text style={styles.bmiDesc}>신체 정보를 입력하면 BMI를 자동 계산합니다</Text>
          <View style={styles.bmiTable}>
            {[
              { range: '18.5 미만', label: '저체중', color: '#4FC3F7' },
              { range: '18.5~22.9', label: '정상', color: COLORS.success },
              { range: '23~24.9', label: '과체중', color: COLORS.warning },
              { range: '25 이상', label: '비만', color: COLORS.primary },
            ].map((row) => (
              <View key={row.label} style={styles.bmiRow}>
                <View style={[styles.bmiDot, { backgroundColor: row.color }]} />
                <Text style={styles.bmiRange}>{row.range}</Text>
                <Text style={[styles.bmiLabel, { color: row.color }]}>{row.label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={() => setProfileModal(true)}>
            <Text style={styles.profileBtnText}>신체 정보 입력하기</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() =>
            Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
              { text: '취소', style: 'cancel' },
              { text: '로그아웃', style: 'destructive', onPress: logout },
            ])
          }
          activeOpacity={0.8}
        >
          <Text style={styles.logoutBtnText}>로그아웃</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Goal Modal */}
      <Modal visible={goalModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎯 칼로리 목표 설정</Text>
              <TouchableOpacity onPress={() => setGoalModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>일일 목표 칼로리 (kcal)</Text>
            <TextInput
              style={styles.input}
              placeholder="2000"
              placeholderTextColor="#B0BEC5"
              keyboardType="numeric"
              value={goalKcal}
              onChangeText={setGoalKcalInput}
              autoFocus
            />
            <View style={styles.presetRow}>
              {[1500, 1800, 2000, 2200, 2500].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.presetBtn, goalKcal === String(v) && styles.presetBtnActive]}
                  onPress={() => setGoalKcalInput(String(v))}
                >
                  <Text style={[styles.presetBtnText, goalKcal === String(v) && { color: '#fff' }]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, savingGoal && { opacity: 0.6 }]}
              onPress={handleSaveGoal}
              disabled={savingGoal}
            >
              {savingGoal ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>저장</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Profile Modal */}
      <Modal visible={profileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>👤 신체 정보 설정</Text>
              <TouchableOpacity onPress={() => setProfileModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>체중 (kg)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="65.0"
                  placeholderTextColor="#B0BEC5"
                  keyboardType="decimal-pad"
                  value={weightKg}
                  onChangeText={setWeightKgInput}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>키 (cm)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="170"
                  placeholderTextColor="#B0BEC5"
                  keyboardType="decimal-pad"
                  value={heightCm}
                  onChangeText={setHeightCmInput}
                />
              </View>
            </View>
            {weightKg && heightCm && parseFloat(weightKg) > 0 && parseFloat(heightCm) > 0 && (
              <View style={styles.bmiPreview}>
                <Text style={styles.bmiPreviewText}>
                  BMI:{' '}
                  {(parseFloat(weightKg) / Math.pow(parseFloat(heightCm) / 100, 2)).toFixed(1)}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: COLORS.secondary }, savingProfile && { opacity: 0.6 }]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>저장</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 40 },
  headerCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarEmoji: { fontSize: 40 },
  username: { fontSize: 22, fontWeight: '800', color: '#fff' },
  usernameSubt: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  menuCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  menuIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuIcon: { fontSize: 22 },
  menuTextWrap: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  menuSub: { fontSize: 12, color: '#78909C', marginTop: 2 },
  menuArrow: { fontSize: 22, color: '#B0BEC5', fontWeight: '300' },
  bmiCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  bmiTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  bmiDesc: { fontSize: 12, color: '#78909C', marginBottom: 14 },
  bmiTable: { gap: 8 },
  bmiRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bmiDot: { width: 10, height: 10, borderRadius: 5 },
  bmiRange: { flex: 1, fontSize: 13, color: COLORS.text },
  bmiLabel: { fontSize: 13, fontWeight: '700' },
  profileBtn: {
    backgroundColor: '#F0F4F8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  profileBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  logoutBtn: {
    backgroundColor: '#FFE5E5',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutBtnText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  modalClose: { fontSize: 20, color: '#B0BEC5' },
  label: { fontSize: 13, fontWeight: '600', color: '#78909C', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E7EF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: '#FAFBFD',
    marginBottom: 12,
  },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  presetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E7EF',
    backgroundColor: '#FAFBFD',
  },
  presetBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  presetBtnText: { fontSize: 13, color: '#78909C', fontWeight: '600' },
  inputRow: { flexDirection: 'row' },
  bmiPreview: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  bmiPreviewText: { fontSize: 16, fontWeight: '800', color: COLORS.success },
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
