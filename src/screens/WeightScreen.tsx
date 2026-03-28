import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getWeightList, saveWeight, deleteWeight } from '../api/api';
import { COLORS } from '../theme';
import { todayStr, dateLabel } from '../utils/dateUtils';
import CalendarPicker from '../components/CalendarPicker';

interface WeightRecord {
  weightId: number;
  weightKg: number;
  logDate: string;
}

function MiniChart({ data }: { data: WeightRecord[] }) {
  if (data.length < 2) return null;
  const recent = data.slice(-7);
  const maxW = Math.max(...recent.map((d) => Number(d.weightKg) || 0));
  const minW = Math.min(...recent.map((d) => Number(d.weightKg) || 0));
  const range = maxW - minW || 1;
  const chartH = 80;

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#78909C', marginBottom: 8 }}>최근 7일 변화</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        {recent.map((d, i) => {
          const kg = Number(d.weightKg) || 0;
          const barH = ((kg - minW) / range) * (chartH - 32) + 16;
          const dateObj = d.logDate ? new Date(d.logDate + 'T12:00:00') : null;
          const dayLabel = dateObj && !isNaN(dateObj.getTime()) ? `${dateObj.getDate()}일` : '-';
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: '#78909C', marginBottom: 2 }}>{kg}</Text>
              <View
                style={{
                  width: '70%',
                  height: barH,
                  backgroundColor: i === recent.length - 1 ? COLORS.primary : COLORS.secondary,
                  borderRadius: 4,
                  opacity: i === recent.length - 1 ? 1 : 0.5,
                }}
              />
              <Text style={{ fontSize: 8, color: '#B0BEC5', marginTop: 2 }}>{dayLabel}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function WeightScreen() {
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [logDate, setLogDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await getWeightList();
      const sorted = (res.data || []).sort(
        (a: WeightRecord, b: WeightRecord) =>
          new Date(b.logDate + 'T12:00:00').getTime() - new Date(a.logDate + 'T12:00:00').getTime()
      );
      setRecords(sorted);
    } catch {
      Alert.alert('오류', '체중 기록을 불러오지 못했습니다.');
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

  const doSave = async (kg: number) => {
    setSaving(true);
    try {
      await saveWeight(kg, logDate);
      await fetchData();
      setModalVisible(false);
      setWeightInput('');
      setLogDate(todayStr());
    } catch (e: any) {
      Alert.alert('저장 실패', e?.response?.data?.message || '다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const kg = parseFloat(weightInput);
    if (isNaN(kg) || kg <= 0 || kg > 300) {
      Alert.alert('입력 오류', '유효한 체중을 입력해주세요. (1~300 kg)');
      return;
    }
    const alreadyOnDate = records.some((r) => r.logDate === logDate);
    if (alreadyOnDate) {
      Alert.alert('기록 있음', `${logDate}에 이미 체중을 기록했습니다. 추가로 저장할까요?`, [
        { text: '취소', style: 'cancel' },
        { text: '저장', onPress: () => doSave(kg) },
      ]);
      return;
    }
    await doSave(kg);
  };

  const openDatePicker = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'date';
      input.max = todayStr();
      input.value = logDate;
      input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
      document.body.appendChild(input);
      input.onchange = (e: any) => {
        if ((e.target as HTMLInputElement).value) setLogDate((e.target as HTMLInputElement).value);
        document.body.removeChild(input);
      };
      input.click();
    } else {
      setShowDatePicker(true);
    }
  };

  const handleDelete = async (weightId: number) => {
    const ok = Platform.OS === 'web'
      ? window.confirm('이 기록을 삭제하시겠습니까?')
      : await new Promise<boolean>((resolve) =>
          Alert.alert('삭제', '이 기록을 삭제하시겠습니까?', [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!ok) return;
    try {
      await deleteWeight(weightId);
      await fetchData();
    } catch {
      Alert.alert('오류', '삭제에 실패했습니다.');
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = () => {
    if (!selectedIds.length) return;
    Alert.alert('삭제', `${selectedIds.length}개를 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          await Promise.all(selectedIds.map(id => deleteWeight(id)));
          setSelectedIds([]);
          setEditMode(false);
          await fetchData();
        } catch {
          Alert.alert('오류', '삭제에 실패했습니다.');
        }
      }},
    ]);
  };

  const handleDeleteAllWeight = () => {
    if (!records.length) return;
    Alert.alert('전체 삭제', '모든 체중 기록을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '전체 삭제', style: 'destructive', onPress: async () => {
        try {
          await Promise.all(records.map(r => deleteWeight(r.weightId)));
          setSelectedIds([]);
          setEditMode(false);
          await fetchData();
        } catch {
          Alert.alert('오류', '삭제에 실패했습니다.');
        }
      }},
    ]);
  };

  const latest = records[0];
  const prev = records[1];
  const diff = latest && prev ? (Number(latest.weightKg) - Number(prev.weightKg)).toFixed(1) : null;
  const diffNum = diff ? parseFloat(diff) : null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>⚖️ 몸무게 기록</Text>
            <Text style={styles.headerSub}>체중 변화를 추적하세요</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ 기록</Text>
          </TouchableOpacity>
        </View>

        {/* Current Weight Card */}
        {latest && (
          <View style={styles.currentCard}>
            <View style={styles.currentLeft}>
              <Text style={styles.currentLabel}>현재 체중</Text>
              <View style={styles.currentWeightRow}>
                <Text style={styles.currentWeight}>{latest.weightKg}</Text>
                <Text style={styles.currentUnit}> kg</Text>
              </View>
              <Text style={styles.currentDate}>{latest.logDate}</Text>
              {diff !== null && diffNum !== null && (
                <View style={[styles.diffBadge, { backgroundColor: diffNum <= 0 ? '#E8F5E9' : '#FFF3E0' }]}>
                  <Text style={[styles.diffText, { color: diffNum <= 0 ? COLORS.success : COLORS.warning }]}>
                    {diffNum > 0 ? '▲' : '▼'} {Math.abs(diffNum)} kg (전일 대비)
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.currentEmoji}>⚖️</Text>
          </View>
        )}

        {/* Mini Chart */}
        {records.length >= 2 && (
          <View style={styles.chartCard}>
            <MiniChart data={[...records].reverse()} />
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : records.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>⚖️</Text>
            <Text style={styles.emptyText}>체중 기록이 없어요</Text>
            <Text style={styles.emptySubText}>오늘의 체중을 기록해보세요!</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.listTitle}>기록 목록</Text>
              {records.length > 0 && (
                <TouchableOpacity style={styles.editBtn} onPress={() => { setEditMode(!editMode); setSelectedIds([]); }}>
                  <Text style={styles.editBtnText}>{editMode ? '완료' : '편집'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {records.map((r, idx) => (
              <TouchableOpacity
                key={r.weightId}
                style={[styles.recordRow, idx < records.length - 1 && styles.recordBorder, editMode && selectedIds.includes(r.weightId) && { backgroundColor: COLORS.primary + '10' }]}
                onPress={editMode ? () => toggleSelect(r.weightId) : undefined}
                activeOpacity={editMode ? 0.7 : 1}
              >
                {editMode && (
                  <View style={[styles.checkbox, selectedIds.includes(r.weightId) && styles.checkboxSelected]}>
                    {selectedIds.includes(r.weightId) && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                )}
                <View>
                  <Text style={styles.recordDate}>{r.logDate}</Text>
                  {idx < records.length - 1 && (
                    <Text style={styles.recordDiff}>
                      {(() => {
                        const d = Number(r.weightKg) - Number(records[idx + 1].weightKg);
                        return d > 0 ? `▲ ${d.toFixed(1)}` : `▼ ${Math.abs(d).toFixed(1)}`;
                      })()} kg
                    </Text>
                  )}
                </View>
                <View style={styles.recordRight}>
                  <Text style={styles.recordWeight}>{r.weightKg} kg</Text>
                  {!editMode && (
                    <TouchableOpacity onPress={() => handleDelete(r.weightId)} style={styles.delBtn}>
                      <Text style={styles.delBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {editMode && (
        <View style={styles.editActionBar}>
          <TouchableOpacity style={styles.editCancelBtn} onPress={() => { setEditMode(false); setSelectedIds([]); }}>
            <Text style={styles.editCancelText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.editDeleteBtn, !selectedIds.length && { opacity: 0.4 }]}
            onPress={handleDeleteSelected}
            disabled={!selectedIds.length}
          >
            <Text style={styles.editDeleteText}>선택 삭제{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editDeleteAllBtn} onPress={handleDeleteAllWeight}>
            <Text style={styles.editDeleteAllText}>모두 삭제</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>체중 기록</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setWeightInput(''); setLogDate(todayStr()); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>날짜</Text>
            <TouchableOpacity style={styles.datePickerBtn} onPress={openDatePicker}>
              <Text style={styles.datePickerText}>📅 {dateLabel(logDate)}</Text>
            </TouchableOpacity>
            <Text style={[styles.label, { marginTop: 12 }]}>체중 (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="예) 65.5"
              placeholderTextColor="#B0BEC5"
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
              autoFocus
            />
            {latest && (
              <Text style={styles.lastWeight}>마지막 기록: {latest.weightKg} kg ({latest.logDate})</Text>
            )}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>저장</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CalendarPicker
        visible={showDatePicker}
        value={logDate}
        maxDate={todayStr()}
        onSelect={(date) => { setLogDate(date); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 13, color: '#78909C', marginTop: 2 },
  addBtn: {
    backgroundColor: COLORS.purple,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  currentCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  currentLeft: {},
  currentLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  currentDate: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 },
  currentWeightRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  currentWeight: { fontSize: 48, fontWeight: '900', color: '#fff' },
  currentUnit: { fontSize: 20, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  currentEmoji: { fontSize: 52 },
  diffBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  diffText: { fontSize: 12, fontWeight: '700' },
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 16, color: COLORS.text, fontWeight: '600', marginTop: 12 },
  emptySubText: { fontSize: 13, color: '#78909C', marginTop: 4 },
  listCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  listTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 0 },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  recordBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  recordDate: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  recordDiff: { fontSize: 11, color: '#78909C', marginTop: 2 },
  recordRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordWeight: { fontSize: 18, fontWeight: '800', color: COLORS.purple },
  delBtn: { padding: 4 },
  delBtnText: { color: '#B0BEC5', fontSize: 16 },
  editBtn: { backgroundColor: '#F0F4F8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D0D8E4', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  checkboxSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { fontSize: 12, color: '#fff', fontWeight: '700' },
  editActionBar: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: '#E0E7EF' },
  editCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E0E7EF', alignItems: 'center' },
  editCancelText: { fontSize: 13, fontWeight: '600', color: '#78909C' },
  editDeleteBtn: { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FFB74D', alignItems: 'center' },
  editDeleteText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  editDeleteAllBtn: { flex: 1.5, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FF6B6B', alignItems: 'center' },
  editDeleteAllText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  modalClose: { fontSize: 20, color: '#B0BEC5' },
  label: { fontSize: 13, fontWeight: '600', color: '#78909C', marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E7EF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    color: COLORS.text,
    backgroundColor: '#FAFBFD',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '700',
  },
  lastWeight: { fontSize: 12, color: '#78909C', textAlign: 'center', marginBottom: 16 },
  datePickerBtn: {
    borderWidth: 1.5,
    borderColor: '#E0E7EF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFBFD',
    alignItems: 'center',
  },
  datePickerText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  saveBtn: {
    backgroundColor: COLORS.purple,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: COLORS.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
