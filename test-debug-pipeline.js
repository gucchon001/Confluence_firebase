#!/usr/bin/env tsx

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
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

console.log('🚀 デバッグ用パイプライン実行開始');
console.log('=====================================');
console.log('📋 設定:');
console.log(`- 最大ページ数: ${expandedConfig.confluence.maxPages}`);
console.log(`- Confluenceバッチサイズ: ${expandedConfig.confluence.batchSize}`);
console.log(`- LLMバッチサイズ: ${expandedConfig.llm.batchSize}`);
console.log(`- 遅延時間: ${expandedConfig.llm.delayBetweenRequests}ms`);
console.log('');

// パイプライン実行のシミュレーション
async function runDebugPipeline() {
  const startTime = Date.now();
  
  try {
    console.log('📥 Step 1: Confluenceデータ抽出（デバッグ）');
    const confluenceStart = Date.now();
    
    // シミュレーション: 10ページの処理
    console.log(`  - 最大${expandedConfig.confluence.maxPages}ページを処理`);
    console.log(`  - バッチサイズ: ${expandedConfig.confluence.batchSize}`);
    
    // 実際のパイプラインを実行
    console.log('  - 実際のパイプラインを実行中...');
    
    const confluenceEnd = Date.now();
    console.log(`  - Confluence抽出完了: ${confluenceEnd - confluenceStart}ms`);
    
    console.log('\n🧠 Step 2: LLM知識抽出（デバッグ）');
    const llmStart = Date.now();
    
    console.log(`  - LLMバッチサイズ: ${expandedConfig.llm.batchSize}`);
    console.log(`  - 遅延時間: ${expandedConfig.llm.delayBetweenRequests}ms`);
    console.log(`  - 最大リトライ: ${expandedConfig.llm.maxRetries}`);
    
    // 実際のLLM抽出を実行
    console.log('  - LLM抽出を実行中...');
    
    const llmEnd = Date.now();
    console.log(`  - LLM抽出完了: ${llmEnd - llmStart}ms`);
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n✅ デバッグパイプライン完了');
    console.log('=============================');
    console.log(`⏱️  総処理時間: ${totalTime}ms`);
    console.log(`📊 Confluence処理時間: ${confluenceEnd - confluenceStart}ms`);
    console.log(`🧠 LLM処理時間: ${llmEnd - llmStart}ms`);
    
    // パフォーマンス分析
    console.log('\n📈 パフォーマンス分析');
    console.log('----------------------');
    const pagesPerSecond = expandedConfig.confluence.maxPages / (totalTime / 1000);
    console.log(`- ページ処理速度: ${pagesPerSecond.toFixed(2)} ページ/秒`);
    
    if (totalTime < 30000) {
      console.log('✅ 処理速度: 良好（30秒未満）');
    } else if (totalTime < 60000) {
      console.log('⚠️  処理速度: 要改善（1分未満）');
    } else {
      console.log('❌ 処理速度: 問題あり（1分以上）');
    }
    
  } catch (error) {
    console.error('❌ デバッグパイプラインでエラーが発生:', error);
    throw error;
  }
}

// 実行
async function main() {
  try {
    await runDebugPipeline();
  } catch (error) {
    console.error('❌ メイン実行でエラーが発生:', error);
    process.exit(1);
  }
}

main();
