/**
 * キャッシュクリアAPI
 * 永続化キャッシュとメモリキャッシュをクリア
 */

import { NextRequest, NextResponse } from 'next/server';
import { clearCache, getCacheStats } from '@/lib/persistent-cache';

export const POST = async (req: NextRequest) => {
  try {
    console.log('🗑️ [API] Clear cache request received');
    
    // クリア前の統計情報を取得
    const statsBefore = getCacheStats();
    
    // キャッシュをクリア
    clearCache();
    
    // クリア後の統計情報を取得
    const statsAfter = getCacheStats();
    
    const result = {
      success: true,
      message: 'キャッシュが正常にクリアされました',
      stats: {
        before: statsBefore,
        after: statsAfter
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ [API] Cache cleared successfully:', result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ [API] Failed to clear cache:', error);
    
    return NextResponse.json({
      success: false,
      message: 'キャッシュクリアに失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};

// OPTIONS メソッドのサポート（CORS）
export const OPTIONS = async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
