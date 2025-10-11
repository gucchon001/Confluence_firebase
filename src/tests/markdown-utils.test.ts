/**
 * Markdownユーティリティのテスト
 */
import { normalizeMarkdownSymbols, fixMarkdownTables } from '@/lib/markdown-utils';

describe('markdown-utils', () => {
  describe('normalizeMarkdownSymbols', () => {
    it('見出し内の数字にスペースを追加する', () => {
      const input = '### 1.ログイン認証に利用される情報\n説明文です。';
      const result = normalizeMarkdownSymbols(input);
      expect(result).toContain('### 1. ログイン認証に利用される情報');
      expect(result).toContain('\n\n説明文です'); // 見出しの後に空行
    });
    
    it('見出しの後に空行を追加する', () => {
      const input = '#### ロック対象\n以下のユーザー種別';
      const result = normalizeMarkdownSymbols(input);
      expect(result).toContain('#### ロック対象\n\n以下のユーザー種別');
    });
    
    it('段落内の数字リストを分離する', () => {
      const input = '説明です。1.項目A 2.項目B';
      const result = normalizeMarkdownSymbols(input);
      expect(result).toContain('1. 項目A');
      expect(result).toContain('2. 項目B');
    });
    
    it('数字リストにスペースを追加する', () => {
      const input = '1.**メールアドレス**: 会員のログインID\n2.  **パスワード**: 会員の認証情報';
      const result = normalizeMarkdownSymbols(input);
      expect(result).toContain('1. **メールアドレス**');
      expect(result).toContain('2. **パスワード**');
    });
    
    it('アスタリスク箇条書きをハイフンに変換する', () => {
      const input = '*   クライアント企業管理者\n*   全体管理者';
      const result = normalizeMarkdownSymbols(input);
      expect(result).toContain('- クライアント企業管理者');
      expect(result).toContain('- 全体管理者');
    });
    
    it('実際のLLM出力を正しく変換する', () => {
      const input = `## 👥 詳細

### 1.ログイン認証に利用される情報
ログイン認証には、会員のアカウント情報のうち、以下の情報が利用されます。
1.**メールアドレス**: 会員のログインIDとして機能します。
2.  **パスワード**: 会員の認証情報として機能します。

### 2.アカウントロック機能
ログイン失敗が続いた場合のセキュリティ対策機能です。#### ロック対象
以下のユーザー種別がアカウントロックの対象となります。*   クライアント企業管理者
*   全体管理者`;

      const result = normalizeMarkdownSymbols(input);
      
      // 見出しのスペース
      expect(result).toContain('### 1. ログイン認証に利用される情報');
      expect(result).toContain('### 2. アカウントロック機能');
      
      // 見出しの後の空行
      expect(result).toMatch(/### 1\. ログイン認証に利用される情報\n\n/);
      expect(result).toMatch(/#### ロック対象\n\n/);
      
      // 数字リストのスペース
      expect(result).toContain('1. **メールアドレス**');
      expect(result).toContain('2. **パスワード**');
      
      // アスタリスクをハイフンに
      expect(result).toContain('- クライアント企業管理者');
      expect(result).toContain('- 全体管理者');
    });
  });
  
  describe('fixMarkdownTables', () => {
    it('全角記号を半角に変換', () => {
      const input = '｜項目名｜説明｜';
      const result = fixMarkdownTables(input);
      expect(result).toContain('|項目名|説明|');
    });
    
    it('テーブルの前に空行を追加', () => {
      const input = 'です。| ヘッダー |\n|:---|';
      const result = fixMarkdownTables(input);
      expect(result).toContain('です。\n\n|');
    });
    
    it('改行なしで連結されたテーブル行を修正', () => {
      const input = '| 項目名 | 説明 | | :--- | :--- | | 教室の基本情報 | データ |';
      const result = fixMarkdownTables(input);
      // 区切り行の前後に改行が追加される
      expect(result).toContain('| 項目名 | 説明 |\n');
      expect(result).toContain('| :--- | :--- |\n');
      expect(result).toContain('| 教室の基本情報 | データ |');
    });
    
    it('複数のデータ行が改行なしで連結されている場合を修正', () => {
      const input = '| 項目 | 説明 |\n| :--- | :--- | | データ1 | 説明1 | | データ2 | 説明2 |';
      const result = fixMarkdownTables(input);
      expect(result).toMatch(/\| データ1 \| 説明1 \|\n/);
      expect(result).toMatch(/\| データ2 \| 説明2 \|/);
    });
  });
});

