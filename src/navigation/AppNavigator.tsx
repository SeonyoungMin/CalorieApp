import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useAuth } from '../context/AuthContext';

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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const COLORS = {
  primary: '#FF6B6B',
  secondary: '#4ECDC4',
  bg: '#F0F4F8',
  text: '#2C3E50',
  inactive: '#B0BEC5',
};

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
        tabBarIcon: ({ color }) => {
          const icons: Record<string, string> = {
            Home: '🏠',
            Meal: '🍽️',
            Workout: '💪',
            Weight: '⚖️',
            More: '☰',
          };
          return <Text style={{ fontSize: 20, color }}>{icons[route.name] ?? '●'}</Text>;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈' }} />
      <Tab.Screen name="Meal" component={MealScreen} options={{ title: '식사' }} />
      <Tab.Screen name="Workout" component={WorkoutScreen} options={{ title: '운동 기록' }} />
      <Tab.Screen name="Weight" component={WeightScreen} options={{ title: '체중기록' }} />
      <Tab.Screen name="More" component={MoreStack} options={{ title: '더보기' }} />
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
