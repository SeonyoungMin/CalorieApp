import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { Linking, Alert } from 'react-native';

const FREE_SCAN_LIMIT = 10;
const SCAN_COUNT_KEY = 'AI_SCAN_COUNT';
const ENTITLEMENT_ID = '칼스 Pro';

export function useSubscription() {
  const [scanCount, setScanCount] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);

  useEffect(() => {
    const load = async () => {
      const count = await AsyncStorage.getItem(SCAN_COUNT_KEY);
      setScanCount(parseInt(count || '0', 10));

      try {
        const customerInfo = await Purchases.getCustomerInfo();
        setIsPremium(customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined);
      } catch {
        setIsPremium(false);
      }

      try {
        const offerings = await Purchases.getOfferings();
        if (offerings.current?.monthly) {
          setMonthlyPackage(offerings.current.monthly);
        }
      } catch {}

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
    if (!monthlyPackage) {
      Alert.alert('오류', '구독 상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      return false;
    }
    try {
      const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);
      const active = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPremium(active);
      return active;
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('결제 오류', '결제 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
      return false;
    }
  };

  const cancelPremium = async () => {
    Linking.openURL('https://play.google.com/store/account/subscriptions');
  };

  const restorePurchases = async (): Promise<boolean> => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const active = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPremium(active);
      return active;
    } catch {
      return false;
    }
  };

  return {
    scanCount,
    isPremium,
    canScan,
    remainingFreeScans,
    loaded,
    monthlyPackage,
    incrementScanCount,
    purchasePremium,
    cancelPremium,
    restorePurchases,
  };
}
