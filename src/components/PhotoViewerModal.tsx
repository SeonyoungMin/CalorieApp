import React, { useState } from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import RNBlobUtil from 'react-native-blob-util';
import { COLORS } from '../theme';
import Icon from './Icon';

const { width: SW, height: SH } = Dimensions.get('window');

type Props = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
};

async function ensureAndroidPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const apiLevel = Number(Platform.Version);
  // Android 13+ (API 33+)는 WRITE_EXTERNAL_STORAGE 자동 처리. Android 10 이하만 필요.
  if (apiLevel >= 29) return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      title: '사진 저장',
      message: '갤러리에 사진을 저장하려면 권한이 필요해요.',
      buttonPositive: '허용',
      buttonNegative: '취소',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export default function PhotoViewerModal({ visible, uri, onClose }: Props) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!uri || saving) return;
    setSaving(true);
    try {
      const ok = await ensureAndroidPermission();
      if (!ok) {
        Alert.alert('권한 필요', '갤러리 저장 권한을 허용해주세요.');
        return;
      }

      let savePath = uri;
      // 원격 URL이면 임시 캐시에 먼저 다운로드
      if (uri.startsWith('http')) {
        const ext = (uri.split('?')[0].split('.').pop() ?? 'jpg').toLowerCase();
        const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
        const tmpPath = `${RNBlobUtil.fs.dirs.CacheDir}/bbulma_${Date.now()}.${safeExt}`;
        const res = await RNBlobUtil.config({ path: tmpPath, fileCache: true })
          .fetch('GET', uri);
        const status = res.info().status;
        if (status !== 200) throw new Error(`다운로드 실패 (${status})`);
        savePath = 'file://' + res.path();
      }

      await CameraRoll.save(savePath, { type: 'photo', album: '쁠마' });
      Alert.alert('저장 완료', '갤러리에 저장됐어요!');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message || '이미지를 저장할 수 없어요.');
    } finally {
      setSaving(false);
    }
  };

  if (!uri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.95)" />
      <View style={styles.root}>
        {/* 닫기 (왼쪽 위) */}
        <TouchableOpacity style={[styles.iconBtn, styles.closeBtn]} onPress={onClose} activeOpacity={0.7}>
          <Icon name="close" size={22} color="#fff" />
        </TouchableOpacity>

        {/* 저장 (오른쪽 위) */}
        <TouchableOpacity
          style={[styles.iconBtn, styles.saveBtn]}
          onPress={handleSave}
          activeOpacity={0.7}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Icon name="image" size={20} color="#fff" />
          )}
        </TouchableOpacity>

        {/* 사진 — 화면 전체 (aspect 유지) */}
        <TouchableOpacity activeOpacity={1} style={styles.imageWrap} onPress={onClose}>
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrap: {
    width: SW,
    height: SH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SW,
    height: SH,
  },
  iconBtn: {
    position: 'absolute',
    top: 48,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtn: { left: 18 },
  saveBtn: { right: 18 },
});
