/**
 * システムヘルス監視API
 * GET /api/admin/system-health
 */

import { NextRequest, NextResponse } from 'next/server';
import { systemHealthService } from '@/lib/system-health-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // システムヘルスステータスを取得
    const health = await systemHealthService.getSystemStatus();

    return NextResponse.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('[API] システムヘルス取得エラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'システムヘルス取得に失敗しました',
      },
      { status: 500 }
    );
  }
}

