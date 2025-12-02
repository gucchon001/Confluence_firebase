/**
 * セマンティックチャンキング統合テスト
 * 
 * 本番環境の同期処理（Confluence、Jira）でセマンティックチャンキングが
 * 正常に動作することを確認するテスト
 * 
 * テスト内容:
 * 1. 本番環境のパラメータ（maxChunkSize: 1800, overlap: 200）での動作確認
 * 2. 実際の同期処理で使用されるチャンキング関数の動作確認
 * 3. 無限ループが発生しないことの確認
 */

import { semanticChunkText } from '../../lib/semantic-chunking';
import { chunkText } from '../../lib/text-chunking';

describe('セマンティックチャンキング 本番環境統合テスト', () => {
  // 本番環境のパラメータ
  const PROD_MAX_CHUNK_SIZE = 1800;
  const PROD_OVERLAP = 200;

  describe('本番環境パラメータでの動作確認', () => {
    it('Confluence風の長文テキストを正常に処理できること', () => {
      // Confluenceから取得される可能性のある長文テキスト
      const longText = Array.from({ length: 50 }, (_, i) => 
        `これは${i + 1}番目の段落です。この段落には複数の文が含まれています。`
      ).join('\n\n');

      const startTime = Date.now();
      const chunks = semanticChunkText(longText, {
        maxChunkSize: PROD_MAX_CHUNK_SIZE,
        overlap: PROD_OVERLAP,
        respectSentenceBoundaries: true,
      });
      const duration = Date.now() - startTime;

      // エラーなく処理されること
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.length).toBeLessThan(1000); // 無限ループ防止チェック
      
      // 処理時間が5秒以内であること（無限ループの検出）
      expect(duration).toBeLessThan(5000);
      
      // 各チャンクが有効であること
      chunks.forEach((chunk, index) => {
        expect(chunk.text.length).toBeGreaterThan(0);
        expect(chunk.index).toBe(index);
        expect(chunk.start).toBeGreaterThanOrEqual(0);
        expect(chunk.end).toBeGreaterThan(chunk.start);
      });
    });

    it('Jira風の長文テキストを正常に処理できること', () => {
      // JiraのIssue説明文やコメントのような長文テキスト
      const jiraText = Array.from({ length: 30 }, (_, i) => 
        `ステップ${i + 1}: このステップでは、以下の作業を行います。`
      ).join('\n\n');

      const startTime = Date.now();
      const chunks = semanticChunkText(jiraText, {
        maxChunkSize: PROD_MAX_CHUNK_SIZE,
        overlap: PROD_OVERLAP,
        respectSentenceBoundaries: true,
      });
      const duration = Date.now() - startTime;

      // エラーなく処理されること
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.length).toBeLessThan(1000); // 無限ループ防止チェック
      
      // 処理時間が5秒以内であること
      expect(duration).toBeLessThan(5000);
      
      // 各チャンクが有効であること
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeGreaterThan(0);
        expect(chunk.end).toBeGreaterThan(chunk.start);
      });
    });

    it('チャンクサイズが本番環境の制限内であること', () => {
      const text = '文'.repeat(5000) + 'です。';
      
      const chunks = semanticChunkText(text, {
        maxChunkSize: PROD_MAX_CHUNK_SIZE,
        overlap: PROD_OVERLAP,
        respectSentenceBoundaries: true,
      });

      // チャンクサイズがmaxChunkSize + 余裕（50文字）以内であること
      // 文の境界を考慮するため、少し余裕を持たせる
      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(PROD_MAX_CHUNK_SIZE + 50);
      });
    });

    it('無限ループが発生しないこと', () => {
      // 様々なパターンのテキストで無限ループが発生しないことを確認
      const testCases = [
        '短いテキストです。',
        'これは長い文です。'.repeat(100),
        '文1です。文2です。文3です。'.repeat(50),
        Array.from({ length: 100 }, (_, i) => `段落${i + 1}の内容です。`).join('\n\n'),
      ];

      testCases.forEach((text, index) => {
        const startTime = Date.now();
        const chunks = semanticChunkText(text, {
          maxChunkSize: PROD_MAX_CHUNK_SIZE,
          overlap: PROD_OVERLAP,
          respectSentenceBoundaries: true,
        });
        const duration = Date.now() - startTime;

        // 処理時間が5秒以内であること
        expect(duration).toBeLessThan(5000).toBe(`テストケース ${index + 1} でタイムアウト`);
        
        // チャンク数が異常に多すぎないこと
        expect(chunks.length).toBeLessThan(1000);
      });
    });
  });

  describe('固定サイズチャンキングとの互換性', () => {
    it('同じパラメータで類似した結果を返すこと', () => {
      const text = '文'.repeat(1000) + 'です。';
      
      const semanticChunks = semanticChunkText(text, {
        maxChunkSize: PROD_MAX_CHUNK_SIZE,
        overlap: PROD_OVERLAP,
        respectSentenceBoundaries: true,
      });

      const fixedChunks = chunkText(text, {
        maxChunkSize: PROD_MAX_CHUNK_SIZE,
        overlap: PROD_OVERLAP,
      });

      // チャンク数が大きく異ならないこと（±20%以内）
      const ratio = semanticChunks.length / fixedChunks.length;
      expect(ratio).toBeGreaterThan(0.8);
      expect(ratio).toBeLessThan(1.2);
    });
  });

  describe('エッジケースの処理', () => {
    it('空のテキストを適切に処理すること', () => {
      const chunks = semanticChunkText('', {
        maxChunkSize: PROD_MAX_CHUNK_SIZE,
        overlap: PROD_OVERLAP,
      });
      
      expect(chunks).toEqual([]);
    });

    it('非常に短いテキストを適切に処理すること', () => {
      const text = '短いテキストです。';
      const chunks = semanticChunkText(text, {
        maxChunkSize: PROD_MAX_CHUNK_SIZE,
        overlap: PROD_OVERLAP,
      });
      
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe(text.trim());
    });

    it('文の終わりがないテキストを適切に処理すること', () => {
      // 文の終わりが全くないテキスト（句点なし）
      const text = 'これは文の終わりがないテキストです'.repeat(100);
      
      const startTime = Date.now();
      const chunks = semanticChunkText(text, {
        maxChunkSize: PROD_MAX_CHUNK_SIZE,
        overlap: PROD_OVERLAP,
        respectSentenceBoundaries: true,
      });
      const duration = Date.now() - startTime;

      // エラーなく処理されること（固定サイズチャンキングにフォールバック）
      expect(chunks.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000);
    });
  });
});

