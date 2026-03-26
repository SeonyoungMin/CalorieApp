import React, {useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView, RefreshControl,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {waterAPI} from '../services/api';

const BLUE = '#2196F3';
const GOAL_ML = 2000;

const AMOUNTS = [200, 300, 500];

export default function WaterScreen() {
  const [totalMl, setTotalMl] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await waterAPI.getToday();
      setTotalMl(res.data?.totalMl || 0);
    } catch {
      setTotalMl(0);
    }
  };

  useFocusEffect(useCallback(() => {load();}, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const add = async (ml) => {
    try {
      await waterAPI.add(ml);
      load();
    } catch {
      Alert.alert('오류', '저장에 실패했습니다.');
    }
  };

  const reset = () => {
    Alert.alert('초기화', '오늘 물 섭취를 초기화하시겠습니까?', [
      {text: '취소', style: 'cancel'},
      {
        text: '초기화', style: 'destructive', onPress: async () => {
          await waterAPI.reset().catch(() => {});
          load();
        },
      },
    ]);
  };

  const progress = Math.min(totalMl / GOAL_ML, 1);
  const cups = Math.round(totalMl / 200); // 200ml = 1컵

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.content}>

      {/* 원형 표시기 */}
      <View style={styles.circleWrap}>
        <View style={styles.circle}>
          <Text style={styles.circleAmount}>{(totalMl / 1000).toFixed(1)}</Text>
          <Text style={styles.circleUnit}>L / {GOAL_ML / 1000}L</Text>
        </View>
        {/* 물 채우기 시각화 */}
        <View style={styles.waveBar}>
          <View style={[styles.waveFill, {width: `${progress * 100}%`}]} />
        </View>
        <Text style={styles.progressText}>{Math.round(progress * 100)}% 달성 • {cups}컵</Text>
      </View>

      {/* 버튼들 */}
      <Text style={styles.label}>마실 양 선택</Text>
      <View style={styles.btnRow}>
        {AMOUNTS.map(ml => (
          <TouchableOpacity key={ml} style={styles.waterBtn} onPress={() => add(ml)}>
            <Text style={styles.waterBtnIcon}>💧</Text>
            <Text style={styles.waterBtnText}>{ml}ml</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 커스텀 */}
      <View style={styles.customRow}>
        {[100, 400, 700, 1000].map(ml => (
          <TouchableOpacity key={ml} style={styles.customBtn} onPress={() => add(ml)}>
            <Text style={styles.customBtnText}>+{ml}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 초기화 */}
      <TouchableOpacity onPress={reset} style={styles.resetBtn}>
        <Text style={styles.resetText}>🔄 오늘 기록 초기화</Text>
      </TouchableOpacity>

      {/* 권장 안내 */}
      <View style={styles.tip}>
        <Text style={styles.tipText}>💡 하루 권장 수분 섭취량은 약 2L (8잔)입니다</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f0f9f0'},
  content: {padding: 20, alignItems: 'center'},
  circleWrap: {alignItems: 'center', marginBottom: 32},
  circle: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: '#E3F2FD', borderWidth: 6, borderColor: BLUE,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    elevation: 4,
  },
  circleAmount: {fontSize: 36, fontWeight: 'bold', color: BLUE},
  circleUnit: {fontSize: 14, color: '#666'},
  waveBar: {
    width: 240, height: 14, backgroundColor: '#ddd',
    borderRadius: 7, overflow: 'hidden', marginBottom: 8,
  },
  waveFill: {
    height: '100%', backgroundColor: BLUE, borderRadius: 7,
  },
  progressText: {fontSize: 14, color: '#555'},
  label: {
    fontSize: 15, fontWeight: '600', color: '#444',
    alignSelf: 'flex-start', marginBottom: 12,
  },
  btnRow: {flexDirection: 'row', gap: 12, marginBottom: 12},
  waterBtn: {
    flex: 1, backgroundColor: '#E3F2FD', borderRadius: 16,
    padding: 20, alignItems: 'center', elevation: 2,
  },
  waterBtnIcon: {fontSize: 32, marginBottom: 6},
  waterBtnText: {fontSize: 14, fontWeight: 'bold', color: BLUE},
  customRow: {
    flexDirection: 'row', gap: 8, marginBottom: 24,
    alignSelf: 'stretch',
  },
  customBtn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: BLUE,
  },
  customBtnText: {color: BLUE, fontWeight: '600', fontSize: 13},
  resetBtn: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 24,
    paddingVertical: 12, borderWidth: 1, borderColor: '#ddd', marginBottom: 24,
  },
  resetText: {color: '#888', fontSize: 14},
  tip: {
    backgroundColor: '#fff3e0', borderRadius: 10,
    padding: 14, alignSelf: 'stretch',
  },
  tipText: {color: '#E65100', fontSize: 13},
});
