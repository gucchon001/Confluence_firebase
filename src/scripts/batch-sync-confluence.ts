import 'dotenv/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as minimist from 'minimist';
import * as lancedb from '@lancedb/lancedb';
import { getEmbeddings } from '../lib/embeddings';
import { ErrorHandler } from '../lib/error-handling';
import { createConfluenceSampleData, ConfluenceSchema, FullLanceDBSchema } from '../lib/lancedb-schema';
import { 
  compareDates, 
  isNewerThan, 
  isEqual, 
  getDateComparisonDebugInfo,
  formatDateForDisplay,
  getRelativeTime
} from '../lib/date-comparison-utils';

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
  const CHUNK_SIZE = 1800; // パフォーマンス改善のため拡大
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
      console.log(`⚠️  CQLクエリが機能しないため、全ページを取得して手動でフィルタリングします`);
      // CQLクエリは機能しないため、全ページを取得して後で手動でフィルタリング
      // params.cql = `lastModified >= "${lastSyncTime}" AND space = "${spaceKey}"`;
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
 * ページIDからラベル一覧を取得（必要に応じてページング）
 */
async function getConfluenceLabels(pageId: string): Promise<string[]> {
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  const username = process.env.CONFLUENCE_USER_EMAIL;
  const apiToken = process.env.CONFLUENCE_API_TOKEN;
  if (!baseUrl || !username || !apiToken) {
    throw new Error('Confluence API credentials not configured');
  }

  const endpoint = `${baseUrl}/wiki/rest/api/content/${pageId}/label`;
  const labels: string[] = [];
  let start = 0;
  const limit = 200;

  // リトライ設定
  const maxRetries = 3;
  const initialDelayMs = 500;

  async function fetchPage(startParam: number, attempt: number): Promise<any> {
    try {
      const res = await axios.get(endpoint, {
        params: { start: startParam, limit },
        auth: { username, password: apiToken }
      });
      return res;
    } catch (err: any) {
      const isAxios = axios.isAxiosError(err);
      const status = isAxios ? err.response?.status : undefined;
      const shouldRetry = status === 401 || status === 403 || (status !== undefined && status >= 500);
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[getConfluenceLabels] pageId=${pageId} start=${startParam} attempt=${attempt} failed: ${err?.message || err}. status=${status}. willRetry=${shouldRetry}`);
      if (shouldRetry && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delay));
        return fetchPage(startParam, attempt + 1);
      }
      throw err;
    }
  }

  while (true) {
    const res = await fetchPage(start, 1);
    const results = res?.data?.results || [];
    for (const r of results) {
      if (typeof r?.name === 'string' && r.name.trim().length > 0) {
        labels.push(r.name.trim());
      }
    }
    const size = res?.data?.size ?? results.length;
    if (results.length < limit || size === 0) break;
    start += limit;
  }
  const unique = Array.from(new Set(labels));
  console.log(`[getConfluenceLabels] pageId=${pageId} labels=${JSON.stringify(unique)}`);
  return unique;
}

/**
 * LanceDBから既存のページデータを取得
 */
async function getExistingLanceDBData(table: any): Promise<Map<string, { lastUpdated: string; title: string; }>> {
  try {
    console.log('📊 LanceDBから既存データを取得中...');
    const existingData = new Map<string, { lastUpdated: string; title: string; }>();
    
    const records = await table.query().select(['pageId', 'lastUpdated', 'title']).toArray();
    
    for (const record of records) {
      const pageId = String(record.pageId || '');
      if (pageId && pageId !== '0') { // 0や空文字列を除外
        existingData.set(pageId, {
          lastUpdated: String(record.lastUpdated || ''),
          title: String(record.title || '')
        });
      }
    }
    
    console.log(`✅ LanceDB既存データ取得完了: ${existingData.size}ページ`);
    return existingData;
  } catch (error) {
    console.error('❌ LanceDB既存データ取得エラー:', error);
    return new Map();
  }
}

/**
 * ページの更新日時を比較して更新が必要かどうかを判定
 */
function shouldUpdatePage(confluencePage: ConfluencePage, lancedbData: { lastUpdated: string; title: string; }): {
  needsUpdate: boolean;
  debugInfo: any;
} {
  const confluenceLastModified = confluencePage.version?.when;
  const lancedbLastUpdated = lancedbData.lastUpdated;

  const debugInfo = getDateComparisonDebugInfo(
    confluenceLastModified,
    lancedbLastUpdated,
    'Confluence',
    'LanceDB'
  );

  // 日時が無効な場合は更新が必要と判定
  if (!confluenceLastModified || !lancedbLastUpdated) {
    console.log(`⚠️  日時情報が不完全: ${confluencePage.title}`);
    console.log(`   Confluence: ${confluenceLastModified || 'N/A'}`);
    console.log(`   LanceDB: ${lancedbLastUpdated || 'N/A'}`);
    return { needsUpdate: true, debugInfo };
  }

  const needsUpdate = isNewerThan(confluenceLastModified, lancedbLastUpdated);
  
  if (needsUpdate) {
    console.log(`📝 更新が必要: ${confluencePage.title}`);
    console.log(`   Confluence: ${debugInfo.date1.display} (${getRelativeTime(confluenceLastModified)})`);
    console.log(`   LanceDB: ${debugInfo.date2.display} (${getRelativeTime(lancedbLastUpdated)})`);
    console.log(`   差分: ${debugInfo.comparison.differenceMs}ms`);
  } else {
    console.log(`✅ 更新不要: ${confluencePage.title}`);
  }

  return { needsUpdate, debugInfo };
}

/**
 * 最後の同期時刻を取得する
 */
async function getLastSyncTime(): Promise<string | null> {
  try {
    console.log('Getting last successful sync time...');
    
    // ローカルファイルから最後の同期時刻を取得
    const syncFilePath = path.resolve(process.cwd(), '.last_sync_time.json');
    if (fs.existsSync(syncFilePath)) {
      const syncData = JSON.parse(fs.readFileSync(syncFilePath, 'utf-8'));
      if (syncData && syncData.timestamp) {
        const lastSyncTime = syncData.timestamp;
        console.log(`Last successful sync was at ${lastSyncTime}`);
        return lastSyncTime;
      }
    }
    
    console.log('No previous successful sync found');
    return null;
  } catch (error: any) {
    console.error(`Error getting last sync time: ${error.message}`);
    return null;
  }
}

/**
 * 同期ログを保存する
 */
async function saveSyncLog(operation: string, data: any) {
  try {
    const logDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString();
    const logFileName = `sync_log_${timestamp.replace(/:/g, '-')}.json`;
    const logFilePath = path.join(logDir, logFileName);
    
    const logData = {
      operation,
      status: 'complete',
      data,
      timestamp
    };
    
    fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));
    console.log(`Sync log saved for operation: ${operation}`);
    
    // 完了ログの場合は最後の同期時刻を更新
    if (operation === 'complete') {
      const syncFilePath = path.resolve(process.cwd(), '.last_sync_time.json');
      fs.writeFileSync(syncFilePath, JSON.stringify({ timestamp }, null, 2));
    }
  } catch (error: any) {
    console.error(`Error saving sync log for operation ${operation}: ${error.message}`);
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

    // LanceDBテーブル準備
    const tableName = 'confluence';
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`Connecting to LanceDB at ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    
    // テーブル存在確認と作成
    const tableNames = await db.tableNames();
    let tbl: any;
    
    if (!tableNames.includes(tableName)) {
      console.log(`Creating LanceDB table '${tableName}' with full schema`);
      
      // サンプルデータを使用してテーブルを作成
      const sampleData = [createConfluenceSampleData()] as unknown as Record<string, unknown>[];
      tbl = await db.createTable(tableName, sampleData);
      
      // サンプルデータを削除
      await tbl.delete("id = 'sample-1'");
    } else {
      console.log(`Opening existing LanceDB table '${tableName}'`);
      tbl = await db.openTable(tableName);
    }

    let lastSyncTime: string | null = null;
    if (isDifferentialSync) lastSyncTime = await getLastSyncTime();
    await saveSyncLog('start', { message: 'Sync started', lastSyncTime });

    // LanceDBから既存のページデータを取得（日時比較用）
    const existingLanceDBData = await getExistingLanceDBData(tbl);
    const existingIds = new Set<string>(existingLanceDBData.keys());
    console.log(`Found ${existingIds.size} existing page IDs in LanceDB`);
    
    const processedPageIds = new Set<string>();
    
    let totalPages = 0, totalChunks = 0, totalEmbeddings = 0, batchCount = 0;
    const batchSize = 50;
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

        // 差分同期の場合は正確な日時比較でフィルタリング
        let filteredPages = pages;
        if (isDifferentialSync) {
          const pagesToProcess: ConfluencePage[] = [];
          let updateCount = 0;
          let insertCount = 0;
          let skipCount = 0;

          for (const page of pages) {
            const pageId = page.id;
            const existingData = existingLanceDBData.get(pageId);
            
            if (existingData) {
              // 既存ページ - 日時比較で更新が必要かチェック
              const { needsUpdate } = shouldUpdatePage(page, existingData);
              if (needsUpdate) {
                pagesToProcess.push(page);
                updateCount++;
              } else {
                skipCount++;
              }
            } else {
              // 新規ページ
              console.log(`➕ 新規追加: ${page.title}`);
              pagesToProcess.push(page);
              insertCount++;
            }
          }
          
          filteredPages = pagesToProcess;
          console.log(`📊 バッチ ${batchCount}: 全${pages.length}件 → 更新${updateCount}件, 新規${insertCount}件, スキップ${skipCount}件`);
        }

        totalPages += filteredPages.length;
        const recordsForBatch: any[] = [];
        for (const page of filteredPages) {
          processedPageIds.add(page.id);
          
          // 既存ページの場合は古いレコードを削除
          if (existingLanceDBData.has(page.id)) {
            try {
              // pageIdは数値型なので、文字列比較ではなく数値比較を使用
              await tbl.delete(`"pageId" = ${page.id}`);
              console.log(`🗑️  既存レコードを削除: ${page.title}`);
            } catch (error) {
              console.warn(`⚠️  既存レコード削除エラー: ${page.title}`, error);
            }
          }
          
          const text = extractTextFromHtml(page.body?.storage?.value || '');
          const chunks = splitTextIntoChunks(text);
          totalChunks += chunks.length;
          // ラベルを確実に取得（metadataが空でも別APIで補完）
          let labels: string[] = [];
          try {
            const metaLabels = page.metadata?.labels?.results?.map((l: any) => l?.name).filter((x: any) => typeof x === 'string' && x.trim().length > 0) || [];
            const apiLabels = await getConfluenceLabels(page.id);
            labels = Array.from(new Set([...(metaLabels as string[]), ...apiLabels]));
          } catch (e) {
            labels = [];
          }
          for (let i = 0; i < chunks.length; i++) {
            recordsForBatch.push({
              id: `${page.id}-${i}`, 
              pageId: page.id, 
              title: page.title,
              spaceKey: page.space?.key || '', 
              spaceName: page.space?.name || '',
              url: `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${page.space?.key}/pages/${page.id}`,
              lastUpdated: page.version?.when || '', 
              chunkIndex: i, 
              content: chunks[i], 
              labels
            });
          }
        }
        
        // 埋め込みベクトルの生成
        console.log(`Generating embeddings for ${recordsForBatch.length} chunks...`);
        
        const recordsToEmbed = recordsForBatch.filter(r => r.content && r.content.trim() !== '');
        const recordsWithoutContent = recordsForBatch.filter(r => !r.content || r.content.trim() === '');

        let embeddedRecords: any[] = [];
        if (recordsToEmbed.length > 0) {
            try {
                const EMBEDDING_BATCH_SIZE = 5; // 処理バッチサイズ
                for (let i = 0; i < recordsToEmbed.length; i += EMBEDDING_BATCH_SIZE) {
                    const batchOfRecords = recordsToEmbed.slice(i, i + EMBEDDING_BATCH_SIZE);
                    // 埋め込み入力にタイトル・ラベルを含める
                    const contents = batchOfRecords.map(r => {
                      const title = String(r.title || '');
                      const labels = Array.isArray(r.labels) ? r.labels.join(' ') : '';
                      const content = String(r.content || '');
                      // シンプルな正規化（全角スペース→半角、連続空白圧縮）
                      const normalize = (t: string) => t.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
                      return normalize(`${title} ${labels} ${content}`);
                    });
                    
                    // 複数テキストの埋め込み処理
                    const embeddings = [];
                    for (const content of contents) {
                        const embedding = await getEmbeddings(content);
                        embeddings.push(embedding);
                    }

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

        // データがある場合のみ後続処理を実行
        if (allRecordsForBatch.length > 0) {
            // LanceDBに保存
            console.log(`Saving ${allRecordsForBatch.length} records to LanceDB...`);
            const lancedbRecords = allRecordsForBatch
              .filter(record => record.embedding && Array.isArray(record.embedding) && record.embedding.length > 0)
              .map(record => ({
                id: String(record.id ?? ''),
                vector: Array.from(record.embedding as number[]),
                title: String(record.title ?? ''),
                content: String(record.content ?? ''),
                space_key: String(record.spaceKey ?? ''),
                labels: Array.isArray(record.labels) ? record.labels : [],
                pageId: String(record.pageId ?? ''),
                chunkIndex: Number(record.chunkIndex ?? 0),
                url: String(record.url ?? '#'),
                lastUpdated: String(record.lastUpdated ?? '')
              }));
            
            if (lancedbRecords.length > 0) {
              try {
                // 各レコードを文字列に変換して保存
                const stringifiedRecords = lancedbRecords.map(record => ({
                  id: record.id,
                  vector: record.vector,
                  title: record.title,
                  content: record.content,
                  space_key: record.space_key,
                  labels: record.labels,
                  pageId: record.pageId,
                  chunkIndex: record.chunkIndex,
                  url: record.url,
                  lastUpdated: record.lastUpdated
                }));
                
                // レコードを1件ずつ追加して、エラー時にはスキップする
                let successCount = 0;
                let errorCount = 0;
                
                for (const record of stringifiedRecords) {
                  try {
                    await tbl.add([record]);
                    successCount++;
                  } catch (recordError: any) {
                    errorCount++;
                    console.error(`Error saving record ${record.id}: ${recordError.message}`);
                    // エラーログを詳細に記録
                    await ErrorHandler.logError('lancedb_save_record', recordError, { 
                      recordId: record.id,
                      title: record.title.substring(0, 50)
                    });
                  }
                }
                
                console.log(`LanceDB save results: ${successCount} success, ${errorCount} errors`);
              } catch (error: any) {
                console.error(`Error in LanceDB batch save process: ${error.message}`);
                await ErrorHandler.logError('lancedb_save', error, { batchCount });
              }
            } else {
              console.log("No valid records with embeddings to save to LanceDB");
            }
        } else {
            console.log("No records to process for this batch.");
        }
        
        await saveSyncLog('batch_complete', { batch: batchCount, pages: pages.length, chunks: allRecordsForBatch.length });
        console.log(`Batch ${batchCount} completed.`);
        
        // 全件取り込み用に修正（テストのための制限を解除）
        // hasMore = false; // テストのため、1バッチでループを抜ける
      } catch (batchError: any) {
        console.error(`Error in batch ${batchCount}:`, batchError.message);
        await saveSyncLog('batch_error', { batch: batchCount, message: batchError.message });
      }
      start += batchSize;
    }

    if (shouldDelete && existingIds.size > 0) {
      // 削除されたページの処理
      console.log('\nChecking for deleted pages...');
      const deletedPageIds = new Set<string>();
      for (const pageId of existingIds) {
        if (!processedPageIds.has(pageId)) {
          deletedPageIds.add(pageId);
        }
      }
      
      const deletedPagesCount = deletedPageIds.size;
      console.log(`Found ${deletedPagesCount} deleted pages`);
      
      if (deletedPagesCount > 0) {
        // LanceDBから削除されたページのデータを削除
        try {
          const deletedIds = Array.from(deletedPageIds);
          for (const pageId of deletedIds) {
            await tbl.delete(`pageId = '${pageId}'`);
          }
          console.log(`Deleted data for ${deletedPagesCount} pages from LanceDB`);
        } catch (error: any) {
          console.error(`Error deleting data from LanceDB: ${error.message}`);
        }
      }
    }

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

// テスト用にエクスポート
export { 
  batchSyncConfluence, 
  getLastSyncTime, 
  getConfluencePages, 
  getConfluenceLabels,
  getExistingLanceDBData,
  shouldUpdatePage
};