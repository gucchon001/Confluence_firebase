/**
 * Firebase Admin SDK初期化ユーティリティ
 * 複数のAPIルートで共通して使用される初期化ロジック
 */

import * as admin from 'firebase-admin';
import { getApps, initializeApp } from 'firebase-admin/app';

/**
 * Firebase Admin SDKを初期化する
 * すでに初期化されている場合は既存のアプリを返す
 */
export function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    try {
      // 環境変数からサービスアカウントキーを取得
      const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      if (serviceAccount) {
        try {
          // JSON文字列として解析を試みる
          const serviceAccountData = JSON.parse(serviceAccount);
          initializeApp({
            credential: admin.credential.cert(serviceAccountData),
            projectId: process.env.FIREBASE_PROJECT_ID || serviceAccountData.project_id
          });
          console.log('✅ Firebase Admin SDK initialized from JSON');
        } catch (parseError) {
          // ファイルパスとして扱う
          const serviceAccountData = require(serviceAccount);
          initializeApp({
            credential: admin.credential.cert(serviceAccountData),
            projectId: process.env.FIREBASE_PROJECT_ID || serviceAccountData.project_id
          });
          console.log('✅ Firebase Admin SDK initialized from file');
        }
      } else {
        console.warn('⚠️ GOOGLE_APPLICATION_CREDENTIALS not set, using default credentials');
        initializeApp();
      }
    } catch (error) {
      console.error('❌ Firebase Admin SDK initialization failed:', error);
      throw error;
    }
  }
  return admin.app();
}

