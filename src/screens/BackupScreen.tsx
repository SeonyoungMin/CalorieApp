import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Modal,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSubscription } from '../hooks/useSubscription';
import PremiumModal from '../components/PremiumModal';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme';
import { getTodayMeals, getTodayWorkouts, getWeightList, getWeeklyStats } from '../api/api';
import { generateHealthReport } from '../services/claudeService';
import Icon from '../components/Icon';
import CuteLoader from '../components/CuteLoader';

export default function BackupScreen({ navigation }: any) {
  const { isPremium } = useSubscription();
  const { nickname, goalKcal } = useAuth();
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);

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

      setReportText(report);
    } catch {
      Alert.alert('오류', '리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = () => {
    if (!reportText) return;
    Clipboard.setString(reportText);
    Alert.alert('복사 완료', '리포트 내용이 복사됐어요!\n메모장이나 카카오톡에 붙여넣으세요.');
  };

  // 프리미엄 게이트
  if (!isPremium) {
    return (
      <View style={styles.gateWrap}>
        
        <Text style={styles.gateTitle}>클라우드 백업</Text>
        <Text style={styles.gateDesc}>프리미엄 전용 기능입니다.{'\n'}내 모든 데이터를 안전하게 내보낼 수 있어요.</Text>
        <TouchableOpacity style={styles.gateBtn} onPress={() => setPremiumVisible(true)}>
          <Text style={styles.gateBtnText}>프리미엄 시작하기</Text>
        </TouchableOpacity>
        <PremiumModal
          visible={premiumVisible}
          onClose={() => setPremiumVisible(false)}
        />
      </View>
    );
  }

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* 동기화 상태 카드 */}
      <View style={styles.syncCard}>
        <View style={styles.syncIconWrap}>
          
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
          <Text style={styles.infoValue}>{nickname || '-'}</Text>
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
        <Text style={styles.exportTitle}>AI 건강 리포트</Text>
        <Text style={styles.exportDesc}>
          AI가 내 식단·운동·체중 데이터를 분석해 깔끔한 리포트를 만들어 드려요.{'\n'}복사해서 메모장이나 카카오톡에 붙여넣으세요.
        </Text>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.exportBtnText}>AI 리포트 생성</Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={styles.notice}>
        * 데이터는 AWS 클라우드 서버에 암호화된 연결로 저장됩니다.{'\n'}
        * 앱을 삭제해도 계정으로 재로그인하면 모든 데이터를 복원할 수 있습니다.
      </Text>

      {/* AI 리포트 결과 모달 */}
      <Modal
        visible={reportText !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReportText(null)}
        statusBarTranslucent
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.modalCard}>
            <View style={modalStyles.modalHeader}>
              <View style={modalStyles.modalHeaderIcon}>
                <Icon name="sparkles" size={18} color={COLORS.primaryDark} />
              </View>
              <Text style={modalStyles.modalTitle}>AI 건강 리포트</Text>
              <TouchableOpacity onPress={() => setReportText(null)} style={modalStyles.modalClose}>
                <Icon name="close" size={20} color={COLORS.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={modalStyles.modalBody}
              contentContainerStyle={{ padding: 18 }}
              showsVerticalScrollIndicator
            >
              <Text style={modalStyles.reportText}>{reportText}</Text>
            </ScrollView>

            <View style={modalStyles.modalFooter}>
              <TouchableOpacity
                style={[modalStyles.footerBtn, modalStyles.footerBtnGhost]}
                onPress={() => setReportText(null)}
                activeOpacity={0.8}
              >
                <Text style={modalStyles.footerBtnGhostText}>닫기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.footerBtn, modalStyles.footerBtnPrimary]}
                onPress={handleCopy}
                activeOpacity={0.8}
              >
                <Icon name="bookmark" size={15} color="#fff" />
                <Text style={modalStyles.footerBtnPrimaryText}>전체 복사</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%', maxWidth: 480, maxHeight: '85%',
    backgroundColor: '#fff', borderRadius: 28, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingVertical: 17,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalHeaderIcon: {
    width: 32, height: 32, borderRadius: 999,
    backgroundColor: COLORS.lavender,
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalClose: { padding: 4 },
  modalBody: { backgroundColor: COLORS.cardSoft },
  reportText: {
    fontSize: 15, lineHeight: 21, color: COLORS.text,
    fontFamily: 'monospace',
  },
  modalFooter: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 14, paddingVertical: 17,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  footerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 17, borderRadius: 18,
  },
  footerBtnGhost: { backgroundColor: COLORS.cardSoft },
  footerBtnGhostText: { fontSize: 16, fontWeight: '700', color: COLORS.subText },
  footerBtnPrimary: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  footerBtnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 88 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 8 },
  backBtn: { marginRight: 12, padding: 4 },
  backBtnText: { fontSize: 28, color: COLORS.text, lineHeight: 32 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },

  syncCard: {
    backgroundColor: '#FFD6E5',
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  syncIconWrap: { width: 48, height: 48, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  syncIcon: { fontSize: 24 },
  syncTitle: { fontSize: 17, fontWeight: '700', color: '#2E7D32' },
  syncDesc: { fontSize: 14, color: '#558B2F', marginTop: 2 },
  syncDot: { width: 10, height: 10, borderRadius: 12, backgroundColor: '#A8D8B9' },

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  infoTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#FFF5F8' },
  infoLabel: { fontSize: 16, color: '#8A7C9C' },
  infoValue: { fontSize: 16, fontWeight: '600', color: COLORS.text },

  exportCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  exportTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  exportDesc: { fontSize: 15, color: '#8A7C9C', lineHeight: 20, marginBottom: 16 },
  exportBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 20,
    paddingVertical: 17,
    alignItems: 'center',
  },
  exportBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  notice: { fontSize: 14, color: '#D4C5DC', lineHeight: 20 },

  // 게이트
  gateWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  gateEmoji: { fontSize: 64, marginBottom: 16 },
  gateTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  gateDesc: { fontSize: 16, color: '#8A7C9C', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  gateBtn: { backgroundColor: COLORS.primary, borderRadius: 22, paddingVertical: 17, paddingHorizontal: 28 },
  gateBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
