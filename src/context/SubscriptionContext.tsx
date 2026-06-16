import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import { EVENT_FREE_ACCESS } from '../config/eventFlags';

const FREE_SCAN_LIMIT = 10;
const SCAN_COUNT_KEY = 'AI_SCAN_COUNT';
const PREMIUM_ENTITLEMENT_ID = 'premium';

const isAndroid = Platform.OS === 'android';

function checkActive(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return info.entitlements.active[PREMIUM_ENTITLEMENT_ID] != null;
}

interface SubscriptionValue {
  scanCount: number;
  isPremium: boolean;
  canScan: boolean;
  remainingFreeScans: number;
  loaded: boolean;
  offering: PurchasesOffering | null;
  monthlyPackage: PurchasesPackage | null;
  annualPackage: PurchasesPackage | null;
  incrementScanCount: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  purchasePremium: () => Promise<boolean>;
  cancelPremium: () => Promise<void>;
  restorePurchases: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [scanCount, setScanCount] = useState(0);
  // EVENT_FREE_ACCESS 기간 동안에는 항상 프리미엄으로 취급
  const [isPremium, setIsPremium] = useState(EVENT_FREE_ACCESS);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const count = await AsyncStorage.getItem(SCAN_COUNT_KEY);
        setScanCount(parseInt(count || '0', 10));
      } catch {}

      // 이벤트 기간: RevenueCat 호출 전부 우회
      if (EVENT_FREE_ACCESS) {
        setIsPremium(true);
        setLoaded(true);
        return;
      }

      if (!isAndroid) {
        setLoaded(true);
        return;
      }

      try {
        const info = await Purchases.getCustomerInfo();
        setIsPremium(checkActive(info));
      } catch {}

      try {
        const offs = await Purchases.getOfferings();
        if (offs.current) setOffering(offs.current);
      } catch {}

      setLoaded(true);
    };
    load();

    if (EVENT_FREE_ACCESS) return;
    if (!isAndroid) return;

    const handler = (info: CustomerInfo) => {
      setIsPremium(checkActive(info));
    };
    Purchases.addCustomerInfoUpdateListener(handler);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(handler);
    };
  }, []);

  const remainingFreeScans = Math.max(0, FREE_SCAN_LIMIT - scanCount);
  const canScan = isPremium || scanCount < FREE_SCAN_LIMIT;

  const incrementScanCount = useCallback(async () => {
    setScanCount((prev) => {
      const next = prev + 1;
      AsyncStorage.setItem(SCAN_COUNT_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      if (EVENT_FREE_ACCESS) return true;
      if (!isAndroid) return false;
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        const active = checkActive(customerInfo);
        setIsPremium(active);
        return active;
      } catch (e: any) {
        if (e?.userCancelled) return false;
        throw e;
      }
    },
    [],
  );

  const purchasePremium = useCallback(async (): Promise<boolean> => {
    if (EVENT_FREE_ACCESS) return true;
    if (!isAndroid) return false;
    const monthly = offering?.monthly ?? offering?.availablePackages?.[0];
    if (!monthly) {
      throw new Error('월간 요금제를 찾을 수 없어요. 잠시 후 다시 시도해주세요.');
    }
    return purchasePackage(monthly);
  }, [offering, purchasePackage]);

  const cancelPremium = useCallback(async () => {
    if (EVENT_FREE_ACCESS) return;
    Linking.openURL('https://play.google.com/store/account/subscriptions');
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (EVENT_FREE_ACCESS) return true;
    if (!isAndroid) return false;
    try {
      const info = await Purchases.restorePurchases();
      const active = checkActive(info);
      setIsPremium(active);
      return active;
    } catch {
      return false;
    }
  }, []);

  const value: SubscriptionValue = {
    scanCount,
    isPremium,
    canScan,
    remainingFreeScans,
    loaded,
    offering,
    monthlyPackage: offering?.monthly ?? null,
    annualPackage: offering?.annual ?? null,
    incrementScanCount,
    purchasePackage,
    purchasePremium,
    cancelPremium,
    restorePurchases,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
