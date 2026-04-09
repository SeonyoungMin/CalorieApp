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
  isBatteryOptimizationEnabled: async () => false,
  openBatteryOptimizationSettings: async () => {},
  openPowerManagerSettings: async () => {},
  getPowerManagerInfo: async () => ({ activity: null, manufacturer: 'unknown' }),
  onForegroundEvent: (_callback) => () => {},
  onBackgroundEvent: (_callback) => {},
  getInitialNotification: async () => null,
};

export default notifee;
export const AndroidImportance = { HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0 };
export const TriggerType = { TIMESTAMP: 0, INTERVAL: 1 };
export const RepeatFrequency = { NONE: -1, HOURLY: 0, DAILY: 1, WEEKLY: 2 };
export const AuthorizationStatus = { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 };
export const AndroidNotificationSetting = { ENABLED: 1, DISABLED: 0 };
export const EventType = {
  DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3,
  APP_BLOCKED: 4, CHANNEL_BLOCKED: 5, CHANNEL_GROUP_BLOCKED: 6,
  TRIGGER_NOTIFICATION_CREATED: 7, FG_ALREADY_EXIST: 8,
};
