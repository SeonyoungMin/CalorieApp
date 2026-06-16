/**
 * RegisterScreen UI Tests
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Text, TextInput, TouchableOpacity } from 'react-native';

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

const mockRegister = jest.fn();
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn(),
    register: mockRegister,
    logout: jest.fn(),
    isLoggedIn: false,
    isLoading: false,
  }),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack };

import RegisterScreen from '../src/screens/auth/RegisterScreen';

// ── Tests ──────────────────────────────────────────────────────────────────
describe('RegisterScreen UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. 화면이 정상 렌더링된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <RegisterScreen navigation={mockNavigation} route={{}} />
      );
    });
    expect(renderer!.toJSON()).not.toBeNull();
  });

  test('2. 회원가입 타이틀이 표시된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <RegisterScreen navigation={mockNavigation} route={{}} />
      );
    });
    const texts = renderer!.root.findAllByType(Text);
    const found = texts.some((t: any) => t.props.children === '회원가입');
    expect(found).toBe(true);
  });

  test('3. 4개의 입력 필드가 존재한다 (닉네임, 이메일, 비밀번호, 비밀번호 확인)', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <RegisterScreen navigation={mockNavigation} route={{}} />
      );
    });
    const inputs = renderer!.root.findAllByType(TextInput);
    expect(inputs).toHaveLength(4);
  });

  test('4. 닉네임 입력 필드의 placeholder가 올바르다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <RegisterScreen navigation={mockNavigation} route={{}} />
      );
    });
    const inputs = renderer!.root.findAllByType(TextInput);
    const nicknameInput = inputs.find(
      (i: any) => i.props.placeholder === '사용할 닉네임을 입력하세요'
    );
    expect(nicknameInput).toBeDefined();
  });

  test('5. 비밀번호 필드들이 secureTextEntry를 사용한다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <RegisterScreen navigation={mockNavigation} route={{}} />
      );
    });
    const inputs = renderer!.root.findAllByType(TextInput);
    const secureInputs = inputs.filter((i: any) => i.props.secureTextEntry === true);
    expect(secureInputs).toHaveLength(2);
  });

  test('6. 빈 필드 제출 시 "모든 필드를 입력해주세요" Alert이 나타난다', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <RegisterScreen navigation={mockNavigation} route={{}} />
      );
    });
    const buttons = renderer!.root.findAllByType(TouchableOpacity);
    const registerBtn = buttons.find((b: any) => {
      try {
        return b.findAllByType(Text).some(
          (t: any) => t.props.children === '회원가입'
        );
      } catch {
        return false;
      }
    });
    await ReactTestRenderer.act(async () => {
      registerBtn!.props.onPress();
    });
    expect(alertSpy).toHaveBeenCalledWith('입력 오류', '모든 필드를 입력해주세요.');
    alertSpy.mockRestore();
  });

  test('7. 비밀번호 불일치 시 인라인 오류 텍스트가 표시된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <RegisterScreen navigation={mockNavigation} route={{}} />
      );
    });

    // 비밀번호 입력
    const inputs = renderer!.root.findAllByType(TextInput);
    const pwInput = inputs[2]; // 3번째 = 비밀번호
    const confirmInput = inputs[3]; // 4번째 = 비밀번호 확인

    await ReactTestRenderer.act(async () => {
      pwInput.props.onChangeText('password123');
    });
    await ReactTestRenderer.act(async () => {
      confirmInput.props.onChangeText('different123');
    });

    const texts = renderer!.root.findAllByType(Text);
    const errorText = texts.find(
      (t: any) => t.props.children === '비밀번호가 일치하지 않습니다.'
    );
    expect(errorText).toBeDefined();
  });

  test('8. 비밀번호 일치 시 오류 텍스트가 없다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <RegisterScreen navigation={mockNavigation} route={{}} />
      );
    });

    const inputs = renderer!.root.findAllByType(TextInput);
    const pwInput = inputs[2];
    const confirmInput = inputs[3];

    await ReactTestRenderer.act(async () => {
      pwInput.props.onChangeText('password123');
    });
    await ReactTestRenderer.act(async () => {
      confirmInput.props.onChangeText('password123');
    });

    const texts = renderer!.root.findAllByType(Text);
    const errorText = texts.find(
      (t: any) => t.props.children === '비밀번호가 일치하지 않습니다.'
    );
    expect(errorText).toBeUndefined();
  });

  test('9. 뒤로 버튼이 goBack을 호출한다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <RegisterScreen navigation={mockNavigation} route={{}} />
      );
    });
    const buttons = renderer!.root.findAllByType(TouchableOpacity);
    const backBtn = buttons.find((b: any) => {
      try {
        return b.findAllByType(Text).some(
          (t: any) => typeof t.props.children === 'string' && t.props.children.includes('뒤로')
        );
      } catch {
        return false;
      }
    });
    await ReactTestRenderer.act(async () => {
      backBtn!.props.onPress();
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('10. 로그인 링크가 Login 화면으로 이동한다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <RegisterScreen navigation={mockNavigation} route={{}} />
      );
    });
    const buttons = renderer!.root.findAllByType(TouchableOpacity);
    const loginLinkBtn = buttons.find((b: any) => {
      try {
        return b.findAllByType(Text).some(
          (t: any) => t.props.children === '로그인'
        );
      } catch {
        return false;
      }
    });
    await ReactTestRenderer.act(async () => {
      loginLinkBtn!.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  test('11. 비밀번호 6자 미만 시 Alert이 나타난다', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <RegisterScreen navigation={mockNavigation} route={{}} />
      );
    });

    const inputs = renderer!.root.findAllByType(TextInput);
    await ReactTestRenderer.act(async () => {
      inputs[0].props.onChangeText('테스터');     // 닉네임
      inputs[1].props.onChangeText('a@b.com');    // 이메일
      inputs[2].props.onChangeText('123');         // 비밀번호 (6자 미만)
      inputs[3].props.onChangeText('123');         // 비밀번호 확인
    });

    const buttons = renderer!.root.findAllByType(TouchableOpacity);
    const registerBtn = buttons.find((b: any) => {
      try {
        return b.findAllByType(Text).some(
          (t: any) => t.props.children === '회원가입'
        );
      } catch {
        return false;
      }
    });
    await ReactTestRenderer.act(async () => {
      registerBtn!.props.onPress();
    });
    expect(alertSpy).toHaveBeenCalledWith('비밀번호 오류', '비밀번호는 최소 6자 이상이어야 합니다.');
    alertSpy.mockRestore();
  });
});
