import 'dotenv/config';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
// import { ai } from '../ai/genkit.js'; // ★ Genkitへの依存を削除
import { uploadFileToGCS } from './upload-jsonl-to-gcs';
import { uploadFileToVectorSearch } from './upload-to-vector-search';
import * as minimist from 'minimist';
import { ErrorHandler } from '../lib/error-handling';
// import { generateEmbeddingsWithDynamicBatch } from '../lib/embedding-utils'; // ★ 古いヘルパーを削除
import { getEmbeddings } from '../lib/vertex-ai-helper'; // ★ 新しいヘルパーをインポート

// Firebase Admin SDKの初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

interface ConfluencePage {
  id: string;
  title: string;
  body?: { storage?: { value: string; }; };
  space?: { key: string; name: string; };
  version?: { when: string; };
  metadata?: { labels?: { results: Array<{ name: string; }>; }; };
}

/**
 * HTMLからテキストを抽出する
 */
function extractTextFromHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * テキストをチャンクに分割する
 */
function splitTextIntoChunks(text: string): string[] {
  const CHUNK_SIZE = 1000;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    const chunk = text.substring(i, i + CHUNK_SIZE).trim();
    if (chunk) {
      chunks.push(chunk);
    }
  }
  return chunks;
}

/**
 * Confluenceからページを取得する
 */
async function getConfluencePages(
  spaceKey: string, 
  start: number, 
  limit: number,
  lastSyncTime?: string
): Promise<ConfluencePage[]> {
  try {
    console.log(`Fetching Confluence pages from ${start} to ${start + limit - 1}...`);
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const username = process.env.CONFLUENCE_USER_EMAIL;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;
    if (!baseUrl || !username || !apiToken) {
      throw new Error('Confluence API credentials not configured');
    }
    const endpoint = `${baseUrl}/wiki/rest/api/content`;
    const params: any = {
      spaceKey,
      expand: 'body.storage,version,space,metadata.labels',
      start,
      limit
    };
    if (lastSyncTime) {
      console.log(`Fetching pages updated after ${lastSyncTime}`);
      // CQL (Confluence Query Language) を使用してフィルタリング
      params.cql = `lastModified >= "${lastSyncTime}" AND space = "${spaceKey}"`;
    }
    const response = await axios.get(endpoint, {
      params,
      auth: { username, password: apiToken }
    });
    if (!response.data || !response.data.results) return [];
    console.log(`Retrieved ${response.data.results.length} pages`);
    return response.data.results;
  } catch (error: any) {
    console.error('Error fetching Confluence pages:', error.message);
    if (axios.isAxiosError(error) && error.response) {
      console.error('API response:', error.response.status, error.response.statusText);
    }
    throw error;
  }
}

/**
 * 最後の同期時刻を取得する
 */
async function getLastSyncTime(): Promise<string | null> {
  try {
    console.log('Getting last successful sync time...');
    
    // 最後の成功したバッチ同期を検索
    const syncLogsRef = admin.firestore().collection('syncLogs');
    const query = syncLogsRef
      .where('operation', '==', 'confluence_batch_sync')
      .where('status', '==', 'complete')
      .orderBy('timestamp', 'desc')
      .limit(1);
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('No previous successful sync found');
      return null;
    }
    
    const lastSync = snapshot.docs[0].data();
    const lastSyncTime = lastSync.timestamp.toDate().toISOString();
    console.log(`Last successful sync was at ${lastSyncTime}`);
    return lastSyncTime;
  } catch (error: any) {
    console.error(`Error getting last sync time: ${error.message}`);
    return null;
  }
}

/**
 * 削除されたページのチャンクをFirestoreから削除する
 */
