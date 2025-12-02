/**
 * セマンティックチャンキングユーティリティ
 * 意味的なまとまりを考慮してテキストをチャンクに分割
 * 
 * 既存のchunkText関数のパターンを維持しつつ、文の境界を考慮して分割
 * 各データソースサービスから独立して使用可能（保守性を確保）
 * 
 * 特徴:
 * - 文の境界で分割（句点、改行を検出）
 * - 既存のchunkText関数と互換性のあるインターフェース
 * - メモリ効率的な実装
 */

import type { TextChunk } from './text-chunking';

export interface SemanticChunkOptions {
  maxChunkSize?: number;           // デフォルト: 1800
  overlap?: number;                // デフォルト: 200
  respectSentenceBoundaries?: boolean;  // デフォルト: true
}

export interface SemanticChunk extends TextChunk {
  // TextChunkインターフェースを継承（互換性を保持）
}

/**
 * 文の終わりを検出する正規表現
 * 日本語: 。！？
 * 英語: .!?
 */
const SENTENCE_END_REGEX = /[。！？\.!?]+/g;

/**
 * テキストを意味的なまとまりを考慮してチャンクに分割
 * 
 * 既存のchunkText関数と互換性を保ちつつ、文の境界を考慮して分割
 */
export function semanticChunkText(
  text: string,
  options: SemanticChunkOptions = {}
): SemanticChunk[] {
  const maxChunkSize = options.maxChunkSize || 1800;
  const overlap = options.overlap || 200;
  const respectSentenceBoundaries = options.respectSentenceBoundaries !== false;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // 文の境界を考慮しない場合は、既存のchunkTextと同じ動作
  if (!respectSentenceBoundaries) {
    return simpleChunkText(text, maxChunkSize, overlap);
  }

  // 文の境界を考慮してチャンク分割
  return chunkWithSentenceBoundaries(text, maxChunkSize, overlap);
}

/**
 * シンプルなチャンク分割（既存のchunkTextと同じロジック）
 * フォールバック用、または文の境界を考慮しない場合
 */
function simpleChunkText(text: string, maxChunkSize: number, overlap: number): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    const chunkText = text.substring(start, end).trim();

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunks.length,
        start,
        end,
      });
    }

    // 次のチャンクはoverlapだけ前から開始（文脈を保持）
    start = end - overlap;

    // 最後のチャンクに到達した場合は終了
    if (start + maxChunkSize >= text.length && chunks.length > 0) {
      break;
    }
  }

  // コンテンツがない場合は空のチャンクを返す
  if (chunks.length === 0) {
    chunks.push({
      text: text.trim() || '',
      index: 0,
      start: 0,
      end: text.length,
    });
  }

  return chunks;
}

/**
 * 文の境界を考慮してチャンク分割
 * 既存のchunkTextのパターンに基づき、文の境界を見つけて分割位置を調整
 */
function chunkWithSentenceBoundaries(
  text: string,
  maxChunkSize: number,
  overlap: number
): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  let start = 0;
  const textLength = text.length;
  
  // 最小進行距離を計算（無限ループを防ぐため、maxChunkSizeの10%以上は必ず進む）
  const minProgress = Math.max(1, Math.floor(maxChunkSize * 0.1));
  
  // 前回のstart位置を記録（無限ループ検出用）
  let lastStart = -1;
  let sameStartCount = 0;

  while (start < textLength) {
    // 無限ループ防止: 同じ位置に留まり続けている場合は強制的に進める
    // ループの最初にチェック（前回のループ終了時のstartと比較）
    if (start === lastStart && lastStart >= 0) {
      sameStartCount++;
      if (sameStartCount >= 3) {
        // 3回以上同じ位置に留まっている場合は、強制的に進める
        console.warn(`⚠️ 同じ位置に留まっています (start=${start})。強制的に進行します。`);
        start = start + minProgress;
        if (start >= textLength) {
          break;
        }
        sameStartCount = 0;
        // 強制進行後は、このループをスキップして次のループに進む
        lastStart = start;
        continue;
      }
    } else {
      sameStartCount = 0;
    }
    
    // 基本的な終了位置（maxChunkSize）
    let end = Math.min(start + maxChunkSize, textLength);
    
    // 文の境界を考慮して終了位置を調整
    if (end < textLength) {
      // 終了位置付近（後ろ50文字以内）で最後の文の終わりを探す
      const searchStart = Math.max(start, end - 50);
      const searchEnd = Math.min(end + 50, textLength);
      const searchText = text.substring(searchStart, searchEnd);
      
      // 文の終わりを見つける（end位置より前で、できるだけ近い位置）
      const adjustedEnd = findBestSentenceEnd(searchText, end - searchStart, searchStart);
      // 調整された終了位置がstartより大きく、かつ元のendより大きくならないようにする
      if (adjustedEnd > start && adjustedEnd < end) {
        end = adjustedEnd;
      } else if (adjustedEnd > start && adjustedEnd <= end + 50 && adjustedEnd <= textLength) {
        // 文の終わりがendより後ろにある場合でも、50文字以内なら許容
        end = adjustedEnd;
      }
    }

    // チャンクを抽出
    const chunkText = text.substring(start, end).trim();

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunks.length,
        start,
        end,
      });
    }

    // 次のチャンクはoverlapだけ前から開始（文の境界を考慮）
    if (end >= textLength) {
      // 最後のチャンクに到達
      break;
    }

    // オーバーラップ開始位置を計算
    // overlapがmaxChunkSizeより大きい場合は、maxChunkSizeの80%を上限とする
    const effectiveOverlap = Math.min(overlap, Math.floor(maxChunkSize * 0.8));
    const overlapStart = Math.max(start, end - effectiveOverlap);
    
    // オーバーラップ開始位置付近で文の境界を探す（進行を保証するためcurrentStartを渡す）
    const sentenceStart = findBestSentenceStart(text, overlapStart, end, start);
    
    let nextStart: number;
    
    if (sentenceStart === null) {
      // 文の終わりが見つからない場合は、固定サイズチャンキングと同じロジックを使用
      // （maxChunkSize - effectiveOverlapだけ進む）
      nextStart = end - effectiveOverlap;
      
      // ただし、前回のstartより確実に進むようにする
      if (nextStart <= start) {
        nextStart = start + minProgress;
      }
    } else {
      // 文の終わりが見つかった場合は、その位置を使用
      nextStart = sentenceStart;
    }
    
    // 安全装置: endを超えないようにする
    if (nextStart >= end) {
      // endを超える場合は、effectiveOverlapの半分だけ戻る
      nextStart = Math.max(start + minProgress, end - Math.floor(effectiveOverlap * 0.5));
    }
    
    // さらに安全装置: テキストの終端を超えないようにする
    if (nextStart >= textLength) {
      break;
    }
    
    // 最終確認: 確実に進行していることを確認
    // 進行が全くない、または少なすぎる場合は強制的に進める
    if (nextStart <= start || (nextStart - start) < minProgress) {
      nextStart = start + minProgress;
      if (nextStart >= textLength) {
        break;
      }
    }
    
    // 次のstart位置を設定する前に、前回の位置を記録
    lastStart = start;
    start = nextStart;

    // 最後のチャンクに到達した場合は終了
    if (start + maxChunkSize >= textLength && chunks.length > 0) {
      break;
    }
    
    // 無限ループ防止: 1000回以上チャンクが生成された場合は終了
    if (chunks.length > 1000) {
      console.warn('⚠️ チャンク数が1000を超えました。処理を中断します。');
      break;
    }
  }

  // チャンクが1つもない場合は空のチャンクを返す
  if (chunks.length === 0) {
    chunks.push({
      text: text.trim() || '',
      index: 0,
      start: 0,
      end: text.length,
    });
  }

  return chunks;
}

