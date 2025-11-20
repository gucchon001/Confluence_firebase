/**
 * Jiraダッシュボードフィルタオプション取得API
 * GET /api/admin/jira-dashboard/filter-options
 */

import { NextRequest, NextResponse } from 'next/server';
import { jiraDashboardService } from '@/lib/jira-dashboard-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const options = await jiraDashboardService.getFilterOptions();

    return NextResponse.json({
      success: true,
      data: options
    });
  } catch (error) {
    console.error('[API] Jiraフィルタオプション取得エラー:', error);
    const errorMessage = error instanceof Error ? error.message : 'フィルタオプション取得に失敗しました';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[API] エラー詳細:', { errorMessage, errorStack });
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

