import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, Animated, Easing, Dimensions,
} from 'react-native';
import { COLORS } from '../theme';
import Icon from './Icon';
import PressableScale from './PressableScale';
import { Badge } from '../data/badges';

type Props = {
  badges: Badge[];
  onClose: () => void;
};

const { width } = Dimensions.get('window');
const CARD_W = Math.min(width - 64, 320);

/**
 * 새로 획득한 뱃지 popup. 여러 개면 차례로 표시.
 * bouncy: scale 0 → 1.15 → 1 (spring + bounciness 14)
 * sparkle: 양쪽 별이 loop로 페이드 in/out + 회전
 */
export default function BadgeUnlockedModal({ badges, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const visible = badges.length > 0 && idx < badges.length;

  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const sparkleRot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1, useNativeDriver: true,
        friction: 4, tension: 80,
      }),
      Animated.timing(opacity, {
        toValue: 1, duration: 250, useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.timing(sparkle, {
        toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ).start();
    Animated.loop(
      Animated.timing(sparkleRot, {
        toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true,
      }),
    ).start();
  }, [idx, visible, scale, opacity, sparkle, sparkleRot]);

  const handleConfirm = () => {
    if (idx + 1 < badges.length) {
      setIdx(idx + 1);
    } else {
      onClose();
      setIdx(0);
    }
  };

  if (!visible) return null;
  const b = badges[idx];

  const sOpacity = sparkle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1, 0.3] });
  const sScale = sparkle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 1.2, 0.7] });
  const rotate = sparkleRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          <View style={styles.ribbon}>
            <Text style={styles.ribbonText}>NEW BADGE</Text>
          </View>

          {/* sparkle wrapper */}
          <View style={styles.badgeWrap}>
            <Animated.View style={[styles.sparkleA, { opacity: sOpacity, transform: [{ scale: sScale }, { rotate }] }]}>
              <Icon name="sparkles" size={16} color={COLORS.warning} />
            </Animated.View>
            <Animated.View style={[styles.sparkleB, { opacity: sOpacity, transform: [{ scale: sScale }, { rotate }] }]}>
              <Icon name="star" size={14} color={COLORS.pink} />
            </Animated.View>
            <Animated.View style={[styles.sparkleC, { opacity: sOpacity, transform: [{ scale: sScale }] }]}>
              <Icon name="star" size={12} color={COLORS.purple} />
            </Animated.View>

            <View style={[styles.bigCircle, { backgroundColor: b.bg }]}>
              <Icon name={b.icon} size={56} color={b.color} />
            </View>
          </View>

          <Text style={styles.acquired}>뱃지 획득!</Text>
          <Text style={styles.name}>{b.name}</Text>
          <Text style={styles.desc}>{b.desc}</Text>

          {badges.length > 1 && (
            <Text style={styles.counter}>{idx + 1} / {badges.length}</Text>
          )}

          <PressableScale style={styles.btn} onPress={handleConfirm}>
            <Text style={styles.btnText}>
              {idx + 1 < badges.length ? '다음' : '확인'}
            </Text>
          </PressableScale>
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
    borderRadius: 36,
    paddingTop: 22, paddingBottom: 24, paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: COLORS.purpleDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35, shadowRadius: 24, elevation: 16,
  },
  ribbon: {
    backgroundColor: COLORS.pinkSoft,
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 999, marginBottom: 14,
  },
  ribbonText: { fontSize: 12, fontWeight: '800', color: COLORS.primaryDark, letterSpacing: 1.5 },
  badgeWrap: {
    width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  bigCircle: {
    width: 116, height: 116, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
  sparkleA: { position: 'absolute', top: 4,  left: 8 },
  sparkleB: { position: 'absolute', top: 20, right: 6 },
  sparkleC: { position: 'absolute', bottom: 8, left: 18 },
  acquired: { fontSize: 14, fontWeight: '800', color: COLORS.primaryDark, letterSpacing: 0.3, marginBottom: 4 },
  name: { fontSize: 22, fontWeight: '900', color: COLORS.text, textAlign: 'center', marginBottom: 6 },
  desc: { fontSize: 15, color: COLORS.subText, textAlign: 'center', marginBottom: 14, lineHeight: 18 },
  counter: { fontSize: 13, color: COLORS.subText, marginBottom: 12 },
  btn: {
    width: '100%',
    backgroundColor: COLORS.primary, borderRadius: 999,
    paddingVertical: 17, alignItems: 'center',
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  btnText: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
});
