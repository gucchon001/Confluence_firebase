/**
 * Firestore サービス
 */
import * as admin from 'firebase-admin';

// Firebaseが初期化されていない場合は初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Firestoreにメタデータを保存する
 * @param records レコードの配列
 */
export async function saveMetadataToFirestore(records: any[]): Promise<void> {
  try {
    console.log(`[saveMetadataToFirestore] Saving metadata for ${records.length} records to Firestore`);
    
    const batch = admin.firestore().batch();
    const chunkCollection = admin.firestore().collection('chunks');
    
    // 各レコードに対してバッチ書き込み
    for (const record of records) {
      const docId = `${record.pageId}-${record.chunkIndex}`;
      const docRef = chunkCollection.doc(docId);
      
      // 埋め込みベクトルを除外したメタデータを保存
      const { embedding, ...metadata } = record;
      
      batch.set(docRef, {
        ...metadata,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // バッチ書き込みを実行
    await batch.commit();
    
    console.log(`[saveMetadataToFirestore] Metadata saved successfully`);
  } catch (error: any) {
    console.error(`[saveMetadataToFirestore] Error saving metadata to Firestore: ${error.message}`);
    throw new Error(`Failed to save metadata to Firestore: ${error.message}`);
  }
}

/**
 * 同期ログを保存する
 * @param status ステータス ('start' | 'complete' | 'error')
 * @param details 詳細情報
 */
export async function saveSyncLog(status: 'start' | 'complete' | 'error', details: any): Promise<void> {
  try {
    const log = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      operation: 'confluence_sync',
      status,
      details
    };
    
    await admin.firestore().collection('syncLogs').add(log);
    
    console.log(`[saveSyncLog] Sync log saved with status: ${status}`);
  } catch (error: any) {
    console.error(`[saveSyncLog] Error saving sync log: ${error.message}`);
  }
}

/**
 * 検索結果からFirestoreでメタデータを取得
 * @param searchResults 検索結果の配列
 * @returns メタデータ付きの検索結果
 */
export async function fetchContentsFromFirestore(searchResults: any[]): Promise<any[]> {
  try {
    console.log(`[fetchContentsFromFirestore] Fetching metadata for ${searchResults.length} search results`);
    
    // 検索結果のIDを取得
    const ids = searchResults.map(result => result.id);
    
    if (ids.length === 0) {
      return [];
    }
    
    // バッチでドキュメントを取得
    const chunks = await Promise.all(
      ids.map(async (id) => {
        const doc = await admin.firestore().collection('chunks').doc(id).get();
        return doc.exists ? { id, ...doc.data() as any } : null;
      })
    );
    
    // 検索結果とコンテンツを結合
    const resultsWithContent = searchResults.map((result, index) => {
      const chunk = chunks[index];
      
      if (!chunk) {
        return {
          ...result,
          content: '内容が見つかりませんでした。'
        };
      }
      
      return {
        ...result,
        content: chunk.content,
        url: chunk.url,
        lastUpdated: chunk.lastUpdated,
        spaceName: chunk.spaceName,
        labels: chunk.labels || []
      };
    });
    
    console.log(`[fetchContentsFromFirestore] Successfully fetched metadata for ${resultsWithContent.length} results`);
    return resultsWithContent;
  } catch (error: any) {
    console.error(`[fetchContentsFromFirestore] Error fetching contents from Firestore: ${error.message}`);
    return searchResults.map(result => ({
      ...result,
      content: 'エラーが発生しました。'
    }));
  }
}