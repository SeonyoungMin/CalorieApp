import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Share, Alert, ActivityIndicator,
} from 'react-native';
import { useSubscription } from '../hooks/useSubscription';
import PremiumModal from '../components/PremiumModal';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme';
import { getTodayMeals, getTodayWorkouts, getWeightList, getWeeklyStats } from '../api/api';
import { generateHealthReport } from '../services/claudeService';

export default function BackupScreen({ navigation }: any) {
  const { isPremium, activatePremium, cancelPremium } = useSubscription();
  const { nickname, goalKcal } = useAuth();
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const [mealsRes, workoutsRes, weightRes, statsRes] = await Promise.all([
        getTodayMeals().catch(() => ({ data: [] })),
        getTodayWorkouts().catch(() => ({ data: [] })),
        getWeightList().catch(() => ({ data: [] })),
        getWeeklyStats().catch(() => ({ data: null })),
      ]);

      const report = await generateHealthReport({
        nickname: nickname || '사용자',
        weeklyStats: statsRes.data,
        recentMeals: mealsRes.data || [],
        recentWorkouts: workoutsRes.data || [],
        weightList: weightRes.data || [],
        goalKcal: goalKcal || 2000,
      });

      await Share.share({ message: report, title: 'CalorieApp 건강 리포트' });
    } catch {
      Alert.alert('오류', '리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setExporting(false);
    }
  };

  // 프리미엄 게이트
  if (!isPremium) {
    return (
      <View style={styles.gateWrap}>
        <Text style={styles.gateEmoji}>☁️</Text>
        <Text style={styles.gateTitle}>클라우드 백업</Text>
        <Text style={styles.gateDesc}>프리미엄 전용 기능입니다.{'\n'}내 모든 데이터를 안전하게 내보낼 수 있어요.</Text>
        <TouchableOpacity style={styles.gateBtn} onPress={() => setPremiumVisible(true)}>
          <Text style={styles.gateBtnText}>👑 프리미엄 시작하기</Text>
        </TouchableOpacity>
        <PremiumModal
          visible={premiumVisible}
          onClose={() => setPremiumVisible(false)}
          isPremium={isPremium}
          onSubscribe={async () => { await activatePremium(); setPremiumVisible(false); }}
          onCancel={async () => { await cancelPremium(); setPremiumVisible(false); }}
        />
      </View>
    );
  }

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>클라우드 데이터 백업</Text>
      </View>

      {/* 동기화 상태 카드 */}
      <View style={styles.syncCard}>
        <View style={styles.syncIconWrap}>
          <Text style={styles.syncIcon}>☁️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.syncTitle}>클라우드 자동 동기화 활성화됨</Text>
          <Text style={styles.syncDesc}>모든 데이터가 서버에 안전하게 저장됩니다</Text>
        </View>
        <View style={styles.syncDot} />
      </View>

      {/* 정보 카드 */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>백업 정보</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>계정</Text>
          <Text style={styles.infoValue}>{nickname}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>동기화 방식</Text>
          <Text style={styles.infoValue}>실시간 자동 저장</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>저장 항목</Text>
          <Text style={styles.infoValue}>식단 · 운동 · 체중 기록</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>오늘 날짜</Text>
          <Text style={styles.infoValue}>{today}</Text>
        </View>
      </View>

      {/* 내보내기 */}
      <View style={styles.exportCard}>
        <Text style={styles.exportTitle}>📤 AI 건강 리포트 내보내기</Text>
        <Text style={styles.exportDesc}>
          AI가 내 식단·운동·체중 데이터를 분석해 공유하기 좋은 리포트를 만들어 드려요.{'\n'}메모장, 카카오톡, 노트 앱 등에 바로 공유할 수 있어요.
        </Text>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.exportBtnText}>🤖 AI 리포트 생성 & 공유</Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={styles.notice}>
        * 데이터는 AWS 클라우드 서버에 암호화된 연결로 저장됩니다.{'\n'}
        * 앱을 삭제해도 계정으로 재로그인하면 모든 데이터를 복원할 수 있습니다.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 8 },
  backBtn: { marginRight: 12, padding: 4 },
  backBtnText: { fontSize: 28, color: COLORS.text, lineHeight: 32 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },

  syncCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  syncIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  syncIcon: { fontSize: 24 },
  syncTitle: { fontSize: 15, fontWeight: '700', color: '#2E7D32' },
  syncDesc: { fontSize: 12, color: '#558B2F', marginTop: 2 },
  syncDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#51CF66' },

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  infoTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  infoLabel: { fontSize: 14, color: '#78909C' },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  exportCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  exportTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  exportDesc: { fontSize: 13, color: '#78909C', lineHeight: 20, marginBottom: 16 },
  exportBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  exportBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  notice: { fontSize: 12, color: '#B0BEC5', lineHeight: 20 },

  // 게이트
  gateWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  gateEmoji: { fontSize: 64, marginBottom: 16 },
  gateTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  gateDesc: { fontSize: 14, color: '#78909C', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  gateBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  gateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
