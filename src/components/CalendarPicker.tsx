import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS } from '../theme';

interface CalendarPickerProps {
  visible: boolean;
  value: string;      // YYYY-MM-DD
  maxDate?: string;   // YYYY-MM-DD, 미래 날짜 제한 (기본: 오늘)
  minDate?: string;   // YYYY-MM-DD
  onSelect: (date: string) => void;
  onClose: () => void;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=일요일
}

// 웹용: hidden input[type=date] 트릭
function openWebDatePicker(currentValue: string, maxDate: string, onSelect: (d: string) => void) {
  const input = document.createElement('input');
  input.type = 'date';
  input.value = currentValue;
  input.max = maxDate;
  input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
  document.body.appendChild(input);
  input.onchange = (e: any) => {
    const val = (e.target as HTMLInputElement).value;
    if (val) onSelect(val);
    document.body.removeChild(input);
  };
  input.onblur = () => {
    setTimeout(() => {
      if (document.body.contains(input)) document.body.removeChild(input);
    }, 200);
  };
  input.click();
}

export function openDatePicker(
  currentValue: string,
  maxDate: string,
  setVisible: (v: boolean) => void,
) {
  if (Platform.OS === 'web') {
    // 웹은 내장 date picker 사용 — CalendarPicker 없이 직접 호출
    return true; // web flag
  }
  setVisible(true);
  return false;
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarPicker({
  visible,
  value,
  maxDate,
  minDate,
  onSelect,
  onClose,
}: CalendarPickerProps) {
  const max = maxDate || todayStr();

  const parseDate = (str: string) => {
    const d = str || todayStr();
    return { y: parseInt(d.substring(0, 4)), m: parseInt(d.substring(5, 7)) - 1 };
  };

  const initial = parseDate(value);
  const [year, setYear] = useState(initial.y);
  const [month, setMonth] = useState(initial.m);

  useEffect(() => {
    if (visible) {
      const { y, m } = parseDate(value);
      setYear(y);
      setMonth(m);
    }
  }, [visible, value]);

  const goMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  };

  // 달력 셀 생성
  const firstDay = firstDayOfMonth(year, month);
  const days = daysInMonth(year, month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = todayStr();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* 월 네비게이션 */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => goMonth(-1)} style={styles.navBtn}>
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{year}년 {month + 1}월</Text>
            <TouchableOpacity onPress={() => goMonth(1)} style={styles.navBtn}>
              <Text style={styles.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* 요일 헤더 */}
          <View style={styles.row}>
            {DAY_LABELS.map((d, i) => (
              <Text
                key={d}
                style={[styles.dayLabel, i === 0 && styles.sun, i === 6 && styles.sat]}
              >
                {d}
              </Text>
            ))}
          </View>

          {/* 날짜 그리드 */}
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={`empty-${i}`} style={styles.cell} />;
              const dateStr = toStr(year, month, day);
              const isSelected = dateStr === value;
              const isToday = dateStr === today;
              const isDisabled =
                dateStr > max || (minDate ? dateStr < minDate : false);
              const isSun = i % 7 === 0;
              const isSat = i % 7 === 6;

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.cell, isSelected && styles.selectedCell]}
                  onPress={() => { if (!isDisabled) { onSelect(dateStr); onClose(); } }}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      isSun && !isSelected && styles.sun,
                      isSat && !isSelected && styles.sat,
                      isToday && !isSelected && styles.todayNum,
                      isSelected && styles.selectedNum,
                      isDisabled && styles.disabledNum,
                    ]}
                  >
                    {day}
                  </Text>
                  {isToday && !isSelected && <View style={styles.todayDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const CELL_SIZE = `${(100 / 7).toFixed(4)}%` as any;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navBtnText: { fontSize: 26, color: COLORS.primary, fontWeight: '600' },
  monthLabel: { fontSize: 17, fontWeight: '800', color: '#2C3E50' },
  row: { flexDirection: 'row', marginBottom: 8 },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#90A4AE',
    paddingVertical: 4,
  },
  sun: { color: '#FF5252' },
  sat: { color: '#448AFF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: CELL_SIZE,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCell: {
    backgroundColor: COLORS.primary,
    borderRadius: 50,
  },
  dayNum: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
  },
  todayNum: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  selectedNum: {
    color: '#fff',
    fontWeight: '800',
  },
  disabledNum: {
    color: '#D0D8E4',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    bottom: 4,
  },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#F0F4F8',
  },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: '#78909C' },
});
