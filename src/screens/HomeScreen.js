import React, {useState, useEffect, useContext, useCallback} from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {mealAPI, waterAPI, workoutAPI, authAPI} from '../services/api';
import {AuthContext} from '../../App';

const GREEN = '#4CAF50';

export default function HomeScreen({navigation}) {
  const {setIsLoggedIn} = useContext(AuthContext);
  const [user, setUser] = useState(null);
  const [meals, setMeals] = useState([]);
  const [water, setWater] = useState(0);
  const [workouts, setWorkouts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [profileRes, mealRes, waterRes, workoutRes] = await Promise.all([
        authAPI.getProfile().catch(() => ({data: null})),
        mealAPI.getToday().catch(() => ({data: []})),
        waterAPI.getToday().catch(() => ({data: {totalMl: 0}})),
        workoutAPI.getToday().catch(() => ({data: []})),
      ]);
      setUser(profileRes.data);
      setMeals(Array.isArray(mealRes.data) ? mealRes.data : []);
      setWater(waterRes.data?.totalMl || 0);
      setWorkouts(Array.isArray(workoutRes.data) ? workoutRes.data : []);
    } catch (err) {
      console.log('데이터 로드 오류:', err.message);
    }
  };

  useFocusEffect(useCallback(() => {
    loadData();
  }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      {text: '취소', style: 'cancel'},
      {
        text: '확인', onPress: async () => {
          await authAPI.logout().catch(() => {});
          setIsLoggedIn(false);
        },
      },
    ]);
  };

  // 통계 계산
  const totalKcal = meals.reduce((s, m) => s + (m.totalKcal || 0), 0);
  const burnedKcal = workouts.reduce((s, w) => s + (w.burnedKcal || 0), 0);
  const netKcal = totalKcal - burnedKcal;
  const goalKcal = user?.goalKcal || 2000;
  const progress = Math.min(netKcal / goalKcal, 1);
  const progressColor = progress > 1 ? '#f44336' : progress > 0.8 ? '#FF9800' : GREEN;

  const today = new Date().toLocaleDateString('ko-KR', {month: 'long', day: 'numeric', weekday: 'short'});

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>안녕하세요, {user?.nickname || '사용자'}님 👋</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      {/* 칼로리 링 */}
      <View style={styles.kcalCard}>
        <Text style={styles.kcalLabel}>오늘의 칼로리</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {width: `${progress * 100}%`, backgroundColor: progressColor}]} />
        </View>
        <View style={styles.kcalRow}>
          <View style={styles.kcalItem}>
            <Text style={styles.kcalNum}>{totalKcal}</Text>
            <Text style={styles.kcalSub}>섭취 kcal</Text>
          </View>
          <View style={styles.kcalItem}>
            <Text style={[styles.kcalNum, {color: '#f44336'}]}>-{burnedKcal}</Text>
            <Text style={styles.kcalSub}>소모 kcal</Text>
          </View>
          <View style={styles.kcalItem}>
            <Text style={[styles.kcalNum, {color: progressColor}]}>{netKcal}</Text>
            <Text style={styles.kcalSub}>순 섭취</Text>
          </View>
          <View style={styles.kcalItem}>
            <Text style={styles.kcalNum}>{goalKcal}</Text>
            <Text style={styles.kcalSub}>목표</Text>
          </View>
        </View>
      </View>

      {/* 빠른 메뉴 */}
      <Text style={styles.sectionTitle}>빠른 메뉴</Text>
      <View style={styles.quickGrid}>
        {[
          {icon: '⚖', label: '체중 기록', screen: 'Weight'},
          {icon: '🏃', label: '운동 기록', screen: 'Workout'},
          {icon: '👤', label: '내 프로필', screen: 'Profile'},
        ].map(item => (
          <TouchableOpacity
            key={item.label}
            style={styles.quickBtn}
            onPress={() => navigation.navigate(item.screen)}>
            <Text style={styles.quickIcon}>{item.icon}</Text>
            <Text style={styles.quickLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 오늘 요약 */}
      <Text style={styles.sectionTitle}>오늘 요약</Text>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, {backgroundColor: '#e3f2fd'}]}>
          <Text style={styles.summaryIcon}>💧</Text>
          <Text style={styles.summaryVal}>{(water / 1000).toFixed(1)}L</Text>
          <Text style={styles.summarySub}>물 섭취</Text>
        </View>
        <View style={[styles.summaryCard, {backgroundColor: '#fce4ec'}]}>
          <Text style={styles.summaryIcon}>🏃</Text>
          <Text style={styles.summaryVal}>{workouts.length}회</Text>
          <Text style={styles.summarySub}>운동</Text>
        </View>
        <View style={[styles.summaryCard, {backgroundColor: '#f3e5f5'}]}>
          <Text style={styles.summaryIcon}>🍽</Text>
          <Text style={styles.summaryVal}>{meals.length}끼</Text>
          <Text style={styles.summarySub}>식사</Text>
        </View>
      </View>

      {/* 오늘 식단 목록 */}
      {meals.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>오늘 식단</Text>
          {meals.map((meal, idx) => (
            <View key={idx} style={styles.mealItem}>
              <Text style={styles.mealType}>{meal.mealType}</Text>
              <Text style={styles.mealFoods}>
                {meal.foods?.map(f => f.foodName).join(', ') || '-'}
              </Text>
              <Text style={styles.mealKcal}>{meal.totalKcal} kcal</Text>
            </View>
          ))}
        </>
      )}

      <View style={{height: 24}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f0f9f0'},
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: GREEN,
  },
  greeting: {fontSize: 18, fontWeight: 'bold', color: '#fff'},
  date: {fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2},
  logoutBtn: {backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 8},
  logoutText: {color: '#fff', fontSize: 13},
  kcalCard: {
    margin: 16, backgroundColor: '#fff', borderRadius: 16,
    padding: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
  },
  kcalLabel: {fontSize: 15, fontWeight: '600', color: '#444', marginBottom: 12},
  progressBar: {
    height: 12, backgroundColor: '#eee', borderRadius: 6, marginBottom: 16, overflow: 'hidden',
  },
  progressFill: {height: '100%', borderRadius: 6},
  kcalRow: {flexDirection: 'row', justifyContent: 'space-around'},
  kcalItem: {alignItems: 'center'},
  kcalNum: {fontSize: 18, fontWeight: 'bold', color: '#333'},
  kcalSub: {fontSize: 11, color: '#888', marginTop: 2},
  sectionTitle: {
    fontSize: 16, fontWeight: 'bold', color: '#333',
    marginLeft: 16, marginTop: 8, marginBottom: 8,
  },
  quickGrid: {flexDirection: 'row', paddingHorizontal: 12},
  quickBtn: {
    flex: 1, margin: 4, backgroundColor: '#fff', borderRadius: 12,
    padding: 16, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06,
  },
  quickIcon: {fontSize: 28, marginBottom: 6},
  quickLabel: {fontSize: 12, color: '#555', textAlign: 'center'},
  summaryRow: {flexDirection: 'row', paddingHorizontal: 12, marginBottom: 8},
  summaryCard: {
    flex: 1, margin: 4, borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  summaryIcon: {fontSize: 24, marginBottom: 4},
  summaryVal: {fontSize: 18, fontWeight: 'bold', color: '#333'},
  summarySub: {fontSize: 11, color: '#666', marginTop: 2},
  mealItem: {
    marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff',
    borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center',
    elevation: 1,
  },
  mealType: {
    fontSize: 13, fontWeight: 'bold', color: GREEN,
    width: 40, marginRight: 8,
  },
  mealFoods: {flex: 1, fontSize: 13, color: '#555'},
  mealKcal: {fontSize: 13, fontWeight: '600', color: '#333'},
});
