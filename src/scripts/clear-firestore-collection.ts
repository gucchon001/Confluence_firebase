import 'dotenv/config';
import * as admin from 'firebase-admin';
import minimist from 'minimist';

// Firebase Admin SDKの初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

/**
 * 指定されたコレクションのすべてのドキュメントを削除する
 * @param collectionPath 削除するコレクションのパス
 * @param batchSize 1回のバッチで削除するドキュメント数
 */
async function deleteCollection(collectionPath: string, batchSize: number) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise<void>((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

/**
 * クエリに一致するドキュメントをバッチで削除する
 * @param query 削除対象のドキュメントを取得するクエリ
 * @param resolve プロセス完了時に呼び出すPromiseのresolve関数
 */
async function deleteQueryBatch(
  query: admin.firestore.Query,
  resolve: () => void
) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // ドキュメントがなくなったら終了
    resolve();
    return;
  }

  // バッチ削除を実行
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // ログを出力
  process.stdout.write(`Deleted ${batchSize} documents.\n`);

  // 次のバッチを処理
  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

/**
 * メイン関数
 */
async function main() {
  const args = minimist(process.argv.slice(2));
  const collectionName = args.collection;

  if (!collectionName) {
    console.error('Please specify a collection to delete with --collection=<collectionName>');
    return;
  }

  console.log(`Deleting all documents from the "${collectionName}" collection...`);
  await deleteCollection(collectionName, 500);
  console.log(`Successfully deleted all documents from "${collectionName}".`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

