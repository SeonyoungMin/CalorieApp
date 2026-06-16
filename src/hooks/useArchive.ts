import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArchiveEntry, Category } from '../types/archive';
import {
  getArchivePhotos,
  getArchiveDiary,
  saveArchiveDiary,
  uploadArchivePhoto,
  getMealsByDate,
  getWorkoutsByDate,
} from '../api/api';

// ─── 타입 ────────────────────────────────────────────────────────────────────

export type ImageCategory = 'meal' | 'workout' | 'drink' | 'daily';

export interface ArchivePhoto {
  photoId: number;
  imageUrl: string;
  imageType: 'premium' | 'standard';
  category: ImageCategory;
}

// Category(한글) ↔ ImageCategory(영문) 매핑
const CAT_TO_IMG: Record<Category, ImageCategory> = {
  '식단':   'meal',
  '오운완': 'workout',
  '술자리': 'drink',
  '일상':   'daily',
};

// ─── 로컬 스토리지 헬퍼 ───────────────────────────────────────────────────────

const STORAGE_KEY = '@archive_entries';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function readAll(): Promise<ArchiveEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeAll(entries: ArchiveEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// 로컬 엔트리들을 ArchivePhoto 포맷으로 변환 (photoId 음수 = 로컬)
function localEntriesToPhotoMap(data: ArchiveEntry[], monthPrefix: string): Record<string, ArchivePhoto[]> {
  const map: Record<string, ArchivePhoto[]> = {};
  for (const entry of data.filter(e => e.date.startsWith(monthPrefix))) {
    for (let i = 0; i < entry.photos.length; i++) {
      const photoUri = entry.photos[i];
      if (!map[entry.date]) map[entry.date] = [];
      map[entry.date].push({
        photoId: -(entry.createdAt + i), // 음수 ID = 로컬
        imageUrl: photoUri,
        imageType: 'standard',
        category: CAT_TO_IMG[entry.category] ?? 'daily',
      });
    }
  }
  return map;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useArchive() {
  // ── 로컬 (HomeScreen / ScanScreen / WorkoutScreen / MealScreen / DrinkModeScreen) ──
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);

  useEffect(() => {
    readAll().then(data => setEntries(data));
  }, []);

  const reload = useCallback(async () => {
    const data = await readAll();
    setEntries(data);
  }, []);

  // 서버 사진 → 로컬 entries 동기화 (재설치/타기기 로그인 후 사진 복원)
  const syncFromServer = useCallback(async (monthsBack: number = 3): Promise<void> => {
    if (Platform.OS === 'web') return;
    const now = new Date();
    const local = await readAll();

    // ImageCategory(영문) → Category(한글) 역매핑
    const IMG_TO_CAT: Record<string, Category> = {
      meal: '식단', workout: '오운완', drink: '술자리', daily: '일상',
    };

    // 기존 로컬 사진 URL 셋 (중복 방지)
    const localUrls = new Set<string>();
    for (const e of local) for (const p of e.photos) localUrls.add(p);

    // 날짜+카테고리 키로 기존 엔트리 인덱스
    const indexByKey = new Map<string, number>();
    local.forEach((e, i) => indexByKey.set(`${e.date}|${e.category}`, i));

    let changed = false;

    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      try {
        const res = await getArchivePhotos(year, month);
        const photos = (res.data?.photos ?? []) as Array<{
          photoId: number;
          imageUrl: string;
          imageType: string;
          category: string;
          logDate: string;
        }>;
        for (const p of photos) {
          if (localUrls.has(p.imageUrl)) continue;
          const cat = IMG_TO_CAT[p.category] ?? '일상';
          const key = `${p.logDate}|${cat}`;
          const idx = indexByKey.get(key);
          if (idx != null) {
            local[idx] = { ...local[idx], photos: [...local[idx].photos, p.imageUrl] };
          } else {
            const created = Date.now() + Math.random();
            const entry: ArchiveEntry = {
              id: generateId(),
              date: p.logDate,
              category: cat,
              photos: [p.imageUrl],
              intake: 0,
              burn: 0,
              memo: '',
              userId: '',
              createdAt: created,
            };
            local.push(entry);
            indexByKey.set(key, local.length - 1);
          }
          localUrls.add(p.imageUrl);
          changed = true;
        }
      } catch {
        // 한 달 실패해도 다른 달은 계속 진행
      }
    }

    if (changed) {
      await writeAll(local);
      setEntries(local);
    }
  }, []);

  const getEntries = useCallback((month?: string): ArchiveEntry[] => {
    if (!month) return entries;
    return entries.filter(e => e.date.startsWith(month));
  }, [entries]);

  const addEntry = useCallback(async (
    entry: Omit<ArchiveEntry, 'id' | 'createdAt'>
  ): Promise<void> => {
    const newEntry: ArchiveEntry = { ...entry, id: generateId(), createdAt: Date.now() };
    const updated = [...entries, newEntry];
    setEntries(updated);
    await writeAll(updated);
  }, [entries]);

  const updateEntry = useCallback(async (id: string, updates: Partial<ArchiveEntry>): Promise<void> => {
    const updated = entries.map(e => e.id === id ? { ...e, ...updates } : e);
    setEntries(updated);
    await writeAll(updated);
  }, [entries]);

  // ── 서버 기반 (CalendarArchiveScreen용) ──
  const [photoMap, setPhotoMap] = useState<Record<string, ArchivePhoto[]>>({});
  const [calMap,   setCalMap]   = useState<Record<string, { eaten: number; burned: number }>>({});
  const [diaryMap, setDiaryMap] = useState<Record<string, string>>({});
  const [loading,  setLoading]  = useState(false);
  const [uploading, setUploading] = useState(false);

  // 로컬 사진을 photoMap에 머지 (서버 URL과 중복 제거)
  const mergeLocalPhotos = useCallback((
    serverMap: Record<string, ArchivePhoto[]>,
    localData: ArchiveEntry[],
    monthPrefix: string,
  ): Record<string, ArchivePhoto[]> => {
    const merged = { ...serverMap };
    const localMap = localEntriesToPhotoMap(localData, monthPrefix);
    for (const [date, localPhotos] of Object.entries(localMap)) {
      const existing = merged[date] ?? [];
      const existingUrls = new Set(existing.map(p => p.imageUrl));
      const newOnes = localPhotos.filter(p => !existingUrls.has(p.imageUrl));
      if (newOnes.length > 0) merged[date] = [...existing, ...newOnes];
    }
    return merged;
  }, []);

  // 로컬 URI로만 저장된 사진을 백그라운드에서 서버 업로드 시도
  const retryLocalUploads = useCallback(async (localData: ArchiveEntry[], monthPrefix: string) => {
    if (Platform.OS === 'web') return;
    const monthEntries = localData.filter(e => e.date.startsWith(monthPrefix));
    let changed = false;
    const all = [...localData];

    for (const entry of monthEntries) {
      const newPhotos: string[] = [];
      for (const uri of entry.photos) {
        if (uri.startsWith('http')) {
          newPhotos.push(uri);
          continue;
        }
        try {
          const imgCat = CAT_TO_IMG[entry.category] ?? 'daily';
          const form = new FormData();
          form.append('image', { uri, type: 'image/jpeg', name: `photo_${Date.now()}.jpg` } as any);
          form.append('logDate', entry.date);
          form.append('category', imgCat);
          form.append('isPremium', 'false');
          const res = await uploadArchivePhoto(form);
          const result = res.data as { photoId: number; imageUrl: string; imageType: string };
          if (result?.imageUrl) {
            newPhotos.push(result.imageUrl);
            changed = true;
          } else {
            newPhotos.push(uri);
          }
        } catch {
          newPhotos.push(uri);
        }
      }
      const idx = all.findIndex(e => e.id === entry.id);
      if (idx >= 0) all[idx] = { ...all[idx], photos: newPhotos };
    }

    if (changed) {
      await writeAll(all);
      setEntries(all);
    }
  }, []);

  const loadMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const localData = await readAll();

    try {
      const res = await getArchivePhotos(year, month);
      const data = res.data ?? {};

      const newPhotoMap: Record<string, ArchivePhoto[]> = {};
      for (const p of data.photos ?? []) {
        if (!newPhotoMap[p.logDate]) newPhotoMap[p.logDate] = [];
        newPhotoMap[p.logDate].push({
          photoId: p.photoId,
          imageUrl: p.imageUrl,
          imageType: p.imageType,
          category: p.category,
        });
      }

      const newCalMap: Record<string, { eaten: number; burned: number }> = {};
      for (const c of data.calories ?? []) {
        newCalMap[c.logDate] = { eaten: c.eaten ?? 0, burned: c.burned ?? 0 };
      }

      // 로컬 사진도 머지 (서버에 없는 것만 추가)
      setPhotoMap(mergeLocalPhotos(newPhotoMap, localData, monthPrefix));
      setCalMap(newCalMap);

      // 백그라운드: 로컬 URI로만 저장된 사진 서버 업로드 재시도
      retryLocalUploads(localData, monthPrefix);
    } catch {
      // 서버 실패 시 로컬 사진만 표시 (웹 or 오프라인)
      setPhotoMap(localEntriesToPhotoMap(localData, monthPrefix));
      setCalMap({});
    } finally {
      setLoading(false);
    }
  }, [mergeLocalPhotos, retryLocalUploads]);

  const loadDiary = useCallback(async (date: string) => {
    try {
      const res = await getArchiveDiary(date);
      setDiaryMap(prev => ({ ...prev, [date]: res.data?.content ?? '' }));
    } catch {
      setDiaryMap(prev => ({ ...prev, [date]: '' }));
    }
  }, []);

  const loadDayCals = useCallback(async (date: string) => {
    try {
      const [mealRes, workoutRes] = await Promise.allSettled([
        getMealsByDate(date),
        getWorkoutsByDate(date),
      ]);
      const meals: any[] = mealRes.status === 'fulfilled' ? (mealRes.value.data ?? []) : [];
      const workouts: any[] = workoutRes.status === 'fulfilled' ? (workoutRes.value.data ?? []) : [];
      const eaten = meals.reduce((sum: number, m: any) => sum + (m.totalKcal ?? 0), 0);
      const burned = workouts.reduce((sum: number, w: any) => sum + (w.kcalBurned ?? 0), 0);
      setCalMap(prev => ({ ...prev, [date]: { eaten, burned } }));
    } catch {}
  }, []);

  const saveDiary = useCallback(async (date: string, content: string) => {
    try {
      await saveArchiveDiary(date, content);
    } catch {}
    setDiaryMap(prev => ({ ...prev, [date]: content }));
  }, []);

  // 로컬 저장 + 서버 업로드 + photoMap 즉시 반영
  const addPhotoToEntry = useCallback(async (
    date: string, category: Category, photoUri: string, userId: string = ''
  ): Promise<void> => {
    const imgCat = CAT_TO_IMG[category] ?? 'daily';
    const now = Date.now();

    // 1) 서버 업로드 시도 (성공하면 서버 URL 사용, 실패하면 로컬 URI 사용)
    let finalUri = photoUri;
    if (Platform.OS !== 'web' && photoUri) {
      try {
        const form = new FormData();
        form.append('image', { uri: photoUri, type: 'image/jpeg', name: `photo_${now}.jpg` } as any);
        form.append('logDate', date);
        form.append('category', imgCat);
        form.append('isPremium', 'false');
        const res = await uploadArchivePhoto(form);
        const result = res.data as { photoId: number; imageUrl: string; imageType: string };
        if (result?.imageUrl) {
          finalUri = result.imageUrl;
          setPhotoMap(prev => ({
            ...prev,
            [date]: [...(prev[date] ?? []), { photoId: result.photoId, imageUrl: result.imageUrl, imageType: result.imageType as any, category: imgCat }],
          }));
        }
      } catch {
        // 업로드 실패 시 로컬 URI 폴백
      }
    }

    // 2) AsyncStorage 로컬 저장
    const all = await readAll();
    const existing = all.find(e => e.date === date && e.category === category);
    let updated: ArchiveEntry[];
    if (existing) {
      updated = all.map(e =>
        e.id === existing.id ? { ...e, photos: [...e.photos, finalUri] } : e
      );
    } else {
      updated = [...all, {
        id: generateId(), date, category, photos: [finalUri],
        intake: 0, burn: 0, memo: '', userId, createdAt: now,
      }];
    }
    setEntries(updated);
    await writeAll(updated);

    // 3) 서버 업로드 실패 시 로컬 URI로 photoMap 즉시 반영
    if (finalUri === photoUri) {
      setPhotoMap(prev => {
        const dayPhotos = prev[date] ?? [];
        if (dayPhotos.some(p => p.imageUrl === photoUri)) return prev;
        return {
          ...prev,
          [date]: [...dayPhotos, { photoId: -now, imageUrl: photoUri, imageType: 'standard' as const, category: imgCat }],
        };
      });
    }
  }, [entries]);

  // 서버 업로드 (CalendarArchiveScreen 직접 추가용)
  const addPhoto = useCallback(async (
    asset: Asset, date: string, category: ImageCategory, isPremium: boolean
  ): Promise<{ photoId: number; imageUrl: string; imageType: string } | null> => {
    setUploading(true);
    try {
      const form = new FormData();

      if (Platform.OS === 'web') {
        // 웹: blob URL → 실제 Blob → File 변환
        const blob = await fetch(asset.uri!).then(r => r.blob());
        const file = new File([blob], asset.fileName ?? `photo_${Date.now()}.jpg`, {
          type: asset.type ?? 'image/jpeg',
        });
        form.append('image', file);
      } else {
        form.append('image', {
          uri: asset.uri!,
          type: asset.type ?? 'image/jpeg',
          name: asset.fileName ?? `photo_${Date.now()}.jpg`,
        } as any);
      }
      form.append('logDate', date);
      form.append('category', category);
      form.append('isPremium', isPremium ? 'true' : 'false');

      const res = await uploadArchivePhoto(form);
      const result = res.data as { photoId: number; imageUrl: string; imageType: 'premium' | 'standard' };

      setPhotoMap(prev => ({
        ...prev,
        [date]: [...(prev[date] ?? []), { ...result, category }],
      }));
      return result;
    } catch {
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return {
    // 로컬 (HomeScreen, ScanScreen)
    entries, reload, getEntries, addEntry, updateEntry, addPhotoToEntry,
    // 서버 → 로컬 복원 (재설치/타기기 로그인 후)
    syncFromServer,
    // 서버 + 로컬 머지 (CalendarArchiveScreen)
    photoMap, calMap, diaryMap, loading, uploading,
    loadMonth, loadDiary, loadDayCals, saveDiary, addPhoto,
  };
}
