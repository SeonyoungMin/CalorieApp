import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { COLORS } from '../theme';
import Icon from '../components/Icon';

interface Props {
  visible: boolean;
  breakfastGoal: number;
  lunchGoal: number;
  dinnerGoal: number;
  onSave: (breakfast: number, lunch: number, dinner: number) => Promise<void>;
  onClose: () => void;
}

export default function MealGoalModal({ visible, breakfastGoal, lunchGoal, dinnerGoal, onSave, onClose }: Props) {
  const [bf, setBf] = useState(String(breakfastGoal));
  const [ln, setLn] = useState(String(lunchGoal));
  const [dn, setDn] = useState(String(dinnerGoal));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setBf(String(breakfastGoal));
      setLn(String(lunchGoal));
      setDn(String(dinnerGoal));
    }
  }, [visible, breakfastGoal, lunchGoal, dinnerGoal]);

  const handleSave = async () => {
    const b = parseInt(bf, 10);
    const l = parseInt(ln, 10);
    const d = parseInt(dn, 10);
    if (isNaN(b) || isNaN(l) || isNaN(d) || b <= 0 || l <= 0 || d <= 0) {
      Alert.alert('입력 오류', '각 끼니별 목표를 올바르게 입력해주세요.');
      return;
    }
    if (b + l + d > 9999) {
      Alert.alert('입력 오류', '총 합계가 너무 큽니다.');
      return;
    }
    setSaving(true);
    try {
      await onSave(b, l, d);
      onClose();
    } catch {
      Alert.alert('오류', '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>끼니별 목표 칼로리</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={18} color={COLORS.subText} />
            </TouchableOpacity>
          </View>
          <Text style={styles.desc}>각 끼니의 목표 칼로리를 설정하면{'\n'}남은 칼로리가 다음 끼니로 이월됩니다.</Text>

          {[
            { label: '아침', emoji: '아침', value: bf, setter: setBf },
            { label: '점심', emoji: '점심', value: ln, setter: setLn },
            { label: '저녁', emoji: '저녁', value: dn, setter: setDn },
          ].map((item) => (
            <View key={item.emoji} style={styles.row}>
              <Text style={styles.mealLabel}>{item.label}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={item.value}
                  onChangeText={item.setter}
                  keyboardType="numeric"
                  maxLength={4}
                  placeholder="0"
                  placeholderTextColor="#D4C5DC"
                />
                <Text style={styles.unit}>kcal</Text>
              </View>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>합계</Text>
            <Text style={styles.totalVal}>
              {(parseInt(bf) || 0) + (parseInt(ln) || 0) + (parseInt(dn) || 0)} kcal
            </Text>
          </View>

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
  overlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 88,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 19, fontWeight: '800', color: COLORS.text },
  close: { fontSize: 20, color: '#8A7C9C' },
  desc: { fontSize: 14, color: '#8A7C9C', marginBottom: 20, lineHeight: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  mealLabel: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FBF4F9', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 11, gap: 6,
  },
  input: {
    fontSize: 19, fontWeight: '700', color: COLORS.text,
    minWidth: 60, textAlign: 'right',
  },
  unit: { fontSize: 14, color: '#8A7C9C' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#F0E1EC',
    paddingTop: 14, marginTop: 4, marginBottom: 20,
  },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#8A7C9C' },
  totalVal: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 24,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
