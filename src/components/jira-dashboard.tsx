'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  RefreshCw, 
  Filter, 
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Target,
  Search,
  ExternalLink
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { JiraDashboardData, JiraDashboardFilters } from '@/lib/jira-dashboard-service';

interface JiraDashboardProps {
  className?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const JiraDashboard: React.FC<JiraDashboardProps> = ({ className }) => {
  const [dashboardData, setDashboardData] = useState<JiraDashboardData | null>(null);
  const [filterOptions, setFilterOptions] = useState<{
    statuses: string[];
    statusCategories: string[];
    assignees: string[];
    priorities: string[];
    issueTypes: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  // フィルタ状態
  const [filters, setFilters] = useState<JiraDashboardFilters>({
    period: 'all',
    granularity: 'week'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [showIssueDetail, setShowIssueDetail] = useState(false);

  // データ取得
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // フィルタオプションを取得
      const optionsResponse = await fetch('/api/admin/jira-dashboard/filter-options');
      if (!optionsResponse.ok) throw new Error('フィルタオプション取得に失敗しました');
      const optionsData = await optionsResponse.json();
      if (optionsData.success) {
        setFilterOptions(optionsData.data);
      }

      // ダッシュボードデータを取得
      const params = new URLSearchParams();
      if (filters.period) params.append('period', filters.period);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.granularity) params.append('granularity', filters.granularity);
      if (filters.status?.length) params.append('status', filters.status.join(','));
      if (filters.statusCategory?.length) params.append('statusCategory', filters.statusCategory.join(','));
      if (filters.assignee?.length) params.append('assignee', filters.assignee.join(','));
      if (filters.priority?.length) params.append('priority', filters.priority.join(','));
      if (filters.issueType?.length) params.append('issueType', filters.issueType.join(','));
      if (filters.completedStatusFilter?.length) params.append('completedStatusFilter', filters.completedStatusFilter.join(','));
      if (filters.searchQuery?.trim()) params.append('searchQuery', filters.searchQuery.trim());

      const response = await fetch(`/api/admin/jira-dashboard?${params.toString()}`);
      if (!response.ok) throw new Error('ダッシュボードデータ取得に失敗しました');
      
      const data = await response.json();
      if (data.success) {
        setDashboardData(data.data);
        setLastUpdateTime(new Date());
      } else {
        throw new Error(data.error || 'データ取得に失敗しました');
      }
    } catch (err) {
      console.error('Jiraダッシュボードデータ取得エラー:', err);
      setError(err instanceof Error ? err.message : 'データ取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 統計カード用のデータ準備
  const stats = dashboardData?.stats;
  const trends = dashboardData?.trends || [];

  // ステータスカテゴリ別の集計
  const statusCategoryData = stats ? Object.entries(stats.byStatusCategory).map(([name, value]) => ({
    name,
    value
  })) : [];

  // 担当者別の集計（上位10件）
  const assigneeData = stats ? Object.entries(stats.byAssignee)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      value
    })) : [];

  // 優先度別の集計
  const priorityData = stats ? Object.entries(stats.byPriority).map(([name, value]) => ({
    name,
    value
  })) : [];

  return (
    <div className={className}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Jiraダッシュボード</h2>
            <p className="text-sm text-muted-foreground">
              最終更新: {lastUpdateTime.toLocaleString('ja-JP')}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* フィルター */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            フィルター
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">期間</label>
              <Select
                value={filters.period || 'all'}
                onValueChange={(value) => setFilters({ ...filters, period: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全期間</SelectItem>
                  <SelectItem value="1month">直近1ヶ月</SelectItem>
                  <SelectItem value="3months">直近3ヶ月</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">粒度</label>
                <Select
                  value={filters.granularity || 'week'}
                  onValueChange={(value) => setFilters({ ...filters, granularity: value as 'day' | 'week' | 'month' })}
                >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">日単位</SelectItem>
                  <SelectItem value="week">週単位</SelectItem>
                  <SelectItem value="month">月単位</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filterOptions && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">ステータスカテゴリ</label>
                  <Select
                    value={filters.statusCategory?.join(',') || 'all'}
                    onValueChange={(value) => setFilters({
                      ...filters,
                      statusCategory: value === 'all' ? undefined : value.split(',')
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      {filterOptions.statusCategories.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">担当者</label>
                  <Select
                    value={filters.assignee?.join(',') || 'all'}
                    onValueChange={(value) => setFilters({
                      ...filters,
                      assignee: value === 'all' ? undefined : value.split(',')
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      {filterOptions.assignees.map((assignee) => (
                        <SelectItem key={assignee} value={assignee}>{assignee}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <>
          {/* 統計カード */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">総課題数</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <Target className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">To Do</p>
                    <p className="text-2xl font-bold">{stats.byStatusCategory['To Do'] || stats.byStatusCategory['未着手'] || 0}</p>
                  </div>
                  <Clock className="h-8 w-8 text-gray-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">進行中</p>
                    <p className="text-2xl font-bold">{stats.byStatusCategory['In Progress'] || stats.byStatusCategory['進行中'] || 0}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">完了</p>
                    <p className="text-2xl font-bold">{stats.byStatusCategory['Done'] || stats.byStatusCategory['完了'] || 0}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* グラフ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* ステータス推移グラフ */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>ステータス推移</CardTitle>
                  {filterOptions && (
                    <Select
                      value={filters.completedStatusFilter?.join(',') || 'all'}
                      onValueChange={(value) => {
                        setFilters({
                          ...filters,
                          completedStatusFilter: value === 'all' ? undefined : value.split(',')
                        });
                        setTimeout(() => fetchData(), 100);
                      }}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="完了件数フィルタ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべてのステータス</SelectItem>
                        {filterOptions.statusCategories.map((status) => (
                          <SelectItem key={status} value={status}>{status}のみ</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#8884d8" name="総数" />
                    <Line type="monotone" dataKey="toDo" stroke="#9ca3af" name="To Do" />
                    <Line type="monotone" dataKey="inProgress" stroke="#fbbf24" name="進行中" />
                    <Line type="monotone" dataKey="done" stroke="#10b981" name="完了" />
                    <Line type="monotone" dataKey="completed" stroke="#ef4444" name="完了件数" strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* ステータスカテゴリ別分布 */}
            <Card>
              <CardHeader>
                <CardTitle>ステータスカテゴリ別分布</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusCategoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* 担当者別・優先度別 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 担当者別ワークロード */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  担当者別ワークロード（上位10件）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={assigneeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 優先度別分布 */}
            <Card>
              <CardHeader>
                <CardTitle>優先度別分布</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={priorityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* 個別案件一覧 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>個別案件一覧</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Issue Key、タイトル、担当者で検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const newFilters = { ...filters, searchQuery: searchQuery.trim() };
                          setFilters(newFilters);
                        }
                      }}
                      className="pl-8 w-64"
                    />
                  </div>
                  <Button 
                    onClick={() => {
                      const newFilters = { ...filters, searchQuery: searchQuery.trim() };
                      setFilters(newFilters);
                    }} 
                    size="sm"
                  >
                    検索
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardData?.issues && dashboardData.issues.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-4">
                    検索結果: {dashboardData.totalIssues || dashboardData.issues.length}件
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Issue Key</TableHead>
                        <TableHead>タイトル</TableHead>
                        <TableHead>ステータス</TableHead>
                        <TableHead>担当者</TableHead>
                        <TableHead>優先度</TableHead>
                        <TableHead>更新日</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardData.issues.slice(0, 50).map((issue) => (
                        <TableRow 
                          key={issue.issue_key}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setSelectedIssue(issue.issue_key);
                            setShowIssueDetail(true);
                          }}
                        >
                          <TableCell className="font-mono">{issue.issue_key}</TableCell>
                          <TableCell className="max-w-md truncate">{issue.title}</TableCell>
                          <TableCell>
                            <Badge variant={
                              issue.status_category === 'Done' || issue.status_category === '完了' ? 'default' :
                              issue.status_category === 'In Progress' || issue.status_category === '進行中' ? 'secondary' :
                              'outline'
                            }>
                              {issue.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{issue.assignee}</TableCell>
                          <TableCell>
                            <Badge variant={
                              issue.priority === 'Highest' ? 'destructive' :
                              issue.priority === 'High' ? 'default' :
                              'outline'
                            }>
                              {issue.priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(issue.updated_at).toLocaleDateString('ja-JP')}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(issue.url, '_blank');
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {dashboardData.issues.length > 50 && (
                    <p className="text-sm text-muted-foreground text-center mt-4">
                      表示件数: 50件 / 全{dashboardData.issues.length}件
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery ? '検索結果が見つかりませんでした' : '案件データがありません'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 個別案件詳細ダイアログ */}
          <Dialog open={showIssueDetail} onOpenChange={setShowIssueDetail}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>案件詳細: {selectedIssue}</DialogTitle>
              </DialogHeader>
              {selectedIssue && dashboardData?.issues && (
                <IssueDetail issueKey={selectedIssue} issues={dashboardData.issues} />
              )}
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
};

// 個別案件詳細コンポーネント
const IssueDetail: React.FC<{ issueKey: string; issues: any[] }> = ({ issueKey, issues }) => {
  const issue = issues.find(i => i.issue_key === issueKey);
  const [issueDetail, setIssueDetail] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (issue) {
      setIsLoading(true);
      // Firestoreから詳細情報を取得
      fetch(`/api/admin/jira-dashboard/issue/${issueKey}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setIssueDetail(data.data);
          }
        })
        .catch(err => console.error('詳細取得エラー:', err))
        .finally(() => setIsLoading(false));
    }
  }, [issueKey, issue]);

  if (!issue) return <p>案件が見つかりませんでした</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">タイトル</p>
          <p className="text-lg font-semibold">{issue.title}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">ステータス</p>
          <Badge>{issue.status}</Badge>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">担当者</p>
          <p>{issue.assignee}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">優先度</p>
          <Badge>{issue.priority}</Badge>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">作成日</p>
          <p>{new Date(issue.created_at).toLocaleString('ja-JP')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">更新日</p>
          <p>{new Date(issue.updated_at).toLocaleString('ja-JP')}</p>
        </div>
      </div>
      {issue.url && (
        <div>
          <Button
            variant="outline"
            onClick={() => window.open(issue.url, '_blank')}
            className="w-full"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Jiraで開く
          </Button>
        </div>
      )}
      {isLoading && <p className="text-center text-muted-foreground">詳細情報を読み込み中...</p>}
      {issueDetail && (
        <div className="space-y-4">
          {issueDetail.comments && issueDetail.comments.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">コメント履歴 ({issueDetail.comments.length}件)</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {issueDetail.comments.map((comment: any, idx: number) => (
                  <Card key={idx} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{comment.author}</p>
                      <p className="text-xs text-muted-foreground">{comment.created}</p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

