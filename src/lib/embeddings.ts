/**
 * 埋め込みベクトル生成のための抽象化レイヤー（Gemini Embeddings API使用）
 * キャッシュ機能付きで最適化
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDeploymentInfo } from './deployment-info';
import { removeBOM, checkStringForBOM } from './bom-utils';
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
  
  const originalFirstCharCode = text.length > 0 ? text.charCodeAt(0) : -1;
  const originalHasBOM = text.includes('\uFEFF') || originalFirstCharCode === 0xFEFF;

  if (originalHasBOM) {
    console.error(`🚨 [BOM DETECTED IN getEmbeddings] Input text has BOM:`, {
      firstCharCode: originalFirstCharCode,
      firstChar: text.charAt(0),
      textLength: text.length,
      textPreview: text.substring(0, 50),
      charCodes: Array.from(text.substring(0, 10)).map(c => c.charCodeAt(0))
    });
  }

  const cleanedText = removeBOM(text).trim();
  if (cleanedText !== text) {
    console.warn(`🔍 [BOM REMOVED IN getEmbeddings] BOM removed from input text`, {
      beforeLength: text.length,
      afterLength: cleanedText.length,
      beforeFirstCharCode: originalFirstCharCode,
      afterFirstCharCode: cleanedText.length > 0 ? cleanedText.charCodeAt(0) : -1
    });
  }
  text = cleanedText;
  
  const afterFirstCharCode = text.length > 0 ? text.charCodeAt(0) : -1;
  
  // 空のテキストの場合はデフォルトテキストを使用
  if (text.length === 0) {
    text = 'No content available';
  }

  // 🔧 キャッシュキーをBOM除去後のテキストで生成
  const cleanTextForCache = text;
  const cacheKey = `embedding:${cleanTextForCache.substring(0, 100)}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) { // 15分TTL
    const duration = Date.now() - startTime;
    if (duration > 100) {
      console.log(`🚀 埋め込みベクトルをキャッシュから取得 (${duration}ms): ${cleanTextForCache.substring(0, 50)}...`);
    }
    return cached.embedding;
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

  console.log(`ℹ️ [EMBED TEXT STATUS]`, {
    source: 'getEmbeddings',
    firstCharCode: finalTextForEmbedding.length > 0 ? finalTextForEmbedding.charCodeAt(0) : -1,
    length: finalTextForEmbedding.length,
    preview: finalTextForEmbedding.substring(0, 50)
  });
  
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
  embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
  
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

  const originalFirstCharCode = text.length > 0 ? text.charCodeAt(0) : -1;
  const originalHasBOM = text.includes('\uFEFF') || originalFirstCharCode === 0xFEFF;

  if (originalHasBOM) {
    console.error(`🚨 [BOM DETECTED IN getGeminiEmbeddings] Input text has BOM:`, {
      firstCharCode: originalFirstCharCode,
      firstChar: text.charAt(0),
      textLength: text.length,
      textPreview: text.substring(0, 50),
      charCodes: Array.from(text.substring(0, 10)).map(c => c.charCodeAt(0))
    });
  }

  let cleanText = removeBOM(text).trim();
  if (cleanText !== text) {
    console.warn(`🔍 [BOM REMOVED IN getGeminiEmbeddings] BOM removed from input text`, {
      beforeLength: text.length,
      afterLength: cleanText.length,
      beforeFirstCharCode: originalFirstCharCode,
      afterFirstCharCode: cleanText.length > 0 ? cleanText.charCodeAt(0) : -1
    });
  }

  if (cleanText.length === 0) {
    cleanText = 'No content available';
  }

  if (cleanText.length > 0 && cleanText.charCodeAt(0) === 0xFEFF) {
    console.error(`🚨 [FINAL BOM REMOVAL] Removing BOM character (0xFEFF) from start of text`);
    cleanText = removeBOM(cleanText).trim();
    if (cleanText.length === 0) {
      cleanText = 'No content available';
    }
  }

  const finalFirstCharCode = cleanText.length > 0 ? cleanText.charCodeAt(0) : -1;
  if (originalHasBOM || finalFirstCharCode === 0xFEFF) {
    console.warn(`🔍 [TEXT READY FOR embedContent]`, {
      finalLength: cleanText.length,
      finalFirstCharCode,
      preview: cleanText.substring(0, 50)
    });
  }

  console.log(`ℹ️ [EMBED TEXT STATUS]`, {
    source: 'getGeminiEmbeddings',
    firstCharCode: cleanText.length > 0 ? cleanText.charCodeAt(0) : -1,
    length: cleanText.length,
    preview: cleanText.substring(0, 50)
  });

  const requestPayload = {
    content: {
      role: 'user',
      parts: [{ text: cleanText }]
    }
  };

  console.log(`ℹ️ [EMBED REQUEST PAYLOAD]`, {
    role: requestPayload.content.role,
    partsCount: requestPayload.content.parts.length,
    partTypes: requestPayload.content.parts.map(part => ({
      hasText: typeof part.text === 'string',
      hasInlineData: 'inlineData' in part && part.inlineData !== undefined
    })),
    textPartPreview: cleanText.substring(0, 50),
    textPartLength: cleanText.length
  });

  try {
    const result = await embeddingModel.embedContent(requestPayload);
    
    // text-embedding-004 の場合は result.embedding.values を返す
    if (result.embedding && 'values' in result.embedding) {
      return result.embedding.values as number[];
    } else {
      // 互換性のため、異なるレスポンス形式にも対応
      return result.embedding as any;
    }
  } catch (error) {
    const bomDiagnostics = (() => {
      try {
        const checkResult = checkStringForBOM(cleanText);
        return {
          firstCharCode: cleanText.length > 0 ? cleanText.charCodeAt(0) : -1,
          length: cleanText.length,
          preview: cleanText.substring(0, 50),
          charCodes: Array.from(cleanText.substring(0, 10)).map(c => c.charCodeAt(0)),
          bomCheck: {
            hasBOM: checkResult.hasBOM,
            bomType: checkResult.bomType,
            bomIndex: checkResult.bomIndex,
            utf8BytesFirst: checkResult.utf8BytesFirst,
            utf8BytesLength: checkResult.utf8BytesLength
          }
        };
      } catch (diagError) {
        return { diagnosticsFailed: true, diagnosticsError: String(diagError) };
      }
    })();

    console.error(`❌ [Embedding] Failed to generate embedding via Gemini API:`, {
      errorMessage: error instanceof Error ? error.message : String(error),
      bomDiagnostics,
      requestPayloadSummary: {
        role: requestPayload.content.role,
        partsCount: requestPayload.content.parts.length,
        textPartLength: cleanText.length
      }
    });
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
  }
}
