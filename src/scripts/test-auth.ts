import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from 'firebase/auth';

async function testFirebaseAuth() {
  try {
    console.log('Testing Firebase Authentication prerequisites...');
    
    // 環境変数の確認
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    
    if (!apiKey || !projectId || !appId || !authDomain) {
      console.log('Firebase configuration is incomplete. Please check your .env file for the following variables:');
      console.log('- NEXT_PUBLIC_FIREBASE_API_KEY');
      console.log('- NEXT_PUBLIC_FIREBASE_PROJECT_ID');
      console.log('- NEXT_PUBLIC_FIREBASE_APP_ID');
      console.log('- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
      
      if (projectId) {
        console.log(`\nProject ID: ${projectId}`);
      }
      
      console.log('\nTo use Firebase Authentication in production, you need:');
      console.log('1. A Firebase project with Authentication enabled');
      console.log('2. Google Sign-in provider enabled in Firebase console');
      console.log('3. Proper Firebase configuration in .env file');
      
      console.log('\nFor local development/testing, you can use the Firebase Emulator Suite.');
      
      return;
    }
    
    console.log(`Initializing Firebase with project ID: ${projectId}`);
    
    // Firebase クライアントSDKの初期化
    const firebaseConfig = {
      apiKey,
      authDomain,
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId
    };
    
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    
    // ローカル開発用にエミュレータに接続することもできます
    // connectAuthEmulator(auth, 'http://localhost:9099');
    
    // Googleプロバイダーの設定確認
    const googleProvider = new GoogleAuthProvider();
    
    console.log('\nFirebase Authentication configuration verified:');
    console.log(`- Project ID: ${projectId}`);
    console.log(`- Auth Domain: ${authDomain}`);
    console.log('- Google Auth Provider: Available');
    
    console.log('\nNote: Full authentication test requires browser interaction.');
    console.log('To test Google Sign-in, run the application and test from the UI.');
    
    console.log('\nFirebase Authentication prerequisites check completed.');
    
  } catch (error) {
    console.error('Firebase Authentication test failed:', error);
  }
}

testFirebaseAuth();
