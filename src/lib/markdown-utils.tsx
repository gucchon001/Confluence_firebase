/**
 * Markdown処理ユーティリティ
 * テーブル正規化、記号変換、共通コンポーネント設定を提供
 */

/**
 * Try to normalize malformed markdown tables produced by LLM so that remark-gfm
 * can render them. Heuristics:
 * - Ensure table header lines start with a single '|'
 * - Collapse multiple leading pipes (e.g. "|| 項目 |...")
 * - Insert separator line like "|:---|:---|" if missing after header
 * - Ensure each table row starts/ends with a pipe and is on its own line
 */
export function fixMarkdownTables(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const fixed: string[] = [];
  let inTable = false;
  let pendingHeaderColumns: number | null = null;
  let currentColumns: number | null = null;

  const isSeparatorLine = (s: string) => /^\s*\|?\s*(:?-{3,}\s*\|\s*)+(:?-{3,}\s*)?\|?\s*$/.test(s);
  const normalizeRow = (s: string) => {
    let row = s.trim();
    // collapse multiple leading pipes
    row = row.replace(/^\|{2,}/, '|');
    // add leading pipe
    if (!row.startsWith('|')) row = '|' + row;
    // ensure single spaces around pipes for readability
    row = row.replace(/\s*\|\s*/g, ' | ');
    // add trailing pipe
    if (!row.endsWith('|')) row = row + ' |';
    return row;
  };

  for (let i = 0; i < lines.length; i++) {
    const original = lines[i];
    const trimmed = original.trim();
    
    // Skip empty lines but preserve them
    if (trimmed === '') {
      if (inTable) {
        // End of table
        inTable = false;
        pendingHeaderColumns = null;
        currentColumns = null;
      }
      fixed.push(original);
      continue;
    }

    const looksLikeRow = /^\s*\|/.test(trimmed) && trimmed.includes('|');

    if (looksLikeRow) {
      const normalized = normalizeRow(trimmed);
      if (!inTable) {
        // Ensure blank line before table for GFM
        if (fixed.length > 0 && fixed[fixed.length - 1].trim() !== '') fixed.push('');
        inTable = true;
        // compute column count from header
        pendingHeaderColumns = normalized.split('|').filter(c => c.trim().length > 0).length - 1;
        currentColumns = pendingHeaderColumns;
      }
      // 行を列数で分割して複数行に展開（1行に複数レコードが連結されている場合の対策）
      const cells = normalized
        .slice(1, normalized.length - 1) // 先頭/末尾のパイプを除去
        .split('|')
        .map(c => c.trim())
        .filter(c => !(c === '' && currentColumns !== null));

      if (currentColumns && cells.length > currentColumns) {
        for (let off = 0; off < cells.length; off += currentColumns) {
          const rowCells = cells.slice(off, off + currentColumns);
          if (rowCells.length === currentColumns) {
            fixed.push('| ' + rowCells.join(' | ') + ' |');
          }
        }
      } else {
        fixed.push(normalized);
      }

      // If it's the first line of the table (header) and next line isn't a separator, insert one
      const next = lines[i + 1]?.trim() ?? '';
      if (pendingHeaderColumns && !isSeparatorLine(next)) {
        const sepCells = Array(pendingHeaderColumns).fill(':---');
        fixed.push('| ' + sepCells.join(' | ') + ' |');
        pendingHeaderColumns = null;
        currentColumns = currentColumns || sepCells.length;
      } else if (isSeparatorLine(next)) {
        // We will let the next loop push the existing separator
        pendingHeaderColumns = null;
      }
    } else {
      // Not a table row
      if (inTable) {
        inTable = false;
        pendingHeaderColumns = null;
        currentColumns = null;
      }
      fixed.push(original);
    }
  }

  return fixed.join('\n');
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
  
  // 箇条書きの改行処理（「。-」パターンを「。\n-」に変換）
  text = text.replace(/([。！？])\s*-\s+/g, '$1\n- ');
  
  // 番号付きリストの改行処理
  // 1. 句読点の後の数字リスト：「。 2.」→「。\n2.」
  text = text.replace(/([。！？])\s*(\d+\.)\s+/g, '$1\n$2 ');
  // 2. 連続する数字リスト：「...時。1.会員登録」→「...時。\n1.会員登録」
  text = text.replace(/([。！？])(\d+\.[^\n])/g, '$1\n$2');
  
  // 数字リストのMarkdown形式化
  // 行頭または改行後の「1.テキスト」を「1. テキスト」に変換（スペースを追加）
  text = text.replace(/^(\d+\.)([^\s\n])/gm, '$1 $2');
  text = text.replace(/\n(\d+\.)([^\s\n])/g, '\n$1 $2');
  
  // 数字リストの前に空行を追加（Markdown認識のため）
  // ただし、既に空行がある場合や、リストが連続している場合は追加しない
  text = text.replace(/([^\n])\n(\d+\.\s)/g, (match, before, listStart) => {
    // 前の行が数字リストでない場合のみ空行を追加
    if (!/^\d+\.\s/.test(before)) {
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
