import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert,
} from 'react-native';
import { COLORS } from '../theme';
import Icon from '../components/Icon';
import { useSubscription } from '../hooks/useSubscription';
import { EVENT_FREE_ACCESS } from '../config/eventFlags';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const FEATURES = [
  { emoji: '', text: 'AI 칼로리 스캔 무제한' },
  { emoji: '', text: 'AI 맞춤 식단 추천' },
  { emoji: '', text: 'AI 운동 루틴 추천' },
  { emoji: '', text: 'AI 식단 분석 & 피드백' },
  { emoji: '', text: 'AI 주간 리포트 & 상세 통계' },
  { emoji: '', text: '만약에 계산기 — 음식·운동별 목표일 변화 시뮬레이션' },
  { emoji: '', text: '약 복용 알림 — 매일 약 챙기기 & 복용 체크' },
  { emoji: '', text: '치팅데이 코인 — 7일 연속 달성 → 코인 → 치팅데이 1회' },
  { emoji: '', text: '홈 인사이트 카드 — 목표 D-day · BMI · 연속달성 · 코인' },
  { emoji: '', text: '월간 캘린더 & 영양소 분석' },
  { emoji: '', text: '체중 변화 그래프 & 목표일 예측' },
  { emoji: '', text: 'AI 건강 리포트 내보내기 & 클라우드 백업' },
];

const formatKRW = (n: number) => `₩${n.toLocaleString('ko-KR')}`;

