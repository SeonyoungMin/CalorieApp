// WeightScreen.js
import React, {useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, RefreshControl,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {weightAPI} from '../services/api';

const GREEN = '#4CAF50';

export default function WeightScreen() {
  const [weights, setWeights] = useState([]);
  const [input, setInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await weightAPI.getList();
      setWeights(Array.isArray(res.data) ? res.data : []);
    } catch {setWeights([]);}
  };

  useFocusEffect(useCallback(() => {load();}, []));
  const onRefresh = async () => {setRefreshing(true); await load(); setRefreshing(false);};

  const save = async () => {
    const val = parseFloat(input);
    if (!val || val < 20 || val > 300) {
      Alert.alert('입력 오류', '올바른 체중을 입력해주세요 (20~300kg)');
      return;
    }
    try {
      await weightAPI.save(val);
      setInput('');
      load();
    } catch {Alert.alert('오류', '저장에 실패했습니다.');}
  };

  const del = (id) => {
    Alert.alert('삭제', '이 기록을 삭제하시겠습니까?', [
      {text: '취소', style: 'cancel'},
      {text: '삭제', style: 'destructive', onPress: async () => {
        await weightAPI.delete(id).catch(() => {});
        load();
      }},
    ]);
  };

  const latest = weights[0]?.weightKg;
  const prev = weights[1]?.weightKg;
  const diff = latest && prev ? (latest - prev).toFixed(1) : null;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* 최근 체중 */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>현재 체중</Text>
        <Text style={styles.bigNum}>{latest ? `${latest} kg` : '-'}</Text>
        {diff && (
          <Text style={[styles.diff, {color: diff > 0 ? '#f44336' : GREEN}]}>
            {diff > 0 ? `▲ +${diff}` : `▼ ${diff}`} kg
          </Text>
        )}
      </View>
      {/* 입력 */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="체중 입력 (kg)"
          placeholderTextColor="#aaa"
          keyboardType="numeric"
          value={input}
          onChangeText={setInput}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>기록</Text>
        </TouchableOpacity>
      </View>
      {/* 목록 */}
      {weights.map((w, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.rowDate}>{w.recordedAt || '-'}</Text>
          <Text style={styles.rowVal}>{w.weightKg} kg</Text>
          <TouchableOpacity onPress={() => del(w.weightId)}>
            <Text style={styles.delText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <View style={{height: 24}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f0f9f0'},
  card: {
    margin: 16, backgroundColor: GREEN, borderRadius: 16,
    padding: 24, alignItems: 'center',
  },
  cardLabel: {color: 'rgba(255,255,255,0.8)', fontSize: 14},
  bigNum: {color: '#fff', fontSize: 40, fontWeight: 'bold', marginVertical: 4},
  diff: {fontSize: 14, fontWeight: '600'},
  inputRow: {flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 8},
  input: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    padding: 13, fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#ddd',
  },
  saveBtn: {
    backgroundColor: GREEN, borderRadius: 10,
    paddingHorizontal: 20, justifyContent: 'center',
  },
  saveBtnText: {color: '#fff', fontWeight: 'bold'},
  row: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff',
    borderRadius: 10, padding: 14, elevation: 1,
  },
  rowDate: {flex: 1, color: '#888', fontSize: 13},
  rowVal: {fontSize: 15, fontWeight: '600', color: '#333', marginRight: 12},
  delText: {color: '#f44336', fontSize: 16, fontWeight: 'bold'},
});
