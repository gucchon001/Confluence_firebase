/**
 * Google DriveドキュメントのLanceDBインデックス化サービス
 */

import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { connectLanceDB } from './lancedb-connection';
import { getEmbeddings } from './embeddings';
import { chunkText } from './text-chunking';
import { getAllGoogleDriveDocuments, type GoogleDriveDocumentRecord } from './google-drive-firestore-service';
import { appConfig } from '@/config/app-config';

const TABLE_NAME = 'google_drive_documents';

interface GoogleDriveLanceDBRecord {
  id: string;
  file_id: string;
  title: string;
  content: string;
  chunkIndex: number;
  lastUpdated: string;
  url: string;
  mime_type: string;
  vector: number[];
  source: 'google_drive';
}

/**
 * Google DriveドキュメントをLanceDBにインデックス化
 */
export async function indexGoogleDriveDocumentsToLanceDB(
  fileIds?: string[]
): Promise<{ indexed: number; errors: number }> {
  try {
    const dbPath = appConfig.deployment.useInMemoryFS 
      ? '/dev/shm/.lancedb' 
      : path.resolve(process.cwd(), '.lancedb');
    
    const db = await connectLanceDB(dbPath);
    const tableNames = await db.tableNames();
    
    let table = tableNames.includes(TABLE_NAME)
      ? await db.openTable(TABLE_NAME)
      : null;

    // テーブルが存在しない場合は作成
    if (!table) {
      console.log(`🆕 LanceDBテーブル '${TABLE_NAME}' が存在しないため新規作成します`);
      table = await db.createTable(TABLE_NAME, [{
        id: 'dummy',
        file_id: 'dummy',
        title: 'dummy',
        content: 'dummy',
        chunkIndex: 0,
        lastUpdated: new Date().toISOString(),
        url: 'dummy',
        mime_type: 'dummy',
        vector: new Array(768).fill(0),
        source: 'google_drive',
      }]);
      await table.delete('id = "dummy"');
    }

    // FirestoreからGoogle Driveドキュメントを取得
    const documents = await getAllGoogleDriveDocuments();
    
    // ファイルIDでフィルタリング（指定されている場合）
    const documentsToIndex = fileIds
      ? documents.filter(doc => fileIds.includes(doc.fileId))
      : documents;

    if (documentsToIndex.length === 0) {
      console.log('⚠️ インデックス化するGoogle Driveドキュメントがありません');
      return { indexed: 0, errors: 0 };
    }

    console.log(`📊 Google DriveドキュメントをLanceDBにインデックス化中... (${documentsToIndex.length}件)`);

    let indexedCount = 0;
    let errorCount = 0;

    // 各ドキュメントを処理
    for (const document of documentsToIndex) {
      try {
        // 既存のレコードを削除（更新のため）
        await table.delete(`file_id = '${document.fileId}'`);

        // テキストをチャンクに分割
        const chunks = chunkText(document.content, {
          maxChunkSize: 1000,
          overlap: 200,
        });

        // 各チャンクをLanceDBに追加
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          
          // 埋め込みベクトルを生成
          const vector = await getEmbeddings(chunk.text);

          const record: GoogleDriveLanceDBRecord = {
            id: `${document.fileId}-${i}`,
            file_id: document.fileId,
            title: document.fileName,
            content: chunk.text,
            chunkIndex: i,
            lastUpdated: document.lastModified || document.importedAt.toDate().toISOString(),
            url: document.url,
            mime_type: document.mimeType,
            vector,
            source: 'google_drive',
          };

          await table.add([record]);
        }

        indexedCount++;
        console.log(`✅ Google Driveドキュメントをインデックス化しました: ${document.fileName} (${chunks.length}チャンク)`);
      } catch (error: any) {
        errorCount++;
        console.error(`❌ Google Driveドキュメントのインデックス化エラー (${document.fileId}):`, error);
      }
    }

    console.log(`✅ Google Driveドキュメントのインデックス化が完了しました: ${indexedCount}件成功, ${errorCount}件失敗`);

    return { indexed: indexedCount, errors: errorCount };
  } catch (error) {
    console.error('❌ Google DriveドキュメントのLanceDBインデックス化エラー:', error);
    throw error;
  }
}

/**
 * Google DriveドキュメントをLanceDBから削除
 */
export async function removeGoogleDriveDocumentsFromLanceDB(fileIds: string[]): Promise<void> {
  try {
    const dbPath = appConfig.deployment.useInMemoryFS 
      ? '/dev/shm/.lancedb' 
      : path.resolve(process.cwd(), '.lancedb');
    
    const db = await connectLanceDB(dbPath);
    const tableNames = await db.tableNames();
    
    if (!tableNames.includes(TABLE_NAME)) {
      console.log(`⚠️ LanceDBテーブル '${TABLE_NAME}' が存在しません`);
      return;
    }

    const table = await db.openTable(TABLE_NAME);

    // 各ファイルIDのレコードを削除
    for (const fileId of fileIds) {
      await table.delete(`file_id = '${fileId}'`);
      console.log(`✅ Google DriveドキュメントをLanceDBから削除しました: ${fileId}`);
    }
  } catch (error) {
    console.error('❌ Google DriveドキュメントのLanceDB削除エラー:', error);
    throw error;
  }
}

