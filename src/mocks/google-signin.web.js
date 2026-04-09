// Web stub for @react-native-google-signin/google-signin
export const GoogleSignin = {
  configure: () => {},
  signIn: async () => {
    throw new Error('구글 로그인은 모바일 앱에서만 지원됩니다.');
  },
  signOut: async () => {},
  revokeAccess: async () => {},
  isSignedIn: async () => false,
  hasPlayServices: async () => false,
};

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};

export const GoogleOneTapSignIn = {};
export const isErrorWithCode = (error) => !!error?.code;
