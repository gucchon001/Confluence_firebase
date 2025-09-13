"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = exports.ErrorCode = void 0;
const admin = require("firebase-admin");
/**
 * エラーコードの定義
 */
var ErrorCode;
(function (ErrorCode) {
    // API関連エラー
    ErrorCode["UNAUTHORIZED"] = "unauthorized";
    ErrorCode["CONFLUENCE_API_ERROR"] = "confluence_api_error";
    ErrorCode["LLM_API_ERROR"] = "llm_api_error";
    ErrorCode["VECTOR_SEARCH_ERROR"] = "vector_search_error";
    // データ処理エラー
    ErrorCode["DATABASE_WRITE_ERROR"] = "database_write_error";
    ErrorCode["RESOURCE_NOT_FOUND"] = "resource_not_found";
    ErrorCode["BAD_REQUEST"] = "bad_request";
    // バッチ処理エラー
    ErrorCode["PAYLOAD_SIZE_EXCEEDED"] = "payload_size_exceeded";
    ErrorCode["API_RATE_LIMIT"] = "api_rate_limit";
    ErrorCode["AUTHENTICATION_ERROR"] = "authentication_error";
    ErrorCode["BATCH_PROCESSING_ERROR"] = "batch_processing_error";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
/**
 * エラーハンドリングユーティリティクラス
 */
class ErrorHandler {
    /**
     * エラーログを構造化して記録する
     * @param operation 操作名
     * @param error エラーオブジェクト
     * @param context コンテキスト情報
     */
    static async logError(operation, error, context = {}) {
        const errorDetails = {
            operation,
            code: error.code || ErrorCode.BATCH_PROCESSING_ERROR,
            message: error.message || 'Unknown error',
            timestamp: new Date().toISOString(),
            context,
            // スタックトレースは開発環境のみ
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        };
        console.error(JSON.stringify(errorDetails));
        // Firestoreにエラーログを保存
        try {
            if (admin.apps.length) {
                const db = admin.firestore();
                await db.collection('errorLogs').add({
                    ...errorDetails,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }
        catch (logError) {
            // ログ保存自体のエラーは標準エラー出力のみ
            console.error('Failed to save error log:', logError);
        }
    }
    /**
     * 指数バックオフでリトライする関数
     * @param operation 実行する関数
     * @param maxRetries 最大リトライ回数
     * @param initialDelay 初期待機時間（ミリ秒）
     * @param backoffFactor バックオフ係数
     */
    static async withRetry(operation, maxRetries = 3, initialDelay = 1000, backoffFactor = 2) {
        let retries = 0;
        let delay = initialDelay;
        while (true) {
            try {
                return await operation();
            }
            catch (error) {
                retries++;
                if (retries > maxRetries) {
                    console.error(`Failed after ${maxRetries} retries:`, error.message);
                    throw error;
                }
                // 指数バックオフでリトライ
                console.log(`Retry ${retries}/${maxRetries} after ${delay}ms delay`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= backoffFactor;
            }
        }
    }
    /**
     * コンテンツサイズに基づいて最適なバッチサイズを計算する
     * @param contents コンテンツの配列
     * @param maxPayloadSize 最大ペイロードサイズ（バイト）
     * @param minBatchSize 最小バッチサイズ
     * @param maxBatchSize 最大バッチサイズ
     */
    static calculateOptimalBatchSize(contents, maxPayloadSize = 30000, minBatchSize = 1, maxBatchSize = 50) {
        if (!contents || contents.length === 0) {
            return maxBatchSize;
        }
        // 各コンテンツのサイズ（バイト）を計算
        const contentSizes = contents.map(c => Buffer.byteLength(JSON.stringify({ text: c.content || '' }), 'utf8'));
        // 平均サイズを計算
        const avgSize = contentSizes.reduce((sum, size) => sum + size, 0) / contentSizes.length;
        // 最適なバッチサイズを計算（最低minBatchSize、最大maxBatchSize）
        const optimalSize = Math.floor(maxPayloadSize / avgSize);
        return Math.max(minBatchSize, Math.min(maxBatchSize, optimalSize));
    }
    /**
     * 冪等性を確保した処理実行
     * @param operation 操作名
     * @param idempotencyKey 冪等性キー
     * @param processFn 実行する関数
     */
    static async processWithIdempotency(operation, idempotencyKey, processFn) {
        if (!admin.apps.length) {
            // Firebase初期化されていない場合は単純に実行
            return processFn();
        }
        const db = admin.firestore();
        const stateRef = db.collection('processingState').doc(idempotencyKey);
        // 処理状態を確認
        const stateDoc = await stateRef.get();
        if (stateDoc.exists && stateDoc.data()?.status === 'completed') {
            console.log(`Operation ${operation} with key ${idempotencyKey} already completed, skipping`);
            return stateDoc.data()?.result;
        }
        // 処理開始を記録
        await stateRef.set({
            operation,
            idempotencyKey,
            status: 'processing',
            startedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        try {
            // 処理実行
            const result = await processFn();
            // 処理完了を記録
            await stateRef.update({
                status: 'completed',
                result,
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return result;
        }
        catch (error) {
            // エラー状態を記録
            await stateRef.update({
                status: 'failed',
                error: error.message,
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            throw error;
        }
    }
    /**
     * 大きなテキストを前処理して適切なサイズに調整する
     * @param text 処理するテキスト
     * @param maxLength 最大文字数
     */
    static preprocessLargeText(text, maxLength = 5000) {
        if (!text || text.length <= maxLength)
            return text;
        // テキストを短縮（先頭と末尾を残し、中間を省略）
        const headLength = Math.floor(maxLength * 0.6);
        const tailLength = maxLength - headLength - 20; // 省略記号の長さを考慮
        const head = text.substring(0, headLength);
        const tail = text.substring(text.length - tailLength);
        return `${head} [...中間約${text.length - maxLength}文字省略...] ${tail}`;
    }
}
exports.ErrorHandler = ErrorHandler;
