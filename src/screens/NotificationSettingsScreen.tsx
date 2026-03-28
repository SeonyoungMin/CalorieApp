import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  NotificationSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  scheduleWaterNotifications,
  scheduleMealNotifications,
  requestNotificationPermission,
} from '../services/notificationService';
import { COLORS } from '../theme';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function TimePickerRow({
  label,
  hour,
  minute,
  onChangeHour,
  onChangeMinute,
}: {
  label: string;
  hour: number;
  minute: number;
  onChangeHour: (h: number) => void;
  onChangeMinute: (m: number) => void;
}) {
  return (
    <View style={styles.timeRow}>
      <Text style={styles.timeLabel}>{label}</Text>
      <View style={styles.timePicker}>
        <TouchableOpacity
          onPress={() => onChangeHour((hour - 1 + 24) % 24)}
          style={styles.timeBtn}
        >
          <Text style={styles.timeBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.timeValue}>{pad(hour)}</Text>
        <TouchableOpacity
          onPress={() => onChangeHour((hour + 1) % 24)}
          style={styles.timeBtn}
        >
          <Text style={styles.timeBtnText}>›</Text>
        </TouchableOpacity>
        <Text style={styles.timeSep}>:</Text>
        <TouchableOpacity
          onPress={() => onChangeMinute(minute === 0 ? 30 : 0)}
          style={styles.timeBtn}
        >
          <Text style={styles.timeBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.timeValue}>{pad(minute)}</Text>
        <TouchableOpacity
          onPress={() => onChangeMinute(minute === 0 ? 30 : 0)}
          style={styles.timeBtn}
        >
          <Text style={styles.timeBtnText}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const navigation = useNavigation();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  function update(partial: Partial<NotificationSettings>) {
    setSettings(prev => ({ ...prev, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (Platform.OS !== 'web') {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert('알림 권한 필요', '설정에서 알림 권한을 허용해주세요.');
          setSaving(false);
          return;
        }
      }
      await saveSettings(settings);
      if (Platform.OS !== 'web') {
        await scheduleWaterNotifications(settings);
        await scheduleMealNotifications(settings);
      }
      Alert.alert('저장 완료', '알림 설정이 저장되었습니다.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('오류', '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>알림 설정</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* 생리주기 알림 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEmoji}>🌸</Text>
          <Text style={styles.sectionTitle}>생리주기 알림</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>예정일 1~2일 전 오전 9시 알림</Text>
          <Switch
            value={settings.cycleEnabled}
            onValueChange={v => update({ cycleEnabled: v })}
            trackColor={{ false: '#CFD8DC', true: COLORS.pink + '99' }}
            thumbColor={settings.cycleEnabled ? COLORS.pink : '#ECEFF1'}
          />
        </View>
        <Text style={styles.hint}>생리주기 화면에서 다음 예정일이 설정된 경우에만 동작합니다.</Text>
      </View>

      {/* 물 마시기 알림 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEmoji}>💧</Text>
          <Text style={styles.sectionTitle}>물 마시기 알림</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>알림 사용</Text>
          <Switch
            value={settings.waterEnabled}
            onValueChange={v => update({ waterEnabled: v })}
            trackColor={{ false: '#CFD8DC', true: COLORS.water + '99' }}
            thumbColor={settings.waterEnabled ? COLORS.water : '#ECEFF1'}
          />
        </View>
        {settings.waterEnabled && (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>알림 간격</Text>
              <View style={styles.intervalPicker}>
                {[1, 2, 3, 4].map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.intervalBtn, settings.waterIntervalHours === h && styles.intervalBtnActive]}
                    onPress={() => update({ waterIntervalHours: h })}
                  >
                    <Text style={[styles.intervalText, settings.waterIntervalHours === h && styles.intervalTextActive]}>
                      {h}시간
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>시작 시간</Text>
              <View style={styles.timePicker}>
                <TouchableOpacity onPress={() => update({ waterStartHour: (settings.waterStartHour - 1 + 24) % 24 })} style={styles.timeBtn}>
                  <Text style={styles.timeBtnText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.timeValue}>{pad(settings.waterStartHour)}:00</Text>
                <TouchableOpacity onPress={() => update({ waterStartHour: (settings.waterStartHour + 1) % 24 })} style={styles.timeBtn}>
                  <Text style={styles.timeBtnText}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>종료 시간</Text>
              <View style={styles.timePicker}>
                <TouchableOpacity onPress={() => update({ waterEndHour: (settings.waterEndHour - 1 + 24) % 24 })} style={styles.timeBtn}>
                  <Text style={styles.timeBtnText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.timeValue}>{pad(settings.waterEndHour)}:00</Text>
                <TouchableOpacity onPress={() => update({ waterEndHour: (settings.waterEndHour + 1) % 24 })} style={styles.timeBtn}>
                  <Text style={styles.timeBtnText}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>

      {/* 식사 알림 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEmoji}>🍽️</Text>
          <Text style={styles.sectionTitle}>식사 알림</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>알림 사용</Text>
          <Switch
            value={settings.mealEnabled}
            onValueChange={v => update({ mealEnabled: v })}
            trackColor={{ false: '#CFD8DC', true: COLORS.primary + '99' }}
            thumbColor={settings.mealEnabled ? COLORS.primary : '#ECEFF1'}
          />
        </View>
        {settings.mealEnabled && (
          <>
            <TimePickerRow
              label="아침"
              hour={settings.breakfastHour}
              minute={settings.breakfastMinute}
              onChangeHour={h => update({ breakfastHour: h })}
              onChangeMinute={m => update({ breakfastMinute: m })}
            />
            <TimePickerRow
              label="점심"
              hour={settings.lunchHour}
              minute={settings.lunchMinute}
              onChangeHour={h => update({ lunchHour: h })}
              onChangeMinute={m => update({ lunchMinute: m })}
            />
            <TimePickerRow
              label="저녁"
              hour={settings.dinnerHour}
              minute={settings.dinnerMinute}
              onChangeHour={h => update({ dinnerHour: h })}
              onChangeMinute={m => update({ dinnerMinute: m })}
            />
          </>
        )}
      </View>

      {/* 저장 버튼 */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        <Text style={styles.saveBtnText}>{saving ? '저장 중...' : '저장하기'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 48 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 24, marginTop: 8,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 28, color: COLORS.text, lineHeight: 32 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionEmoji: { fontSize: 22, marginRight: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F4F8',
  },
  rowLabel: { fontSize: 14, color: COLORS.text, flex: 1 },
  hint: { fontSize: 12, color: '#90A4AE', marginTop: 8 },
  intervalPicker: { flexDirection: 'row', gap: 6 },
  intervalBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12, backgroundColor: '#F0F4F8',
  },
  intervalBtnActive: { backgroundColor: COLORS.water },
  intervalText: { fontSize: 13, color: '#78909C', fontWeight: '600' },
  intervalTextActive: { color: '#fff' },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F4F8',
  },
  timeLabel: { fontSize: 14, color: COLORS.text, width: 40 },
  timePicker: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F0F4F8', alignItems: 'center', justifyContent: 'center',
  },
  timeBtnText: { fontSize: 18, color: COLORS.primary, lineHeight: 22 },
  timeValue: { fontSize: 16, fontWeight: '700', color: COLORS.text, minWidth: 30, textAlign: 'center' },
  timeSep: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginHorizontal: 2 },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
