import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FREE_SCAN_LIMIT = 10;
const SCAN_COUNT_KEY = 'AI_SCAN_COUNT';
const IS_PREMIUM_KEY = 'IS_PREMIUM';

export function useSubscription() {
  const [scanCount, setScanCount] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const count = await AsyncStorage.getItem(SCAN_COUNT_KEY);
      const premium = await AsyncStorage.getItem(IS_PREMIUM_KEY);
      setScanCount(parseInt(count || '0', 10));
      setIsPremium(premium === 'true');
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

  const activatePremium = async () => {
    setIsPremium(true);
    await AsyncStorage.setItem(IS_PREMIUM_KEY, 'true');
  };

  const cancelPremium = async () => {
    setIsPremium(false);
    await AsyncStorage.removeItem(IS_PREMIUM_KEY);
  };

  return {
    scanCount,
    isPremium,
    canScan,
    remainingFreeScans,
    loaded,
    incrementScanCount,
    activatePremium,
    cancelPremium,
  };
}
