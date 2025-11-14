/**
 * Jira URL構築ユーティリティ
 * JiraイシューのURLを構築する共通関数
 */

/**
 * JiraイシューのURLを構築
 * 
 * @param issueKey - イシューキー（例: "PROJ-123"）
 * @param existingUrl - 既存のURL（有効な場合はそのまま使用）
 * @param options - オプション
 * @returns JiraイシューのURL
 */
export function buildJiraUrl(
  issueKey: string | undefined,
  existingUrl: string | undefined,
  options?: {
    baseUrl?: string;
  }
): string {
  const baseUrl = options?.baseUrl || process.env.JIRA_BASE_URL || process.env.CONFLUENCE_BASE_URL || 'https://giginc.atlassian.net';
  
  // 既存のURLが有効な場合はそのまま使用
  if (existingUrl && existingUrl !== '#' && existingUrl.startsWith('http')) {
    return existingUrl;
  }
  
  // issueKeyからURLを構築
  if (issueKey) {
    return `${baseUrl}/browse/${issueKey}`;
  }
  
  // フォールバック
  return existingUrl || '#';
}

