import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../theme';
import { useSubscription } from '../hooks/useSubscription';
import PremiumModal from '../components/PremiumModal';
import { useCheatDay } from '../context/CheatDayContext';
import { getCheatHistory } from '../api/api';

interface HistoryItem {
  id: number;
  eventType: 'EARN' | 'USE';
  coinsDelta: number;
  memo: string;
  eventDate: string;
}

const MAX_STREAK = 7;

function StreakGrass({ streakCount, lastStreakDate }: { streakCount: number; lastStreakDate: string | null }) {
  // 오늘 기준으로 최근 7일 날짜 계산
  const today = new Date();
  const days: { date: string; active: boolean }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: dateStr, active: false });
  }

  // lastStreakDate 기준으로 streakCount만큼 역으로 채우기
  if (lastStreakDate && streakCount > 0) {
    const lastIdx = days.findIndex(d => d.date === lastStreakDate);
    const endIdx = lastIdx >= 0 ? lastIdx : days.length - 1;
    for (let i = 0; i < Math.min(streakCount, MAX_STREAK); i++) {
      const idx = endIdx - i;
      if (idx >= 0) days[idx].active = true;
    }
  }

  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <View style={grass.container}>
      {days.map((day, i) => {
        const dayOfWeek = new Date(day.date).getDay();
        const isToday = i === 6;
        return (
          <View key={day.date} style={grass.col}>
            <Text style={grass.label}>{dayLabels[dayOfWeek]}</Text>
            <View
              style={[
                grass.cell,
                day.active && grass.cellActive,
                isToday && grass.cellToday,
                isToday && day.active && grass.cellTodayActive,
              ]}
            >
              {day.active && <Text style={grass.check}>✓</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function CheatDayScreen() {
  const { isPremium, purchasePremium, cancelPremium } = useSubscription();
  const [premiumVisible, setPremiumVisible] = useState(false);
  const { status, isLoading, refreshStatus, activateCheatDay, MAX_COINS } = useCheatDay();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cheatConfirmVisible, setCheatConfirmVisible] = useState(false);
  const [activating, setActivating] = useState(false);
  const [coinEarnedVisible, setCoinEarnedVisible] = useState(false);
  const [tab, setTab] = useState<'status' | 'history'>('status');

  useFocusEffect(
    useCallback(() => {
      if (!isPremium) return;
      refreshStatus().then(() => {
        if (status.coinEarned) setCoinEarnedVisible(true);
      });
      if (tab === 'history') fetchHistory();
    }, [isPremium, tab]),
  );

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const res = await getCheatHistory();
      setHistory(res.data || []);
    } catch {}
    setHistoryLoading(false);
  }

  async function handleActivate() {
    setActivating(true);
    setCheatConfirmVisible(false);
    const result = await activateCheatDay();
    setActivating(false);
    Alert.alert(result.success ? '🍕 치팅데이 활성화!' : '알림', result.message);
    if (result.success) fetchHistory();
  }

  const coinsFull = status.cheatCoins >= MAX_COINS;
  const progressPct = Math.min((status.streakCount / MAX_STREAK) * 100, 100);

  // ── 프리미엄 잠금 화면 ─────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🪙 치팅데이 코인</Text>
          <Text style={styles.subtitle}>7일 연속 달성 시 코인 지급</Text>
        </View>

        {/* 미리보기 스트릭 */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>7일 스트릭 미리보기</Text>
          <StreakGrass streakCount={3} lastStreakDate={new Date().toISOString().slice(0, 10)} />
          <View style={styles.previewCoinRow}>
            {[...Array(MAX_COINS)].map((_, i) => (
              <Text key={i} style={[styles.previewCoin, i < 1 && styles.previewCoinActive]}>
                🪙
              </Text>
            ))}
          </View>
          <View style={styles.lockOverlay}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.premiumBanner}
          onPress={() => setPremiumVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.premiumEmoji}>👑</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumTitle}>프리미엄 전용</Text>
            <Text style={styles.premiumDesc}>7일 연속 달성 → 코인 1개 → 치팅데이 1회</Text>
          </View>
          <Text style={styles.premiumArrow}>›</Text>
        </TouchableOpacity>

        <PremiumModal
          visible={premiumVisible}
          onClose={() => setPremiumVisible(false)}
          isPremium={isPremium}
          onSubscribe={async () => { await purchasePremium(); setPremiumVisible(false); }}
          onCancel={async () => { await cancelPremium(); setPremiumVisible(false); }}
        />
      </View>
    );
  }

  // ── 메인 화면 ─────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🪙 치팅데이 코인</Text>
        <Text style={styles.subtitle}>7일 연속 달성 시 코인 지급</Text>
      </View>

      {/* 탭 */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'status' && styles.tabActive]}
          onPress={() => setTab('status')}
        >
          <Text style={[styles.tabText, tab === 'status' && styles.tabTextActive]}>현황</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'history' && styles.tabActive]}
          onPress={() => { setTab('history'); fetchHistory(); }}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>히스토리</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* ── 현황 탭 ─────────────────────────────────────────────────── */}
          {tab === 'status' && (
            <>
              {/* 치팅데이 활성 배너 */}
              {status.isTodayCheat && (
                <View style={styles.cheatActiveBanner}>
                  <Text style={styles.cheatActiveEmoji}>🍕</Text>
                  <Text style={styles.cheatActiveText}>오늘은 공식 치팅데이!</Text>
                  <Text style={styles.cheatActiveSub}>모든 칼로리 경고가 비활성화됩니다</Text>
                </View>
              )}

              {/* 코인 현황 카드 */}
              <View style={styles.coinCard}>
                <Text style={styles.coinLabel}>보유 코인</Text>
                <View style={styles.coinRow}>
                  {[...Array(MAX_COINS)].map((_, i) => (
                    <Text
                      key={i}
                      style={[styles.coin, i < status.cheatCoins && styles.coinActive]}
                    >
                      🪙
                    </Text>
                  ))}
                </View>
                <Text style={styles.coinCount}>{status.cheatCoins} / {MAX_COINS}</Text>
                {coinsFull && (
                  <Text style={styles.coinFullText}>코인이 가득 찼어요! 어서 써요 😄</Text>
                )}
              </View>

              {/* 7일 스트릭 잔디밭 */}
              <View style={styles.streakCard}>
                <View style={styles.streakHeader}>
                  <Text style={styles.sectionTitle}>7일 스트릭</Text>
                  <Text style={styles.streakCount}>{status.streakCount} / {MAX_STREAK}일</Text>
                </View>
                <StreakGrass
                  streakCount={status.streakCount}
                  lastStreakDate={status.lastStreakDate}
                />
                {/* 진행 바 */}
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                </View>
                <Text style={styles.streakHint}>
                  {status.streakCount >= MAX_STREAK
                    ? '7일 달성! 코인 지급 완료 🎉'
                    : `${MAX_STREAK - status.streakCount}일 더 달성하면 코인 1개!`}
                </Text>
              </View>

              {/* 코인 사용 버튼 */}
              {!status.isTodayCheat ? (
                <TouchableOpacity
                  style={[
                    styles.useBtn,
                    (status.cheatCoins <= 0 || activating) && styles.useBtnDisabled,
                  ]}
                  onPress={() => {
                    if (status.cheatCoins <= 0) {
                      Alert.alert('코인 없음', '7일 연속 달성 시 코인이 지급돼요!');
                      return;
                    }
                    setCheatConfirmVisible(true);
                  }}
                  disabled={activating}
                  activeOpacity={0.85}
                >
                  {activating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.useBtnText}>🍕 오늘 치팅데이 사용하기</Text>
                      <Text style={styles.useBtnSub}>코인 1개 차감 · 오늘 칼로리 제한 해제</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.usedBox}>
                  <Text style={styles.usedText}>✅ 오늘 치팅데이 사용 완료</Text>
                  <Text style={styles.usedSub}>내일부터 다시 스트릭을 이어가세요!</Text>
                </View>
              )}

              {/* 안내 */}
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>📌 치팅데이 코인 규칙</Text>
                <Text style={styles.infoText}>• 매일 앱 접속 시 스트릭 +1</Text>
                <Text style={styles.infoText}>• 하루라도 빠지면 스트릭 초기화</Text>
                <Text style={styles.infoText}>• 7일 연속 달성 시 코인 1개 지급</Text>
                <Text style={styles.infoText}>• 코인 최대 {MAX_COINS}개 보유 가능</Text>
                <Text style={styles.infoText}>• 치팅데이: 당일 칼로리 경고 전부 OFF</Text>
              </View>
            </>
          )}

          {/* ── 히스토리 탭 ─────────────────────────────────────────────── */}
          {tab === 'history' && (
            <>
              {historyLoading ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
              ) : history.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyEmoji}>🪙</Text>
                  <Text style={styles.emptyText}>아직 기록이 없어요</Text>
                  <Text style={styles.emptySub}>7일 연속 달성하면 코인이 지급돼요!</Text>
                </View>
              ) : (
                history.map(item => (
                  <View key={item.id} style={styles.historyItem}>
                    <Text style={styles.historyEmoji}>
                      {item.eventType === 'EARN' ? '🪙' : '🍕'}
                    </Text>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyMemo}>{item.memo}</Text>
                      <Text style={styles.historyDate}>{item.eventDate}</Text>
                    </View>
                    <Text
                      style={[
                        styles.historyDelta,
                        item.coinsDelta > 0 ? styles.deltaPositive : styles.deltaNegative,
                      ]}
                    >
                      {item.coinsDelta > 0 ? `+${item.coinsDelta}` : item.coinsDelta}
                    </Text>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* 치팅데이 확인 모달 */}
      <Modal
        visible={cheatConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCheatConfirmVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmEmoji}>🍕</Text>
            <Text style={styles.confirmTitle}>치팅데이를 사용할까요?</Text>
            <Text style={styles.confirmDesc}>
              코인 1개가 차감되고{'\n'}오늘 하루 칼로리 제한이 해제됩니다.
            </Text>
            <Text style={styles.confirmCoins}>
              사용 후 코인: {status.cheatCoins - 1} / {MAX_COINS}
            </Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleActivate} activeOpacity={0.85}>
              <Text style={styles.confirmBtnText}>사용하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmCancelBtn}
              onPress={() => setCheatConfirmVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 코인 획득 팝업 */}
      <Modal
        visible={coinEarnedVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCoinEarnedVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmEmoji}>🎉</Text>
            <Text style={styles.confirmTitle}>코인 획득!</Text>
            <Text style={styles.confirmDesc}>
              7일 연속 달성으로{'\n'}치팅데이 코인 1개가 지급됐어요!
            </Text>
            <Text style={styles.confirmCoins}>현재 코인: {status.cheatCoins} / {MAX_COINS}</Text>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => setCoinEarnedVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── 잔디밭 스타일 ────────────────────────────────────────────────────────────
