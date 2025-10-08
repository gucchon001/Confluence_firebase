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

  const isSeparatorLine = (s: string) => {
    // タブ区切りまたはスペース区切りの区切り線も検出
    return /^\s*\|?\s*(:?-{3,}\s*[\|\t]\s*)+(:?-{3,}\s*)?\|?\s*$/.test(s) ||
           /^\s*:?-{3,}\s*[\|\t]\s*:?-{3,}/.test(s) ||
           /^:---\s+:---/.test(s); // タブ区切りの区切り線
  };
  
  const normalizeSeparator = (s: string, columnCount: number) => {
    // タブ区切りまたは不完全な区切り線を正規化
    const parts = s.split(/[\|\t]+/).map(p => p.trim()).filter(p => p);
    const separators = Array(columnCount).fill(':---');
    return '| ' + separators.join(' | ') + ' |';
  };
  
  const normalizeRow = (s: string) => {
    let row = s.trim();
    
    // タブ区切りをパイプに変換
    if (row.includes('\t') && !row.includes('|')) {
      const cells = row.split('\t').map(c => c.trim()).filter(c => c);
      row = '| ' + cells.join(' | ') + ' |';
      return row;
    }
    
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
    
    // テーブルヘッダーの直後の空行をスキップ（区切り線を探す）
    if (trimmed === '' && pendingHeaderColumns !== null) {
      // 次の行が区切り線かチェック
      const nextLine = lines[i + 1]?.trim() ?? '';
      if (isSeparatorLine(nextLine)) {
        // 空行をスキップして次のループで区切り線を処理
        continue;
      } else {
        // 区切り線がない場合は挿入
        const sepCells = Array(pendingHeaderColumns).fill(':---');
        fixed.push('| ' + sepCells.join(' | ') + ' |');
        pendingHeaderColumns = null;
        fixed.push(original);
        continue;
      }
    }
    
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
    
    // タブ区切りの行を検出（テーブルの可能性）
    const looksLikeTabDelimited = trimmed.includes('\t') && !trimmed.includes('|');
    const looksLikeRow = /^\s*\|/.test(trimmed) && trimmed.includes('|');
    const looksLikeSeparator = isSeparatorLine(trimmed);

    if (looksLikeSeparator && currentColumns) {
      // 区切り線を正規化
      fixed.push(normalizeSeparator(trimmed, currentColumns));
      inTable = true;
      pendingHeaderColumns = null;
      continue;
    }
    
    if (looksLikeTabDelimited) {
      // タブ区切りのデータをテーブルに変換
      const cells = trimmed.split('\t').map(c => c.trim()).filter(c => c);
      const normalized = '| ' + cells.join(' | ') + ' |';
      
      if (!inTable) {
        // テーブル開始
        if (fixed.length > 0 && fixed[fixed.length - 1].trim() !== '') fixed.push('');
        inTable = true;
        
        // これがヘッダーかデータかを判断（前の行を確認）
        const prevLine = lines[i - 1]?.trim() ?? '';
        const isPrevTableHeader = /^\|/.test(prevLine);
        
        if (!isPrevTableHeader) {
          // これがヘッダーの可能性
          currentColumns = cells.length;
          pendingHeaderColumns = cells.length;
          fixed.push(normalized);
        } else {
          // データ行
          fixed.push(normalized);
        }
      } else {
        fixed.push(normalized);
      }
      continue;
    }
    
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
      // 通常は行をそのまま追加
      fixed.push(normalized);

      // If it's the first line of the table (header) and next line isn't a separator, insert one
      const next = lines[i + 1]?.trim() ?? '';
      if (pendingHeaderColumns) {
        if (!isSeparatorLine(next)) {
          // 区切り線がない場合は挿入
          const sepCells = Array(pendingHeaderColumns).fill(':---');
          fixed.push('| ' + sepCells.join(' | ') + ' |');
          pendingHeaderColumns = null;
          currentColumns = currentColumns || sepCells.length;
        } else {
          // 区切り線がある場合は正規化して次のループで処理
          pendingHeaderColumns = null;
        }
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
  // ただし、見出し内は除外
  const finalLines = text.split('\n');
  const formattedLines: string[] = [];
  
  for (const line of finalLines) {
    const trimmed = line.trim();
    
    // 見出し行は保護
    if (/^#{1,6}\s/.test(trimmed)) {
      formattedLines.push(line);
      continue;
    }
    
    // 数字リストのスペース追加
    let formatted = line.replace(/^(\d+\.)([^\s\n])/gm, '$1 $2');
    formattedLines.push(formatted);
  }
  
  text = formattedLines.join('\n');
  
  // 見出し（##）の直後に数字リストがある場合、空行を確保
  text = text.replace(/(#{1,4}\s+[^\n]+)\n(\d+\.\s)/g, '$1\n\n$2');
  
  // 段落と数字リストの間に空行を追加（Markdown認識のため）
  text = text.replace(/([^\n#])\n(\d+\.\s)/g, (match, before, listStart) => {
    // 前の文字が改行、見出し、または数字リストでない場合のみ空行を追加
    if (!/[\n#]/.test(before) && !/^\d+\.\s/.test(before)) {
      return before + '\n\n' + listStart;
    }
    return match;
  });
  
  // サブ項目の処理（インデントされた項目）
  // 「項目名: 説明」のパターンを箇条書きに変換
  const subItemLines = text.split('\n');
  const subItemProcessed: string[] = [];
  let lastNumberedListIndex = -1;
  
  for (let i = 0; i < subItemLines.length; i++) {
    const line = subItemLines[i];
    const trimmed = line.trim();
    
    // 見出し行は保護
    if (/^#{1,6}\s/.test(trimmed)) {
      lastNumberedListIndex = -1;
      subItemProcessed.push(line);
      continue;
    }
    
    // テーブル行は保護
    if (/^\|/.test(trimmed) || /^:?-{3,}/.test(trimmed)) {
      lastNumberedListIndex = -1;
      subItemProcessed.push(line);
      continue;
    }
    
    // 数字リストの開始を検出
    if (/^\d+\.\s/.test(trimmed)) {
      lastNumberedListIndex = i;
      subItemProcessed.push(line);
    }
    // 数字リストの後（5行以内）で、項目名: のパターンを検出
    else if (
      lastNumberedListIndex >= 0 && 
      (i - lastNumberedListIndex) <= 5 &&
      /^[^#\n\d\|-].+[:：].+/.test(trimmed) && 
      !trimmed.startsWith('-') &&
      trimmed.length < 200 // 長すぎる行は除外（説明文の可能性）
    ) {
      // サブ項目として箇条書きに変換
      const colonIndex = trimmed.search(/[:：]/);
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex);
        const value = trimmed.substring(colonIndex + 1).trim();
        subItemProcessed.push('   - **' + key + '**: ' + value);
      } else {
        subItemProcessed.push(line);
      }
    }
    // その他の行
    else {
      subItemProcessed.push(line);
    }
  }
  
  text = subItemProcessed.join('\n');
  
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