/**
 * 最適な文の終わり位置を見つける
 * @param searchText 検索対象テキスト（相対位置）
 * @param preferredPos 希望する位置（相対位置）
 * @param absoluteStart 絶対開始位置
 * @returns 絶対位置での文の終わり
 */
function findBestSentenceEnd(
  searchText: string,
  preferredPos: number,
  absoluteStart: number
): number {
  if (preferredPos < 0 || preferredPos >= searchText.length) {
    return absoluteStart + preferredPos;
  }

  // preferredPosより前（できるだけ近い位置）で文の終わりを探す
  // 正規表現をリセット
  SENTENCE_END_REGEX.lastIndex = 0;
  
  let bestMatch = 0;
  let bestDistance = Infinity;
  let match: RegExpExecArray | null;
  
  while ((match = SENTENCE_END_REGEX.exec(searchText)) !== null) {
    const matchEnd = match.index + match[0].length;
    // preferredPosより前で、できるだけ近い位置
    if (matchEnd <= preferredPos) {
      const distance = preferredPos - matchEnd;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = matchEnd;
      }
    }
  }

  return absoluteStart + (bestMatch > 0 ? bestMatch : preferredPos);
}

/**
 * 最適な文の開始位置を見つける（オーバーラップ用）
 * @param text 全体テキスト
 * @param preferredStart 希望する開始位置
 * @param maxEnd 最大終了位置
 * @param currentStart 現在の開始位置（進行を保証するため）
 * @returns 絶対位置での文の開始、またはnull（文の終わりが見つからない場合）
 */
function findBestSentenceStart(
  text: string,
  preferredStart: number,
  maxEnd: number,
  currentStart: number
): number | null {
  // preferredStartからmaxEndまでの範囲で、最初の文の終わりを見つける
  const searchStart = Math.max(0, preferredStart - 50);
  const searchText = text.substring(searchStart, maxEnd);
  const relativePreferredStart = preferredStart - searchStart;
  
  // 正規表現をリセット
  SENTENCE_END_REGEX.lastIndex = 0;
  
  let match: RegExpExecArray | null;
  let bestMatch: number | null = null;
  
  while ((match = SENTENCE_END_REGEX.exec(searchText)) !== null) {
    const matchEnd = match.index + match[0].length;
    // preferredStart以降で最初の文の終わり
    if (matchEnd >= relativePreferredStart) {
      bestMatch = searchStart + matchEnd;
      break; // 最初の一致で十分
    }
  }

  // 見つかった場合は返す
  if (bestMatch !== null) {
    // 文の終わりが見つかった場合は、その位置をそのまま使用
    // ただし、前回の位置より確実に進むようにする（最小1文字）
    // また、preferredStartより後ろにあることを確認
    const minProgress = Math.max(1, Math.floor((maxEnd - currentStart) * 0.05));
    const result = Math.max(currentStart + minProgress, Math.max(preferredStart, bestMatch));
    // maxEndを超えないようにする
    const finalResult = Math.min(result, maxEnd - 1);
    
    // 最終確認: currentStartより確実に進んでいることを確認
    if (finalResult <= currentStart) {
      return null; // 進行がない場合はnullを返してフォールバック
    }
    
    return finalResult;
  }
  
  // 見つからない場合はnullを返す（固定サイズチャンキングにフォールバック）
  return null;
}
