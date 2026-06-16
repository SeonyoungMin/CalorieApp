/**
 * 아카이브 이미지 업로드 서비스
 *
 * [압축 정책]
 * - 프리미엄 유저: 원본 품질(quality=1.0) → 서버 경로 images/premium/{userId}/{file}
 * - 일반 유저: 최대 800x800, quality=0.7, JPEG → 서버 경로 images/standard/{userId}/{file}
 *
 * [흐름]
 * launchImageLibrary/launchCamera
 *   → asset(uri, type, fileName)
 *   → uploadArchiveImage(asset, logDate, category, isPremium)
 *   → POST /api/archive/photo/upload (multipart)
 *   → { photoId, imageUrl, imageType }
 */

import { Asset } from 'react-native-image-picker';
import { uploadArchivePhoto } from '../api/api';

export type ImageCategory = 'meal' | 'workout' | 'drink' | 'daily';

export interface UploadResult {
  photoId: number;
  imageUrl: string;
  imageType: 'premium' | 'standard';
}

/**
 * 이미지를 서버에 업로드한다.
 * 클라이언트 단에서 이미 image-picker quality/maxWidth/maxHeight로 1차 압축을 거친 asset을 받는다.
 * 서버에서 isPremium 헤더를 기준으로 S3 경로와 DB image_type을 결정한다.
 */
export async function uploadArchiveImage(
  asset: Asset,
  logDate: string,
  category: ImageCategory,
  isPremium: boolean,
): Promise<UploadResult> {
  const form = new FormData();

  form.append('image', {
    uri: asset.uri!,
    type: asset.type ?? 'image/jpeg',
    name: asset.fileName ?? `photo_${Date.now()}.jpg`,
  } as any);

  form.append('logDate', logDate);
  form.append('category', category);
  // 서버에서 S3 경로 / image_type 분기 판단에 사용
  form.append('isPremium', isPremium ? 'true' : 'false');

  const res = await uploadArchivePhoto(form);
  return res.data as UploadResult;
}

/**
 * react-native-image-picker launchImageLibrary 옵션 빌더
 * - 프리미엄: quality 1.0, 원본 해상도
 * - 일반: quality 0.7, 최대 800x800
 */
export function buildPickerOptions(isPremium: boolean) {
  return {
    mediaType: 'photo' as const,
    quality: (isPremium ? 1.0 : 0.7) as any,
    ...(isPremium ? {} : { maxWidth: 1920, maxHeight: 1920 }),
    includeBase64: false,
  };
}
