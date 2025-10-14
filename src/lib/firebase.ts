'use client';
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Your web app's Firebase configuration
import { firebaseConfig } from './firebase-config';

// Initialize Firebase
// クライアントサイドとサーバーサイドの両方でFirebaseアプリを安全に初期化します。
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firestoreの設定を最適化（リスナーエラー対策）
if (!getApps().length || getApps().length === 1) {
  try {
    initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (error) {
    // 既に初期化されている場合はエラーを無視
    console.log('Firestore already initialized');
  }
}

export { app };