const grass = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  col: { alignItems: 'center', gap: 4 },
  label: { fontSize: 11, color: '#78909C', fontWeight: '600' },
  cell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8EEF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellActive: { backgroundColor: COLORS.success },
  cellToday: { borderWidth: 2, borderColor: COLORS.primary },
  cellTodayActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  check: { fontSize: 16, color: '#fff', fontWeight: '800' },
});

// ── 메인 스타일 ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: '#78909C', marginTop: 4 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: '#E8EEF4',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#78909C' },
  tabTextActive: { color: COLORS.text, fontWeight: '800' },

  content: { padding: 16, paddingBottom: 60 },

  // 치팅데이 활성 배너
  cheatActiveBanner: {
    backgroundColor: '#FFF0F0',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  cheatActiveEmoji: { fontSize: 32, marginBottom: 4 },
  cheatActiveText: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  cheatActiveSub: { fontSize: 12, color: '#78909C', marginTop: 4 },

  // 코인 카드
  coinCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 3,
  },
  coinLabel: { fontSize: 13, color: '#78909C', fontWeight: '600', marginBottom: 12 },
  coinRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  coin: { fontSize: 30, opacity: 0.25 },
  coinActive: { opacity: 1 },
  coinCount: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  coinFullText: { fontSize: 13, color: COLORS.warning, fontWeight: '700', marginTop: 8 },

  // 스트릭 카드
  streakCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    elevation: 3,
  },
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  streakCount: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  progressBg: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 4 },
  streakHint: { fontSize: 12, color: '#78909C', marginTop: 8, textAlign: 'center' },

  // 코인 사용 버튼
  useBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 3,
  },
  useBtnDisabled: { backgroundColor: '#B0BEC5' },
  useBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  useBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  usedBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  usedText: { fontSize: 15, fontWeight: '700', color: '#2E7D32' },
  usedSub: { fontSize: 12, color: '#4CAF50', marginTop: 4 },

  // 안내
  infoBox: { backgroundColor: '#F5F7FA', borderRadius: 16, padding: 16 },
  infoTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  infoText: { fontSize: 13, color: '#78909C', marginTop: 4, lineHeight: 20 },

  // 히스토리
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    elevation: 2,
    gap: 12,
  },
  historyEmoji: { fontSize: 26 },
  historyInfo: { flex: 1 },
  historyMemo: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  historyDate: { fontSize: 12, color: '#78909C', marginTop: 2 },
  historyDelta: { fontSize: 18, fontWeight: '800' },
  deltaPositive: { color: COLORS.success },
  deltaNegative: { color: COLORS.primary },

  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 13, color: '#78909C', marginTop: 6 },

  // 프리미엄 잠금
  previewCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    elevation: 3,
    overflow: 'hidden',
  },
  previewLabel: { fontSize: 14, fontWeight: '700', color: '#B0BEC5', marginBottom: 4 },
  previewCoinRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  previewCoin: { fontSize: 26, opacity: 0.2 },
  previewCoinActive: { opacity: 1 },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: { fontSize: 36 },

  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF8E1', borderRadius: 18, padding: 18,
    marginHorizontal: 16, borderWidth: 1.5, borderColor: '#FCC419',
  },
  premiumEmoji: { fontSize: 28 },
  premiumTitle: { fontSize: 15, fontWeight: '800', color: '#2C3E50' },
  premiumDesc: { fontSize: 12, color: '#78909C', marginTop: 2, flexShrink: 1 },
  premiumArrow: { fontSize: 20, color: '#FCC419', fontWeight: '700' },

  // 확인 모달
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmBox: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  confirmEmoji: { fontSize: 52, marginBottom: 12 },
  confirmTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  confirmDesc: { fontSize: 14, color: '#78909C', textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  confirmCoins: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 20 },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  confirmCancelBtn: {
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  confirmCancelText: { color: '#78909C', fontSize: 16, fontWeight: '700' },
});
