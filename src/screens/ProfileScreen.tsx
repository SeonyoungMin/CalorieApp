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
import { setGoalKcal, setUserProfile, changePassword, setMyPhone, getMyPhone } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme';
import Icon, { IconName } from '../components/Icon';

const getBmiInfo = (bmi: number) => {
  if (bmi < 18.5) return { label: '저체중', color: '#B5D8F5' };
  if (bmi < 23)   return { label: '정상', color: COLORS.success };
  if (bmi < 25)   return { label: '과체중', color: COLORS.warning };
  return           { label: '비만', color: COLORS.primary };
};

type MenuItem = { id: string; icon: IconName; label: string; sub: string; color: string };
const MENU_ITEMS: MenuItem[] = [
  { id: 'goal',     icon: 'fire',  label: '칼로리 목표 설정', sub: '일일 목표 칼로리를 설정하세요', color: COLORS.primary },
  { id: 'profile',  icon: 'user',  label: '신체 정보 설정',  sub: '체중, 키를 입력하세요',         color: COLORS.purpleDark },
  { id: 'water',    icon: 'water', label: '물 섭취 기록',    sub: '오늘의 수분 섭취를 확인하세요',  color: COLORS.water },
  { id: 'cycle',    icon: 'heart', label: '생리주기 관리',   sub: '주기를 추적하세요',             color: COLORS.pink },
  { id: 'phone',    icon: 'bell',  label: '전화번호 등록',   sub: '아이디/비번 찾기에 사용됩니다',  color: COLORS.secondary },
  { id: 'password', icon: 'lock',  label: '비밀번호 변경',   sub: '로그인 비밀번호를 변경하세요',   color: COLORS.purpleDark },
];

