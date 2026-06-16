import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, RefreshControl, Platform, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { getWorkoutsByDate, saveWorkout, deleteWorkout } from '../api/api';
import { estimateWorkoutCalories } from '../services/claudeService';
import { useArchive } from '../hooks/useArchive';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme';
import Icon from '../components/Icon';
import { localDateStr, todayStr, dateLabel } from '../utils/dateUtils';
import CalendarPicker from '../components/CalendarPicker';

const TIME_SLOTS = [15, 30, 45, 60, 75, 90, 105, 120];
const formatTimeLabel = (min: number) => {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
};

const PRESET_WORKOUTS = [
  { name: '걷기', emoji: '', kcalPerMin: 4 },
  { name: '달리기', emoji: '', kcalPerMin: 10 },
  { name: '자전거', emoji: '', kcalPerMin: 8 },
  { name: '수영', emoji: '', kcalPerMin: 9 },
  { name: '헬스', emoji: '', kcalPerMin: 7 },
  { name: '요가', emoji: '', kcalPerMin: 3 },
  { name: '줄넘기', emoji: '', kcalPerMin: 11 },
  { name: '등산', emoji: '', kcalPerMin: 8 },
];

interface Workout {
  workoutId: number;
  exerciseName: string;
  durationMin: number;
  kcalBurned: number;
}


