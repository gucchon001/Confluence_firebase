/**
 * コンテンツ抽出ユーティリティ
 * 
 * キーワードマッチングに基づいて、関連する部分を優先的に抽出する
 */

import { unifiedKeywordExtractionService } from '@/lib/unified-keyword-extraction-service';

/**
 * クエリからキーワードを抽出
 * ドメイン知識連携のキーワード抽出サービスを使用
 */
function extractKeywords(query: string): string[] {
  // 同期版のキーワード抽出を使用（非同期処理を避けるため）
  // unifiedKeywordExtractionService.extractKeywordsSync が利用可能な場合はそれを使用
  // そうでない場合は、簡易版の抽出を使用
  try {
    // 同期版が利用可能か確認
    if (typeof unifiedKeywordExtractionService.extractKeywordsSync === 'function') {
      return unifiedKeywordExtractionService.extractKeywordsSync(query);
    }
  } catch (error) {
    // エラーが発生した場合は簡易版にフォールバック
    console.warn('[extractKeywords] Failed to use unifiedKeywordExtractionService, falling back to simple extraction:', error);
  }
  
  // フォールバック: 簡易版のキーワード抽出
  const stopWords = ['が', 'を', 'に', 'で', 'と', 'は', 'も', 'の', 'か', 'な', 'です', 'ます', 'た', 'て', 'で', 'どんな', 'どの', '何', 'どう', 'や', 'は', 'されます', 'されますか'];
  
  // 日本語のテキストを分割（2文字以上の連続する文字列を抽出）
  const words: string[] = [];
  let currentWord = '';
  
  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    // ひらがな、カタカナ、漢字、数字、英字を単語として扱う
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF0-9A-Za-z]/.test(char)) {
      currentWord += char;
    } else {
      // 区切り文字（助詞など）で単語を区切る
      if (currentWord.length >= 2 && !stopWords.includes(currentWord)) {
        words.push(currentWord);
      }
      currentWord = '';
    }
  }
  
  // 最後の単語を追加
  if (currentWord.length >= 2 && !stopWords.includes(currentWord)) {
    words.push(currentWord);
  }
  
  // 重複を除去
  return Array.from(new Set(words));
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
  // キーワードが遠い場合は、最初と最後のキーワードを含む範囲を抽出
  let startPos: number;
  let endPos: number;
  
  if (keywordSpan < maxLength * 0.5) {
    // キーワードが近い場合：キーワード範囲を中心に抽出
    const center = (firstPos + lastPos) / 2;
    startPos = Math.max(0, center - maxLength / 2);
    endPos = Math.min(content.length, center + maxLength / 2);
  } else {
    // キーワードが遠い場合：最初と最後のキーワードを含む範囲を抽出
    // 最初のキーワードの前30%、最後のキーワードの後30%を確保
    const beforeFirst = Math.floor(maxLength * 0.3);
    const afterLast = Math.floor(maxLength * 0.3);
    const middleLength = maxLength - beforeFirst - afterLast;
    
    // キーワード間の距離が中間部分より大きい場合は、キーワード間を優先
    if (keywordSpan > middleLength) {
      // キーワード間を中心に、前後を均等に配分
      const totalNeeded = keywordSpan + beforeFirst + afterLast;
      if (totalNeeded <= maxLength) {
        // キーワード間全体を含められる場合
        startPos = Math.max(0, firstPos - beforeFirst);
        endPos = Math.min(content.length, lastPos + afterLast);
      } else {
        // キーワード間全体を含められない場合、最初と最後のキーワードを含む最小範囲
        startPos = Math.max(0, firstPos - beforeFirst);
        endPos = Math.min(content.length, startPos + maxLength);
        // 最後のキーワードが含まれるように調整
        if (endPos < lastPos + afterLast) {
          endPos = Math.min(content.length, lastPos + afterLast);
          startPos = Math.max(0, endPos - maxLength);
        }
      }
    } else {
      // キーワード間の距離が中間部分より小さい場合、最初のキーワードを中心に抽出
      startPos = Math.max(0, firstPos - beforeFirst);
      endPos = Math.min(content.length, startPos + maxLength);
      // 最後のキーワードが含まれるように調整
      if (endPos < lastPos + afterLast) {
        endPos = Math.min(content.length, lastPos + afterLast);
        startPos = Math.max(0, endPos - maxLength);
      }
    }
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