async function deleteChunksForPages(pageIds: Set<string>): Promise<number> {
  try {
    console.log(`Deleting chunks for ${pageIds.size} deleted pages...`);
    
    // 削除対象のページIDの配列
    const pageIdArray = Array.from(pageIds);
    
    // バッチサイズ（Firestoreの制限に合わせる）
    const batchSize = 500;
    let totalDeleted = 0;
    
    // 各ページIDに対して、関連するチャンクを検索して削除
    for (let i = 0; i < pageIdArray.length; i += batchSize) {
      const batch = admin.firestore().batch();
      let batchCount = 0;
      
      // このバッチで処理するページID
      const batchPageIds = pageIdArray.slice(i, i + batchSize);
      
      for (const pageId of batchPageIds) {
        // ページIDに関連するチャンクを検索
        const chunksQuery = admin.firestore().collection('chunks').where('pageId', '==', pageId);
        const chunks = await chunksQuery.get();
        
        if (chunks.empty) {
          console.log(`No chunks found for page ${pageId}`);
          continue;
        }
        
        console.log(`Deleting ${chunks.size} chunks for page ${pageId}`);
        
        // 各チャンクをバッチ削除
        chunks.forEach(doc => {
          batch.delete(doc.ref);
          batchCount++;
        });
        
        totalDeleted += chunks.size;
      }
      
      // バッチ処理を実行
      if (batchCount > 0) {
        await batch.commit();
        console.log(`Deleted ${batchCount} chunks in batch`);
      }
    }
    
    console.log(`Total chunks deleted: ${totalDeleted}`);
    
    // 削除ログを保存
    await saveSyncLog('deleted_pages', {
      message: `Deleted chunks for ${pageIds.size} pages`,
      pageIds: Array.from(pageIds),
      chunksDeleted: totalDeleted,
      timestamp: new Date().toISOString()
    });
    
    return totalDeleted;
  } catch (error: any) {
    console.error(`Error deleting chunks for deleted pages: ${error.message}`);
    throw error;
  }
}

/**
 * Firestoreから登録済みのページIDを取得する
 */
async function getRegisteredPageIds(): Promise<Set<string>> {
  try {
    console.log('Getting registered page IDs from Firestore...');
    
    const chunkCollection = admin.firestore().collection('chunks');
    const snapshot = await chunkCollection.get();
    
    // ページIDを抽出（重複を除去するためにSetを使用）
    const pageIds = new Set<string>();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.pageId) {
        pageIds.add(data.pageId);
      }
    });
    
    console.log(`Found ${pageIds.size} registered page IDs in Firestore`);
    return pageIds;
  } catch (error: any) {
    console.error(`Error getting registered page IDs: ${error.message}`);
    return new Set();
  }
}

/**
 * バッチ同期を実行する
 */
async function batchSyncConfluence(isDifferentialSync = false, shouldDelete = true) {
  try {
    console.log('Starting batch sync of Confluence data...');
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
    if (!spaceKey) throw new Error('CONFLUENCE_SPACE_KEY not set');
    const gcsBatchRoot = `gs://${process.env.VERTEX_AI_STORAGE_BUCKET}`;

    let lastSyncTime: string | null = null;
    if (isDifferentialSync) lastSyncTime = await getLastSyncTime();
    await saveSyncLog('start', { message: 'Sync started', lastSyncTime });

    const allConfluencePageIds = await getRegisteredPageIds();
    const processedPageIds = new Set<string>();
    
    let totalPages = 0, totalChunks = 0, totalEmbeddings = 0, batchCount = 0;
    const batchSize = 50; // ★★★ 元のバッチサイズに戻す ★★★
    let start = 0;
    let hasMore = true;

    while (hasMore) {
      batchCount++;
      try {
        const pages = await getConfluencePages(spaceKey, start, batchSize, isDifferentialSync ? lastSyncTime : undefined);
        if (pages.length === 0) {
          hasMore = false;
          break;
        }

        totalPages += pages.length;
        const recordsForBatch: any[] = [];
        for (const page of pages) {
          processedPageIds.add(page.id);
          const text = extractTextFromHtml(page.body?.storage?.value || '');
          const chunks = splitTextIntoChunks(text);
          totalChunks += chunks.length;
          const labels = page.metadata?.labels?.results?.map(l => l.name) || [];
          for (let i = 0; i < chunks.length; i++) {
            recordsForBatch.push({
              id: `${page.id}-${i}`, pageId: page.id, title: page.title,
              spaceKey: page.space?.key || '', spaceName: page.space?.name || '',
              url: `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${page.space?.key}/pages/${page.id}`,
              lastUpdated: page.version?.when || '', chunkIndex: i, content: chunks[i], labels
            });
          }
        }
        
        // ★★★ 埋め込み生成をVertex AI API直接呼び出しに変更 ★★★
        console.log(`Generating embeddings for ${recordsForBatch.length} chunks...`);
        
        const recordsToEmbed = recordsForBatch.filter(r => r.content && r.content.trim() !== '');
        const recordsWithoutContent = recordsForBatch.filter(r => !r.content || r.content.trim() === '');

        let embeddedRecords: any[] = [];
        if (recordsToEmbed.length > 0) {
            try {
                const EMBEDDING_BATCH_SIZE = 5; // Vertex AI APIの推奨バッチサイズ
                for (let i = 0; i < recordsToEmbed.length; i += EMBEDDING_BATCH_SIZE) {
                    const batchOfRecords = recordsToEmbed.slice(i, i + EMBEDDING_BATCH_SIZE);
                    const contents = batchOfRecords.map(r => r.content);
                    
                    const embeddings = await getEmbeddings(contents);

                    const processedBatch = batchOfRecords.map((record, index) => ({
                        ...record,
                        embedding: embeddings[index] || [],
                    }));
                    embeddedRecords.push(...processedBatch);
                }
                totalEmbeddings += embeddedRecords.length;
                console.log(`Total embeddings generated for main batch ${batchCount}: ${embeddedRecords.length}`);

            } catch (embeddingError: any) {
                await ErrorHandler.logError('embedding_batch_generation', embeddingError, { batchCount });
                console.error(`Critical error in embedding generation for batch ${batchCount}:`, embeddingError.message);
                embeddedRecords = recordsToEmbed.map(r => ({ ...r, embedding: [] }));
            }
        }
        
        // 埋め込みがなかったレコードも結果に含める
        const allRecordsForBatch = [
            ...embeddedRecords,
            ...recordsWithoutContent.map(r => ({ ...r, embedding: [] }))
        ];

        // ★★★ データがある場合のみ後続処理を実行 ★★★
        if (allRecordsForBatch.length > 0) {
            await saveMetadataToFirestore(allRecordsForBatch);
            const localJsonlPath = await createJsonlFile(allRecordsForBatch, batchCount);
            
            // ★★★ 中身のあるファイルが生成された場合のみGCSへアップロード ★★★
            if (localJsonlPath) {
                await uploadFileToGCS(localJsonlPath);
            }
        } else {
            console.log("No records to process for this batch.");
        }
        
        await saveSyncLog('batch_complete', { batch: batchCount, pages: pages.length, chunks: allRecordsForBatch.length });
        console.log(`Batch ${batchCount} completed.`);

        hasMore = false; // ★★★ テストのため、1バッチでループを抜ける ★★★
      } catch (batchError: any) {
        console.error(`Error in batch ${batchCount}:`, batchError.message);
        await saveSyncLog('batch_error', { batch: batchCount, message: batchError.message });
      }
      start += batchSize;
    }

    if (shouldDelete) {
      await handleDeletedPages(allConfluencePageIds, processedPageIds);
    }
    
    console.log(`\nSending final update to Vector Search: ${gcsBatchRoot}/`);
    await uploadFileToVectorSearch(gcsBatchRoot);

    await saveSyncLog('complete', { totalPages, totalChunks, totalEmbeddings });
    console.log('\nBatch sync completed successfully');
    return { status: 'success', totalPages, totalChunks, totalEmbeddings };
  } catch (error: any) {
    console.error('Error in batch sync:', error.message);
    await saveSyncLog('error', { message: error.message });
    throw error;
  }
}

