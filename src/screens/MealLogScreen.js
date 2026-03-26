import React, {useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {mealAPI} from '../services/api';

const GREEN = '#4CAF50';
const MEAL_COLORS = {아침: '#FF9800', 점심: '#4CAF50', 저녁: '#2196F3', 간식: '#9C27B0'};

export default function MealLogScreen() {
  const [meals, setMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await mealAPI.getToday();
      setMeals(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMeals([]);
    }
  };

  useFocusEffect(useCallback(() => {load();}, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const deleteMeal = (mealId) => {
    Alert.alert('삭제', '이 식사를 삭제하시겠습니까?', [
      {text: '취소', style: 'cancel'},
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try {
            await mealAPI.delete(mealId);
            load();
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const deleteAll = () => {
    Alert.alert('전체 삭제', '오늘의 모든 식사를 삭제하시겠습니까?', [
      {text: '취소', style: 'cancel'},
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try {
            await mealAPI.deleteToday();
            load();
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const totalKcal = meals.reduce((s, m) => s + (m.totalKcal || 0), 0);

  const today = new Date().toLocaleDateString('ko-KR', {month: 'long', day: 'numeric'});

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

      {/* 상단 요약 */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryDate}>{today} 식단</Text>
        <Text style={styles.summaryKcal}>{totalKcal} kcal</Text>
        <Text style={styles.summarySub}>총 {meals.length}끼 기록됨</Text>
        {meals.length > 0 && (
          <TouchableOpacity onPress={deleteAll} style={styles.deleteAllBtn}>
            <Text style={styles.deleteAllText}>전체 삭제</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 식단 목록 */}
      {meals.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🍽</Text>
          <Text style={styles.emptyText}>오늘 식단 기록이 없어요</Text>
          <Text style={styles.emptySub}>스캔 탭에서 음식을 분석하고 추가해보세요!</Text>
        </View>
      ) : (
        meals.map((meal, idx) => (
          <View key={idx} style={styles.mealCard}>
            <View style={styles.mealHeader}>
              <View style={[styles.mealTypeBadge, {backgroundColor: MEAL_COLORS[meal.mealType] || GREEN}]}>
                <Text style={styles.mealTypeBadgeText}>{meal.mealType}</Text>
              </View>
              <Text style={styles.mealKcal}>{meal.totalKcal} kcal</Text>
              <TouchableOpacity onPress={() => deleteMeal(meal.mealId)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {meal.foods?.map((food, fidx) => (
              <View key={fidx} style={styles.foodRow}>
                <Text style={styles.foodName}>• {food.foodName}</Text>
                <Text style={styles.foodKcal}>{food.kcal} kcal</Text>
              </View>
            ))}
          </View>
        ))
      )}

      <View style={{height: 24}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f0f9f0'},
  summaryCard: {
    margin: 16, backgroundColor: GREEN, borderRadius: 16,
    padding: 20, alignItems: 'center',
  },
  summaryDate: {color: 'rgba(255,255,255,0.85)', fontSize: 14},
  summaryKcal: {color: '#fff', fontSize: 36, fontWeight: 'bold', marginVertical: 4},
  summarySub: {color: 'rgba(255,255,255,0.85)', fontSize: 13},
  deleteAllBtn: {
    marginTop: 12, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6,
  },
  deleteAllText: {color: '#fff', fontSize: 13},
  empty: {
    alignItems: 'center', padding: 60,
  },
  emptyIcon: {fontSize: 64, marginBottom: 16},
  emptyText: {fontSize: 16, fontWeight: '600', color: '#555'},
  emptySub: {fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center'},
  mealCard: {
    marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff',
    borderRadius: 14, padding: 16, elevation: 2,
  },
  mealHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
  },
  mealTypeBadge: {
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8,
  },
  mealTypeBadgeText: {color: '#fff', fontSize: 13, fontWeight: 'bold'},
  mealKcal: {flex: 1, fontSize: 16, fontWeight: 'bold', color: '#333'},
  deleteBtn: {padding: 4},
  deleteBtnText: {color: '#f44336', fontSize: 16, fontWeight: 'bold'},
  foodRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4, paddingLeft: 4,
  },
  foodName: {fontSize: 13, color: '#555', flex: 1},
  foodKcal: {fontSize: 13, color: '#888'},
});
