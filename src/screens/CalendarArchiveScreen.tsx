import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
  Image, TextInput, Animated, PanResponder, Dimensions, Modal,
  ActivityIndicator, Alert, Platform, Pressable,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSubscription } from '../hooks/useSubscription';
import { useArchive, ArchivePhoto, ImageCategory } from '../hooks/useArchive';
import { buildPickerOptions } from '../services/imageUploadService';
import ShareCardView from '../components/ShareCardView';
import { shareToInstagramStory } from '../utils/ShareCard';
import { ArchiveEntry } from '../types/archive';
import { COLORS } from '../theme';
import Icon from '../components/Icon';
import PhotoViewerModal from '../components/PhotoViewerModal';
import { localDateStr } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

// 영문→한글 카테고리 매핑 (공유 카드용)
const TO_KR_CAT: Record<string, ArchiveEntry['category']> = {
  meal:    '식단',
  workout: '오운완',
  drink:   '술자리',
  daily:   '일상',
  all:     '일상',
};

const { width: SW, height: SH } = Dimensions.get('window');
const MAX_W = Math.min(SW, 480);
const SHEET_H = SH * 0.72;
const CELL_SIZE = Math.floor((MAX_W - 16) / 7);

// ─── 카테고리 정의 ────────────────────────────────────────────────────────────
type Category = 'all' | ImageCategory;

const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: 'all',     label: '전체',   color: COLORS.primary },
  { id: 'meal',    label: '식단', color: '#A98ED1' },
  { id: 'workout', label: '오운완', color: '#A8D8B9' },
  { id: 'drink',   label: '술자리', color: '#A98ED1' },
  { id: 'daily',   label: '일상',  color: '#F5C99B' },
];

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
function pad2(n: number) { return String(n).padStart(2, '0'); }
function ymd(y: number, m: number, d: number) { return `${y}-${pad2(m)}-${pad2(d)}`; }

