import React, {useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {authAPI} from '../services/api';

const GREEN = '#4CAF50';

export default function ProfileScreen({navigation}) {
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await authAPI.getProfile();
      setUser(res.data);
      setForm({
        nickname: res.data.nickname || '',
        weightKg: String(res.data.weightKg || ''),
        heightCm: String(res.data.heightCm || ''),
        goalKcal: String(res.data.goalKcal || '2000'),
      });
    } catch {
      Alert.alert('오류', '프로필을 불러올 수 없습니다.');
    }
  };

  useFocusEffect(useCallback(() => {load();}, []));

  const save = async () => {
    setLoading(true);
    try {
      await authAPI.updateProfile({
        nickname: form.nickname,
        weightKg: parseFloat(form.weightKg) || null,
        heightCm: parseFloat(form.heightCm) || null,
        goalKcal: parseInt(form.goalKcal) || 2000,
      });
      setEditing(false);
      load();
      Alert.alert('저장 완료', '프로필이 업데이트되었습니다.');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // BMI 계산
  const bmi = user?.weightKg && user?.heightCm
    ? (user.weightKg / ((user.heightCm / 100) ** 2)).toFixed(1)
    : null;
  const bmiLabel = bmi
    ? bmi < 18.5 ? '저체중' : bmi < 25 ? '정상' : bmi < 30 ? '과체중' : '비만'
    : null;
  const bmiColor = bmi
    ? bmi < 18.5 ? '#2196F3' : bmi < 25 ? GREEN : bmi < 30 ? '#FF9800' : '#f44336'
    : GREEN;

  if (!user) return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" color={GREEN} />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* 프로필 헤더 */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.nickname?.[0] || '?'}</Text>
        </View>
        <Text style={styles.name}>{user.nickname}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      {/* BMI 카드 */}
      {bmi && (
        <View style={styles.bmiCard}>
          <Text style={styles.bmiTitle}>BMI 지수</Text>
          <Text style={[styles.bmiVal, {color: bmiColor}]}>{bmi}</Text>
          <Text style={[styles.bmiLabel, {color: bmiColor}]}>{bmiLabel}</Text>
        </View>
      )}

      {/* 정보 / 수정 폼 */}
      <View style={styles.infoCard}>
        {!editing ? (
          <>
            {[
              {label: '체중', val: user.weightKg ? `${user.weightKg} kg` : '-'},
              {label: '신장', val: user.heightCm ? `${user.heightCm} cm` : '-'},
              {label: '목표 칼로리', val: `${user.goalKcal} kcal`},
            ].map(item => (
              <View key={item.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoVal}>{item.val}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>✏ 프로필 수정</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {[
              {label: '닉네임', field: 'nickname', keyboard: 'default'},
              {label: '체중 (kg)', field: 'weightKg', keyboard: 'numeric'},
              {label: '신장 (cm)', field: 'heightCm', keyboard: 'numeric'},
              {label: '목표 칼로리', field: 'goalKcal', keyboard: 'numeric'},
            ].map(item => (
              <View key={item.field} style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{item.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form[item.field]}
                  onChangeText={v => setForm(p => ({...p, [item.field]: v}))}
                  keyboardType={item.keyboard}
                />
              </View>
            ))}
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditing(false)}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={save}
                disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>저장</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <View style={{height: 32}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f0f9f0'},
  header: {
    backgroundColor: GREEN, padding: 32, alignItems: 'center',
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: {fontSize: 32, fontWeight: 'bold', color: '#fff'},
  name: {fontSize: 20, fontWeight: 'bold', color: '#fff'},
  email: {fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4},
  bmiCard: {
    margin: 16, backgroundColor: '#fff', borderRadius: 16,
    padding: 20, alignItems: 'center', elevation: 2,
  },
  bmiTitle: {fontSize: 13, color: '#888', marginBottom: 4},
  bmiVal: {fontSize: 40, fontWeight: 'bold'},
  bmiLabel: {fontSize: 14, fontWeight: '600'},
  infoCard: {
    marginHorizontal: 16, backgroundColor: '#fff',
    borderRadius: 16, padding: 20, elevation: 2,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  infoLabel: {fontSize: 14, color: '#888'},
  infoVal: {fontSize: 14, fontWeight: '600', color: '#333'},
  editBtn: {
    marginTop: 16, backgroundColor: '#e8f5e9',
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  editBtnText: {color: GREEN, fontWeight: 'bold'},
  fieldWrap: {marginBottom: 14},
  fieldLabel: {fontSize: 13, color: '#555', marginBottom: 4, fontWeight: '600'},
  fieldInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 12, fontSize: 15, color: '#333',
  },
  editActions: {flexDirection: 'row', gap: 10, marginTop: 8},
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 10, padding: 13, alignItems: 'center',
  },
  cancelBtnText: {color: '#888', fontWeight: '600'},
  saveBtn: {
    flex: 1, backgroundColor: GREEN,
    borderRadius: 10, padding: 13, alignItems: 'center',
  },
  saveBtnText: {color: '#fff', fontWeight: 'bold'},
});
