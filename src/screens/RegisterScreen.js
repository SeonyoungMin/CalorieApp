import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import {authAPI} from '../services/api';

export default function RegisterScreen({navigation}) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    nickname: '',
    weightKg: '',
    heightCm: '',
    goalKcal: '2000',
  });
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm(prev => ({...prev, [key]: val}));

  const handleRegister = async () => {
    if (!form.email || !form.password || !form.nickname) {
      Alert.alert('입력 오류', '필수 항목을 모두 입력해주세요.');
      return;
    }
    if (form.password !== form.passwordConfirm) {
      Alert.alert('비밀번호 오류', '비밀번호가 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    try {
      await authAPI.register({
        email: form.email.trim(),
        password: form.password,
        nickname: form.nickname.trim(),
        weightKg: parseFloat(form.weightKg) || null,
        heightCm: parseFloat(form.heightCm) || null,
        goalKcal: parseInt(form.goalKcal) || 2000,
      });
      Alert.alert('회원가입 완료', '로그인해주세요!', [
        {text: '확인', onPress: () => navigation.navigate('Login')},
      ]);
    } catch (err) {
      Alert.alert('오류', err.response?.data?.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({label, field, keyboard = 'default', secure = false, placeholder = ''}) => (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
        keyboardType={keyboard}
        secureTextEntry={secure}
        autoCapitalize="none"
        value={form[field]}
        onChangeText={v => update(field, v)}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>회원가입</Text>

      <Field label="이메일 *" field="email" keyboard="email-address" placeholder="example@email.com" />
      <Field label="비밀번호 *" field="password" secure placeholder="6자 이상" />
      <Field label="비밀번호 확인 *" field="passwordConfirm" secure placeholder="비밀번호를 다시 입력" />
      <Field label="닉네임 *" field="nickname" placeholder="이름 또는 별명" />
      <Field label="체중 (kg)" field="weightKg" keyboard="numeric" placeholder="예: 65" />
      <Field label="신장 (cm)" field="heightCm" keyboard="numeric" placeholder="예: 170" />
      <Field label="목표 칼로리 (kcal)" field="goalKcal" keyboard="numeric" placeholder="기본 2000" />

      <TouchableOpacity
        style={[styles.btn, loading && {opacity: 0.7}]}
        onPress={handleRegister}
        disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>가입하기</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>← 로그인으로 돌아가기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f0f9f0'},
  content: {padding: 24, paddingBottom: 40},
  title: {
    fontSize: 24, fontWeight: 'bold', color: '#2e7d32',
    marginBottom: 24, marginTop: 20,
  },
  fieldWrap: {marginBottom: 16},
  label: {fontSize: 13, color: '#555', marginBottom: 4, fontWeight: '600'},
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 13, fontSize: 15, color: '#333', backgroundColor: '#fff',
  },
  btn: {
    backgroundColor: '#4CAF50', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnText: {color: '#fff', fontSize: 16, fontWeight: 'bold'},
  backBtn: {alignItems: 'center', marginTop: 16},
  backText: {color: '#4CAF50', fontSize: 14},
});
