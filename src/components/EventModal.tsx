import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { COLORS } from '../theme';
import Icon from './Icon';
import PressableScale from './PressableScale';

type Props = {
  visible: boolean;
  onConfirm: () => void;
};

const { width } = Dimensions.get('window');
const CARD_W = Math.min(width - 48, 380);

export default function EventModal({ visible, onConfirm }: Props) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const crownRotate = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 80,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(crownRotate, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(crownRotate, {
            toValue: -1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(crownRotate, {
            toValue: 0,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();

      Animated.loop(
        Animated.timing(sparkle, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ).start();
    } else {
      scale.setValue(0.85);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity, crownRotate, sparkle]);

  const rotate = crownRotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-10deg', '10deg'],
  });

  const sparkleOpacity = sparkle.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  const sparkleScale = sparkle.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.8, 1.15, 0.8],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          <View style={styles.ribbonRow}>
            <View style={styles.ribbon}>
              <Text style={styles.ribbonText}>SPECIAL EVENT</Text>
            </View>
          </View>

          <View style={styles.crownWrap}>
            <Animated.View style={[styles.sparkleLeft, { opacity: sparkleOpacity, transform: [{ scale: sparkleScale }] }]}>
              <Icon name="star" size={14} color={COLORS.warning} />
            </Animated.View>
            <Animated.View style={[styles.sparkleRight, { opacity: sparkleOpacity, transform: [{ scale: sparkleScale }] }]}>
              <Icon name="star" size={18} color={COLORS.pink} />
            </Animated.View>
            <Animated.View style={[styles.crownCircle, { transform: [{ rotate }] }]}>
              <Icon name="crown" size={42} color="#FFFFFF" />
            </Animated.View>
          </View>

          <Text style={styles.title}>전 기능 무료 이벤트</Text>
          <Text style={styles.subtitle}>
            출시 기념으로{'\n'}<Text style={styles.subtitleHighlight}>모든 프리미엄 기능</Text>을 무료로 즐기세요!
          </Text>

          <View style={styles.perksBox}>
            <PerkItem text="AI 칼로리 스캔 무제한" />
            <PerkItem text="AI 식단 · 운동 · 주간 리포트" />
            <PerkItem text="목표 달성 D-day · BMI 인사이트" />
            <PerkItem text="치팅데이 코인 · 연속 달성" />
          </View>

          <View style={styles.periodBox}>
            <Text style={styles.periodLabel}>이벤트 기간</Text>
            <Text style={styles.periodValue}>2026.06 ~ 2026.07</Text>
          </View>

          <PressableScale style={styles.btn} onPress={onConfirm}>
            <Text style={styles.btnText}>지금 바로 시작하기</Text>
          </PressableScale>

          <Text style={styles.footnote}>이 안내는 한 번만 표시됩니다</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PerkItem({ text }: { text: string }) {
  return (
    <View style={styles.perkRow}>
      <View style={styles.perkDot}>
        <Icon name="check" size={11} color="#fff" />
      </View>
      <Text style={styles.perkText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(74, 58, 92, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: CARD_W,
    backgroundColor: COLORS.card,
    borderRadius: 36,
    paddingTop: 22,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: COLORS.purpleDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  ribbonRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  ribbon: {
    backgroundColor: COLORS.pinkSoft,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ribbonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 1.5,
  },
  crownWrap: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  crownCircle: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  sparkleLeft: {
    position: 'absolute',
    left: 4,
    top: 8,
  },
  sparkleRight: {
    position: 'absolute',
    right: 0,
    top: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.subText,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  subtitleHighlight: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  perksBox: {
    width: '100%',
    backgroundColor: COLORS.bgAlt,
    borderRadius: 22,
    paddingVertical: 17,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  perkDot: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
  },
  periodBox: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.lavender,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  periodLabel: {
    fontSize: 14,
    color: COLORS.purpleDark,
    fontWeight: '700',
  },
  periodValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '800',
  },
  btn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
  footnote: {
    fontSize: 13,
    color: COLORS.subText,
    marginTop: 12,
  },
});
