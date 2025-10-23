/**
 * アプリケーション起動時のデータ初期化
 * LanceDBデータが存在しない場合、自動的にダウンロード
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// グローバル変数で初期化状態を管理
let isInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

async function initializeData(): Promise<boolean> {
  if (isInitialized) {
    return true;
  }
  
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = (async () => {
    try {
      console.log('🔧 [AppInit] Checking LanceDB data availability...');
      
      // LanceDBデータの存在確認
      const lancedbPath = path.join(process.cwd(), '.lancedb');
      const hasLocalCache = fs.existsSync(lancedbPath);
      
      if (hasLocalCache) {
        console.log('✅ [AppInit] LanceDB data already exists');
        isInitialized = true;
        return true;
      }
      
      console.log('📥 [AppInit] LanceDB data not found, downloading...');
      
      // データダウンロード実行
      const { execSync } = require('child_process');
      execSync('npx tsx scripts/download-production-data.ts', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      console.log('✅ [AppInit] LanceDB data download completed');
      isInitialized = true;
      return true;
      
    } catch (error) {
      console.error('❌ [AppInit] Failed to initialize data:', error);
      return false;
    }
  })();
  
  return initializationPromise;
}

export async function GET(request: NextRequest) {
  try {
    const success = await initializeData();
    
    if (success) {
      return NextResponse.json({ 
        status: 'success', 
        message: 'Data initialization completed',
        initialized: true 
      });
    } else {
      return NextResponse.json({ 
        status: 'error', 
        message: 'Data initialization failed',
        initialized: false 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ [AppInit] Initialization error:', error);
    
    return NextResponse.json({ 
      status: 'error', 
      message: 'Initialization error',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// 初期化関数をエクスポート（他のモジュールから使用可能）
export { initializeData };
