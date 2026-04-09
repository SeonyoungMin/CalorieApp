import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../theme';
import { useSubscription } from '../hooks/useSubscription';
import PremiumModal from '../components/PremiumModal';
import {
  MedicationAlarm,
  loadMedicationAlarms,
  saveMedicationAlarms,
  scheduleMedicationAlarms,
  testMedicationAlarm,
  createMedicationChannel,
  loadMedicationChecked,
  toggleMedicationChecked,
} from '../services/medicationNotificationService';
import { requestNotificationPermission } from '../services/mealPhotoNotificationService';

const pad = (n: number) => String(n).padStart(2, '0');

export default function MedicationScreen() {
  const { isPremium, purchasePremium, cancelPremium } = useSubscription();
  const [premiumVisible, setPremiumVisible] = useState(false);

  const [alarms, setAlarms] = useState<MedicationAlarm[]>([]);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [editTarget, setEditTarget] = useState<MedicationAlarm | null>(null);
  const [editName, setEditName] = useState('');
  const [editHour, setEditHour] = useState('');
  const [editMinute, setEditMinute] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isPremium) return;
      init();
    }, [isPremium]),
  );

  async function init() {
    await createMedicationChannel();
    const saved = await loadMedicationAlarms();
    setAlarms(saved);
    const checked = await loadMedicationChecked();
    setCheckedIds(checked);
  }

  async function saveAndSchedule(updated: MedicationAlarm[]) {
    setAlarms(updated);
    await saveMedicationAlarms(updated);
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert('알림 권한 필요', '설정에서 알림 권한을 허용해주세요.');
      return;
    }
    await scheduleMedicationAlarms(updated);
  }

  function openAddModal() {
    setIsNew(true);
    setEditName('');
    setEditHour('8');
    setEditMinute('00');
    setEditTarget({
      id: `med_${Date.now()}`,
      name: '',
      hour: 8,
      minute: 0,
      enabled: true,
    });
    setModalVisible(true);
  }

  function openEditModal(alarm: MedicationAlarm) {
    setIsNew(false);
    setEditTarget(alarm);
    setEditName(alarm.name);
    setEditHour(String(alarm.hour));
    setEditMinute(pad(alarm.minute));
    setModalVisible(true);
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    const h = parseInt(editHour, 10);
    const m = parseInt(editMinute, 10);
    if (isNaN(h) || h < 0 || h > 23) {
      Alert.alert('시간 오류', '시(0~23)를 올바르게 입력해주세요.');
      return;
    }
    if (isNaN(m) || m < 0 || m > 59) {
      Alert.alert('분 오류', '분(0~59)을 올바르게 입력해주세요.');
      return;
    }
    const name = editName.trim();
    if (!name) {
      Alert.alert('이름 필요', '약 이름을 입력해주세요.');
      return;
    }
    const updated: MedicationAlarm = { ...editTarget, name, hour: h, minute: m };

    const newAlarms = isNew
      ? [...alarms, updated]
      : alarms.map(a => (a.id === updated.id ? updated : a));

    setModalVisible(false);
    await saveAndSchedule(newAlarms);
  }

  async function handleDelete(alarm: MedicationAlarm) {
    Alert.alert('알림 삭제', `"${alarm.name}" 알림을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const newAlarms = alarms.filter(a => a.id !== alarm.id);
          await saveAndSchedule(newAlarms);
        },
      },
    ]);
  }

  async function handleToggleEnabled(alarm: MedicationAlarm) {
    const newAlarms = alarms.map(a =>
      a.id === alarm.id ? { ...a, enabled: !a.enabled } : a,
    );
    await saveAndSchedule(newAlarms);
  }

  async function handleCheck(alarm: MedicationAlarm) {
    const updated = await toggleMedicationChecked(alarm.id);
    setCheckedIds(updated);
  }

  async function handleTest(alarm: MedicationAlarm) {
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert('알림 권한 필요', '설정에서 알림 권한을 허용해주세요.');
      return;
    }
    await createMedicationChannel();
    await testMedicationAlarm(alarm);
    Alert.alert('테스트 전송', `"${alarm.name}" 알림을 방금 전송했어요!`);
  }

  // ── 프리미엄 잠금 화면 ────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>약 복용 알림</Text>
          <Text style={styles.subtitle}>매일 빠짐없이 챙겨요 💊</Text>
        </View>

        {/* 미리보기 (잠금) */}
        <View style={styles.previewWrap}>
          {[
            { name: '혈압약', time: '08:00' },
            { name: '유산균', time: '12:30' },
            { name: '비타민D', time: '21:00' },
          ].map((item, i) => (
            <View key={i} style={[styles.card, styles.cardBlurred]}>
              <View style={[styles.checkCircle, { borderColor: '#E0E0E0' }]} />
              <View style={styles.cardInfo}>
                <Text style={[styles.alarmName, { color: '#B0BEC5' }]}>{item.name}</Text>
                <Text style={[styles.alarmTime, { color: '#B0BEC5' }]}>{item.time}</Text>
              </View>
              <View style={styles.lockOverlay}>
                <Text style={styles.lockIcon}>🔒</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 프리미엄 유도 배너 */}
        <TouchableOpacity
          style={styles.premiumBanner}
          onPress={() => setPremiumVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.premiumBannerEmoji}>👑</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumBannerTitle}>프리미엄 전용 기능</Text>
            <Text style={styles.premiumBannerDesc}>
              약 복용 알림은 프리미엄 구독 시 사용할 수 있어요
            </Text>
          </View>
          <Text style={styles.premiumBannerArrow}>›</Text>
        </TouchableOpacity>

        <PremiumModal
          visible={premiumVisible}
          onClose={() => setPremiumVisible(false)}
          isPremium={isPremium}
          onSubscribe={async () => { await purchasePremium(); setPremiumVisible(false); }}
          onCancel={async () => { await cancelPremium(); setPremiumVisible(false); }}
        />
      </View>
    );
  }

  // ── 메인 화면 ─────────────────────────────────────────────────────────────
  const totalEnabled = alarms.filter(a => a.enabled).length;
  const checkedCount = alarms.filter(a => checkedIds.includes(a.id)).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>약 복용 알림</Text>
        <Text style={styles.subtitle}>
          오늘 {checkedCount}/{totalEnabled}개 복용 완료
        </Text>
      </View>

      {/* Progress bar */}
      {totalEnabled > 0 && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round((checkedCount / totalEnabled) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {Math.round((checkedCount / totalEnabled) * 100)}%
          </Text>
        </View>
      )}

      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 120 }}>
        {alarms.map(alarm => {
          const checked = checkedIds.includes(alarm.id);
          return (
            <View key={alarm.id} style={[styles.card, !alarm.enabled && styles.cardDisabled]}>
              {/* Check circle */}
              <TouchableOpacity
                style={[styles.checkCircle, checked && styles.checkCircleOn]}
                onPress={() => handleCheck(alarm)}
                activeOpacity={0.7}
              >
                {checked && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>

              {/* Info */}
              <TouchableOpacity
                style={styles.cardInfo}
                onPress={() => openEditModal(alarm)}
                activeOpacity={0.7}
              >
                <Text style={[styles.alarmName, checked && styles.alarmNameChecked]}>
                  💊 {alarm.name}
                </Text>
                <Text style={styles.alarmTime}>
                  {pad(alarm.hour)}:{pad(alarm.minute)}
                </Text>
              </TouchableOpacity>

              {/* Test */}
              <TouchableOpacity
                style={styles.testBtn}
                onPress={() => handleTest(alarm)}
                activeOpacity={0.7}
              >
                <Text style={styles.testBtnText}>테스트</Text>
              </TouchableOpacity>

              {/* Toggle */}
              <Switch
                value={alarm.enabled}
                onValueChange={() => handleToggleEnabled(alarm)}
                trackColor={{ false: '#E0E0E0', true: COLORS.purple + '66' }}
                thumbColor={alarm.enabled ? COLORS.purple : '#BDBDBD'}
              />

              {/* Delete */}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(alarm)}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* 추가 버튼 (제한 없음) */}
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>＋ 약 추가</Text>
          <Text style={styles.addBtnSub}>{alarms.length}개 등록됨</Text>
        </TouchableOpacity>

        {alarms.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>💊</Text>
            <Text style={styles.emptyText}>등록된 약이 없어요</Text>
            <Text style={styles.emptySubText}>위 버튼으로 약을 추가해보세요!</Text>
          </View>
        )}
      </ScrollView>

      {/* Edit / Add Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{isNew ? '약 추가' : '약 수정'}</Text>

          <Text style={styles.inputLabel}>약 이름</Text>
          <TextInput
            style={styles.input}
            value={editName}
            onChangeText={setEditName}
            placeholder="예: 혈압약, 유산균, 비타민D"
            placeholderTextColor="#B0BEC5"
            maxLength={30}
            autoFocus={isNew}
          />

          <Text style={styles.inputLabel}>복용 시간</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeInputWrap}>
              <TextInput
                style={styles.timeInput}
                value={editHour}
                onChangeText={setEditHour}
                placeholder="시"
                placeholderTextColor="#B0BEC5"
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.timeUnit}>시</Text>
            </View>
            <Text style={styles.timeSep}>:</Text>
            <View style={styles.timeInputWrap}>
              <TextInput
                style={styles.timeInput}
                value={editMinute}
                onChangeText={setEditMinute}
                placeholder="분"
                placeholderTextColor="#B0BEC5"
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.timeUnit}>분</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>저장</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setModalVisible(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelBtnText}>취소</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: '#78909C', marginTop: 4 },

  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 10,
  },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.purple,
    borderRadius: 4,
  },
  progressLabel: { fontSize: 12, color: COLORS.purple, fontWeight: '700', minWidth: 36 },

  list: { flex: 1, paddingHorizontal: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 10,
  },
  cardDisabled: { opacity: 0.5 },
  cardBlurred: { opacity: 0.6 },

  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#B0BEC5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleOn: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '800' },

  cardInfo: { flex: 1 },
  alarmName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  alarmNameChecked: { textDecorationLine: 'line-through', color: '#B0BEC5' },
  alarmTime: { fontSize: 22, fontWeight: '800', color: COLORS.purple, marginTop: 2 },

  testBtn: {
    backgroundColor: COLORS.purple + '18',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  testBtnText: { fontSize: 12, color: COLORS.purple, fontWeight: '700' },

  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFE0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 12, color: '#FF5252', fontWeight: '700' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.purple + '12',
    borderRadius: 18,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.purple + '40',
    borderStyle: 'dashed',
  },
  addBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.purple },
  addBtnSub: { fontSize: 13, color: '#78909C' },

  emptyBox: { alignItems: 'center', paddingTop: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptySubText: { fontSize: 13, color: '#78909C', marginTop: 6 },

  // 잠금 오버레이
  lockOverlay: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  lockIcon: { fontSize: 22 },

  // 프리미엄 배너
  previewWrap: { paddingHorizontal: 16, marginBottom: 12 },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#FCC419',
  },
  premiumBannerEmoji: { fontSize: 28 },
  premiumBannerTitle: { fontSize: 15, fontWeight: '800', color: '#2C3E50' },
  premiumBannerDesc: { fontSize: 12, color: '#78909C', marginTop: 2, flexShrink: 1 },
  premiumBannerArrow: { fontSize: 20, color: '#FCC419', fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#78909C', marginBottom: 6 },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  timeInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flex: 1,
    gap: 6,
  },
  timeInput: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  timeUnit: { fontSize: 14, color: '#78909C' },
  timeSep: { fontSize: 24, fontWeight: '800', color: '#B0BEC5' },
  saveBtn: {
    backgroundColor: COLORS.purple,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn: {
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#78909C', fontSize: 16, fontWeight: '700' },
});
