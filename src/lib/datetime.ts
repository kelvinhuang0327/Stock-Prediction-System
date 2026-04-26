const TAIPEI_LOCALE = 'zh-TW';
const TAIPEI_TIME_ZONE = 'Asia/Taipei';

const taipeiDateTimeFormatter = new Intl.DateTimeFormat(TAIPEI_LOCALE, {
  timeZone: TAIPEI_TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function formatTaipeiDateTime(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback;

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return taipeiDateTimeFormatter.format(date);
  } catch {
    return value;
  }
}