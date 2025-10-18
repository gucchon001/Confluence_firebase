'use client';
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
import { firebaseConfig } from './firebase-config';

// Initialize Firebase
// クライアントサイドとサーバーサイドの両方でFirebaseアプリを安全に初期化します。
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// デフォルトのFirestore初期化（より安全）
// persistentLocalCacheは一部の環境で400エラーを引き起こすため、デフォルト設定を使用
if (typeof window !== 'undefined') {
  try {
    getFirestore(app);
    console.log('✅ Firestore initialized successfully with default settings');
  } catch (error) {
    console.error('❌ Firestore initialization error:', error);
  }
}

export { app };
