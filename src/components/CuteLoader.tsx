import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Icon, { IconName } from './Icon';
import { COLORS } from '../theme';

type Props = {
  message?: string;
  icon?: IconName;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
};

export default function CuteLoader({
  message = '잠시만 기다려주세요...',
  icon = 'sparkles',
  size = 'md',
  color = COLORS.primary,
}: Props) {
  const rotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const msgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 회전 (2초 주기)
    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    // 펄스 (스케일 1 ↔ 1.12, 1초 주기)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    // 도트 3개 sequential bouncing
    const bounce = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 360, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(720 - delay),
        ]),
      );
    bounce(dot1, 0).start();
    bounce(dot2, 160).start();
    bounce(dot3, 320).start();

    // 메시지 페이드인
    Animated.timing(msgOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [rotate, pulse, dot1, dot2, dot3, msgOpacity]);

  const ringSize = size === 'sm' ? 64 : size === 'lg' ? 112 : 88;
  const iconSize = size === 'sm' ? 26 : size === 'lg' ? 48 : 36;
  const dotSize = size === 'sm' ? 6 : 8;

  const rotateInterp = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scaleInterp = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const dotTransform = (v: Animated.Value) => ({
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
  });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            backgroundColor: color + '18',
            transform: [{ scale: scaleInterp }],
          },
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: rotateInterp }] }}>
          <Icon name={icon} size={iconSize} color={color} />
        </Animated.View>
      </Animated.View>

      <View style={styles.dotsRow}>
        {[dot1, dot2, dot3].map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { width: dotSize, height: dotSize, borderRadius: dotSize, backgroundColor: color },
              dotTransform(v),
            ]}
          />
        ))}
      </View>

      <Animated.Text style={[styles.message, { opacity: msgOpacity }]}>{message}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  dotsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  dot: {},
  message: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.subText,
    fontWeight: '600',
    textAlign: 'center',
  },
});
