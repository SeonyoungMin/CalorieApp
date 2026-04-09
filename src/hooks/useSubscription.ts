import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

const FREE_SCAN_LIMIT = 10;
const SCAN_COUNT_KEY = 'AI_SCAN_COUNT';
const PREMIUM_TEST_KEY = 'PREMIUM_TEST_ENABLED';

export function useSubscription() {
  const [scanCount, setScanCount] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const count = await AsyncStorage.getItem(SCAN_COUNT_KEY);
      setScanCount(parseInt(count || '0', 10));

      const testPremium = await AsyncStorage.getItem(PREMIUM_TEST_KEY);
      setIsPremium(testPremium === 'true');

      setLoaded(true);
    };
    load();
  }, []);

  const remainingFreeScans = Math.max(0, FREE_SCAN_LIMIT - scanCount);
  const canScan = isPremium || scanCount < FREE_SCAN_LIMIT;

  const incrementScanCount = async () => {
    const next = scanCount + 1;
    setScanCount(next);
    await AsyncStorage.setItem(SCAN_COUNT_KEY, String(next));
  };

  const purchasePremium = async (): Promise<boolean> => {
    await AsyncStorage.setItem(PREMIUM_TEST_KEY, 'true');
    setIsPremium(true);
    return true;
  };

  const cancelPremium = async () => {
    await AsyncStorage.setItem(PREMIUM_TEST_KEY, 'false');
    setIsPremium(false);
    Linking.openURL('https://play.google.com/store/account/subscriptions');
  };

  const restorePurchases = async (): Promise<boolean> => {
    const testPremium = await AsyncStorage.getItem(PREMIUM_TEST_KEY);
    const active = testPremium === 'true';
    setIsPremium(active);
    return active;
  };

  return {
    scanCount,
    isPremium,
    canScan,
    remainingFreeScans,
    loaded,
    monthlyPackage: null,
    incrementScanCount,
    purchasePremium,
    cancelPremium,
    restorePurchases,
  };
}
