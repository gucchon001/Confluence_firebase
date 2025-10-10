/**
 * Markdown変換の詳細な入出力確認テスト
 */
import { normalizeMarkdownSymbols } from '@/lib/markdown-utils';

describe('Markdown変換の入出力確認', () => {
  it('【実際のLLM出力】完全な変換テスト', () => {
    const input = `## 👥 詳細

### 1.ログイン認証に利用される情報
ログイン認証には、会員のアカウント情報のうち、以下の情報が利用されます。
1.**メールアドレス**: 会員のログインIDとして機能します。
2.  **パスワード**: 会員の認証情報として機能します。

### 2.アカウントロック機能
ログイン失敗が続いた場合のセキュリティ対策機能です。#### ロック対象
以下のユーザー種別がアカウントロックの対象となります。*   クライアント企業管理者
*   全体管理者

#### ロック解除条件
以下のいずれかの方法でロックが解除されます。
1.**時間経過による自動解除**: 30分間待つと自動解除
2.**パスワード再設定による即時解除**: パスワード再設定で即座にロック解除`;

    const result = normalizeMarkdownSymbols(input);
    
    console.log('\n' + '='.repeat(80));
    console.log('【入力】');
    console.log('='.repeat(80));
    console.log(input);
    
    console.log('\n' + '='.repeat(80));
    console.log('【出力】');
    console.log('='.repeat(80));
    console.log(result);
    
    console.log('\n' + '='.repeat(80));
    console.log('【確認項目】');
    console.log('='.repeat(80));
    
    // 確認項目
    const checks = [
      { name: '見出し1のスペース (### 1. ログイン)', test: result.includes('### 1. ログイン') },
      { name: '見出し2のスペース (### 2. アカウント)', test: result.includes('### 2. アカウント') },
      { name: '見出し1の後の空行', test: /### 1\. ログイン認証に利用される情報\n\n/.test(result) },
      { name: '見出し2の後の空行', test: /### 2\. アカウントロック機能\n\n/.test(result) },
      { name: 'サブ見出しの後の空行', test: /#### ロック対象\n\n/.test(result) },
      { name: '数字リスト1のスペース', test: result.includes('1. **メールアドレス**') },
      { name: '数字リスト2のスペース', test: result.includes('2. **パスワード**') },
      { name: 'アスタリスクをハイフンに変換', test: result.includes('- クライアント企業管理者') },
      { name: '行末の見出し分離', test: /です。\n\n#### ロック対象/.test(result) },
    ];
    
    checks.forEach(check => {
      const status = check.test ? '✓ 成功' : '✗ 失敗';
      console.log(`${status}: ${check.name}`);
      expect(check.test).toBe(true);
    });
    
    console.log('\n');
  });
});

