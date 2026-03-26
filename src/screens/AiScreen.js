import React, {useState} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import {aiAPI} from '../services/api';

const GREEN = '#4CAF50';

export default function AiScreen() {
  const [tab, setTab] = useState('review'); // 'review' | 'recommend'
  const [review, setReview] = useState(null);
  const [recommend, setRecommend] = useState(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [loadingRecommend, setLoadingRecommend] = useState(false);

  const getReview = async () => {
    setLoadingReview(true);
    setReview(null);
    try {
      const res = await aiAPI.review();
      setReview(res.data);
    } catch (err) {
      Alert.alert('오류', err.response?.data?.error || '오늘 식단 기록을 먼저 추가해주세요.');
    } finally {
      setLoadingReview(false);
    }
  };

  const getRecommend = async () => {
    setLoadingRecommend(true);
    setRecommend(null);
    try {
      const res = await aiAPI.recommend();
      setRecommend(res.data);
    } catch (err) {
      Alert.alert('오류', err.response?.data?.error || '오늘 식단 기록을 먼저 추가해주세요.');
    } finally {
      setLoadingRecommend(false);
    }
  };

  const renderStars = (count) => {
    return '⭐'.repeat(count) + '☆'.repeat(5 - count);
  };

  const MEAL_ICONS = {아침: '🌅', 점심: '☀', 저녁: '🌙', 간식: '🍎'};

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* 탭 */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'review' && styles.tabBtnActive]}
          onPress={() => setTab('review')}>
          <Text style={[styles.tabText, tab === 'review' && styles.tabTextActive]}>
            📊 오늘 식단 총평
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'recommend' && styles.tabBtnActive]}
          onPress={() => setTab('recommend')}>
          <Text style={[styles.tabText, tab === 'recommend' && styles.tabTextActive]}>
            📅 내일 식단 추천
          </Text>
        </TouchableOpacity>
      </View>

      {/* 식단 총평 */}
      {tab === 'review' && (
        <View>
          <View style={styles.descCard}>
            <Text style={styles.descText}>
              오늘 먹은 식단을 AI가 분석해서{'\n'}영양 균형과 칼로리를 평가해드립니다
            </Text>
          </View>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={getReview}
            disabled={loadingReview}>
            {loadingReview
              ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.actionBtnText}>  AI 분석 중...</Text>
                </View>
              )
              : <Text style={styles.actionBtnText}>🤖 오늘 식단 분석하기</Text>}
          </TouchableOpacity>

          {review && (
            <View style={styles.resultCard}>
              <Text style={styles.starsText}>{renderStars(review.stars)}</Text>
              <Text style={styles.starsNum}>{review.stars}점 / 5점</Text>
              <Text style={styles.reviewText}>{review.review}</Text>
            </View>
          )}
        </View>
      )}

      {/* 내일 식단 추천 */}
      {tab === 'recommend' && (
        <View>
          <View style={styles.descCard}>
            <Text style={styles.descText}>
              오늘 식단을 바탕으로 내일 하루{'\n'}균형 잡힌 식단을 추천해드립니다
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, {backgroundColor: '#2196F3'}]}
            onPress={getRecommend}
            disabled={loadingRecommend}>
            {loadingRecommend
              ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.actionBtnText}>  AI 추천 중...</Text>
                </View>
              )
              : <Text style={styles.actionBtnText}>🤖 내일 식단 추천받기</Text>}
          </TouchableOpacity>

          {recommend?.meals && (
            <View style={styles.recommendCard}>
              <Text style={styles.recommendTitle}>내일 추천 식단</Text>
              {recommend.meals.map((meal, idx) => (
                <View key={idx} style={styles.mealBlock}>
                  <View style={styles.mealBlockHeader}>
                    <Text style={styles.mealBlockIcon}>{MEAL_ICONS[meal.type] || '🍽'}</Text>
                    <Text style={styles.mealBlockType}>{meal.type}</Text>
                    <Text style={styles.mealBlockKcal}>{meal.kcal} kcal</Text>
                  </View>
                  {meal.foods?.map((food, fidx) => (
                    <Text key={fidx} style={styles.mealBlockFood}>  • {food}</Text>
                  ))}
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>총 칼로리</Text>
                <Text style={styles.totalVal}>
                  {recommend.meals.reduce((s, m) => s + (m.kcal || 0), 0)} kcal
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f0f9f0'},
  content: {padding: 16},
  tabRow: {
    flexDirection: 'row', backgroundColor: '#eee',
    borderRadius: 12, padding: 4, marginBottom: 16,
  },
  tabBtn: {flex: 1, padding: 10, borderRadius: 10, alignItems: 'center'},
  tabBtnActive: {backgroundColor: '#fff', elevation: 2},
  tabText: {color: '#888', fontSize: 13},
  tabTextActive: {color: GREEN, fontWeight: 'bold'},
  descCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 16, borderLeftWidth: 4, borderLeftColor: GREEN,
  },
  descText: {color: '#555', fontSize: 14, lineHeight: 22},
  actionBtn: {
    backgroundColor: GREEN, borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 16,
  },
  actionBtnText: {color: '#fff', fontSize: 15, fontWeight: 'bold'},
  loadingRow: {flexDirection: 'row', alignItems: 'center'},
  resultCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    alignItems: 'center', elevation: 3,
  },
  starsText: {fontSize: 32, marginBottom: 4},
  starsNum: {fontSize: 16, color: '#FF9800', fontWeight: 'bold', marginBottom: 16},
  reviewText: {
    fontSize: 15, color: '#444', lineHeight: 24,
    textAlign: 'center',
  },
  recommendCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 3,
  },
  recommendTitle: {
    fontSize: 16, fontWeight: 'bold', color: '#333',
    marginBottom: 16,
  },
  mealBlock: {
    marginBottom: 14, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  mealBlockHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 6},
  mealBlockIcon: {fontSize: 18, marginRight: 6},
  mealBlockType: {flex: 1, fontSize: 15, fontWeight: 'bold', color: '#333'},
  mealBlockKcal: {fontSize: 14, color: GREEN, fontWeight: '600'},
  mealBlockFood: {fontSize: 13, color: '#555', marginVertical: 2, marginLeft: 8},
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee',
  },
  totalLabel: {fontSize: 15, fontWeight: 'bold', color: '#333'},
  totalVal: {fontSize: 15, fontWeight: 'bold', color: GREEN},
});
