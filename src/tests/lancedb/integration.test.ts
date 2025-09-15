/**
 * LanceDB統合テスト
 * 
 * このテストスイートは、LanceDBとFirestoreの統合機能を検証します。
 * 実行方法: npx vitest run src/tests/lancedb/integration.test.ts
 */
import { describe, test, expect, beforeAll } from 'vitest';
import * as lancedb from '@lancedb/lancedb';
import * as admin from 'firebase-admin';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

// Firebase Admin SDKの初期化
function initializeFirebase() {
  if (!admin.apps.length) {
    try {
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (serviceAccountPath) {
        const serviceAccount = require(path.resolve(serviceAccountPath));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        return true;
      }
    } catch (error) {
      console.warn('Firebase Admin SDK初期化エラー:', error);
    }
  } else {
    return true;
  }
  return false;
}

// テスト用のダミーベクトル生成関数
function generateDummyVector(dimension: number): number[] {
  return Array(dimension).fill(0).map(() => Math.random());
}

// getEmbeddingsのモック関数
async function mockGetEmbeddings(text: string, dimension: number = 10): Promise<number[]> {
  // テスト用に固定次元数のダミーベクトルを返す
  return generateDummyVector(dimension);
}

describe('LanceDBとFirestore統合テスト', () => {
  let db: lancedb.Connection;
  let tbl: lancedb.Table;
  let firestore: FirebaseFirestore.Firestore | null = null;
  const tableName = `test_integration_${Date.now()}`;
  const vectorDim = 10;
  const testId = `integration-${Date.now()}`;
  
  // テスト前の準備
  beforeAll(async () => {
    // LanceDBに接続
    db = await lancedb.connect(path.resolve('.lancedb'));
    
    // テスト用テーブルを作成
    tbl = await db.createTable(tableName, [{
      id: testId,
      vector: generateDummyVector(vectorDim),
      title: '統合テスト初期レコード',
      content: 'これは統合テスト用の初期レコードです'
    }]);
    
    // Firebase Admin SDKを初期化
    if (initializeFirebase()) {
      firestore = admin.firestore();
    }
  });
  
  test('FS-01: Firestoreメタデータ保存テスト', async () => {
    // Firestoreが初期化されていない場合はスキップ
    if (!firestore) {
      console.warn('Firestoreが初期化されていないため、このテストはスキップされます');
      return;
    }
    
    // メタデータをFirestoreに保存
    const metadata = {
      pageId: `page-${testId}`,
      title: '統合テスト初期レコード',
      spaceKey: 'TEST',
      content: 'これは統合テスト用の初期レコードです',
      labels: ['テスト', '統合'],
      lastUpdated: new Date().toISOString()
    };
    
    await firestore.collection('chunks').doc(testId).set(metadata);
    
    // 保存されたメタデータを取得
    const doc = await firestore.collection('chunks').doc(testId).get();
    
    // メタデータが正しく保存されていることを確認
    expect(doc.exists).toBe(true);
    expect(doc.data()?.title).toBe(metadata.title);
  });
  
  test('FS-02: LanceDB-Firestore統合検索テスト', async () => {
    // Firestoreが初期化されていない場合はスキップ
    if (!firestore) {
      console.warn('Firestoreが初期化されていないため、このテストはスキップされます');
      return;
    }
    
    // 検索クエリ
    const query = '統合テスト';
    
    // 1. クエリを埋め込みベクトルに変換（テスト用にモック関数を使用）
    let vector: number[];
    try {
      // 実際のgetEmbeddings関数ではなく、テスト用のモック関数を使用
      vector = await mockGetEmbeddings(query, vectorDim);
      console.log(`テスト用ベクトル生成: ${vectorDim}次元`);
    } catch (error) {
      console.warn('埋め込みベクトル生成エラー:', error);
      // エラー時はダミーベクトルを使用
      vector = generateDummyVector(vectorDim);
    }
    
    // 2. LanceDBで検索
    const results = await tbl.search(vector).limit(5).toArray();
    
    // 検索結果が取得できることを確認
    expect(results.length).toBeGreaterThan(0);
    
    // 3. 検索結果のIDを使用してFirestoreからメタデータを取得
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const id = result.id;
        const doc = await firestore.collection('chunks').doc(id).get();
        
        if (doc.exists) {
          // Firestoreのデータと結合
          return {
            ...result,
            ...doc.data(),
            distance: result._distance
          };
        } else {
          // Firestoreにデータがない場合はLanceDBのデータのみを返す
          return {
            ...result,
            distance: result._distance
          };
        }
      })
    );
    
    // 統合された検索結果が取得できることを確認
    expect(enrichedResults.length).toBeGreaterThan(0);
    expect(enrichedResults[0]).toHaveProperty('distance');
    
    // テストIDのレコードが含まれていれば、メタデータも確認
    const testRecord = enrichedResults.find(r => r.id === testId);
    if (testRecord) {
      expect(testRecord).toHaveProperty('spaceKey');
      expect(testRecord).toHaveProperty('labels');
    }
  });
  
  test('FS-03: データ整合性テスト', async () => {
    // Firestoreが初期化されていない場合はスキップ
    if (!firestore) {
      console.warn('Firestoreが初期化されていないため、このテストはスキップされます');
      return;
    }
    
    // LanceDBのレコード数を取得
    const lancedbCount = await tbl.countRows();
    
    // Firestoreのレコード数を取得（テストIDのみ）
    const snapshot = await firestore.collection('chunks').where('pageId', '==', `page-${testId}`).get();
    const firestoreCount = snapshot.size;
    
    console.log(`LanceDB: ${lancedbCount}件, Firestore: ${firestoreCount}件`);
    
    // 少なくともテストIDのレコードが両方に存在することを確認
    expect(lancedbCount).toBeGreaterThan(0);
    expect(firestoreCount).toBeGreaterThan(0);
  });
  
  test('IT-01: データ取得・保存統合テスト', async () => {
    // テストデータ
    const testData = {
      id: `integration-data-${Date.now()}`,
      title: 'データ統合テスト',
      content: 'これはデータ取得・保存統合テスト用のレコードです。',
      spaceKey: 'TEST',
      labels: ['データ', '統合']
    };
    
    // 1. 埋め込みベクトルを生成（テスト用にモック関数を使用）
    let vector: number[];
    try {
      // 実際のgetEmbeddings関数ではなく、テスト用のモック関数を使用
      vector = await mockGetEmbeddings(testData.content, vectorDim);
    } catch (error) {
      console.warn('埋め込みベクトル生成エラー:', error);
      // エラー時はダミーベクトルを使用
      vector = generateDummyVector(vectorDim);
    }
    
    // 2. LanceDBに保存
    await tbl.add([{
      id: testData.id,
      vector: vector,
      title: testData.title,
      content: testData.content
    }]);
    
    // 3. Firestoreにメタデータを保存（Firestoreが初期化されている場合）
    if (firestore) {
      await firestore.collection('chunks').doc(testData.id).set({
        pageId: testData.id,
        title: testData.title,
        spaceKey: testData.spaceKey,
        content: testData.content,
        labels: testData.labels,
        lastUpdated: new Date().toISOString()
      });
    }
    
    // 4. LanceDBから取得
    const lancedbResults = await tbl.query().where(`id = '${testData.id}'`).toArray();
    
    // LanceDBにデータが保存されていることを確認
    expect(lancedbResults.length).toBe(1);
    expect(lancedbResults[0].id).toBe(testData.id);
    expect(lancedbResults[0].title).toBe(testData.title);
    
    // 5. Firestoreから取得（Firestoreが初期化されている場合）
    if (firestore) {
      const doc = await firestore.collection('chunks').doc(testData.id).get();
      
      // Firestoreにデータが保存されていることを確認
      expect(doc.exists).toBe(true);
      expect(doc.data()?.title).toBe(testData.title);
      expect(doc.data()?.spaceKey).toBe(testData.spaceKey);
    }
  });
});