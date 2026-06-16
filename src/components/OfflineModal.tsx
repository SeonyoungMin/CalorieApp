import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { subscribeOnline } from '../utils/offline';
import { COLORS } from '../theme';
import Icon from './Icon';

export default function OfflineModal() {
  const [online, setOnlineState] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsub = subscribeOnline((next) => {
      setOnlineState(next);
      if (next) setDismissed(false);
    });
    return unsub;
  }, []);

  if (online || dismissed) return null;
  if (Platform.OS === 'web') return null;

  const openSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(() => {
        Linking.openSettings().catch(() => {});
      });
    } else {
      Linking.openSettings().catch(() => {});
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setDismissed(true)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Icon name="cloud" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>인터넷 연결이 끊겼어요</Text>
          <Text style={styles.desc}>
            데이터를 불러오지 못했어요.{'\n'}와이파이 또는 모바일 데이터를 켜주세요.
          </Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={openSettings} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>와이파이 설정 열기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => setDismissed(true)} activeOpacity={0.85}>
            <Text style={styles.btnSecondaryText}>나중에</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: COLORS.card,
    borderRadius: 28, paddingVertical: 28, paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
  },
  iconCircle: {
    width: 76, height: 76, borderRadius: 999,
    backgroundColor: COLORS.pinkSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 19, fontWeight: '900', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 15, color: COLORS.subText, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  btnPrimary: {
    backgroundColor: COLORS.primary, borderRadius: 22,
    paddingVertical: 16, paddingHorizontal: 24, alignSelf: 'stretch',
    alignItems: 'center', marginBottom: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnSecondary: {
    backgroundColor: 'transparent', borderRadius: 22,
    paddingVertical: 14, paddingHorizontal: 24, alignSelf: 'stretch',
    alignItems: 'center',
  },
  btnSecondaryText: { color: COLORS.subText, fontSize: 15, fontWeight: '700' },
});
