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

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[API] Jiraダッシュボードデータ取得エラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Jiraダッシュボードデータ取得に失敗しました'
      },
      { status: 500 }
    );
  }
}

