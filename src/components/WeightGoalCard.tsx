import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Line, Circle, Polyline } from 'react-native-svg';
import { COLORS } from '../theme';
import { GoalPrediction, WeightGoalData, CalorieAverageData, WeightHistoryItem } from '../hooks/useWeightGoal';

interface Props {
  goalData: WeightGoalData;
  avgData: CalorieAverageData;
  prediction: GoalPrediction;
  history: WeightHistoryItem[];
  isPremium: boolean;
  onSettingsPress: () => void;
}

// ─── 프리미엄 전용 미니 체중 그래프 ──────────────────────────────────────────
function WeightTrendGraph({ history, goalWeight }: { history: WeightHistoryItem[]; goalWeight: number | null }) {
  if (history.length < 2) return null;

  const recent = [...history].reverse().slice(-14); // 최근 14개
  const weights = recent.map(r => Number(r.weightKg));
  const allVals = goalWeight ? [...weights, goalWeight] : weights;
  const maxW = Math.max(...allVals);
  const minW = Math.min(...allVals);
  const range = maxW - minW || 1;

  const W = 280;
  const H = 90;
  const PAD = 12;
  const chartW = W - PAD * 2;
  const chartH = H - PAD * 2;

  const xStep = recent.length > 1 ? chartW / (recent.length - 1) : 0;
  const toY = (w: number) => PAD + chartH - ((w - minW) / range) * chartH;
  const toX = (i: number) => PAD + i * xStep;

  const points = recent.map((r, i) => `${toX(i)},${toY(Number(r.weightKg))}`).join(' ');
  const goalY = goalWeight ? toY(goalWeight) : null;

  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.graphLabel}>체중 변화 추이</Text>
      <Svg width={W} height={H}>
        {/* 목표 체중 점선 */}
        {goalY !== null && (
          <Line
            x1={PAD} y1={goalY} x2={W - PAD} y2={goalY}
            stroke={COLORS.success} strokeWidth={1.5}
            strokeDasharray="5,4" opacity={0.7}
          />
        )}
        {/* 체중 라인 */}
        <Polyline
          points={points}
          fill="none"
          stroke={COLORS.purple}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* 최신 포인트 */}
        <Circle
          cx={toX(recent.length - 1)}
          cy={toY(weights[weights.length - 1])}
          r={4} fill={COLORS.purple}
        />
      </Svg>
      <View style={styles.graphLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.purple }]} />
          <Text style={styles.legendText}>실제 체중</Text>
        </View>
        {goalWeight && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
            <Text style={styles.legendText}>목표 체중</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── 메인 카드 ────────────────────────────────────────────────────────────────
export default function WeightGoalCard({ goalData, avgData, prediction, history, isPremium, onSettingsPress }: Props) {
  const { currentWeight, goalWeight } = goalData;
  const { days, averageDeficit, averageEaten, goalKcal } = avgData;
  const { estimatedDate, daysLeft, needsMoreData, tooLong, progressPct } = prediction;

  // 경고 알림 서비스를 위해 예상 달성일 캐시 저장
  React.useEffect(() => {
    if (daysLeft !== null && daysLeft > 0) {
      import('../services/warningNotificationService').then(({ cachePredictionDays }) => {
        cachePredictionDays(daysLeft);
      }).catch(() => {});
    }
  }, [daysLeft]);

  const hasGoal = currentWeight != null && goalWeight != null;
  const diff = hasGoal ? (currentWeight! - goalWeight!).toFixed(1) : null;
  const isAchieved = hasGoal && parseFloat(diff!) <= 0;

  return (
    <View style={styles.card}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>목표 체중 & 예상 달성일</Text>
        <TouchableOpacity onPress={onSettingsPress} style={styles.settingsBtn}>
          <Text style={styles.settingsText}>설정</Text>
        </TouchableOpacity>
      </View>

      {/* 목표 미설정 상태 */}
      {!hasGoal && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onSettingsPress}>
          <Text style={styles.emptyText}>목표 체중을 설정해보세요 →</Text>
        </TouchableOpacity>
      )}

      {hasGoal && (
        <>
          {/* 현재 / 목표 체중 행 */}
          <View style={styles.weightRow}>
            <View style={styles.weightBox}>
              <Text style={styles.weightLabel}>현재</Text>
              <Text style={styles.weightVal}>{currentWeight} <Text style={styles.weightUnit}>kg</Text></Text>
            </View>
            <View style={styles.arrowWrap}>
              <Text style={styles.arrowText}>{isAchieved ? '' : '→'}</Text>
              {diff !== null && !isAchieved && (
                <Text style={styles.diffBadge}>▼ {diff}kg</Text>
              )}
            </View>
            <View style={styles.weightBox}>
              <Text style={styles.weightLabel}>목표</Text>
              <Text style={[styles.weightVal, { color: COLORS.success }]}>
                {goalWeight} <Text style={styles.weightUnit}>kg</Text>
              </Text>
            </View>
          </View>

          {/* 달성 완료 */}
          {isAchieved ? (
            <View style={styles.achievedBanner}>
              <Text style={styles.achievedText}>목표 체중을 달성했어요! 대단해요!</Text>
            </View>
          ) : (
            <>
              {/* 예상 달성일 영역 */}
              {needsMoreData ? (
                <View style={styles.infoBanner}>
                  <Text style={styles.infoText}>데이터가 더 쌓이면 정확해져요</Text>
                  <Text style={styles.infoSub}>현재 {days}일치 기록 / 3일 이상 필요</Text>
                </View>
              ) : averageDeficit <= 0 ? (
                <View style={styles.warnBanner}>
                  <Text style={styles.warnText}>현재 평균 섭취가 목표보다 많아요</Text>
                  <Text style={styles.warnSub}>평균 {averageEaten}kcal 섭취 / 목표 {goalKcal}kcal</Text>
                </View>
              ) : tooLong ? (
                <>
                  <View style={styles.warnBanner}>
                    <Text style={styles.warnText}>현재 속도로는 365일 이상 걸려요</Text>
                    <Text style={styles.warnSub}>하루 평균 {Math.abs(averageDeficit)}kcal 적자 중</Text>
                  </View>
                  <View style={styles.tipBanner}>
                    <Text style={styles.tipText}>목표 칼로리를 {Math.round(goalKcal * 0.9)}kcal로 줄이면 더 빠를 수 있어요</Text>
                  </View>
                </>
              ) : (
                <>
                  {/* 메인 달성 예측 */}
                  <View style={styles.predictionBox}>
                    <Text style={styles.predictionMain}>
                      이런 식으로 드시면 약{' '}
                      <Text style={styles.predictionHighlight}>{daysLeft}일 후</Text>{' '}
                      목표 달성!
                    </Text>
                    {estimatedDate && (
                      <Text style={styles.predictionDate}>예상 달성일: {estimatedDate}</Text>
                    )}
                  </View>

                  {/* D-day */}
                  {daysLeft !== null && (
                    <View style={styles.ddayRow}>
                      <View style={styles.ddayBox}>
                        <Text style={styles.ddayLabel}>D-day</Text>
                        <Text style={styles.ddayVal}>D-{daysLeft}</Text>
                      </View>
                      <View style={styles.ddayBox}>
                        <Text style={styles.ddayLabel}>일평균 적자</Text>
                        <Text style={[styles.ddayVal, { color: COLORS.success }]}>{averageDeficit}kcal</Text>
                      </View>
                      <View style={styles.ddayBox}>
                        <Text style={styles.ddayLabel}>기록 일수</Text>
                        <Text style={styles.ddayVal}>{days}일</Text>
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* 프리미엄 전용 그래프 */}
              {isPremium && history.length >= 2 && (
                <WeightTrendGraph history={history} goalWeight={goalWeight} />
              )}

              {!isPremium && (
                <View style={styles.premiumHint}>
                  <Text style={styles.premiumHintText}>프리미엄: 체중 변화 그래프 상세 보기</Text>
                </View>
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 28, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  settingsBtn: {
    backgroundColor: COLORS.purple + '20', borderRadius: 18,
    paddingHorizontal: 18, paddingVertical: 5,
  },
  settingsText: { fontSize: 14, color: COLORS.purple, fontWeight: '700' },
  emptyBtn: {
    backgroundColor: '#FBF4F9', borderRadius: 20, padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#F0E1EC', borderStyle: 'dashed',
  },
  emptyText: { fontSize: 16, color: '#8A7C9C', fontWeight: '600' },
  weightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 },
  weightBox: { flex: 1, alignItems: 'center', backgroundColor: '#FBF4F9', borderRadius: 22, paddingVertical: 15 },
  weightLabel: { fontSize: 13, color: '#8A7C9C', fontWeight: '600', marginBottom: 4 },
  weightVal: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  weightUnit: { fontSize: 15, fontWeight: '600', color: '#8A7C9C' },
  arrowWrap: { alignItems: 'center' },
  arrowText: { fontSize: 20 },
  diffBadge: { fontSize: 13, color: COLORS.success, fontWeight: '700', marginTop: 2 },
  achievedBanner: {
    backgroundColor: '#FFD6E5', borderRadius: 20, padding: 14, alignItems: 'center',
  },
  achievedText: { fontSize: 17, fontWeight: '700', color: COLORS.success },
  infoBanner: {
    backgroundColor: '#E6DAF5', borderRadius: 20, padding: 12, marginBottom: 8,
  },
  infoText: { fontSize: 15, fontWeight: '700', color: '#1565C0' },
  infoSub: { fontSize: 13, color: '#1565C0', marginTop: 3, opacity: 0.8 },
  warnBanner: {
    backgroundColor: '#FFE8EF', borderRadius: 20, padding: 12, marginBottom: 8,
  },
  warnText: { fontSize: 15, fontWeight: '700', color: '#A98ED1' },
  warnSub: { fontSize: 13, color: '#A98ED1', marginTop: 3, opacity: 0.8 },
  tipBanner: {
    backgroundColor: '#FFD6E5', borderRadius: 20, padding: 10, marginBottom: 8,
  },
  tipText: { fontSize: 14, color: COLORS.success, fontWeight: '600' },
  predictionBox: {
    backgroundColor: COLORS.purple + '12', borderRadius: 22,
    padding: 14, marginBottom: 10, alignItems: 'center',
  },
  predictionMain: { fontSize: 16, color: COLORS.text, fontWeight: '600', textAlign: 'center' },
  predictionHighlight: { fontSize: 19, fontWeight: '900', color: COLORS.purple },
  predictionDate: { fontSize: 14, color: '#8A7C9C', marginTop: 4 },
  ddayRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  ddayBox: { flex: 1, backgroundColor: '#FBF4F9', borderRadius: 20, padding: 10, alignItems: 'center' },
  ddayLabel: { fontSize: 12, color: '#8A7C9C', fontWeight: '600', marginBottom: 4 },
  ddayVal: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  premiumHint: {
    backgroundColor: '#FFE8EF', borderRadius: 18, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#FFE082',
  },
  premiumHintText: { fontSize: 14, color: '#F57F17', fontWeight: '600' },
  graphLabel: { fontSize: 14, fontWeight: '600', color: '#8A7C9C', marginBottom: 4 },
  graphLegend: { flexDirection: 'row', gap: 12, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 12 },
  legendText: { fontSize: 12, color: '#8A7C9C' },
});
