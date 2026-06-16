import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../theme';
import Icon from './Icon';
import { BADGES, Badge } from '../data/badges';

type Props = {
  unlockedIds: string[];
  points: number;
  onPressMore?: () => void;
  compact?: boolean;
};

export default function BadgeGrid({ unlockedIds, points, compact = false }: Props) {
  const unlockedSet = new Set(unlockedIds);
  const sortedBadges = [...BADGES].sort((a, b) => {
    const ua = unlockedSet.has(a.id) ? 0 : 1;
    const ub = unlockedSet.has(b.id) ? 0 : 1;
    return ua - ub;
  });

  const visible = compact ? sortedBadges.slice(0, 6) : sortedBadges;
  const unlockedCount = unlockedIds.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>나의 뱃지</Text>
          <Text style={styles.sub}>
            {unlockedCount} / {BADGES.length} 획득
          </Text>
        </View>
        <View style={styles.pointBox}>
          <Icon name="sparkles" size={14} color={COLORS.primaryDark} />
          <Text style={styles.pointNum}>{points.toLocaleString('ko-KR')}</Text>
          <Text style={styles.pointUnit}>P</Text>
        </View>
      </View>

      <ScrollView
        horizontal={compact}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={compact ? styles.scrollH : undefined}
      >
        <View style={compact ? styles.rowH : styles.grid}>
          {visible.map((b) => (
            <BadgeChip key={b.id} badge={b} unlocked={unlockedSet.has(b.id)} compact={compact} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function BadgeChip({ badge, unlocked, compact }: { badge: Badge; unlocked: boolean; compact: boolean }) {
  return (
    <View style={[styles.chip, compact && styles.chipH]}>
      <View
        style={[
          styles.circle,
          { backgroundColor: unlocked ? badge.bg : COLORS.cardSoft },
        ]}
      >
        <Icon
          name={badge.icon}
          size={22}
          color={unlocked ? badge.color : COLORS.inactive}
        />
      </View>
      <Text
        style={[styles.name, !unlocked && styles.nameLocked]}
        numberOfLines={1}
      >
        {badge.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  sub:   { fontSize: 13, color: COLORS.subText, marginTop: 2, fontWeight: '600' },
  pointBox: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.lavender,
    borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  pointNum: { fontSize: 16, fontWeight: '800', color: COLORS.purpleDark, marginLeft: 2 },
  pointUnit: { fontSize: 13, color: COLORS.purpleDark, fontWeight: '700' },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-start',
  },
  rowH: { flexDirection: 'row', gap: 8 },
  scrollH: { paddingRight: 4 },
  chip: {
    width: '22%', alignItems: 'center',
  },
  chipH: { width: 64 },
  circle: {
    width: 54, height: 54, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  name: { fontSize: 13, color: COLORS.text, fontWeight: '700', textAlign: 'center' },
  nameLocked: { color: COLORS.inactive, fontWeight: '600' },
});
