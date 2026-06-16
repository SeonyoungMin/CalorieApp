/**
 * LoginScreen UI Tests
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

const mockLogin = jest.fn();
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: jest.fn(),
    logout: jest.fn(),
    isLoggedIn: false,
    isLoading: false,
  }),
}));

const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate, goBack: jest.fn() };

import LoginScreen from '../src/screens/auth/LoginScreen';

// ── Tests ──────────────────────────────────────────────────────────────────
describe('LoginScreen UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. 화면이 정상 렌더링된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <LoginScreen navigation={mockNavigation} route={{}} />
      );
    });
    const json = renderer!.toJSON();
    expect(json).not.toBeNull();
  });

  test('2. 앱 로고 텍스트(CalorieApp)가 표시된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <LoginScreen navigation={mockNavigation} route={{}} />
      );
    });
    const instance = renderer!.root;
    const texts = instance.findAllByType(require('react-native').Text);
    const textContents = texts.map((t: any) => t.props.children).flat();
    expect(textContents).toContain('CalorieApp');
  });

  test('3. 로그인 카드 제목이 표시된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <LoginScreen navigation={mockNavigation} route={{}} />
      );
    });
    const texts = renderer!.root.findAllByType(require('react-native').Text);
    const found = texts.some((t: any) => t.props.children === '로그인');
    expect(found).toBe(true);
  });

  test('4. 이메일 입력 필드가 존재한다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <LoginScreen navigation={mockNavigation} route={{}} />
      );
    });
    const inputs = renderer!.root.findAllByType(require('react-native').TextInput);
    const emailInput = inputs.find(
      (i: any) => i.props.placeholder === 'example@email.com'
    );
    expect(emailInput).toBeDefined();
    expect(emailInput!.props.keyboardType).toBe('email-address');
    expect(emailInput!.props.autoCapitalize).toBe('none');
  });

  test('5. 비밀번호 입력 필드가 secureTextEntry로 존재한다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <LoginScreen navigation={mockNavigation} route={{}} />
      );
    });
    const inputs = renderer!.root.findAllByType(require('react-native').TextInput);
    const pwInput = inputs.find((i: any) => i.props.secureTextEntry === true);
    expect(pwInput).toBeDefined();
  });

  test('6. 빈 필드 제출 시 Alert이 호출된다', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <LoginScreen navigation={mockNavigation} route={{}} />
      );
    });
    // 로그인 버튼 찾기
    const buttons = renderer!.root.findAllByType(require('react-native').TouchableOpacity);
    const loginBtn = buttons.find((b: any) => {
      const children = b.findAllByType(require('react-native').Text);
      return children.some((t: any) => t.props.children === '로그인');
    });
    await ReactTestRenderer.act(async () => {
      loginBtn!.props.onPress();
    });
    expect(alertSpy).toHaveBeenCalledWith('입력 오류', '이메일과 비밀번호를 입력해주세요.');
    alertSpy.mockRestore();
  });

  test('7. 회원가입 링크 버튼이 존재하며 누르면 Register로 이동한다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <LoginScreen navigation={mockNavigation} route={{}} />
      );
    });
    const texts = renderer!.root.findAllByType(require('react-native').Text);
    const registerText = texts.find((t: any) => t.props.children === '회원가입');
    expect(registerText).toBeDefined();

    // 링크 버튼 찾기
    const buttons = renderer!.root.findAllByType(require('react-native').TouchableOpacity);
    const registerBtn = buttons.find((b: any) => {
      try {
        const children = b.findAllByType(require('react-native').Text);
        return children.some((t: any) => t.props.children === '회원가입');
      } catch {
        return false;
      }
    });
    await ReactTestRenderer.act(async () => {
      registerBtn!.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  test('8. 로그인 버튼이 disabled 아닌 기본 상태이다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <LoginScreen navigation={mockNavigation} route={{}} />
      );
    });
    const buttons = renderer!.root.findAllByType(require('react-native').TouchableOpacity);
    const loginBtn = buttons.find((b: any) => {
      try {
        return b.findAllByType(require('react-native').Text).some(
          (t: any) => t.props.children === '로그인'
        );
      } catch {
        return false;
      }
    });
    expect(loginBtn!.props.disabled).toBeFalsy();
  });

  test('9. 서브타이틀 "건강한 하루를 기록하세요"가 표시된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <LoginScreen navigation={mockNavigation} route={{}} />
      );
    });
    const texts = renderer!.root.findAllByType(require('react-native').Text);
    const found = texts.some((t: any) => t.props.children === '건강한 하루를 기록하세요');
    expect(found).toBe(true);
  });
});
