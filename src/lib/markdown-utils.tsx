/**
 * Markdown処理ユーティリティ
 * テーブル正規化、記号変換、共通コンポーネント設定を提供
 */

/**
 * Markdownテーブルを修正
 * 基本的な全角→半角変換のみ実行
 */
export function fixMarkdownTables(markdown: string): string {
  // シンプルアプローチ：基本的な全角→半角変換とテーブル行の分離
  // テーブル処理はReactMarkdownのremarkGfmプラグインに完全依存
  
  // 基本的な全角記号の変換
  let result = markdown
    .replace(/｜/g, '|')       // 全角パイプ
    .replace(/：/g, ':')       // 全角コロン
    .replace(/－/g, '-')       // 全角ハイフン
    .replace(/　/g, ' ');      // 全角スペース
  
  // テーブルの前に空行を追加（GFMプラグインの要件）
  // 「です。| ヘッダー |\n|:---|」のようなパターンを検出
  // テーブルヘッダーの直後に区切り行がある場合のみマッチ
  result = result.replace(/([。、！？])(\|\s*[^\n]+\s*\|\s*\n\s*\|:?-)/g, '$1\n\n$2');
  
  return result;
}

/**
 * 全角記号を半角Markdown記号に正規化
 */
export function normalizeMarkdownSymbols(markdown: string): string {
  if (!markdown) return markdown;
  
  // 基本的な全角→半角変換
  let text = markdown
    .replace(/｜/g, '|')       // U+FF5C FULLWIDTH VERTICAL LINE
    .replace(/：/g, ':')       // U+FF1A FULLWIDTH COLON
    .replace(/－/g, '-')       // U+FF0D FULLWIDTH HYPHEN-MINUS
    .replace(/〜/g, '~')
    .replace(/　/g, ' ');      // U+3000 IDEOGRAPHIC SPACE
  
  // 見出しの後の余分な改行を削除（見出しとコンテンツの間を1行に）
  text = text.replace(/(#{1,4}\s+[^\n]+)\n{3,}/g, '$1\n\n');
  
  // 箇条書きの改行処理（「。-」パターンを「。\n-」に変換）
  text = text.replace(/([。！？])\s*-\s+/g, '$1\n- ');
  
  // 番号付きリストの改行処理（見出しとテーブルを除外）
  // 行ごとに処理して、見出しとテーブルを保護
  const lines = text.split('\n');
  const processedLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();
    
    // 見出し行は保護（処理しない）
    if (/^#{1,6}\s/.test(trimmed)) {
      processedLines.push(line);
      continue;
    }
    
    // テーブル行は保護（処理しない）
    if (/^\|/.test(trimmed) || /^:?-{3,}/.test(trimmed)) {
      processedLines.push(line);
      continue;
    }
    
    // 同じ行内に複数の数字リストがある場合、分離
    // 「1.項目A 2.項目B 3.項目C」→ 分離
    if (/\d+\.[^\n]+\s+\d+\./.test(line)) {
      // スペース + 数字. のパターンで分割
      const parts = line.split(/\s+(?=\d+\.)/);
      parts.forEach((part, idx) => {
        if (idx === 0) {
          // 最初の部分はそのまま（句読点などが含まれる可能性）
          let processed = part.replace(/([。！？])\s*(\d+\.)/, '$1\n$2');
          processedLines.push(processed);
        } else {
          // 残りはリスト項目として追加
          processedLines.push(part);
        }
      });
      continue;
    }
    
    // 句読点の後の数字リストを改行
    // 「します。 2.項目」→「します。\n2.項目」
    line = line.replace(/([。！？])\s+(\d+\.)/g, '$1\n$2');
    // 「します。1.項目」→「します。\n1.項目」
    line = line.replace(/([。！？])(\d+\.)/g, '$1\n$2');
    
    processedLines.push(line);
  }
  
  text = processedLines.join('\n');
  
  // 数字リストのMarkdown形式化
  // 「1.テキスト」を「1. テキスト」に変換（ピリオドの後にスペースを追加）
  const finalLines = text.split('\n');
  const formattedLines: string[] = [];
  
  for (const line of finalLines) {
    let formatted = line;
    const trimmed = line.trim();
    
    // 見出し内の数字にもスペースを追加
    // ### 1.項目名 → ### 1. 項目名
    if (/^#{1,6}\s+\d+\./.test(trimmed)) {
      formatted = line.replace(/^(#{1,6}\s+)(\d+\.)([^\s])/gm, '$1$2 $3');
    }
    // 本文の数字リストのスペース追加
    // 1.項目 → 1. 項目
    else if (/^\d+\./.test(trimmed)) {
      formatted = line.replace(/^(\d+\.)([^\s\n])/gm, '$1 $2');
    }
    
    formattedLines.push(formatted);
  }
  
  text = formattedLines.join('\n');
  
  // 数字リストの余分なスペースを削除
  // 1.  項目 → 1. 項目（スペース2つ以上を1つに）
  text = text.replace(/^(\d+\.)\s{2,}/gm, '$1 ');
  
  // 行末のアスタリスク箇条書きを改行して分離
  // 本文。*   項目 → 本文。\n- 項目
  text = text.replace(/([^\n])\*\s{2,}/g, '$1\n- ');
  
  // アスタリスク箇条書きをハイフンに統一
  // *   項目 → - 項目
  text = text.replace(/^\*\s+/gm, '- ');
  text = text.replace(/\n\*\s+/g, '\n- ');
  
  // 行末の見出しを分離
  // 本文。#### 見出し → 本文。\n\n#### 見出し
  text = text.replace(/([^\n])(#{1,6}\s)/g, '$1\n\n$2');
  
  // 見出しの後に空行を追加（Markdownの要件）
  // ### 見出し\n本文 → ### 見出し\n\n本文
  text = text.replace(/(#{1,6}\s+[^\n]+)\n([^#\n])/g, '$1\n\n$2');
  
  // 段落と数字リストの間に空行を追加（Markdown認識のため）
  text = text.replace(/([^\n#])\n(\d+\.\s)/g, (match, before, listStart) => {
    // 前の文字が改行、見出し、または数字リストでない場合のみ空行を追加
    if (!/[\n#]/.test(before) && !/^\d+\.\s/.test(before)) {
      return before + '\n\n' + listStart;
    }
    return match;
  });
  
  // 余分な改行を整理（3つ以上の連続改行を2つに）
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text;
}

/**
 * 共通のMarkdownコンポーネント設定
 * ReactMarkdownで使用
 */
export const sharedMarkdownComponents = {
  h1: ({children}: any) => <h1 className="text-lg font-bold mb-4 mt-4">{children}</h1>,
  h2: ({children}: any) => <h2 className="text-lg font-bold mb-4 mt-6 text-gray-800">{children}</h2>,
  h3: ({children}: any) => <h3 className="text-base font-bold mb-3 mt-4 text-gray-900">{children}</h3>,
  h4: ({children}: any) => <h4 className="text-sm font-semibold mb-1">{children}</h4>,
  p: ({children}: any) => <p className="mb-3 leading-relaxed">{children}</p>,
  ul: ({children}: any) => <ul className="list-disc list-outside mb-3 ml-4">{children}</ul>,
  ol: ({children}: any) => <ol className="list-decimal list-outside mb-3 ml-4">{children}</ol>,
  li: ({children}: any) => <li className="mb-1 leading-relaxed">{children}</li>,
  hr: () => <hr className="my-4 border-gray-300" />,
  strong: ({children}: any) => <strong className="font-bold">{children}</strong>,
  em: ({children}: any) => <em className="italic">{children}</em>,
  code: ({children}: any) => <code className="bg-gray-100 px-1 rounded text-xs font-mono">{children}</code>,
  pre: ({children}: any) => <pre className="bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto">{children}</pre>,
  table: ({children}: any) => (
    <div className="overflow-x-auto my-4">
      <table className="border-collapse border border-gray-300 w-full text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({children}: any) => <thead className="bg-gray-100">{children}</thead>,
  tbody: ({children}: any) => <tbody>{children}</tbody>,
  tr: ({children}: any) => <tr className="border-b border-gray-200 hover:bg-gray-50">{children}</tr>,
  th: ({children}: any) => (
    <th className="border border-gray-300 px-4 py-3 text-left font-bold align-top bg-gray-100 whitespace-normal break-words min-w-[120px] max-w-[300px]">
      {children}
    </th>
  ),
  td: ({children}: any) => (
    <td className="border border-gray-300 px-4 py-3 align-top whitespace-normal break-words min-w-[120px] max-w-[400px]">
      {children}
    </td>
  ),
} as const;

