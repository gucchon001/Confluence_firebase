/**
 * コンテンツ抽出ユーティリティ
 * 
 * キーワードマッチングに基づいて、関連する部分を優先的に抽出する
 */

/**
 * クエリからキーワードを抽出（簡易版）
 */
function extractKeywords(query: string): string[] {
  // 日本語の助詞・助動詞を除去
  const stopWords = ['が', 'を', 'に', 'で', 'と', 'は', 'も', 'の', 'か', 'な', 'です', 'ます', 'た', 'て', 'で', 'どんな', 'どの', '何', 'どう'];
  const words = query
    .replace(/[、。，．]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.includes(w));
  return words;
}

/**
 * キーワードマッチングに基づいて関連部分を抽出
 * 
 * @param content 元のコンテンツ
 * @param query クエリ文字列
 * @param maxLength 最大文字数
 * @returns 抽出されたコンテンツ
 */
export function extractRelevantContent(
  content: string,
  query: string,
  maxLength: number
): string {
  if (!content || content.length <= maxLength) {
    return content || '';
  }

  const keywords = extractKeywords(query);
  
  // キーワードが見つからない場合は先頭から切り取る
  if (keywords.length === 0) {
    return content.substring(0, maxLength) + '...';
  }

  // 各キーワードの位置を検索
  const keywordPositions: Array<{ keyword: string; position: number }> = [];
  for (const keyword of keywords) {
    const pos = content.indexOf(keyword);
    if (pos >= 0) {
      keywordPositions.push({ keyword, position: pos });
    }
  }

  // キーワードが見つからない場合は先頭から切り取る
  if (keywordPositions.length === 0) {
    return content.substring(0, maxLength) + '...';
  }

  // 最初のキーワードの位置を基準に抽出
  keywordPositions.sort((a, b) => a.position - b.position);
  const firstKeywordPos = keywordPositions[0].position;
  
  // キーワードの前後から抽出（前30%、後70%の比率）
  const beforeLength = Math.floor(maxLength * 0.3);
  const afterLength = Math.floor(maxLength * 0.7);
  
  const startPos = Math.max(0, firstKeywordPos - beforeLength);
  const endPos = Math.min(content.length, firstKeywordPos + afterLength);
  
  let extracted = content.substring(startPos, endPos);
  
  // 抽出した部分がmaxLengthを超える場合は切り詰める
  if (extracted.length > maxLength) {
    // キーワードを含む部分を優先的に保持
    const keywordInExtracted = firstKeywordPos - startPos;
    const remainingBefore = Math.floor((maxLength - (extracted.length - keywordInExtracted)) * 0.3);
    const newStartPos = Math.max(startPos, firstKeywordPos - remainingBefore);
    extracted = content.substring(newStartPos, newStartPos + maxLength);
  }
  
  // 先頭・末尾の調整
  if (startPos > 0) {
    extracted = '...' + extracted;
  }
  if (endPos < content.length) {
    extracted = extracted + '...';
  }
  
  return extracted;
}

/**
 * 複数のキーワードマッチ箇所を考慮した抽出
 * 
 * @param content 元のコンテンツ
 * @param query クエリ文字列
 * @param maxLength 最大文字数
 * @returns 抽出されたコンテンツ
 */
export function extractRelevantContentMultiKeyword(
  content: string,
  query: string,
  maxLength: number
): string {
  if (!content || content.length <= maxLength) {
    return content || '';
  }

  const keywords = extractKeywords(query);
  
  // キーワードが見つからない場合は先頭から切り取る
  if (keywords.length === 0) {
    return content.substring(0, maxLength) + '...';
  }

  // 各キーワードの位置を検索
  const keywordPositions: Array<{ keyword: string; position: number }> = [];
  for (const keyword of keywords) {
    let pos = 0;
    while ((pos = content.indexOf(keyword, pos)) >= 0) {
      keywordPositions.push({ keyword, position: pos });
      pos += keyword.length;
    }
  }

  // キーワードが見つからない場合は先頭から切り取る
  if (keywordPositions.length === 0) {
    return content.substring(0, maxLength) + '...';
  }

  // 位置でソート
  keywordPositions.sort((a, b) => a.position - b.position);
  
  // 最初と最後のキーワードの位置を取得
  const firstPos = keywordPositions[0].position;
  const lastPos = keywordPositions[keywordPositions.length - 1].position;
  
  // キーワード間の距離を計算
  const keywordSpan = lastPos - firstPos;
  
  // キーワードが近い場合は、その範囲を中心に抽出
  // キーワードが遠い場合は、最初のキーワードを中心に抽出
  let startPos: number;
  let endPos: number;
  
  if (keywordSpan < maxLength * 0.5) {
    // キーワードが近い場合：キーワード範囲を中心に抽出
    const center = (firstPos + lastPos) / 2;
    startPos = Math.max(0, center - maxLength / 2);
    endPos = Math.min(content.length, center + maxLength / 2);
  } else {
    // キーワードが遠い場合：最初のキーワードを中心に抽出
    startPos = Math.max(0, firstPos - maxLength * 0.3);
    endPos = Math.min(content.length, firstPos + maxLength * 0.7);
  }
  
  let extracted = content.substring(startPos, endPos);
  
  // 抽出した部分がmaxLengthを超える場合は切り詰める
  if (extracted.length > maxLength) {
    extracted = extracted.substring(0, maxLength);
  }
  
  // 先頭・末尾の調整
  if (startPos > 0) {
    extracted = '...' + extracted;
  }
  if (endPos < content.length) {
    extracted = extracted + '...';
  }
  
  return extracted;
}

