import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();


function MainTabs() {
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
          height: 62,
          paddingBottom: 8,
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
    <MoreStackNav.Navigator screenOptions={{ headerShown: false }}>
      <MoreStackNav.Screen name="MoreMenu" component={MoreMenuScreen} />
      <MoreStackNav.Screen name="Water" component={WaterScreen} />
      <MoreStackNav.Screen name="Cycle" component={CycleScreen} />
      <MoreStackNav.Screen name="Profile" component={ProfileScreen} />
      <MoreStackNav.Screen name="AiInsight" component={AiInsightScreen} />
      <MoreStackNav.Screen name="Stats" component={StatsScreen} />
      <MoreStackNav.Screen name="Backup" component={BackupScreen} />
      <MoreStackNav.Screen name="Weight" component={WeightScreen} />
      <MoreStackNav.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
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
