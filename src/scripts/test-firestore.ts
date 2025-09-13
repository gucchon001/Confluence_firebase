import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

async function testFirestore() {
  try {
    console.log('Testing Firestore prerequisites...');
    
    // 環境変数の確認
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
    
    if (!apiKey || !projectId || !appId) {
      console.log('Firebase configuration is incomplete. Please check your .env file for the following variables:');
      console.log('- NEXT_PUBLIC_FIREBASE_API_KEY');
      console.log('- NEXT_PUBLIC_FIREBASE_PROJECT_ID');
      console.log('- NEXT_PUBLIC_FIREBASE_APP_ID');
      
      if (projectId) {
        console.log(`\nProject ID: ${projectId}`);
      }
      
      console.log('\nTo use Firestore in production, you need:');
      console.log('1. A Firebase project with Firestore enabled');
      console.log('2. Proper Firebase configuration in .env file');
      console.log('3. Firebase Authentication set up for user access control');
      console.log('4. Firestore security rules configured');
      
      console.log('\nFor local development/testing, you can use the Firebase Emulator Suite.');
      
      return;
    }
    
    console.log(`Initializing Firebase with project ID: ${projectId}`);
    
    // Firebase クライアントSDKの初期化
    const firebaseConfig = {
      apiKey,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId
    };
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // ローカル開発用にエミュレータに接続することもできます
    // connectFirestoreEmulator(db, 'localhost', 8080);
    
    console.log('\nFirestore configuration verified.');
    console.log('Note: Full connectivity test requires Firebase Authentication.');
    console.log('To test with real Firestore, deploy the app or use Firebase Emulator Suite.');
    
    console.log('\nFirestore prerequisites check completed.');
    
  } catch (error) {
    console.error('Firestore test failed:', error);
  }
}

testFirestore();
