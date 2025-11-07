/**
 * 埋め込みベクトル生成のための抽象化レイヤー（Gemini Embeddings API使用）
 * キャッシュ機能付きで最適化
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDeploymentInfo } from './deployment-info';
// embedding-cacheはアーカイブに移動済み。簡易キャッシュ実装を使用

// 簡易キャッシュ（メモリ内のみ）
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();

// 🔧 キャッシュをクリアする関数（BOM問題のデバッグ用）
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
  console.log('🔧 [Cache] Embedding cache cleared');
}

let genAI: GoogleGenerativeAI | null = null;
let embeddingModel: any | null = null;

export async function getEmbeddings(text: string): Promise<number[]> {
  const startTime = Date.now();
  
  if (!text || typeof text !== 'string') {
    throw new Error('テキストが空または文字列ではありません');
  }
  
  // 🔍 原因特定: BOM検出ログを追加（255を超える文字のチェックを最初に実行）
  const originalFirstCharCode = text.length > 0 ? text.charCodeAt(0) : -1;
  const originalHasBOM = text.includes('\uFEFF') || originalFirstCharCode === 0xFEFF;
  const originalHasInvalidChar = originalFirstCharCode > 255;
  
  // 🔍 255を超える文字のチェックを最初に実行（エラーメッセージでは「character at index 0 has a value of 65279」と表示されるため）
  if (originalHasInvalidChar) {
    const deploymentInfo = getDeploymentInfo();
    console.error(`🚨 [INVALID CHAR DETECTED IN getEmbeddings] Input text has invalid character (> 255):`, {
      deploymentTime: deploymentInfo.deploymentTime,
      deploymentTimestamp: deploymentInfo.deploymentTimestamp,
      uptime: deploymentInfo.uptime,
      firstCharCode: originalFirstCharCode,
      firstChar: text.charAt(0),
      isBOM: originalFirstCharCode === 0xFEFF,
      textLength: text.length,
      textPreview: text.substring(0, 50),
      charCodes: Array.from(text.substring(0, 10)).map(c => c.charCodeAt(0)),
      hexCode: `0x${originalFirstCharCode.toString(16).toUpperCase()}`
    });
  }
  
  if (originalHasBOM && !originalHasInvalidChar) {
    console.error(`🚨 [BOM DETECTED IN getEmbeddings] Input text has BOM:`, {
      firstCharCode: originalFirstCharCode,
      firstChar: text.charAt(0),
      textLength: text.length,
      textPreview: text.substring(0, 50),
      charCodes: Array.from(text.substring(0, 10)).map(c => c.charCodeAt(0))
    });
  }
  
  // BOM文字（U+FEFF）を確実に削除（埋め込み生成エラーを防ぐため）
  // 複数の方法でBOMを除去して確実性を高める
  // 1. 文字列全体からBOMを削除
  text = text.replace(/\uFEFF/g, '');
  // 2. 文字列の先頭からBOMを削除（念のため）
  if (text.length > 0 && text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  // 3. trim()の前に再度BOMを削除
  text = text.replace(/^\uFEFF+|\uFEFF+$/g, '').trim();
  
  // 🔍 原因特定: 削除後の確認
  const afterFirstCharCode = text.length > 0 ? text.charCodeAt(0) : -1;
  if (originalHasBOM) {
    console.warn(`🔍 [BOM REMOVED IN getEmbeddings] BOM removed:`, {
      beforeFirstCharCode: originalFirstCharCode,
      afterFirstCharCode: afterFirstCharCode,
      beforeLength: text.length,
      afterLength: text.length
    });
  }
  
  // 空のテキストの場合はデフォルトテキストを使用
  if (text.length === 0) {
    text = 'No content available';
  }

  // 🔧 キャッシュキーをBOM除去後のテキストで生成（BOM除去処理の後にキャッシュキーを生成）
  // 🔧 キャッシュキー生成前に再度BOMを除去して確実性を高める
  const cleanTextForCache = text.replace(/\uFEFF/g, '').trim();
  const cacheKey = `embedding:${cleanTextForCache.substring(0, 100)}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) { // 15分TTL
    const duration = Date.now() - startTime;
    if (duration > 100) {
      console.log(`🚀 埋め込みベクトルをキャッシュから取得 (${duration}ms): ${cleanTextForCache.substring(0, 50)}...`);
    }
    // 🔧 キャッシュから取得した場合もBOM除去処理を実行（念のため）
    // キャッシュキーは既にBOM除去後のテキストで生成されているが、念のため再度チェック
    const finalCleanText = cleanTextForCache.replace(/\uFEFF/g, '');
    if (finalCleanText !== cleanTextForCache) {
      console.warn(`🔍 [BOM REMOVED FROM CACHED] キャッシュから取得したテキストからBOMを除去しました:`, {
        beforeLength: cleanTextForCache.length,
        afterLength: finalCleanText.length,
        preview: cleanTextForCache.substring(0, 50)
      });
    }
    // 🔍 キャッシュから取得した場合でも、テキストにBOMが含まれていないか確認
    const cacheTextFirstCharCode = cleanTextForCache.length > 0 ? cleanTextForCache.charCodeAt(0) : -1;
    if (cacheTextFirstCharCode > 255) {
      console.error(`🚨 [CACHE TEXT HAS INVALID CHAR] キャッシュキーに使用したテキストの先頭文字コードが255を超えています: ${cacheTextFirstCharCode}`);
      // キャッシュを無効化して再生成
      embeddingCache.delete(cacheKey);
      console.warn(`🔧 [Cache] Invalid cache entry deleted, will regenerate`);
    } else {
      return cached.embedding;
    }
  }

  // 🔧 最終的なBOM除去: getGeminiEmbeddingsに渡す直前に、BOM文字（0xFEFF）のみを削除
  // 注意: 255を超える文字（日本語など）は削除しない
  let finalTextForEmbedding = text;
  // BOM文字（0xFEFF）のみを削除
  if (finalTextForEmbedding.length > 0 && finalTextForEmbedding.charCodeAt(0) === 0xFEFF) {
    console.error(`🚨 [FINAL BOM REMOVAL IN getEmbeddings] Removing BOM character (0xFEFF) from start of text`);
    finalTextForEmbedding = finalTextForEmbedding.replace(/\uFEFF/g, '').trim();
  }
  
  if (finalTextForEmbedding.length === 0) {
    finalTextForEmbedding = 'No content available';
  }
  
  // 🔍 最終確認ログ: getGeminiEmbeddingsに渡す直前のテキストを確認
  const finalFirstCharCodeForEmbedding = finalTextForEmbedding.length > 0 ? finalTextForEmbedding.charCodeAt(0) : -1;
  if (finalFirstCharCodeForEmbedding === 0xFEFF) {
    console.error(`🚨 [FINAL CHECK FAILED IN getEmbeddings] Text still has BOM character (0xFEFF) at start`);
    // 最後の手段: BOM文字を削除
    finalTextForEmbedding = finalTextForEmbedding.replace(/\uFEFF/g, '').trim();
    if (finalTextForEmbedding.length === 0) {
      finalTextForEmbedding = 'No content available';
    }
  }
  
  // 🔍 デバッグログ: getGeminiEmbeddingsに渡す直前のテキストを確認
  if (text !== finalTextForEmbedding) {
    console.warn(`🔍 [TEXT MODIFIED IN getEmbeddings] Text was modified before getGeminiEmbeddings:`, {
      originalLength: text.length,
      finalLength: finalTextForEmbedding.length,
      originalFirstCharCode: text.length > 0 ? text.charCodeAt(0) : -1,
      finalFirstCharCode: finalTextForEmbedding.length > 0 ? finalTextForEmbedding.charCodeAt(0) : -1,
      originalPreview: text.substring(0, 50),
      finalPreview: finalTextForEmbedding.substring(0, 50)
    });
  }
  
  // Phase 0A-4: 埋め込み生成の開始ログ（本番環境でも遅延検知のため）
  const generationStartTime = Date.now();
  console.log(`🔍 埋め込みベクトル生成中: ${finalTextForEmbedding.substring(0, 50)}...`);
  
  // Gemini Embeddings APIを使用
  const EMBEDDING_TIMEOUT = 30000; // 30秒
  const embedding = await Promise.race([
    getGeminiEmbeddings(finalTextForEmbedding),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Embedding generation timeout after ${EMBEDDING_TIMEOUT}ms`)), EMBEDDING_TIMEOUT)
    )
  ]);
  
  const generationDuration = Date.now() - generationStartTime;
  // Phase 0A-4: 遅い埋め込み生成を警告（1秒以上）
  if (generationDuration > 1000) {
    console.warn(`⚠️ [Embedding] Slow generation: ${generationDuration}ms for text: ${text.substring(0, 100)}...`);
  }
  
  // キャッシュに保存（BOM除去後のテキストで生成したキャッシュキーを使用）
  // 🔧 キャッシュに保存する前に、テキストにBOMが含まれていないか確認
  const textForCache = cleanTextForCache.replace(/\uFEFF/g, '').trim();
  const finalCacheKey = `embedding:${textForCache.substring(0, 100)}`;
  const textFirstCharCode = textForCache.length > 0 ? textForCache.charCodeAt(0) : -1;
  if (textFirstCharCode > 255) {
    console.error(`🚨 [CACHE KEY TEXT HAS INVALID CHAR] キャッシュキーに使用するテキストの先頭文字コードが255を超えています: ${textFirstCharCode}`);
    // 先頭文字を削除して再生成
    const fixedText = textForCache.slice(1).trim();
    const fixedCacheKey = `embedding:${fixedText.substring(0, 100)}`;
    embeddingCache.set(fixedCacheKey, { embedding, timestamp: Date.now() });
  } else {
    embeddingCache.set(finalCacheKey, { embedding, timestamp: Date.now() });
  }
  
  // キャッシュサイズが大きくなりすぎないように制限（1000エントリ）
  if (embeddingCache.size > 1000) {
    const firstKey = embeddingCache.keys().next().value;
    embeddingCache.delete(firstKey);
  }
  
  const totalDuration = Date.now() - startTime;
  if (totalDuration > 1000) {
    console.log(`✅ [Embedding] Total time: ${totalDuration}ms (generation: ${generationDuration}ms, cache: ${totalDuration - generationDuration}ms)`);
  }
  
  return embedding;
}

// デフォルトエクスポートも追加
export default { getEmbeddings };

async function getGeminiEmbeddings(text: string): Promise<number[]> {
  // Gemini Embeddings API を初期化
  if (!genAI) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  
  if (!embeddingModel) {
    embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  }
  
  // 🔍 原因特定: BOM検出ログを追加（255を超える文字のチェックを最初に実行）
  const originalFirstCharCode = text.length > 0 ? text.charCodeAt(0) : -1;
  const originalHasBOM = text.includes('\uFEFF') || originalFirstCharCode === 0xFEFF;
  const originalHasInvalidChar = originalFirstCharCode > 255;
  
  // 🔍 255を超える文字のチェックを最初に実行（エラーメッセージでは「character at index 0 has a value of 65279」と表示されるため）
  if (originalHasInvalidChar) {
    const deploymentInfo = getDeploymentInfo();
    console.error(`🚨 [INVALID CHAR DETECTED IN getGeminiEmbeddings] Input text has invalid character (> 255):`, {
      deploymentTime: deploymentInfo.deploymentTime,
      deploymentTimestamp: deploymentInfo.deploymentTimestamp,
      uptime: deploymentInfo.uptime,
      firstCharCode: originalFirstCharCode,
      firstChar: text.charAt(0),
      isBOM: originalFirstCharCode === 0xFEFF,
      textLength: text.length,
      textPreview: text.substring(0, 50),
      charCodes: Array.from(text.substring(0, 10)).map(c => c.charCodeAt(0)),
      hexCode: `0x${originalFirstCharCode.toString(16).toUpperCase()}`
    });
  }
  
  if (originalHasBOM && !originalHasInvalidChar) {
    console.error(`🚨 [BOM DETECTED IN getGeminiEmbeddings] Input text has BOM:`, {
      firstCharCode: originalFirstCharCode,
      firstChar: text.charAt(0),
      textLength: text.length,
      textPreview: text.substring(0, 50),
      charCodes: Array.from(text.substring(0, 10)).map(c => c.charCodeAt(0))
    });
  }
  
  // BOM文字（U+FEFF）を確実に削除（埋め込み生成エラーを防ぐため）
  // 複数の方法でBOMを除去して確実性を高める
  let cleanText = text;
  // 1. 文字列全体からBOMを削除
  cleanText = cleanText.replace(/\uFEFF/g, '');
  // 2. 文字列の先頭からBOMを削除（念のため）
  if (cleanText.length > 0 && cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }
  // 3. trim()の前に再度BOMを削除
  cleanText = cleanText.replace(/^\uFEFF+|\uFEFF+$/g, '').trim();
  
  // 🔍 原因特定: 削除後の確認
  const afterFirstCharCode = cleanText.length > 0 ? cleanText.charCodeAt(0) : -1;
  if (originalHasBOM) {
    console.warn(`🔍 [BOM REMOVED IN getGeminiEmbeddings] BOM removed:`, {
      beforeFirstCharCode: originalFirstCharCode,
      afterFirstCharCode: afterFirstCharCode,
      beforeLength: text.length,
      afterLength: cleanText.length,
      textPreview: cleanText.substring(0, 50)
    });
  }
  
  // 空文字列の場合はデフォルトテキストを使用
  if (cleanText.length === 0) {
    cleanText = 'No content available';
  }
  
  // 🔍 最終確認: embedContentに渡す直前にBOMを再チェック
  const finalFirstCharCode = cleanText.length > 0 ? cleanText.charCodeAt(0) : -1;
  const finalHasBOM = cleanText.includes('\uFEFF') || finalFirstCharCode === 0xFEFF;
  
  // 🔧 常にBOMを除去（検出されなくても念のため）
  if (finalHasBOM || finalFirstCharCode > 255) {
    console.error(`🚨 [BOM DETECTED BEFORE embedContent] BOM detected before embedContent call:`, {
      firstCharCode: finalFirstCharCode,
      hasBOM: finalHasBOM,
      textLength: cleanText.length,
      textPreview: cleanText.substring(0, 50),
      charCodes: Array.from(cleanText.substring(0, 10)).map(c => c.charCodeAt(0))
    });
    // 強制的にBOMを削除（複数の方法で確実に除去）
    cleanText = cleanText.replace(/\uFEFF/g, '');
    if (cleanText.length > 0 && cleanText.charCodeAt(0) === 0xFEFF) {
      cleanText = cleanText.slice(1);
    }
    cleanText = cleanText.replace(/^\uFEFF+|\uFEFF+$/g, '').trim();
    // BOM文字（0xFEFF）のみを削除（255を超える文字は日本語など正常な文字なので削除しない）
    if (cleanText.length > 0 && cleanText.charCodeAt(0) === 0xFEFF) {
      console.error(`🚨 [BOM FIRST CHAR] First character is BOM (0xFEFF), removing...`);
      cleanText = cleanText.replace(/\uFEFF/g, '').trim();
    }
    if (cleanText.length === 0) {
      cleanText = 'No content available';
    }
    console.warn(`🔍 [BOM FORCE REMOVED] BOM forcefully removed before embedContent:`, {
      afterFirstCharCode: cleanText.length > 0 ? cleanText.charCodeAt(0) : -1,
      afterLength: cleanText.length,
      afterPreview: cleanText.substring(0, 50)
    });
  }
  
  // 🔧 最終確認: embedContentに渡す直前に再度BOMをチェック
  const veryFinalFirstCharCode = cleanText.length > 0 ? cleanText.charCodeAt(0) : -1;
  if (veryFinalFirstCharCode === 0xFEFF) {
    console.error(`🚨 [CRITICAL] First character is still BOM (0xFEFF) before embedContent`);
    // BOM文字を強制的に削除
    cleanText = cleanText.replace(/\uFEFF/g, '').trim();
    if (cleanText.length === 0) {
      cleanText = 'No content available';
    }
  }
  
  // 🔧 最終的なBOM除去: embedContentに渡す直前に、BOM文字（0xFEFF）のみを削除
  // 注意: 255を超える文字（日本語など）は削除しない
  let finalText = cleanText;
  // BOM文字（0xFEFF）のみを削除
  if (finalText.length > 0 && finalText.charCodeAt(0) === 0xFEFF) {
    console.error(`🚨 [FINAL BOM REMOVAL] Removing BOM character (0xFEFF) from start of text`);
    finalText = finalText.replace(/\uFEFF/g, '').trim();
  }
  
  if (finalText.length === 0) {
    finalText = 'No content available';
  }
  
  // 🔍 最終確認ログ: embedContentに渡す直前のテキストを確認
  const lastCheckFirstCharCode = finalText.length > 0 ? finalText.charCodeAt(0) : -1;
  if (lastCheckFirstCharCode === 0xFEFF) {
    console.error(`🚨 [FINAL CHECK FAILED] Text still has BOM character (0xFEFF) at start`);
    // 最後の手段: BOM文字を削除
    finalText = finalText.replace(/\uFEFF/g, '').trim();
    if (finalText.length === 0) {
      finalText = 'No content available';
    }
  }
  
  // 🔍 デバッグログ: embedContentに渡す直前のテキストを確認
  if (cleanText !== finalText) {
    console.warn(`🔍 [TEXT MODIFIED] Text was modified before embedContent:`, {
      originalLength: cleanText.length,
      finalLength: finalText.length,
      originalFirstCharCode: cleanText.length > 0 ? cleanText.charCodeAt(0) : -1,
      finalTextFirstCharCode: finalText.length > 0 ? finalText.charCodeAt(0) : -1,
      originalPreview: cleanText.substring(0, 50),
      finalPreview: finalText.substring(0, 50)
    });
  }
  
  try {
    const result = await embeddingModel.embedContent(finalText);
    
    // Gemini Embeddings API のレスポンス形式に応じて取得
    // text-embedding-004 の場合は result.embedding.values を返す
    if (result.embedding && 'values' in result.embedding) {
      return result.embedding.values as number[];
    } else {
      // 互換性のため、異なるレスポンス形式にも対応
      return result.embedding as any;
    }
  } catch (error) {
    console.error(`❌ [Embedding] Failed to generate embedding via Gemini API:`, error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
  }
}
