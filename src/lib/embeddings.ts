/**
 * 埋め込みベクトル生成のための抽象化レイヤー（Gemini Embeddings API使用）
 * キャッシュ機能付きで最適化
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
// embedding-cacheはアーカイブに移動済み。簡易キャッシュ実装を使用

// 簡易キャッシュ（メモリ内のみ）
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();

let genAI: GoogleGenerativeAI | null = null;
let embeddingModel: any | null = null;

export async function getEmbeddings(text: string): Promise<number[]> {
  const startTime = Date.now();
  
  if (!text || typeof text !== 'string') {
    throw new Error('テキストが空または文字列ではありません');
  }
  
  // 🔍 原因特定: BOM文字の有無を確認
  const originalFirstCharCode = text.charCodeAt(0);
  const hasBOM = text.includes('\uFEFF') || originalFirstCharCode === 0xFEFF;
  if (hasBOM) {
    console.error(`🚨 [BOM DETECTED] getEmbeddings received text with BOM:`, {
      firstCharCode: originalFirstCharCode,
      firstChar: text.charAt(0),
      textLength: text.length,
      textPreview: text.substring(0, 50),
      charCodes: Array.from(text.substring(0, 10)).map(c => c.charCodeAt(0)),
      stackTrace: new Error().stack
    });
  }
  
  // BOM文字（U+FEFF）を削除（埋め込み生成エラーを防ぐため）
  const beforeClean = text;
  text = text.replace(/\uFEFF/g, '');
  
  // 🔍 原因特定: 削除後の確認
  if (beforeClean !== text) {
    console.warn(`🔍 [BOM REMOVED] getEmbeddings removed BOM:`, {
      beforeLength: beforeClean.length,
      afterLength: text.length,
      beforeFirstChar: beforeClean.charCodeAt(0),
      afterFirstChar: text.charCodeAt(0)
    });
  }
  
  // 空のテキストの場合はデフォルトテキストを使用
  if (text.trim().length === 0) {
    text = 'No content available';
  }

  // 簡易キャッシュ（メモリ内のみ）
  const cacheKey = `embedding:${text.substring(0, 100)}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) { // 15分TTL
    const duration = Date.now() - startTime;
    if (duration > 100) {
      console.log(`🚀 埋め込みベクトルをキャッシュから取得 (${duration}ms): ${text.substring(0, 50)}...`);
    }
    return cached.embedding;
  }

  // Phase 0A-4: 埋め込み生成の開始ログ（本番環境でも遅延検知のため）
  const generationStartTime = Date.now();
  console.log(`🔍 埋め込みベクトル生成中: ${text.substring(0, 50)}...`);
  
  // Gemini Embeddings APIを使用
  const EMBEDDING_TIMEOUT = 30000; // 30秒
  const embedding = await Promise.race([
    getGeminiEmbeddings(text),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Embedding generation timeout after ${EMBEDDING_TIMEOUT}ms`)), EMBEDDING_TIMEOUT)
    )
  ]);
  
  const generationDuration = Date.now() - generationStartTime;
  // Phase 0A-4: 遅い埋め込み生成を警告（1秒以上）
  if (generationDuration > 1000) {
    console.warn(`⚠️ [Embedding] Slow generation: ${generationDuration}ms for text: ${text.substring(0, 100)}...`);
  }
  
  // キャッシュに保存
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
  
  // 🔍 原因特定: getGeminiEmbeddingsに渡されるテキストを確認
  const receivedFirstCharCode = text.charCodeAt(0);
  const receivedHasBOM = text.includes('\uFEFF') || receivedFirstCharCode === 0xFEFF;
  if (receivedHasBOM) {
    console.error(`🚨 [BOM DETECTED] getGeminiEmbeddings received text with BOM:`, {
      firstCharCode: receivedFirstCharCode,
      firstChar: text.charAt(0),
      textLength: text.length,
      textPreview: text.substring(0, 50),
      charCodes: Array.from(text.substring(0, 10)).map(c => c.charCodeAt(0)),
      stackTrace: new Error().stack
    });
  }
  
  // BOM文字（U+FEFF）を削除（埋め込み生成エラーを防ぐため）
  // 複数の方法でBOM文字を削除（確実に削除するため）
  let cleanText = text;
  const beforeClean = text;
  
  // 方法1: 正規表現で削除
  cleanText = cleanText.replace(/\uFEFF/g, '');
  // 方法2: 先頭のBOM文字を直接削除
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }
  // 方法3: trim()で削除（BOM文字が含まれる場合）
  cleanText = cleanText.trim();
  
  // 🔍 原因特定: 削除後の確認
  const afterCleanFirstCharCode = cleanText.charCodeAt(0);
  if (beforeClean !== cleanText) {
    console.warn(`🔍 [BOM REMOVED] getGeminiEmbeddings removed BOM:`, {
      beforeFirstCharCode: beforeClean.charCodeAt(0),
      afterFirstCharCode: afterCleanFirstCharCode,
      beforeLength: beforeClean.length,
      afterLength: cleanText.length,
      beforePreview: beforeClean.substring(0, 50),
      afterPreview: cleanText.substring(0, 50)
    });
  }
  
  // 🔍 原因特定: embedContent呼び出し直前の最終確認（BOM文字のみをチェック）
  // 注意: 日本語文字（>255）は正常なので、BOM文字（65279）のみをチェック
  if (cleanText.charCodeAt(0) === 0xFEFF || cleanText.includes('\uFEFF')) {
    console.error(`🚨 [CRITICAL] BOM still present before embedContent!`, {
      firstCharCode: cleanText.charCodeAt(0),
      firstChar: cleanText.charAt(0),
      textLength: cleanText.length,
      textPreview: cleanText.substring(0, 50),
      charCodes: Array.from(cleanText.substring(0, 10)).map(c => c.charCodeAt(0)),
      bomIndex: cleanText.indexOf('\uFEFF')
    });
    // 強制的にBOM文字を削除（先頭と全体）
    cleanText = cleanText.replace(/^\uFEFF+/, '').replace(/\uFEFF/g, '');
  }
  
  try {
    // 🔍 原因特定: embedContent呼び出し直前の最終チェック
    // Gemini APIのembedContentはByteStringを期待しているため、BOM文字を確実に削除
    // Buffer経由で処理することで、BOM文字を確実に除去
    let finalCleanText = cleanText.replace(/^\uFEFF+/, '').replace(/\uFEFF/g, '');
    
    // Buffer経由でBOM文字を確実に除去（UTF-8バイト列として処理）
    // BOM文字はUTF-8でEF BB BF (3バイト)として表現される
    const textBuffer = Buffer.from(finalCleanText, 'utf8');
    // BOM文字のUTF-8表現（EF BB BF）を削除
    const bomBytes = Buffer.from([0xEF, 0xBB, 0xBF]);
    let cleanedBuffer = textBuffer;
    if (textBuffer.subarray(0, 3).equals(bomBytes)) {
      cleanedBuffer = textBuffer.subarray(3);
      console.warn(`🔍 [BOM REMOVED] Removed BOM bytes (EF BB BF) from buffer`);
    }
    // Bufferから再度文字列に変換（BOM文字が確実に除去されている）
    finalCleanText = cleanedBuffer.toString('utf8');
    
    // 🔍 原因特定: embedContent呼び出し時のテキストをログ
    console.log(`🔍 [embedContent CALL] Calling embedContent with text:`, {
      length: finalCleanText.length,
      firstCharCode: finalCleanText.charCodeAt(0),
      preview: finalCleanText.substring(0, 50),
      hasBOM: finalCleanText.includes('\uFEFF'),
      bomIndex: finalCleanText.indexOf('\uFEFF'),
      bufferLength: cleanedBuffer.length,
      bufferFirstBytes: Array.from(cleanedBuffer.subarray(0, 10))
    });
    
    // 最終チェック: BOM文字が残っていないことを確認
    if (finalCleanText.includes('\uFEFF')) {
      console.error(`🚨 [FINAL CHECK] BOM still present! Forcing removal...`, {
        bomIndex: finalCleanText.indexOf('\uFEFF'),
        textLength: finalCleanText.length
      });
      // 強制的に全BOM文字を削除
      const forceCleaned = finalCleanText.replace(/\uFEFF/g, '');
      return await embeddingModel.embedContent(forceCleaned);
    }
    
    const result = await embeddingModel.embedContent(finalCleanText);
    
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
