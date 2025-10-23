/**
 * データ初期化API
 * アプリケーション起動時にLanceDBデータをダウンロード
 */
import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    console.log('🔧 [DataInit] Checking LanceDB data availability...');
    
    // LanceDBデータの存在確認
    const lancedbPath = path.join(process.cwd(), '.lancedb');
    const hasLocalCache = fs.existsSync(lancedbPath);
    
    if (hasLocalCache) {
      console.log('✅ [DataInit] LanceDB data already exists');
      return NextResponse.json({ 
        status: 'success', 
        message: 'LanceDB data already available',
        hasData: true 
      });
    }
    
    console.log('📥 [DataInit] LanceDB data not found, downloading...');
    
    // データダウンロード実行
    execSync('npx tsx scripts/download-production-data.ts', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log('✅ [DataInit] LanceDB data download completed');
    
    return NextResponse.json({ 
      status: 'success', 
      message: 'LanceDB data downloaded successfully',
      hasData: true 
    });
    
  } catch (error) {
    console.error('❌ [DataInit] Failed to initialize data:', error);
    
    return NextResponse.json({ 
      status: 'error', 
      message: 'Failed to initialize data',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
