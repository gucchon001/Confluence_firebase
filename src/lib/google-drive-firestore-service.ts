/**
 * Google DriveドキュメントのFirestore管理サービス
 */

import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { app } from './firebase';
import type { GoogleDriveDocument } from './google-drive-service';

const db = getFirestore(app);
const COLLECTION_NAME = 'google_drive_documents';

export interface GoogleDriveDocumentRecord {
  fileId: string;
  fileName: string;
  mimeType: string;
  content: string;
  url: string;
  lastModified?: string;
  size?: number;
  importedAt: Timestamp;
  importedBy: string;
  lastSyncedAt: Timestamp;
  version: number;
}

/**
 * Google DriveドキュメントをFirestoreに保存
 */
export async function saveGoogleDriveDocument(
  document: GoogleDriveDocument,
  userId: string
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, document.fileId);
    const now = Timestamp.now();
    
    // 既存のドキュメントを確認
    const existingDoc = await getDoc(docRef);
    const existingData = existingDoc.data() as GoogleDriveDocumentRecord | undefined;
    
    const record: GoogleDriveDocumentRecord = {
      fileId: document.fileId,
      fileName: document.fileName,
      mimeType: document.mimeType,
      content: document.content,
      url: document.url,
      lastModified: document.lastModified,
      size: document.size,
      importedAt: existingData?.importedAt || now,
      importedBy: existingData?.importedBy || userId,
      lastSyncedAt: now,
      version: (existingData?.version || 0) + 1,
    };

    await setDoc(docRef, record);
    console.log(`✅ Google Driveドキュメントを保存しました: ${document.fileId}`);
  } catch (error) {
    console.error(`❌ Google Driveドキュメントの保存エラー (${document.fileId}):`, error);
    throw error;
  }
}

/**
 * Google Driveドキュメントを取得
 */
export async function getGoogleDriveDocument(fileId: string): Promise<GoogleDriveDocumentRecord | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, fileId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as GoogleDriveDocumentRecord;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Google Driveドキュメントの取得エラー (${fileId}):`, error);
    throw error;
  }
}

/**
 * すべてのGoogle Driveドキュメントを取得
 */
export async function getAllGoogleDriveDocuments(): Promise<GoogleDriveDocumentRecord[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => doc.data() as GoogleDriveDocumentRecord);
  } catch (error) {
    console.error('❌ Google Driveドキュメント一覧の取得エラー:', error);
    throw error;
  }
}

/**
 * ユーザーがインポートしたGoogle Driveドキュメントを取得
 */
export async function getGoogleDriveDocumentsByUser(userId: string): Promise<GoogleDriveDocumentRecord[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), where('importedBy', '==', userId));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => doc.data() as GoogleDriveDocumentRecord);
  } catch (error) {
    console.error(`❌ ユーザーのGoogle Driveドキュメント取得エラー (${userId}):`, error);
    throw error;
  }
}

