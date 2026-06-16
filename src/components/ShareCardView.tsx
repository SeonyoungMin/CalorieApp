import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { ArchiveEntry } from '../types/archive';

// 카테고리별 테두리 색 (파스텔)
const CAT_BG: Record<string, string> = {
  '식단':  '#FFD6E5',
  '오운완': '#D4ECDE',
  '술자리': '#E6DAF5',
  '일상':  '#FDE5C9',
};

interface Props {
  entry: ArchiveEntry;
  diary?: string;
}

// ─── 사진 레이아웃 ────────────────────────────────────────────────────────────
function PhotoLayout({ photos }: { photos: string[] }) {
  if (photos.length === 0) {
    return <View style={photoStyles.empty} />;
  }
  if (photos.length === 1) {
    return <Image source={{ uri: photos[0] }} style={photoStyles.fill} resizeMode="cover" />;
  }
  return (
    <View style={photoStyles.grid}>
      <Image source={{ uri: photos[0] }} style={photoStyles.gridLeft} resizeMode="cover" />
      <View style={photoStyles.gridRight}>
        <Image source={{ uri: photos[1] }} style={[photoStyles.gridCell, { marginBottom: 6 }]} resizeMode="cover" />
        {photos[2] ? (
          <Image source={{ uri: photos[2] }} style={photoStyles.gridCell} resizeMode="cover" />
        ) : (
          <View style={[photoStyles.gridCell, { backgroundColor: 'rgba(255,255,255,0.5)' }]} />
        )}
      </View>
    </View>
  );
}

const photoStyles = StyleSheet.create({
  fill:      { width: '100%', height: '100%', borderRadius: 36 },
  empty:     { width: '100%', height: '100%', borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.5)' },
  grid:      { flexDirection: 'row', gap: 6, width: '100%', height: '100%' },
  gridLeft:  { flex: 1, borderRadius: 36 },
  gridRight: { flex: 1, flexDirection: 'column' },
  gridCell:  { flex: 1, borderRadius: 36 },
});

// ─── ShareCardView ────────────────────────────────────────────────────────────
// 1080×1920, 사진 + 파스텔 테두리 + 하단 BBulma 로고만 (미니멀)
export default function ShareCardView({ entry }: Props) {
  const bg = CAT_BG[entry.category] ?? CAT_BG['일상'];

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.photoFrame}>
        <PhotoLayout photos={entry.photos} />
      </View>

      <View style={styles.logoFooter}>
        <View style={styles.logoDot} />
        <Text style={styles.logoText}>BBulma</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 1080,
    height: 1920,
    paddingHorizontal: 50,
    paddingTop: 50,
    paddingBottom: 30,
    alignItems: 'center',
  },
  photoFrame: {
    width: 980,
    height: 1660,
    borderRadius: 36,
    overflow: 'hidden',
  },
  logoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 30,
  },
  logoDot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#E58FB5',
  },
  logoText: {
    fontSize: 44,
    fontWeight: '900',
    color: '#4A3A5C',
    letterSpacing: 2,
  },
});
