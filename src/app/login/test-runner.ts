import { testLogger } from './test-logger';
import { askQuestion } from '@/app/actions';

/**
 * テストケースの定義
 */
interface TestCase {
  name: string;
  query: string;
  expectedKeywords?: string[];
  expectedSources?: string[];
  minReferences?: number;
}

/**
 * テストケースの定義
 */
const TEST_CASES: TestCase[] = [
  {
    name: '教室管理の詳細',
    query: '教室管理の詳細は',
    expectedKeywords: ['教室管理'],
    expectedSources: ['bm25', 'vector'],
    minReferences: 3
  },
  {
    name: '急募機能の詳細',
    query: '急募機能の詳細',
    expectedKeywords: ['急募'],
    expectedSources: ['bm25', 'vector'],
    minReferences: 3
  },
  {
    name: 'ログイン機能の仕様',
    query: 'ログイン機能の仕様は',
    expectedKeywords: ['ログイン'],
    expectedSources: ['bm25', 'vector'],
    minReferences: 3
  }
];

/**
 * スクリプトテストを実行
 */
export async function runScriptTest(query: string): Promise<any> {
  console.log(`\n=== スクリプトテスト実行 ===`);
  console.log(`Query: ${query}`);
  
  const { answerWithRag } = await import('@/lib/rag-engine');
  
  const startTime = Date.now();
  const result = await answerWithRag(query, {
    labelFilters: {
      includeMeetingNotes: false,
      includeArchived: false
    }
  });
  const duration = Date.now() - startTime;
  
  console.log(`Duration: ${duration}ms`);
  console.log(`Answer length: ${result.summary?.length || 0} characters`);
  console.log(`References count: ${result.citations?.length || 0}`);
  
  if (result.citations && result.citations.length > 0) {
    console.log('\nReferences:');
    result.citations.forEach((ref: any, index: number) => {
      console.log(`  ${index + 1}. ${ref.title} (${ref.source || 'unknown'}) - ${ref.scoreText || 'N/A'}`);
    });
  }
  
  return result;
}

/**
 * 画面テストを実行
 */
export async function runUITest(query: string): Promise<any> {
  console.log(`\n=== 画面テスト実行 ===`);
  console.log(`Query: ${query}`);
  
  testLogger.clearLog();
  testLogger.startTest('UI Test', query);
  
  const startTime = Date.now();
  const result = await askQuestion(query, [], {
    includeMeetingNotes: false,
    includeArchived: false
  });
  const duration = Date.now() - startTime;
  
  console.log(`Duration: ${duration}ms`);
  console.log(`Answer length: ${result.answer?.length || 0} characters`);
  console.log(`References count: ${result.references?.length || 0}`);
  
  if (result.references && result.references.length > 0) {
    console.log('\nReferences:');
    result.references.forEach((ref: any, index: number) => {
      console.log(`  ${index + 1}. ${ref.title} (${ref.source || 'unknown'}) - ${ref.scoreText || 'N/A'}`);
    });
  }
  
  testLogger.endTest('UI Test', true, duration);
  
  return result;
}

/**
 * テスト結果を比較
 */
export function compareResults(scriptResult: any, uiResult: any): {
  answerMatch: boolean;
  referenceCountMatch: boolean;
  referenceTitlesMatch: boolean;
  scoreConsistency: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // 回答の比較
  const answerMatch = scriptResult.summary === uiResult.answer;
  if (!answerMatch) {
    issues.push('Answer content does not match');
  }
  
  // 参照数の比較
  const scriptRefCount = scriptResult.citations?.length || 0;
  const uiRefCount = uiResult.references?.length || 0;
  const referenceCountMatch = scriptRefCount === uiRefCount;
  if (!referenceCountMatch) {
    issues.push(`Reference count mismatch: script=${scriptRefCount}, ui=${uiRefCount}`);
  }
  
  // 参照タイトルの比較
  const scriptTitles = (scriptResult.citations || []).map((r: any) => r.title).sort();
  const uiTitles = (uiResult.references || []).map((r: any) => r.title).sort();
  const referenceTitlesMatch = JSON.stringify(scriptTitles) === JSON.stringify(uiTitles);
  if (!referenceTitlesMatch) {
    issues.push('Reference titles do not match');
  }
  
  // スコアの一貫性チェック
  let scoreConsistency = true;
  if (scriptResult.citations && uiResult.references) {
    for (let i = 0; i < Math.min(scriptResult.citations.length, uiResult.references.length); i++) {
      const scriptScore = scriptResult.citations[i].scoreText;
      const uiScore = uiResult.references[i].scoreText;
      if (scriptScore !== uiScore) {
        scoreConsistency = false;
        issues.push(`Score mismatch at reference ${i + 1}: script=${scriptScore}, ui=${uiScore}`);
      }
    }
  }
  
  return {
    answerMatch,
    referenceCountMatch,
    referenceTitlesMatch,
    scoreConsistency,
    issues
  };
}

