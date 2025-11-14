/**
 * Markdown処理ユーティリティ
 * テーブル正規化、記号変換、共通コンポーネント設定を提供
 */

/**
 * Markdownテーブルを修正
 * 基本的な全角→半角変換のみ実行
 */
export function fixMarkdownTables(markdown: string): string {
  // 基本的な全角記号の変換のみ
  return markdown
    .replace(/｜/g, '|')       // 全角パイプ
    .replace(/：/g, ':')       // 全角コロン
    .replace(/－/g, '-')       // 全角ハイフン
    .replace(/　/g, ' ');      // 全角スペース
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
  let inTable = false; // 表の中にいるかどうか
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();
    
    // 見出し行は保護（処理しない）
    if (/^#{1,6}\s/.test(trimmed)) {
      inTable = false;
      processedLines.push(line);
      continue;
    }
    
    // 表の行を検出して処理
    if (/^\|/.test(trimmed)) {
      // 表の開始：前の行が空行でなければ空行を挿入
      if (!inTable && processedLines.length > 0) {
        const prevLine = processedLines[processedLines.length - 1];
        if (prevLine.trim() !== '') {
          processedLines.push(''); // 空行を挿入
        }
      }
      inTable = true;
      processedLines.push(line);
      continue;
    } else if (inTable && trimmed === '') {
      // 表の終了（空行）
      inTable = false;
      processedLines.push(line);
      continue;
    } else if (inTable) {
      // 表の途中で表以外の行が来たら表終了
      inTable = false;
    }
    
    // 表の行でない場合は通常処理
    
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
  
  // 行末の見出しを分離（句読点の直後に見出しが来る場合のみ）
  // 本文。#### 見出し → 本文。\n\n#### 見出し
  text = text.replace(/([。！？])(#{1,6}\s+)/g, '$1\n\n$2');
  
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
  
  // テーブルの前後に空行を確実に追加（GFMプラグインの要件）
  // パターン1: 段落の後にテーブルが来る場合（既に空行がない場合のみ）
  text = text.replace(/([^\n#])\n(\|\s*[^\n]+\s*\|)/g, (match, before, table) => {
    // 既に空行がある場合はスキップ
    if (before === '\n') {
      return match;
    }
    return before + '\n\n' + table;
  });
  
  // パターン2: テーブルの後に段落が来る場合（既に空行がない場合のみ）
  text = text.replace(/(\|\s*[^\n]+\s*\|)\n([^\n#])/g, (match, table, after) => {
    // 既に空行がある場合はスキップ
    if (after === '\n') {
      return match;
    }
    return table + '\n\n' + after;
  });
  
  // 余分な改行を整理（3つ以上の連続改行を2つに）
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text;
}

/**
 * 参照元へのリンクを番号リンクに変換
 * 「（XXX_【FIX】...）」のようなパターンを検出し、参照元リストから該当するタイトルを探して番号リンクに置き換える
 * @param markdown マークダウンテキスト
 * @param references 参照元リスト（title, urlを含む）
 * @returns 変換後のマークダウンテキスト（特殊なマーカーを含む）
 */
export function convertReferencesToNumberedLinks(markdown: string, references: Array<{title: string, url?: string}>): string {
  if (!markdown || !references || references.length === 0) {
    return markdown;
  }

  // 「（XXX_【FIX】...）」のようなパターンを検出
  // パターン1: （XXX_【FIX】...）
  // パターン2: （【FIX】...）
  // パターン3: （XXX_...）
  const referencePattern = /（([^）]+)）/g;
  
  return markdown.replace(referencePattern, (match, content) => {
    // 参照元リストから該当するタイトルを探す
    const matchedIndex = references.findIndex(ref => {
      const refTitle = ref.title || '';
      // 完全一致または部分一致をチェック
      // 例: 「453_【FIX】パスワード再設定機能」と「453_【FIX】パスワード再設定機能」が一致
      // または「【FIX】パスワード再設定機能」が「453_【FIX】パスワード再設定機能」に含まれる
      return refTitle === content || 
             refTitle.includes(content) || 
             content.includes(refTitle) ||
             // 番号部分を除いた比較（例: 「453_【FIX】...」と「【FIX】...」）
             refTitle.replace(/^\d+_/, '') === content.replace(/^\d+_/, '') ||
             refTitle.replace(/^\d+_/, '').includes(content.replace(/^\d+_/, '')) ||
             content.replace(/^\d+_/, '').includes(refTitle.replace(/^\d+_/, ''));
    });

    if (matchedIndex >= 0) {
      // 番号リンクに置き換え（1ベースのインデックス）
      const referenceNumber = matchedIndex + 1;
      const referenceUrl = references[matchedIndex].url || '#';
      // マークダウンリンク形式で返す（番号を表示）
      return `[${referenceNumber}](${referenceUrl})`;
    }

    // マッチしない場合は元のテキストを返す
    return match;
  });
}

/**
 * 共通のMarkdownコンポーネント設定
 * ReactMarkdownで使用
 */
export const createSharedMarkdownComponents = (references?: Array<{title: string, url?: string}>) => ({
  h1: ({children}: any) => <h1 className="text-lg font-bold mb-4 mt-4">{children}</h1>,
  h2: ({children}: any) => <h2 className="text-lg font-bold mb-4 mt-6 text-gray-800">{children}</h2>,
  h3: ({children}: any) => <h3 className="text-base font-bold mb-3 mt-4 text-gray-900">{children}</h3>,
  h4: ({children}: any) => <h4 className="text-sm font-semibold mb-1">{children}</h4>,
  p: ({children}: any) => <p className="mb-3 leading-relaxed">{children}</p>,
  a: ({href, children, ...props}: any) => {
    // 参照番号リンクの場合、薄いグレー背景で表示
    if (href && typeof children === 'string' && /^\d+$/.test(children.trim())) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors"
          style={{verticalAlign: 'middle', margin: '0 2px'}}
          {...props}
        >
          {children}
        </a>
      );
    }
    return <a href={href} {...props}>{children}</a>;
  },
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
});

// 後方互換性のため、デフォルトのコンポーネントもエクスポート
export const sharedMarkdownComponents = createSharedMarkdownComponents();

