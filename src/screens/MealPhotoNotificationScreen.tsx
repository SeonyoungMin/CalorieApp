import React, { useState, useCallback, useRef } from 'react';
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
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../theme';
import Icon from '../components/Icon';
import {
  MealPhotoAlarm,
  loadMealPhotoAlarms,
  saveMealPhotoAlarms,
  scheduleMealPhotoAlarms,
  testMealPhotoAlarm,
  createMealPhotoChannel,
  requestNotificationPermission,
  loadCheckedAlarms,
  toggleCheckedAlarm,
} from '../services/mealPhotoNotificationService';

const MAX_ALARMS = 10;
const pad = (n: number) => String(n).padStart(2, '0');

export default function MealPhotoNotificationScreen() {
  const [alarms, setAlarms] = useState<MealPhotoAlarm[]>([]);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [editTarget, setEditTarget] = useState<MealPhotoAlarm | null>(null);
  const [editName, setEditName] = useState('');
  const [editHour, setEditHour] = useState('');
  const [editMinute, setEditMinute] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useFocusEffect(
    useCallback(() => {
      init();
    }, []),
  );

  async function init() {
    await createMealPhotoChannel();
    const saved = await loadMealPhotoAlarms();
    setAlarms(saved);
    const checked = await loadCheckedAlarms();
    setCheckedIds(checked);
  }

  async function saveAndSchedule(updated: MealPhotoAlarm[]) {
    setAlarms(updated);
    await saveMealPhotoAlarms(updated);
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert('알림 권한 필요', '설정에서 알림 권한을 허용해주세요.');
      return;
    }
    await scheduleMealPhotoAlarms(updated);
  }

  function openAddModal() {
    if (alarms.length >= MAX_ALARMS) {
      Alert.alert('최대 알림 수', `알림은 최대 ${MAX_ALARMS}개까지 추가할 수 있어요.`);
      return;
    }
    setIsNew(true);
    setEditName('');
    setEditHour('12');
    setEditMinute('00');
    setEditTarget({
      id: `alarm_${Date.now()}`,
      name: '',
      hour: 12,
      minute: 0,
      enabled: true,
    });
    setModalVisible(true);
  }

  function openEditModal(alarm: MealPhotoAlarm) {
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
    const name = editName.trim() || `알림 ${alarms.length + 1}`;
    const updated: MealPhotoAlarm = { ...editTarget, name, hour: h, minute: m };

    let newAlarms: MealPhotoAlarm[];
    if (isNew) {
      newAlarms = [...alarms, updated];
    } else {
      newAlarms = alarms.map(a => (a.id === updated.id ? updated : a));
    }
    setModalVisible(false);
    await saveAndSchedule(newAlarms);
  }

  async function handleDelete(alarm: MealPhotoAlarm) {
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

  async function handleToggleEnabled(alarm: MealPhotoAlarm) {
    const newAlarms = alarms.map(a =>
      a.id === alarm.id ? { ...a, enabled: !a.enabled } : a,
    );
    await saveAndSchedule(newAlarms);
  }

  async function handleCheck(alarm: MealPhotoAlarm) {
    const updated = await toggleCheckedAlarm(alarm.id);
    setCheckedIds(updated);
  }

  async function handleTest(alarm: MealPhotoAlarm) {
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert('알림 권한 필요', '설정에서 알림 권한을 허용해주세요.');
      return;
    }
    await createMealPhotoChannel();
    await testMealPhotoAlarm(alarm);
    Alert.alert('테스트 전송', `"${alarm.name}" 알림을 방금 전송했어요!`);
  }

  const checkedCount = alarms.filter(a => checkedIds.includes(a.id)).length;
  const totalEnabled = alarms.filter(a => a.enabled).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>식사 사진 알림</Text>
        <Text style={styles.subtitle}>
          오늘 {checkedCount}/{totalEnabled}개 완료
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
                {checked && <Icon name="check" size={12} color={"#fff"} />}
              </TouchableOpacity>

              {/* Info */}
              <TouchableOpacity
                style={styles.cardInfo}
                onPress={() => openEditModal(alarm)}
                activeOpacity={0.7}
              >
                <Text style={[styles.alarmName, checked && styles.alarmNameChecked]}>
                  {alarm.name}
                </Text>
                <Text style={styles.alarmTime}>
                  {pad(alarm.hour)}:{pad(alarm.minute)}
                </Text>
              </TouchableOpacity>

              {/* Test button */}
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
                trackColor={{ false: '#E0E0E0', true: COLORS.primary + '66' }}
                thumbColor={alarm.enabled ? COLORS.primary : '#BDBDBD'}
              />

              {/* Delete */}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(alarm)}
                activeOpacity={0.7}
              >
                <Icon name="trash" size={14} color={"#fff"} />
              </TouchableOpacity>
            </View>
          );
        })}

        {alarms.length < MAX_ALARMS && (
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>＋ 알림 추가</Text>
            <Text style={styles.addBtnSub}>{alarms.length}/{MAX_ALARMS}개</Text>
          </TouchableOpacity>
        )}

        {alarms.length === 0 && (
          <View style={styles.emptyBox}>
            
            <Text style={styles.emptyText}>아직 알림이 없어요</Text>
            <Text style={styles.emptySubText}>위 버튼으로 알림을 추가해보세요!</Text>
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
          <Text style={styles.modalTitle}>{isNew ? '알림 추가' : '알림 수정'}</Text>

          <Text style={styles.inputLabel}>이름</Text>
          <TextInput
            style={styles.input}
            value={editName}
            onChangeText={setEditName}
            placeholder="예: 점심, 오후 단백질, 벌크업 4끼"
            placeholderTextColor="#D4C5DC"
            maxLength={20}
          />

          <Text style={styles.inputLabel}>시간</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeInputWrap}>
              <TextInput
                style={styles.timeInput}
                value={editHour}
                onChangeText={setEditHour}
                placeholder="시"
                placeholderTextColor="#D4C5DC"
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
                placeholderTextColor="#D4C5DC"
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.timeUnit}>분</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>저장</Text>
          </TouchableOpacity>

          {!isNew && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 16, color: '#8A7C9C', marginTop: 4 },

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
    borderRadius: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  progressLabel: { fontSize: 14, color: COLORS.primary, fontWeight: '700', minWidth: 36 },

  list: { flex: 1, paddingHorizontal: 22 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 26,
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

  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#D4C5DC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkMark: { color: '#fff', fontSize: 16, fontWeight: '800' },

  cardInfo: { flex: 1 },
  alarmName: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  alarmNameChecked: { textDecorationLine: 'line-through', color: '#D4C5DC' },
  alarmTime: { fontSize: 22, fontWeight: '800', color: COLORS.primary, marginTop: 2 },

  testBtn: {
    backgroundColor: COLORS.primary + '18',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  testBtnText: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },

  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 22,
    backgroundColor: '#FFE0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 14, color: '#FF5252', fontWeight: '700' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary + '12',
    borderRadius: 26,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    borderStyle: 'dashed',
  },
  addBtnText: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
  addBtnSub: { fontSize: 15, color: '#8A7C9C' },

  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontSize: 19, fontWeight: '700', color: COLORS.text },
  emptySubText: { fontSize: 15, color: '#8A7C9C', marginTop: 6 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 88,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 20 },
  inputLabel: { fontSize: 15, fontWeight: '600', color: '#8A7C9C', marginBottom: 6 },
  input: {
    backgroundColor: '#FBF4F9',
    borderRadius: 20,
    padding: 14,
    fontSize: 17,
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
    backgroundColor: '#FBF4F9',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
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
  timeUnit: { fontSize: 16, color: '#8A7C9C' },
  timeSep: { fontSize: 24, fontWeight: '800', color: '#D4C5DC' },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  cancelBtn: {
    backgroundColor: '#FBF4F9',
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#8A7C9C', fontSize: 17, fontWeight: '700' },
});
