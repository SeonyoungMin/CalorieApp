import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { COLORS } from '../theme';
import Icon from '../components/Icon';

interface Props {
  visible: boolean;
  currentWeight: number | null;
  goalWeight: number | null;
  onSave: (current: number, goal: number) => Promise<void>;
  onClose: () => void;
}

export default function WeightGoalModal({ visible, currentWeight, goalWeight, onSave, onClose }: Props) {
  const [cur, setCur] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCur(currentWeight != null ? String(currentWeight) : '');
      setGoal(goalWeight   != null ? String(goalWeight)    : '');
    }
  }, [visible, currentWeight, goalWeight]);

  const handleSave = async () => {
    const c = parseFloat(cur);
    const g = parseFloat(goal);
    if (isNaN(c) || c <= 0 || c > 300) {
      Alert.alert('입력 오류', '현재 체중을 올바르게 입력해주세요. (1~300 kg)');
      return;
    }
    if (isNaN(g) || g <= 0 || g > 300) {
      Alert.alert('입력 오류', '목표 체중을 올바르게 입력해주세요. (1~300 kg)');
      return;
    }
    setSaving(true);
    try {
      await onSave(c, g);
      onClose();
    } catch {
      Alert.alert('오류', '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const diff = (!isNaN(parseFloat(cur)) && !isNaN(parseFloat(goal)))
    ? (parseFloat(cur) - parseFloat(goal)).toFixed(1)
    : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>목표 체중 설정</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={18} color={COLORS.subText} />
            </TouchableOpacity>
          </View>
          <Text style={styles.desc}>현재 체중과 목표 체중을 입력하면{'\n'}달성 예상일을 계산해드려요.</Text>

          <Text style={styles.label}>현재 체중</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={cur}
              onChangeText={setCur}
              keyboardType="decimal-pad"
              placeholder="예) 72.5"
              placeholderTextColor="#D4C5DC"
            />
            <Text style={styles.unit}>kg</Text>
          </View>

          <Text style={styles.label}>목표 체중</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={goal}
              onChangeText={setGoal}
              keyboardType="decimal-pad"
              placeholder="예) 68.0"
              placeholderTextColor="#D4C5DC"
            />
            <Text style={styles.unit}>kg</Text>
          </View>

          {diff !== null && (
            <View style={styles.diffRow}>
              <Text style={styles.diffLabel}>감량 목표</Text>
              <Text style={[styles.diffVal, parseFloat(diff) > 0 ? { color: COLORS.success } : { color: COLORS.warning }]}>
                {parseFloat(diff) > 0 ? `▼ ${diff} kg` : parseFloat(diff) < 0 ? `▲ ${Math.abs(parseFloat(diff)).toFixed(1)} kg` : '이미 목표 달성!'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? '저장 중...' : '저장하기'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 88,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 19, fontWeight: '800', color: COLORS.text },
  close: { fontSize: 20, color: '#8A7C9C' },
  desc: { fontSize: 14, color: '#8A7C9C', marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 15, fontWeight: '600', color: '#8A7C9C', marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: '#F0E1EC',
    borderRadius: 20, paddingHorizontal: 22, paddingVertical: 15,
    fontSize: 20, fontWeight: '700', color: COLORS.text,
    backgroundColor: '#FBF4F9', textAlign: 'center',
  },
  unit: { fontSize: 17, color: '#8A7C9C', fontWeight: '600', width: 28 },
  diffRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#FBF4F9', borderRadius: 20,
    paddingHorizontal: 22, paddingVertical: 15, marginBottom: 20,
  },
  diffLabel: { fontSize: 16, color: '#8A7C9C', fontWeight: '600' },
  diffVal: { fontSize: 17, fontWeight: '800' },
  saveBtn: {
    backgroundColor: COLORS.purple, borderRadius: 24,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
