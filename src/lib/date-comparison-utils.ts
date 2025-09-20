/**
 * 日時比較ユーティリティ
 * ConfluenceとLanceDBの更新日時を正確に比較するための関数群
 */

/**
 * 日時文字列をISO 8601形式に正規化
 * @param dateString - 日時文字列（様々な形式に対応）
 * @returns ISO 8601形式の日時文字列
 */
export function normalizeToISO8601(dateString: string | Date | undefined | null): string | null {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date string: ${dateString}`);
      return null;
    }
    return date.toISOString();
  } catch (error) {
    console.warn(`Error parsing date: ${dateString}`, error);
    return null;
  }
}

/**
 * 日時文字列をUTC時刻のDateオブジェクトに変換
 * @param dateString - 日時文字列
 * @returns UTC時刻のDateオブジェクト
 */
export function parseToUTCDate(dateString: string | Date | undefined | null): Date | null {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date string: ${dateString}`);
      return null;
    }
    return date;
  } catch (error) {
    console.warn(`Error parsing date: ${dateString}`, error);
    return null;
  }
}

/**
 * 2つの日時を比較（ミリ秒精度）
 * @param date1 - 比較対象の日時1
 * @param date2 - 比較対象の日時2
 * @returns 比較結果: -1 (date1 < date2), 0 (date1 = date2), 1 (date1 > date2)
 */
export function compareDates(date1: string | Date | undefined | null, date2: string | Date | undefined | null): number {
  const d1 = parseToUTCDate(date1);
  const d2 = parseToUTCDate(date2);
  
  if (!d1 && !d2) return 0;
  if (!d1) return -1;
  if (!d2) return 1;
  
  const time1 = d1.getTime();
  const time2 = d2.getTime();
  
  if (time1 < time2) return -1;
  if (time1 > time2) return 1;
  return 0;
}

/**
 * 日時1が日時2より新しいかどうかを判定
 * @param date1 - 比較対象の日時1
 * @param date2 - 比較対象の日時2
 * @returns date1 > date2 の場合 true
 */
export function isNewerThan(date1: string | Date | undefined | null, date2: string | Date | undefined | null): boolean {
  return compareDates(date1, date2) > 0;
}

/**
 * 日時1が日時2より古いかどうかを判定
 * @param date1 - 比較対象の日時1
 * @param date2 - 比較対象の日時2
 * @returns date1 < date2 の場合 true
 */
export function isOlderThan(date1: string | Date | undefined | null, date2: string | Date | undefined | null): boolean {
  return compareDates(date1, date2) < 0;
}

/**
 * 2つの日時が等しいかどうかを判定（ミリ秒精度）
 * @param date1 - 比較対象の日時1
 * @param date2 - 比較対象の日時2
 * @returns date1 = date2 の場合 true
 */
export function isEqual(date1: string | Date | undefined | null, date2: string | Date | undefined | null): boolean {
  return compareDates(date1, date2) === 0;
}

/**
 * 日時の差分をミリ秒で取得
 * @param date1 - 比較対象の日時1
 * @param date2 - 比較対象の日時2
 * @returns 差分（ミリ秒）、無効な日時の場合は null
 */
export function getTimeDifference(date1: string | Date | undefined | null, date2: string | Date | undefined | null): number | null {
  const d1 = parseToUTCDate(date1);
  const d2 = parseToUTCDate(date2);
  
  if (!d1 || !d2) return null;
  
  return d1.getTime() - d2.getTime();
}

/**
 * 日時文字列を人間が読みやすい形式にフォーマット
 * @param dateString - 日時文字列
 * @param timezone - タイムゾーン（デフォルト: 'Asia/Tokyo'）
 * @returns フォーマットされた日時文字列
 */
export function formatDateForDisplay(dateString: string | Date | undefined | null, timezone: string = 'Asia/Tokyo'): string {
  if (!dateString) return 'N/A';
  
  const date = parseToUTCDate(dateString);
  if (!date) return 'Invalid Date';
  
  try {
    return date.toLocaleString('ja-JP', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (error) {
    return date.toISOString();
  }
}

/**
 * 現在時刻との差分を人間が読みやすい形式で取得
 * @param dateString - 日時文字列
 * @returns 相対時間文字列（例: "2時間前", "3日前"）
 */
export function getRelativeTime(dateString: string | Date | undefined | null): string {
  if (!dateString) return 'N/A';
  
  const date = parseToUTCDate(dateString);
  if (!date) return 'Invalid Date';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) return `${diffSeconds}秒前`;
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 30) return `${diffDays}日前`;
  
  return formatDateForDisplay(dateString);
}

/**
 * 日時比較のデバッグ情報を生成
 * @param date1 - 比較対象の日時1
 * @param date2 - 比較対象の日時2
 * @param label1 - 日時1のラベル
 * @param label2 - 日時2のラベル
 * @returns デバッグ情報オブジェクト
 */
export function getDateComparisonDebugInfo(
  date1: string | Date | undefined | null,
  date2: string | Date | undefined | null,
  label1: string = 'Date1',
  label2: string = 'Date2'
): {
  date1: { raw: string | null, iso: string | null, utc: Date | null, display: string };
  date2: { raw: string | null, iso: string | null, utc: Date | null, display: string };
  comparison: { result: number, isNewer: boolean, isOlder: boolean, isEqual: boolean, differenceMs: number | null };
} {
  const d1 = parseToUTCDate(date1);
  const d2 = parseToUTCDate(date2);
  
  return {
    date1: {
      raw: date1 ? String(date1) : null,
      iso: normalizeToISO8601(date1),
      utc: d1,
      display: formatDateForDisplay(date1)
    },
    date2: {
      raw: date2 ? String(date2) : null,
      iso: normalizeToISO8601(date2),
      utc: d2,
      display: formatDateForDisplay(date2)
    },
    comparison: {
      result: compareDates(date1, date2),
      isNewer: isNewerThan(date1, date2),
      isOlder: isOlderThan(date1, date2),
      isEqual: isEqual(date1, date2),
      differenceMs: getTimeDifference(date1, date2)
    }
  };
}
