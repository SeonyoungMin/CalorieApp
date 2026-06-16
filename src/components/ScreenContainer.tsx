import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  keyboard?: boolean;
  edge?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  background?: string;
  refreshControl?: React.ReactElement;
};

export default function ScreenContainer({
  children,
  scroll = true,
  keyboard = true,
  edge = SPACING.edge,
  style,
  contentStyle,
  background = COLORS.bg,
  refreshControl,
}: Props) {
  const insets = useSafeAreaInsets();
  const padBottom = Math.max(insets.bottom, 16) + SPACING.bottomSafe;
  const padTop = SPACING.topSafe;

  const contentInner: StyleProp<ViewStyle> = [
    {
      paddingHorizontal: edge,
      paddingTop: padTop,
      paddingBottom: padBottom,
    },
    contentStyle,
  ];

  const Body = scroll ? (
    <ScrollView
      style={[styles.flex, { backgroundColor: background }, style]}
      contentContainerStyle={contentInner}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, { backgroundColor: background }, contentInner, style]}>
      {children}
    </View>
  );

  if (!keyboard) return Body;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {Body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
