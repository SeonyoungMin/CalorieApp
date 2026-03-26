import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';

const COLORS = {
  primary: '#FF6B6B',
  secondary: '#4ECDC4',
  bg: '#F0F4F8',
  card: '#FFFFFF',
  text: '#2C3E50',
};

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveId, setSaveId] = useState(false);

  // 저장된 아이디 불러오기
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('SAVED_EMAIL');
      const checked = await AsyncStorage.getItem('SAVE_ID_CHECKED');
      if (saved && checked === 'true') {
        setEmail(saved);
        setSaveId(true);
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      // 아이디 저장 처리
      if (saveId) {
        await AsyncStorage.setItem('SAVED_EMAIL', email.trim());
        await AsyncStorage.setItem('SAVE_ID_CHECKED', 'true');
      } else {
        await AsyncStorage.removeItem('SAVED_EMAIL');
        await AsyncStorage.setItem('SAVE_ID_CHECKED', 'false');
      }
    } catch (e: any) {
      Alert.alert('로그인 실패', e?.response?.data?.message || '이메일 또는 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>🥗</Text>
          <Text style={styles.logoTitle}>CalorieApp</Text>
          <Text style={styles.logoSub}>건강한 하루를 기록하세요</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>로그인</Text>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              style={styles.input}
              placeholder="example@email.com"
              placeholderTextColor="#B0BEC5"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>비밀번호</Text>
            <TextInput
              style={styles.input}
              placeholder="비밀번호를 입력하세요"
              placeholderTextColor="#B0BEC5"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* 아이디 저장 */}
          <TouchableOpacity style={styles.saveIdRow} onPress={() => setSaveId(v => !v)} activeOpacity={0.7}>
            <View style={[styles.checkbox, saveId && styles.checkboxOn]}>
              {saveId && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.saveIdLabel}>아이디 저장</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>로그인</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.linkText}>
              계정이 없으신가요? <Text style={styles.linkHighlight}>회원가입</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoEmoji: { fontSize: 64 },
  logoTitle: { fontSize: 32, fontWeight: '800', color: COLORS.primary, marginTop: 8 },
  logoSub: { fontSize: 14, color: '#78909C', marginTop: 4 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  inputWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#78909C', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E7EF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: '#FAFBFD',
  },
  saveIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: -4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#B0BEC5',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  saveIdLabel: { fontSize: 14, color: '#78909C' },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { marginTop: 20, alignItems: 'center' },
  linkText: { fontSize: 14, color: '#78909C' },
  linkHighlight: { color: COLORS.primary, fontWeight: '700' },
});
