import React, {useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, RefreshControl,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {workoutAPI} from '../services/api';

const GREEN = '#4CAF50';

const WORKOUT_LIST = [
  {name: '걷기', icon: '🚶', kcalPerMin: 4},
  {name: '달리기', icon: '🏃', kcalPerMin: 10},
  {name: '자전거', icon: '🚴', kcalPerMin: 8},
  {name: '수영', icon: '🏊', kcalPerMin: 11},
  {name: '근력운동', icon: '💪', kcalPerMin: 7},
  {name: '요가', icon: '🧘', kcalPerMin: 4},
  {name: '등산', icon: '🧗', kcalPerMin: 9},
  {name: '줄넘기', icon: '🤸', kcalPerMin: 12},
];

export default function WorkoutScreen() {
  const [workouts, setWorkouts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [duration, setDuration] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await workoutAPI.getToday();
      setWorkouts(Array.isArray(res.data) ? res.data : []);
    } catch {setWorkouts([]);}
  };

  useFocusEffect(useCallback(() => {load();}, []));
  const onRefresh = async () => {setRefreshing(true); await load(); setRefreshing(false);};

  const save = async () => {
    if (!selected) { Alert.alert('운동 종류를 선택해주세요'); return; }
    const min = parseInt(duration);
    if (!min || min < 1) { Alert.alert('운동 시간을 입력해주세요'); return; }
    const burned = Math.round(selected.kcalPerMin * min);
    try {
      await workoutAPI.save(selected.name, min, burned);
      setSelected(null);
      setDuration('');
      load();
    } catch { Alert.alert('오류', '저장에 실패했습니다.'); }
  };

  const del = (id) => {
    Alert.alert('삭제', '이 운동 기록을 삭제하시겠습니까?', [
      {text: '취소', style: 'cancel'},
      {text: '삭제', style: 'destructive', onPress: async () => {
        await workoutAPI.delete(id).catch(() => {});
        load();
      }},
    ]);
  };

  const totalBurned = workouts.reduce((s, w) => s + (w.burnedKcal || 0), 0);

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* 총 소모 */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>오늘 소모 칼로리</Text>
        <Text style={styles.summaryVal}>{totalBurned} kcal</Text>
      </View>

      {/* 운동 선택 */}
      <Text style={styles.sectionTitle}>운동 선택</Text>
      <View style={styles.grid}>
        {WORKOUT_LIST.map((w) => (
          <TouchableOpacity
            key={w.name}
            style={[styles.workoutBtn, selected?.name === w.name && styles.workoutBtnActive]}
            onPress={() => setSelected(w)}>
            <Text style={styles.workoutIcon}>{w.icon}</Text>
            <Text style={[styles.workoutName, selected?.name === w.name && {color: '#fff'}]}>{w.name}</Text>
            <Text style={[styles.workoutKcal, selected?.name === w.name && {color: 'rgba(255,255,255,0.8)'}]}>
              {w.kcalPerMin}kcal/분
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 시간 입력 */}
      {selected && (
        <View style={styles.durationCard}>
          <Text style={styles.durationLabel}>{selected.icon} {selected.name} — 몇 분 했나요?</Text>
          <View style={styles.durationRow}>
            <TextInput
              style={styles.durationInput}
              placeholder="분"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              value={duration}
              onChangeText={setDuration}
            />
            {duration ? (
              <Text style={styles.estKcal}>
                ≈ {Math.round(selected.kcalPerMin * parseInt(duration || 0))} kcal 소모
              </Text>
            ) : null}
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveBtnText}>운동 기록 저장</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 오늘 운동 목록 */}
      {workouts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>오늘 운동 기록</Text>
          {workouts.map((w, i) => (
            <View key={i} style={styles.logRow}>
              <Text style={styles.logType}>{w.workoutType}</Text>
              <Text style={styles.logDetail}>{w.durationMin}분</Text>
              <Text style={styles.logKcal}>-{w.burnedKcal} kcal</Text>
              <TouchableOpacity onPress={() => del(w.workoutId)}>
                <Text style={styles.delText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      <View style={{height: 24}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f0f9f0'},
  summaryCard: {
    margin: 16, backgroundColor: '#FF5722', borderRadius: 16,
    padding: 20, alignItems: 'center',
  },
  summaryLabel: {color: 'rgba(255,255,255,0.85)', fontSize: 14},
  summaryVal: {color: '#fff', fontSize: 36, fontWeight: 'bold'},
  sectionTitle: {
    fontSize: 15, fontWeight: 'bold', color: '#333',
    marginLeft: 16, marginBottom: 10, marginTop: 4,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, marginBottom: 8,
  },
  workoutBtn: {
    width: '22%', margin: '1.5%', backgroundColor: '#fff',
    borderRadius: 12, padding: 10, alignItems: 'center', elevation: 1,
  },
  workoutBtnActive: {backgroundColor: GREEN},
  workoutIcon: {fontSize: 24, marginBottom: 4},
  workoutName: {fontSize: 12, color: '#333', fontWeight: '600'},
  workoutKcal: {fontSize: 10, color: '#888'},
  durationCard: {
    marginHorizontal: 16, backgroundColor: '#fff',
    borderRadius: 14, padding: 16, marginBottom: 8, elevation: 2,
  },
  durationLabel: {fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 12},
  durationRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12},
  durationInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 10, padding: 12, fontSize: 15, color: '#333',
  },
  estKcal: {color: GREEN, fontSize: 14, fontWeight: '600'},
  saveBtn: {
    backgroundColor: GREEN, borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  saveBtnText: {color: '#fff', fontWeight: 'bold', fontSize: 15},
  logRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#fff', borderRadius: 10, padding: 14, elevation: 1,
  },
  logType: {flex: 1, fontSize: 14, fontWeight: '600', color: '#333'},
  logDetail: {fontSize: 13, color: '#888', marginRight: 8},
  logKcal: {fontSize: 13, fontWeight: '600', color: '#FF5722', marginRight: 12},
  delText: {color: '#f44336', fontSize: 16, fontWeight: 'bold'},
});
