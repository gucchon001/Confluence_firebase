/**
 * 埋め込みベクトル生成のための抽象化レイヤー（Gemini Embeddings API使用）
 * キャッシュ機能付きで最適化
 */
import { getDeploymentInfo } from './deployment-info';
import { removeBOM, checkStringForBOM } from './bom-utils';
import { appConfig } from '@/config/app-config';
import { EmbeddingConfig } from '@/config/ai-models-config';
import { GeminiApiKeyLeakedError, GeminiApiFatalError } from './gemini-api-errors';
// embedding-cacheはアーカイブに移動済み。簡易キャッシュ実装を使用

// 簡易キャッシュ（メモリ内のみ）
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();

// 🔧 キャッシュをクリアする関数（BOM問題のデバッグ用）
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

// 一元化された設定から埋め込みエンドポイントを構築
// 本番環境と合わせてv1エンドポイントを使用
const GEMINI_EMBEDDING_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1/models/${EmbeddingConfig.modelId}:embedContent`;

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
  
  // Phase 0A-4: 埋め込み生成の開始ログ（本番環境でも遅延検知のため）
  const generationStartTime = Date.now();
  
  // ⚡ 最適化: リトライ機構を追加（最大3回、指数バックオフ）
  // タイムアウトはcallGeminiEmbeddingApi内で10秒に設定されているため、ここではリトライのみを処理
  // 429エラー（レート制限）の特別処理を含むカスタムリトライ
  let retryCount = 0;
  const maxRetries = 3;
  let lastError: any = null;
  
  while (retryCount <= maxRetries) {
    try {
      // 429エラーの場合は、Retry-Afterヘッダーに従って待機
      if (lastError?.status === 429 && lastError?.retryAfter) {
        const retryAfterMs = lastError.retryAfter * 1000;
        console.warn(`⚠️ [Embedding] Rate limited (429), waiting ${retryAfterMs}ms before retry (attempt ${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryAfterMs));
        lastError = null; // リセット
      }
      
      const embedding = await getGeminiEmbeddings(finalTextForEmbedding);
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
      
      return embedding;
    } catch (error: any) {
      lastError = error;
      retryCount++;
      
      // 最大リトライ回数に達した場合はエラーをスロー
      if (retryCount > maxRetries) {
        throw error;
      }
      
      // リトライ不可能なエラーの場合は即座にスロー
      // 403エラー（APIキー漏洩）や400エラー（バッドリクエスト）はリトライ不可
      if (error?.status === 403 || error?.status === 400 || error?.status === 401) {
        throw error;
      }
      
      // 429エラー（レート制限）の場合は、Retry-Afterヘッダーを優先（次のループで処理）
      if (error?.status === 429) {
        // Retry-Afterヘッダーがない場合は、指数バックオフを使用
        if (!error?.retryAfter) {
          const baseDelay = 500;
          const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 5000);
          console.warn(`⚠️ [Embedding] Rate limited (429) without Retry-After, waiting ${delay}ms (attempt ${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        continue;
      }
      
      // その他のリトライ可能なエラーの場合は、指数バックオフで待機
      const baseDelay = 500;
      const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 5000);
      console.warn(`⚠️ [Embedding] Retrying after ${delay}ms (attempt ${retryCount}/${maxRetries}): ${error?.message || error}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // ここに到達することはないはずだが、型安全性のため
  throw lastError || new Error('Failed to generate embedding after retries');
  
}

// デフォルトエクスポートも追加
export default { getEmbeddings };

async function getGeminiEmbeddings(text: string): Promise<number[]> {
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

  const requestPayload = {
    content: {
      role: 'user',
      parts: [{ text: cleanText }]
    }
  };

  try {
    // リトライ機構付きで埋め込み生成を実行
    const embeddingValues = await callGeminiEmbeddingApiWithRetry(requestPayload);
    return embeddingValues;
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

async function callGeminiEmbeddingApi(payload: unknown): Promise<number[]> {
  // 統合設定ファイルからGemini APIキーを取得（型安全で検証済み）
  const rawApiKey = appConfig.gemini.apiKey;
  const apiKey = rawApiKey.trim();
  if (apiKey.length === 0) {
    throw new Error('GEMINI_API_KEY is empty after trimming');
  }

  // ⚡ 最適化: タイムアウトを10秒に短縮（60秒から変更）
  const EMBEDDING_API_TIMEOUT = 10000; // 10秒

  let response: Response;
  let responseBody: string | undefined;
  try {
    // AbortControllerを使用してタイムアウトを実装
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_API_TIMEOUT);

    try {
      response = await fetch(`${GEMINI_EMBEDDING_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      responseBody = await response.text();
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error(`Embedding API timeout after ${EMBEDDING_API_TIMEOUT}ms`);
      }
      throw fetchError;
    }
  } catch (networkError) {
    // ネットワークエラーやタイムアウトエラーはリトライ可能として扱う
    const errorMessage = networkError instanceof Error ? networkError.message : String(networkError);
    console.error('❌ [Embedding] Network error while calling Gemini REST API', {
      error: errorMessage
    });
    const retryableError = new Error(`Failed to call Gemini REST API: ${errorMessage}`);
    (retryableError as any).code = 'network_error';
    throw retryableError;
  }

  let json: any;
  try {
    json = responseBody ? JSON.parse(responseBody) : {};
  } catch (parseError) {
    console.error('❌ [Embedding] Failed to parse Gemini REST API response as JSON', {
      responseStatus: response.status,
      responseBody,
      parseError: parseError instanceof Error ? parseError.message : parseError
    });
    throw new Error(
      `Failed to parse Gemini REST API response: ${
        parseError instanceof Error ? parseError.message : String(parseError)
      }`
    );
  }

  if (!response.ok) {
    console.error('❌ [Embedding] Gemini REST API returned non-OK status', {
      status: response.status,
      statusText: response.statusText,
      responseJson: json
    });
    
    // 403エラー（APIキー漏洩）の場合は特別なエラーを投げる（リトライ不可）
    if (response.status === 403) {
      const errorMessage = json?.error?.message || json?.message || 'API key was reported as leaked';
      const isLeakedError = 
        errorMessage.toLowerCase().includes('leaked') ||
        errorMessage.toLowerCase().includes('permission_denied');
      
      if (isLeakedError) {
        throw new GeminiApiKeyLeakedError(
          `Gemini APIキーが漏洩として報告されました。新しいAPIキーを生成してGitHub Secrets（GEMINI_API_KEY）を更新してください。詳細: ${errorMessage}`,
          { status: response.status, responseJson: json }
        );
      }
    }
    
    // 429エラー（レート制限）の場合はリトライ可能として扱う
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const errorMessage = json?.error?.message || json?.message || 'Rate limit exceeded';
      const error = new Error(`Gemini REST API rate limit (429): ${errorMessage}`);
      (error as any).code = 'rate_limit_error';
      (error as any).status = 429;
      (error as any).retryAfter = retryAfter ? parseInt(retryAfter) : null;
      throw error;
    }
    
    // 400, 401エラーはリトライ不可（致命的なエラー）
    if (response.status === 400 || response.status === 401) {
      throw new GeminiApiFatalError(
        `Gemini REST API error ${response.status}: ${JSON.stringify(json)}`,
        response.status,
        { responseJson: json }
      );
    }
    
    // 500番台のエラーはリトライ可能として扱う
    if (response.status >= 500) {
      const error = new Error(`Gemini REST API server error ${response.status}: ${JSON.stringify(json)}`);
      (error as any).code = 'server_error';
      (error as any).status = response.status;
      throw error;
    }
    
    // その他のエラーはリトライ不可として扱う
    throw new Error(
      `Gemini REST API error ${response.status}: ${JSON.stringify(json)}`
    );
  }

  const embeddingValues = json?.embedding?.values;
  if (!Array.isArray(embeddingValues)) {
    console.error('❌ [Embedding] Gemini REST API response missing embedding values', {
      responseJson: json
    });
    throw new Error('Gemini REST API response missing embedding values');
  }

  return embeddingValues as number[];
}

/**
 * リトライ機構付きのGemini Embeddings API呼び出し
 * 指数バックオフによるリトライ（最大3回）、429エラー（レート制限）の特別処理、タイムアウトエラーのリトライを実装
 * 
 * @param payload APIリクエストペイロード
 * @param maxRetries 最大リトライ回数（デフォルト: 3）
 * @returns 埋め込みベクトル
 */
async function callGeminiEmbeddingApiWithRetry(
  payload: unknown,
  maxRetries: number = 3
): Promise<number[]> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const embeddingValues = await callGeminiEmbeddingApi(payload);
      const duration = Date.now() - startTime;
      
      // 成功した場合、リトライ回数をログに記録
      if (attempt > 0) {
        console.log(`✅ [Embedding] Successfully generated embedding after ${attempt} retry(ies) (${duration}ms)`);
      }
      
      return embeddingValues;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // リトライ不可なエラー（403, 400, 401など）は即座にスロー
      if (error instanceof GeminiApiKeyLeakedError || error instanceof GeminiApiFatalError) {
        throw error;
      }
      
      // リトライ可能なエラーの場合
      const errorCode = (error as any).code;
      const errorStatus = (error as any).status;
      
      // 429エラー（レート制限）の特別処理
      if (errorStatus === 429 || errorCode === 'rate_limit_error') {
        const retryAfter = (error as any).retryAfter;
        const waitTime = retryAfter 
          ? retryAfter * 1000 
          : Math.pow(2, attempt) * 1000; // 指数バックオフ: 1秒, 2秒, 4秒
        
        if (attempt < maxRetries) {
          console.warn(`⚠️ [Embedding] Rate limited (429), retrying after ${waitTime}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      // タイムアウトエラーのリトライ
      if (error instanceof Error && (
        error.message.includes('timeout') || 
        error.message.includes('AbortError') ||
        error.name === 'AbortError'
      )) {
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 指数バックオフ: 1秒, 2秒, 4秒
          console.warn(`⚠️ [Embedding] Timeout error, retrying after ${waitTime}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      // ネットワークエラーのリトライ
      if (errorCode === 'network_error') {
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 指数バックオフ: 1秒, 2秒, 4秒
          console.warn(`⚠️ [Embedding] Network error, retrying after ${waitTime}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      // 500番台エラー（サーバーエラー）のリトライ
      if (errorStatus >= 500 || errorCode === 'server_error') {
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 指数バックオフ: 1秒, 2秒, 4秒
          console.warn(`⚠️ [Embedding] Server error (${errorStatus}), retrying after ${waitTime}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      // 最後の試行で失敗した場合、またはリトライ不可なエラーの場合はエラーをスロー
      if (attempt === maxRetries) {
        console.error(`❌ [Embedding] Failed to generate embedding after ${maxRetries + 1} attempts`, {
          lastError: lastError.message,
          errorCode,
          errorStatus
        });
        throw lastError;
      }
    }
  }
  
  // このコードには到達しないはずだが、型安全性のために追加
  throw lastError || new Error('Failed to generate embedding after retries');
}
