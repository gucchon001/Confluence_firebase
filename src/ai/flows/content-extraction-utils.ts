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
 * 理想的なハイブリッド方式によるコンテンツ抽出
 * 
 * 1. 先頭取得: ランキングに関係なく先頭から固定文字数（例: 800文字）
 * 2. キーワード周辺取得: キーワード周辺から固定文字数（例: 600文字）
 * 3. ハイブリッド: 両者を組み合わせ、ランキングに応じて比率を調整
 *    - 1位: 先頭:キーワード = 7:3
 *    - 10位: 先頭:キーワード = 3:7
 * 
 * @param content 元のコンテンツ
 * @param query クエリ文字列
 * @param maxLength 最大文字数（ランキングに基づく動的な文字数制限）
 * @param rank ランキング（0-9、0が1位、9が10位）
 * @returns 抽出されたコンテンツ
 */
export function extractRelevantContentMultiKeyword(
  content: string,
  query: string,
  maxLength: number,
  rank: number = 0
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
  
  // 理想的なハイブリッド方式の実装
  // ステップ1: 先頭取得とキーワード周辺取得の固定文字数を定義（ランキングに関係なく）
  const HEAD_FIXED_LENGTH = 800;  // 先頭から固定800文字
  const KEYWORD_FIXED_LENGTH = 600;  // キーワード周辺から固定600文字
  
  // ステップ2: ランキングに応じた比率を計算（0-9、0が1位、9が10位）
  // 1位（rank=0）: 先頭:キーワード = 7:3
  // 10位（rank=9）: 先頭:キーワード = 3:7
  // 線形補間: headRatio = 0.7 - (rank / 9) * 0.4
  const normalizedRank = Math.max(0, Math.min(9, rank)); // 0-9に正規化
  const headRatio = 0.7 - (normalizedRank / 9) * 0.4; // 0.7 (1位) → 0.3 (10位)
  const keywordRatio = 1.0 - headRatio; // 0.3 (1位) → 0.7 (10位)
  
  // ステップ3: 先頭取得範囲を計算（固定800文字から取得）
  const headStartPos = 0;
  const headEndPos = Math.min(content.length, HEAD_FIXED_LENGTH);
  const headSpan = headEndPos - headStartPos; // 先頭取得範囲の実際の文字数
  
  // ステップ4: キーワード周辺の範囲を計算（固定600文字から取得）
  const firstKeywordPos = keywordPositions[0].position;
  const lastKeywordPos = keywordPositions[keywordPositions.length - 1].position;
  
  // キーワード周辺の前後余白（各キーワードの前後150文字）
  const contextBefore = 150;
  const contextAfter = 150;
  
  // キーワード周辺の範囲を計算
  const keywordStartPos = Math.max(0, firstKeywordPos - contextBefore);
  const keywordEndPos = Math.min(content.length, lastKeywordPos + contextAfter);
  const keywordSpan = keywordEndPos - keywordStartPos; // キーワード周辺範囲の実際の文字数
  
  // ステップ5: maxLengthを先頭とキーワード周辺に分配（ランキングに応じた比率で）
  const headLength = Math.floor(maxLength * headRatio); // 先頭取得に割り当てる文字数
  const keywordLength = Math.floor(maxLength * keywordRatio); // キーワード周辺取得に割り当てる文字数
  
  // 実際に取得する文字数（固定範囲と割り当て文字数の最小値）
  const headExtractedLength = Math.min(headSpan, headLength);
  const keywordExtractedLength = Math.min(keywordSpan, keywordLength);
  
  // ステップ6: 理想的なハイブリッド方式での抽出範囲決定
  let startPos: number;
  let endPos: number;
  
  // 先頭取得範囲とキーワード周辺範囲の位置関係を確認
  const headOnlyStart = headStartPos;
  const headOnlyEnd = Math.min(headEndPos, keywordStartPos); // キーワード周辺範囲より前の先頭範囲
  const overlapStart = Math.max(headStartPos, keywordStartPos);
  const overlapEnd = Math.min(headEndPos, keywordEndPos);
  const keywordOnlyStart = Math.max(headEndPos, keywordStartPos); // 先頭取得範囲より後のキーワード周辺範囲
  const keywordOnlyEnd = keywordEndPos;
  
  // 各範囲の文字数を計算
  const headOnlySpan = Math.max(0, headOnlyEnd - headOnlyStart);
  const overlapSpan = Math.max(0, overlapEnd - overlapStart);
  const keywordOnlySpan = Math.max(0, keywordOnlyEnd - keywordOnlyStart);
  const totalSpan = headOnlySpan + overlapSpan + keywordOnlySpan;
  
  // ケース1: 全体がmaxLength以内の場合
  if (totalSpan <= maxLength) {
    // 両方の範囲を含められる場合
    startPos = Math.min(headStartPos, keywordStartPos);
    endPos = Math.max(headEndPos, keywordEndPos);
  } else {
    // ケース2: maxLengthを超える場合、比率に応じて調整
    // 先頭取得とキーワード周辺取得の実際の文字数を計算
    const actualHeadLength = Math.floor(maxLength * headRatio);
    const actualKeywordLength = Math.floor(maxLength * keywordRatio);
    
    if (headRatio >= keywordRatio) {
      // 先頭を優先（1位の場合: 先頭:キーワード = 7:3）
      // 先頭範囲から取得
      const headExtracted = Math.min(headSpan, actualHeadLength);
      startPos = headStartPos;
      endPos = Math.min(content.length, headStartPos + headExtracted);
      
      // キーワード周辺範囲も含める（重複部分を考慮）
      const remainingLength = maxLength - (endPos - startPos);
      if (remainingLength > 0) {
        // キーワード周辺範囲が先頭範囲外にある部分を追加
        if (keywordOnlySpan > 0) {
          // 先頭範囲より後のキーワード周辺範囲を追加
          const additionalKeywordLength = Math.min(keywordOnlySpan, remainingLength);
          endPos = Math.min(content.length, endPos + additionalKeywordLength);
        } else if (keywordStartPos < startPos) {
          // キーワード周辺範囲が先頭範囲より前にある部分を追加
          const keywordBeforeHeadSpan = keywordEndPos - Math.max(0, keywordStartPos);
          const additionalKeywordLength = Math.min(keywordBeforeHeadSpan, remainingLength);
          startPos = Math.max(0, startPos - additionalKeywordLength);
        }
      }
    } else {
      // キーワード周辺を優先（10位の場合: 先頭:キーワード = 3:7）
      // キーワード周辺範囲から取得
      const keywordExtracted = Math.min(keywordSpan, actualKeywordLength);
      startPos = Math.max(0, keywordStartPos);
      endPos = Math.min(content.length, keywordStartPos + keywordExtracted);
      
      // 先頭範囲も含める（重複部分を考慮）
      const remainingLength = maxLength - (endPos - startPos);
      if (remainingLength > 0) {
        // 先頭範囲がキーワード周辺範囲外にある部分を追加
        if (headOnlySpan > 0) {
          // キーワード周辺範囲より前の先頭範囲を追加
          const additionalHeadLength = Math.min(headOnlySpan, remainingLength);
          startPos = Math.max(0, startPos - additionalHeadLength);
        } else if (headEndPos > endPos) {
          // 先頭範囲がキーワード周辺範囲より後にある部分を追加
          const headAfterKeywordSpan = headEndPos - Math.max(0, headStartPos);
          const additionalHeadLength = Math.min(headAfterKeywordSpan, remainingLength);
          endPos = Math.min(content.length, endPos + additionalHeadLength);
        }
      }
    }
  }
  
  // ステップ7: 抽出範囲を確定し、maxLengthを超えないように調整
  let extracted = content.substring(startPos, endPos);
  
  // 抽出した部分がmaxLengthを超える場合は切り詰める
  if (extracted.length > maxLength) {
    extracted = extracted.substring(0, maxLength);
    endPos = startPos + maxLength;
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

