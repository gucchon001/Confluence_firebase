/**
 * ドメイン知識ファイルのクリーンアップ
 * 
 * 実行内容:
 * 1. 数値_プレフィックスを除去 (例: "521_オファー機能利用条件" → "オファー機能利用条件")
 * 2. 意味のないキーワードを除去 (例: "50ken")
 * 3. 重複を再度除去
 */

import * as fs from 'fs';
import * as path from 'path';

const INPUT_FILE = 'data/domain-knowledge-v2/keyword-lists-v2.json';
const OUTPUT_FILE = 'data/domain-knowledge-v2/keyword-lists-v2-cleaned.json';
const BACKUP_FILE = 'data/domain-knowledge-v2/keyword-lists-v2-backup.json';

/**
 * 意味のないキーワードパターン
 */
const MEANINGLESS_PATTERNS = [
  /^\d+ken$/i,           // "50ken" など
  /^[\d_]+$/,            // 数字とアンダースコアのみ
  /^[a-z]{1,2}$/i,       // 1-2文字の英字のみ
  /^\s*$/,               // 空白のみ
];

/**
 * キーワードをクリーニング
 */
function cleanKeyword(keyword: string): string | null {
  // 1. 数値_プレフィックスを除去
  let cleaned = keyword.replace(/^\d+_/, '');
  
  // 2. 前後の空白を除去
  cleaned = cleaned.trim();
  
  // 3. 意味のないパターンをチェック
  for (const pattern of MEANINGLESS_PATTERNS) {
    if (pattern.test(cleaned)) {
      return null; // 除去対象
    }
  }
  
  // 4. 空文字列チェック
  if (!cleaned) {
    return null;
  }
  
  return cleaned;
}

/**
 * カテゴリのキーワードをクリーニング
 */
function cleanCategory(keywords: string[]): string[] {
  const cleanedSet = new Set<string>();
  let removedCount = 0;
  let prefixRemovedCount = 0;
  
  for (const keyword of keywords) {
    const original = keyword;
    const cleaned = cleanKeyword(keyword);
    
    if (cleaned === null) {
      // 意味のないキーワード
      removedCount++;
      console.log(`  [除外] "${original}"`);
      continue;
    }
    
    if (cleaned !== original) {
      // プレフィックスが除去された
      prefixRemovedCount++;
      console.log(`  [正規化] "${original}" → "${cleaned}"`);
    }
    
    cleanedSet.add(cleaned);
  }
  
  console.log(`  統計: ${keywords.length}件 → ${cleanedSet.size}件 (プレフィックス除去: ${prefixRemovedCount}件, 除外: ${removedCount}件, 重複削減: ${keywords.length - cleanedSet.size - removedCount}件)`);
  
  return Array.from(cleanedSet).sort();
}

/**
 * メイン処理
 */
