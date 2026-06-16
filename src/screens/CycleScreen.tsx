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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { getCycleInfo, saveCycle } from '../api/api';
import { COLORS } from '../theme';
import Icon from '../components/Icon';
import CalendarPicker from '../components/CalendarPicker';

const CYCLE_LOCAL_KEY = '@cycle_info';

async function loadLocalCycle(): Promise<CycleInfo | null> {
  try {
    if (Platform.OS === 'web') {
      const s = localStorage.getItem(CYCLE_LOCAL_KEY);
      return s ? JSON.parse(s) : null;
    }
    const s = await AsyncStorage.getItem(CYCLE_LOCAL_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

async function saveLocalCycle(info: CycleInfo): Promise<void> {
  try {
    const s = JSON.stringify(info);
    if (Platform.OS === 'web') {
      localStorage.setItem(CYCLE_LOCAL_KEY, s);
    } else {
      await AsyncStorage.setItem(CYCLE_LOCAL_KEY, s);
    }
  } catch {}
}

interface CycleInfo {
  lastPeriodDate: string;
  cycleLength: number;
  periodLength: number;
}

type CyclePhase = '생리 중' | '가임기' | '배란기' | '황체기' | '생리 예정';

function getPhaseBadge(phase: CyclePhase): { bg: string; color: string; emoji: string } {
  switch (phase) {
    case '생리 중':
      return { bg: '#FFD6E5', color: COLORS.primary, emoji: '' };
    case '가임기':
      return { bg: '#FFD6E5', color: COLORS.success, emoji: '' };
    case '배란기':
      return { bg: '#FFE8EF', color: COLORS.warning, emoji: '' };
    case '황체기':
      return { bg: '#EDE7F6', color: COLORS.purple, emoji: '' };
    case '생리 예정':
      return { bg: '#FCE4EC', color: COLORS.pink, emoji: '' };
    default:
      return { bg: '#F5F5F5', color: '#8A7C9C', emoji: '' };
  }
}

function parseCycleDate(raw: any): string {
  const s = String(raw || '');
  const m = s.match(/(\d{4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/);
  if (!m) return '';
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

function computeCycleStatus(info: CycleInfo): {
  phase: CyclePhase;
  dayOfCycle: number;
  nextPeriodDate: string;
  ovulationDate: string;
  daysUntilNext: number;
} {
  const cycleLen = Number(info.cycleLength) || 28;
  const periodLen = Number(info.periodLength) || 5;

  const today = new Date();
  const dateStr = parseCycleDate(info.lastPeriodDate);
  const last = new Date(dateStr + 'T12:00:00');
  if (!dateStr || isNaN(last.getTime())) {
    return {
      phase: '황체기',
      dayOfCycle: 1,
      nextPeriodDate: '-',
      ovulationDate: '-',
      daysUntilNext: cycleLen,
    };
  }
  const diff = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  const dayOfCycle = (diff % cycleLen) + 1;

  // 다음 생리일: 최소 1사이클 이후 (diff=0인 경우도 올바르게 처리)
  const cycleNum = Math.max(1, Math.ceil((diff + 1) / cycleLen));
  const nextPeriodMs = last.getTime() + cycleNum * cycleLen * 24 * 60 * 60 * 1000;
  const nextPeriod = new Date(nextPeriodMs);
  const daysUntilNext = Math.ceil((nextPeriod.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // 배란일: 다음 생리일 기준 14일 전
  const ovulationDay = cycleLen - 14;
  const currentCycleStart = last.getTime() + Math.floor(diff / cycleLen) * cycleLen * 24 * 60 * 60 * 1000;
  const ovulationDate = new Date(currentCycleStart + ovulationDay * 24 * 60 * 60 * 1000);

  // 단계 판정: '생리 중' 을 '생리 예정' 보다 먼저 체크
  let phase: CyclePhase;
  if (dayOfCycle <= periodLen) {
    phase = '생리 중';
  } else if (daysUntilNext <= 3) {
    phase = '생리 예정';
  } else if (dayOfCycle <= ovulationDay - 3) {
    phase = '가임기';
  } else if (dayOfCycle <= ovulationDay + 2) {
    phase = '배란기';
  } else {
    phase = '황체기';
  }

  return {
    phase,
    dayOfCycle,
    nextPeriodDate: nextPeriod.toLocaleDateString('ko-KR'),
    ovulationDate: ovulationDate.toLocaleDateString('ko-KR'),
    daysUntilNext,
  };
}

function CycleCalendar({ info }: { info: CycleInfo }) {
  const { lastPeriodDate } = info;
  const cycleLength = Number(info.cycleLength) || 28;
  const periodLength = Number(info.periodLength) || 5;
  const ovulationDay = cycleLength - 14;
  const today = new Date();
  const last = new Date(parseCycleDate(lastPeriodDate) + 'T12:00:00');
  const lastTime = last.getTime();
  const diff = isNaN(lastTime) ? 0 : Math.floor((today.getTime() - lastTime) / (1000 * 60 * 60 * 24));
  const currentDay = (diff % cycleLength) + 1;

  const days = Array.from({ length: cycleLength }, (_, i) => i + 1);

  const getDayColor = (day: number) => {
    if (day === currentDay) return { bg: COLORS.text, text: '#fff' };
    if (day <= periodLength) return { bg: '#FFD6E5', text: COLORS.primary };
    if (day >= ovulationDay - 2 && day <= ovulationDay + 2) return { bg: '#FFE8EF', text: COLORS.warning };
    if (day >= ovulationDay - 5 && day <= ovulationDay - 3) return { bg: '#FFD6E5', text: COLORS.success };
    return { bg: '#FFF5F8', text: '#8A7C9C' };
  };

  return (
    <View style={calStyles.container}>
      <Text style={calStyles.title}>주기 캘린더 (D+{currentDay})</Text>
      <View style={calStyles.grid}>
        {days.map((day) => {
          const { bg, text: textColor } = getDayColor(day);
          return (
            <View key={day} style={[calStyles.dayCell, { backgroundColor: bg }]}>
              <Text style={[calStyles.dayNum, { color: textColor }]}>{day}</Text>
            </View>
          );
        })}
      </View>
      <View style={calStyles.legend}>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.dot, { backgroundColor: '#FFB3B3' }]} />
          <Text style={calStyles.legendText}>생리</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.dot, { backgroundColor: '#A5D6A7' }]} />
          <Text style={calStyles.legendText}>가임기</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.dot, { backgroundColor: '#FFE082' }]} />
          <Text style={calStyles.legendText}>배란기</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.dot, { backgroundColor: COLORS.text }]} />
          <Text style={calStyles.legendText}>오늘</Text>
        </View>
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: { marginTop: 4 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dayCell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNum: { fontSize: 14, fontWeight: '600' },
  legend: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 12 },
  legendText: { fontSize: 13, color: '#8A7C9C' },
});

