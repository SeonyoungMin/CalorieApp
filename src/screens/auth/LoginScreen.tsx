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
  Modal,
  Clipboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../theme';
import Icon from '../../components/Icon';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../../config/socialConfig';
import { findUserId, resetPasswordByInfo } from '../../api/api';

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

  // 아이디 찾기
  const [findIdModalVisible, setFindIdModalVisible] = useState(false);
  const [findNickname, setFindNickname] = useState('');
  const [findPhone, setFindPhone] = useState('');
  const [findIdLoading, setFindIdLoading] = useState(false);
  const [foundEmails, setFoundEmails] = useState<string[]>([]);

  // 비번 찾기
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetNickname, setResetNickname] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  const handleFindId = async () => {
    const nickname = findNickname.trim();
    const phone = findPhone.trim();
    if (!nickname && !phone) { Alert.alert('알림', '닉네임 또는 전화번호를 입력해주세요.'); return; }
    setFindIdLoading(true);
    setFoundEmails([]);
    try {
      const res = await findUserId({ nickname: nickname || undefined, phone: phone || undefined });
      const emails: string[] = res.data?.emails ?? [];
      setFoundEmails(emails);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? '계정을 찾을 수 없어요.';
      Alert.alert('알림', msg);
    } finally {
      setFindIdLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const e = resetEmail.trim();
    const n = resetNickname.trim();
    const p = resetPhone.trim();
    if (!e) { Alert.alert('알림', '이메일을 입력해주세요.'); return; }
    if (!n && !p) { Alert.alert('알림', '닉네임 또는 전화번호를 입력해주세요.'); return; }
    setResetLoading(true);
    setTempPassword('');
    try {
      const res = await resetPasswordByInfo({ email: e, nickname: n || undefined, phone: p || undefined });
      const tp = res.data?.tempPassword ?? '';
      setTempPassword(tp);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '재설정 실패';
      Alert.alert('알림', msg);
    } finally {
      setResetLoading(false);
    }
  };

  const closeFindIdModal = () => {
    setFindIdModalVisible(false);
    setFindNickname('');
    setFindPhone('');
    setFoundEmails([]);
  };
  const closeResetModal = () => {
    setResetModalVisible(false);
    setResetEmail('');
    setResetNickname('');
    setResetPhone('');
    setTempPassword('');
  };
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
      const serverMsg = e?.response?.data?.message;
      const msg = serverMsg || e?.message || '';
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
      const serverMsg = e?.response?.data?.message;
      const msg = serverMsg || e?.message || '';
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
          <Text style={styles.logoTitle}>쁠마</Text>
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
              placeholderTextColor="#D4C5DC"
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
                placeholderTextColor="#D4C5DC"
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? '' : ''}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.saveIdRow} onPress={() => setSaveId(v => !v)} activeOpacity={0.7}>
            <View style={[styles.checkbox, saveId && styles.checkboxOn]}>
              {saveId && <Icon name="check" size={12} color={"#fff"} />}
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

          <View style={styles.recoveryRow}>
            <TouchableOpacity onPress={() => setFindIdModalVisible(true)}>
              <Text style={styles.recoveryText}>아이디 찾기</Text>
            </TouchableOpacity>
            <Text style={styles.recoveryDivider}>·</Text>
            <TouchableOpacity onPress={() => setResetModalVisible(true)}>
              <Text style={styles.recoveryText}>비밀번호 찾기</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.linkText}>
              계정이 없으신가요? <Text style={styles.linkHighlight}>회원가입</Text>
            </Text>
          </TouchableOpacity>

          {Platform.OS !== 'web' && (
            <>
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
                  : <Text style={styles.kakaoBtnText}> 카카오로 로그인</Text>
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
            </>
          )}
        </View>
      </ScrollView>

      {/* 아이디 찾기 모달 */}
      <Modal visible={findIdModalVisible} transparent animationType="slide" onRequestClose={closeFindIdModal}>
        <View style={recoveryStyles.overlay}>
          <View style={recoveryStyles.sheet}>
            <View style={recoveryStyles.header}>
              <Text style={recoveryStyles.title}>아이디 찾기</Text>
              <TouchableOpacity onPress={closeFindIdModal}>
                <Text style={recoveryStyles.close}></Text>
              </TouchableOpacity>
            </View>
            <Text style={recoveryStyles.label}>닉네임</Text>
            <TextInput
              style={recoveryStyles.input}
              placeholder="가입 시 입력한 닉네임"
              placeholderTextColor="#bbb"
              value={findNickname}
              onChangeText={setFindNickname}
              autoCapitalize="none"
            />
            <Text style={recoveryStyles.label}>또는 전화번호</Text>
            <TextInput
              style={recoveryStyles.input}
              placeholder="01012345678"
              placeholderTextColor="#bbb"
              value={findPhone}
              onChangeText={setFindPhone}
              keyboardType="phone-pad"
              returnKeyType="search"
              onSubmitEditing={handleFindId}
            />
            <TouchableOpacity
              style={[recoveryStyles.btn, findIdLoading && { opacity: 0.6 }]}
              onPress={handleFindId}
              disabled={findIdLoading}
              activeOpacity={0.85}
            >
              {findIdLoading ? <ActivityIndicator color="#fff" /> : <Text style={recoveryStyles.btnText}>찾기</Text>}
            </TouchableOpacity>
            {foundEmails.length > 0 && (
              <View style={recoveryStyles.resultBox}>
                <Text style={recoveryStyles.resultTitle}>가입된 이메일</Text>
                {foundEmails.map((e, i) => (
                  <Text key={i} style={recoveryStyles.resultEmail}>{e}</Text>
                ))}
                <Text style={recoveryStyles.hint}>* 보안을 위해 일부 문자가 가려져요</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 비번 찾기 모달 */}
      <Modal visible={resetModalVisible} transparent animationType="slide" onRequestClose={closeResetModal}>
        <View style={recoveryStyles.overlay}>
          <View style={recoveryStyles.sheet}>
            <View style={recoveryStyles.header}>
              <Text style={recoveryStyles.title}>비밀번호 찾기</Text>
              <TouchableOpacity onPress={closeResetModal}>
                <Text style={recoveryStyles.close}></Text>
              </TouchableOpacity>
            </View>
            <Text style={recoveryStyles.label}>이메일</Text>
            <TextInput
              style={recoveryStyles.input}
              placeholder="가입 이메일"
              placeholderTextColor="#bbb"
              value={resetEmail}
              onChangeText={setResetEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={recoveryStyles.label}>닉네임</Text>
            <TextInput
              style={recoveryStyles.input}
              placeholder="가입 시 입력한 닉네임"
              placeholderTextColor="#bbb"
              value={resetNickname}
              onChangeText={setResetNickname}
              autoCapitalize="none"
            />
            <Text style={recoveryStyles.label}>또는 전화번호</Text>
            <TextInput
              style={recoveryStyles.input}
              placeholder="01012345678"
              placeholderTextColor="#bbb"
              value={resetPhone}
              onChangeText={setResetPhone}
              keyboardType="phone-pad"
              returnKeyType="send"
              onSubmitEditing={handleResetPassword}
            />
            <TouchableOpacity
              style={[recoveryStyles.btn, resetLoading && { opacity: 0.6 }]}
              onPress={handleResetPassword}
              disabled={resetLoading}
              activeOpacity={0.85}
            >
              {resetLoading ? <ActivityIndicator color="#fff" /> : <Text style={recoveryStyles.btnText}>임시 비밀번호 발급</Text>}
            </TouchableOpacity>
            {tempPassword !== '' && (
              <View style={recoveryStyles.resultBox}>
                <Text style={recoveryStyles.resultTitle}>임시 비밀번호</Text>
                <Text style={recoveryStyles.tempPwd}>{tempPassword}</Text>
                <TouchableOpacity
                  style={recoveryStyles.copyBtn}
                  onPress={() => {
                    Clipboard.setString(tempPassword);
                    Alert.alert('복사됨', '임시 비밀번호가 클립보드에 복사됐어요.');
                  }}
                >
                  <Text style={recoveryStyles.copyBtnText}>복사</Text>
                </TouchableOpacity>
                <Text style={recoveryStyles.hint}>* 로그인 후 더보기 → 내 프로필에서 비밀번호를 변경해주세요</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoEmoji: { fontSize: 64 },
  logoTitle: { fontSize: 32, fontWeight: '800', color: COLORS.primary, marginTop: 8 },
  logoSub: { fontSize: 16, color: '#8A7C9C', marginTop: 4 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  inputWrap: { marginBottom: 16 },
  label: { fontSize: 15, fontWeight: '600', color: '#8A7C9C', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#F0E1EC',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 15,
    fontSize: 17,
    color: COLORS.text,
    backgroundColor: '#FBF4F9',
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F0E1EC',
    borderRadius: 20,
    backgroundColor: '#FBF4F9',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 22,
    paddingVertical: 15,
    fontSize: 17,
    color: '#4A3A5C',
  },
  eyeBtn: { paddingHorizontal: 20 },
  eyeText: { fontSize: 19 },
  saveIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: -4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D4C5DC',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 16 },
  saveIdLabel: { fontSize: 16, color: '#8A7C9C' },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 22,
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
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  linkBtn: { marginTop: 20, alignItems: 'center' },
  linkText: { fontSize: 16, color: '#8A7C9C' },
  linkHighlight: { color: COLORS.primary, fontWeight: '700' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#F0E1EC' },
  dividerText: { fontSize: 13, color: '#D4C5DC', fontWeight: '600' },
  // ── 카카오 ──────────────────────────────────────────────────────────
  kakaoBtn: {
    backgroundColor: '#FEE500',
    borderRadius: 22,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 12,
  },
  kakaoBtnText: { color: '#191919', fontSize: 17, fontWeight: '700' },
  // ── 구글 ────────────────────────────────────────────────────────────
  googleBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DADCE0',
  },
  googleBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  googleG: {
    fontSize: 19,
    fontWeight: '700',
    color: '#4285F4',
    fontFamily: 'serif',
  },
  googleBtnText: { color: '#3C4043', fontSize: 17, fontWeight: '600' },
  recoveryRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 14, marginBottom: 4 },
  recoveryText: { fontSize: 15, color: '#8A7C9C', fontWeight: '600' },
  recoveryDivider: { fontSize: 15, color: '#CFD8DC' },
});

const recoveryStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: 72 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 19, fontWeight: '800', color: '#4A3A5C' },
  close: { fontSize: 22, color: '#aaa' },
  label: { fontSize: 15, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1.5, borderColor: '#F0E1EC', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 15, fontSize: 17,
    color: '#4A3A5C', backgroundColor: '#FBF4F9', marginBottom: 12,
  },
  btn: { backgroundColor: COLORS.primary, borderRadius: 22, paddingVertical: 17, alignItems: 'center', marginTop: 4 },
  btnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  resultBox: { marginTop: 18, padding: 14, backgroundColor: '#F7F9FC', borderRadius: 20 },
  resultTitle: { fontSize: 15, fontWeight: '700', color: '#666', marginBottom: 8 },
  resultEmail: { fontSize: 17, fontWeight: '600', color: COLORS.primary, marginVertical: 2 },
  tempPwd: { fontSize: 22, fontWeight: '800', color: COLORS.primary, letterSpacing: 2, textAlign: 'center', paddingVertical: 11 },
  copyBtn: { backgroundColor: COLORS.primary, borderRadius: 18, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  copyBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  hint: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 10 },
});
