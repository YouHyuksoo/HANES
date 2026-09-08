const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 서버 시각을 브라우저 시간대와 무관하게 한국시간 YYYY-MM-DD HH:mm으로 표시한다. */
export function formatDateTimeKst(value?: string | Date | null, fallback = '-'): string {
  if (!value) return fallback;
  if (typeof value === 'string' && DATE_ONLY_RE.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}
