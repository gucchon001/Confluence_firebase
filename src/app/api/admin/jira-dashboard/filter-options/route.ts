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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'フィルタオプション取得に失敗しました'
      },
      { status: 500 }
    );
  }
}

