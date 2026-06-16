import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { getUserPublicProfile, sendFriendRequest } from '../api/api';
import { COLORS } from '../theme';

type RouteParams = { userId: number };

interface PublicEntry {
  date: string;
  category: string;
  photoUrl: string | null;
}

interface PublicProfile {
  id: number;
  nickname: string;
  recentEntries: PublicEntry[];
}

const CAT_COLORS: Record<string, string> = {
  '식단':  '#A98ED1',
  '오운완': '#A8D8B9',
  '술자리': '#A98ED1',
  '일상':  '#F5C99B',
};
const CAT_EMOJI: Record<string, string> = {
  '식단':  '',
  '오운완': '',
  '술자리': '',
  '일상':  '',
};

export default function FriendRequestScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const targetUserId = route.params?.userId;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUserId) {
      setError('잘못된 링크예요.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await getUserPublicProfile(targetUserId);
        setProfile(res.data);
      } catch {
        setError('프로필을 불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
    })();
  }, [targetUserId]);

  const handleAddFriend = async () => {
    if (!targetUserId || sending || sent) return;
    setSending(true);
    try {
      await sendFriendRequest(targetUserId);
      setSent(true);
      Alert.alert('친구 요청 완료', `${profile?.nickname ?? ''}님께 친구 요청을 보냈어요!`);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? '친구 요청에 실패했어요.';
      Alert.alert('오류', msg);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? '프로필을 찾을 수 없어요.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
      {/* 프로필 카드 */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {profile.nickname.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.nickname}>{profile.nickname}</Text>
        <Text style={styles.subLabel}>쁠마 사용 중</Text>
      </View>

      {/* 최근 기록 미리보기 */}
      {profile.recentEntries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>최근 기록</Text>
          <View style={styles.entryRow}>
            {profile.recentEntries.slice(0, 3).map((item, idx) => {
              const catColor = CAT_COLORS[item.category] ?? '#F5C99B';
              const catEmoji = CAT_EMOJI[item.category] ?? '';
              return (
                <View key={idx} style={styles.entryCard}>
                  {item.photoUrl ? (
                    <Image
                      source={{ uri: item.photoUrl }}
                      style={styles.entryPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.entryPhoto, { backgroundColor: catColor + '33', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 28 }}>{catEmoji}</Text>
                    </View>
                  )}
                  <View style={[styles.catDot, { backgroundColor: catColor }]} />
                  <Text style={styles.entryDate}>
                    {item.date.slice(5).replace('-', '.')}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 안내 텍스트 */}
      <Text style={styles.guideText}>
        친구 추가 시 서로의 칼로리 기록을{'\n'}확인하고 응원할 수 있어요
      </Text>

      {/* 친구 추가 버튼 */}
      <TouchableOpacity
        style={[styles.addBtn, sent && styles.addBtnDone]}
        onPress={handleAddFriend}
        disabled={sending || sent}
        activeOpacity={0.85}
      >
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.addBtnText}>
            {sent ? '요청 완료 ' : '친구 추가'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.appLabel}>쁠마 · 칼로리 다이어리</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F8',
  },
  errorText: {
    fontSize: 17,
    color: '#888',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#FFF5F8',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },

  // 프로필
  profileCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 28,
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
  },
  nickname: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4A3A5C',
    marginBottom: 4,
  },
  subLabel: {
    fontSize: 15,
    color: '#aaa',
  },

  // 최근 기록
  section: {
    width: '100%',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#555',
    marginBottom: 10,
  },
  entryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  entryCard: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  entryPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 22,
  },
  catDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  entryDate: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 4,
  },

  // 안내
  guideText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },

  // 버튼
  addBtn: {
    width: '100%',
    height: 54,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addBtnDone: {
    backgroundColor: '#A8D8B9',
  },
  addBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },

  appLabel: {
    fontSize: 14,
    color: '#ccc',
  },
});
