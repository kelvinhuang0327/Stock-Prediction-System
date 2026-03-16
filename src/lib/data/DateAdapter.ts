/**
 * DateAdapter - 統一日期格式轉換器
 * 
 * 本系統 DB 中存在三種日期格式：
 *   1. ROC 7-digit: "1150127" → 民國 115 年 1 月 27 日 → 2026-01-27
 *   2. YYYYMMDD 8-digit: "20260210" → 2026-02-10
 *   3. ISO 10-char: "2025-03-03" → 2025-03-03
 * 
 * 此 adapter 將所有格式統一轉換為 ISO (YYYY-MM-DD)
 */

export type DateFormat = 'roc7' | 'yyyymmdd' | 'iso' | 'unknown';

/** 偵測日期字串的格式 */
export function detectDateFormat(dateStr: string): DateFormat {
  if (!dateStr || typeof dateStr !== 'string') return 'unknown';
  const trimmed = dateStr.trim();

  // ISO: "2025-03-03" (10 chars, has dashes)
  if (trimmed.length === 10 && trimmed[4] === '-' && trimmed[7] === '-') {
    return 'iso';
  }

  // YYYYMMDD: "20260210" (8 chars, starts with 19xx or 20xx)
  if (trimmed.length === 8 && /^(19|20)\d{6}$/.test(trimmed)) {
    return 'yyyymmdd';
  }

  // ROC 7-digit: "1150127" (7 chars, ROC year 1xx = AD 2xxx)
  if (trimmed.length === 7 && /^\d{7}$/.test(trimmed)) {
    return 'roc7';
  }

  return 'unknown';
}

/** 將任何支援的日期格式轉為 ISO (YYYY-MM-DD) */
export function toISO(dateStr: string): string | null {
  const format = detectDateFormat(dateStr);
  const trimmed = dateStr.trim();

  switch (format) {
    case 'iso':
      return trimmed;

    case 'yyyymmdd':
      return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;

    case 'roc7': {
      const rocYear = parseInt(trimmed.slice(0, 3), 10);
      const month = trimmed.slice(3, 5);
      const day = trimmed.slice(5, 7);
      const adYear = rocYear + 1911;
      return `${adYear}-${month}-${day}`;
    }

    default:
      return null;
  }
}

/** 將 ISO 日期轉為 ROC 7-digit 格式 (用於查詢既有 DB 資料) */
export function toROC7(isoDate: string): string {
  const year = parseInt(isoDate.slice(0, 4), 10);
  const rocYear = year - 1911;
  const month = isoDate.slice(5, 7);
  const day = isoDate.slice(8, 10);
  return `${rocYear}${month}${day}`;
}

/** 將 ISO 日期轉為 YYYYMMDD 格式 */
export function toYYYYMMDD(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

/** 安全比較兩個任意格式的日期 (皆先轉 ISO) */
export function compareDates(a: string, b: string): number {
  const isoA = toISO(a);
  const isoB = toISO(b);
  if (!isoA || !isoB) return 0;
  return isoA.localeCompare(isoB);
}

/** 判斷日期是否在範圍內 (inclusive) */
export function isDateInRange(date: string, start: string, end: string): boolean {
  return compareDates(date, start) >= 0 && compareDates(date, end) <= 0;
}

/** 取得今天的各種格式 */
export function todayFormats(): { iso: string; yyyymmdd: string; roc7: string } {
  const now = new Date();
  const iso = now.toISOString().split('T')[0];
  return {
    iso,
    yyyymmdd: toYYYYMMDD(iso),
    roc7: toROC7(iso),
  };
}

/**
 * 建立查詢多種日期格式的 Prisma where 條件
 * 因 DB 中同一表可能有混合格式，查詢時需同時匹配所有可能格式
 */
export function dateQueryVariants(isoDate: string): string[] {
  return [isoDate, toYYYYMMDD(isoDate), toROC7(isoDate)];
}

/**
 * 批量正規化日期陣列，回傳統一的 ISO 格式
 * 無法轉換的值會被過濾掉
 */
export function normalizeDates(dates: string[]): string[] {
  return dates.map(toISO).filter((d): d is string => d !== null);
}

/**
 * 轉換帶有 date 欄位的記錄，統一為 ISO 格式
 */
export function normalizeRecordDate<T extends { date: string }>(record: T): T & { dateISO: string; dateOriginal: string } {
  const iso = toISO(record.date);
  return {
    ...record,
    dateISO: iso ?? record.date,
    dateOriginal: record.date,
  };
}
