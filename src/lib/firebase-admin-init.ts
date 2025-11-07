/**
 * Firebase Admin SDK初期化ユーティリティ
 * 複数のAPIルートで共通して使用される初期化ロジック
 */

import * as admin from 'firebase-admin';
import { getApps, initializeApp } from 'firebase-admin/app';
import * as path from 'path';
import * as fs from 'fs';

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
          // Phase 8最適化: 相対パスを絶対パスに変換し、ファイル存在確認を追加
          let serviceAccountPath: string;
          
          if (path.isAbsolute(serviceAccount)) {
            // 既に絶対パスの場合
            serviceAccountPath = serviceAccount;
          } else {
            // 相対パスの場合、プロジェクトルートからの絶対パスに変換
            serviceAccountPath = path.resolve(process.cwd(), serviceAccount);
          }
          
          // ファイルが存在するか確認
          if (!fs.existsSync(serviceAccountPath)) {
            console.warn(`⚠️ Firebase Admin SDK key file not found: ${serviceAccountPath}`);
            console.warn('⚠️ Falling back to default credentials');
            initializeApp();
            return admin.app();
          }
          
          // ファイルを読み込む
          const serviceAccountData = require(serviceAccountPath);
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
      // Phase 8最適化: エラー時もデフォルト認証を試行（フォールバック）
      try {
        console.warn('⚠️ Attempting to initialize with default credentials...');
        initializeApp();
        console.log('✅ Firebase Admin SDK initialized with default credentials');
      } catch (fallbackError) {
        console.error('❌ Default credentials initialization also failed:', fallbackError);
        throw error; // 元のエラーを再スロー
      }
    }
  }
  return admin.app();
}

