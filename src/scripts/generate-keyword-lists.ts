/**
 * 重複削除されたキーワードの一覧ファイル生成スクリプト
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface KeywordCategory {
  category: string;
  keywords: string[];
  count: number;
}

interface KeywordListResult {
  metadata: {
    generatedAt: string;
    version: string;
    description: string;
  };
  statistics: {
    totalCategories: number;
    totalKeywords: number;
    categories: Record<string, number>;
  };
  categories: KeywordCategory[];
  allKeywords: string[];
}

function generateKeywordLists(): void {
  try {
    console.log('🔍 キーワード一覧ファイル生成開始...');
    
    // 最終結果ファイルを読み込み
    const finalResultPath = join('data/domain-knowledge-v2', 'final-domain-knowledge-v2.json');
    const finalResult = JSON.parse(readFileSync(finalResultPath, 'utf8'));
    
    console.log(`📊 読み込み完了: ${finalResult.statistics.totalPages}ページ`);
    
    // 各カテゴリのキーワードを収集（ページ間重複削除済み）
    const allDomainNames = new Set<string>();
    const allFunctionNames = new Set<string>();
    const allOperationNames = new Set<string>();
    const allSystemFields = new Set<string>();
    const allSystemTerms = new Set<string>();
    const allRelatedKeywords = new Set<string>();
    
    Object.values(finalResult.functions).forEach((pageData: any) => {
      if (pageData.domainNames) pageData.domainNames.forEach((k: string) => allDomainNames.add(k));
      if (pageData.functionNames) pageData.functionNames.forEach((k: string) => allFunctionNames.add(k));
      if (pageData.operationNames) pageData.operationNames.forEach((k: string) => allOperationNames.add(k));
      if (pageData.systemFields) pageData.systemFields.forEach((k: string) => allSystemFields.add(k));
      if (pageData.systemTerms) pageData.systemTerms.forEach((k: string) => allSystemTerms.add(k));
      if (pageData.relatedKeywords) pageData.relatedKeywords.forEach((k: string) => allRelatedKeywords.add(k));
    });
    
    // カテゴリ別データを準備
    const categories: KeywordCategory[] = [
      {
        category: 'domainNames',
        keywords: Array.from(allDomainNames).sort(),
        count: allDomainNames.size
      },
      {
        category: 'functionNames',
        keywords: Array.from(allFunctionNames).sort(),
        count: allFunctionNames.size
      },
      {
        category: 'operationNames',
        keywords: Array.from(allOperationNames).sort(),
        count: allOperationNames.size
      },
      {
        category: 'systemFields',
        keywords: Array.from(allSystemFields).sort(),
        count: allSystemFields.size
      },
      {
        category: 'systemTerms',
        keywords: Array.from(allSystemTerms).sort(),
        count: allSystemTerms.size
      },
      {
        category: 'relatedKeywords',
        keywords: Array.from(allRelatedKeywords).sort(),
        count: allRelatedKeywords.size
      }
    ];
    
    // 全キーワードを統合
    const allKeywords = new Set<string>();
    categories.forEach(cat => {
      cat.keywords.forEach(keyword => allKeywords.add(keyword));
    });
    
    // 統計情報
    const statistics = {
      totalCategories: categories.length,
      totalKeywords: allKeywords.size,
      categories: categories.reduce((acc, cat) => {
        acc[cat.category] = cat.count;
        return acc;
      }, {} as Record<string, number>)
    };
    
    // 結果オブジェクト
    const result: KeywordListResult = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0',
        description: '重複削除済みキーワード一覧（ページ間重複削除対応版）'
      },
      statistics,
      categories,
      allKeywords: Array.from(allKeywords).sort()
    };
    
    // ファイル出力
    const outputPath = join('data/domain-knowledge-v2', 'keyword-lists-v2.json');
    writeFileSync(outputPath, JSON.stringify(result, null, 2));
    
    console.log(`✅ キーワード一覧ファイル生成完了: ${outputPath}`);
    console.log(`📈 統計情報:`);
    console.log(`   - 総カテゴリ数: ${statistics.totalCategories}`);
    console.log(`   - 総キーワード数: ${statistics.totalKeywords}`);
    console.log(`   - ドメイン名: ${statistics.categories.domainNames}個`);
    console.log(`   - 機能名: ${statistics.categories.functionNames}個`);
    console.log(`   - 操作名: ${statistics.categories.operationNames}個`);
    console.log(`   - システム項目: ${statistics.categories.systemFields}個`);
    console.log(`   - システム用語: ${statistics.categories.systemTerms}個`);
    console.log(`   - 関連キーワード: ${statistics.categories.relatedKeywords}個`);
    
    // 各カテゴリのサンプル表示
    console.log('\n📋 各カテゴリのサンプル:');
    categories.forEach(cat => {
      console.log(`\n【${cat.category}】(${cat.count}個)`);
      console.log(`  例: ${cat.keywords.slice(0, 5).join(', ')}${cat.keywords.length > 5 ? '...' : ''}`);
    });
    
    // 重複チェック
    const totalFromCategories = categories.reduce((sum, cat) => sum + cat.count, 0);
    const duplicateCheck = totalFromCategories - statistics.totalKeywords;
    
    console.log('\n🔍 重複チェック:');
    console.log(`   - カテゴリ合計: ${totalFromCategories}個`);
    console.log(`   - ユニーク合計: ${statistics.totalKeywords}個`);
    console.log(`   - 重複数: ${duplicateCheck}個`);
    
    if (duplicateCheck === 0) {
      console.log('✅ 重複削除が完全に動作しています！');
    } else {
      console.log(`❌ まだ${duplicateCheck}個の重複が残っています`);
    }
    
  } catch (error) {
    console.error('❌ キーワード一覧生成中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// メイン実行
if (require.main === module) {
  generateKeywordLists();
}

export { generateKeywordLists };
