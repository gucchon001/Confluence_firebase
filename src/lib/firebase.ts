'use client';
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from 'firebase/app';

// Your web app's Firebase configuration
import { firebaseConfig } from './firebase-config';

// Initialize Firebase
// クライアントサイドとサーバーサイドの両方でFirebaseアプリを安全に初期化します。
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export { app };
