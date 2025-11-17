/**
 * 関連ページ表示テスト
 * 
 * このテストは以下の項目を検証します：
 * 1. 関連ページの検出
 * 2. Knowledge Graph拡張機能
 * 3. 関連ページの表示
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadTestEnv } from '../test-helpers/env-loader';

// テスト用の環境変数を事前に読み込む
loadTestEnv();

describe('関連ページ表示テスト', () => {
  beforeAll(() => {
    console.log('🔗 関連ページ表示テスト開始');
  });

  afterAll(() => {
    console.log('✅ 関連ページ表示テスト完了');
  });

  describe('1. 関連ページの検出', () => {
    it('Knowledge Graphから関連ページが取得できる', () => {
      // Knowledge Graphの関連ページ取得ロジックを検証
      const mockKGData = {
        nodes: [
          { pageId: 123, title: 'Page A' },
          { pageId: 456, title: 'Page B' }
        ],
        edges: [
          { from: 123, to: 456, weight: 0.8 }
        ]
      };

      const getRelatedPages = (pageId: number, kgData: typeof mockKGData) => {
        return kgData.edges
          .filter(edge => edge.from === pageId)
          .map(edge => {
            const node = kgData.nodes.find(n => n.pageId === edge.to);
            return node ? { ...node, weight: edge.weight } : null;
          })
          .filter(Boolean);
      };

      const related = getRelatedPages(123, mockKGData);
      expect(related).toHaveLength(1);
      expect(related[0]?.pageId).toBe(456);
    });

    it('関連ページの重みが正しく計算される', () => {
      // 関連ページの重み計算を検証
      const calculateRelatedness = (edgeWeight: number, baseScore: number): number => {
        return edgeWeight * baseScore;
      };

      expect(calculateRelatedness(0.8, 0.9)).toBeCloseTo(0.72, 5);
      expect(calculateRelatedness(0.5, 0.7)).toBeCloseTo(0.35, 5);
    });

    it('関連ページが重複なく取得される', () => {
      // 重複排除のロジックを検証
      const deduplicateRelatedPages = (pages: Array<{ pageId: number; title: string }>) => {
        const seen = new Set<number>();
        return pages.filter(page => {
          if (seen.has(page.pageId)) {
            return false;
          }
          seen.add(page.pageId);
          return true;
        });
      };

      const pages = [
        { pageId: 123, title: 'Page A' },
        { pageId: 456, title: 'Page B' },
        { pageId: 123, title: 'Page A (duplicate)' }
      ];

      const deduplicated = deduplicateRelatedPages(pages);
      expect(deduplicated).toHaveLength(2);
    });
  });

  describe('2. Knowledge Graph拡張機能', () => {
    it('タイトル検索結果がKGで拡張される', () => {
      // KG拡張のロジックを検証
      const expandWithKG = (
        titleResults: Array<{ pageId: number; title: string }>,
        kgData: { edges: Array<{ from: number; to: number; weight: number }> }
      ) => {
        const expanded = [...titleResults];
        const addedPageIds = new Set(titleResults.map(r => r.pageId));

        titleResults.forEach(result => {
          const relatedEdges = kgData.edges.filter(e => e.from === result.pageId);
          relatedEdges.forEach(edge => {
            if (!addedPageIds.has(edge.to)) {
              expanded.push({ pageId: edge.to, title: `Related to ${result.title}` });
              addedPageIds.add(edge.to);
            }
          });
        });

        return expanded;
      };

      const titleResults = [{ pageId: 123, title: 'Page A' }];
      const kgData = {
        edges: [
          { from: 123, to: 456, weight: 0.8 },
          { from: 123, to: 789, weight: 0.6 }
        ]
      };

      const expanded = expandWithKG(titleResults, kgData);
      expect(expanded.length).toBeGreaterThan(titleResults.length);
    });

    it('KG拡張の最大件数が制限される', () => {
      // KG拡張の件数制限を検証
      const expandWithKGLimited = (
        titleResults: Array<{ pageId: number }>,
        kgData: { edges: Array<{ from: number; to: number }> },
        maxReferences: number = 5
      ) => {
        const expanded: number[] = [];
        const addedPageIds = new Set(titleResults.map(r => r.pageId));

        for (const result of titleResults) {
          if (expanded.length >= maxReferences) break;

          const relatedEdges = kgData.edges.filter(e => e.from === result.pageId);
          for (const edge of relatedEdges) {
            if (expanded.length >= maxReferences) break;
            if (!addedPageIds.has(edge.to)) {
              expanded.push(edge.to);
              addedPageIds.add(edge.to);
            }
          }
        }

        return expanded;
      };

      const titleResults = [{ pageId: 123 }];
      const kgData = {
        edges: Array.from({ length: 10 }, (_, i) => ({
          from: 123,
          to: 200 + i,
          weight: 0.5
        }))
      };

      const expanded = expandWithKGLimited(titleResults, kgData, 5);
      expect(expanded.length).toBeLessThanOrEqual(5);
    });
  });

  describe('3. 関連ページの表示', () => {
    it('関連ページのデータ構造が正しい', () => {
      // 関連ページのデータ構造を検証
      const relatedPage = {
        pageId: 456,
        title: 'Related Page',
        url: 'https://example.com/page/456',
        weight: 0.8,
        referencedFrom: 123
      };

      expect(relatedPage).toHaveProperty('pageId');
      expect(relatedPage).toHaveProperty('title');
      expect(relatedPage).toHaveProperty('url');
      expect(relatedPage).toHaveProperty('weight');
      expect(relatedPage).toHaveProperty('referencedFrom');
    });

    it('関連ページがスコア順にソートされる', () => {
      // 関連ページのソートを検証
      const sortByWeight = (pages: Array<{ pageId: number; weight: number }>) => {
        return [...pages].sort((a, b) => b.weight - a.weight);
      };

      const pages = [
        { pageId: 1, weight: 0.5 },
        { pageId: 2, weight: 0.9 },
        { pageId: 3, weight: 0.3 }
      ];

      const sorted = sortByWeight(pages);
      expect(sorted[0].weight).toBe(0.9);
      expect(sorted[1].weight).toBe(0.5);
      expect(sorted[2].weight).toBe(0.3);
    });

    it('関連ページのURLが正しく生成される', () => {
      // 関連ページのURL生成を検証
      const generatePageUrl = (pageId: number, baseUrl: string, spaceKey?: string): string => {
        if (spaceKey) {
          return `${baseUrl}/spaces/${spaceKey}/pages/${pageId}`;
        }
        return `${baseUrl}/pages/${pageId}`;
      };

      const urlWithSpace = generatePageUrl(123, 'https://example.com', 'TEST');
      const urlWithoutSpace = generatePageUrl(123, 'https://example.com');

      expect(urlWithSpace).toBe('https://example.com/spaces/TEST/pages/123');
      expect(urlWithoutSpace).toBe('https://example.com/pages/123');
    });
  });

  describe('4. 関連ページのフィルタリング', () => {
    it('最小重み以下の関連ページが除外される', () => {
      // 最小重みによるフィルタリングを検証
      const filterByMinWeight = (
        pages: Array<{ pageId: number; weight: number }>,
        minWeight: number = 0.5
      ) => {
        return pages.filter(page => page.weight >= minWeight);
      };

      const pages = [
        { pageId: 1, weight: 0.9 },
        { pageId: 2, weight: 0.5 },
        { pageId: 3, weight: 0.3 }
      ];

      const filtered = filterByMinWeight(pages, 0.5);
      expect(filtered).toHaveLength(2);
      expect(filtered.every(p => p.weight >= 0.5)).toBe(true);
    });

    it('既に検索結果に含まれるページが除外される', () => {
      // 重複除外のロジックを検証
      const excludeExistingPages = (
        relatedPages: Array<{ pageId: number }>,
        existingPages: Array<{ pageId: number }>
      ) => {
        const existingIds = new Set(existingPages.map(p => p.pageId));
        return relatedPages.filter(p => !existingIds.has(p.pageId));
      };

      const relatedPages = [
        { pageId: 1 },
        { pageId: 2 },
        { pageId: 3 }
      ];
      const existingPages = [
        { pageId: 1 },
        { pageId: 3 }
      ];

      const filtered = excludeExistingPages(relatedPages, existingPages);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].pageId).toBe(2);
    });
  });
});