export default function WorkoutScreen() {
  const { addPhotoToEntry } = useArchive();
  const { userId } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiCalcLoading, setAiCalcLoading] = useState(false);
  const [viewDate, setViewDate] = useState(todayStr());
  const [memo, setMemo] = useState('');
  const [memoEdit, setMemoEdit] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showLogDateCalendar, setShowLogDateCalendar] = useState(false);

  const [exerciseName, setExerciseName] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [kcalBurned, setKcalBurned] = useState('');
  const [logDate, setLogDate] = useState(todayStr());
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const fetchWorkouts = useCallback(async (date: string) => {
    try {
      const [res, savedMemo] = await Promise.all([
        getWorkoutsByDate(date),
        AsyncStorage.getItem(`workout_memo_${date}`),
      ]);
      setWorkouts(res.data || []);
      setMemo(savedMemo || '');
      setMemoEdit(false);
    } catch {
      Alert.alert('오류', '운동 기록을 불러오지 못했습니다.');
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setViewDate(todayStr());
  }, []));

  useEffect(() => {
    setLoading(true);
    fetchWorkouts(viewDate).finally(() => setLoading(false));
  }, [viewDate, fetchWorkouts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWorkouts(viewDate);
    setRefreshing(false);
  };

  const moveDate = (delta: number) => {
    const d = new Date(viewDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const next = localDateStr(d);
    if (next <= todayStr()) setViewDate(next);
  };

  const openDatePicker = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'date';
      input.max = todayStr();
      input.value = viewDate;
      input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
      document.body.appendChild(input);
      input.onchange = (e: any) => {
        if ((e.target as HTMLInputElement).value) setViewDate((e.target as HTMLInputElement).value);
        document.body.removeChild(input);
      };
      input.click();
    } else {
      setShowCalendar(true);
    }
  };

  const saveMemo = async () => {
    await AsyncStorage.setItem(`workout_memo_${viewDate}`, memo);
    setMemoEdit(false);
  };

  const selectPreset = (preset: (typeof PRESET_WORKOUTS)[0]) => {
    setExerciseName(preset.name);
    const mins = parseInt(durationMin, 10);
    if (durationMin && !isNaN(mins)) setKcalBurned(String(Math.round(preset.kcalPerMin * mins)));
  };

  const onDurationChange = (val: string) => {
    const numeric = val.replace(/[^0-9]/g, '');
    setDurationMin(numeric);
    const preset = PRESET_WORKOUTS.find((p) => p.name === exerciseName);
    const mins2 = parseInt(numeric, 10);
    if (preset && numeric && !isNaN(mins2)) setKcalBurned(String(Math.round(preset.kcalPerMin * mins2)));
  };

  const resetForm = () => { setExerciseName(''); setDurationMin(''); setKcalBurned(''); setPhotoUri(null); };

  const handlePickPhoto = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.7, maxWidth: 800, maxHeight: 800 }, (res) => {
      if (!res.didCancel && res.assets?.[0]?.uri) setPhotoUri(res.assets[0].uri);
    });
  };

  const handleAiCalc = async () => {
    if (!exerciseName.trim()) { Alert.alert('입력 오류', '운동 이름을 먼저 입력해주세요.'); return; }
    const mins = parseInt(durationMin, 10);
    if (!durationMin || isNaN(mins) || mins <= 0) { Alert.alert('입력 오류', '운동 시간을 먼저 선택해주세요.'); return; }
    setAiCalcLoading(true);
    try {
      const kcal = await estimateWorkoutCalories(exerciseName.trim(), mins);
      setKcalBurned(String(kcal));
    } catch {
      Alert.alert('AI 오류', '칼로리 계산에 실패했어요. 직접 입력해주세요.');
    } finally {
      setAiCalcLoading(false);
    }
  };

  const handleSave = async () => {
    if (!exerciseName.trim() || !durationMin || !kcalBurned) {
      Alert.alert('입력 오류', '모든 항목을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      await saveWorkout({
        exerciseName: exerciseName.trim(),
        durationMin: parseInt(durationMin, 10),
        kcalBurned: parseInt(kcalBurned, 10),
        logDate,
      });
      if (photoUri) {
        try { await addPhotoToEntry(logDate, '오운완', photoUri, String(userId ?? '')); } catch {}
      }
      if (logDate === viewDate) await fetchWorkouts(viewDate);
      setModalVisible(false);
      resetForm();
      if (logDate !== viewDate) Alert.alert('저장 완료', `${logDate} 날짜로 기록되었습니다.`);
    } catch (e: any) {
      Alert.alert('저장 실패', e?.response?.data?.message || '다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (workoutId: number) => {
    const ok = Platform.OS === 'web'
      ? window.confirm('이 운동 기록을 삭제하시겠습니까?')
      : await new Promise<boolean>((resolve) =>
          Alert.alert('삭제', '이 운동 기록을 삭제하시겠습니까?', [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!ok) return;
    try {
      await deleteWorkout(workoutId);
      await fetchWorkouts(viewDate);
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
          await Promise.all(selectedIds.map(id => deleteWorkout(id)));
          setSelectedIds([]);
          setEditMode(false);
          await fetchWorkouts(viewDate);
        } catch {
          Alert.alert('오류', '삭제에 실패했습니다.');
        }
      }},
    ]);
  };

  const handleDeleteAllWorkouts = () => {
    if (!workouts.length) return;
    Alert.alert('전체 삭제', '현재 날짜의 모든 운동 기록을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '전체 삭제', style: 'destructive', onPress: async () => {
        try {
          await Promise.all(workouts.map(w => deleteWorkout(w.workoutId)));
          setSelectedIds([]);
          setEditMode(false);
          await fetchWorkouts(viewDate);
        } catch {
          Alert.alert('오류', '삭제에 실패했습니다.');
        }
      }},
    ]);
  };

  const totalKcal = workouts.reduce((s, w) => s + w.kcalBurned, 0);
  const totalMin = workouts.reduce((s, w) => s + w.durationMin, 0);


  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* 날짜 네비게이션 */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => moveDate(-1)} style={styles.dateArrow}>
            <Text style={styles.dateArrowText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openDatePicker} style={styles.dateLabelBtn}>
            <Text style={styles.dateLabel}>{dateLabel(viewDate)} </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => moveDate(1)}
            style={[styles.dateArrow, viewDate === todayStr() && { opacity: 0.3 }]}
            disabled={viewDate === todayStr()}
          >
            <Text style={[styles.dateArrowText, viewDate === todayStr() && { color: '#F0E1EC' }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1, flexShrink: 1, marginRight: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{dateLabel(viewDate)}의 운동</Text>
            <Text style={styles.headerSub} numberOfLines={1}>총 {totalMin}분 · {totalKcal} kcal 소모</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {workouts.length > 0 && (
              <TouchableOpacity style={styles.editBtn} onPress={() => { setEditMode(!editMode); setSelectedIds([]); }}>
                <Text style={styles.editBtnText}>{editMode ? '완료' : '편집'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.addBtn} onPress={() => { setLogDate(todayStr()); setModalVisible(true); }}>
              <Text style={styles.addBtnText}>+ 추가</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 한줄 요약 */}
        <View style={styles.memoCard}>
          
          {memoEdit ? (
            <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={styles.memoInput}
                value={memo}
                onChangeText={setMemo}
                placeholder="오늘 운동 한줄 요약..."
                placeholderTextColor="#D4C5DC"
                autoFocus
                maxLength={50}
              />
              <TouchableOpacity onPress={saveMemo} style={styles.memoSaveBtn}>
                <Text style={styles.memoSaveBtnText}>저장</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setMemoEdit(true)}>
              <Text style={[styles.memoText, !memo && { color: '#D4C5DC' }]}>
                {memo || '한줄 요약을 남겨보세요 (탭해서 입력)'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderTopColor: COLORS.secondary }]}>
            
            <Text style={[styles.summaryNum, { color: COLORS.secondary }]}>{totalMin}분</Text>
            <Text style={styles.summaryLabel}>총 운동 시간</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: COLORS.primary }]}>
            
            <Text style={[styles.summaryNum, { color: COLORS.primary }]}>{totalKcal}</Text>
            <Text style={styles.summaryLabel}>소모 칼로리</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: COLORS.purple }]}>
            
            <Text style={[styles.summaryNum, { color: COLORS.purple }]}>{workouts.length}</Text>
            <Text style={styles.summaryLabel}>운동 종류</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : workouts.length === 0 ? (
          <View style={styles.emptyWrap}>
            
            <Text style={styles.emptyText}>{dateLabel(viewDate)} 운동 기록이 없어요</Text>
            <Text style={styles.emptySubText}>운동을 추가해 칼로리를 관리하세요!</Text>
          </View>
        ) : (
          workouts.map((w) => (
            <TouchableOpacity
              key={w.workoutId}
              style={[styles.workoutCard, editMode && selectedIds.includes(w.workoutId) && { backgroundColor: COLORS.secondary + '15' }]}
              onPress={editMode ? () => toggleSelect(w.workoutId) : undefined}
              activeOpacity={editMode ? 0.7 : 1}
            >
              {editMode && (
                <View style={[styles.checkbox, selectedIds.includes(w.workoutId) && styles.checkboxSelected]}>
                  {selectedIds.includes(w.workoutId) && <Icon name="check" size={12} color={"#fff"} />}
                </View>
              )}
              <View style={styles.workoutLeft}>
                <Text style={styles.workoutEmoji}>
                  {PRESET_WORKOUTS.find((p) => p.name === w.exerciseName)?.emoji || ''}
                </Text>
                <View>
                  <Text style={styles.workoutName}>{w.exerciseName}</Text>
                  <Text style={styles.workoutDuration}>{w.durationMin}분</Text>
                </View>
              </View>
              <View style={styles.workoutRight}>
                <Text style={styles.workoutKcal}>{w.kcalBurned} kcal</Text>
                {!editMode && (
                  <TouchableOpacity onPress={() => handleDelete(w.workoutId)} style={styles.delBtn}>
                    <Icon name="trash" size={14} color={"#fff"} />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))
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
          <TouchableOpacity style={styles.editDeleteAllBtn} onPress={handleDeleteAllWorkouts}>
            <Text style={styles.editDeleteAllText}>모두 삭제</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => { setModalVisible(false); resetForm(); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>운동 추가</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Icon name="close" size={18} color={COLORS.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* 날짜 선택 */}
            <Text style={styles.label}>날짜</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={logDate}
                max={todayStr()}
                onChange={(e: any) => setLogDate(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', fontSize: 17, border: '1.5px solid #F0E1EC', borderRadius: 20, marginBottom: 12, color: '#4A3A5C', backgroundColor: '#FBF4F9', boxSizing: 'border-box' } as any}
              />
            ) : (
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowLogDateCalendar(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.datePickerBtnText}>{logDate}</Text>
              </TouchableOpacity>
            )}

            {/* Presets */}
            <Text style={styles.label}>빠른 선택</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {PRESET_WORKOUTS.map((p) => (
                <TouchableOpacity key={p.name} style={[styles.presetBtn, exerciseName === p.name && styles.presetBtnActive]} onPress={() => selectPreset(p)}>
                  <Text style={styles.presetEmoji}>{p.emoji}</Text>
                  <Text style={[styles.presetText, exerciseName === p.name && { color: '#fff' }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>운동 이름</Text>
            <TextInput style={styles.input} placeholder="직접 입력 (예: 복싱, 클라이밍)" placeholderTextColor="#D4C5DC" value={exerciseName} onChangeText={setExerciseName} />

            {/* 시간 선택 칩 */}
            <Text style={styles.label}>운동 시간</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {TIME_SLOTS.map(min => (
                <TouchableOpacity
                  key={min}
                  style={[styles.timeChip, durationMin === String(min) && styles.timeChipActive]}
                  onPress={() => onDurationChange(String(min))}
                >
                  <Text style={[styles.timeChipText, durationMin === String(min) && styles.timeChipTextActive]}>
                    {formatTimeLabel(min)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={[styles.input, { marginBottom: 14 }]}
              placeholder="직접 입력 (분)"
              placeholderTextColor="#D4C5DC"
              keyboardType="numeric"
              value={durationMin}
              onChangeText={onDurationChange}
            />

            {/* 칼로리 + AI 계산 */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 0 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>소모 칼로리</Text>
                <TextInput style={styles.input} placeholder="200" placeholderTextColor="#D4C5DC" keyboardType="numeric" value={kcalBurned} onChangeText={(val) => setKcalBurned(val.replace(/[^0-9]/g, ''))} />
              </View>
              <TouchableOpacity
                style={[styles.aiBtn, (aiCalcLoading || !exerciseName.trim() || !durationMin) && { opacity: 0.5 }]}
                onPress={handleAiCalc}
                disabled={aiCalcLoading || !exerciseName.trim() || !durationMin}
              >
                {aiCalcLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.aiBtnText}>AI 계산</Text>
                }
              </TouchableOpacity>
            </View>

            {/* 사진 첨부 */}
            <Text style={styles.label}>사진 첨부 (선택)</Text>
            <Text style={styles.photoHint}>오운완 사진을 찍고 아카이브에서 확인할 수 있어요</Text>
            <TouchableOpacity style={styles.photoPickerBtn} onPress={handlePickPhoto}>
              {photoUri
                ? <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                : <Text style={styles.photoPickerText}>사진 선택</Text>
              }
            </TouchableOpacity>
            {photoUri && (
              <TouchableOpacity onPress={() => setPhotoUri(null)} style={styles.photoRemoveBtn}>
                <Text style={styles.photoRemoveText}>사진 제거</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>저장</Text>}
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CalendarPicker
        visible={showCalendar}
        value={viewDate}
        maxDate={todayStr()}
        onSelect={setViewDate}
        onClose={() => setShowCalendar(false)}
      />
      <CalendarPicker
        visible={showLogDateCalendar}
        value={logDate}
        maxDate={todayStr()}
        onSelect={setLogDate}
        onClose={() => setShowLogDateCalendar(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 72 },
  datePickerBtn: {
    borderWidth: 1.5, borderColor: '#F0E1EC', borderRadius: 20,
    paddingHorizontal: 22, paddingVertical: 15, marginBottom: 12,
    backgroundColor: '#FBF4F9',
  },
  datePickerBtnText: { fontSize: 17, color: '#4A3A5C', fontWeight: '600' },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 16 },
  dateArrow: { padding: 8 },
  dateArrowText: { fontSize: 28, color: COLORS.primary, fontWeight: '300', lineHeight: 32 },
  dateLabelBtn: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.card },
  dateLabel: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 15, color: '#8A7C9C', marginTop: 2 },
  addBtn: { backgroundColor: COLORS.secondary, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 13 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  photoHint: { fontSize: 14, color: '#8A7C9C', marginBottom: 8, marginTop: -4 },
  photoPickerBtn: { borderWidth: 1.5, borderColor: '#F0E1EC', borderRadius: 20, borderStyle: 'dashed', height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: 8, backgroundColor: '#FBF4F9', overflow: 'hidden' },
  photoPickerText: { fontSize: 16, color: '#D4C5DC', fontWeight: '600' },
  photoPreview: { width: '100%', height: 90 },
  photoRemoveBtn: { alignItems: 'center', marginBottom: 14 },
  photoRemoveText: { fontSize: 15, color: COLORS.primary },
  timeChip: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 28, borderWidth: 1.5, borderColor: '#F0E1EC', backgroundColor: '#FBF4F9', marginRight: 8, marginBottom: 8 },
  timeChipActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  timeChipText: { fontSize: 15, color: '#8A7C9C', fontWeight: '600' },
  timeChipTextActive: { color: '#fff' },
  aiBtn: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 15, marginBottom: 14, justifyContent: 'center', alignItems: 'center', minWidth: 90 },
  aiBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  editBtn: { backgroundColor: '#FFF5F8', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 11 },
  editBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  checkbox: { width: 22, height: 22, borderRadius: 18, borderWidth: 2, borderColor: '#F0E1EC', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  checkboxSelected: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  checkmark: { fontSize: 14, color: '#fff', fontWeight: '700' },
  editActionBar: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: '#F0E1EC' },
  editCancelBtn: { flex: 1, paddingVertical: 15, borderRadius: 20, borderWidth: 1.5, borderColor: '#F0E1EC', alignItems: 'center' },
  editCancelText: { fontSize: 15, fontWeight: '600', color: '#8A7C9C' },
  editDeleteBtn: { flex: 2, paddingVertical: 15, borderRadius: 20, backgroundColor: '#F5C99B', alignItems: 'center' },
  editDeleteText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  editDeleteAllBtn: { flex: 1.5, paddingVertical: 15, borderRadius: 20, backgroundColor: '#F5A3B0', alignItems: 'center' },
  editDeleteAllText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  memoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: 22, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.secondary },
  memoIcon: { fontSize: 19 },
  memoText: { fontSize: 16, color: COLORS.text, fontWeight: '500', flex: 1 },
  memoInput: { flex: 1, fontSize: 16, color: COLORS.text, borderBottomWidth: 1.5, borderBottomColor: COLORS.secondary, paddingVertical: 2 },
  memoSaveBtn: { backgroundColor: COLORS.secondary, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 6 },
  memoSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 24, padding: 14, alignItems: 'center', borderTopWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  summaryEmoji: { fontSize: 22 },
  summaryNum: { fontSize: 19, fontWeight: '800', marginTop: 4 },
  summaryLabel: { fontSize: 12, color: '#8A7C9C', marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 17, color: COLORS.text, fontWeight: '600', marginTop: 12 },
  emptySubText: { fontSize: 15, color: '#8A7C9C', marginTop: 4 },
  workoutCard: { backgroundColor: COLORS.card, borderRadius: 26, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  workoutLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, flexShrink: 1 },
  workoutEmoji: { fontSize: 32 },
  workoutName: { fontSize: 17, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  workoutDuration: { fontSize: 15, color: '#8A7C9C', marginTop: 2 },
  workoutRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  workoutKcal: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  delBtn: { padding: 4 },
  delBtnText: { color: '#D4C5DC', fontSize: 17 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  modalClose: { fontSize: 20, color: '#D4C5DC' },
  label: { fontSize: 15, fontWeight: '600', color: '#8A7C9C', marginBottom: 6 },
  presetBtn: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13, borderRadius: 22, borderWidth: 1.5, borderColor: '#F0E1EC', backgroundColor: '#FBF4F9', marginRight: 8 },
  presetBtnActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  presetEmoji: { fontSize: 22 },
  presetText: { fontSize: 13, color: '#8A7C9C', fontWeight: '600', marginTop: 2, textAlign: 'center' },
  input: { borderWidth: 1.5, borderColor: '#F0E1EC', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 15, fontSize: 17, color: COLORS.text, backgroundColor: '#FBF4F9', marginBottom: 14 },
  inputRow: { flexDirection: 'row' },
  saveBtn: { backgroundColor: COLORS.secondary, borderRadius: 22, paddingVertical: 15, alignItems: 'center', marginTop: 4, shadowColor: COLORS.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
