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
import {
  NotifPrefs,
  loadNotifPrefs,
  saveNotifPrefs,
  setChannelEnabled,
} from '../services/notificationPreferencesService';
import {
  scheduleMealPhotoAlarms,
  loadMealPhotoAlarms,
} from '../services/mealPhotoNotificationService';
import {
  scheduleMedicationAlarms,
  loadMedicationAlarms,
} from '../services/medicationNotificationService';
import { cancelDrinkNotificationsForDate } from '../services/drinkNotificationService';
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
  const [prefs, setPrefs] = useState<NotifPrefs>({
    meal_photo: true, medication: true, drink: true, warning: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings);
    loadNotifPrefs().then(setPrefs);
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
      await saveNotifPrefs(prefs);

      if (Platform.OS !== 'web') {
        await scheduleWaterNotifications(settings);
        await scheduleMealNotifications(settings);

        // 식사 사진 알림: OFF가 되면 기존 알림 취소, ON이 되면 재예약
        if (!prefs.meal_photo) {
          const { cancelMealPhotoAlarms } = await import('../services/mealPhotoNotificationService');
          await cancelMealPhotoAlarms();
        } else {
          const alarms = await loadMealPhotoAlarms();
          // askChannelPermission을 우회해서 바로 스케줄 (설정 화면에서 명시적으로 켠 것)
          await setChannelEnabled('meal_photo', true);
          await scheduleMealPhotoAlarms(alarms);
        }

        // 약 복용 알림: OFF면 취소
        if (!prefs.medication) {
          const { cancelMealPhotoAlarms: _ } = await import('../services/mealPhotoNotificationService');
          const notifee = (await import('@notifee/react-native')).default;
          const existing = await notifee.getTriggerNotifications();
          for (const n of existing) {
            if ((n.notification.android?.channelId ?? '') === 'medication') {
              await notifee.cancelNotification(n.notification.id!);
            }
          }
        } else {
          const alarms = await loadMedicationAlarms();
          await setChannelEnabled('medication', true);
          await scheduleMedicationAlarms(alarms);
        }
      }

      Alert.alert('저장 완료', '알림 설정이 저장되었습니다.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('오류', '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function updatePref<K extends keyof NotifPrefs>(key: K, val: boolean) {
    setPrefs(prev => ({ ...prev, [key]: val }));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* 생리주기 알림 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          
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

      {/* ─── 식사 사진 알림 ─────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          
          <Text style={styles.sectionTitle}>식사 사진 알림</Text>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>알림 사용</Text>
            <Text style={styles.rowDesc}>식사 시간마다 사진 촬영 알림</Text>
          </View>
          <Switch
            value={prefs.meal_photo}
            onValueChange={v => updatePref('meal_photo', v)}
            trackColor={{ false: '#CFD8DC', true: COLORS.primary + '99' }}
            thumbColor={prefs.meal_photo ? COLORS.primary : '#ECEFF1'}
          />
        </View>
        <Text style={styles.hint}>세부 시간 설정은 더보기 → 식사 사진 알림에서 변경하세요.</Text>
      </View>

      {/* ─── 약 복용 알림 ───────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          
          <Text style={styles.sectionTitle}>약 복용 알림</Text>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>알림 사용 (프리미엄)</Text>
            <Text style={styles.rowDesc}>설정한 시간에 복용 알림</Text>
          </View>
          <Switch
            value={prefs.medication}
            onValueChange={v => updatePref('medication', v)}
            trackColor={{ false: '#CFD8DC', true: COLORS.purple + '99' }}
            thumbColor={prefs.medication ? COLORS.purple : '#ECEFF1'}
          />
        </View>
        <Text style={styles.hint}>세부 약 목록은 더보기 → 약 복용 알림에서 관리하세요.</Text>
      </View>

      {/* ─── 술자리 알림 ────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          
          <Text style={styles.sectionTitle}>술자리 알림</Text>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>알림 사용</Text>
            <Text style={styles.rowDesc}>회식 전날 절약 알림 · 다음날 해장 추천</Text>
          </View>
          <Switch
            value={prefs.drink}
            onValueChange={v => updatePref('drink', v)}
            trackColor={{ false: '#CFD8DC', true: '#F5C99B99' }}
            thumbColor={prefs.drink ? '#F5C99B' : '#ECEFF1'}
          />
        </View>
        <Text style={styles.hint}>회식을 알리고 싶지 않다면 여기서 끄세요.</Text>
      </View>

      {/* ─── 칼로리 경고 알림 ───────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          
          <Text style={styles.sectionTitle}>칼로리 경고 알림</Text>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>알림 사용</Text>
            <Text style={styles.rowDesc}>저열량 경고 · 목표 초과 경고 · 매일 동기부여</Text>
          </View>
          <Switch
            value={prefs.warning}
            onValueChange={v => updatePref('warning', v)}
            trackColor={{ false: '#CFD8DC', true: COLORS.warning + '99' }}
            thumbColor={prefs.warning ? COLORS.warning : '#ECEFF1'}
          />
        </View>
        <Text style={styles.hint}>오후 2시 · 3시 · 목표 초과 시 즉시 발송됩니다.</Text>
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
    borderRadius: 26,
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
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#FFF5F8',
  },
  rowLabel: { fontSize: 16, color: COLORS.text, flex: 1 },
  rowDesc: { fontSize: 14, color: '#90A4AE', marginTop: 2 },
  hint: { fontSize: 14, color: '#90A4AE', marginTop: 8 },
  intervalPicker: { flexDirection: 'row', gap: 6 },
  intervalBtn: {
    paddingHorizontal: 18, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#FFF5F8',
  },
  intervalBtnActive: { backgroundColor: COLORS.water },
  intervalText: { fontSize: 15, color: '#8A7C9C', fontWeight: '600' },
  intervalTextActive: { color: '#fff' },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#FFF5F8',
  },
  timeLabel: { fontSize: 16, color: COLORS.text, width: 40 },
  timePicker: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeBtn: {
    width: 28, height: 28, borderRadius: 22,
    backgroundColor: '#FFF5F8', alignItems: 'center', justifyContent: 'center',
  },
  timeBtnText: { fontSize: 19, color: COLORS.primary, lineHeight: 22 },
  timeValue: { fontSize: 17, fontWeight: '700', color: COLORS.text, minWidth: 30, textAlign: 'center' },
  timeSep: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginHorizontal: 2 },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 24,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
});
