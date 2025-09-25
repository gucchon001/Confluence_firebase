/**
 * ハイブリッド検索のエラーテスト
 * 様々な検索クエリでエラーパターンを確認
 */

import 'dotenv/config';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';

async function testHybridSearchErrors() {
  console.log('🔍 ハイブリッド検索のエラーテストを開始...\n');

  try {
    const searchEngine = new HybridSearchEngine();

    // テストケースの定義
    const testCases = [
      {
        name: '正常な検索クエリ',
        query: '機能要件 システム',
        topK: 5
      },
      {
        name: '空のクエリ',
        query: '',
        topK: 5
      },
      {
        name: 'nullクエリ',
        query: null as any,
        topK: 5
      },
      {
        name: 'undefinedクエリ',
        query: undefined as any,
        topK: 5
      },
      {
        name: '非常に長いクエリ',
        query: 'a'.repeat(1000),
        topK: 5
      },
      {
        name: '特殊文字を含むクエリ',
        query: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        topK: 5
      },
      {
        name: '日本語と英語混合クエリ',
        query: 'システム system 機能 function 要件 requirement',
        topK: 5
      },
      {
        name: '数字のみのクエリ',
        query: '123456789',
        topK: 5
      },
      {
        name: 'SQLインジェクション風クエリ',
        query: "'; DROP TABLE confluence; --",
        topK: 5
      },
      {
        name: 'XSS風クエリ',
        query: '<script>alert("test")</script>',
        topK: 5
      },
      {
        name: '負のtopK値',
        query: 'テスト',
        topK: -1
      },
      {
        name: '0のtopK値',
        query: 'テスト',
        topK: 0
      },
      {
        name: '非常に大きなtopK値',
        query: 'テスト',
        topK: 10000
      },
      {
        name: 'nullのtopK値',
        query: 'テスト',
        topK: null as any
      },
      {
        name: 'undefinedのtopK値',
        query: 'テスト',
        topK: undefined as any
      },
      {
        name: '文字列のtopK値',
        query: 'テスト',
        topK: 'invalid' as any
      },
      {
        name: 'ラベルフィルタリング付き検索',
        query: '管理',
        topK: 5,
        labelFilters: {
          includeLabels: ['機能要件']
        }
      },
      {
        name: '無効なラベルフィルタリング',
        query: '管理',
        topK: 5,
        labelFilters: {
          includeLabels: null as any
        }
      },
      {
        name: '複雑なラベルフィルタリング',
        query: 'システム',
        topK: 5,
        labelFilters: {
          includeLabels: ['機能要件', '帳票', 'ワークフロー'],
          excludeLabels: ['アーカイブ', 'フォルダ']
        }
      }
    ];

    console.log(`📋 ${testCases.length}個のテストケースを実行します...\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{name: string, error: any}> = [];

    // 各テストケースを実行
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n🧪 テスト ${i + 1}/${testCases.length}: ${testCase.name}`);
      console.log(`   クエリ: "${testCase.query}"`);
      console.log(`   topK: ${testCase.topK}`);
      
      try {
        const startTime = Date.now();
        
        const searchParams: any = {
          query: testCase.query,
          topK: testCase.topK
        };
        
        if (testCase.labelFilters) {
          searchParams.labelFilters = testCase.labelFilters;
        }
        
        const results = await searchEngine.search(searchParams);
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        console.log(`   ✅ 成功: ${results.length}件の結果 (${executionTime}ms)`);
        
        if (results.length > 0) {
          console.log(`   📄 最初の結果: ${results[0].title}`);
        }
        
        successCount++;
        
      } catch (error) {
        console.log(`   ❌ エラー: ${error instanceof Error ? error.message : String(error)}`);
        console.log(`   🔍 エラータイプ: ${error instanceof Error ? error.constructor.name : typeof error}`);
        
        errors.push({
          name: testCase.name,
          error: error
        });
        
        errorCount++;
      }
    }

    // 結果サマリー
    console.log('\n📊 テスト結果サマリー:');
    console.log('=' .repeat(50));
    console.log(`✅ 成功: ${successCount}件`);
    console.log(`❌ エラー: ${errorCount}件`);
    console.log(`📈 成功率: ${Math.round(successCount / testCases.length * 100)}%`);

    // エラー詳細
    if (errors.length > 0) {
      console.log('\n❌ エラー詳細:');
      console.log('=' .repeat(50));
      
      errors.forEach((error, index) => {
        console.log(`\n${index + 1}. ${error.name}:`);
        console.log(`   エラー: ${error.error instanceof Error ? error.error.message : String(error.error)}`);
        console.log(`   スタック: ${error.error instanceof Error ? error.error.stack?.split('\n')[0] : 'N/A'}`);
      });
    }

    // エラーパターン分析
    console.log('\n🔍 エラーパターン分析:');
    console.log('=' .repeat(50));
    
    const errorTypes = new Map<string, number>();
    errors.forEach(({error}) => {
      const errorType = error instanceof Error ? error.constructor.name : typeof error;
      errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
    });
    
    if (errorTypes.size > 0) {
      console.log('エラータイプ別統計:');
      Array.from(errorTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count}件`);
        });
    } else {
      console.log('エラーは発生しませんでした。');
    }

    // 推奨事項
    console.log('\n💡 推奨事項:');
    console.log('=' .repeat(50));
    
    if (errorCount === 0) {
      console.log('🎉 すべてのテストケースが成功しました！');
      console.log('ハイブリッド検索は堅牢に実装されています。');
    } else if (errorCount < testCases.length * 0.1) {
      console.log('👍 エラー率は低く、ハイブリッド検索は良好な状態です。');
      console.log('発生したエラーはエッジケースの可能性があります。');
    } else if (errorCount < testCases.length * 0.3) {
      console.log('⚠️ エラー率が中程度です。');
      console.log('入力検証とエラーハンドリングの改善を検討してください。');
    } else {
      console.log('🚨 エラー率が高く、ハイブリッド検索の改善が必要です。');
      console.log('入力検証、エラーハンドリング、例外処理の見直しを推奨します。');
    }

    console.log('\n✅ ハイブリッド検索エラーテスト完了！');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }
}

testHybridSearchErrors().catch(console.error);