function buildCalendarDays(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const total = new Date(year, month, 0).getDate();
  const days: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= total; d++) days.push(ymd(year, month, d));
  // 6주 고정 (42칸)
  while (days.length < 42) days.push(null);
  return days;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CalendarArchiveScreen({ route }: any) {
  const { isPremium } = useSubscription();
  const { userId } = useAuth();
  const archive = useArchive();

  const today = localDateStr();
  const [todayY, todayM] = today.split('-').map(Number);

  const [year,  setYear]  = useState(todayY);
  const [month, setMonth] = useState(todayM);
  const [filter, setFilter] = useState<Category>('all');

  // BottomSheet 상태
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slideIdx,     setSlideIdx]     = useState(0);
  const [diaryEdit,    setDiaryEdit]    = useState(false);
  const [diaryDraft,   setDiaryDraft]   = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);

  // Animated bottom sheet
  const sheetY = useRef(new Animated.Value(SHEET_H)).current;

  // 공유 카드 캡처용 ref
  const shareCardRef = useRef<ViewShot>(null);

  // 슬라이더 ref (사진 추가 후 자동 이동용)
  const sliderRef = useRef<any>(null);

  const openSheet = useCallback((date: string) => {
    setSelectedDate(date);
    setSlideIdx(0);
    setDiaryEdit(false);
    setSheetVisible(true);
    archive.loadDiary(date);
    archive.loadDayCals(date);
    Animated.spring(sheetY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [archive, sheetY]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: SHEET_H,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setSheetVisible(false);
      setSelectedDate(null);
    });
  }, [sheetY]);

  // 드래그로 시트 닫기
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) sheetY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > SHEET_H * 0.3 || g.vy > 0.6) {
          closeSheet();
        } else {
          Animated.spring(sheetY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  // 월 변경 시 데이터 로드
  useFocusEffect(
    useCallback(() => {
      archive.loadMonth(year, month);
    }, [year, month, archive.loadMonth])
  );

  // route.params.initialDate 가 있으면 해당 날짜 BottomSheet 자동 오픈
  useEffect(() => {
    const initialDate: string | undefined = route?.params?.initialDate;
    if (!initialDate) return;
    const [y, m] = initialDate.split('-').map(Number);
    setYear(y);
    setMonth(m);
    const timer = setTimeout(() => openSheet(initialDate), 350);
    return () => clearTimeout(timer);
  }, [route?.params?.initialDate]);

  // 월 이동
  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // 필터된 날짜별 사진
  const filteredPhotoMap: Record<string, ArchivePhoto[]> = {};
  for (const [date, photos] of Object.entries(archive.photoMap)) {
    const filtered = filter === 'all' ? photos : photos.filter(p => p.category === filter);
    if (filtered.length) filteredPhotoMap[date] = filtered;
  }

  const calDays = buildCalendarDays(year, month);

  // 날짜 셀 렌더
  const renderDayCell = (dateStr: string | null, idx: number) => {
    const key = dateStr ?? `empty-${idx}`;
    if (!dateStr) return <View key={key} style={[styles.cell, { width: CELL_SIZE, height: CELL_SIZE }]} />;

    const photos = filteredPhotoMap[dateStr] ?? [];
    const firstPhoto = photos[0];
    const isToday = dateStr === today;
    const dayNum = parseInt(dateStr.split('-')[2], 10);
    const dotColor = firstPhoto ? (CATEGORIES.find(c => c.id === firstPhoto.category)?.color ?? '#999') : null;

    return (
      <Pressable
        key={key}
        style={[styles.cell, { width: CELL_SIZE, height: CELL_SIZE }, isToday && styles.todayCell]}
        onPress={() => openSheet(dateStr)}
      >
        {firstPhoto ? (
          <>
            <Image
              source={{ uri: firstPhoto.imageUrl }}
              style={[styles.cellImg, { width: CELL_SIZE, height: CELL_SIZE }]}
              resizeMode="cover"
            />
            {/* 카테고리 dot */}
            {dotColor && <View style={[styles.catDot, { backgroundColor: dotColor }]} />}
            {/* 날짜 숫자 */}
            <Text style={styles.dayNumOnPhoto}>{dayNum}</Text>
          </>
        ) : (
          <Text style={[styles.dayNum, isToday && { color: COLORS.primary, fontWeight: '700' }]}>
            {dayNum}
          </Text>
        )}
        {/* 복수 사진 표시 */}
        {photos.length > 1 && (
          <View style={styles.multiDot}>
            <Text style={styles.multiDotText}>+{photos.length - 1}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  // BottomSheet: 선택된 날짜 데이터
  const sheetPhotos   = selectedDate ? (filteredPhotoMap[selectedDate] ?? []) : [];
  const sheetCals     = selectedDate ? (archive.calMap[selectedDate] ?? { eaten: 0, burned: 0 }) : { eaten: 0, burned: 0 };
  const sheetDiary    = selectedDate ? (archive.diaryMap[selectedDate] ?? '') : '';
  const sheetSlides   = [...sheetPhotos, { photoId: -1, imageUrl: '', imageType: 'add' as any }];

  const KR_CAT: Record<ImageCategory, ArchiveEntry['category']> = {
    meal: '식단', workout: '오운완', drink: '술자리', daily: '일상',
  };

  // 사진 추가
  const handleAddPhoto = async (category: Category) => {
    if (!selectedDate) return;
    const cat: ImageCategory = category === 'all' ? 'daily' : category as ImageCategory;
    const opts = buildPickerOptions(isPremium);
    launchImageLibrary(opts, async (res) => {
      if (res.didCancel || !res.assets?.[0]?.uri) return;
      const asset = res.assets[0];
      await archive.addPhotoToEntry(selectedDate, KR_CAT[cat], asset.uri!, String(userId ?? ''));
      const newIdx = sheetPhotos.length;
      setTimeout(() => {
        sliderRef.current?.scrollToIndex({ index: newIdx, animated: true });
        setSlideIdx(newIdx);
      }, 150);
    });
  };

  // 카테고리 선택 모달 상태
  const [catPickVisible, setCatPickVisible] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  // 일기 저장
  const handleSaveDiary = async () => {
    if (!selectedDate) return;
    await archive.saveDiary(selectedDate, diaryDraft);
    setDiaryEdit(false);
  };

  // 공유
  const handleShare = async () => {
    if (!selectedDate) return;
    // filter가 'all'일 때 첫 번째 사진 카테고리 사용, 없으면 '일상'
    const firstPhotoCat = sheetPhotos[0]?.category;
    const krCat = TO_KR_CAT[firstPhotoCat ?? filter] ?? '일상';
    const entry: ArchiveEntry = {
      id: selectedDate,
      date: selectedDate,
      category: krCat,
      photos: sheetPhotos.map(p => p.imageUrl),
      intake: sheetCals.eaten,
      burn: sheetCals.burned,
      memo: sheetDiary,
      userId: '',
      createdAt: Date.now(),
    };
    await shareToInstagramStory(shareCardRef, entry, userId);
  };

  // 날짜 내림차순으로 정렬된 사진 피드 (현재 필터 적용)
  const photoFeedDates = Object.keys(filteredPhotoMap)
    .filter(d => d.startsWith(`${year}-${pad2(month)}`))
    .sort((a, b) => b.localeCompare(a));

  return (
    <View style={styles.root}>
      {/* ── 카테고리 필터 ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 13 }}>
        {CATEGORIES.map(cat => {
          const active = filter === cat.id;
          return (
            <Pressable
              key={cat.id}
              style={[styles.pill, { borderColor: cat.color, backgroundColor: active ? cat.color : 'transparent' }]}
              onPress={() => setFilter(cat.id)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={[styles.pillText, { color: active ? '#fff' : cat.color }]}>{cat.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} style={{ width: MAX_W }}>
        {/* ── 월 네비게이션 ── */}
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.monthArrow}>◁</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{year}년 {month}월</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.monthArrow}>▷</Text>
          </TouchableOpacity>
        </View>

        {/* ── 요일 헤더 ── */}
        <View style={styles.dayRow}>
          {DAY_LABELS.map((d, i) => (
            <Text key={d} style={[styles.dayLabel, i === 0 ? { color: '#E53935' } : null, i === 6 ? { color: '#1565C0' } : null]}>
              {d}
            </Text>
          ))}
        </View>

        {/* ── 날짜 그리드 ── */}
        {archive.loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.primary} />
        ) : (
          <View style={styles.grid}>
            {calDays.map((d, i) => renderDayCell(d, i))}
          </View>
        )}

        {/* ── 사진 피드 (날짜별) ── */}
        {photoFeedDates.length > 0 && (
          <View style={styles.feedSection}>
            <Text style={styles.feedSectionTitle}>이달의 사진</Text>
            {photoFeedDates.map(date => {
              const photos = filteredPhotoMap[date];
              const [, , d] = date.split('-');
              const dayOfWeek = DAY_LABELS[new Date(date).getDay()];
              return (
                <Pressable key={date} style={styles.feedRow} onPress={() => openSheet(date)}>
                  <View style={styles.feedDateBadge}>
                    <Text style={styles.feedDateDay}>{parseInt(d, 10)}</Text>
                    <Text style={styles.feedDateDow}>{dayOfWeek}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.feedImgRow}>
                    {photos.map((p, i) => (
                      <Image key={i} source={{ uri: p.imageUrl }} style={styles.feedThumb} resizeMode="cover" />
                    ))}
                  </ScrollView>
                </Pressable>
              );
            })}
            <View style={{ height: 24 }} />
          </View>
        )}
      </ScrollView>

      {/* ── Bottom Sheet ── */}
      {sheetVisible && (
        <Modal transparent animationType="none" onRequestClose={closeSheet}>
          {/* 딤 배경 */}
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeSheet} />

          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
            {/* 드래그 핸들 */}
            <View {...panResponder.panHandlers} style={styles.handleArea}>
              <View style={styles.handle} />
            </View>

            {/* 헤더 */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetDate}>
                {selectedDate ? `${selectedDate.replace(/-/g, '.')}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                  <Text style={styles.shareBtnText}>공유</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}>
                  <Icon name="close" size={18} color={COLORS.subText} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 사진 슬라이더 */}
              <View style={styles.sliderWrap}>
                <FlatList
                  ref={sliderRef}
                  data={sheetSlides}
                  keyExtractor={(_, i) => String(i)}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={e => {
                    setSlideIdx(Math.round(e.nativeEvent.contentOffset.x / (SW - 32)));
                  }}
                  renderItem={({ item, index }) => {
                    // "+ 사진 추가" 슬라이드
                    if ((item as any).imageType === 'add') {
                      return (
                        <TouchableOpacity
                          style={styles.addSlide}
                          onPress={() => setCatPickVisible(true)}
                        >
                          {archive.uploading
                            ? <ActivityIndicator color={COLORS.primary} size="large" />
                            : <>
                                <Text style={styles.addSlideIcon}>＋</Text>
                                <Text style={styles.addSlideText}>사진 추가</Text>
                              </>
                          }
                        </TouchableOpacity>
                      );
                    }
                    const photo = item as ArchivePhoto;
                    return (
                      <TouchableOpacity
                        style={styles.slide}
                        activeOpacity={0.95}
                        onPress={() => setViewerUri(photo.imageUrl)}
                      >
                        <Image source={{ uri: photo.imageUrl }} style={styles.slideImg} resizeMode="cover" />
                        {/* 카테고리 뱃지 */}
                        <View style={[styles.catBadge, { backgroundColor: CATEGORIES.find(c => c.id === photo.category)?.color ?? '#999' }]}>
                          <Text style={styles.catBadgeText}>{CATEGORIES.find(c => c.id === photo.category)?.label ?? photo.category}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
                {/* 좌우 화살표 */}
                {sheetSlides.length > 1 && (
                  <>
                    {slideIdx > 0 && (
                      <View style={[styles.arrowBtn, styles.arrowLeft]} pointerEvents="none">
                        <Text style={styles.arrowText}>‹</Text>
                      </View>
                    )}
                    {slideIdx < sheetSlides.length - 1 && (
                      <View style={[styles.arrowBtn, styles.arrowRight]} pointerEvents="none">
                        <Text style={styles.arrowText}>›</Text>
                      </View>
                    )}
                  </>
                )}
                {/* 페이지 카운터 */}
                <View style={styles.pageCounter}>
                  <Text style={styles.pageCounterText}>{slideIdx + 1} / {sheetSlides.length}</Text>
                </View>
              </View>

              {/* 칼로리 Row */}
              <View style={styles.calRow}>
                <View style={styles.calCell}>
                  <Text style={styles.calLabel}>섭취</Text>
                  <Text style={[styles.calVal, { color: '#E53935' }]}>{sheetCals.eaten} kcal</Text>
                </View>
                <View style={styles.calDivider} />
                <View style={styles.calCell}>
                  <Text style={styles.calLabel}>소모</Text>
                  <Text style={[styles.calVal, { color: '#43A047' }]}>{sheetCals.burned} kcal</Text>
                </View>
                <View style={styles.calDivider} />
                <View style={styles.calCell}>
                  <Text style={styles.calLabel}>순칼로리</Text>
                  <Text style={[styles.calVal, { color: COLORS.text }]}>
                    {sheetCals.eaten - sheetCals.burned} kcal
                  </Text>
                </View>
              </View>

              {/* 오늘의 총평 */}
              <View style={styles.diaryWrap}>
                <Text style={styles.diaryTitle}>오늘의 총평</Text>
                {diaryEdit ? (
                  <>
                    <TextInput
                      style={styles.diaryInput}
                      multiline
                      placeholder="오늘 하루를 기록해보세요..."
                      placeholderTextColor="#D4C5DC"
                      value={diaryDraft}
                      onChangeText={setDiaryDraft}
                      textAlignVertical="top"
                    />
                    <View style={styles.diaryBtnRow}>
                      <TouchableOpacity style={styles.diaryCancelBtn} onPress={() => setDiaryEdit(false)}>
                        <Text style={styles.diaryCancelBtnText}>취소</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.diarySaveBtn} onPress={handleSaveDiary}>
                        <Text style={styles.diarySaveBtnText}>저장</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.diaryContent, !sheetDiary && { color: '#D4C5DC' }]}>
                      {sheetDiary || '총평을 작성해보세요.'}
                    </Text>
                    <TouchableOpacity
                      style={styles.diaryEditBtn}
                      onPress={() => { setDiaryDraft(sheetDiary); setDiaryEdit(true); }}
                    >
                      <Text style={styles.diaryEditBtnText}>수정</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <View style={{ height: 32 }} />
            </ScrollView>
          </Animated.View>
        </Modal>
      )}

      {/* ── 카테고리 선택 모달 (사진 추가 시) ── */}
      {catPickVisible && (
        <Modal transparent animationType="fade" onRequestClose={() => setCatPickVisible(false)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setCatPickVisible(false)} />
          <View style={styles.catModal}>
            <Text style={styles.catModalTitle}>카테고리 선택</Text>
            {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catModalItem, { borderLeftColor: cat.color }]}
                onPress={() => {
                  setCatPickVisible(false);
                  handleAddPhoto(cat.id);
                }}
              >
                <Text style={[styles.catModalItemText, { color: cat.color }]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      )}

      {/* ── 공유 카드 캡처용 숨겨진 뷰 (opacity:0, Fabric 렌더 보장) ── */}
      {selectedDate && (
        <ViewShot
          ref={shareCardRef}
          options={{ format: 'png', quality: 0.9, result: 'tmpfile' }}
          style={styles.hiddenCapture}
          collapsable={false}
          pointerEvents="none"
        >
          <ShareCardView
            entry={{
              id: selectedDate,
              date: selectedDate,
              category: TO_KR_CAT[sheetPhotos[0]?.category ?? filter] ?? '일상',
              photos: sheetPhotos.map(p => p.imageUrl),
              intake: sheetCals.eaten,
              burn: sheetCals.burned,
              memo: sheetDiary,
              userId: '',
              createdAt: Date.now(),
            }}
            diary={sheetDiary}
          />
        </ViewShot>
      )}

      <PhotoViewerModal
        visible={viewerUri !== null}
        uri={viewerUri}
        onClose={() => setViewerUri(null)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, alignItems: SW > 480 ? 'center' : undefined },
  hiddenCapture: { position: 'absolute', top: 0, left: 0, width: 1080, height: 1920, opacity: 0 },

  // 필터
  filterRow: { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEE', width: MAX_W },
  pill: { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 28, borderWidth: 1.5, marginRight: 8 },
  pillText: { fontSize: 15, fontWeight: '600' },

  // 월 네비
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 20, backgroundColor: '#fff', width: MAX_W },
  monthArrow: { fontSize: 19, color: COLORS.text, paddingHorizontal: 14 },
  monthLabel: { fontSize: 18, fontWeight: '700', color: COLORS.text, minWidth: 110, textAlign: 'center' },

  // 요일 헤더
  dayRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEE', width: MAX_W },
  dayLabel: { width: CELL_SIZE, textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#666', paddingVertical: 6 },

  // 그리드
  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', width: MAX_W },
  cell: { alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#F0F0F0', overflow: 'hidden' },
  todayCell: { borderWidth: 2, borderColor: COLORS.primary },
  cellImg: { position: 'absolute', top: 0, left: 0, borderRadius: 12 },
  catDot: { position: 'absolute', top: 4, left: 4, width: 6, height: 6, borderRadius: 10 },
  dayNumOnPhoto: { position: 'absolute', bottom: 3, right: 4, fontSize: 13, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  dayNum: { fontSize: 15, color: COLORS.text },
  multiDot: { position: 'absolute', bottom: 3, left: 4, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 16, paddingHorizontal: 4, paddingVertical: 1 },
  multiDotText: { fontSize: 9, color: '#fff', fontWeight: '700' },

  // Bottom Sheet
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SHEET_H, backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 20,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 8, backgroundColor: '#DDD' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 32 },
  sheetDate: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  shareBtn: { backgroundColor: '#4A3A5C', paddingHorizontal: 20, paddingVertical: 6, borderRadius: 16 },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  closeBtn: { padding: 6 },
  closeBtnText: { fontSize: 19, color: '#999' },

  // 슬라이더
  sliderWrap: { position: 'relative' },
  slide: { width: SW - 32, height: 220, marginHorizontal: 16 },
  slideImg: { width: '100%', height: '100%', borderRadius: 18 },
  addSlide: { width: SW - 32, height: 220, marginHorizontal: 16, borderRadius: 18, borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF5F5' },
  addSlideIcon: { fontSize: 36, color: COLORS.primary, marginBottom: 6 },
  addSlideText: { fontSize: 17, color: COLORS.primary, fontWeight: '600' },
  catBadge: { position: 'absolute', top: 10, left: 26, paddingHorizontal: 14, paddingVertical: 3, borderRadius: 18 },
  catBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  arrowBtn: { position: 'absolute', top: '40%', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 28, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  arrowLeft: { left: 20 },
  arrowRight: { right: 20 },
  arrowText: { color: '#fff', fontSize: 20, lineHeight: 22 },
  pageCounter: { position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 3 },
  pageCounterText: { color: '#fff', fontSize: 14 },

  // 칼로리 Row
  calRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, backgroundColor: '#F8F9FA', borderRadius: 20, paddingVertical: 17 },
  calCell: { flex: 1, alignItems: 'center' },
  calLabel: { fontSize: 14, color: '#888', marginBottom: 4 },
  calVal: { fontSize: 17, fontWeight: '700' },
  calDivider: { width: 1, backgroundColor: '#E0E0E0', marginVertical: 4 },

  // 일기
  diaryWrap: { marginHorizontal: 16, marginTop: 16 },
  diaryTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  diaryContent: { fontSize: 16, color: COLORS.text, lineHeight: 22, minHeight: 60 },
  diaryInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 18, padding: 12, fontSize: 16, color: COLORS.text, minHeight: 90, backgroundColor: '#FAFAFA' },
  diaryEditBtn: { alignSelf: 'flex-end', marginTop: 6 },
  diaryEditBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  diaryBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  diaryCancelBtn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 18, borderWidth: 1.5, borderColor: '#DDD' },
  diaryCancelBtnText: { color: '#888', fontWeight: '700', fontSize: 16 },
  diarySaveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 18 },
  diarySaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // 사진 피드
  feedSection: { paddingTop: 20, paddingHorizontal: 22, backgroundColor: COLORS.bg },
  feedSectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  feedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  feedDateBadge: { width: 44, alignItems: 'center', marginRight: 10 },
  feedDateDay: { fontSize: 20, fontWeight: '800', color: COLORS.text, lineHeight: 24 },
  feedDateDow: { fontSize: 13, color: '#999', fontWeight: '600' },
  feedImgRow: { flexDirection: 'row' },
  feedThumb: { width: 80, height: 80, borderRadius: 16, marginRight: 6 },

  // 카테고리 선택 모달
  catModal: { position: 'absolute', bottom: 40, left: 40, right: 40, backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20 },
  catModalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 14, textAlign: 'center' },
  catModalItem: { paddingVertical: 15, paddingLeft: 14, borderLeftWidth: 3, marginBottom: 8, borderRadius: 12, backgroundColor: '#FAFAFA' },
  catModalItemText: { fontSize: 17, fontWeight: '600' },
});
