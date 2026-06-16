import { RefObject } from 'react';
import { Alert, Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import { ArchiveEntry } from '../types/archive';

const CAT_COLORS: Record<string, { top: string; bottom: string }> = {
  '식단':  { top: '#A98ED1', bottom: '#0d3d6e' },
  '오운완': { top: '#1a2e1a', bottom: '#0d1a0d' },
  '술자리': { top: '#1a1a2e', bottom: '#0d0d1a' },
  '일상':  { top: '#2e1a0a', bottom: '#1a0d05' },
};

/**
 * ShareCardView를 캡처 후 Instagram Stories로 공유.
 * 실패 시 일반 이미지 공유로 fallback.
 *
 * @param ref    ShareCardView를 감싼 ViewShot ref
 * @param entry  공유할 ArchiveEntry
 * @param userId 내 userId (친구 추가 딥링크용, 없으면 딥링크 생략)
 */
export async function shareToInstagramStory(
  ref: RefObject<ViewShot>,
  entry: ArchiveEntry,
  userId?: number | null,
): Promise<void> {
  const colors = CAT_COLORS[entry.category] ?? CAT_COLORS['일상'];

  // 1. ViewShot 캡처 (Android: tmpfile → file:// URI, 웹: base64)
  let captureUri: string;
  let base64Url: string | null = null;
  try {
    if (Platform.OS === 'web') {
      const b64 = await (ref.current as any).capture({ format: 'png', quality: 0.9, result: 'base64' });
      captureUri = `data:image/png;base64,${b64}`;
      base64Url = captureUri;
    } else {
      const path: string = await (ref.current as any).capture({ format: 'png', quality: 0.9, result: 'tmpfile' });
      captureUri = path.startsWith('file://') ? path : `file://${path}`;
    }
  } catch (e: any) {
    Alert.alert('캡처 실패', '카드를 캡처하지 못했어요. 다시 시도해주세요.');
    return;
  }

  // 2. Instagram Stories 공유 시도
  const shareUrl = base64Url ?? captureUri;
  try {
    await Share.shareSingle({
      social: Share.Social.INSTAGRAM_STORIES,
      backgroundImage: shareUrl,
      backgroundBottomColor: colors.bottom,
      backgroundTopColor:    colors.top,
      appId: '',
    });
    return;
  } catch (instagramErr: any) {
    const isCancelled =
      instagramErr?.message?.includes('cancel') ||
      instagramErr?.message?.includes('dismiss') ||
      instagramErr?.error === 'User did not share';
    if (isCancelled) return;
  }

  // 3. Fallback: 일반 이미지 공유
  const storeUrl = 'https://play.google.com/store/apps/details?id=com.calorieapp.kals';
  const friendLink = userId
    ? `\n\n내 쁠마 ID: ${userId}\n(앱 > 친구 탭 검색)\n설치: ${storeUrl}`
    : '';
  try {
    await Share.open({
      url: shareUrl,
      type: 'image/png',
      title: `${entry.date} ${entry.category} 기록`,
      message: `${entry.date} ${entry.category} | 섭취 ${entry.intake}kcal · 소모 ${entry.burn}kcal\n\n쁠마로 기록 중${friendLink}`,
      failOnCancel: false,
    });
  } catch (fallbackErr: any) {
    const isCancelled =
      fallbackErr?.message?.includes('cancel') ||
      fallbackErr?.message?.includes('dismiss') ||
      fallbackErr?.message?.includes('User did not share');
    if (!isCancelled) {
      Alert.alert('공유 실패', '공유 중 오류가 발생했어요.');
    }
  }
}
