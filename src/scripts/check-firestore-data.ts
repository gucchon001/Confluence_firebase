import 'dotenv/config';
import * as admin from 'firebase-admin';

async function checkFirestoreData() {
  // Firebase Admin SDKの初期化
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  const db = admin.firestore();
  const chunksRef = db.collection('chunks');

  console.log('Fetching first 5 documents from the "chunks" collection...');

  try {
    const snapshot = await chunksRef.limit(5).get();

    if (snapshot.empty) {
      console.log('No documents found in the "chunks" collection.');
      return;
    }

    console.log(`Found ${snapshot.size} documents:`);
    snapshot.forEach(doc => {
      console.log(`\nDocument ID: ${doc.id}`);
      console.log('Data:', JSON.stringify(doc.data(), null, 2));
    });

  } catch (error) {
    console.error('Error fetching data from Firestore:', error);
  }
}

checkFirestoreData();

