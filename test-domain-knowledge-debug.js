#!/usr/bin/env tsx

import 'dotenv/config';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

// デバッグ用設定ファイルを読み込み
const configPath = 'config/domain-knowledge-config-debug.json';

if (!existsSync(configPath)) {
  console.error('❌ デバッグ用設定ファイルが見つかりません:', configPath);
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, 'utf8'));

// 環境変数を展開する関数
function expandEnvVars(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
  } else if (Array.isArray(obj)) {
    return obj.map(expandEnvVars);
  } else if (obj && typeof obj === 'object') {
    const expanded = {};
    for (const [key, value] of Object.entries(obj)) {
      expanded[key] = expandEnvVars(value);
    }
    return expanded;
  }
  return obj;
}

const expandedConfig = expandEnvVars(config);

console.log('🔧 デバッグ用ドメイン知識抽出テスト開始');
console.log('==========================================');
console.log('📋 設定:');
console.log(`- 最大ページ数: ${expandedConfig.confluence.maxPages}`);
console.log(`- バッチサイズ: ${expandedConfig.confluence.batchSize}`);
console.log(`- LLMバッチサイズ: ${expandedConfig.llm.batchSize}`);
console.log(`- 遅延時間: ${expandedConfig.llm.delayBetweenRequests}ms`);
console.log('');

// キーワード抽出の改善テスト
async function testKeywordExtraction() {
  console.log('🔍 キーワード抽出テスト');
  console.log('----------------------');
  
  const testQueries = [
    '教室管理の詳細は',
    '企業管理機能',
    'オファー登録方法',
    '応募者一覧表示',
    'メンバーログイン処理'
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 テストクエリ: "${query}"`);
    
    // 基本的な分割テスト
    const basicSplit = query.split(/[の・・、]/g).filter(w => w.length > 0);
    console.log(`  - 基本分割: [${basicSplit.map(w => `"${w}"`).join(', ')}]`);
    
    // 機能語での分割
    const functionSplit = query.split(/(詳細|仕様|機能|管理|情報|一覧|閲覧|登録|編集|削除|コピー|設定|更新|処理|方法|表示)/g).filter(w => w && w.length > 0);
    console.log(`  - 機能語分割: [${functionSplit.map(w => `"${w}"`).join(', ')}]`);
    
    // エンティティ語での分割
    const entitySplit = query.split(/(教室|求人|企業|ユーザー|システム|オファー|応募|メンバー)/g).filter(w => w && w.length > 0);
    console.log(`  - エンティティ分割: [${entitySplit.map(w => `"${w}"`).join(', ')}]`);
    
    // 統合されたキーワード
    const allKeywords = [...new Set([...basicSplit, ...functionSplit, ...entitySplit])].filter(w => w.length > 1);
    console.log(`  - 統合キーワード: [${allKeywords.map(w => `"${w}"`).join(', ')}]`);
  }
}

// 実行
async function main() {
  try {
    await testKeywordExtraction();
    
    console.log('\n✅ デバッグテスト完了');
    console.log('💡 次のステップ:');
    console.log('1. 改善されたキーワード抽出ロジックを実装');
    console.log('2. デバッグ用パイプラインを実行');
    console.log('3. 結果を分析して最適化');
    
  } catch (error) {
    console.error('❌ デバッグテストでエラーが発生:', error);
    process.exit(1);
  }
}

main();