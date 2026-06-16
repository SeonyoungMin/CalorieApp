import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Alert,
  Share,
  TextInput,
  Clipboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useArchive } from '../hooks/useArchive';
import { COLORS } from '../theme';
import {
  getFriendFeed,
  getFriendStories,
  sendCheer,
  reactToEntry,
  getFriendStoryDetail,
  getFriendList,
  deleteFriend,
  sendFriendRequest,
  getReceivedFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  uploadArchivePhoto,
  getMyNotifications,
} from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_LAST_SEEN_KEY = '@notif_last_seen';

const UPLOAD_CATEGORIES: Array<{ kor: '식단' | '오운완' | '술자리' | '일상'; eng: 'meal' | 'workout' | 'drink' | 'daily'; emoji: string }> = [
  { kor: '식단',   eng: 'meal',    emoji: '' },
  { kor: '오운완', eng: 'workout', emoji: '' },
  { kor: '술자리', eng: 'drink',   emoji: '' },
  { kor: '일상',   eng: 'daily',   emoji: '' },
];

const { width: SW, height: SH } = Dimensions.get('window');
const STORY_PHOTO_HEIGHT = SH - 120; // 상단 헤더 영역 제외
const FEED_IMG_H = (SW - 32) * (9 / 16);

// ─── Types ────────────────────────────────────────────────────────────────────

interface FriendItem {
  id: number;
  nickname: string;
  recentPhoto: string | null;
}

interface StoryItem {
  userId: number;
  nickname: string;
  isMe: boolean;
  hasNew: boolean;
  isBestWeek: boolean;
  recentPhoto: string | null;
}

interface BestDietCard {
  type: 'best_diet';
  id: string;
  userId: number;
  nickname: string;
  streakDays: number;
  avgKcal: number;
  photos: string[];
}

interface GoalCard {
  type: 'goal_achieved';
  id: string;
  userId: number;
  nickname: string;
  todayKcal: number;
  goalKcal: number;
}

interface FeedEntry {
  type: 'feed';
  id: string;
  entryId: string;
  userId: number;
  nickname: string;
  category: '식단' | '오운완' | '술자리' | '일상';
  photos: string[];
  intake: number;
  burn: number;
  diary: string;
  createdAt: number;
  reactions: Record<string, number>;
  myReaction: string | null;
  exerciseMins?: number;
  exerciseType?: string;
  achieveRate?: number;
}

type FeedItem = BestDietCard | GoalCard | FeedEntry;

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ['전체', '식단', '운동', '술자리'];

const LIKE_REACTION = '좋아요';