export default function ProfileScreen({ navigation }: any) {
  const { goalKcal: contextGoal, userWeightKg, userHeightCm, nickname, refreshProfile } = useAuth();
  const [goalModal, setGoalModal] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [pwdModal, setPwdModal] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const [phoneModal, setPhoneModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    if (!phoneModal) return;
    (async () => {
      try {
        const res = await getMyPhone();
        setPhone(res.data?.phone ?? '');
      } catch {}
    })();
  }, [phoneModal]);

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
    else if (id === 'password') setPwdModal(true);
    else if (id === 'phone') setPhoneModal(true);
  };

  const handleSavePhone = async () => {
    setSavingPhone(true);
    try {
      await setMyPhone(phone.trim());
      setPhoneModal(false);
      Alert.alert('저장 완료', phone.trim() ? '전화번호가 저장됐어요.' : '전화번호가 삭제됐어요.');
    } catch (e: any) {
      Alert.alert('오류', e?.response?.data?.message ?? '저장에 실패했어요.');
    } finally {
      setSavingPhone(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !newPwd2) {
      Alert.alert('알림', '모든 항목을 입력해주세요.');
      return;
    }
    if (newPwd.length < 8) {
      Alert.alert('알림', '새 비밀번호는 8자 이상이어야 해요.');
      return;
    }
    if (newPwd !== newPwd2) {
      Alert.alert('알림', '새 비밀번호가 일치하지 않아요.');
      return;
    }
    setSavingPwd(true);
    try {
      await changePassword(currentPwd, newPwd);
      setCurrentPwd(''); setNewPwd(''); setNewPwd2('');
      setPwdModal(false);
      Alert.alert('변경 완료', '비밀번호가 변경됐어요.');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? '비밀번호 변경에 실패했어요.';
      Alert.alert('오류', msg);
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.avatarWrap}>
            <Icon name="user" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.username}>{nickname || '내 프로필'}</Text>
          <Text style={styles.usernameSubt}>목표 {contextGoal || '-'} kcal · 건강 목표를 설정하고 관리하세요</Text>
          {userWeightKg && userHeightCm && userHeightCm > 0 && (() => {
            const bmiVal = userWeightKg / Math.pow(userHeightCm / 100, 2);
            const { label, color } = getBmiInfo(bmiVal);
            return (
              <View style={[styles.bmiBadge, { backgroundColor: color }]}>
                <Text style={styles.bmiBadgeText}>
                  BMI {bmiVal.toFixed(1)} · {label}
                </Text>
              </View>
            );
          })()}
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
                <Icon name={item.icon} size={18} color={item.color} />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSub} numberOfLines={1}>{item.sub}</Text>
              </View>
              <Icon name="chevronRight" size={12} color={COLORS.inactive} />
            </TouchableOpacity>
          ))}
        </View>

        {/* BMI Calculator shortcut */}
        <View style={styles.bmiCard}>
          <Text style={styles.bmiTitle}>BMI 계산기</Text>
          <Text style={styles.bmiDesc}>신체 정보를 입력하면 BMI를 자동 계산합니다</Text>
          <View style={styles.bmiTable}>
            {[
              { range: '18.5 미만', label: '저체중', color: '#B5D8F5' },
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

      </ScrollView>

      {/* Goal Modal */}
      <Modal visible={goalModal} animationType="slide" transparent onRequestClose={() => setGoalModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>칼로리 목표 설정</Text>
              <TouchableOpacity onPress={() => setGoalModal(false)}>
                <Icon name="close" size={18} color={COLORS.subText} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>일일 목표 칼로리 (kcal)</Text>
            <TextInput
              style={styles.input}
              placeholder="2000"
              placeholderTextColor="#D4C5DC"
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
      <Modal visible={profileModal} animationType="slide" transparent onRequestClose={() => setProfileModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>신체 정보 설정</Text>
              <TouchableOpacity onPress={() => setProfileModal(false)}>
                <Icon name="close" size={18} color={COLORS.subText} />
              </TouchableOpacity>
            </View>
            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>체중 (kg)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="65.0"
                  placeholderTextColor="#D4C5DC"
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
                  placeholderTextColor="#D4C5DC"
                  keyboardType="decimal-pad"
                  value={heightCm}
                  onChangeText={setHeightCmInput}
                />
              </View>
            </View>
            {weightKg && heightCm && parseFloat(weightKg) > 0 && parseFloat(heightCm) > 0 && (() => {
              const bmiVal = parseFloat(weightKg) / Math.pow(parseFloat(heightCm) / 100, 2);
              const { label, color } = getBmiInfo(bmiVal);
              return (
                <View style={[styles.bmiPreview, { backgroundColor: color + '20', borderColor: color, borderWidth: 1.5 }]}>
                  <Text style={[styles.bmiPreviewText, { color }]}>
                    BMI {bmiVal.toFixed(1)} · {label}
                  </Text>
                </View>
              );
            })()}
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

      {/* Phone Modal */}
      <Modal visible={phoneModal} animationType="slide" transparent onRequestClose={() => setPhoneModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>전화번호 등록</Text>
              <TouchableOpacity onPress={() => setPhoneModal(false)}>
                <Icon name="close" size={18} color={COLORS.subText} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>전화번호</Text>
            <TextInput
              style={styles.input}
              placeholder="01012345678"
              placeholderTextColor="#D4C5DC"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              returnKeyType="done"
              onSubmitEditing={handleSavePhone}
            />
            <Text style={{ fontSize: 14, color: '#8A7C9C', marginBottom: 12, marginTop: -4 }}>
              * 아이디/비밀번호 찾기에 사용됩니다. 비워두면 삭제돼요.
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, savingPhone && { opacity: 0.6 }]}
              onPress={handleSavePhone}
              disabled={savingPhone}
            >
              {savingPhone ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>저장</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Password Change Modal */}
      <Modal visible={pwdModal} animationType="slide" transparent onRequestClose={() => setPwdModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>비밀번호 변경</Text>
              <TouchableOpacity onPress={() => setPwdModal(false)}>
                <Icon name="close" size={18} color={COLORS.subText} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>현재 비밀번호</Text>
            <TextInput
              style={styles.input}
              placeholder="현재 비밀번호"
              placeholderTextColor="#D4C5DC"
              secureTextEntry
              value={currentPwd}
              onChangeText={setCurrentPwd}
              autoCapitalize="none"
            />
            <Text style={styles.label}>새 비밀번호 (8자 이상)</Text>
            <TextInput
              style={styles.input}
              placeholder="새 비밀번호"
              placeholderTextColor="#D4C5DC"
              secureTextEntry
              value={newPwd}
              onChangeText={setNewPwd}
              autoCapitalize="none"
            />
            <Text style={styles.label}>새 비밀번호 확인</Text>
            <TextInput
              style={styles.input}
              placeholder="새 비밀번호 다시 입력"
              placeholderTextColor="#D4C5DC"
              secureTextEntry
              value={newPwd2}
              onChangeText={setNewPwd2}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleChangePassword}
            />
            <TouchableOpacity
              style={[styles.saveBtn, savingPwd && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={savingPwd}
            >
              {savingPwd ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>변경</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 88 },
  headerCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 32,
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
  usernameSubt: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  bmiBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 5,
  },
  bmiBadgeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  menuCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: '#FFF5F8' },
  menuIconWrap: { width: 40, height: 40, borderRadius: 999, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuIcon: { fontSize: 19 },
  menuTextWrap: { flex: 1 },
  menuLabel: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  menuSub: { fontSize: 14, color: '#8A7C9C', marginTop: 2 },
  menuArrow: { fontSize: 22, color: '#D4C5DC', fontWeight: '300' },
  bmiCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  bmiTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  bmiDesc: { fontSize: 14, color: '#8A7C9C', marginBottom: 14 },
  bmiTable: { gap: 8 },
  bmiRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bmiDot: { width: 10, height: 10, borderRadius: 12 },
  bmiRange: { flex: 1, fontSize: 15, color: COLORS.text },
  bmiLabel: { fontSize: 15, fontWeight: '700' },
  profileBtn: {
    backgroundColor: '#FFF5F8',
    borderRadius: 20,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 14,
  },
  profileBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: COLORS.text },
  modalClose: { fontSize: 20, color: '#D4C5DC' },
  label: { fontSize: 15, fontWeight: '600', color: '#8A7C9C', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#F0E1EC',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 17,
    color: COLORS.text,
    backgroundColor: '#FBF4F9',
    marginBottom: 12,
  },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  presetBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#F0E1EC',
    backgroundColor: '#FBF4F9',
  },
  presetBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  presetBtnText: { fontSize: 15, color: '#8A7C9C', fontWeight: '600' },
  inputRow: { flexDirection: 'row' },
  bmiPreview: {
    backgroundColor: '#FFD6E5',
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  bmiPreviewText: { fontSize: 17, fontWeight: '800', color: COLORS.success },
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
});
