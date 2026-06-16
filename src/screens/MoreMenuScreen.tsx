import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import PremiumModal from '../components/PremiumModal';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { EVENT_FREE_ACCESS } from '../config/eventFlags';

type MenuItem = { icon: IconName; label: string; desc: string; screen: string; color: string; premium: boolean };
const MENU_ITEMS: MenuItem[] = [
  { icon: 'user',         label: '내 프로필',     desc: '목표 칼로리 · 키 · 체중 설정',         screen: 'Profile',                  color: COLORS.purpleDark, premium: false },
  { icon: 'image',        label: '포토 다이어리', desc: '날짜별 사진 · 총평 · 칼로리 아카이브', screen: 'CalendarArchive',          color: COLORS.water,      premium: false },
  { icon: 'users',        label: '친구 피드',     desc: '친구 기록 · 응원 · 반응 · 이번 주 베스트', screen: 'FriendFeed',           color: COLORS.pink,       premium: false },
  { icon: 'bookmark',     label: '스토리 보관함', desc: '만료된 내 스토리 모아보기 (24시간 후)', screen: 'StoryArchive',         color: COLORS.purpleDark, premium: true  },
  { icon: 'calc',         label: '만약에 계산기', desc: '먹으면? 운동하면? 목표일 변화 계산',   screen: 'IfCalc',                   color: COLORS.warning,    premium: true  },
  { icon: 'camera',       label: '식사 사진 알림', desc: '식사 시간 알림 · 최대 10개 커스텀',   screen: 'MealPhotoNotification',    color: COLORS.water,      premium: false },
  { icon: 'pill',         label: '약 복용 알림',  desc: '매일 약 챙기기 · 복용 체크',           screen: 'Medication',               color: COLORS.purple,     premium: true  },
  { icon: 'drink',        label: '술자리 모드',   desc: '칼로리 계산 · 회식 알림 · 해장 추천',  screen: 'DrinkMode',                color: COLORS.warning,    premium: false },
  { icon: 'fire',         label: '치팅데이 코인', desc: '7일 연속 달성 → 코인 → 치팅데이 1회', screen: 'CheatDay',                 color: COLORS.warning,    premium: true  },
  { icon: 'sparkles',     label: 'AI 인사이트',   desc: '식단분석 · 식단추천 · 운동추천 · 주간리포트', screen: 'AiInsight',         color: COLORS.primary,    premium: true  },
  { icon: 'stats',        label: '상세 통계',     desc: '영양소 · 캘린더 · 체중 그래프',        screen: 'Stats',                    color: COLORS.secondary,  premium: true  },
  { icon: 'weight',       label: '체중 기록',     desc: '체중 변화 기록 및 그래프',             screen: 'Weight',                   color: COLORS.purpleDark, premium: false },
  { icon: 'water',        label: '물 섭취',       desc: '오늘 마신 물 기록',                   screen: 'Water',                    color: COLORS.water,      premium: false },
  { icon: 'heart',        label: '생리주기',      desc: '주기 관리 및 예측',                   screen: 'Cycle',                    color: COLORS.pink,       premium: false },
  { icon: 'bell',         label: '알림 설정',     desc: '생리주기 · 물 마시기 · 식사 알림',     screen: 'NotificationSettings',     color: COLORS.warning,    premium: false },
  { icon: 'cloud',        label: '클라우드 백업', desc: '내 데이터 내보내기 · 자동 동기화',     screen: 'Backup',                   color: COLORS.success,    premium: true  },
];

export default function MoreMenuScreen() {
  const navigation = useNavigation<any>();
  const [premiumVisible, setPremiumVisible] = useState(false);
  const { isPremium } = useSubscription();
  const { logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>더보기</Text>
      <Text style={styles.subtitle}>건강 관리 메뉴</Text>

      {/* 프리미엄 배너 - 맨 위.
          EVENT_FREE_ACCESS 기간엔 결제 화면 진입로를 막고 이벤트 안내로 대체 (집 주소 노출 회피) */}
      {EVENT_FREE_ACCESS ? (
        <View style={[styles.premiumBanner, styles.premiumBannerEvent]}>
          <View style={styles.premiumIconBox}>
            <Icon name="crown" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumTitle} numberOfLines={1}>
              전 기능 무료 이벤트 진행 중
            </Text>
            <Text style={styles.premiumDesc} numberOfLines={2}>
              출시 기념 · 모든 프리미엄 기능 자유롭게 이용
            </Text>
          </View>
        </View>
      ) : (
        <PressableScale
          style={[styles.premiumBanner, isPremium && styles.premiumBannerActive]}
          onPress={() => setPremiumVisible(true)}
        >
          <View style={styles.premiumIconBox}>
            <Icon name="crown" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumTitle} numberOfLines={1}>
              {isPremium ? '쁠마 프리미엄 이용 중' : '쁠마 프리미엄'}
            </Text>
            <Text style={styles.premiumDesc} numberOfLines={2}>
              {isPremium ? 'AI 스캔 무제한 · 모든 기능 이용 가능' : 'AI 스캔 무제한 · 월 3,900원'}
            </Text>
          </View>
          <Icon name={isPremium ? 'gear' : 'chevronRight'} size={16} color={COLORS.primaryDark} />
        </PressableScale>
      )}

      <PremiumModal
        visible={premiumVisible}
        onClose={() => setPremiumVisible(false)}
      />

      {MENU_ITEMS.map((item) => (
        <PressableScale
          key={item.screen}
          style={styles.menuItem}
          onPress={() => {
            if (item.premium && !isPremium) {
              setPremiumVisible(true);
            } else {
              navigation.navigate(item.screen);
            }
          }}
        >
          <View style={[styles.iconBox, { backgroundColor: item.color + '22' }]}>
            <Icon name={item.icon} size={22} color={item.color} />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuLabel} numberOfLines={1}>{item.label}</Text>
            <Text style={styles.menuDesc} numberOfLines={2}>{item.desc}</Text>
          </View>
          {item.premium && !isPremium
            ? <Icon name="lock" size={14} color={COLORS.inactive} />
            : <Icon name="chevronRight" size={14} color={COLORS.inactive} />
          }
        </PressableScale>
      ))}

      {/* 로그아웃 - 제일 아래 */}
      <PressableScale
        style={styles.logoutBtn}
        onPress={handleLogout}
      >
        <Icon name="logout" size={14} color={COLORS.primaryDark} />
        <Text style={styles.logoutBtnText}>로그아웃</Text>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 88 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  subtitle: { fontSize: 16, color: '#8A7C9C', marginTop: 4, marginBottom: 24 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.card,
    borderRadius: 26,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: { flex: 1, minWidth: 0 },
  menuLabel: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  menuDesc: { fontSize: 14, color: COLORS.subText, marginTop: 2 },
  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.lavender, borderRadius: 26, padding: 18, marginBottom: 20,
    borderWidth: 1.5, borderColor: COLORS.purple,
  },
  premiumBannerActive: { backgroundColor: COLORS.pinkSoft, borderColor: COLORS.pink },
  premiumBannerEvent: { backgroundColor: COLORS.pinkSoft, borderColor: COLORS.pink },
  premiumIconBox: {
    width: 46, height: 46, borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  premiumTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  premiumDesc: { fontSize: 14, color: COLORS.subText, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.pinkSoft,
    borderRadius: 24,
    paddingVertical: 16,
    marginTop: 4,
  },
  logoutBtnText: { color: COLORS.primaryDark, fontSize: 17, fontWeight: '700' },
});