const CAT_COLOR: Record<string, string> = {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function expiryProgress(createdAt: number): number {
  const elapsed = Date.now() - createdAt;
  return Math.max(0, 1 - elapsed / (24 * 60 * 60 * 1000));
}

// ─── Story Item ──────────────────────────────────────────────────────────────

function StoryBubble({
  item,
  onPress,
}: {
  item: StoryItem;
  onPress: (item: StoryItem) => void;
}) {
  const ringColor = item.isBestWeek
    ? '#F4A6C7'
    : item.hasNew
    ? COLORS.primary
    : '#ccc';
  const ringWidth = item.hasNew || item.isBestWeek ? 2.5 : 1.5;

  return (
    <TouchableOpacity style={storyStyles.wrap} onPress={() => onPress(item)} activeOpacity={0.8}>
      <View style={[storyStyles.ring, { borderColor: ringColor, borderWidth: ringWidth }]}>
        {item.recentPhoto ? (
          <Image source={{ uri: item.recentPhoto }} style={storyStyles.avatar} />
        ) : (
          <View style={[storyStyles.avatar, storyStyles.avatarPlaceholder]}>
            <Text style={storyStyles.avatarText}>
              {item.nickname.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      {item.isBestWeek && (
        <View style={storyStyles.bestBadge}>
          <Text style={storyStyles.bestBadgeText}>베스트</Text>
        </View>
      )}
      {item.isMe && (
        <View style={storyStyles.meAddBtn}>
          <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>+</Text>
        </View>
      )}
      <Text style={storyStyles.name} numberOfLines={1}>
        {item.isMe ? '내 스토리' : item.nickname}
      </Text>
    </TouchableOpacity>
  );
}

const storyStyles = StyleSheet.create({
  wrap:              { alignItems: 'center', marginHorizontal: 6, width: 76, overflow: 'visible' },
  ring:              { width: 62, height: 62, borderRadius: 31, padding: 2, marginBottom: 5 },
  avatar:            { width: '100%', height: '100%', borderRadius: 36 },
  avatarPlaceholder: { backgroundColor: COLORS.primary + '33', alignItems: 'center', justifyContent: 'center' },
  avatarText:        { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  bestBadge:         { position: 'absolute', top: -4, right: 2, backgroundColor: '#F4A6C7', borderRadius: 14, paddingHorizontal: 4, paddingVertical: 1 },
  bestBadgeText:     { fontSize: 9, color: '#fff', fontWeight: '700' },
  meAddBtn:          { position: 'absolute', bottom: 22, right: 4, width: 18, height: 18, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  name:              { fontSize: 13, color: '#555', textAlign: 'center', maxWidth: 64 },
});

// ─── Best Diet Card ───────────────────────────────────────────────────────────

function BestDietCardView({ item }: { item: BestDietCard }) {
  return (
    <View style={cardStyles.bestWrap}>
      <View style={cardStyles.bestTag}>
        <Text style={cardStyles.bestTagText}>이번 주 베스트 식단</Text>
      </View>
      <Text style={cardStyles.bestName}>{item.nickname}</Text>
      <View style={cardStyles.bestStats}>
        <Text style={cardStyles.bestStat}>{item.streakDays}일 연속 달성</Text>
        <Text style={cardStyles.bestStat}>  ·  </Text>
        <Text style={cardStyles.bestStat}>평균 {item.avgKcal} kcal</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
        {item.photos.slice(0, 4).map((p, i) => (
          <Image
            key={i}
            source={{ uri: p }}
            style={cardStyles.bestPhoto}
            resizeMode="cover"
          />
        ))}
        {item.photos.length === 0 && (
          <View style={[cardStyles.bestPhoto, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 28 }}></Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  bestWrap:     { backgroundColor: '#1a1a2e', borderRadius: 26, padding: 18, marginBottom: 12 },
  bestTag:      { backgroundColor: '#F4A6C7', borderRadius: 18, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 4, marginBottom: 10 },
  bestTagText:  { fontSize: 14, color: '#fff', fontWeight: '700' },
  bestName:     { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bestStats:    { flexDirection: 'row', alignItems: 'center' },
  bestStat:     { fontSize: 15, color: 'rgba(255,255,255,0.75)' },
  bestPhoto:    { width: 90, height: 90, borderRadius: 20, marginRight: 8 },
});

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCardView({
  item,
  cheered,
  onCheer,
}: {
  item: GoalCard;
  cheered: boolean;
  onCheer: () => void;
}) {
  const rate = Math.round((item.todayKcal / item.goalKcal) * 100);
  return (
    <View style={goalStyles.wrap}>
      <View style={goalStyles.left}>
        <View style={goalStyles.avatar}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>
            {item.nickname.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={goalStyles.name}>{item.nickname}님이</Text>
          <Text style={goalStyles.sub}>오늘 목표 달성! ({rate}%)</Text>
          <Text style={goalStyles.kcal}>{item.todayKcal} kcal</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[goalStyles.cheerBtn, cheered && goalStyles.cheerBtnDone]}
        onPress={onCheer}
        disabled={cheered}
        activeOpacity={0.8}
      >
        <Text style={goalStyles.cheerText}>
          {cheered ? '응원 완료 ' : '응원하기 '}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const goalStyles = StyleSheet.create({
  wrap:         { backgroundColor: '#FFFBEA', borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderWidth: 1, borderColor: '#FFE066' },
  left:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:       { width: 44, height: 44, borderRadius: 30, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  name:         { fontSize: 16, fontWeight: '700', color: '#4A3A5C' },
  sub:          { fontSize: 14, color: '#888', marginBottom: 2 },
  kcal:         { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  cheerBtn:     { backgroundColor: '#F5C99B', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 11 },
  cheerBtnDone: { backgroundColor: '#A8D8B9' },
  cheerText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ─── Feed Card ────────────────────────────────────────────────────────────────

function FeedCardView({
  item,
  myReaction,
  onReact,
}: {
  item: FeedEntry;
  myReaction: string | null;
  onReact: (entryId: string, reaction: string) => void;
}) {
  const catColor = CAT_COLOR[item.category] ?? '#F5C99B';
  const progress = expiryProgress(item.createdAt);
  const net = item.intake - item.burn;
  const liked = myReaction === LIKE_REACTION;
  const likeCount = (item.reactions?.[LIKE_REACTION] ?? 0) + (liked ? 1 : 0);

  return (
    <View style={feedStyles.card}>
      {/* Header */}
      <View style={feedStyles.header}>
        <View style={feedStyles.avatarCircle}>
          <Text style={feedStyles.avatarText}>
            {item.nickname.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={feedStyles.nickname}>{item.nickname}</Text>
          <Text style={feedStyles.timeAgo}>{timeAgo(item.createdAt)}</Text>
        </View>
        <View style={[feedStyles.catBadge, { backgroundColor: catColor + '22' }]}>
          <Text style={[feedStyles.catBadgeText, { color: catColor }]}>
            {CAT_EMOJI[item.category]} {item.category}
          </Text>
        </View>
      </View>

      {/* Photo */}
      {item.photos.length > 0 ? (
        <View style={feedStyles.photoWrap}>
          <Image
            source={{ uri: item.photos[0] }}
            style={[feedStyles.photo, { height: FEED_IMG_H }]}
            resizeMode="cover"
          />
          {/* 24h expiry bar */}
          <View style={feedStyles.expiryBg}>
            <View style={[feedStyles.expiryBar, { width: `${progress * 100}%` }]} />
          </View>
          {item.photos.length > 1 && (
            <View style={feedStyles.morePhotoBadge}>
              <Text style={feedStyles.morePhotoText}>+{item.photos.length - 1}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[feedStyles.photoWrap, feedStyles.photoEmpty, { height: FEED_IMG_H * 0.5 }]}>
          <Text style={{ fontSize: 40 }}>{CAT_EMOJI[item.category]}</Text>
        </View>
      )}

      {/* Calorie row */}
      <View style={feedStyles.calRow}>
        {item.category === '오운완' ? (
          <>
            <CalPill label="운동" value={`${item.exerciseMins ?? 0}분`} />
            <CalPill label="소모" value={`${item.burn}`} unit="kcal" />
            <CalPill label="종류" value={item.exerciseType ?? '-'} />
          </>
        ) : (
          <>
            <CalPill label="섭취" value={`${item.intake}`} unit="kcal" />
            <CalPill label="소모" value={`${item.burn}`} unit="kcal" />
            <CalPill
              label="순"
              value={`${Math.abs(net)}`}
              unit="kcal"
              valueColor={net > 0 ? '#F5A3B0' : '#A8D8B9'}
            />
          </>
        )}
      </View>

      {/* Diary */}
      {!!item.diary && (
        <Text style={feedStyles.diary} numberOfLines={3}>{item.diary}</Text>
      )}

      {/* Like button */}
      <View style={feedStyles.reactionRow}>
        <TouchableOpacity
          style={[feedStyles.likeBtn, liked && feedStyles.likeBtnActive]}
          onPress={() => onReact(item.entryId, LIKE_REACTION)}
          activeOpacity={0.75}
        >
          <Text style={[feedStyles.likeIcon, liked && { color: '#fff' }]}>
            {liked ? '' : ''}
          </Text>
          <Text style={[feedStyles.likeText, liked && { color: '#fff' }]}>
            좋아요{likeCount > 0 ? ` ${likeCount}` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CalPill({
  label,
  value,
  unit,
  valueColor,
}: {
  label: string;
  value: string;
  unit?: string;
  valueColor?: string;
}) {
  return (
    <View style={feedStyles.calPill}>
      <Text style={feedStyles.calLabel}>{label}</Text>
      <Text style={[feedStyles.calValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      {unit && <Text style={feedStyles.calUnit}>{unit}</Text>}
    </View>
  );
}

const feedStyles = StyleSheet.create({
  card:            { backgroundColor: '#fff', borderRadius: 26, marginBottom: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 32 },
  avatarCircle:    { width: 40, height: 40, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:      { fontSize: 19, fontWeight: '700', color: '#fff' },
  nickname:        { fontSize: 16, fontWeight: '700', color: '#4A3A5C' },
  timeAgo:         { fontSize: 13, color: '#aaa', marginTop: 1 },
  catBadge:        { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 3 },
  catBadgeText:    { fontSize: 14, fontWeight: '600' },
  photoWrap:       { position: 'relative' },
  photo:           { width: '100%' },
  photoEmpty:      { backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  expiryBg:        { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  expiryBar:       { height: 3, backgroundColor: '#fff' },
  morePhotoBadge:  { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 3 },
  morePhotoText:   { fontSize: 14, color: '#fff', fontWeight: '600' },
  calRow:          { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 15 },
  calPill:         { flex: 1, backgroundColor: '#F7F9FC', borderRadius: 18, paddingVertical: 11, alignItems: 'center' },
  calLabel:        { fontSize: 13, color: '#aaa', fontWeight: '600', marginBottom: 2 },
  calValue:        { fontSize: 17, fontWeight: '800', color: '#4A3A5C' },
  calUnit:         { fontSize: 12, color: '#bbb', marginTop: 1 },
  diary:           { fontSize: 15, color: '#666', fontStyle: 'italic', lineHeight: 20, paddingHorizontal: 20, marginBottom: 10 },
  reactionRow:     { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 36 },
  likeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 26, backgroundColor: '#F7F9FC',
    borderWidth: 1.5, borderColor: '#FF6B9D33',
  },
  likeBtnActive:   { backgroundColor: '#FF6B9D', borderColor: '#FF6B9D' },
  likeIcon:        { fontSize: 17 },
  likeText:        { fontSize: 15, fontWeight: '700', color: '#555' },
});

// ─── Story Detail Modal ──────────────────────────────────────────────────────

function StoryModal({
  story,
  visible,
  onClose,
}: {
  story: StoryItem | null;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  // 상단 헤더 ~80, 하단 안전영역까지 제외하여 사진이 화면 안에 완전히 맞도록
  const topBarHeight = 56 + Math.max(insets.top, 24);
  const bottomSafe = Math.max(insets.bottom, 16);
  const photoHeight = Math.max(200, SH - topBarHeight - bottomSafe);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible || !story) return;
    setPage(0);
    setLoading(true);
    (async () => {
      try {
        const res = await getFriendStoryDetail(story.userId);
        setPhotos(res.data?.photos ?? []);
      } catch {
        setPhotos(story.recentPhoto ? [story.recentPhoto] : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, story]);

  const goToPage = (next: number) => {
    if (next < 0 || next >= photos.length) return;
    setPage(next);
    flatListRef.current?.scrollToOffset({ offset: next * SW, animated: true });
  };

  const handleTap = (e: any) => {
    const x = e.nativeEvent.locationX;
    if (x < SW / 2) goToPage(page - 1);
    else goToPage(page + 1);
  };

  if (!story) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.bg}>
        {/* 상단 정보 */}
        <View style={modalStyles.topBar}>
          <View style={modalStyles.topAvatar}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: '#fff' }}>
              {story.nickname.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={modalStyles.topName}>{story.nickname}</Text>
            <Text style={modalStyles.topSub}>최근 24시간 기록</Text>
          </View>
          {/* 페이지 바 */}
          {photos.length > 1 && (
            <View style={modalStyles.pageBarRow}>
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={[modalStyles.pageBar, i === page && modalStyles.pageBarActive]}
                />
              ))}
            </View>
          )}
          <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
            <Text style={{ fontSize: 22, color: '#fff' }}></Text>
          </TouchableOpacity>
        </View>

        {/* 사진 */}
        {loading ? (
          <ActivityIndicator color="#fff" style={{ flex: 1 }} />
        ) : photos.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            style={{ flexGrow: 0 }}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
              setPage(idx);
            }}
            renderItem={({ item }) => (
              <TouchableWithoutFeedback onPress={handleTap}>
                <View style={{ width: SW, height: photoHeight, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
                  <Image
                    source={{ uri: item }}
                    style={{ width: SW, height: photoHeight }}
                    resizeMode="contain"
                  />
                </View>
              </TouchableWithoutFeedback>
            )}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 17 }}>기록이 없어요</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  bg:           { flex: 1, backgroundColor: '#000' },
  topBar:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingTop: 52 },
  topAvatar:    { width: 40, height: 40, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  topName:      { fontSize: 17, fontWeight: '700', color: '#fff' },
  topSub:       { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  pageBarRow:   { flexDirection: 'row', gap: 4, marginRight: 8 },
  pageBar:      { flex: 1, height: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.3)', minWidth: 20 },
  pageBarActive:{ backgroundColor: '#fff' },
  closeBtn:     { padding: 4 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function FriendFeedScreen() {
  const { userId, nickname, refreshProfile } = useAuth();
  const myArchive = useArchive();

  // userId가 비어있으면 프로필 재조회 시도 (최초 진입 시 fetchProfile이 네트워크 오류로 실패한 케이스 복구)
  // refreshProfile 자체는 AuthContext에서 매 렌더마다 재생성되므로 deps에 넣지 않음 (무한 호출 방지)
  useEffect(() => {
    if (!userId) {
      refreshProfile().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // 페이지네이션: 5개씩 점진 로드
  const PAGE_SIZE = 5;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // 응원/반응 로컬 상태
  const [cheeredSet, setCheeredSet] = useState<Set<number>>(new Set());
  const [reactionMap, setReactionMap] = useState<Record<string, string | null>>({});

  // 스토리 모달
  const [storyModalVisible, setStoryModalVisible] = useState(false);
  const [selectedStory, setSelectedStory] = useState<StoryItem | null>(null);

  // 친구 관리 모달
  const [friendModalVisible, setFriendModalVisible] = useState(false);
  const [friendModalTab, setFriendModalTab] = useState<'list' | 'requests'>('list');
  const [friendList, setFriendList] = useState<FriendItem[]>([]);
  const [friendListLoading, setFriendListLoading] = useState(false);
  const [addCodeInput, setAddCodeInput] = useState('');
  const [addCodeLoading, setAddCodeLoading] = useState(false);
  // 받은 친구 요청
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [requestBadge, setRequestBadge] = useState(0);

  // 스토리/피드 업로드 모달
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<typeof UPLOAD_CATEGORIES[0] | null>(null);
  const [uploading, setUploading] = useState(false);
  // true = 스토리(24h 보관함 추적) / false = 피드(영구)
  const [uploadAsStory, setUploadAsStory] = useState(true);

  // 좋아요 알림
  const [likeNotifBadge, setLikeNotifBadge] = useState(0);
  const [likeNotifs, setLikeNotifs] = useState<any[]>([]);
  const [notifModalVisible, setNotifModalVisible] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [storiesRes, feedRes, requestsRes, notifRes] = await Promise.allSettled([
        getFriendStories(),
        getFriendFeed(),
        getReceivedFriendRequests(),
        getMyNotifications(),
      ]);
      if (requestsRes.status === 'fulfilled') {
        const reqs = requestsRes.value.data ?? [];
        setRequestBadge(reqs.length);
      }
      if (notifRes.status === 'fulfilled') {
        const allNotifs: any[] = notifRes.value.data ?? [];
        setLikeNotifs(allNotifs);
        try {
          const lastSeenStr = await AsyncStorage.getItem(NOTIF_LAST_SEEN_KEY);
          const lastSeen = lastSeenStr ? parseInt(lastSeenStr, 10) : 0;
          const unread = allNotifs.filter(n => Number(n.createdAt) > lastSeen).length;
          setLikeNotifBadge(unread);
        } catch { /* ignore */ }
      }

      if (storiesRes.status === 'fulfilled') {
        const data: StoryItem[] = storiesRes.value.data ?? [];
        // 내 스토리 항상 앞에
        const mine = data.filter(s => s.isMe);
        const others = data.filter(s => !s.isMe);
        setStories([...mine, ...others]);
      }

      if (feedRes.status === 'fulfilled') {
        const raw: FeedItem[] = feedRes.value.data ?? [];
        setFeedItems(raw);
        // 기존 반응 상태 복원
        const initReact: Record<string, string | null> = {};
        raw.forEach(item => {
          if (item.type === 'feed') {
            initReact[item.entryId] = item.myReaction ?? null;
          }
        });
        setReactionMap(initReact);
      }
    } catch { /* 에러는 빈 상태로 */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setVisibleCount(PAGE_SIZE);
    loadData(true);
  };

  // 카테고리 변경 시 페이지 초기화
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory]);

  // 스토리 탭 (본인은 보기/올리기 선택, 친구는 보기)
  const handleStoryPress = (story: StoryItem) => {
    if (story.isMe) {
      if (story.hasNew) {
        Alert.alert('내 스토리', '무엇을 할까요?', [
          { text: '취소', style: 'cancel' },
          {
            text: '스토리 보기',
            onPress: () => { setSelectedStory(story); setStoryModalVisible(true); },
          },
          {
            text: '스토리 올리기',
            onPress: () => { setUploadCategory(null); setUploadModalVisible(true); },
          },
        ]);
      } else {
        setUploadCategory(null);
        setUploadModalVisible(true);
      }
    } else {
      setSelectedStory(story);
      setStoryModalVisible(true);
    }
  };

  // 사진 업로드 (카메라 또는 갤러리)
  const uploadStory = async (asset: Asset) => {
    if (!uploadCategory || !asset.uri) return;
    setUploading(true);
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const logDate = `${yyyy}-${mm}-${dd}`;

      const form = new FormData();
      form.append('image', {
        uri: asset.uri,
        type: asset.type ?? 'image/jpeg',
        name: asset.fileName ?? `story_${Date.now()}.jpg`,
      } as any);
      form.append('logDate', logDate);
      form.append('category', uploadCategory.eng);
      form.append('isPremium', 'false');

      const res = await uploadArchivePhoto(form);
      const imageUrl = res?.data?.imageUrl ?? asset.uri;
      // 스토리로 올린 경우 AsyncStorage에 기록 → 보관함 화면에서 24h+ 만료된 것 볼 수 있음
      if (uploadAsStory) {
        try {
          const existing = await AsyncStorage.getItem('@my_story_uploads') ?? '[]';
          const arr = JSON.parse(existing);
          arr.unshift({
            uploadedAt: Date.now(),
            photoUrl: imageUrl,
            category: uploadCategory.kor,
            logDate,
          });
          // 최근 200개만 유지
          await AsyncStorage.setItem('@my_story_uploads', JSON.stringify(arr.slice(0, 200)));
        } catch { /* ignore */ }
      }
      setUploadModalVisible(false);
      setUploadCategory(null);
      Alert.alert('업로드 완료', uploadAsStory ? '스토리에 게시됐어요! (24시간 후 만료)' : '피드에 게시됐어요!');
      loadData(true);
    } catch (e: any) {
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.message;
      const detail = serverMsg || e?.message || '알 수 없는 오류';
      console.error('[FriendFeed] uploadStory error:', status, JSON.stringify(e?.response?.data), e?.message);
      Alert.alert('업로드 실패', status ? `HTTP ${status}\n${detail}` : detail);
    } finally {
      setUploading(false);
    }
  };

  const pickFromCamera = async () => {
    if (!uploadCategory) return;
    try {
      const result = await launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: false });
      if (result.didCancel || !result.assets?.[0]) return;
      await uploadStory(result.assets[0]);
    } catch {
      Alert.alert('오류', '카메라를 열 수 없어요.');
    }
  };

  const pickFromLibrary = async () => {
    if (!uploadCategory) return;
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
      if (result.didCancel || !result.assets?.[0]) return;
      await uploadStory(result.assets[0]);
    } catch {
      Alert.alert('오류', '갤러리를 열 수 없어요.');
    }
  };

  // 응원
  const handleCheer = async (targetUserId: number) => {
    setCheeredSet(prev => new Set([...prev, targetUserId]));
    try {
      await sendCheer(targetUserId);
    } catch {
      setCheeredSet(prev => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
      Alert.alert('오류', '응원 전송에 실패했어요.');
    }
  };

  // 반응
  const handleReact = async (entryId: string, reaction: string) => {
    const prev = reactionMap[entryId] ?? null;
    const next = prev === reaction ? null : reaction;
    setReactionMap(m => ({ ...m, [entryId]: next }));
    try {
      await reactToEntry(entryId, next ?? '');
    } catch {
      setReactionMap(m => ({ ...m, [entryId]: prev }));
    }
  };

  // 친구 관리 모달 열기
  const handleOpenFriendModal = async (tab: 'list' | 'requests' = 'list') => {
    setFriendModalTab(tab);
    setFriendModalVisible(true);
    setFriendListLoading(true);
    setPendingLoading(true);
    try {
      const [listRes, reqRes] = await Promise.allSettled([
        getFriendList(),
        getReceivedFriendRequests(),
      ]);
      setFriendList(listRes.status === 'fulfilled' ? (listRes.value.data ?? []) : []);
      const reqs = reqRes.status === 'fulfilled' ? (reqRes.value.data ?? []) : [];
      setPendingRequests(reqs);
      setRequestBadge(reqs.length);
    } catch {
      setFriendList([]);
      setPendingRequests([]);
    } finally {
      setFriendListLoading(false);
      setPendingLoading(false);
    }
  };

  // 친구 요청 수락
  const handleAcceptRequest = async (req: any) => {
    try {
      await acceptFriendRequest(req.requestId);
      setPendingRequests(prev => prev.filter(r => r.requestId !== req.requestId));
      setRequestBadge(prev => Math.max(0, prev - 1));
      const res = await getFriendList();
      setFriendList(res.data ?? []);
      Alert.alert('친구 추가', `${req.fromNickname}님과 친구가 됐어요!`);
    } catch {
      Alert.alert('오류', '요청 처리에 실패했어요.');
    }
  };

  // 친구 요청 거절
  const handleRejectRequest = async (req: any) => {
    try {
      await rejectFriendRequest(req.requestId);
      setPendingRequests(prev => prev.filter(r => r.requestId !== req.requestId));
      setRequestBadge(prev => Math.max(0, prev - 1));
    } catch {
      Alert.alert('오류', '요청 처리에 실패했어요.');
    }
  };

  // 코드로 친구 추가
  const handleAddByCode = async () => {
    const code = addCodeInput.trim().replace(/^#/, '');
    const targetId = parseInt(code, 10);
    if (!code || isNaN(targetId)) {
      Alert.alert('오류', '올바른 친구 코드를 입력해주세요.');
      return;
    }
    if (targetId === userId) {
      Alert.alert('오류', '본인 코드는 추가할 수 없어요.');
      return;
    }
    setAddCodeLoading(true);
    try {
      await sendFriendRequest(targetId);
      setAddCodeInput('');
      Alert.alert('친구 추가 완료', '친구 추가 요청을 보냈어요!');
      const res = await getFriendList();
      setFriendList(res.data ?? []);
    } catch (e: any) {
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.message ?? e?.response?.data ?? null;
      let msg = '친구 추가에 실패했어요.';
      if (status === 404) msg = '해당 코드의 유저를 찾을 수 없어요.';
      else if (status === 409) msg = '이미 친구이거나 요청을 보낸 상태예요.';
      else if (serverMsg) msg = String(serverMsg);
      Alert.alert('오류', msg + (status ? ` (${status})` : ''));
    } finally {
      setAddCodeLoading(false);
    }
  };

  // 친구 초대 링크 공유
  const handleInviteFriend = async () => {
    if (!userId) {
      Alert.alert('알림', '로그인 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    const storeUrl = 'https://play.google.com/store/apps/details?id=com.calorieapp.kals';
    const deepLink = `cals://add-friend?userId=${userId}`;
    const me = nickname || '쁠마 유저';
    try {
      await Share.share({
        title: '쁠마 친구 추가',
        message:
          `${me}님이 쁠마에서 친구 추가 요청을 보냈어요\n\n` +
          `쁠마 앱이 있다면:\n${deepLink}\n\n` +
          `또는 친구 코드 입력:\n#${userId}\n\n` +
          `앱 설치:\n${storeUrl}`,
      });
    } catch {}
  };

  // 친구 삭제
  const handleDeleteFriend = (friend: FriendItem) => {
    Alert.alert(
      '친구 삭제',
      `${friend.nickname}님을 친구 목록에서 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFriend(friend.id);
              setFriendList(prev => prev.filter(f => f.id !== friend.id));
            } catch {
              Alert.alert('오류', '친구 삭제에 실패했어요.');
            }
          },
        },
      ],
    );
  };

  // 내 archive entries를 FeedEntry로 변환 (본인 피드도 자신에게 보이도록)
  const myFeedEntries: FeedEntry[] = myArchive.entries.map(e => ({
    type: 'feed' as const,
    id: `my-${e.id}`,
    entryId: e.id,
    userId: Number(userId) || 0,
    nickname: nickname || '나',
    category: e.category as FeedEntry['category'],
    photos: e.photos,
    intake: e.intake,
    burn: e.burn,
    diary: e.memo,
    createdAt: e.createdAt,
    reactions: {},
    myReaction: null,
  }));

  // 서버 친구 피드 + 내 archive entries 머지 (중복 제거: entryId)
  const seenEntryIds = new Set(feedItems.filter(it => it.type === 'feed').map(it => (it as FeedEntry).entryId));
  const mineOnly = myFeedEntries.filter(e => !seenEntryIds.has(e.entryId));
  const combinedFeed: FeedItem[] = [...feedItems, ...mineOnly].sort((a, b) => {
    const aTs = a.type === 'feed' ? (a as FeedEntry).createdAt : 0;
    const bTs = b.type === 'feed' ? (b as FeedEntry).createdAt : 0;
    return bTs - aTs;
  });

  // 카테고리 필터
  const filteredFeed = combinedFeed.filter(item => {
    if (activeCategory === '전체') return true;
    if (item.type === 'best_diet') return activeCategory === '식단';
    if (item.type === 'goal_achieved') return true;
    const map: Record<string, string> = { '식단': '식단', '운동': '오운완', '술자리': '술자리' };
    return (item as FeedEntry).category === (map[activeCategory] ?? activeCategory);
  });

  // 피드 렌더링
  const renderItem = ({ item }: { item: FeedItem }) => {
    if (item.type === 'best_diet') {
      return <BestDietCardView item={item} />;
    }
    if (item.type === 'goal_achieved') {
      return (
        <GoalCardView
          item={item}
          cheered={cheeredSet.has(item.userId)}
          onCheer={() => handleCheer(item.userId)}
        />
      );
    }
    // type === 'feed'
    const feedItem = item as FeedEntry;
    return (
      <FeedCardView
        item={feedItem}
        myReaction={reactionMap[feedItem.entryId] ?? null}
        onReact={handleReact}
      />
    );
  };

  const ListHeader = (
    <>
      {/* 스토리 바 */}
      <View style={styles.storySection}>
        <View style={styles.storySectionHeader}>
          <Text style={styles.storySectionTitle}>친구 스토리</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {likeNotifBadge > 0 && (
              <TouchableOpacity
                onPress={async () => {
                  setNotifModalVisible(true);
                  try {
                    await AsyncStorage.setItem(NOTIF_LAST_SEEN_KEY, String(Date.now()));
                  } catch {}
                  setLikeNotifBadge(0);
                }}
                activeOpacity={0.7}
                style={[styles.friendListBtn, { backgroundColor: '#FF6B9D' + '22', borderColor: '#FF6B9D' }]}
              >
                <Text style={[styles.friendListBtnText, { color: '#FF6B9D' }]}>{likeNotifBadge}</Text>
              </TouchableOpacity>
            )}
            {requestBadge > 0 && (
              <TouchableOpacity onPress={() => handleOpenFriendModal('requests')} activeOpacity={0.7} style={[styles.friendListBtn, { backgroundColor: '#E53935' + '18', borderColor: '#E53935' }]}>
                <Text style={[styles.friendListBtnText, { color: '#E53935' }]}>요청 {requestBadge}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => handleOpenFriendModal('list')} activeOpacity={0.7} style={styles.friendListBtn}>
              <Text style={styles.friendListBtnText}>친구 관리</Text>
            </TouchableOpacity>
          </View>
        </View>
        {stories.length === 0 ? (
          <View style={styles.storyEmpty}>
            <Text style={styles.storyEmptyText}>친구를 추가하면 스토리가 표시돼요</Text>
          </View>
        ) : (
          <FlatList
            data={stories}
            horizontal
            keyExtractor={s => String(s.userId)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: 28, paddingVertical: 11 }}
            renderItem={({ item }) => (
              <StoryBubble item={item} onPress={handleStoryPress} />
            )}
          />
        )}
      </View>

      {/* 올리기 버튼 — 스토리 / 피드 */}
      <View style={styles.uploadBtnRow}>
        <TouchableOpacity
          style={[styles.uploadBtn, { backgroundColor: COLORS.pinkSoft }]}
          onPress={() => { setUploadAsStory(true); setUploadCategory(null); setUploadModalVisible(true); }}
          activeOpacity={0.85}
        >
          <Text style={[styles.uploadBtnTitle, { color: COLORS.primaryDark }]}>스토리 올리기</Text>
          <Text style={styles.uploadBtnDesc}>24시간 후 만료</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.uploadBtn, { backgroundColor: COLORS.lavender }]}
          onPress={() => { setUploadAsStory(false); setUploadCategory(null); setUploadModalVisible(true); }}
          activeOpacity={0.85}
        >
          <Text style={[styles.uploadBtnTitle, { color: COLORS.purpleDark }]}>피드 올리기</Text>
          <Text style={styles.uploadBtnDesc}>피드에 영구 게시</Text>
        </TouchableOpacity>
      </View>

      {/* 카테고리 탭 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabRow}
        contentContainerStyle={{ paddingHorizontal: 22, paddingVertical: 11, gap: 8 }}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.tabBtn, activeCategory === cat && styles.tabBtnActive]}
            onPress={() => setActiveCategory(cat)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={filteredFeed.slice(0, visibleCount)}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (visibleCount < filteredFeed.length) {
            setVisibleCount(c => Math.min(c + PAGE_SIZE, filteredFeed.length));
          }
        }}
        ListFooterComponent={
          visibleCount < filteredFeed.length ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>

            <Text style={styles.emptyTitle}>아직 피드가 없어요</Text>
            <Text style={styles.emptySub}>친구를 추가하면 기록이 여기에 표시돼요</Text>
          </View>
        }
      />

      <StoryModal
        story={selectedStory}
        visible={storyModalVisible}
        onClose={() => setStoryModalVisible(false)}
      />

      {/* 좋아요 알림 모달 */}
      <Modal
        visible={notifModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNotifModalVisible(false)}
      >
        <View style={uploadStyles.overlay}>
          <View style={uploadStyles.sheet}>
            <View style={uploadStyles.header}>
              <Text style={uploadStyles.title}>좋아요 알림</Text>
              <TouchableOpacity onPress={() => setNotifModalVisible(false)} style={uploadStyles.closeBtn}>
                <Text style={uploadStyles.closeBtnText}></Text>
              </TouchableOpacity>
            </View>
            {likeNotifs.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}></Text>
                <Text style={{ fontSize: 16, color: '#888' }}>아직 받은 좋아요가 없어요</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {likeNotifs.map((n, i) => (
                  <View key={`${n.entryId}_${n.fromUserId}_${i}`} style={notifStyles.item}>
                    <View style={notifStyles.avatar}>
                      <Text style={notifStyles.avatarText}>
                        {(n.fromNickname ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={notifStyles.text}>
                        <Text style={notifStyles.bold}>{n.fromNickname}</Text>
                        님이 회원님의 게시물을 좋아합니다
                      </Text>
                      <Text style={notifStyles.time}>{timeAgo(Number(n.createdAt))}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 스토리 업로드 모달 */}
      <Modal
        visible={uploadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !uploading && setUploadModalVisible(false)}
      >
        <View style={uploadStyles.overlay}>
          <View style={uploadStyles.sheet}>
            <View style={uploadStyles.header}>
              <Text style={uploadStyles.title}>스토리 올리기</Text>
              <TouchableOpacity
                onPress={() => !uploading && setUploadModalVisible(false)}
                disabled={uploading}
                style={uploadStyles.closeBtn}
              >
                <Text style={uploadStyles.closeBtnText}></Text>
              </TouchableOpacity>
            </View>

            <Text style={uploadStyles.section}>1. 카테고리 선택</Text>
            <View style={uploadStyles.categoryRow}>
              {UPLOAD_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.kor}
                  style={[
                    uploadStyles.categoryBtn,
                    uploadCategory?.kor === cat.kor && uploadStyles.categoryBtnActive,
                  ]}
                  onPress={() => setUploadCategory(cat)}
                  disabled={uploading}
                  activeOpacity={0.7}
                >
                  <Text style={uploadStyles.categoryEmoji}>{cat.emoji}</Text>
                  <Text
                    style={[
                      uploadStyles.categoryLabel,
                      uploadCategory?.kor === cat.kor && uploadStyles.categoryLabelActive,
                    ]}
                  >
                    {cat.kor}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={uploadStyles.section}>2. 사진 가져오기</Text>
            <View style={uploadStyles.sourceRow}>
              <TouchableOpacity
                style={[uploadStyles.sourceBtn, !uploadCategory && uploadStyles.sourceBtnDisabled]}
                onPress={pickFromCamera}
                disabled={!uploadCategory || uploading}
                activeOpacity={0.8}
              >
                <Text style={uploadStyles.sourceEmoji}></Text>
                <Text style={uploadStyles.sourceLabel}>카메라</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[uploadStyles.sourceBtn, !uploadCategory && uploadStyles.sourceBtnDisabled]}
                onPress={pickFromLibrary}
                disabled={!uploadCategory || uploading}
                activeOpacity={0.8}
              >
                <Text style={uploadStyles.sourceEmoji}></Text>
                <Text style={uploadStyles.sourceLabel}>갤러리</Text>
              </TouchableOpacity>
            </View>

            {uploading && (
              <View style={uploadStyles.uploadingBox}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={uploadStyles.uploadingText}>업로드 중...</Text>
              </View>
            )}

            <Text style={uploadStyles.hint}>* 24시간 동안 친구들에게 공개돼요</Text>
          </View>
        </View>
      </Modal>

      {/* 친구 관리 모달 */}
      <Modal
        visible={friendModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFriendModalVisible(false)}
      >
        <View style={friendListStyles.overlay}>
          <View style={friendListStyles.sheet}>
            {/* 헤더 */}
            <View style={friendListStyles.header}>
              <Text style={friendListStyles.title}>친구 관리</Text>
              <TouchableOpacity onPress={() => setFriendModalVisible(false)} style={friendListStyles.closeBtn}>
                <Text style={friendListStyles.closeBtnText}></Text>
              </TouchableOpacity>
            </View>

            {/* 탭 */}
            <View style={friendListStyles.tabRow}>
              <TouchableOpacity
                style={[friendListStyles.tab, friendModalTab === 'list' && friendListStyles.tabActive]}
                onPress={() => setFriendModalTab('list')}
              >
                <Text style={[friendListStyles.tabText, friendModalTab === 'list' && friendListStyles.tabTextActive]}>친구 목록</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[friendListStyles.tab, friendModalTab === 'requests' && friendListStyles.tabActive]}
                onPress={() => setFriendModalTab('requests')}
              >
                <Text style={[friendListStyles.tabText, friendModalTab === 'requests' && friendListStyles.tabTextActive]}>
                  친구 요청{pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>

            {friendModalTab === 'list' ? (
              <>
                {/* 내 친구 코드 */}
                <View style={friendListStyles.myCodeBox}>
                  <Text style={friendListStyles.myCodeLabel}>{nickname ? `${nickname}님의 친구 코드` : '내 친구 코드'}</Text>
                  <View style={friendListStyles.myCodeRow}>
                    <Text style={friendListStyles.myCodeValue}>{userId ? `#${userId}` : '불러오는 중...'}</Text>
                    {userId ? (
                      <>
                        <TouchableOpacity
                          style={friendListStyles.copyBtn}
                          onPress={() => {
                            Clipboard.setString(String(userId));
                            Alert.alert('복사됨', '친구 코드가 클립보드에 복사됐어요!');
                          }}
                        >
                          <Text style={friendListStyles.copyBtnText}>복사</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={friendListStyles.shareCodeBtn}
                          onPress={handleInviteFriend}
                        >
                          <Text style={friendListStyles.shareCodeBtnText}>공유</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={friendListStyles.shareCodeBtn}
                        onPress={() => { refreshProfile().catch(() => {}); }}
                      >
                        <Text style={friendListStyles.shareCodeBtnText}>다시 시도</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* 코드로 친구 추가 */}
                <View style={friendListStyles.addCodeBox}>
                  <Text style={friendListStyles.addCodeLabel}>코드로 친구 추가</Text>
                  <View style={friendListStyles.addCodeRow}>
                    <TextInput
                      style={friendListStyles.addCodeInput}
                      placeholder="친구 코드 입력 (예: 1234)"
                      placeholderTextColor="#bbb"
                      value={addCodeInput}
                      onChangeText={setAddCodeInput}
                      keyboardType="numeric"
                      returnKeyType="send"
                      onSubmitEditing={handleAddByCode}
                    />
                    <TouchableOpacity
                      style={[friendListStyles.addCodeBtn, addCodeLoading && { opacity: 0.6 }]}
                      onPress={handleAddByCode}
                      disabled={addCodeLoading}
                      activeOpacity={0.8}
                    >
                      {addCodeLoading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={friendListStyles.addCodeBtnText}>추가</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 친구 목록 */}
                {friendListLoading ? (
                  <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
                ) : friendList.length === 0 ? (
                  <View style={friendListStyles.empty}>
                    <Text style={friendListStyles.emptyEmoji}></Text>
                    <Text style={friendListStyles.emptyText}>아직 친구가 없어요</Text>
                    <Text style={friendListStyles.emptySub}>위 코드 입력으로 친구를 추가해보세요</Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 72 }}>
                    <Text style={friendListStyles.countText}>{friendList.length}명의 친구</Text>
                    {friendList.map(friend => (
                      <View key={friend.id} style={friendListStyles.row}>
                        <View style={friendListStyles.avatarWrap}>
                          {friend.recentPhoto ? (
                            <Image source={{ uri: friend.recentPhoto }} style={friendListStyles.avatar} />
                          ) : (
                            <View style={[friendListStyles.avatar, friendListStyles.avatarPlaceholder]}>
                              <Text style={friendListStyles.avatarText}>
                                {friend.nickname.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={friendListStyles.nickname}>{friend.nickname}</Text>
                        <TouchableOpacity
                          onPress={() => handleDeleteFriend(friend)}
                          style={friendListStyles.deleteBtn}
                          activeOpacity={0.7}
                        >
                          <Text style={friendListStyles.deleteBtnText}>삭제</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            ) : (
              /* 친구 요청 탭 */
              pendingLoading ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
              ) : pendingRequests.length === 0 ? (
                <View style={friendListStyles.empty}>
                  <Text style={friendListStyles.emptyEmoji}></Text>
                  <Text style={friendListStyles.emptyText}>받은 친구 요청이 없어요</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 72 }}>
                  {pendingRequests.map(req => (
                    <View key={req.requestId} style={friendListStyles.requestRow}>
                      <View style={friendListStyles.avatarWrap}>
                        {req.fromPhoto ? (
                          <Image source={{ uri: req.fromPhoto }} style={friendListStyles.avatar} />
                        ) : (
                          <View style={[friendListStyles.avatar, friendListStyles.avatarPlaceholder]}>
                            <Text style={friendListStyles.avatarText}>
                              {(req.fromNickname ?? '?').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[friendListStyles.nickname, { flex: 1 }]}>{req.fromNickname}</Text>
                      <TouchableOpacity
                        style={friendListStyles.acceptBtn}
                        onPress={() => handleAcceptRequest(req)}
                        activeOpacity={0.8}
                      >
                        <Text style={friendListStyles.acceptBtnText}>수락</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={friendListStyles.rejectBtn}
                        onPress={() => handleRejectRequest(req)}
                        activeOpacity={0.8}
                      >
                        <Text style={friendListStyles.rejectBtnText}>거절</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#FFF5F8' },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF5F8' },
  listContent:     { paddingHorizontal: 22, paddingBottom: 72 },

  storySection:       { backgroundColor: '#fff', marginBottom: 8 },
  storySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 12 },
  storySectionTitle:  { fontSize: 15, fontWeight: '700', color: '#888' },
  friendListBtn:      { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 20, backgroundColor: COLORS.primary + '18' },
  friendListBtnText:  { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  storyEmpty:         { paddingHorizontal: 22, paddingVertical: 18, alignItems: 'center' },
  storyEmptyText:     { fontSize: 15, color: '#bbb' },

  uploadBtnRow:    { flexDirection: 'row', gap: 10, paddingHorizontal: 22, paddingVertical: 15, backgroundColor: '#fff', marginBottom: 8 },
  uploadBtn:       { flex: 1, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 14, alignItems: 'flex-start', justifyContent: 'center' },
  uploadBtnTitle:  { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  uploadBtnDesc:   { fontSize: 13, color: COLORS.subText, fontWeight: '600' },

  tabRow:          { marginBottom: 10 },
  tabBtn:          { paddingHorizontal: 22, paddingVertical: 7, borderRadius: 26, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0E1EC' },
  tabBtnActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText:         { fontSize: 15, fontWeight: '600', color: '#666' },
  tabTextActive:   { color: '#fff' },

  emptyWrap:       { alignItems: 'center', paddingTop: 60 },
  emptyEmoji:      { fontSize: 48, marginBottom: 12 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: '#555', marginBottom: 6 },
  emptySub:        { fontSize: 16, color: '#aaa', textAlign: 'center' },
});

const friendListStyles = StyleSheet.create({
  overlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 20,
  },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title:             { fontSize: 18, fontWeight: '800', color: '#4A3A5C' },
  closeBtn:          { padding: 4 },
  closeBtnText:      { fontSize: 20, color: '#aaa' },
  countText:         { fontSize: 15, color: '#aaa', fontWeight: '600', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#FFF5F8',
  },
  avatarWrap:        { marginRight: 12 },
  avatar:            { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: { backgroundColor: COLORS.primary + '22', alignItems: 'center', justifyContent: 'center' },
  avatarText:        { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  nickname:          { flex: 1, fontSize: 17, fontWeight: '600', color: '#4A3A5C' },
  deleteBtn:         { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 18, backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFCDD2' },
  deleteBtnText:     { fontSize: 15, fontWeight: '700', color: '#E53935' },
  inviteBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteBtnText:     { fontSize: 16, fontWeight: '700', color: '#fff' },
  empty:             { alignItems: 'center', paddingVertical: 32 },
  emptyEmoji:        { fontSize: 44, marginBottom: 12 },
  emptyText:         { fontSize: 17, fontWeight: '700', color: '#555', marginBottom: 6 },
  emptySub:          { fontSize: 15, color: '#aaa', textAlign: 'center' },

  // 내 코드 박스
  myCodeBox: {
    backgroundColor: COLORS.primary + '12',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  myCodeLabel: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginBottom: 8 },
  myCodeRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  myCodeValue: { flex: 1, fontSize: 22, fontWeight: '800', color: COLORS.primary, letterSpacing: 1 },
  copyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  copyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // 코드 추가 박스
  addCodeBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
  },
  addCodeLabel: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8 },
  addCodeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addCodeInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 13,
    fontSize: 17,
    color: '#4A3A5C',
    backgroundColor: '#fff',
  },
  addCodeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 13,
    minWidth: 60,
    alignItems: 'center',
  },
  addCodeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // 탭
  tabRow: { flexDirection: 'row', marginBottom: 14, borderRadius: 18, backgroundColor: '#FFF5F8', padding: 4 },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 16 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 16, fontWeight: '600', color: '#888' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },

  // 코드 공유 버튼
  shareCodeBtn: {
    backgroundColor: '#FFF5F8',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  shareCodeBtnText: { fontSize: 15, fontWeight: '600', color: '#555' },

  // 친구 요청 row
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#FFF5F8',
    gap: 8,
  },
  acceptBtn: { backgroundColor: COLORS.primary, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 6 },
  acceptBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  rejectBtn: { backgroundColor: '#FFF0F0', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 6, borderWidth: 1, borderColor: '#FFCDD2' },
  rejectBtnText: { fontSize: 15, fontWeight: '700', color: '#E53935' },
});

const notifStyles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#FFF5F8' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FF6B9D', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 19, fontWeight: '700', color: '#fff' },
  text: { fontSize: 16, color: '#4A3A5C' },
  bold: { fontWeight: '700' },
  time: { fontSize: 13, color: '#aaa', marginTop: 2 },
});

const uploadStyles = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 64,
  },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title:          { fontSize: 19, fontWeight: '800', color: '#4A3A5C' },
  closeBtn:       { padding: 4 },
  closeBtnText:   { fontSize: 20, color: '#aaa' },
  section:        { fontSize: 15, fontWeight: '700', color: '#666', marginBottom: 10, marginTop: 4 },
  categoryRow:    { flexDirection: 'row', gap: 8, marginBottom: 18 },
  categoryBtn: {
    flex: 1,
    paddingVertical: 17,
    borderRadius: 20,
    backgroundColor: '#F7F9FC',
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 4,
  },
  categoryBtnActive: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
  categoryEmoji:  { fontSize: 24 },
  categoryLabel:  { fontSize: 14, fontWeight: '600', color: '#888' },
  categoryLabelActive: { color: COLORS.primary, fontWeight: '700' },
  sourceRow:      { flexDirection: 'row', gap: 12, marginBottom: 14 },
  sourceBtn: {
    flex: 1,
    paddingVertical: 24,
    borderRadius: 22,
    backgroundColor: '#F7F9FC',
    alignItems: 'center',
    gap: 6,
  },
  sourceBtnDisabled: { opacity: 0.4 },
  sourceEmoji:    { fontSize: 32 },
  sourceLabel:    { fontSize: 16, fontWeight: '700', color: '#4A3A5C' },
  uploadingBox:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15 },
  uploadingText:  { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  hint:           { fontSize: 14, color: '#aaa', textAlign: 'center', marginTop: 6 },
});