/**
 * 全テストケースを実行
 */
export async function runAllTests(): Promise<void> {
  console.log('=== 全テストケース実行開始 ===\n');
  
  for (const testCase of TEST_CASES) {
    console.log(`\n--- テストケース: ${testCase.name} ---`);
    console.log(`Query: ${testCase.query}`);
    
    try {
      // スクリプトテスト実行
      const scriptResult = await runScriptTest(testCase.query);
      
      // 画面テスト実行
      const uiResult = await runUITest(testCase.query);
      
      // 結果比較
      const comparison = compareResults(scriptResult, uiResult);
      
      console.log('\n--- 比較結果 ---');
      console.log(`Answer Match: ${comparison.answerMatch ? '✅' : '❌'}`);
      console.log(`Reference Count Match: ${comparison.referenceCountMatch ? '✅' : '❌'}`);
      console.log(`Reference Titles Match: ${comparison.referenceTitlesMatch ? '✅' : '❌'}`);
      console.log(`Score Consistency: ${comparison.scoreConsistency ? '✅' : '❌'}`);
      
      if (comparison.issues.length > 0) {
        console.log('\nIssues found:');
        comparison.issues.forEach(issue => console.log(`  - ${issue}`));
      } else {
        console.log('\n✅ All checks passed!');
      }
      
    } catch (error) {
      console.error(`❌ Test case failed: ${testCase.name}`, error);
      testLogger.logError(error as Error, `Test case: ${testCase.name}`);
    }
  }
  
  console.log('\n=== 全テストケース実行完了 ===');
  
  // ログファイルの内容を表示
  console.log('\n--- UIテストログ ---');
  console.log(testLogger.getLogContent());
}

/**
 * 単一テストケースを実行
 */
export async function runSingleTest(testName: string): Promise<void> {
  const testCase = TEST_CASES.find(tc => tc.name === testName);
  if (!testCase) {
    console.error(`Test case not found: ${testName}`);
    return;
  }
  
  console.log(`=== 単一テストケース実行: ${testCase.name} ===\n`);
  
  try {
    // スクリプトテスト実行
    const scriptResult = await runScriptTest(testCase.query);
    
    // 画面テスト実行
    const uiResult = await runUITest(testCase.query);
    
    // 結果比較
    const comparison = compareResults(scriptResult, uiResult);
    
    console.log('\n--- 比較結果 ---');
    console.log(`Answer Match: ${comparison.answerMatch ? '✅' : '❌'}`);
    console.log(`Reference Count Match: ${comparison.referenceCountMatch ? '✅' : '❌'}`);
    console.log(`Reference Titles Match: ${comparison.referenceTitlesMatch ? '✅' : '❌'}`);
    console.log(`Score Consistency: ${comparison.scoreConsistency ? '✅' : '❌'}`);
    
    if (comparison.issues.length > 0) {
      console.log('\nIssues found:');
      comparison.issues.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log('\n✅ All checks passed!');
    }
    
  } catch (error) {
    console.error(`❌ Test case failed: ${testCase.name}`, error);
    testLogger.logError(error as Error, `Test case: ${testCase.name}`);
  }
}