export default function PremiumModal({ visible, onClose }: Props) {
  // EVENT_FREE_ACCESS 기간(공유오피스 주소 변경 전): 결제 화면 자체를 절대 노출하지 않음.
  // 결제 시 Play Store가 사업자등록 주소(현재 집 주소)를 노출하기 때문.
  // 2026-08 공유오피스 주소 등록 후 eventFlags.EVENT_FREE_ACCESS=false로 복원하면 정상 표시.
  if (EVENT_FREE_ACCESS) return null;

  const {
    isPremium,
    monthlyPackage,
    annualPackage,
    purchasePackage,
    cancelPremium,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [purchasing, setPurchasing] = useState(false);

  const monthlyAmount = monthlyPackage?.product.price ?? 3900;
  const annualAmount = annualPackage?.product.price ?? 34000;
  const monthlyPriceText = monthlyPackage?.product.priceString ?? formatKRW(monthlyAmount);
  const annualPriceText = annualPackage?.product.priceString ?? formatKRW(annualAmount);

  const annualSavingsPercent =
    monthlyAmount > 0
      ? Math.max(0, Math.round((1 - annualAmount / (monthlyAmount * 12)) * 100))
      : 0;
  const annualMonthlyEq = Math.round(annualAmount / 12);

  const handleSubscribe = () => {
    const planName = selectedPlan === 'annual' ? '연간' : '월간';
    const priceLine =
      selectedPlan === 'annual'
        ? `${annualPriceText} / 년 (월 ${formatKRW(annualMonthlyEq)} 꼴)`
        : `${monthlyPriceText} / 월`;

    Alert.alert(
      '프리미엄 구독',
      `${planName} 결제 (${priceLine})로 모든 기능을 무제한 이용하시겠습니까?\n\n※ 구독 후 서비스를 이용하신 경우 환불이 제한될 수 있습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '구독하기',
          onPress: async () => {
            const pkg = selectedPlan === 'annual' ? annualPackage : monthlyPackage;
            if (!pkg) {
              Alert.alert('오류', '요금제를 불러올 수 없습니다.\n잠시 후 다시 시도해주세요.');
              return;
            }
            try {
              setPurchasing(true);
              const ok = await purchasePackage(pkg);
              if (ok) onClose();
            } catch (e: any) {
              Alert.alert('결제 실패', e?.message ?? '결제 중 오류가 발생했습니다.');
            } finally {
              setPurchasing(false);
            }
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
        {
          text: '취소하기',
          style: 'destructive',
          onPress: async () => {
            await cancelPremium();
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Icon name="close" size={18} color={COLORS.subText} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.headerWrap}>
              <Icon name="crown" size={22} color={COLORS.warning} />
              <Text style={styles.title}>쁠마 프리미엄</Text>
              <Text style={styles.subtitle}>모든 프리미엄 기능을 무제한으로</Text>
            </View>

            {/* 요금제 선택 */}
            {!isPremium && (
              <View style={styles.planRow}>
                {/* 연간 */}
                <TouchableOpacity
                  style={[
                    styles.planCard,
                    selectedPlan === 'annual' && styles.planCardActive,
                  ]}
                  onPress={() => setSelectedPlan('annual')}
                  activeOpacity={0.85}
                >
                  {annualSavingsPercent > 0 && (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsBadgeText}>{annualSavingsPercent}% 절약</Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.planLabel,
                      selectedPlan === 'annual' && styles.planLabelActive,
                    ]}
                  >
                    연간
                  </Text>
                  <View style={styles.planPriceRow}>
                    <Text
                      style={[
                        styles.planPrice,
                        selectedPlan === 'annual' && styles.planPriceActive,
                      ]}
                    >
                      {annualPriceText}
                    </Text>
                    <Text style={styles.planPricePer}> / 년</Text>
                  </View>
                  <Text style={styles.planMonthly}>월 {formatKRW(annualMonthlyEq)} 꼴</Text>
                  <View
                    style={[
                      styles.radio,
                      selectedPlan === 'annual' && styles.radioActive,
                    ]}
                  >
                    {selectedPlan === 'annual' && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>

                {/* 월간 */}
                <TouchableOpacity
                  style={[
                    styles.planCard,
                    selectedPlan === 'monthly' && styles.planCardActive,
                  ]}
                  onPress={() => setSelectedPlan('monthly')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.planLabel,
                      selectedPlan === 'monthly' && styles.planLabelActive,
                    ]}
                  >
                    월간
                  </Text>
                  <View style={styles.planPriceRow}>
                    <Text
                      style={[
                        styles.planPrice,
                        selectedPlan === 'monthly' && styles.planPriceActive,
                      ]}
                    >
                      {monthlyPriceText}
                    </Text>
                    <Text style={styles.planPricePer}> / 월</Text>
                  </View>
                  <Text style={styles.planMonthly}>매월 결제</Text>
                  <View
                    style={[
                      styles.radio,
                      selectedPlan === 'monthly' && styles.radioActive,
                    ]}
                  >
                    {selectedPlan === 'monthly' && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.freeNotice}>언제든 해지 가능 · 첫 10회 AI 스캔 무료</Text>

            {/* 기능 목록 */}
            <View style={styles.featureWrap}>
              {FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={styles.featureEmoji}>{f.emoji}</Text>
                  <Text style={styles.featureText}>{f.text}</Text>
                  <Icon name="check" size={12} color={"#fff"} />
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
                ['칼로리 기록', '', ''],
                ['운동 기록', '', ''],
                ['통계', '기본', '상세'],
                ['만약에 계산기', '', ''],
                ['약 복용 알림', '', ''],
                ['치팅데이 코인', '', ''],
                ['AI 인사이트', '', ''],
                ['홈 인사이트 카드', '', ''],
                ['백업 & 리포트', '', ''],
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
                  <Text style={styles.activeBadgeText}>프리미엄 이용 중</Text>
                </View>
                <TouchableOpacity style={styles.cancelSubBtn} onPress={handleCancel}>
                  <Text style={styles.cancelSubText}>구독 취소</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.subscribeBtn, purchasing && styles.subscribeBtnDisabled]}
                onPress={handleSubscribe}
                activeOpacity={0.85}
                disabled={purchasing}
              >
                <Text style={styles.subscribeBtnText}>
                  {purchasing
                    ? '결제 진행 중...'
                    : selectedPlan === 'annual'
                    ? `${annualPriceText}으로 1년 시작하기`
                    : `${monthlyPriceText}으로 월간 시작하기`}
                </Text>
                <Text style={styles.subscribeBtnSub}>첫 결제 즉시 적용</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.notice}>
              구독은 {selectedPlan === 'annual' ? '매년' : '매월'} 자동 갱신됩니다.
              다음 결제일 24시간 전 해지 가능합니다.
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
  closeBtnText: { fontSize: 20, color: '#D4C5DC' },
  headerWrap: { alignItems: 'center', marginBottom: 20 },
  crown: { fontSize: 52, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  subtitle: { fontSize: 16, color: '#8A7C9C', marginTop: 4 },

  // 요금제 카드
  planRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  planCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#F0E1EC',
    borderRadius: 26,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: '#FBF4F9',
    alignItems: 'center',
    position: 'relative',
  },
  planCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  savingsBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: COLORS.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 3,
  },
  savingsBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  planLabel: { fontSize: 15, fontWeight: '700', color: '#8A7C9C', marginBottom: 6 },
  planLabelActive: { color: COLORS.primary },
  planPriceRow: { flexDirection: 'row', alignItems: 'flex-end' },
  planPrice: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  planPriceActive: { color: COLORS.primary },
  planPricePer: { fontSize: 15, color: '#8A7C9C', marginBottom: 3 },
  planMonthly: { fontSize: 13, color: '#8A7C9C', marginTop: 4 },
  radio: {
    width: 18, height: 18, borderRadius: 16,
    borderWidth: 2, borderColor: '#CFD8DC',
    marginTop: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.primary },
  radioDot: { width: 8, height: 8, borderRadius: 12, backgroundColor: COLORS.primary },

  freeNotice: {
    fontSize: 14, color: '#8A7C9C', textAlign: 'center',
    marginBottom: 16, marginTop: 4,
  },

  featureWrap: {
    backgroundColor: '#FBF4F9', borderRadius: 26, padding: 16, marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#FFF5F8',
  },
  featureEmoji: { fontSize: 20, width: 32 },
  featureText: { flex: 1, fontSize: 16, color: COLORS.text, fontWeight: '500' },
  checkMark: { fontSize: 17, color: COLORS.secondary, fontWeight: '700' },

  compareCard: {
    borderRadius: 26, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F0E1EC', marginBottom: 20,
  },
  compareHeader: {
    flexDirection: 'row', backgroundColor: COLORS.text,
    paddingVertical: 13, paddingHorizontal: 22,
  },
  compareRow: {
    flexDirection: 'row', paddingVertical: 13, paddingHorizontal: 22,
    borderTopWidth: 1, borderTopColor: '#FFF5F8',
  },
  compareCol: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
  freeCol: { color: '#8A7C9C', textAlign: 'center' },
  premiumCol: { color: COLORS.primary, textAlign: 'center', fontWeight: '700' },

  subscribeBtn: {
    backgroundColor: COLORS.primary, borderRadius: 26,
    paddingVertical: 18, alignItems: 'center', marginBottom: 12,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  subscribeBtnDisabled: { opacity: 0.6 },
  subscribeBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subscribeBtnSub: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 3 },
  activeBadge: {
    backgroundColor: COLORS.secondary + '20', borderRadius: 22,
    paddingVertical: 17, alignItems: 'center', marginBottom: 12,
    borderWidth: 1.5, borderColor: COLORS.secondary,
  },
  activeBadgeText: { color: COLORS.secondary, fontSize: 17, fontWeight: '700' },
  cancelSubBtn: { alignItems: 'center', paddingVertical: 13, marginBottom: 12 },
  cancelSubText: { color: '#D4C5DC', fontSize: 15, textDecorationLine: 'underline' },
  notice: { fontSize: 13, color: '#D4C5DC', textAlign: 'center', lineHeight: 16, marginBottom: 4 },
  refundNotice: { fontSize: 9, color: '#D0D8E0', textAlign: 'center', lineHeight: 14, marginBottom: 8 },
});
