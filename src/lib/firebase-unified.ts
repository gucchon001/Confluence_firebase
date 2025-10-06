/**
 * 統一されたFirebase初期化サービス
 * クライアント/サーバーサイド両方で安全に動作
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './firebase-config';

class FirebaseUnifiedService {
  private static instance: FirebaseUnifiedService;
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private auth: Auth | null = null;

  private constructor() {}

  public static getInstance(): FirebaseUnifiedService {
    if (!FirebaseUnifiedService.instance) {
      FirebaseUnifiedService.instance = new FirebaseUnifiedService();
    }
    return FirebaseUnifiedService.instance;
  }

  public getApp(): FirebaseApp {
    if (!this.app) {
      this.app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    }
    return this.app;
  }

  public getFirestore(): Firestore {
    if (!this.db) {
      this.db = getFirestore(this.getApp());
    }
    return this.db;
  }

  public getAuth(): Auth {
    if (!this.auth) {
      this.auth = getAuth(this.getApp());
    }
    return this.auth;
  }

  public isInitialized(): boolean {
    return this.app !== null;
  }
}

// シングルトンインスタンス
export const firebaseUnified = FirebaseUnifiedService.getInstance();

// 便利なエクスポート
export const getFirebaseApp = () => firebaseUnified.getApp();
export const getFirebaseFirestore = () => firebaseUnified.getFirestore();
export const getFirebaseAuth = () => firebaseUnified.getAuth();
