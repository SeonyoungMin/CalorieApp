/**
 * 소셜 로그인 서비스 (카카오 / 구글)
 *
 * 흐름:
 *   1. SDK → 소셜 토큰 획득
 *   2. 백엔드 /auth/kakao or /auth/google 으로 토큰 전달
 *   3. 백엔드가 세션 생성 → Set-Cookie: JSESSIONID (api.ts interceptor가 캡처)
 *   4. AsyncStorage에 SOCIAL_TYPE 저장 (자동로그인 구분용)
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { kakaoLogin as kakaoSocialLogin, googleLogin as googleSocialLogin } from '../api/api';

// ── 플랫폼별 SDK import (웹은 webpack alias로 mock 처리됨) ─────────────────
let kakaoLogin: (() => Promise<{ accessToken: string }>) | null = null;
let GoogleSignin: any = null;
let statusCodes: any = null;

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const kakaoModule = require('@react-native-seoul/kakao-login');
  kakaoLogin = kakaoModule.login;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const googleModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleModule.GoogleSignin;
  statusCodes = googleModule.statusCodes;
}

export const SOCIAL_TYPE_KEY = '@social_type'; // 'kakao' | 'google' | null

// ── 카카오 로그인 ────────────────────────────────────────────────────────────

export async function signInWithKakao(): Promise<void> {
  if (!kakaoLogin) throw new Error('카카오 로그인은 모바일 앱에서만 지원됩니다.');

  const token = await kakaoLogin();
  if (!token?.accessToken) throw new Error('카카오 토큰 획득 실패');

  // 백엔드로 토큰 전달 → JSESSIONID 세션 생성
  await kakaoSocialLogin(token.accessToken);
  await AsyncStorage.setItem(SOCIAL_TYPE_KEY, 'kakao');

  // 소셜 유저는 AUTO_EMAIL/PWD 방식 자동로그인 없음 — 기존 키 삭제
  await AsyncStorage.removeItem('AUTO_EMAIL');
  await AsyncStorage.removeItem('AUTO_PWD');
}

// ── 구글 로그인 ─────────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<void> {
  if (!GoogleSignin) throw new Error('구글 로그인은 모바일 앱에서만 지원됩니다.');

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const userInfo = await GoogleSignin.signIn();
  const idToken: string | null = userInfo?.idToken ?? userInfo?.data?.idToken ?? null;
  if (!idToken) throw new Error('구글 ID 토큰 획득 실패');

  await googleSocialLogin(idToken);
  await AsyncStorage.setItem(SOCIAL_TYPE_KEY, 'google');

  await AsyncStorage.removeItem('AUTO_EMAIL');
  await AsyncStorage.removeItem('AUTO_PWD');
}

// ── 소셜 로그아웃 ────────────────────────────────────────────────────────────

export async function signOutSocial(): Promise<void> {
  const socialType = await AsyncStorage.getItem(SOCIAL_TYPE_KEY);

  try {
    if (socialType === 'google' && GoogleSignin) {
      await GoogleSignin.signOut();
    }
    // 카카오는 SDK 로그아웃 생략 (백엔드 세션 무효화로 충분)
  } catch (_) {}

  await AsyncStorage.removeItem(SOCIAL_TYPE_KEY);
}

// ── 소셜 유저 여부 확인 ──────────────────────────────────────────────────────

export async function isSocialUser(): Promise<boolean> {
  const val = await AsyncStorage.getItem(SOCIAL_TYPE_KEY);
  return val === 'kakao' || val === 'google';
}
