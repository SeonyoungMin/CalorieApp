import React, { useRef } from 'react';
import {
  Pressable,
  Animated,
  StyleSheet,
  StyleProp,
  ViewStyle,
  PressableProps,
  GestureResponderEvent,
} from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: React.ReactNode;
};

export default function PressableScale({
  style,
  scaleTo = 0.96,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Pressable에 넘어가는 사용자 style에서 layout/정렬 prop만 추출해서
  // 안쪽 Animated.View에도 동일하게 적용. (그래야 children 배치가 호출자 의도대로 됨)
  const flat = StyleSheet.flatten(style) || {};
  const innerLayout: ViewStyle = {
    alignItems: flat.alignItems,
    justifyContent: flat.justifyContent,
    flexDirection: flat.flexDirection,
    flexWrap: flat.flexWrap,
    gap: (flat as any).gap,
    rowGap: (flat as any).rowGap,
    columnGap: (flat as any).columnGap,
  };

  const handleIn = (e: GestureResponderEvent) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: scaleTo,
        useNativeDriver: true,
        speed: 60,
        bounciness: 0,
      }),
      Animated.timing(opacity, {
        toValue: 0.85,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
    onPressIn?.(e);
  };

  const handleOut = (e: GestureResponderEvent) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
        bounciness: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
    onPressOut?.(e);
  };

  return (
    <Pressable
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={style}
      {...rest}
    >
      <Animated.View
        style={[
          styles.inner,
          innerLayout,
          { transform: [{ scale }], opacity },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    width: '100%',
    // height '100%'는 부모 height가 explicit하지 않을 때(예: paddingVertical만으로 자식 크기로 박히는 버튼) 무한 확장됨.
    // 부모를 가득 채워야 하는 경우(summary/quick 카드 그리드 등)는 부모가 explicit width/height/flex를 가짐 → 자식 width '100%'만으로 충분.
  },
});
