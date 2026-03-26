/**
 * HomeScreen UI Tests
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// API mock
jest.mock('../src/api/api', () => ({
  getTodayMeals: jest.fn(() =>
    Promise.resolve({
      data: [
        { mealId: 1, mealType: '아침', totalKcal: 400 },
        { mealId: 2, mealType: '점심', totalKcal: 700 },
      ],
    })
  ),
  getTodayWorkouts: jest.fn(() =>
    Promise.resolve({
      data: [{ workoutId: 1, exerciseName: '달리기', kcalBurned: 300 }],
    })
  ),
  getWeeklyStats: jest.fn(() =>
    Promise.resolve({
      data: [
        { date: '2026-03-20', foodKcal: 1800, burnedKcal: 400, netKcal: 1400 },
        { date: '2026-03-21', foodKcal: 2100, burnedKcal: 300, netKcal: 1800 },
      ],
    })
  ),
  getTodayWater: jest.fn(() =>
    Promise.resolve({ data: { totalMl: 1500 } })
  ),
}));

// AuthContext mock
const mockLogout = jest.fn();
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn(),
    register: jest.fn(),
    logout: mockLogout,
    isLoggedIn: true,
    isLoading: false,
  }),
}));

// Navigation mock - useFocusEffect는 useEffect로 래핑하여 렌더 후 실행
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: any) => {
    const React = require('react');
    React.useEffect(cb, []);
  },
}));

// AiScanModal mock
jest.mock('../src/components/AiScanModal', () => {
  const React = require('react');
  return ({ visible }: any) =>
    visible ? React.createElement(require('react-native').View, null) : null;
});

const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate };

import HomeScreen from '../src/screens/HomeScreen';

// ── Tests ──────────────────────────────────────────────────────────────────
describe('HomeScreen UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. 화면이 정상 렌더링된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen navigation={mockNavigation} route={{}} />
      );
    });
    // 비동기 데이터 로딩 완료 대기
    await ReactTestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(renderer!.toJSON()).not.toBeNull();
  });

  test('2. "안녕하세요!" 인사 문구가 표시된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen navigation={mockNavigation} route={{}} />
      );
    });
    await ReactTestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    const texts = renderer!.root.findAllByType(Text);
    const found = texts.some(
      (t: any) =>
        typeof t.props.children === 'string' &&
        t.props.children.includes('안녕하세요')
    );
    expect(found).toBe(true);
  });

  test('3. "오늘의 칼로리" 카드가 표시된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen navigation={mockNavigation} route={{}} />
      );
    });
    await ReactTestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    const texts = renderer!.root.findAllByType(Text);
    const found = texts.some((t: any) => t.props.children === '오늘의 칼로리');
    expect(found).toBe(true);
  });

  test('4. AI 칼로리 스캔 배너가 표시된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen navigation={mockNavigation} route={{}} />
      );
    });
    await ReactTestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    const texts = renderer!.root.findAllByType(Text);
    const found = texts.some(
      (t: any) =>
        typeof t.props.children === 'string' &&
        t.props.children.includes('AI 칼로리 스캔')
    );
    expect(found).toBe(true);
  });

  test('5. 식사/운동/물 섭취 요약 카드가 표시된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen navigation={mockNavigation} route={{}} />
      );
    });
    await ReactTestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    const texts = renderer!.root.findAllByType(Text);
    const textContents = texts.map((t: any) => t.props.children);
    expect(textContents).toContain('식사 기록');
    expect(textContents).toContain('운동 기록');
    expect(textContents).toContain('물 섭취');
  });

  test('6. 식사 기록 수가 API 응답(2건)과 일치한다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen navigation={mockNavigation} route={{}} />
      );
    });
    await ReactTestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    const texts = renderer!.root.findAllByType(Text);
    // 식사 기록 수 = 2
    const found = texts.some((t: any) => t.props.children === 2);
    expect(found).toBe(true);
  });

  test('7. 빠른 메뉴가 표시된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen navigation={mockNavigation} route={{}} />
      );
    });
    await ReactTestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    const texts = renderer!.root.findAllByType(Text);
    const textContents = texts.map((t: any) => t.props.children);
    expect(textContents).toContain('빠른 메뉴');
  });

  test('8. 식사 기록 버튼 클릭 시 Meal 화면으로 이동한다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen navigation={mockNavigation} route={{}} />
      );
    });
    await ReactTestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const buttons = renderer!.root.findAllByType(TouchableOpacity);
    // 식사 기록 summaryCard 찾기
    const mealCard = buttons.find((b: any) => {
      try {
        return b.findAllByType(Text).some(
          (t: any) => t.props.children === '식사 기록'
        );
      } catch {
        return false;
      }
    });
    await ReactTestRenderer.act(async () => {
      mealCard!.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Meal');
  });

  test('9. 운동 기록 버튼 클릭 시 Workout 화면으로 이동한다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen navigation={mockNavigation} route={{}} />
      );
    });
    await ReactTestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const buttons = renderer!.root.findAllByType(TouchableOpacity);
    const workoutCard = buttons.find((b: any) => {
      try {
        return b.findAllByType(Text).some(
          (t: any) => t.props.children === '운동 기록'
        );
      } catch {
        return false;
      }
    });
    await ReactTestRenderer.act(async () => {
      workoutCard!.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Workout');
  });

  test('10. kcal 단위 텍스트가 표시된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen navigation={mockNavigation} route={{}} />
      );
    });
    await ReactTestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    const texts = renderer!.root.findAllByType(Text);
    const found = texts.some((t: any) => t.props.children === 'kcal');
    expect(found).toBe(true);
  });

  test('11. "주간 칼로리" 차트 제목이 표시된다', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen navigation={mockNavigation} route={{}} />
      );
    });
    await ReactTestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    const texts = renderer!.root.findAllByType(Text);
    const found = texts.some((t: any) => t.props.children === '주간 칼로리');
    expect(found).toBe(true);
  });

  test('12. 물 섭취량이 리터 단위로 표시된다 (1500ml → 1.5L)', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen navigation={mockNavigation} route={{}} />
      );
    });
    await ReactTestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    const texts = renderer!.root.findAllByType(Text);
    // JSX에서 {value}L 는 children이 ['1.5', 'L'] 배열로 렌더링됨
    const found = texts.some((t: any) => {
      const c = t.props.children;
      if (Array.isArray(c)) {
        return c.join('') === '1.5L';
      }
      return c === '1.5L';
    });
    expect(found).toBe(true);
  });
});
