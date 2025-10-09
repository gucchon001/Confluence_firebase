/**
 * Markdown変換の入出力確認スクリプト
 */

// normalizeMarkdownSymbols関数の簡易実装
function normalizeMarkdownSymbols(markdown) {
  if (!markdown) return markdown;
  
  // 基本的な全角→半角変換
  let text = markdown
    .replace(/｜/g, '|')
    .replace(/：/g, ':')
    .replace(/－/g, '-')
    .replace(/〜/g, '~')
    .replace(/　/g, ' ');
  
  // 見出しの後の余分な改行を削除
  text = text.replace(/(#{1,4}\s+[^\n]+)\n{3,}/g, '$1\n\n');
  
  // 箇条書きの改行処理
  text = text.replace(/([。！？])\s*-\s+/g, '$1\n- ');
  
  // 番号付きリストの改行処理（見出しとテーブルを除外）
  const lines = text.split('\n');
  const processedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();
    
    // 見出し行は保護
    if (/^#{1,6}\s/.test(trimmed)) {
      processedLines.push(line);
      continue;
    }
    
    // テーブル行は保護
    if (/^\|/.test(trimmed) || /^:?-{3,}/.test(trimmed)) {
      processedLines.push(line);
      continue;
    }
    
    // 同じ行内に複数の数字リストがある場合、分離
    if (/\d+\.[^\n]+\s+\d+\./.test(line)) {
      const parts = line.split(/\s+(?=\d+\.)/);
      parts.forEach((part, idx) => {
        if (idx === 0) {
          let processed = part.replace(/([。！？])\s*(\d+\.)/, '$1\n$2');
          processedLines.push(processed);
        } else {
          processedLines.push(part);
        }
      });
      continue;
    }
    
    // 句読点の後の数字リストを改行
    line = line.replace(/([。！？])\s+(\d+\.)/g, '$1\n$2');
    line = line.replace(/([。！？])(\d+\.)/g, '$1\n$2');
    
    processedLines.push(line);
  }
  
  text = processedLines.join('\n');
  
  // 数字リストのMarkdown形式化
  const finalLines = text.split('\n');
  const formattedLines = [];
  
  for (const line of finalLines) {
    let formatted = line;
    const trimmed = line.trim();
    
    // 見出し内の数字にもスペースを追加
    if (/^#{1,6}\s+\d+\./.test(trimmed)) {
      formatted = line.replace(/^(#{1,6}\s+)(\d+\.)([^\s])/gm, '$1$2 $3');
    }
    // 本文の数字リストのスペース追加
    else if (/^\d+\./.test(trimmed)) {
      formatted = line.replace(/^(\d+\.)([^\s\n])/gm, '$1 $2');
    }
    
    formattedLines.push(formatted);
  }
  
  text = formattedLines.join('\n');
  
  // 数字リストの余分なスペースを削除
  text = text.replace(/^(\d+\.)\s{2,}/gm, '$1 ');
  
  // 行末のアスタリスク箇条書きを改行して分離
  text = text.replace(/([^\n])\*\s{2,}/g, '$1\n- ');
  
  // アスタリスク箇条書きをハイフンに統一
  text = text.replace(/^\*\s+/gm, '- ');
  text = text.replace(/\n\*\s+/g, '\n- ');
  
  // 見出しの後に空行を追加
  text = text.replace(/(#{1,6}\s+[^\n]+)\n([^#\n])/g, '$1\n\n$2');
  
  // 段落と数字リストの間に空行を追加
  text = text.replace(/([^\n#])\n(\d+\.\s)/g, (match, before, listStart) => {
    if (!/[\n#]/.test(before) && !/^\d+\.\s/.test(before)) {
      return before + '\n\n' + listStart;
    }
    return match;
  });
  
  // 余分な改行を整理
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text;
}

// テストケース1: 見出し内の数字
console.log('='.repeat(80));
console.log('【テストケース1】見出し内の数字のスペース追加');
console.log('='.repeat(80));

const test1Input = `### 1.ログイン認証に利用される情報
ログイン認証には、以下の情報が利用されます。`;

console.log('\n【入力】');
console.log(test1Input);

const test1Output = normalizeMarkdownSymbols(test1Input);

console.log('\n【出力】');
console.log(test1Output);

console.log('\n【確認項目】');
console.log('✓ 見出しのスペース:', test1Output.includes('### 1. ログイン認証') ? '成功' : '失敗');
console.log('✓ 見出しの後の空行:', test1Output.includes('### 1. ログイン認証に利用される情報\n\n') ? '成功' : '失敗');

// テストケース2: 数字リストのスペース
console.log('\n' + '='.repeat(80));
console.log('【テストケース2】数字リストのスペース追加');
console.log('='.repeat(80));

const test2Input = `1.**メールアドレス**: 会員のログインID
2.  **パスワード**: 会員の認証情報`;

console.log('\n【入力】');
console.log(test2Input);

const test2Output = normalizeMarkdownSymbols(test2Input);

console.log('\n【出力】');
console.log(test2Output);

console.log('\n【確認項目】');
console.log('✓ 1のスペース:', test2Output.includes('1. **メールアドレス**') ? '成功' : '失敗');
console.log('✓ 2のスペース:', test2Output.includes('2. **パスワード**') ? '成功' : '失敗');
console.log('✓ 余分なスペース削除:', !test2Output.includes('2.  **') ? '成功' : '失敗');

// テストケース3: アスタリスクをハイフンに
console.log('\n' + '='.repeat(80));
console.log('【テストケース3】アスタリスク箇条書きをハイフンに変換');
console.log('='.repeat(80));

const test3Input = `#### ロック対象
以下のユーザー種別がアカウントロックの対象となります。*   クライアント企業管理者
*   全体管理者`;

console.log('\n【入力】');
console.log(test3Input);

const test3Output = normalizeMarkdownSymbols(test3Input);

console.log('\n【出力】');
console.log(test3Output);

console.log('\n【確認項目】');
console.log('✓ アスタリスクをハイフンに:', test3Output.includes('- クライアント企業管理者') ? '成功' : '失敗');
console.log('✓ 見出しの後の空行:', test3Output.includes('#### ロック対象\n\n') ? '成功' : '失敗');

// テストケース4: 実際のLLM出力全体
console.log('\n' + '='.repeat(80));
console.log('【テストケース4】実際のLLM出力の完全な変換');
console.log('='.repeat(80));

const test4Input = `## 👥 詳細

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

console.log('\n【入力】');
console.log(test4Input);

const test4Output = normalizeMarkdownSymbols(test4Input);

console.log('\n【出力】');
console.log(test4Output);

console.log('\n【確認項目】');
console.log('✓ 見出し1のスペース:', test4Output.includes('### 1. ログイン認証') ? '成功' : '失敗');
console.log('✓ 見出し2のスペース:', test4Output.includes('### 2. アカウントロック') ? '成功' : '失敗');
console.log('✓ サブ見出しの空行:', test4Output.includes('#### ロック対象\n\n') ? '成功' : '失敗');
console.log('✓ 数字リスト1:', test4Output.includes('1. **メールアドレス**') ? '成功' : '失敗');
console.log('✓ 数字リスト2:', test4Output.includes('2. **パスワード**') ? '成功' : '失敗');
console.log('✓ 箇条書き変換:', test4Output.includes('- クライアント企業管理者') ? '成功' : '失敗');

console.log('\n' + '='.repeat(80));
console.log('全てのテスト完了！');
console.log('='.repeat(80));

