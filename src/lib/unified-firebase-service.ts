/**
 * 統一されたFirebase初期化サービス
 * 重複コードを解消し、一貫したFirebase初期化を提供
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import * as admin from 'firebase-admin';
import * as path from 'path';
import { firebaseConfig } from './firebase-config';

export interface FirebaseServices {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
  admin?: admin.app.App;
}

export interface FirebaseInitializationOptions {
  enableAdmin?: boolean;
  serviceAccountPath?: string;
}

/**
 * 統一されたFirebase初期化サービス
 */
export class UnifiedFirebaseService {
  private static instance: UnifiedFirebaseService;
  private services: FirebaseServices | null = null;
  private isInitialized = false;

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): UnifiedFirebaseService {
    if (!UnifiedFirebaseService.instance) {
      UnifiedFirebaseService.instance = new UnifiedFirebaseService();
    }
    return UnifiedFirebaseService.instance;
  }

  /**
   * Firebaseサービスを初期化
   */
  async initialize(options: FirebaseInitializationOptions = {}): Promise<FirebaseServices> {
    if (this.isInitialized && this.services) {
      return this.services;
    }

    try {
      console.log('[UnifiedFirebaseService] Initializing Firebase services...');

      // クライアントサイドFirebase初期化
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      const auth = getAuth(app);

      const services: FirebaseServices = {
        app,
        db,
        auth
      };

      // 管理者SDKの初期化（オプション）
      if (options.enableAdmin) {
        try {
          const adminApp = await this.initializeAdmin(options.serviceAccountPath);
          services.admin = adminApp;
          console.log('✅ Firebase Admin SDK initialized');
        } catch (error) {
          console.warn('⚠️ Firebase Admin SDK initialization failed:', error);
          // 管理者SDKの初期化に失敗してもクライアントSDKは継続
        }
      }

      this.services = services;
      this.isInitialized = true;
      
      console.log('✅ Firebase services initialized successfully');
      return services;

    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      throw error;
    }
  }

  /**
   * Firebase管理者SDKを初期化
   */
  private async initializeAdmin(serviceAccountPath?: string): Promise<admin.app.App> {
    if (admin.apps.length > 0) {
      return admin.apps[0]!;
    }

    const serviceAccount = serviceAccountPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (!serviceAccount) {
      throw new Error('Service account path not provided for Firebase Admin SDK');
    }

    const serviceAccountData = require(path.resolve(serviceAccount));
    
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccountData)
    });
  }

  /**
   * 初期化済みのサービスを取得
   */
  getServices(): FirebaseServices {
    if (!this.isInitialized || !this.services) {
      throw new Error('Firebase services not initialized. Call initialize() first.');
    }
    return this.services;
  }

  /**
   * 初期化状態を確認
   */
  isReady(): boolean {
    return this.isInitialized && this.services !== null;
  }

  /**
   * テスト用のFirebase初期化（統合テスト用）
   */
  static async initializeForTesting(serviceAccountPath?: string): Promise<boolean> {
    try {
      const service = UnifiedFirebaseService.getInstance();
      await service.initialize({
        enableAdmin: true,
        serviceAccountPath
      });
      return true;
    } catch (error) {
      console.warn('Firebase Admin SDK initialization failed in test:', error);
      return false;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const unifiedFirebaseService = UnifiedFirebaseService.getInstance();

// 既存のAPI互換性のための関数
export async function initializeFirebase(): Promise<boolean> {
  try {
    await unifiedFirebaseService.initialize();
    return true;
  } catch (error) {
    console.warn('Firebase initialization failed:', error);
    return false;
  }
}

// テスト用のダミーベクトル生成関数（統合テスト用）
export function generateDummyVector(dimension: number): number[] {
  return Array(dimension).fill(0).map(() => Math.random());
}
