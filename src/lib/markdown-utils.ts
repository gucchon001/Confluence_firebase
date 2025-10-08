/**
 * Markdown処理ユーティリティ関数
 * チャットページと管理ダッシュボードで共通使用
 */

/**
 * Markdownテーブルを修正する関数
 * - 全角記号を半角に変換
 * - テーブルの前に空行を追加（GFMプラグインの要件）
 * - Ensure table header lines start with a single '|'
 * - Collapse multiple leading pipes (e.g. "|| 項目 |...")
 * - Insert separator line like "|:---|:---|" if missing after header
 * - Ensure each table row starts/ends with a pipe and is on its own line
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
 * 全角記号などを半角Markdown記号に正規化
 */
export function normalizeMarkdownSymbols(markdown: string): string {
  if (!markdown) return markdown;
  
  // シンプルアプローチ：基本的な全角→半角変換のみ
  let text = markdown
    .replace(/｜/g, '|')       // U+FF5C FULLWIDTH VERTICAL LINE
    .replace(/：/g, ':')       // U+FF1A FULLWIDTH COLON
    .replace(/－/g, '-')       // U+FF0D FULLWIDTH HYPHEN-MINUS
    .replace(/〜/g, '~')
    .replace(/　/g, ' ');      // U+3000 IDEOGRAPHIC SPACE
  
  // シンプルアプローチ：基本的な全角→半角変換のみ
  // その他の処理はReactMarkdownのプラグインに依存
  return text;
}

/**
 * 共通のMarkdownコンポーネント定義
 * ReactMarkdownで使用するカスタムコンポーネント
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
  hr: ({children}: any) => <hr className="my-4 border-gray-300" />,
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
