import React, { useState, useRef } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../theme';

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const emailRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);
  const confirmRef = useRef<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || !nickname.trim()) {
      Alert.alert('입력 오류', '모든 필드를 입력해주세요.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      Alert.alert('입력 오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('비밀번호 불일치', '비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('비밀번호 오류', '비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, nickname.trim(), phone.trim() || undefined);
      Alert.alert('회원가입 완료', '회원가입이 완료되었습니다. 로그인해주세요.', [
        { text: '확인', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (e: any) {
      Alert.alert('회원가입 실패', e?.response?.data?.message || '다시 시도해주세요.');
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
        {/* Header */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>

        <View style={styles.logoWrap}>
          
          <Text style={styles.logoTitle}>회원가입</Text>
          <Text style={styles.logoSub}>쁠마와 함께 건강을 관리하세요</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputWrap}>
            <Text style={styles.label}>닉네임</Text>
            <TextInput
              style={styles.input}
              placeholder="사용할 닉네임을 입력하세요"
              placeholderTextColor="#D4C5DC"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              value={nickname}
              onChangeText={setNickname}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              ref={emailRef}
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
                placeholder="6자 이상 입력하세요"
                placeholderTextColor="#D4C5DC"
                secureTextEntry={!showPassword}
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? '' : ''}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>전화번호 <Text style={{ color: '#D4C5DC', fontSize: 13 }}>(선택, 아이디/비번 찾기에 사용)</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="01012345678"
              placeholderTextColor="#D4C5DC"
              keyboardType="phone-pad"
              returnKeyType="next"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>비밀번호 확인</Text>
            <View style={[
              styles.passwordWrap,
              confirmPassword.length > 0 &&
                (password === confirmPassword ? styles.inputSuccess : styles.inputError),
            ]}>
              <TextInput
                ref={confirmRef}
                style={styles.passwordInput}
                placeholder="비밀번호를 다시 입력하세요"
                placeholderTextColor="#D4C5DC"
                secureTextEntry={!showConfirm}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showConfirm ? '' : ''}</Text>
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={styles.errorText}>비밀번호가 일치하지 않습니다.</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>회원가입</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.linkText}>
              이미 계정이 있으신가요? <Text style={styles.linkHighlight}>로그인</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: 24 },
  backBtn: { marginTop: 8, marginBottom: 4 },
  backText: { fontSize: 17, color: COLORS.primary, fontWeight: '600' },
  logoWrap: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  logoEmoji: { fontSize: 52 },
  logoTitle: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  logoSub: { fontSize: 15, color: '#8A7C9C', marginTop: 4, textAlign: 'center' },
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
  inputSuccess: { borderColor: '#A8D8B9' },
  inputError: { borderColor: '#F5A3B0' },
  errorText: { fontSize: 14, color: '#F5A3B0', marginTop: 4 },
  btn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 22,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.secondary,
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
});
