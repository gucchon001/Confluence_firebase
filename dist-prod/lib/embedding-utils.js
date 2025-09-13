"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.embedWithRetry = embedWithRetry;
exports.generateEmbeddingsWithDynamicBatch = generateEmbeddingsWithDynamicBatch;
const genkit_js_1 = require("../ai/genkit.js");
const error_handling_1 = require("./error-handling");
/**
 * リトライ機能付きのEmbedding生成関数
 * @param batchOfRecords エンベディングを生成するレコードの配列
 * @param maxRetries 最大リトライ回数
 * @param initialDelay 初期待機時間（ミリ秒）
 */
async function embedWithRetry(batchOfRecords, maxRetries = 3, initialDelay = 1000) {
    if (!batchOfRecords || batchOfRecords.length === 0) {
        return [];
    }
    // バッチが1件の場合は単純に処理
    if (batchOfRecords.length === 1) {
        try {
            const contentsToEmbed = batchOfRecords.map(r => ({ text: r.content }));
            const embeddingResponses = await genkit_js_1.ai.embed({
                embedder: 'googleai/text-embedding-004',
                content: { content: contentsToEmbed },
            });
            return embeddingResponses;
        }
        catch (error) {
            await error_handling_1.ErrorHandler.logError('embedding_generation_single', error, {
                recordCount: 1,
                contentLength: batchOfRecords[0]?.content?.length || 0
            });
            throw error;
        }
    }
    // 複数件の場合はリトライロジックを適用
    let retries = 0;
    let delay = initialDelay;
    while (retries <= maxRetries) {
        try {
            const contentsToEmbed = batchOfRecords.map(r => ({ text: r.content }));
            const embeddingResponses = await genkit_js_1.ai.embed({
                embedder: 'googleai/text-embedding-004',
                content: { content: contentsToEmbed },
            });
            return embeddingResponses;
        }
        catch (error) {
            retries++;
            // エラーログ記録
            await error_handling_1.ErrorHandler.logError('embedding_generation_batch', error, {
                batchSize: batchOfRecords.length,
                retryCount: retries,
                contentSample: batchOfRecords[0]?.content?.substring(0, 100)
            });
            // ペイロードサイズエラーの場合はバッチを分割
            if (error.message?.includes('Request payload size exceeds the limit') && batchOfRecords.length > 1) {
                console.log(`Payload too large, splitting batch of ${batchOfRecords.length} into two parts`);
                const mid = Math.floor(batchOfRecords.length / 2);
                const firstHalf = await embedWithRetry(batchOfRecords.slice(0, mid), maxRetries, delay);
                const secondHalf = await embedWithRetry(batchOfRecords.slice(mid), maxRetries, delay);
                return [...firstHalf, ...secondHalf];
            }
            // 最大リトライ回数に達した場合
            if (retries > maxRetries) {
                console.error(`Failed after ${maxRetries} retries:`, error.message);
                // 空の埋め込みで続行
                return batchOfRecords.map(() => ({ embedding: [] }));
            }
            // 指数バックオフでリトライ
            console.log(`Retry ${retries}/${maxRetries} after ${delay}ms delay`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // 指数バックオフ
        }
    }
    // 予期せぬエラー（ここには到達しないはず）
    throw new Error('Unexpected error in embedWithRetry');
}
/**
 * 動的なバッチサイズでEmbeddingを生成する
 * @param recordsToEmbed エンベディングを生成するレコードの配列
 */
async function generateEmbeddingsWithDynamicBatch(recordsToEmbed) {
    if (!recordsToEmbed || recordsToEmbed.length === 0) {
        return [];
    }
    // 最適なバッチサイズを計算
    const sampleSize = Math.min(10, recordsToEmbed.length);
    const optimalBatchSize = error_handling_1.ErrorHandler.calculateOptimalBatchSize(recordsToEmbed.slice(0, sampleSize));
    console.log(`Using dynamic batch size: ${optimalBatchSize} based on content size`);
    const embeddedRecords = [];
    // バッチ処理
    for (let i = 0; i < recordsToEmbed.length; i += optimalBatchSize) {
        const batchOfRecords = recordsToEmbed.slice(i, i + optimalBatchSize);
        try {
            const embeddingResponses = await embedWithRetry(batchOfRecords);
            const processedBatch = batchOfRecords.map((record, index) => {
                const embeddingVector = embeddingResponses[index]?.embedding || [];
                // L2正規化
                const l2 = Math.sqrt(embeddingVector.reduce((s, v) => s + (v * v), 0)) || 1;
                const normalizedEmbedding = embeddingVector.map((v) => v / l2);
                return { ...record, embedding: normalizedEmbedding };
            });
            embeddedRecords.push(...processedBatch);
            console.log(`Successfully generated ${processedBatch.length} embeddings in sub-batch.`);
        }
        catch (error) {
            // エラーログ記録
            await error_handling_1.ErrorHandler.logError('embedding_batch_processing', error, {
                batchSize: batchOfRecords.length,
                startIndex: i,
                totalRecords: recordsToEmbed.length
            });
            // エラー時は空の埋め込みで続行
            const failedBatch = batchOfRecords.map(r => ({ ...r, embedding: [] }));
            embeddedRecords.push(...failedBatch);
            console.error(`Error generating embeddings for a sub-batch:`, error.message);
        }
    }
    return embeddedRecords;
}
