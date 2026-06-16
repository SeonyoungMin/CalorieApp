/**
 * 소셜 로그인 설정값
 *
 * [카카오] 네이티브 앱 키는 strings.xml 에서 SDK가 자동으로 읽습니다.
 *   → android/app/src/main/res/values/strings.xml > kakao_app_key
 *
 * [구글] Web Client ID는 Firebase Console → Authentication → Google → 웹 클라이언트 ID
 *   (YOUR_NUMBERS-xxxx.apps.googleusercontent.com 형식)
 *
 * .env 파일에서 환경변수로 관리하려면 react-native-config 패키지 추가 후
 *   GOOGLE_WEB_CLIENT_ID 값을 Config.GOOGLE_WEB_CLIENT_ID 로 대체하세요.
 */

export const GOOGLE_WEB_CLIENT_ID =
  '523640938461-c0lh93bp21u00r795no7dq5icrm65a3e.apps.googleusercontent.com';
