export const localDateStr = (date = new Date()): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// 디바이스 타임존 설정에 무관하게 항상 한국(Asia/Seoul) 기준 오늘 날짜 반환
export const todayStr = (): string => {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
};

export const dateLabel = (d: string): string => {
  const today = todayStr();
  const yDate = new Date();
  yDate.setDate(yDate.getDate() - 1);
  const yesterday = localDateStr(yDate);
  if (d === today) return '오늘';
  if (d === yesterday) return '어제';
  return d;
};

// 날짜 문자열(YYYY-MM-DD)을 파싱할 때 타임존 오차를 방지하기 위해 정오(T12:00:00) 기준으로 파싱
export const parseLocalDate = (dateStr: string): Date => {
  return new Date(dateStr + 'T12:00:00');
};
