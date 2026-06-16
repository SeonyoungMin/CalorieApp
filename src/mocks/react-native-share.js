// Web mock for react-native-share
const Share = {
  open: () => Promise.resolve({ success: false }),
  shareSingle: () => Promise.resolve({ success: false }),
  isPackageInstalled: () => Promise.resolve({ isInstalled: false }),
  Social: {
    INSTAGRAM_STORIES: 'instagram-stories',
    INSTAGRAM: 'instagram',
    FACEBOOK: 'facebook',
    TWITTER: 'twitter',
  },
};

export default Share;
