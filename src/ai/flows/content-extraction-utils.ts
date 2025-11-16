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
  
  // ハイブリッド方式：ランクによる先頭取得 + キーワード周辺のコンテンツ取得
  // ステップ1: すべてのキーワードを含む範囲を計算（キーワード周辺のコンテンツ）
  const firstKeywordPos = keywordPositions[0].position;
  const lastKeywordPos = keywordPositions[keywordPositions.length - 1].position;
  
  // キーワード周辺の前後余白（各キーワードの前後100文字）
  const contextBefore = 100;
  const contextAfter = 100;
  
  // キーワード周辺の範囲を計算
  const keywordStartPos = Math.max(0, firstKeywordPos - contextBefore);
  const keywordEndPos = Math.min(content.length, lastKeywordPos + contextAfter);
  const keywordSpan = keywordEndPos - keywordStartPos;
  
  // ステップ2: ランクに基づいて先頭からmaxLength分の文字数を取得（ランクによる重要性を保持）
  const headStartPos = 0;
  const headEndPos = Math.min(content.length, maxLength);
  const headSpan = headEndPos - headStartPos;
  
  // ステップ3: 範囲内・範囲外のキーワード分類（先頭取得範囲内）
  const keywordsInHeadRange = keywordPositions.filter(kp => kp.position < headEndPos);
  const keywordsOutOfHeadRange = keywordPositions.filter(kp => kp.position >= headEndPos);
  
  // ステップ4: ハイブリッド方式での抽出範囲決定
  let startPos: number;
  let endPos: number;
  
  if (keywordSpan <= maxLength) {
    // ケース1: すべてのキーワードを含む範囲がmaxLength以内の場合
    // キーワード周辺のコンテンツを優先的に取得
    startPos = keywordStartPos;
    endPos = keywordEndPos;
  } else {
    // ケース2: すべてのキーワードを含む範囲がmaxLengthを超える場合
    // ハイブリッド方式：先頭取得とキーワード周辺取得を組み合わせる
    
    // 先頭取得範囲内のキーワードと範囲外のキーワードを確認
    const keywordsInHeadCount = keywordsInHeadRange.length;
    const keywordsOutOfHeadCount = keywordsOutOfHeadRange.length;
    
    if (keywordsInHeadCount > 0 && keywordsOutOfHeadCount > 0) {
      // ケース2-1: 先頭範囲内にも範囲外にもキーワードがある場合
      // 先頭範囲内のキーワードと範囲外のキーワードを含む最小範囲を計算
      
      const firstOutOfHeadPos = keywordsOutOfHeadRange[0].position;
      const lastOutOfHeadPos = keywordsOutOfHeadRange[keywordsOutOfHeadRange.length - 1].position;
      const firstInHeadPos = keywordsInHeadRange[0].position;
      
      // 先頭範囲内の最初のキーワードから範囲外の最後のキーワードまでの範囲
      const combinedStartPos = Math.max(0, firstInHeadPos - contextBefore);
      const combinedEndPos = Math.min(content.length, lastOutOfHeadPos + contextAfter);
      const combinedSpan = combinedEndPos - combinedStartPos;
      
      if (combinedSpan <= maxLength) {
        // 先頭と範囲外のキーワードを含む範囲がmaxLength以内の場合
        startPos = combinedStartPos;
        endPos = combinedEndPos;
      } else {
        // 先頭と範囲外のキーワードを含む範囲がmaxLengthを超える場合
        // ハイブリッド方式：先頭範囲と範囲外キーワードを含む範囲を組み合わせる
        // キーワード密度が高い領域を優先的に抽出しつつ、両方の範囲を含める
        
        // 範囲外のキーワード範囲
        const outOfHeadStartPos = Math.max(0, firstOutOfHeadPos - contextBefore);
        const outOfHeadEndPos = Math.min(content.length, lastOutOfHeadPos + contextAfter);
        const outOfHeadSpan = outOfHeadEndPos - outOfHeadStartPos;
        
        // 先頭範囲内のキーワード密度
        const headKeywordDensity = keywordsInHeadCount / headSpan;
        
        // 範囲外のキーワード密度
        const outOfHeadKeywordDensity = keywordsOutOfHeadCount / outOfHeadSpan;
        
        // ハイブリッド方式：先頭範囲と範囲外キーワードを含む範囲を組み合わせる
        // 先頭範囲と範囲外キーワードを含む範囲の比率を計算
        const headRatio = headKeywordDensity / (headKeywordDensity + outOfHeadKeywordDensity);
        const outOfHeadRatio = outOfHeadKeywordDensity / (headKeywordDensity + outOfHeadKeywordDensity);
        
        // maxLengthを先頭範囲と範囲外キーワード範囲に分配
        const headPortion = Math.floor(maxLength * headRatio);
        const outOfHeadPortion = maxLength - headPortion;
        
        if (headKeywordDensity >= outOfHeadKeywordDensity) {
          // 先頭範囲内のキーワード密度が高い場合、先頭を優先
          // ただし、範囲外のキーワードも含める
          // 先頭範囲の一部 + 範囲外キーワードを含む範囲
          const headPortionForExtraction = Math.min(headPortion, headSpan);
          const outOfHeadPortionForExtraction = Math.min(outOfHeadPortion, outOfHeadSpan);
          
          // 先頭範囲内の最初のキーワードから抽出開始
          // 範囲外キーワードを含む範囲まで拡張
          startPos = Math.max(0, firstInHeadPos - contextBefore);
          // 先頭範囲内のキーワードと範囲外キーワードを含む範囲を計算
          const totalNeeded = (lastOutOfHeadPos + contextAfter) - (firstInHeadPos - contextBefore);
          
          if (totalNeeded <= maxLength) {
            // すべてのキーワードを含む範囲がmaxLength以内の場合
            endPos = Math.min(content.length, lastOutOfHeadPos + contextAfter);
          } else {
            // maxLengthを超える場合、先頭範囲を優先しつつ範囲外キーワードも含める
            // 先頭範囲の一部を保持し、範囲外キーワードを含む範囲を追加
            endPos = Math.min(content.length, startPos + headPortionForExtraction + outOfHeadPortionForExtraction);
            
            // 範囲外キーワードを含む範囲が先頭範囲に重なる場合は調整
            if (endPos < lastOutOfHeadPos + contextAfter) {
              // 範囲外キーワードを含む範囲まで拡張（maxLength内で）
              const maxEndPos = Math.min(content.length, startPos + maxLength);
              if (maxEndPos >= lastOutOfHeadPos + contextAfter) {
                endPos = Math.min(content.length, lastOutOfHeadPos + contextAfter);
              } else {
                // 範囲外キーワードを含む範囲がmaxLengthを超える場合
                // 先頭範囲を削減して範囲外キーワードを含める
                const neededForOutOfHead = (lastOutOfHeadPos + contextAfter) - outOfHeadStartPos;
                if (neededForOutOfHead <= maxLength) {
                  startPos = Math.max(0, (lastOutOfHeadPos + contextAfter) - maxLength);
                  endPos = Math.min(content.length, lastOutOfHeadPos + contextAfter);
                } else {
                  // 範囲外キーワードを含む範囲がmaxLengthを超える場合
                  // 範囲外キーワードのみを抽出（キーワード周辺のコンテンツを優先）
                  startPos = outOfHeadStartPos;
                  endPos = Math.min(content.length, startPos + maxLength);
                }
              }
            }
          }
        } else {
          // 範囲外のキーワード密度が高い場合、範囲外を優先
          // ただし、先頭範囲内のキーワードも一部含める
          // 範囲外キーワードを含む範囲 + 先頭範囲の一部
          const outOfHeadPortionForExtraction = Math.min(outOfHeadPortion, outOfHeadSpan);
          const headPortionForExtraction = Math.min(headPortion, headSpan);
          
          // 範囲外キーワードを含む範囲から抽出開始
          startPos = outOfHeadStartPos;
          // 先頭範囲の一部も含める
          const totalNeeded = (lastOutOfHeadPos + contextAfter) - Math.max(0, firstInHeadPos - contextBefore);
          
          if (totalNeeded <= maxLength) {
            // すべてのキーワードを含む範囲がmaxLength以内の場合
            startPos = Math.max(0, firstInHeadPos - contextBefore);
            endPos = Math.min(content.length, lastOutOfHeadPos + contextAfter);
          } else {
            // maxLengthを超える場合、範囲外キーワードを優先しつつ先頭範囲も含める
            // 範囲外キーワードを含む範囲を優先的に保持
            endPos = Math.min(content.length, startPos + maxLength);
            
            // 先頭範囲内のキーワードを含む範囲まで拡張できるか確認
            const headStartWithContext = Math.max(0, firstInHeadPos - contextBefore);
            if (endPos >= headStartWithContext + headPortionForExtraction) {
              // 先頭範囲も含められる場合
              startPos = Math.max(0, endPos - maxLength);
            } else {
              // 範囲外キーワードのみを抽出（キーワード周辺のコンテンツを優先）
              startPos = outOfHeadStartPos;
              endPos = Math.min(content.length, startPos + maxLength);
            }
          }
        }
      }
    } else if (keywordsInHeadCount > 0) {
      // ケース2-2: 先頭範囲内にのみキーワードがある場合
      // 先頭範囲を優先的に取得
      startPos = headStartPos;
      endPos = headEndPos;
    } else if (keywordsOutOfHeadCount > 0) {
      // ケース2-3: 範囲外にのみキーワードがある場合
      // キーワード周辺のコンテンツを取得（範囲外のキーワードを含む範囲）
      const firstOutOfHeadPos = keywordsOutOfHeadRange[0].position;
      const lastOutOfHeadPos = keywordsOutOfHeadRange[keywordsOutOfHeadRange.length - 1].position;
      
      startPos = Math.max(0, firstOutOfHeadPos - contextBefore);
      endPos = Math.min(content.length, lastOutOfHeadPos + contextAfter);
      
      // maxLengthを超える場合は調整
      if (endPos - startPos > maxLength) {
        // キーワードを含む範囲を優先的に保持
        const keywordOnlySpan = lastOutOfHeadPos - firstOutOfHeadPos;
        const remainingForContext = maxLength - keywordOnlySpan;
        const contextPerSide = Math.floor(remainingForContext / 2);
        startPos = Math.max(0, firstOutOfHeadPos - contextPerSide);
        endPos = Math.min(content.length, lastOutOfHeadPos + contextPerSide);
      }
    } else {
      // ケース2-4: キーワードが見つからない場合（発生しないはず）
      startPos = headStartPos;
      endPos = headEndPos;
    }
  }
  
  // ステップ5: 抽出範囲を確定
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

