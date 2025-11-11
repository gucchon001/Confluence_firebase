import 'dotenv/config';

import { Timestamp } from 'firebase-admin/firestore';

import { initializeFirebaseAdmin } from '../lib/firebase-admin-init';

async function main() {
  const [collectionName = 'jiraIssues', limitArg = '5'] = process.argv.slice(2);
  const limit = Number.parseInt(limitArg, 10);

  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error(`取得件数が不正です: ${limitArg}`);
  }

  const app = initializeFirebaseAdmin();
  const db = app.firestore();

  const collectionRef = db.collection(collectionName);

  // updatedAt が存在する場合は優先、無ければ createdAt -> ドキュメントID昇順
  const orderCandidates: Array<{ field: string; direction: 'asc' | 'desc' }> = [
    { field: 'updatedAt', direction: 'desc' },
    { field: 'createdAt', direction: 'desc' }
  ];

  let snapshot;
  for (const order of orderCandidates) {
    try {
      snapshot = await collectionRef.orderBy(order.field, order.direction).limit(limit).get();
      break;
    } catch (error) {
      if (process.env.DEBUG_FIRESTORE_ORDER === 'true') {
        console.warn(`Order by ${order.field} failed:`, error);
      }
    }
  }

  if (!snapshot) {
    // フォールバック：orderBy なしで limit
    snapshot = await collectionRef.limit(limit).get();
  }

  console.log(`Collection: ${collectionName}`);
  console.log(`Documents fetched: ${snapshot.size}`);
  snapshot.forEach((doc) => {
    const data = doc.data();
    const updatedAt = formatTimestamp(data.updatedAt ?? data.createdAt);
    console.log(`- ${doc.id}${updatedAt ? ` (updatedAt: ${updatedAt})` : ''}`);
    console.dir(data, { depth: 1 });
  });
}

function formatTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;

  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate().toISOString();
    }
  }

  return undefined;
}

main().catch((error) => {
  console.error('❌ Firestore確認に失敗しました:', error);
  process.exit(1);
});
