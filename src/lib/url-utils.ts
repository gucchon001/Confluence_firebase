/**
 * URL構築ユーティリティ
 * ConfluenceページのURLを構築する共通関数
 */

/**
 * ConfluenceページのURLを構築
 * page_idだけでURLを構築可能（space_keyはオプション）
 * 
 * @param pageId - ページID（数値または文字列、必須）
 * @param spaceKey - スペースキー（オプション、あれば完全なURL形式を使用）
 * @param existingUrl - 既存のURL（有効な場合はそのまま使用）
 * @param options - オプション
 * @returns ConfluenceページのURL
 */
export function buildConfluenceUrl(
  pageId: number | string | undefined,
  spaceKey: string | undefined,
  existingUrl: string | undefined,
  options?: {
    baseUrl?: string;
  }
): string {
  const baseUrl = options?.baseUrl || process.env.CONFLUENCE_BASE_URL || 'https://giginc.atlassian.net';
  
  // 既存のURLが有効な場合はそのまま使用
  if (existingUrl && existingUrl !== '#' && existingUrl.startsWith('http') && existingUrl.includes('/wiki/')) {
    return existingUrl;
  }
  
  // page_idを数値に変換
  const pageIdNum = typeof pageId === 'string' ? parseInt(pageId, 10) : pageId;
  
  // page_idがあればURLを構築（space_keyはオプション）
  if (pageIdNum && Number.isFinite(pageIdNum)) {
    // space_keyがある場合は完全なURL形式を使用
    if (spaceKey) {
      return `${baseUrl}/wiki/spaces/${spaceKey}/pages/${pageIdNum}`;
    }
    // space_keyがない場合は、page_idだけでアクセスできる形式を使用
    return `${baseUrl}/wiki/pages/viewpage.action?pageId=${pageIdNum}`;
  }
  
  // フォールバック
  return existingUrl || '#';
}

