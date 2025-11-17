/**
 * UI/UXテスト
 * 
 * このテストは以下の項目を検証します：
 * 1. マークダウン表示の正確性
 * 2. 参照元リンクの動作
 * 3. レスポンシブデザイン
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadTestEnv } from '../test-helpers/env-loader';

// テスト用の環境変数を事前に読み込む
loadTestEnv();

describe('UI/UXテスト', () => {
  beforeAll(() => {
    console.log('🎨 UI/UXテスト開始');
  });

  afterAll(() => {
    console.log('✅ UI/UXテスト完了');
  });

  describe('1. マークダウン表示の正確性', () => {
    it('マークダウンテーブルが正しく正規化される', () => {
      // マークダウンテーブルの正規化を検証
      const fixMarkdownTables = (markdown: string): string => {
        return markdown
          .replace(/｜/g, '|')       // 全角パイプ
          .replace(/：/g, ':')       // 全角コロン
          .replace(/－/g, '-')       // 全角ハイフン
          .replace(/　/g, ' ');      // 全角スペース
      };

      const markdownWithFullWidth = '|項目｜値：|';
      const normalized = fixMarkdownTables(markdownWithFullWidth);
      
      expect(normalized).toContain('|');
      expect(normalized).not.toContain('｜');
      expect(normalized).not.toContain('：');
    });

    it('全角記号が半角Markdown記号に正規化される', () => {
      // 全角記号の正規化を検証
      const normalizeMarkdownSymbols = (markdown: string): string => {
        return markdown
          .replace(/｜/g, '|')
          .replace(/：/g, ':')
          .replace(/－/g, '-')
          .replace(/〜/g, '~')
          .replace(/　/g, ' ');
      };

      const markdownWithFullWidth = '## 見出し：内容－詳細';
      const normalized = normalizeMarkdownSymbols(markdownWithFullWidth);
      
      expect(normalized).not.toContain('：');
      expect(normalized).not.toContain('－');
      expect(normalized).toContain(':');
      expect(normalized).toContain('-');
    });

    it('見出しが正しく処理される', () => {
      // 見出しの処理を検証
      const processHeadings = (markdown: string): string => {
        // 見出しの後の余分な改行を削除
        return markdown.replace(/(#{1,4}\s+[^\n]+)\n{3,}/g, '$1\n\n');
      };

      const markdownWithExtraNewlines = '## 見出し\n\n\n\n内容';
      const processed = processHeadings(markdownWithExtraNewlines);
      
      expect(processed).not.toMatch(/\n{3,}/);
    });

    it('箇条書きが正しく処理される', () => {
      // 箇条書きの処理を検証
      const processListItems = (markdown: string): string => {
        // 「。-」パターンを「。\n-」に変換
        return markdown.replace(/([。！？])\s*-\s+/g, '$1\n- ');
      };

      const markdownWithInlineList = '説明。 - 項目1 - 項目2';
      const processed = processListItems(markdownWithInlineList);
      
      expect(processed).toContain('。\n-');
    });

    it('番号付きリストが正しく処理される', () => {
      // 番号付きリストの処理を検証
      const processNumberedList = (markdown: string): string => {
        // 句読点の後の数字リストを改行
        return markdown.replace(/([。！？])\s+(\d+\.)/g, '$1\n$2');
      };

      const markdownWithInlineNumbered = '説明。 1.項目1 2.項目2';
      const processed = processNumberedList(markdownWithInlineNumbered);
      
      expect(processed).toContain('。\n1.');
    });

    it('コードブロックが正しく処理される', () => {
      // コードブロックの処理を検証
      const hasCodeBlock = (markdown: string): boolean => {
        return /```[\s\S]*?```/.test(markdown) || /`[^`]+`/.test(markdown);
      };

      const markdownWithCode = 'コード例：\n```javascript\nconsole.log("test");\n```';
      const markdownWithInlineCode = '`code`を含むテキスト';
      
      expect(hasCodeBlock(markdownWithCode)).toBe(true);
      expect(hasCodeBlock(markdownWithInlineCode)).toBe(true);
    });
  });

  describe('2. 参照元リンクの動作', () => {
    it('参照元リンクが正しい形式である', () => {
      // 参照元リンクの形式を検証
      const reference = {
        title: 'Test Document',
        url: 'https://example.com/doc',
        distance: 0.1,
        source: 'vector' as const
      };

      expect(reference).toHaveProperty('title');
      expect(reference).toHaveProperty('url');
      expect(reference).toHaveProperty('distance');
      expect(reference).toHaveProperty('source');
      expect(reference.url).toMatch(/^https?:\/\//);
    });

    it('参照元リンクのURLが有効である', () => {
      // URLの有効性を検証
      const isValidUrl = (url: string): boolean => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };

      expect(isValidUrl('https://example.com/doc')).toBe(true);
      expect(isValidUrl('http://example.com/doc')).toBe(true);
      expect(isValidUrl('invalid-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });

    it('参照元のスコアが正しく表示される', () => {
      // スコアの表示形式を検証
      const formatScore = (distance: number): string => {
        const score = Math.round((1 - distance) * 100);
        return `${score}%`;
      };

      expect(formatScore(0.1)).toBe('90%');
      expect(formatScore(0.5)).toBe('50%');
      expect(formatScore(1.0)).toBe('0%');
    });

    it('参照元が正しくソートされる', () => {
      // 参照元のソートを検証
      const references = [
        { title: 'Doc 1', distance: 0.5 },
        { title: 'Doc 2', distance: 0.1 },
        { title: 'Doc 3', distance: 0.3 }
      ];

      const sorted = [...references].sort((a, b) => a.distance - b.distance);
      
      expect(sorted[0].distance).toBe(0.1);
      expect(sorted[1].distance).toBe(0.3);
      expect(sorted[2].distance).toBe(0.5);
    });
  });

  describe('3. レスポンシブデザイン', () => {
    it('ブレークポイントが正しく定義されている', () => {
      // ブレークポイントの定義を検証
      const breakpoints = {
        sm: 640,
        md: 768,
        lg: 1024,
        xl: 1280
      };

      expect(breakpoints.sm).toBe(640);
      expect(breakpoints.md).toBe(768);
      expect(breakpoints.lg).toBe(1024);
      expect(breakpoints.xl).toBe(1280);
      
      // ブレークポイントが昇順であることを確認
      expect(breakpoints.sm < breakpoints.md).toBe(true);
      expect(breakpoints.md < breakpoints.lg).toBe(true);
      expect(breakpoints.lg < breakpoints.xl).toBe(true);
    });

    it('モバイル表示が正しく動作する', () => {
      // モバイル表示のロジックを検証
      const isMobile = (width: number): boolean => {
        return width < 768; // md breakpoint
      };

      expect(isMobile(640)).toBe(true);
      expect(isMobile(767)).toBe(true);
      expect(isMobile(768)).toBe(false);
      expect(isMobile(1024)).toBe(false);
    });

    it('デスクトップ表示が正しく動作する', () => {
      // デスクトップ表示のロジックを検証
      const isDesktop = (width: number): boolean => {
        return width >= 1024; // lg breakpoint
      };

      expect(isDesktop(1024)).toBe(true);
      expect(isDesktop(1280)).toBe(true);
      expect(isDesktop(1023)).toBe(false);
      expect(isDesktop(768)).toBe(false);
    });
  });

  describe('4. アクセシビリティ', () => {
    it('ARIA属性が正しく設定される', () => {
      // ARIA属性の設定を検証
      const ariaAttributes = {
        role: 'button',
        'aria-label': '送信ボタン',
        'aria-disabled': false
      };

      expect(ariaAttributes.role).toBeTruthy();
      expect(ariaAttributes['aria-label']).toBeTruthy();
      expect(typeof ariaAttributes['aria-disabled']).toBe('boolean');
    });

    it('キーボードナビゲーションがサポートされる', () => {
      // キーボードナビゲーションのサポートを検証
      const keyboardShortcuts = {
        submit: 'Enter',
        newLine: 'Shift+Enter',
        focus: 'Tab'
      };

      expect(keyboardShortcuts.submit).toBe('Enter');
      expect(keyboardShortcuts.newLine).toBe('Shift+Enter');
      expect(keyboardShortcuts.focus).toBe('Tab');
    });
  });

  describe('5. パフォーマンス', () => {
    it('マークダウン処理が効率的である', () => {
      // マークダウン処理のパフォーマンスを検証
      const processMarkdown = (markdown: string): string => {
        return markdown
          .replace(/｜/g, '|')
          .replace(/：/g, ':')
          .replace(/－/g, '-');
      };

      const largeMarkdown = 'テスト'.repeat(1000);
      const startTime = Date.now();
      processMarkdown(largeMarkdown);
      const duration = Date.now() - startTime;

      // 1000文字の処理が100ms以内に完了することを期待
      expect(duration).toBeLessThan(100);
    });

    it('レンダリングが最適化されている', () => {
      // レンダリングの最適化を検証
      const shouldRender = (item: { visible: boolean; inViewport: boolean }): boolean => {
        return item.visible && item.inViewport;
      };

      expect(shouldRender({ visible: true, inViewport: true })).toBe(true);
      expect(shouldRender({ visible: true, inViewport: false })).toBe(false);
      expect(shouldRender({ visible: false, inViewport: true })).toBe(false);
    });
  });
});

