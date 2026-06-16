import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import MealScreen from '../screens/MealScreen';
import WorkoutScreen from '../screens/WorkoutScreen';
import WeightScreen from '../screens/WeightScreen';
import WaterScreen from '../screens/WaterScreen';
import CycleScreen from '../screens/CycleScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MoreMenuScreen from '../screens/MoreMenuScreen';
import AiInsightScreen from '../screens/AiInsightScreen';
import StatsScreen from '../screens/StatsScreen';
import BackupScreen from '../screens/BackupScreen';
import ScanScreen from '../screens/ScanScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import IfCalcScreen from '../screens/IfCalcScreen';
import MealPhotoNotificationScreen from '../screens/MealPhotoNotificationScreen';
import MedicationScreen from '../screens/MedicationScreen';
import DrinkModeScreen from '../screens/DrinkModeScreen';
import CheatDayScreen from '../screens/CheatDayScreen';
import CalendarArchiveScreen from '../screens/CalendarArchiveScreen';
import FriendRequestScreen from '../screens/FriendRequestScreen';
import FriendFeedScreen from '../screens/FriendFeedScreen';
import StoryArchiveScreen from '../screens/StoryArchiveScreen';
import FridgeCleanScreen from '../screens/FridgeCleanScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();


function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          height: 64 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => {
          const labels: Record<string, string> = {
            Home: '홈',
            Meal: '식사',
            Scan: '스캔',
            Workout: '운동',
            More: '더보기',
          };
          if (route.name === 'Scan') {
            return (
              <View style={{
                width: 56, height: 56, borderRadius: 36,
                backgroundColor: focused ? COLORS.primary : COLORS.primary + 'CC',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 2,
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4, shadowRadius: 6, elevation: 6,
              }}>
                <Text style={{ fontSize: 13, color: '#fff', fontWeight: '800' }} numberOfLines={1}>스캔</Text>
              </View>
            );
          }
          return (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12,
                color,
                fontWeight: focused ? '700' : '500',
                textAlign: 'center',
                minWidth: 60,
              }}
            >
              {labels[route.name] ?? ''}
            </Text>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈', tabBarLabel: () => null }} />
      <Tab.Screen name="Meal" component={MealScreen} options={{ title: '식사', tabBarLabel: () => null }} />
      <Tab.Screen name="Scan" component={ScanScreen} options={{ title: '스캔', tabBarLabel: () => null }} />
      <Tab.Screen name="Workout" component={WorkoutScreen} options={{ title: '운동', tabBarLabel: () => null }} />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{ title: '더보기', tabBarLabel: () => null }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // 더보기 탭 안쪽 stack에 화면이 잔존한 채로 다시 탭을 누른 경우,
            // popToTopOnBlur가 동작 안 함(blur 시점에만 작동). 강제 reset.
            const state = navigation.getState();
            const moreIdx = state.routes.findIndex((r) => r.name === 'More');
            const moreRoute = state.routes[moreIdx];
            const hasInnerStack = !!(moreRoute?.state && (moreRoute.state.index ?? 0) > 0);
            if (hasInnerStack) {
              e.preventDefault();
              navigation.dispatch(
                CommonActions.reset({
                  index: moreIdx,
                  routes: state.routes.map((r) =>
                    r.name === 'More'
                      ? { name: 'More', state: { index: 0, routes: [{ name: 'MoreMenu' }] } }
                      : { name: r.name, params: r.params },
                  ),
                }),
              );
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}

const MoreStackNav = createNativeStackNavigator();
function MoreStack() {
  return (
    <MoreStackNav.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitle: '',
        headerBackButtonMenuEnabled: false,
        headerStyle: { backgroundColor: COLORS.bg },
        headerShadowVisible: false,
        headerTintColor: COLORS.primaryDark,
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: COLORS.text },
        headerTitleAlign: 'center',
        popToTopOnBlur: true,
      }}
    >
      <MoreStackNav.Screen name="MoreMenu" component={MoreMenuScreen} options={{ headerShown: false }} />
      <MoreStackNav.Screen name="Water" component={WaterScreen} options={{ title: '물 섭취' }} />
      <MoreStackNav.Screen name="Cycle" component={CycleScreen} options={{ title: '생리주기' }} />
      <MoreStackNav.Screen name="Profile" component={ProfileScreen} options={{ title: '내 정보' }} />
      <MoreStackNav.Screen name="AiInsight" component={AiInsightScreen} options={{ title: 'AI 인사이트' }} />
      <MoreStackNav.Screen name="Stats" component={StatsScreen} options={{ title: '통계' }} />
      <MoreStackNav.Screen name="Backup" component={BackupScreen} options={{ title: '백업' }} />
      <MoreStackNav.Screen name="Weight" component={WeightScreen} options={{ title: '체중 목표' }} />
      <MoreStackNav.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: '알림 설정' }} />
      <MoreStackNav.Screen name="IfCalc" component={IfCalcScreen} options={{ title: '간헐적 단식' }} />
      <MoreStackNav.Screen name="MealPhotoNotification" component={MealPhotoNotificationScreen} options={{ title: '식사 사진 알림' }} />
      <MoreStackNav.Screen name="Medication" component={MedicationScreen} options={{ title: '약 복용 알림' }} />
      <MoreStackNav.Screen name="DrinkMode" component={DrinkModeScreen} options={{ title: '술자리 모드' }} />
      <MoreStackNav.Screen name="CheatDay" component={CheatDayScreen} options={{ title: '치팅데이 코인' }} />
      <MoreStackNav.Screen name="CalendarArchive" component={CalendarArchiveScreen} options={{ title: '포토 다이어리' }} />
      <MoreStackNav.Screen name="FriendFeed" component={FriendFeedScreen} options={{ title: '친구 피드' }} />
      <MoreStackNav.Screen name="StoryArchive" component={StoryArchiveScreen} options={{ title: '스토리 보관함' }} />
      <MoreStackNav.Screen name="FridgeClean" component={FridgeCleanScreen} options={{ title: '냉장고 비우기' }} />
    </MoreStackNav.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="FriendRequest"
            component={FriendRequestScreen}
            options={{ headerShown: true, title: '친구 추가', headerBackTitle: '' }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
});
