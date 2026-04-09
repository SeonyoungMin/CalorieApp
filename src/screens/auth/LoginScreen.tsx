import React, { useState, useEffect, useRef } from 'react';
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
import { COLORS } from '../../theme';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../../config/socialConfig';

// 구글 SDK 초기화 (앱 시작 시 한 번 실행)
GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

export default function LoginScreen({ navigation }: any) {
  const { login, loginWithKakao, loginWithGoogle } = useAuth();
  const passwordRef = useRef<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [saveId, setSaveId] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

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
    if (!isValidEmail(email.trim())) {
      Alert.alert('입력 오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
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

  const handleKakaoLogin = async () => {
    setKakaoLoading(true);
    try {
      await loginWithKakao();
    } catch (e: any) {
      const msg = e?.message || '';
      // 사용자가 직접 취소한 경우 알림 생략
      if (!msg.includes('cancelled') && !msg.includes('cancel') && !msg.includes('MissingKakaoKeyHashException')) {
        Alert.alert('카카오 로그인 실패', msg || '다시 시도해주세요.');
      }
    } finally {
      setKakaoLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (e: any) {
      const msg = e?.message || '';
      if (!msg.includes('SIGN_IN_CANCELLED') && !msg.includes('cancelled')) {
        Alert.alert('구글 로그인 실패', msg || '다시 시도해주세요.');
      }
    } finally {
      setGoogleLoading(false);
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
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>비밀번호</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                ref={passwordRef}
                style={styles.passwordInput}
                placeholder="비밀번호를 입력하세요"
                placeholderTextColor="#B0BEC5"
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>로그인</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.linkText}>
              계정이 없으신가요? <Text style={styles.linkHighlight}>회원가입</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는 소셜 로그인</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* 카카오 로그인 */}
          <TouchableOpacity
            style={[styles.kakaoBtn, kakaoLoading && styles.btnDisabled]}
            onPress={handleKakaoLogin}
            disabled={kakaoLoading}
            activeOpacity={0.85}
          >
            {kakaoLoading
              ? <ActivityIndicator color="#191919" />
              : <Text style={styles.kakaoBtnText}>💬  카카오로 로그인</Text>
            }
          </TouchableOpacity>

          {/* 구글 로그인 */}
          <TouchableOpacity
            style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
            onPress={handleGoogleLogin}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading
              ? <ActivityIndicator color="#3C4043" />
              : (
                <View style={styles.googleBtnInner}>
                  <Text style={styles.googleG}>G</Text>
                  <Text style={styles.googleBtnText}>Google로 로그인</Text>
                </View>
              )
            }
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
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E7EF',
    borderRadius: 12,
    backgroundColor: '#FAFBFD',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2C3E50',
  },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 18 },
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
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E7EF' },
  dividerText: { fontSize: 11, color: '#B0BEC5', fontWeight: '600' },
  // ── 카카오 ──────────────────────────────────────────────────────────
  kakaoBtn: {
    backgroundColor: '#FEE500',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  kakaoBtnText: { color: '#191919', fontSize: 15, fontWeight: '700' },
  // ── 구글 ────────────────────────────────────────────────────────────
  googleBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DADCE0',
  },
  googleBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  googleG: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
    fontFamily: 'serif',
  },
  googleBtnText: { color: '#3C4043', fontSize: 15, fontWeight: '600' },
});
