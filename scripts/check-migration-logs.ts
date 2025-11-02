/**
 * マイグレーション後のログ確認スクリプト
 * 
 * 目的: マイグレーション後の動作状況を確認するため、
 * サーバーログやエラーログを分析
 * 
 * 使用方法:
 * ```bash
 * npm run check:migration-logs
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';

interface LogAnalysisResult {
  totalLogs: number;
  errors: number;
  pageIdErrors: number;
  pageIdReferences: number;
  migrationMentions: number;
  performanceLogs: number;
}

async function checkMigrationLogs() {
  console.log('🔍 マイグレーション後のログ確認開始...\n');

  const logsDir = path.resolve(process.cwd(), 'logs');
  const results: LogAnalysisResult = {
    totalLogs: 0,
    errors: 0,
    pageIdErrors: 0,
    pageIdReferences: 0,
    migrationMentions: 0,
    performanceLogs: 0,
  };

  try {
    if (!fs.existsSync(logsDir)) {
      console.log('⚠️ logsディレクトリが見つかりません');
      return;
    }

    // 最新のログファイルを取得（screen-testログ）
    const logFiles = fs.readdirSync(logsDir)
      .filter(file => file.startsWith('screen-test-') && file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(logsDir, file),
        time: fs.statSync(path.join(logsDir, file)).mtime
      }))
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 5); // 最新5件

    console.log(`📋 確認対象のログファイル: ${logFiles.length}件\n`);

    for (const logFile of logFiles) {
      try {
        const content = fs.readFileSync(logFile.path, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const logEntry = JSON.parse(line);
            results.totalLogs++;

            // エラー検出
            if (logEntry.level === 'error' || logEntry.message?.toLowerCase().includes('error')) {
              results.errors++;
              
              // pageId/page_id関連のエラー
              const message = JSON.stringify(logEntry.message || '') + JSON.stringify(logEntry.data || '');
              if (message.includes('pageId') || message.includes('page_id')) {
                results.pageIdErrors++;
                console.log(`⚠️ pageId関連エラー検出 (${logFile.name}):`, logEntry.message);
              }
            }

            // pageId/page_id参照検出
            const logText = JSON.stringify(logEntry);
            if (logText.includes('pageId') || logText.includes('page_id')) {
              results.pageIdReferences++;
            }

            // マイグレーション関連の言及
            if (logText.includes('MIGRATION') || logText.includes('migration')) {
              results.migrationMentions++;
            }

            // パフォーマンスログ
            if (logEntry.category === 'search' || logEntry.message?.includes('duration') || logEntry.message?.includes('ms')) {
              results.performanceLogs++;
            }
          } catch (e) {
            // JSONパースエラーは無視（複数行JSONなど）
          }
        }
      } catch (error: any) {
        console.warn(`⚠️ ログファイル読み込みエラー (${logFile.name}):`, error.message);
      }
    }

    // 結果サマリー
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ログ分析結果サマリー');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📋 総ログ数: ${results.totalLogs}`);
    console.log(`❌ エラー数: ${results.errors}`);
    console.log(`⚠️ pageId関連エラー: ${results.pageIdErrors}`);
    console.log(`🔍 pageId/page_id参照数: ${results.pageIdReferences}`);
    console.log(`🔄 マイグレーション言及数: ${results.migrationMentions}`);
    console.log(`⚡ パフォーマンスログ数: ${results.performanceLogs}\n`);

    // 評価
    if (results.pageIdErrors > 0) {
      console.log('❌ 警告: pageId関連のエラーが検出されました');
      console.log('   → 詳細を確認してください\n');
    } else {
      console.log('✅ 良好: pageId関連のエラーは検出されませんでした\n');
    }

    if (results.errors === 0) {
      console.log('✅ 良好: エラーは検出されませんでした\n');
    }

    console.log('💡 サーバーのコンソール出力も確認してください:');
    console.log('   - 開発サーバーのターミナルを確認');
    console.log('   - page_id関連のエラーがないか確認');
    console.log('   - getAllChunksByPageIdのパフォーマンスログを確認\n');

  } catch (error: any) {
    console.error('❌ ログ確認エラー:', error);
    console.error('   スタック:', error.stack);
  }
}

// スクリプト実行
if (require.main === module) {
  checkMigrationLogs()
    .then(() => {
      console.log('✅ スクリプト完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ スクリプトエラー:', error);
      process.exit(1);
    });
}

export { checkMigrationLogs };

