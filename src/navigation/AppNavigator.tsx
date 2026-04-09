import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => {
          const icons: Record<string, string> = {
            Home: '🏠',
            Meal: '🍽️',
            Scan: '📷',
            Workout: '💪',
            More: '☰',
          };
          if (route.name === 'Scan') {
            return (
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: focused ? COLORS.primary : COLORS.primary + 'CC',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 2,
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4, shadowRadius: 6, elevation: 6,
              }}>
                <Text style={{ fontSize: 18 }}>📷</Text>
                <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700', marginTop: 1 }}>스캔</Text>
              </View>
            );
          }
          return <Text style={{ fontSize: 20, color }}>{icons[route.name] ?? '●'}</Text>;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈' }} />
      <Tab.Screen name="Meal" component={MealScreen} options={{ title: '식사' }} />
      <Tab.Screen name="Scan" component={ScanScreen} options={{ title: '스캔', tabBarLabel: () => null }} />
      <Tab.Screen name="Workout" component={WorkoutScreen} options={{ title: '운동' }} />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{ title: '더보기', unmountOnBlur: true }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('More', { screen: 'MoreMenu' });
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
        headerStyle: { backgroundColor: '#F0F4F8' },
        headerShadowVisible: false,
        headerTintColor: COLORS.primary,
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: '#2C3E50' },
        headerTitleAlign: 'center',
      }}
    >
      <MoreStackNav.Screen name="MoreMenu" component={MoreMenuScreen} options={{ headerShown: false }} />
      <MoreStackNav.Screen name="Water" component={WaterScreen} options={{ title: '💧 물 섭취' }} />
      <MoreStackNav.Screen name="Cycle" component={CycleScreen} options={{ title: '🌸 생리주기' }} />
      <MoreStackNav.Screen name="Profile" component={ProfileScreen} options={{ title: '👤 내 정보' }} />
      <MoreStackNav.Screen name="AiInsight" component={AiInsightScreen} options={{ title: '🤖 AI 인사이트' }} />
      <MoreStackNav.Screen name="Stats" component={StatsScreen} options={{ title: '📊 통계' }} />
      <MoreStackNav.Screen name="Backup" component={BackupScreen} options={{ title: '💾 백업' }} />
      <MoreStackNav.Screen name="Weight" component={WeightScreen} options={{ title: '⚖️ 체중 목표' }} />
      <MoreStackNav.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: '🔔 알림 설정' }} />
      <MoreStackNav.Screen name="IfCalc" component={IfCalcScreen} options={{ title: '⏱️ 간헐적 단식' }} />
      <MoreStackNav.Screen name="MealPhotoNotification" component={MealPhotoNotificationScreen} options={{ title: '📷 식사 사진 알림' }} />
      <MoreStackNav.Screen name="Medication" component={MedicationScreen} options={{ title: '💊 약 복용 알림' }} />
      <MoreStackNav.Screen name="DrinkMode" component={DrinkModeScreen} options={{ title: '🍺 술자리 모드' }} />
      <MoreStackNav.Screen name="CheatDay" component={CheatDayScreen} options={{ title: '🪙 치팅데이 코인' }} />
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
        <Stack.Screen name="Main" component={MainTabs} />
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
    backgroundColor: '#F0F4F8',
  },
});
