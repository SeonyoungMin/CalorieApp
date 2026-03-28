// Web stub for @notifee/react-native
const notifee = {
  requestPermission: async () => ({ authorizationStatus: 1 }),
  createChannel: async () => 'default',
  displayNotification: async () => '',
  createTriggerNotification: async () => '',
  cancelNotification: async () => {},
  cancelAllNotifications: async () => {},
  getTriggerNotifications: async () => [],
  getNotificationSettings: async () => ({ authorizationStatus: 1 }),
};

export default notifee;
export const AndroidImportance = { HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0 };
export const TriggerType = { TIMESTAMP: 0, INTERVAL: 1 };
export const RepeatFrequency = { NONE: -1, HOURLY: 0, DAILY: 1, WEEKLY: 2 };
export const AuthorizationStatus = { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 };
export const AndroidNotificationSetting = { ENABLED: 1, DISABLED: 0 };
