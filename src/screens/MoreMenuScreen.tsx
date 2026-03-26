import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import PremiumModal from '../components/PremiumModal';
import { useSubscription } from '../hooks/useSubscription';

const COLORS = {
  primary: '#FF6B6B',
  secondary: '#4ECDC4',
  success: '#51CF66',
  warning: '#FCC419',
  purple: '#9C88FF',
  pink: '#FF8FAB',
  water: '#4FC3F7',
  bg: '#F0F4F8',
  card: '#FFFFFF',
  text: '#2C3E50',
};

const MENU_ITEMS = [
  { emoji: '🤖', label: 'AI 인사이트', desc: '식단분석 · 식단추천 · 운동추천 · 주간리포트', screen: 'AiInsight', color: COLORS.primary, premium: true },
  { emoji: '📊', label: '상세 통계', desc: '영양소 · 캘린더 · 체중 그래프', screen: 'Stats', color: COLORS.secondary, premium: true },
  { emoji: '💧', label: '물 섭취', desc: '오늘 마신 물 기록', screen: 'Water', color: COLORS.water, premium: false },
  { emoji: '🌸', label: '생리주기', desc: '주기 관리 및 예측', screen: 'Cycle', color: COLORS.pink, premium: false },
  { emoji: '👤', label: '내 프로필', desc: '목표 칼로리 · 키 · 체중 설정', screen: 'Profile', color: COLORS.purple, premium: false },
  { emoji: '☁️', label: '클라우드 백업', desc: '내 데이터 내보내기 · 자동 동기화', screen: 'Backup', color: COLORS.success, premium: true },
];

export default function MoreMenuScreen() {
  const navigation = useNavigation<any>();
  const [premiumVisible, setPremiumVisible] = useState(false);
  const { isPremium, activatePremium, cancelPremium } = useSubscription();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>더보기</Text>
      <Text style={styles.subtitle}>건강 관리 메뉴</Text>

      {/* 프리미엄 배너 */}
      <TouchableOpacity
        style={[styles.premiumBanner, isPremium && styles.premiumBannerActive]}
        onPress={() => setPremiumVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.premiumEmoji}>👑</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.premiumTitle}>
            {isPremium ? 'CalorieApp 프리미엄 이용 중' : 'CalorieApp 프리미엄'}
          </Text>
          <Text style={styles.premiumDesc}>
            {isPremium ? 'AI 스캔 무제한 · 모든 기능 이용 가능' : 'AI 스캔 무제한 · 월 3,900원'}
          </Text>
        </View>
        <Text style={styles.premiumArrow}>{isPremium ? '관리' : '›'}</Text>
      </TouchableOpacity>

      <PremiumModal
        visible={premiumVisible}
        onClose={() => setPremiumVisible(false)}
        isPremium={isPremium}
        onSubscribe={async () => { await activatePremium(); setPremiumVisible(false); }}
        onCancel={async () => { await cancelPremium(); setPremiumVisible(false); }}
      />

      {MENU_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.screen}
          style={styles.menuItem}
          onPress={() => {
            if (item.premium && !isPremium) {
              setPremiumVisible(true);
            } else {
              navigation.navigate(item.screen);
            }
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuDesc}>{item.desc}</Text>
          </View>
          {item.premium && !isPremium
            ? <Text style={styles.lockBadge}>👑</Text>
            : <Text style={styles.arrow}>›</Text>
          }
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  subtitle: { fontSize: 14, color: '#78909C', marginTop: 4, marginBottom: 24 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  emoji: { fontSize: 26 },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  menuDesc: { fontSize: 12, color: '#78909C', marginTop: 2 },
  arrow: { fontSize: 24, color: '#B0BEC5', fontWeight: '300' },
  lockBadge: { fontSize: 18 },
  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF8E1', borderRadius: 18, padding: 18, marginBottom: 20,
    borderWidth: 1.5, borderColor: '#FCC419',
  },
  premiumBannerActive: { backgroundColor: '#FFF3E0', borderColor: '#FF6B6B' },
  premiumEmoji: { fontSize: 30 },
  premiumTitle: { fontSize: 15, fontWeight: '800', color: '#2C3E50' },
  premiumDesc: { fontSize: 12, color: '#78909C', marginTop: 2 },
  premiumArrow: { fontSize: 18, color: '#FF6B6B', fontWeight: '700' },
});
