/**
 * 日時比較機能のテストスクリプト
 * 様々な日時形式での比較テストを実行
 */

import 'dotenv/config';
import { 
  compareDates, 
  isNewerThan, 
  isOlderThan, 
  isEqual,
  getDateComparisonDebugInfo,
  formatDateForDisplay,
  getRelativeTime,
  normalizeToISO8601,
  parseToUTCDate
} from '../lib/date-comparison-utils';

function runDateComparisonTests() {
  console.log('🧪 日時比較機能のテストを開始');
  console.log('='.repeat(50));

  // テストケース1: 基本的な日時比較
  console.log('\n📅 テストケース1: 基本的な日時比較');
  const date1 = '2025-01-20T10:30:00.000Z';
  const date2 = '2025-01-20T10:30:00.001Z';
  
  console.log(`Date1: ${date1}`);
  console.log(`Date2: ${date2}`);
  console.log(`比較結果: ${compareDates(date1, date2)}`);
  console.log(`Date1 > Date2: ${isNewerThan(date1, date2)}`);
  console.log(`Date1 < Date2: ${isOlderThan(date1, date2)}`);
  console.log(`Date1 = Date2: ${isEqual(date1, date2)}`);

  // テストケース2: 異なる形式の日時
  console.log('\n📅 テストケース2: 異なる形式の日時');
  const formats = [
    '2025-01-20T10:30:00.000Z',
    '2025-01-20T10:30:00Z',
    '2025-01-20 10:30:00',
    '2025-01-20T10:30:00+09:00',
    new Date('2025-01-20T10:30:00.000Z')
  ];

  formats.forEach((format, index) => {
    console.log(`形式${index + 1}: ${format}`);
    console.log(`  ISO8601: ${normalizeToISO8601(format)}`);
    console.log(`  UTC Date: ${parseToUTCDate(format)}`);
    console.log(`  表示形式: ${formatDateForDisplay(format)}`);
    console.log(`  相対時間: ${getRelativeTime(format)}`);
  });

  // テストケース3: ConfluenceとLanceDBの実際の日時形式
  console.log('\n📅 テストケース3: 実際の日時形式での比較');
  const confluenceDate = '2025-07-10T08:51:11.347Z';
  const lancedbDate = '2025-07-10T08:51:11.347Z';
  
  const debugInfo = getDateComparisonDebugInfo(
    confluenceDate,
    lancedbDate,
    'Confluence',
    'LanceDB'
  );
  
  console.log('デバッグ情報:');
  console.log(JSON.stringify(debugInfo, null, 2));

  // テストケース4: 境界値テスト
  console.log('\n📅 テストケース4: 境界値テスト');
  const testCases = [
    { name: '同じ日時', date1: '2025-01-20T10:30:00.000Z', date2: '2025-01-20T10:30:00.000Z' },
    { name: '1ミリ秒差', date1: '2025-01-20T10:30:00.000Z', date2: '2025-01-20T10:30:00.001Z' },
    { name: '1秒差', date1: '2025-01-20T10:30:00.000Z', date2: '2025-01-20T10:30:01.000Z' },
    { name: '1分差', date1: '2025-01-20T10:30:00.000Z', date2: '2025-01-20T10:31:00.000Z' },
    { name: '1時間差', date1: '2025-01-20T10:30:00.000Z', date2: '2025-01-20T11:30:00.000Z' },
    { name: '1日差', date1: '2025-01-20T10:30:00.000Z', date2: '2025-01-21T10:30:00.000Z' }
  ];

  testCases.forEach(testCase => {
    const result = compareDates(testCase.date1, testCase.date2);
    const newer = isNewerThan(testCase.date1, testCase.date2);
    const older = isOlderThan(testCase.date1, testCase.date2);
    const equal = isEqual(testCase.date1, testCase.date2);
    
    console.log(`${testCase.name}:`);
    console.log(`  比較結果: ${result} (${result === 0 ? '等しい' : result > 0 ? 'Date1が新しい' : 'Date1が古い'})`);
    console.log(`  Date1 > Date2: ${newer}`);
    console.log(`  Date1 < Date2: ${older}`);
    console.log(`  Date1 = Date2: ${equal}`);
  });

  // テストケース5: 無効な日時
  console.log('\n📅 テストケース5: 無効な日時');
  const invalidDates = [
    null,
    undefined,
    '',
    'invalid-date',
    '2025-13-01T10:30:00.000Z', // 無効な月
    '2025-01-32T10:30:00.000Z'  // 無効な日
  ];

  invalidDates.forEach((invalidDate, index) => {
    console.log(`無効な日時${index + 1}: ${invalidDate}`);
    console.log(`  ISO8601: ${normalizeToISO8601(invalidDate)}`);
    console.log(`  UTC Date: ${parseToUTCDate(invalidDate)}`);
    console.log(`  表示形式: ${formatDateForDisplay(invalidDate)}`);
  });

  console.log('\n✅ 日時比較機能のテスト完了');
}

// 実行
if (require.main === module) {
  runDateComparisonTests();
}

export { runDateComparisonTests };
