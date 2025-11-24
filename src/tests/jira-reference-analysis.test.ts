/**
 * Jira検索時の参照元分析テスト
 * 
 * 目的: 現在の実装がどのようなロジックになっているか正しく把握する
 * 
 * テスト項目:
 * 1. 検索結果が何件返ってくるか
 * 2. extractUsedReferenceIndicesがどのように動作するか
 * 3. enhanceReferencesがどのように動作するか
 * 4. 最終的に何件の参照元が返されるか
 * 5. Jira検索時の最低限の実装ができているか
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { searchLanceDB } from '@/lib/lancedb-search-client';
import { extractUsedReferenceIndices } from '@/lib/markdown-utils';
import { enhanceReferences } from '@/lib/reference-enhancer';
import { hybridSearchEngine } from '@/lib/hybrid-search-engine';

describe('Jira検索時の参照元分析', () => {
  
  it('検索結果が何件返ってくるか確認', async () => {
    const query = '池田担当でステータスがまだ完了していないものは';
    
    // ハイブリッド検索を実行
    const results = await hybridSearchEngine.search({
      query,
      topK: 10,
      tableName: 'jira_issues',
      useLunrIndex: true
    });
    
    console.log(`[検索結果] 総件数: ${results.length}`);
    console.log(`[検索結果] 最初の5件:`);
    results.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.title} (${r.issue_key || r.id}) - score: ${r.scoreRaw}`);
    });
    
    // 検索結果が返ってくることを確認
    expect(results.length).toBeGreaterThan(0);
    
    // 検索結果の詳細を確認
    results.forEach((result, index) => {
      console.log(`[検索結果 ${index + 1}]`, {
        id: result.id,
        issue_key: result.issue_key,
        title: result.title,
        status: result.status,
        assignee: result.assignee,
        scoreRaw: result.scoreRaw,
        scoreKind: result.scoreKind
      });
    });
  }, 30000); // 30秒のタイムアウト

  it('extractUsedReferenceIndicesの動作確認', () => {
    // テストケース1: 回答内に参照元が明示的に言及されている場合
    const answer1 = `
以下の情報が見つかりました：

1. **応募移管機能の開発**（CTJ-1234: 応募移管機能の開発）
   - ステータス: 進行中
   - 担当者: 池田広大

2. **ログイン機能の改善**（CTJ-5678: ログイン機能の改善）
   - ステータス: 完了
   - 担当者: 山田太郎
    `;
    
    const references1 = [
      { title: 'CTJ-1234: 応募移管機能の開発', url: 'https://example.com/CTJ-1234' },
      { title: 'CTJ-5678: ログイン機能の改善', url: 'https://example.com/CTJ-5678' },
      { title: 'CTJ-9999: その他の機能', url: 'https://example.com/CTJ-9999' }
    ];
    
    const usedIndices1 = extractUsedReferenceIndices(answer1, references1);
    console.log(`[extractUsedReferenceIndices テスト1] 使用された参照元インデックス:`, Array.from(usedIndices1));
    console.log(`[extractUsedReferenceIndices テスト1] 使用された参照元数: ${usedIndices1.size}`);
    
    // 2件の参照元が抽出されることを期待
    expect(usedIndices1.size).toBeGreaterThanOrEqual(2);
    
    // テストケース2: 回答内に参照元が言及されていない場合
    const answer2 = `
以下の情報が見つかりました：

1. **応募移管機能の開発**
   - ステータス: 進行中
   - 担当者: 池田広大

2. **ログイン機能の改善**
   - ステータス: 完了
   - 担当者: 山田太郎
    `;
    
    const usedIndices2 = extractUsedReferenceIndices(answer2, references1);
    console.log(`[extractUsedReferenceIndices テスト2] 使用された参照元インデックス:`, Array.from(usedIndices2));
    console.log(`[extractUsedReferenceIndices テスト2] 使用された参照元数: ${usedIndices2.size}`);
    
    // 参照元が抽出されないことを確認（括弧内にタイトルがないため）
    expect(usedIndices2.size).toBe(0);
    
    // テストケース3: Issue Keyのみが言及されている場合
    const answer3 = `
以下の課題が見つかりました：

- CTJ-1234: 応募移管機能の開発
- CTJ-5678: ログイン機能の改善
    `;
    
    const usedIndices3 = extractUsedReferenceIndices(answer3, references1);
    console.log(`[extractUsedReferenceIndices テスト3] 使用された参照元インデックス:`, Array.from(usedIndices3));
    console.log(`[extractUsedReferenceIndices テスト3] 使用された参照元数: ${usedIndices3.size}`);
    
    // Issue Keyのみでは抽出されないことを確認（括弧内にタイトルがないため）
    expect(usedIndices3.size).toBe(0);
  });

  it('enhanceReferencesの動作確認', async () => {
    const answer = `
以下の情報が見つかりました：

1. **応募移管機能の開発**（CTJ-1234: 応募移管機能の開発）
   - ステータス: 進行中
   - 担当者: 池田広大

2. **ログイン機能の改善**（CTJ-5678: ログイン機能の改善）
   - ステータス: 完了
   - 担当者: 山田太郎
    `;
    
    const existingReferences = [
      { 
        title: 'CTJ-1234: 応募移管機能の開発', 
        url: 'https://example.com/CTJ-1234',
        id: 'CTJ-1234',
        distance: 0.5,
        source: 'vector',
        dataSource: 'jira' as const,
        issue_key: 'CTJ-1234'
      },
      { 
        title: 'CTJ-5678: ログイン機能の改善', 
        url: 'https://example.com/CTJ-5678',
        id: 'CTJ-5678',
        distance: 0.6,
        source: 'bm25',
        dataSource: 'jira' as const,
        issue_key: 'CTJ-5678'
      }
    ];
    
    const enhanced = await enhanceReferences(
      answer,
      existingReferences,
      'jira_issues',
      {
        maxSearches: 5,
        timeout: 5000,
        enableBackgroundSearch: true
      }
    );
    
    console.log(`[enhanceReferences] 既存参照元数: ${existingReferences.length}`);
    console.log(`[enhanceReferences] 拡張後参照元数: ${enhanced.immediateReferences.length}`);
    console.log(`[enhanceReferences] 追加された参照元数: ${enhanced.immediateReferences.length - existingReferences.length}`);
    console.log(`[enhanceReferences] バックグラウンド検索が必要なタイトル数: ${enhanced.backgroundSearchTitles.length}`);
    
    // 既存の参照元は保持されることを確認
    expect(enhanced.immediateReferences.length).toBeGreaterThanOrEqual(existingReferences.length);
  }, 30000);

  it('streamingSummarizeConfluenceDocsの参照元処理フロー確認', async () => {
    // このテストは実際のAPIを呼び出すため、モックまたは統合テストとして実装
    // 現時点では、ロジックの確認のみ
    
    const mockContext = [
      {
        id: 'CTJ-1234',
        title: 'CTJ-1234: 応募移管機能の開発',
        content: '応募者を別の教室に移管する機能の開発...',
        url: 'https://giginc.atlassian.net/browse/CTJ-1234',
        distance: 0.5,
        source: 'vector',
        issue_key: 'CTJ-1234',
        status: '進行中',
        assignee: '池田広大'
      },
      {
        id: 'CTJ-5678',
        title: 'CTJ-5678: ログイン機能の改善',
        content: 'ログイン機能の改善に関する課題...',
        url: 'https://giginc.atlassian.net/browse/CTJ-5678',
        distance: 0.6,
        source: 'bm25',
        issue_key: 'CTJ-5678',
        status: '完了',
        assignee: '山田太郎'
      },
      {
        id: 'CTJ-9999',
        title: 'CTJ-9999: その他の機能',
        content: 'その他の機能に関する課題...',
        url: 'https://giginc.atlassian.net/browse/CTJ-9999',
        distance: 0.7,
        source: 'vector',
        issue_key: 'CTJ-9999',
        status: '進行中',
        assignee: '佐藤花子'
      }
    ];
    
    // allReferencesの準備
    const allReferences = mockContext.map((doc, index) => ({
      id: doc.id,
      title: doc.title,
      url: doc.url,
      distance: doc.distance,
      score: 1 - doc.distance,
      source: doc.source,
      dataSource: 'jira' as const,
      issue_key: doc.issue_key
    }));
    
    console.log(`[streamingSummarizeConfluenceDocs] allReferences数: ${allReferences.length}`);
    
    // 模擬的な回答（1件の参照元のみが言及されている）
    const mockAnswer = `
以下の情報が見つかりました：

**応募移管機能の開発**（CTJ-1234: 応募移管機能の開発）
- ステータス: 進行中
- 担当者: 池田広大
    `;
    
    // extractUsedReferenceIndicesの動作を確認
    const usedIndices = extractUsedReferenceIndices(mockAnswer, allReferences);
    console.log(`[streamingSummarizeConfluenceDocs] 使用された参照元インデックス:`, Array.from(usedIndices));
    console.log(`[streamingSummarizeConfluenceDocs] 使用された参照元数: ${usedIndices.size}`);
    
    // finalReferencesの準備
    let finalReferences = usedIndices.size > 0
      ? Array.from(usedIndices).map(index => allReferences[index]).filter(Boolean)
      : allReferences;
    
    console.log(`[streamingSummarizeConfluenceDocs] finalReferences数（extractUsedReferenceIndices後）: ${finalReferences.length}`);
    
    // enhanceReferencesの動作を確認
    const enhanced = await enhanceReferences(
      mockAnswer,
      allReferences,
      'jira_issues',
      {
        maxSearches: 5,
        timeout: 5000,
        enableBackgroundSearch: true
      }
    );
    
    console.log(`[streamingSummarizeConfluenceDocs] enhanced.immediateReferences数: ${enhanced.immediateReferences.length}`);
    
    // finalReferencesにenhanceReferencesの結果を適用
    const finalReferenceIds = new Set(finalReferences.map((ref: any) => ref.id || ref.title));
    const enhancedFinalRefs = enhanced.immediateReferences.filter((ref: any) => 
      finalReferenceIds.has(ref.id || ref.title)
    );
    
    console.log(`[streamingSummarizeConfluenceDocs] enhancedFinalRefs数: ${enhancedFinalRefs.length}`);
    console.log(`[streamingSummarizeConfluenceDocs] 最終的な参照元数: ${enhancedFinalRefs.length}`);
    
    // 問題: usedIndicesが1件の場合、finalReferencesも1件になり、enhancedFinalRefsも1件になる
    // これが参照元が1件になる原因
    expect(enhancedFinalRefs.length).toBe(1);
  }, 30000);

  it('Jira検索時の最低限の実装確認', async () => {
    const query = '池田担当でステータスがまだ完了していないものは';
    
    // 1. タイトル救済検索が動作しているか確認
    const searchResults = await searchLanceDB({
      query,
      topK: 10,
      tableName: 'jira_issues',
      useLunrIndex: true
    });
    
    console.log(`[最低限の実装確認] 検索結果数: ${searchResults.length}`);
    
    // 検索結果が返ってくることを確認
    expect(searchResults.length).toBeGreaterThan(0);
    
    // 2. 動的キーワード抽出が動作しているか確認
    // （searchLanceDB内でunifiedKeywordExtractionServiceが呼ばれているかは内部実装のため確認が難しい）
    // ログで確認する必要がある
    
    // 3. ラベルフィルタリングが動作しているか確認
    // （searchLanceDB内でlabelManagerが呼ばれているかは内部実装のため確認が難しい）
    // ログで確認する必要がある
    
    // 4. Jira特有フィールドが含まれているか確認
    searchResults.forEach((result, index) => {
      console.log(`[最低限の実装確認 ${index + 1}]`, {
        id: result.id,
        issue_key: result.issue_key,
        status: result.status,
        status_category: result.status_category,
        priority: result.priority,
        assignee: result.assignee,
        issue_type: result.issue_type
      });
      
      // Jira特有フィールドが含まれていることを確認
      if (result.issue_key) {
        expect(result.issue_key).toBeTruthy();
        expect(typeof result.issue_key).toBe('string');
        expect(result.issue_key).toMatch(/^CTJ-\d+$/);
      }
    });
  }, 30000);
});

