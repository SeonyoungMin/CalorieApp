import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, Animated, Dimensions, Platform,
} from 'react-native';
import { COLORS } from '../theme';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';

/**
 * 권한 요청 / 경고 안내용 범용 모달.
 * Alert.alert 대신 디자인 일관성을 위해 사용.
 *
 * variant: 'permission' (정보 안내) / 'warning' (주의)
 */
type Props = {
  visible: boolean;
  variant?: 'permission' | 'warning';
  icon?: IconName;
  iconColor?: string;
  title: string;
  desc: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  /** 모달 닫기 (백드롭/뒤로가기). 보통 onSecondary와 같게 두면 됨 */
  onClose?: () => void;
};

const { width } = Dimensions.get('window');
const CARD_W = Math.min(width - 48, 360);

export default function PermissionModal({
  visible,
  variant = 'permission',
  icon,
  iconColor,
  title,
  desc,
  primaryLabel = '허용하기',
  secondaryLabel = '나중에',
  onPrimary,
  onSecondary,
  onClose,
}: Props) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.9);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  if (Platform.OS === 'web') return null;

  const accent = variant === 'warning' ? COLORS.warning : COLORS.primary;
  const accentDark = variant === 'warning' ? COLORS.warning : COLORS.primaryDark;
  const accentBg = variant === 'warning' ? '#FFE8D4' : COLORS.lavender;
  const iconName: IconName = icon ?? (variant === 'warning' ? 'bell' : 'check');
  const iconColorActual = iconColor ?? '#fff';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose ?? onSecondary}
    >
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          <View style={[styles.iconCircle, { backgroundColor: accent }]}>
            <Icon name={iconName} size={28} color={iconColorActual} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.desc}>{desc}</Text>

          <View style={styles.btnCol}>
            <PressableScale
              style={[styles.btnPrimary, { backgroundColor: accent, shadowColor: accentDark }]}
              onPress={onPrimary}
            >
              <Text style={styles.btnPrimaryText}>{primaryLabel}</Text>
            </PressableScale>

            {onSecondary && (
              <PressableScale style={[styles.btnSecondary, { backgroundColor: accentBg }]} onPress={onSecondary}>
                <Text style={[styles.btnSecondaryText, { color: accentDark }]}>{secondaryLabel}</Text>
              </PressableScale>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(74, 58, 92, 0.55)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  card: {
    width: CARD_W,
    backgroundColor: COLORS.card,
    borderRadius: 32,
    paddingTop: 28, paddingBottom: 24, paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: COLORS.purpleDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 14,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  title: {
    fontSize: 19, fontWeight: '900', color: COLORS.text,
    textAlign: 'center', marginBottom: 10,
  },
  desc: {
    fontSize: 16, color: COLORS.subText,
    textAlign: 'center', lineHeight: 20, marginBottom: 22,
  },
  btnCol: { width: '100%', gap: 10 },
  btnPrimary: {
    borderRadius: 999, paddingVertical: 17, alignItems: 'center',
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  btnPrimaryText: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  btnSecondary: { borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryText: { fontSize: 16, fontWeight: '700' },
});
