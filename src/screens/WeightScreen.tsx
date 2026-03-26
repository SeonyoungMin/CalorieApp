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

interface WeightRecord {
  weightId: number;
  weightKg: number;
  logDate: string;
}

function MiniChart({ data }: { data: WeightRecord[] }) {
  if (data.length < 2) return null;
  const recent = data.slice(-7);
  const maxW = Math.max(...recent.map((d) => d.weightKg));
  const minW = Math.min(...recent.map((d) => d.weightKg));
  const range = maxW - minW || 1;
  const chartH = 80;

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#78909C', marginBottom: 8 }}>최근 7일 변화</Text>
      <View style={{ height: chartH, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        {recent.map((d, i) => {
          const barH = ((d.weightKg - minW) / range) * (chartH - 20) + 20;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: '#78909C', marginBottom: 2 }}>{d.weightKg}</Text>
              <View
                style={{
                  width: '70%',
                  height: barH,
                  backgroundColor: i === recent.length - 1 ? COLORS.primary : COLORS.secondary,
                  borderRadius: 4,
                  opacity: i === recent.length - 1 ? 1 : 0.5,
                }}
              />
              <Text style={{ fontSize: 8, color: '#B0BEC5', marginTop: 2 }}>
                {new Date(d.logDate).getDate()}일
              </Text>
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

  const fetchData = useCallback(async () => {
    try {
      const res = await getWeightList();
      const sorted = (res.data || []).sort(
        (a: WeightRecord, b: WeightRecord) =>
          new Date(b.logDate).getTime() - new Date(a.logDate).getTime()
      );
      setRecords(sorted);
    } catch {
      //
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
      await saveWeight(kg);
      await fetchData();
      setModalVisible(false);
      setWeightInput('');
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
    const today = new Date().toISOString().split('T')[0];
    const alreadyToday = records.some((r) => r.logDate === today);
    if (alreadyToday) {
      Alert.alert('오늘 기록 있음', '오늘 이미 체중을 기록했습니다. 추가로 저장할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '저장', onPress: () => doSave(kg) },
      ]);
      return;
    }
    setSaving(true);
    try {
      await saveWeight(kg);
      await fetchData();
      setModalVisible(false);
      setWeightInput('');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.response?.data?.message || '다시 시도해주세요.');
    } finally {
      setSaving(false);
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

  const latest = records[0];
  const prev = records[1];
  const diff = latest && prev ? (latest.weightKg - prev.weightKg).toFixed(1) : null;
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
            <Text style={styles.listTitle}>기록 목록</Text>
            {records.map((r, idx) => (
              <View key={r.weightId} style={[styles.recordRow, idx < records.length - 1 && styles.recordBorder]}>
                <View>
                  <Text style={styles.recordDate}>{r.logDate}</Text>
                  {idx < records.length - 1 && (
                    <Text style={styles.recordDiff}>
                      {(r.weightKg - records[idx + 1].weightKg) > 0
                        ? `▲ ${(r.weightKg - records[idx + 1].weightKg).toFixed(1)}`
                        : `▼ ${Math.abs(r.weightKg - records[idx + 1].weightKg).toFixed(1)}`} kg
                    </Text>
                  )}
                </View>
                <View style={styles.recordRight}>
                  <Text style={styles.recordWeight}>{r.weightKg} kg</Text>
                  <TouchableOpacity onPress={() => handleDelete(r.weightId)} style={styles.delBtn}>
                    <Text style={styles.delBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>체중 기록</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setWeightInput(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>체중 (kg)</Text>
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
  listTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  recordBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  recordDate: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  recordDiff: { fontSize: 11, color: '#78909C', marginTop: 2 },
  recordRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordWeight: { fontSize: 18, fontWeight: '800', color: COLORS.purple },
  delBtn: { padding: 4 },
  delBtnText: { color: '#B0BEC5', fontSize: 16 },
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