async function main() {
  console.log('🧹 ドメイン知識ファイルのクリーンアップ開始\n');
  
  // 1. 元ファイルを読み込み
  console.log(`📖 読み込み: ${INPUT_FILE}`);
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  
  // 2. バックアップ作成
  console.log(`💾 バックアップ作成: ${BACKUP_FILE}`);
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2), 'utf8');
  
  // 3. 各カテゴリをクリーニング
  console.log('\n🔧 クリーニング処理開始:\n');
  
  let totalBefore = 0;
  let totalAfter = 0;
  
  for (const category of data.categories) {
    const categoryName = category.category;
    const before = category.keywords.length;
    
    console.log(`\n📂 カテゴリ: ${categoryName} (${before}件)`);
    
    category.keywords = cleanCategory(category.keywords);
    
    const after = category.keywords.length;
    totalBefore += before;
    totalAfter += after;
    
    // 統計情報を更新
    if (data.statistics && data.statistics.categories) {
      data.statistics.categories[categoryName] = after;
    }
  }
  
  // 4. メタデータを更新
  data.metadata.generatedAt = new Date().toISOString();
  data.metadata.description = '重複削除・正規化済みキーワード一覧（数値プレフィックス除去済み）';
  
  if (data.statistics) {
    data.statistics.totalKeywords = totalAfter;
  }
  
  // 5. 保存
  console.log(`\n💾 保存: ${OUTPUT_FILE}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf8');
  
  // 6. サマリー
  console.log('\n━'.repeat(80));
  console.log('📊 クリーンアップ完了');
  console.log('━'.repeat(80));
  console.log(`総キーワード数: ${totalBefore}件 → ${totalAfter}件 (削減: ${totalBefore - totalAfter}件, ${((1 - totalAfter / totalBefore) * 100).toFixed(2)}%)`);
  console.log(`\n✅ 完了: ${OUTPUT_FILE}`);
  console.log(`📦 バックアップ: ${BACKUP_FILE}`);
  console.log('\n次のステップ:');
  console.log(`  mv ${OUTPUT_FILE} ${INPUT_FILE}`);
}

main().catch(error => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});

 * ドメイン知識ファイルのクリーンアップ
 * 
 * 実行内容:
 * 1. 数値_プレフィックスを除去 (例: "521_オファー機能利用条件" → "オファー機能利用条件")
 * 2. 意味のないキーワードを除去 (例: "50ken")
 * 3. 重複を再度除去
 */

import * as fs from 'fs';
import * as path from 'path';

const INPUT_FILE = 'data/domain-knowledge-v2/keyword-lists-v2.json';
const OUTPUT_FILE = 'data/domain-knowledge-v2/keyword-lists-v2-cleaned.json';
const BACKUP_FILE = 'data/domain-knowledge-v2/keyword-lists-v2-backup.json';

/**
 * 意味のないキーワードパターン
 */
const MEANINGLESS_PATTERNS = [
  /^\d+ken$/i,           // "50ken" など
  /^[\d_]+$/,            // 数字とアンダースコアのみ
  /^[a-z]{1,2}$/i,       // 1-2文字の英字のみ
  /^\s*$/,               // 空白のみ
];

/**
 * キーワードをクリーニング
 */
function cleanKeyword(keyword: string): string | null {
  // 1. 数値_プレフィックスを除去
  let cleaned = keyword.replace(/^\d+_/, '');
  
  // 2. 前後の空白を除去
  cleaned = cleaned.trim();
  
  // 3. 意味のないパターンをチェック
  for (const pattern of MEANINGLESS_PATTERNS) {
    if (pattern.test(cleaned)) {
      return null; // 除去対象
    }
  }
  
  // 4. 空文字列チェック
  if (!cleaned) {
    return null;
  }
  
  return cleaned;
}

/**
 * カテゴリのキーワードをクリーニング
 */
function cleanCategory(keywords: string[]): string[] {
  const cleanedSet = new Set<string>();
  let removedCount = 0;
  let prefixRemovedCount = 0;
  
  for (const keyword of keywords) {
    const original = keyword;
    const cleaned = cleanKeyword(keyword);
    
    if (cleaned === null) {
      // 意味のないキーワード
      removedCount++;
      console.log(`  [除外] "${original}"`);
      continue;
    }
    
    if (cleaned !== original) {
      // プレフィックスが除去された
      prefixRemovedCount++;
      console.log(`  [正規化] "${original}" → "${cleaned}"`);
    }
    
    cleanedSet.add(cleaned);
  }
  
  console.log(`  統計: ${keywords.length}件 → ${cleanedSet.size}件 (プレフィックス除去: ${prefixRemovedCount}件, 除外: ${removedCount}件, 重複削減: ${keywords.length - cleanedSet.size - removedCount}件)`);
  
  return Array.from(cleanedSet).sort();
}

/**
 * メイン処理
 */
async function main() {
  console.log('🧹 ドメイン知識ファイルのクリーンアップ開始\n');
  
  // 1. 元ファイルを読み込み
  console.log(`📖 読み込み: ${INPUT_FILE}`);
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  
  // 2. バックアップ作成
  console.log(`💾 バックアップ作成: ${BACKUP_FILE}`);
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2), 'utf8');
  
  // 3. 各カテゴリをクリーニング
  console.log('\n🔧 クリーニング処理開始:\n');
  
  let totalBefore = 0;
  let totalAfter = 0;
  
  for (const category of data.categories) {
    const categoryName = category.category;
    const before = category.keywords.length;
    
    console.log(`\n📂 カテゴリ: ${categoryName} (${before}件)`);
    
    category.keywords = cleanCategory(category.keywords);
    
    const after = category.keywords.length;
    totalBefore += before;
    totalAfter += after;
    
    // 統計情報を更新
    if (data.statistics && data.statistics.categories) {
      data.statistics.categories[categoryName] = after;
    }
  }
  
  // 4. メタデータを更新
  data.metadata.generatedAt = new Date().toISOString();
  data.metadata.description = '重複削除・正規化済みキーワード一覧（数値プレフィックス除去済み）';
  
  if (data.statistics) {
    data.statistics.totalKeywords = totalAfter;
  }
  
  // 5. 保存
  console.log(`\n💾 保存: ${OUTPUT_FILE}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf8');
  
  // 6. サマリー
  console.log('\n━'.repeat(80));
  console.log('📊 クリーンアップ完了');
  console.log('━'.repeat(80));
  console.log(`総キーワード数: ${totalBefore}件 → ${totalAfter}件 (削減: ${totalBefore - totalAfter}件, ${((1 - totalAfter / totalBefore) * 100).toFixed(2)}%)`);
  console.log(`\n✅ 完了: ${OUTPUT_FILE}`);
  console.log(`📦 バックアップ: ${BACKUP_FILE}`);
  console.log('\n次のステップ:');
  console.log(`  mv ${OUTPUT_FILE} ${INPUT_FILE}`);
}

main().catch(error => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});