export default function CycleScreen({ navigation }: any) {
  const [cycleInfo, setCycleInfo] = useState<CycleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [lastPeriodDate, setLastPeriodDate] = useState('');
  const [cycleLength, setCycleLength] = useState('28');
  const [periodLength, setPeriodLength] = useState('5');
  const [showCalendar, setShowCalendar] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await getCycleInfo();
      if (res.data && res.data.lastPeriodDate) {
        setCycleInfo(res.data);
        setLastPeriodDate(res.data.lastPeriodDate);
        setCycleLength(String(res.data.cycleLength || 28));
        setPeriodLength(String(res.data.periodLength || 5));
        await saveLocalCycle(res.data);
        return;
      }
    } catch {}
    // 서버 실패 시 로컬 캐시 사용
    const local = await loadLocalCycle();
    if (local) {
      setCycleInfo(local);
      setLastPeriodDate(local.lastPeriodDate);
      setCycleLength(String(local.cycleLength || 28));
      setPeriodLength(String(local.periodLength || 5));
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

  const handleSave = async () => {
    if (!lastPeriodDate) {
      Alert.alert('입력 오류', '마지막 생리 시작일을 입력해주세요.');
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(lastPeriodDate)) {
      Alert.alert('형식 오류', 'YYYY-MM-DD 형식으로 입력해주세요. (예: 2024-01-15)');
      return;
    }
    const cl = parseInt(cycleLength, 10) || 28;
    const pl = parseInt(periodLength, 10) || 5;
    setSaving(true);
    try {
      const saved: CycleInfo = { lastPeriodDate, cycleLength: cl, periodLength: pl };
      // 로컬에 먼저 저장 (서버 실패해도 유지)
      await saveLocalCycle(saved);
      setCycleInfo(saved);
      setModalVisible(false);
      // 서버에도 저장 (실패해도 무시)
      saveCycle({ lastPeriodDate, cycleLength: cl, periodLength: pl }).catch(() => {});
    } catch (e: any) {
      Alert.alert('저장 실패', e?.response?.data?.message || '다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const status = cycleInfo ? computeCycleStatus(cycleInfo) : null;
  const badge = status ? getPhaseBadge(status.phase) : null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.pink} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.pink} />}
      >
        {/* 설정 버튼 */}
        <View style={[styles.header, { justifyContent: 'flex-end' }]}>
          <TouchableOpacity style={styles.editBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.editBtnText}>설정</Text>
          </TouchableOpacity>
        </View>

        {!cycleInfo ? (
          <View style={styles.emptyWrap}>
            
            <Text style={styles.emptyText}>생리주기 정보를 설정해주세요</Text>
            <TouchableOpacity style={styles.setupBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.setupBtnText}>지금 설정하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Phase Card */}
            {status && badge && (
              <View style={[styles.phaseCard, { backgroundColor: badge.bg }]}>
                <Text style={styles.phaseEmoji}>{badge.emoji}</Text>
                <View style={styles.phaseInfo}>
                  <Text style={[styles.phaseText, { color: badge.color }]}>{status.phase}</Text>
                  <Text style={styles.phaseSub}>주기 {Number(status.dayOfCycle) || 1}일째</Text>
                </View>
                <View style={[styles.phaseBadge, { backgroundColor: badge.color }]}>
                  <Text style={styles.phaseBadgeText}>D+{status.dayOfCycle}</Text>
                </View>
              </View>
            )}

            {/* Info Cards */}
            <View style={styles.infoRow}>
              <View style={styles.infoCard}>
                
                <Text style={styles.infoLabel}>다음 생리 예정</Text>
                <Text style={styles.infoValue}>{status?.nextPeriodDate}</Text>
                <Text style={styles.infoSub}>
                  {status && status.daysUntilNext > 0
                    ? `${status.daysUntilNext}일 후`
                    : '오늘 또는 지남'}
                </Text>
              </View>
              <View style={styles.infoCard}>
                
                <Text style={styles.infoLabel}>배란 예정일</Text>
                <Text style={styles.infoValue}>{status?.ovulationDate}</Text>
                <Text style={styles.infoSub}>주기 {(Number(cycleInfo.cycleLength) || 28) - 14}일째</Text>
              </View>
            </View>

            {/* Cycle Settings Summary */}
            <View style={styles.settingsCard}>
              <Text style={styles.settingsTitle}>주기 정보</Text>
              <View style={styles.settingsRow}>
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>주기 길이</Text>
                  <Text style={styles.settingValue}>{cycleInfo.cycleLength}일</Text>
                </View>
                <View style={styles.settingDivider} />
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>생리 기간</Text>
                  <Text style={styles.settingValue}>{cycleInfo.periodLength}일</Text>
                </View>
                <View style={styles.settingDivider} />
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>마지막 생리</Text>
                  <Text style={styles.settingValue}>{cycleInfo.lastPeriodDate}</Text>
                </View>
              </View>
            </View>

            {/* Cycle Calendar */}
            <View style={styles.calendarCard}>
              <CycleCalendar info={cycleInfo} />
            </View>
          </>
        )}
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>주기 설정</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={18} color={COLORS.subText} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>마지막 생리 시작일</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={lastPeriodDate}
                onChange={(e: any) => setLastPeriodDate(e.target.value)}
                style={{
                  border: '1.5px solid #F0E1EC', borderRadius: 20,
                  padding: '12px 14px', fontSize: 17, color: '#4A3A5C',
                  backgroundColor: '#FBF4F9', marginBottom: 14,
                  width: '100%', boxSizing: 'border-box', outline: 'none',
                } as any}
              />
            ) : (
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowCalendar(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.datePickerBtnText}>
                  {lastPeriodDate || '날짜를 선택하세요'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>주기 길이 (일)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="28"
                  placeholderTextColor="#D4C5DC"
                  keyboardType="numeric"
                  value={cycleLength}
                  onChangeText={setCycleLength}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>생리 기간 (일)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="5"
                  placeholderTextColor="#D4C5DC"
                  keyboardType="numeric"
                  value={periodLength}
                  onChangeText={setPeriodLength}
                />
              </View>
            </View>

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
        visible={showCalendar}
        value={lastPeriodDate || new Date().toISOString().slice(0, 10)}
        maxDate={new Date().toISOString().slice(0, 10)}
        onSelect={setLastPeriodDate}
        onClose={() => setShowCalendar(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 72 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, color: COLORS.pink, fontWeight: '700' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  editBtn: { backgroundColor: '#FCE4EC', borderRadius: 18, paddingHorizontal: 20, paddingVertical: 11 },
  editBtnText: { color: COLORS.pink, fontWeight: '700', fontSize: 15 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 64 },
  emptyText: { fontSize: 17, color: COLORS.text, fontWeight: '600', marginTop: 12, marginBottom: 24 },
  setupBtn: {
    backgroundColor: COLORS.pink,
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 17,
  },
  setupBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  phaseCard: {
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  phaseEmoji: { fontSize: 42 },
  phaseInfo: { flex: 1, flexShrink: 1 },
  phaseText: { fontSize: 20, fontWeight: '800', flexShrink: 1 },
  phaseSub: { fontSize: 15, color: '#8A7C9C', marginTop: 2, flexShrink: 1 },
  phaseBadge: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 11 },
  phaseBadgeText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  infoCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 26,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  infoEmoji: { fontSize: 28 },
  infoLabel: { fontSize: 13, color: '#8A7C9C', marginTop: 6, textAlign: 'center' },
  infoValue: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: 4, textAlign: 'center', flexShrink: 1 },
  infoSub: { fontSize: 13, color: COLORS.pink, marginTop: 2 },
  settingsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  settingsTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  settingItem: { alignItems: 'center' },
  settingLabel: { fontSize: 13, color: '#8A7C9C' },
  settingValue: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 4, flexShrink: 1 },
  settingDivider: { width: 1, backgroundColor: '#F0E1EC' },
  calendarCard: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  modalClose: { fontSize: 20, color: '#D4C5DC' },
  label: { fontSize: 15, fontWeight: '600', color: '#8A7C9C', marginBottom: 6 },
  datePickerBtn: {
    borderWidth: 1.5, borderColor: '#F0E1EC', borderRadius: 20,
    paddingHorizontal: 22, paddingVertical: 15, marginBottom: 14,
    backgroundColor: '#FBF4F9',
  },
  datePickerBtnText: { fontSize: 17, color: '#4A3A5C', fontWeight: '600' },
  input: {
    borderWidth: 1.5,
    borderColor: '#F0E1EC',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 17,
    color: COLORS.text,
    backgroundColor: '#FBF4F9',
    marginBottom: 14,
  },
  inputRow: { flexDirection: 'row' },
  saveBtn: {
    backgroundColor: COLORS.pink,
    borderRadius: 22,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
