import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../theme';

interface MealCarryItem {
  label: string;
  emoji: string;
  goal: number;         // 유효 목표 (기본 + 이월)
  eaten: number;        // 실제 섭취
  carry: number;        // 이월될 칼로리 (다음 끼니로)
}

interface Props {
  items: MealCarryItem[];
  onSettingsPress: () => void;
}

function MealRow({ item }: { item: MealCarryItem }) {
  const remaining = item.goal - item.eaten;
  const isOver = remaining < 0;
  const pct = item.goal > 0 ? Math.min(item.eaten / item.goal, 1) : 0;
  const barColor = isOver ? COLORS.primary : pct >= 0.85 ? COLORS.warning : COLORS.success;

  const statusText = isOver
    ? `${Math.abs(remaining)}kcal 초과했어요 `
    : remaining === 0
    ? '딱 맞게 드셨어요! '
    : `${remaining}kcal 남았어요 — 세이프!`;

  const recommendations = getRecommendations(remaining);

  return (
    <View style={styles.mealRow}>
      <View style={styles.mealHeader}>
        <Text style={styles.mealEmoji}>{item.emoji}</Text>
        <Text style={styles.mealLabel}>{item.label}</Text>
        <Text style={[styles.mealGoal, isOver && { color: COLORS.primary }]}>
          {item.eaten} / {item.goal} kcal
        </Text>
      </View>

      {/* 게이지바 */}
      <View style={styles.gaugeBg}>
        <View style={[styles.gaugeFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>

      {/* 상태 텍스트 */}
      <Text style={[styles.statusText, isOver && styles.statusOver]}>{statusText}</Text>

      {/* 이월 뱃지 */}
      {!isOver && item.carry > 0 && (
        <View style={styles.carryBadge}>
          <Text style={styles.carryBadgeText}>{item.carry}kcal 다음 끼니로 이월</Text>
        </View>
      )}

      {/* 추천 메뉴 */}
      {recommendations.length > 0 && (
        <View style={styles.recoWrap}>
          {recommendations.map((r, i) => (
            <Text key={i} style={[styles.recoItem, isOver && styles.recoOver]}>• {r}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

function getRecommendations(remaining: number): string[] {
  if (remaining < 0) {
    const over = Math.abs(remaining);
    if (over >= 500) return ['걷기 1시간 (약 300kcal)', '자전거 45분 (약 350kcal)', '수영 30분 (약 250kcal)'];
    if (over >= 200) return ['빠르게 걷기 40분', '가벼운 스트레칭 20분', '계단 오르내리기 15분'];
    return ['10분 산책으로 가볍게 소모해요', '스트레칭으로 마무리해요'];
  }
  if (remaining >= 700) return ['닭가슴살 샐러드 (약 350kcal)', '비빔밥 1그릇 (약 500kcal)', '파스타 소식 (약 400kcal)'];
  if (remaining >= 400) return ['삶은 달걀 2개 + 과일', '그릭 요거트 + 견과류', '두부김치 소식'];
  if (remaining >= 200) return ['바나나 1개 + 아몬드 10알', '사과 1개 + 무지방 우유', '오이 & 당근 스틱'];
  if (remaining >= 50)  return ['과일 조금', '물 한 잔으로 마무리', '아몬드 5~6알'];
  return [];
}

export default function CarryOverCard({ items, onSettingsPress }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>끼니별 칼로리 이월</Text>
        <TouchableOpacity onPress={onSettingsPress} style={styles.settingsBtn}>
          <Text style={styles.settingsText}>목표 설정</Text>
        </TouchableOpacity>
      </View>
      {items.map((item) => (
        <MealRow key={item.label} item={item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  settingsBtn: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 18, paddingHorizontal: 18, paddingVertical: 5,
  },
  settingsText: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
  mealRow: { marginBottom: 18 },
  mealHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6,
  },
  mealEmoji: { fontSize: 19 },
  mealLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 },
  mealGoal: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  gaugeBg: {
    height: 10, backgroundColor: '#F0E1EC', borderRadius: 12,
    overflow: 'hidden', marginBottom: 6,
  },
  gaugeFill: { height: '100%', borderRadius: 12 },
  statusText: { fontSize: 14, color: COLORS.success, fontWeight: '600', marginBottom: 4 },
  statusOver: { color: COLORS.primary },
  carryBadge: {
    backgroundColor: '#E6DAF5', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 4,
    alignSelf: 'flex-start', marginBottom: 6,
  },
  carryBadgeText: { fontSize: 13, color: '#1565C0', fontWeight: '600' },
  recoWrap: { marginTop: 2 },
  recoItem: { fontSize: 13, color: '#546E7A', lineHeight: 18 },
  recoOver: { color: COLORS.secondary },
});
