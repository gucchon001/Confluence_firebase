/**
 * Jiraダッシュボード統計データ取得API
 * GET /api/admin/jira-dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { jiraDashboardService, type JiraDashboardFilters } from '@/lib/jira-dashboard-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // フィルタパラメータを取得
    const filters: JiraDashboardFilters = {
      period: (searchParams.get('period') as any) || 'all',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      granularity: (searchParams.get('granularity') as 'day' | 'week' | 'month') || 'week',
      status: searchParams.get('status')?.split(',').filter(Boolean),
      statusCategory: searchParams.get('statusCategory')?.split(',').filter(Boolean),
      assignee: searchParams.get('assignee')?.split(',').filter(Boolean),
      priority: searchParams.get('priority')?.split(',').filter(Boolean),
      issueType: searchParams.get('issueType')?.split(',').filter(Boolean),
      completedStatusFilter: searchParams.get('completedStatusFilter')?.split(',').filter(Boolean),
      searchQuery: searchParams.get('searchQuery') || undefined
    };

    // ダッシュボードデータを取得
    const data = await jiraDashboardService.getDashboardData(filters);

    // キャッシュヘッダーを設定（3分間）
    const response = NextResponse.json({
      success: true,
      data
    });
    
    // ブラウザとCDNのキャッシュを設定（3分間）
    response.headers.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=300');
    
    return response;
  } catch (error) {
    console.error('[API] Jiraダッシュボードデータ取得エラー:', error);
    const errorMessage = error instanceof Error ? error.message : 'Jiraダッシュボードデータ取得に失敗しました';
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

