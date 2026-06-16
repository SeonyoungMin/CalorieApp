import ImageResizer from 'react-native-image-resizer';

/**
 * 이미지를 최대 1200px, quality 0.8로 리사이즈한다.
 * @param uri - 로컬 이미지 URI (file:// 또는 content://)
 * @returns 리사이즈된 이미지의 로컬 URI
 */
export async function resizeImage(uri: string): Promise<string> {
  const result = await ImageResizer.createResizedImage(
    uri,
    1200,   // maxWidth
    1200,   // maxHeight
    'JPEG', // format
    80,     // quality (0~100)
    0,      // rotation
    undefined, // outputPath (임시 디렉토리 사용)
    false,  // keepMeta
    { mode: 'contain', onlyScaleDown: true }
  );
  return result.uri;
}