/**
 * バッチ同期のログを保存する
 * @param operation 操作名
 * @param data ログデータ
 */
async function saveSyncLog(operation: string, data: any) {
  try {
    const syncLogsRef = admin.firestore().collection('syncLogs');
    await syncLogsRef.add({
      operation,
      status: 'complete', // バッチ同期の場合は常にcomplete
      data,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Sync log saved for operation: ${operation}`);
  } catch (error: any) {
    console.error(`Error saving sync log for operation ${operation}: ${error.message}`);
  }
}

/**
 * メタデータをFirestoreに保存する
 * @param records 埋め込みベクトルを含むレコード
 */
async function saveMetadataToFirestore(records: any[]) {
  if (!records || records.length === 0) {
    console.log('No metadata records to save.');
    return;
  }
  console.log(`Preparing to save ${records.length} metadata records to Firestore one by one...`);
  
  const metadataRef = admin.firestore().collection('chunks');
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{id: string, error: string}> = [];

  // バッチ処理の冪等性を確保するためのキー
  const batchKey = `batch-${Date.now()}`;

  for (const record of records) {
    try {
      if (record && record.id) {
        // 冪等性を確保して処理
        await ErrorHandler.processWithIdempotency(
          'save_metadata',
          `${record.id}-${batchKey}`,
          async () => {
            const docRef = metadataRef.doc(record.id);
            const { embedding, ...firestoreData } = record;
            await docRef.set({
              ...firestoreData,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
          }
        );
        successCount++;
      } else {
        console.warn('Skipping invalid record:', record);
        errors.push({ id: record.id || 'unknown', error: 'Invalid record structure' });
        errorCount++;
      }
    } catch (error: any) {
      await ErrorHandler.logError('firestore_save', error, {
        recordId: record.id,
        recordType: 'chunk'
      });
      console.error(`Error saving record ${record.id} to Firestore:`, error.message);
      errors.push({ id: record.id || 'unknown', error: error.message });
      errorCount++;
    }
  }
  
  console.log(`Firestore save complete. Success: ${successCount}, Errors: ${errorCount}`);
  
  if (errorCount > 0) {
    // エラーログに詳細を記録
    await ErrorHandler.logError('firestore_batch_save', new Error(`${errorCount} records failed to save to Firestore.`), {
      totalRecords: records.length,
      successCount,
      errorCount,
      errors: errors.slice(0, 10) // 最初の10件のみログに記録
    });
    
    throw new Error(`${errorCount} records failed to save to Firestore.`);
  }
}

/**
 * JSONLファイルを作成してGCSにアップロードする
 * @param records 埋め込みベクトルを含むレコード
 * @param batchNumber バッチ番号
 */
async function createAndUploadJsonl(records: any[], batchNumber: number): Promise<string> {
  try {
    const filename = `vector-search-data-${new Date().toISOString().split('T')[0]}-batch-${batchNumber}-${Date.now()}.json`;
    
    // Ensure the temp directory exists and resolve its absolute path
    const tempDir = path.resolve(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filePath = path.join(tempDir, filename);
    
    // JSONLファイルを作成
    const jsonlContent = records.map(record => JSON.stringify(record)).join('\n');
    await fs.promises.writeFile(filePath, jsonlContent);
    console.log(`JSONL file created at ${filePath}`);
    
    // GCSにアップロード
    const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('VERTEX_AI_STORAGE_BUCKET environment variable is not set');
    }
    
    const gcsPath = `gs://${bucketName}/${filename}`;
    await uploadFileToGCS(filePath);
    console.log(`JSONL file uploaded to ${gcsPath}`);
    
    // アップロードしたファイルのパスを返す
    return filename;
  } catch (error: any) {
    console.error(`Error creating and uploading JSONL file: ${error.message}`);
    throw error;
  }
}

/**
 * JSONLファイルをローカルに作成する
 * @param records 
 * @param batchNumber 
 * @returns 
 */
async function createJsonlFile(records: any[], batchNumber: number): Promise<string> {
    const filename = `vector-search-data-${new Date().toISOString().split('T')[0]}-batch-${batchNumber}-${Date.now()}.json`;
    const tempDir = path.resolve(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filePath = path.join(tempDir, filename);

    const recordsWithEmbeddings = records
        .filter(record => record.embedding && Array.isArray(record.embedding) && record.embedding.length > 0);

    if (recordsWithEmbeddings.length === 0) {
        console.warn(`[Batch ${batchNumber}] No records with embeddings found. An empty JSONL file will be created but not uploaded.`);
        // 空のファイルを作成して、後続処理でエラーにならないようにする
        await fs.promises.writeFile(filePath, '');
        return ''; // GCSアップロードをスキップするために空文字を返す
    }

    const jsonlContent = recordsWithEmbeddings
        .map(record => JSON.stringify(record)).join('\n');

    await fs.promises.writeFile(filePath, jsonlContent);
    console.log(`[Batch ${batchNumber}] JSONL file with ${recordsWithEmbeddings.length} records created at ${filePath}`);
    return filePath;
}


/**
 * 削除されたページを処理する
 * @param allPageIds 全てのConfluenceページID
 * @param lastSyncTime 前回の同期時刻
 */
async function handleDeletedPages(allRegisteredPageIds: Set<string>, processedPageIds: Set<string>) {
  try {
    console.log('\nChecking for deleted pages...');
    
    const deletedPageIds = new Set<string>();
    for (const pageId of allRegisteredPageIds) {
      if (!processedPageIds.has(pageId)) {
        deletedPageIds.add(pageId);
      }
    }
    
    const deletedPagesCount = deletedPageIds.size;
    console.log(`Found ${deletedPagesCount} deleted pages`);
    
    if (deletedPagesCount > 0) {
      await deleteChunksForPages(deletedPageIds);
    }
  } catch (error: any) {
    console.error(`Error handling deleted pages: ${error.message}`);
    throw error;
  }
}

/**
 * スクリプトのエントリーポイント
 */
async function main() {
  const argv = minimist.default ? minimist.default(process.argv.slice(2)) : minimist(process.argv.slice(2));
  const isAllSync = argv.all || false; // --all フラグをチェック

  // isDifferentialSync は isAllSync の逆
  const isDifferentialSync = !isAllSync; 
  const shouldDelete = isDifferentialSync; 

  console.log(`Starting sync: All=${isAllSync}, Differential=${isDifferentialSync}, Delete=${shouldDelete}`);

  try {
    const result = await batchSyncConfluence(isDifferentialSync, shouldDelete);
    console.log('Batch sync finished successfully.', result);
    process.exit(0);
  } catch (error) {
    console.error('Batch sync failed with an unhandled error:', error);
    process.exit(1);
  }
}

main();