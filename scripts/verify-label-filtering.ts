/**
 * ラベルフィルタリング検証スクリプト
 * Phase 0A-2: 除外ラベルを持つページがLanceDBに存在しないことを確認
 */

import * as lancedb from '@lancedb/lancedb';
import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import { config } from 'dotenv';

config();

// 除外ラベル定義（rebuild-lancedb-smart-chunking.ts と同じ）
const EXCLUDED_LABELS = ['アーカイブ', 'archive', 'フォルダ', 'スコープ外'];
const EXCLUDED_TITLE_PATTERNS = [
  '■要件定義', 
  'xxx_', 
  '【削除】', 
  '【不要】', 
  '【統合により削除】', 
  '【機能廃止のため作成停止】', 
  '【他ツールへ機能切り出しのため作成停止】'
];

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       ラベルフィルタリング検証                                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  try {
    const db = await lancedb.connect('.lancedb');
    const table = await db.openTable('confluence');
    const allRecords = await table.query().toArray();
    
    console.log(`📊 総レコード数: ${allRecords.length}件\n`);
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. 除外ラベルのチェック
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('🚫 除外ラベルチェック中...\n');
    
    const excludedLabelRecords = allRecords.filter((r: any) => {
      const labels = r.labels || [];
      return labels.some((label: string) => 
        EXCLUDED_LABELS.includes(label)
      );
    });
    
    if (excludedLabelRecords.length > 0) {
      console.log(`❌ 除外ラベルを持つレコード: ${excludedLabelRecords.length}件\n`);
      console.log('   [警告] フィルタリングが正しく機能していません！\n');
      console.log('   サンプル（最初の5件）:');
      excludedLabelRecords.slice(0, 5).forEach((r: any) => {
        console.log(`   - ${r.title}`);
        console.log(`     ラベル: [${(r.labels || []).join(', ')}]`);
      });
      console.log('');
    } else {
      console.log(`✅ 除外ラベルを持つレコード: 0件`);
      console.log('   フィルタリング成功！\n');
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. 除外タイトルパターンのチェック
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('🚫 除外タイトルパターンチェック中...\n');
    
    const excludedTitleRecords = allRecords.filter((r: any) => {
      const title = r.title || '';
      return EXCLUDED_TITLE_PATTERNS.some(pattern => 
        title.includes(pattern)
      );
    });
    
    if (excludedTitleRecords.length > 0) {
      console.log(`❌ 除外タイトルパターンを持つレコード: ${excludedTitleRecords.length}件\n`);
      console.log('   [警告] タイトルフィルタリングが正しく機能していません！\n');
      console.log('   サンプル（最初の5件）:');
      excludedTitleRecords.slice(0, 5).forEach((r: any) => {
        console.log(`   - ${r.title}`);
      });
      console.log('');
    } else {
      console.log(`✅ 除外タイトルパターンを持つレコード: 0件`);
      console.log('   タイトルフィルタリング成功！\n');
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. 短いコンテンツのチェック（100文字未満）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('📏 短いコンテンツチェック中...\n');
    
    const shortContentRecords = allRecords.filter((r: any) => {
      const content = r.content || '';
      return content.length < 100;
    });
    
    if (shortContentRecords.length > 0) {
      console.log(`⚠️  短いコンテンツを持つレコード: ${shortContentRecords.length}件\n`);
      console.log('   [注意] 100文字未満のページが含まれています。\n');
      console.log('   サンプル（最初の3件）:');
      shortContentRecords.slice(0, 3).forEach((r: any) => {
        console.log(`   - ${r.title} (${r.content.length}文字)`);
      });
      console.log('');
    } else {
      console.log(`✅ 短いコンテンツを持つレコード: 0件`);
      console.log('   コンテンツ長フィルタリング成功！\n');
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4. ラベル統計
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('📊 ラベル統計...\n');
    
    const labelCounts: { [label: string]: number } = {};
    let noLabelCount = 0;
    
    allRecords.forEach((r: any) => {
      const labels = r.labels || [];
      if (labels.length === 0) {
        noLabelCount++;
      } else {
        labels.forEach((label: string) => {
          labelCounts[label] = (labelCounts[label] || 0) + 1;
        });
      }
    });
    
    console.log(`ラベルなし: ${noLabelCount}件 (${(noLabelCount / allRecords.length * 100).toFixed(1)}%)`);
    
    const sortedLabels = Object.entries(labelCounts)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 10);
    
    if (sortedLabels.length > 0) {
      console.log('\nTop 10 ラベル:');
      sortedLabels.forEach(([label, count]) => {
        console.log(`   - ${label}: ${count}件`);
      });
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5. 総合評価
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║       総合評価                                                          ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝\n');
    
    const totalExcluded = excludedLabelRecords.length + excludedTitleRecords.length + shortContentRecords.length;
    
    if (totalExcluded === 0) {
      console.log('✅ すべてのフィルタリングが正しく機能しています！');
      console.log('   除外ラベル: 0件');
      console.log('   除外タイトル: 0件');
      console.log('   短いコンテンツ: 0件\n');
    } else {
      console.log('❌ フィルタリングに問題があります。');
      console.log(`   除外ラベル: ${excludedLabelRecords.length}件`);
      console.log(`   除外タイトル: ${excludedTitleRecords.length}件`);
      console.log(`   短いコンテンツ: ${shortContentRecords.length}件`);
      console.log(`   合計: ${totalExcluded}件 (${(totalExcluded / allRecords.length * 100).toFixed(1)}%)\n`);
      console.log('推奨アクション:');
      console.log('   1. scripts/rebuild-lancedb-smart-chunking.ts を修正');
      console.log('   2. npm run lancedb:rebuild で再構築\n');
    }
    
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  } finally {
    const client = OptimizedLanceDBClient.getInstance();
    client.resetConnection();
    await client.disconnect();
  }
}

main();

