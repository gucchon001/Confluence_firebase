/**
 * テスト用の共通ユーティリティ
 */

export interface TestResult {
  query: string;
  answer: string;
  references: Array<{ title: string; source?: string; scoreText?: string }>;
  success: boolean;
  duration: number;
  error?: string;
}

export interface ComparisonResult {
  query: string;
  answerMatch: boolean;
  referenceCountMatch: boolean;
  referenceTitlesMatch: boolean;
  scoreConsistency: boolean;
  issues: string[];
}

/**
 * テスト結果を比較する
 */
export function compareResults(scriptResult: any, uiResult: TestResult): ComparisonResult {
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
      const scriptScore: string | undefined = scriptResult.citations[i].scoreText;
      const uiScore: string | undefined = uiResult.references[i].scoreText;
      if ((scriptScore || '') !== (uiScore || '')) {
        scoreConsistency = false;
        issues.push(`Score mismatch at reference ${i + 1}: script=${scriptScore || 'N/A'}, ui=${uiScore || 'N/A'}`);
      }
    }
  }
  
  return {
    query: uiResult.query,
    answerMatch,
    referenceCountMatch,
    referenceTitlesMatch,
    scoreConsistency,
    issues
  };
}

/**
 * テスト結果をログ出力する
 */
export function logTestResult(comparison: ComparisonResult): void {
  console.log(`\n--- 比較結果 ---`);
  console.log(`Query: ${comparison.query}`);
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
}

/**
 * スクリプトテストの結果をパースする
 */
export function parseScriptTestOutput(stdout: string): any {
  const outputLines = stdout.split('\n');
  const summaryStart = outputLines.findIndex(line => line.includes('--- 要約 ---'));
  const citationsStart = outputLines.findIndex(line => line.includes('--- 引用 ---'));
  const referencesStart = outputLines.findIndex(line => line.includes('References:'));
  const durationLine = outputLines.find(line => line.includes('Duration:'));
  
  let answer = '';
  if (summaryStart !== -1 && citationsStart !== -1) {
    answer = outputLines.slice(summaryStart + 1, citationsStart).join('\n').trim();
  } else if (summaryStart !== -1 && referencesStart !== -1) {
    answer = outputLines.slice(summaryStart + 1, referencesStart).join('\n').trim();
  }
  
  const references: Array<{ title: string; source?: string; scoreText?: string }> = [];
  if (citationsStart !== -1) {
    for (let i = citationsStart + 1; i < outputLines.length; i++) {
      const line = outputLines[i].trim();
      if (line.startsWith('[') && line.includes(')')) {
        const match = line.match(/\[\d+\]\s(.+?)\s\((.+?)\s(.+?)\)/);
        if (match) {
          references.push({
            title: match[1].trim(),
            source: match[2].trim().toLowerCase(),
            scoreText: match[2].trim() + ' ' + match[3].trim()
          });
        }
      }
    }
  } else if (referencesStart !== -1) {
    for (let i = referencesStart + 1; i < outputLines.length; i++) {
      const line = outputLines[i].trim();
      if (line.startsWith('-') && line.includes(')')) {
        const match = line.match(/-\s(.+?)\s\((.+?)\)\s-\s(.+)/);
        if (match) {
          references.push({
            title: match[1].trim(),
            source: match[2].trim().toLowerCase(),
            scoreText: match[3].trim()
          });
        }
      }
    }
  }
  
  const duration = durationLine ? parseInt(durationLine.split(':')[1].trim().replace('ms', '')) : 0;
  
  return { answer, references, duration };
}
