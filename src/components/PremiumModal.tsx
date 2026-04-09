import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert,
} from 'react-native';
import { COLORS } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  isPremium?: boolean;
  onCancel?: () => void;
}

const FEATURES = [
  { emoji: '🤖', text: 'AI 칼로리 스캔 무제한' },
  { emoji: '🍽️', text: 'AI 맞춤 식단 추천' },
  { emoji: '💪', text: 'AI 운동 루틴 추천' },
  { emoji: '📋', text: 'AI 식단 분석 & 피드백' },
  { emoji: '📊', text: 'AI 주간 리포트 & 상세 통계' },
  { emoji: '🧮', text: '만약에 계산기 — 음식·운동별 목표일 변화 시뮬레이션' },
  { emoji: '💊', text: '약 복용 알림 — 매일 약 챙기기 & 복용 체크' },
  { emoji: '🪙', text: '치팅데이 코인 — 7일 연속 달성 → 코인 → 치팅데이 1회' },
  { emoji: '⚖️', text: '홈 인사이트 카드 — 목표 D-day · BMI · 연속달성 · 코인' },
  { emoji: '🗓️', text: '월간 캘린더 & 영양소 분석' },
  { emoji: '📉', text: '체중 변화 그래프 & 목표일 예측' },
  { emoji: '☁️', text: 'AI 건강 리포트 내보내기 & 클라우드 백업' },
];

export default function PremiumModal({ visible, onClose, onSubscribe, isPremium, onCancel }: Props) {
  const handleSubscribe = () => {
    // TODO: 실제 결제 연동 (아임포트, Stripe 등)
    Alert.alert(
      '프리미엄 구독',
      '월 3,900원으로 모든 기능을 무제한 이용하시겠습니까?\n\n※ 구독 후 서비스를 이용하신 경우 환불이 제한될 수 있습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '구독하기',
          onPress: () => {
            onSubscribe();
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      '구독 취소',
      '프리미엄 구독을 취소하시겠습니까?\n취소 후 무료 한도 이후 스캔이 제한됩니다.',
      [
        { text: '유지하기', style: 'cancel' },
        { text: '취소하기', style: 'destructive', onPress: onCancel },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* 닫기 */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 헤더 */}
            <View style={styles.headerWrap}>
              <Text style={styles.crown}>👑</Text>
              <Text style={styles.title}>CalorieApp 프리미엄</Text>
              <Text style={styles.subtitle}>모든 프리미엄 기능을 무제한으로</Text>
            </View>

            {/* 가격 카드 */}
            <View style={styles.priceCard}>
              <View style={styles.priceRow}>
                <Text style={styles.price}>₩3,900</Text>
                <Text style={styles.pricePer}> / 월</Text>
              </View>
              <Text style={styles.priceDesc}>언제든 해지 가능 · 첫 10회 무료</Text>
            </View>

            {/* 기능 목록 */}
            <View style={styles.featureWrap}>
              {FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={styles.featureEmoji}>{f.emoji}</Text>
                  <Text style={styles.featureText}>{f.text}</Text>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              ))}
            </View>

            {/* 무료 vs 프리미엄 비교 */}
            <View style={styles.compareCard}>
              <View style={styles.compareHeader}>
                <Text style={styles.compareCol}>기능</Text>
                <Text style={[styles.compareCol, styles.freeCol]}>무료</Text>
                <Text style={[styles.compareCol, styles.premiumCol]}>프리미엄</Text>
              </View>
              {[
                ['AI 스캔', '10회', '무제한'],
                ['칼로리 기록', '✓', '✓'],
                ['운동 기록', '✓', '✓'],
                ['통계', '기본', '상세'],
                ['만약에 계산기', '✗', '✓'],
                ['약 복용 알림', '✗', '✓'],
                ['치팅데이 코인', '✗', '✓'],
                ['AI 인사이트', '✗', '✓'],
                ['홈 인사이트 카드', '✗', '✓'],
                ['백업 & 리포트', '✗', '✓'],
              ].map(([feat, free, premium], i) => (
                <View key={i} style={styles.compareRow}>
                  <Text style={styles.compareCol}>{feat}</Text>
                  <Text style={[styles.compareCol, styles.freeCol]}>{free}</Text>
                  <Text style={[styles.compareCol, styles.premiumCol]}>{premium}</Text>
                </View>
              ))}
            </View>

            {/* 버튼 */}
            {isPremium ? (
              <View>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>✓ 프리미엄 이용 중</Text>
                </View>
                <TouchableOpacity style={styles.cancelSubBtn} onPress={handleCancel}>
                  <Text style={styles.cancelSubText}>구독 취소</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.subscribeBtn} onPress={handleSubscribe} activeOpacity={0.85}>
                <Text style={styles.subscribeBtnText}>월 3,900원으로 시작하기</Text>
                <Text style={styles.subscribeBtnSub}>첫 결제 즉시 적용</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.notice}>
              구독은 매월 자동 갱신됩니다. 다음 결제일 24시간 전 해지 가능합니다.
            </Text>
            <Text style={styles.refundNotice}>
              구독 후 서비스 이용 시 환불이 어려울 수 있습니다.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: '92%',
  },
  closeBtn: { alignSelf: 'flex-end', padding: 4 },
  closeBtnText: { fontSize: 20, color: '#B0BEC5' },
  headerWrap: { alignItems: 'center', marginBottom: 24 },
  crown: { fontSize: 52, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  subtitle: { fontSize: 14, color: '#78909C', marginTop: 4 },
  priceCard: {
    backgroundColor: COLORS.primary + '12',
    borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 20,
    borderWidth: 1.5, borderColor: COLORS.primary + '30',
  },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end' },
  price: { fontSize: 40, fontWeight: '900', color: COLORS.primary },
  pricePer: { fontSize: 18, color: '#78909C', marginBottom: 6 },
  priceDesc: { fontSize: 13, color: '#78909C', marginTop: 4 },
  featureWrap: {
    backgroundColor: '#F8FAFC', borderRadius: 18, padding: 16, marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F0F4F8',
  },
  featureEmoji: { fontSize: 20, width: 32 },
  featureText: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '500' },
  checkMark: { fontSize: 16, color: COLORS.secondary, fontWeight: '700' },
  compareCard: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E0E7EF', marginBottom: 20,
  },
  compareHeader: {
    flexDirection: 'row', backgroundColor: COLORS.text,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  compareRow: {
    flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: '#F0F4F8',
  },
  compareCol: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '500' },
  freeCol: { color: '#78909C', textAlign: 'center' },
  premiumCol: { color: COLORS.primary, textAlign: 'center', fontWeight: '700' },
  subscribeBtn: {
    backgroundColor: COLORS.primary, borderRadius: 18,
    paddingVertical: 18, alignItems: 'center', marginBottom: 12,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  subscribeBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  subscribeBtnSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 3 },
  activeBadge: {
    backgroundColor: COLORS.secondary + '20', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
    borderWidth: 1.5, borderColor: COLORS.secondary,
  },
  activeBadgeText: { color: COLORS.secondary, fontSize: 15, fontWeight: '700' },
  cancelSubBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 12 },
  cancelSubText: { color: '#B0BEC5', fontSize: 13, textDecorationLine: 'underline' },
  notice: { fontSize: 11, color: '#B0BEC5', textAlign: 'center', lineHeight: 16, marginBottom: 4 },
  refundNotice: { fontSize: 9, color: '#D0D8E0', textAlign: 'center', lineHeight: 14, marginBottom: 8 },
});
