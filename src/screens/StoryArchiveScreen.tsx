import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme';
import Icon from '../components/Icon';
import { useSubscription } from '../context/SubscriptionContext';
import PremiumModal from '../components/PremiumModal';
import PhotoViewerModal from '../components/PhotoViewerModal';

type StoryUpload = {
  uploadedAt: number;
  photoUrl: string;
  category: string;
  logDate: string;
};

const { width: SW } = Dimensions.get('window');
const COLS = 3;
const PAD = 16;
const GAP = 8;
const TILE = (SW - PAD * 2 - GAP * (COLS - 1)) / COLS;
const EXPIRY_MS = 24 * 60 * 60 * 1000;

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  const days = Math.floor(diff / 86400);
  return `${days}일 전`;
}

export default function StoryArchiveScreen() {
  const { isPremium } = useSubscription();
  const [uploads, setUploads] = useState<StoryUpload[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('@my_story_uploads');
      const arr: StoryUpload[] = raw ? JSON.parse(raw) : [];
      arr.sort((a, b) => b.uploadedAt - a.uploadedAt);
      setUploads(arr);
    } catch { /* ignore */ }
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isPremium) {
    return (
      <View style={styles.lockWrap}>
        <View style={styles.lockIconCircle}>
          <Icon name="lock" size={36} color="#fff" />
        </View>
        <Text style={styles.lockTitle}>스토리 보관함</Text>
        <Text style={styles.lockDesc}>
          만료된 내 스토리를 모아볼 수 있어요.{'\n'}프리미엄 기능입니다.
        </Text>
        <TouchableOpacity style={styles.lockBtn} onPress={() => setPremiumVisible(true)} activeOpacity={0.85}>
          <Icon name="crown" size={16} color="#fff" />
          <Text style={styles.lockBtnText}>프리미엄으로 잠금 해제</Text>
        </TouchableOpacity>
        <PremiumModal visible={premiumVisible} onClose={() => setPremiumVisible(false)} />
      </View>
    );
  }

  const now = Date.now();
  const expiredCount = uploads.filter(u => now - u.uploadedAt >= EXPIRY_MS).length;
  const activeCount = uploads.length - expiredCount;

  return (
    <View style={styles.root}>
      {/* 통계 헤더 */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: COLORS.primaryDark }]}>{activeCount}</Text>
          <Text style={styles.statLabel}>진행 중</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: COLORS.purpleDark }]}>{expiredCount}</Text>
          <Text style={styles.statLabel}>만료됨</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: COLORS.text }]}>{uploads.length}</Text>
          <Text style={styles.statLabel}>총 게시</Text>
        </View>
      </View>

      <FlatList
        data={uploads}
        keyExtractor={(item, idx) => `${item.uploadedAt}-${idx}`}
        numColumns={COLS}
        contentContainerStyle={{ padding: PAD, paddingBottom: 48 }}
        columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>아직 올린 스토리가 없어요</Text>
            <Text style={styles.emptyDesc}>친구 피드에서 스토리를 올려보세요.{'\n'}24시간 후 여기로 보관됩니다.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isExpired = now - item.uploadedAt >= EXPIRY_MS;
          return (
            <TouchableOpacity
              style={[styles.tile, { width: TILE, height: TILE }]}
              activeOpacity={0.85}
              onPress={() => setViewerUri(item.photoUrl)}
            >
              <Image source={{ uri: item.photoUrl }} style={styles.img} />
              {isExpired && (
                <View style={styles.expiredOverlay}>
                  <Text style={styles.expiredText}>만료</Text>
                </View>
              )}
              <View style={styles.tileBottom}>
                <Text style={styles.tileCategory} numberOfLines={1}>{item.category}</Text>
                <Text style={styles.tileTime}>{timeAgo(item.uploadedAt)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <PhotoViewerModal
        visible={viewerUri !== null}
        uri={viewerUri}
        onClose={() => setViewerUri(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  // 프리미엄 잠금
  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.bg },
  lockIconCircle: {
    width: 96, height: 96, borderRadius: 999, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 14, elevation: 8,
  },
  lockTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginBottom: 12 },
  lockDesc: { fontSize: 16, color: COLORS.subText, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  lockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.warning, paddingHorizontal: 22, paddingVertical: 17, borderRadius: 999,
    shadowColor: COLORS.warning, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  lockBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // 통계
  statsRow: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 20, paddingVertical: 16, alignItems: 'center',
    shadowColor: COLORS.purpleDark, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  statLabel: { fontSize: 13, color: COLORS.subText, fontWeight: '700' },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.border },

  // 타일
  tile: {
    borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.cardSoft,
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  expiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(74, 58, 92, 0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  expiredText: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  tileBottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  tileCategory: { fontSize: 13, fontWeight: '800', color: '#fff' },
  tileTime: { fontSize: 9, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

  // 빈 상태
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  emptyDesc: { fontSize: 15, color: COLORS.subText, textAlign: 'center', lineHeight: 20 },
});
