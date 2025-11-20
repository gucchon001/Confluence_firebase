'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatMessageContent, sharedMarkdownComponents } from '@/lib/markdown-utils';
import {
  getEnvironment,
  getDataSource,
  getEnvironmentColor,
  getDataSourceColor,
  getEnvironmentName,
  getDataSourceName
} from '@/lib/environment-utils';
import { 
  BarChart3, 
  Users, 
  Activity, 
  AlertTriangle, 
  Clock, 
  Search, 
  Brain, 
  Shield,
  Eye,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
  FileText,
  RefreshCw,
  Filter,
  RotateCcw,
  Zap,
  Target,
  BarChart,
  X,
  Copy,
  CheckCircle2,
  Star,
  ThumbsUp,
  ThumbsDown,
  Database,
  Trash2,
  Loader2,
  User as UserIcon
} from 'lucide-react';
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
import { adminService } from '@/lib/admin-service';
import { postLogService } from '@/lib/post-log-service';
import { performanceAlertService } from '@/lib/performance-alert-service';
import { errorAnalysisService } from '@/lib/error-analysis-service';
// system-health-serviceはサーバーサイドのみのため、API経由で使用
// import { systemHealthService } from '@/lib/system-health-service';
import { useAdmin } from '@/hooks/use-admin';
import { useAuthWrapper } from '@/hooks/use-auth-wrapper';
import { JiraDashboard } from '@/components/jira-dashboard';
import { GoogleDriveImportSection } from '@/components/google-drive-import-section';
import type { AdminUser, PostLog, Reference, SatisfactionRating, PerformanceAlert, ErrorLog, SystemHealth } from '@/types';
import type { ErrorAnalysis } from '@/lib/error-analysis-service';

// ダミーデータ（実際の実装ではAPIから取得）
const mockPostLogs: PostLog[] = [
  {
    id: '1',
    userId: 'user1',
    question: '教室管理の詳細は？',
    answer: '教室管理機能について...',
    serverStartupTime: 5,
    ttfbTime: 320,
    searchTime: 2300,
    aiGenerationTime: 15200,
    totalTime: 17500,
    referencesCount: 7,
    answerLength: 1247,
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    processingSteps: [
      { step: '検索', status: 'completed', duration: 2300, timestamp: new Date() },
      { step: 'AI生成', status: 'completed', duration: 15200, timestamp: new Date() }
    ],
    metadata: {
      sessionId: 'session1',
      userAgent: 'Mozilla/5.0...',
      ipAddress: '192.168.1.100'
    }
  },
  {
    id: '2',
    userId: 'user2',
    question: 'ログイン認証の仕組みは？',
    answer: 'ログイン認証について...',
    serverStartupTime: 5,
    ttfbTime: 280,
    searchTime: 1800,
    aiGenerationTime: 12800,
    totalTime: 14600,
    referencesCount: 5,
    answerLength: 892,
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    processingSteps: [
      { step: '検索', status: 'completed', duration: 1800, timestamp: new Date() },
      { step: 'AI生成', status: 'completed', duration: 12800, timestamp: new Date() }
    ],
    metadata: {
      sessionId: 'session2',
      userAgent: 'Mozilla/5.0...',
      ipAddress: '192.168.1.101'
    }
  }
];

// Markdown components are now imported from @/lib/markdown-utils

const AdminDashboard: React.FC = () => {
  const { user: currentUser } = useAuthWrapper();
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [postLogs, setPostLogs] = useState<PostLog[]>([]);
  const [filteredPostLogs, setFilteredPostLogs] = useState<PostLog[]>([]);
  const [feedbacks, setFeedbacks] = useState<SatisfactionRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<PostLog | null>(null);
  const [showLogDetail, setShowLogDetail] = useState(false);
  
  // フィルタリング状態
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<string>('all');
  const [environmentFilter, setEnvironmentFilter] = useState<string>('all');
  const [dataSourceFilter, setDataSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // ページネーション状態
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  // リアルタイム更新の状態（デフォルトで無効）
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  
  // キャッシュクリア機能（すべてのHooksは早期リターンの前に呼び出す必要がある）
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'clearing' | 'success' | 'error'>('idle');
  
  // パフォーマンスアラート状態
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  
  // エラー分析状態
  const [errorAnalysis, setErrorAnalysis] = useState<ErrorAnalysis | null>(null);
  
  // システムヘルス状態
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // Jira完了数統計
  const [jiraCompletedStats, setJiraCompletedStats] = useState({
    thisMonth: 0,
    thisWeek: 0,
    today: 0,
    yesterday: 0
  });

  // データ取得関数をuseCallbackなしで定義
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // ユーザー一覧、投稿ログ、評価フィードバックを並行して取得
      console.log('🔍 管理ダッシュボード: データ取得開始');
      
      // 評価フィードバックを取得する内部関数
      const fetchFeedbacks = async (): Promise<SatisfactionRating[]> => {
        try {
          const response = await fetch('/api/admin/feedback?limit=100');
          if (!response.ok) {
            throw new Error('評価フィードバックの取得に失敗しました');
          }
          const data = await response.json();
          return data.data || [];
        } catch (error) {
          console.error('評価フィードバック取得エラー:', error);
          return [];
        }
      };
      
      // 投稿ログの上限を解除（全件取得）
      const [userList, allLogs, feedbackList] = await Promise.all([
        adminService.getAllUsers(),
        postLogService.getRecentPostLogs(10000), // 上限を大幅に増やす
        fetchFeedbacks() // 評価フィードバックを取得
      ]);
      
      // Jiraの完了数を取得（今月、今週、本日、昨日）
      let jiraCompletedStats = {
        thisMonth: 0,
        thisWeek: 0,
        today: 0,
        yesterday: 0
      };
      
      try {
        const params = new URLSearchParams();
        params.append('period', '3months'); // より長い期間で取得してデータを確認
        params.append('granularity', 'day');
        
        // リトライロジック（503エラー対策）
        let jiraResponse: Response | null = null;
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 1000; // 1秒
        
        while (retryCount < maxRetries) {
          try {
            jiraResponse = await fetch(`/api/admin/jira-dashboard?${params.toString()}`);
            if (jiraResponse.ok || jiraResponse.status !== 503) {
              break; // 成功または503以外のエラーなら終了
            }
          } catch (error) {
            console.warn(`[AdminDashboard] Jiraダッシュボード取得エラー（リトライ ${retryCount + 1}/${maxRetries}）:`, error);
          }
          
          if (retryCount < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1))); // 指数バックオフ
          }
          retryCount++;
        }
        
        if (jiraResponse && jiraResponse.ok) {
          const jiraData = await jiraResponse.json();
          console.log('📊 JiraダッシュボードAPI レスポンス:', {
            success: jiraData.success,
            trendsCount: jiraData.data?.trends?.length || 0,
            trendsSample: jiraData.data?.trends?.slice(0, 5) || [],
            stats: jiraData.data?.stats
          });
          
          if (jiraData.success && jiraData.data?.trends) {
            const trends = jiraData.data.trends || [];
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            startOfMonth.setHours(0, 0, 0, 0);
            
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            
            const startOfToday = new Date(now);
            startOfToday.setHours(0, 0, 0, 0);
            
            const startOfYesterday = new Date(startOfToday);
            startOfYesterday.setDate(startOfYesterday.getDate() - 1);
            startOfYesterday.setHours(0, 0, 0, 0);
            
            const endOfYesterday = new Date(startOfToday);
            endOfYesterday.setHours(0, 0, 0, 0);
            
            // 日付比較のデバッグ
            console.log('📅 日付範囲:', {
              now: now.toISOString(),
              startOfMonth: startOfMonth.toISOString(),
              startOfWeek: startOfWeek.toISOString(),
              startOfToday: startOfToday.toISOString(),
              startOfYesterday: startOfYesterday.toISOString(),
              trendsDates: trends.map((t: any) => ({ date: t.date, completed: t.completed }))
            });
            
            // 今月の完了数をトレンドデータから集計
            const monthTrends = trends.filter((t: any) => {
              if (!t.date) return false;
              const trendDate = new Date(t.date);
              trendDate.setHours(0, 0, 0, 0);
              return trendDate >= startOfMonth;
            });
            jiraCompletedStats.thisMonth = monthTrends.reduce((sum: number, t: any) => sum + (Number(t.completed) || 0), 0);
            
            // 今週の完了数を集計
            const weekTrends = trends.filter((t: any) => {
              if (!t.date) return false;
              const trendDate = new Date(t.date);
              trendDate.setHours(0, 0, 0, 0);
              return trendDate >= startOfWeek;
            });
            jiraCompletedStats.thisWeek = weekTrends.reduce((sum: number, t: any) => sum + (Number(t.completed) || 0), 0);
            
            // 本日の完了数を集計
            const todayTrend = trends.find((t: any) => {
              if (!t.date) return false;
              const trendDate = new Date(t.date);
              trendDate.setHours(0, 0, 0, 0);
              const todayStart = new Date(startOfToday);
              todayStart.setHours(0, 0, 0, 0);
              return trendDate.getTime() === todayStart.getTime();
            });
            jiraCompletedStats.today = todayTrend ? (Number(todayTrend.completed) || 0) : 0;
            
            // 昨日の完了数を集計
            const yesterdayTrend = trends.find((t: any) => {
              if (!t.date) return false;
              const trendDate = new Date(t.date);
              trendDate.setHours(0, 0, 0, 0);
              const yesterdayStart = new Date(startOfYesterday);
              yesterdayStart.setHours(0, 0, 0, 0);
              return trendDate.getTime() === yesterdayStart.getTime();
            });
            jiraCompletedStats.yesterday = yesterdayTrend ? (Number(yesterdayTrend.completed) || 0) : 0;
            
            console.log('📊 Jira完了数統計:', jiraCompletedStats, {
              monthTrendsCount: monthTrends.length,
              weekTrendsCount: weekTrends.length,
              todayTrend,
              yesterdayTrend
            });
          } else {
            console.warn('Jiraダッシュボードデータが不正:', jiraData);
          }
        } else {
          console.warn('JiraダッシュボードAPIエラー:', jiraResponse.status, jiraResponse.statusText);
        }
      } catch (err) {
        console.error('Jira完了数取得エラー:', err);
      }
      
      console.log('📊 管理ダッシュボード: データ取得完了', {
        userCount: userList.length,
        postLogCount: allLogs.length,
        jiraCompletedStats,
        usersSample: userList.slice(0, 3).map(u => ({ uid: u.uid, displayName: u.displayName, email: u.email })),
        logsUserIds: [...new Set(allLogs.map(log => log.userId))].slice(0, 10),
        logsWithAnonymous: allLogs.filter(log => log.userId === 'anonymous' || log.metadata?.userDisplayName === 'anonymous').length,
        logsWithUserDisplayName: allLogs.filter(log => log.metadata?.userDisplayName && log.metadata.userDisplayName !== 'anonymous').length
      });
      
      
      setUsers(userList);
      setPostLogs(allLogs);
      setFeedbacks(feedbackList);
      setJiraCompletedStats(jiraCompletedStats);
      setLastUpdateTime(new Date());
      
      // データ取得後に即座にフィルター適用（useEffectを使わない）
      // これにより、無限ループを防ぐ
    } catch (err) {
      console.error('Error loading data:', err);
      setError('データの取得中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };


  // ページネーション適用
  const paginatedLogs = filteredPostLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 手動リフレッシュ
  const handleRefresh = () => {
    loadData();
  };

  // フィルターリセット
  const resetFilters = () => {
    setDateFilter('all');
    setUserFilter('all');
    setQuestionTypeFilter('all');
    setEnvironmentFilter('all');
    setDataSourceFilter('all');
    setSearchQuery('');
  };

  // ログ詳細表示
  const handleLogClick = (log: PostLog) => {
    setSelectedLog(log);
    setShowLogDetail(true);
  };

  const closeLogDetail = () => {
    setShowLogDetail(false);
    setSelectedLog(null);
  };

  // postLogsやフィルター条件が変わったらフィルター適用
  useEffect(() => {
    let filtered = [...postLogs];

    // 日付フィルター
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(log => new Date(log.timestamp) >= filterDate);
    }

    // ユーザーフィルター
    if (userFilter !== 'all') {
      filtered = filtered.filter(log => log.userId === userFilter);
    }

    // 質問タイプフィルター
    if (questionTypeFilter !== 'all') {
      const keywords = {
        'login': ['ログイン', '認証', 'パスワード'],
        'classroom': ['教室', '求人', '管理'],
        'system': ['システム', 'エラー', '設定']
      };
      
      const targetKeywords = keywords[questionTypeFilter as keyof typeof keywords] || [];
      filtered = filtered.filter(log => 
        targetKeywords.some(keyword => 
          log.question.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    // 検索クエリフィルター
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.question.toLowerCase().includes(query) ||
        log.answer.toLowerCase().includes(query)
      );
    }

    // 環境フィルター
    if (environmentFilter !== 'all') {
      filtered = filtered.filter(log => {
        // metadataから環境を取得、またはデフォルト値
        const env = log.metadata?.environment || 'production';
        return env === environmentFilter;
      });
    }

    // データソースフィルター
    if (dataSourceFilter !== 'all') {
      filtered = filtered.filter(log => {
        // metadataからデータソースを取得、またはreferencesから推測
        const dataSource = log.metadata?.dataSource;
        if (dataSource) {
          return dataSource === dataSourceFilter;
        }
        // referencesから推測
        const hasConfluence = log.references?.some(r => r.url?.includes('confluence'));
        const hasJira = log.references?.some(r => r.url?.includes('jira'));
        let source = 'unknown';
        if (hasConfluence && hasJira) source = 'mixed';
        else if (hasConfluence) source = 'confluence';
        else if (hasJira) source = 'jira';
        return source === dataSourceFilter;
      });
    }

    setFilteredPostLogs(filtered);
    setTotalPages(Math.ceil(filtered.length / pageSize));
    // フィルター条件変更時のみページをリセット（postLogsの変更時はリセットしない）
  }, [postLogs, dateFilter, userFilter, questionTypeFilter, environmentFilter, dataSourceFilter, searchQuery, pageSize]);
  
  // フィルター条件変更時のみページをリセット
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, userFilter, questionTypeFilter, environmentFilter, dataSourceFilter, searchQuery, pageSize]);

  // 初期データ取得
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回のみ実行

  // リアルタイム更新（5秒間隔）
  useEffect(() => {
    if (!isRealTimeEnabled) return;

    const interval = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealTimeEnabled]); // isRealTimeEnabledの変化のみ監視

  const runBackup = async (type: 'full' | 'emergency' = 'full') => {
    try {
      setBackupStatus('running');
      console.log(`🔄 ${type === 'full' ? 'フル' : '緊急'}バックアップを開始...`);
      
      // バックアップAPIを呼び出し
      const response = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      });
      
      if (!response.ok) {
        throw new Error('バックアップに失敗しました');
      }
      
      const result = await response.json();
      console.log('✅ バックアップが完了しました:', result);
      
      setBackupStatus('success');
      setTimeout(() => setBackupStatus('idle'), 3000);
      
    } catch (error) {
      console.error('❌ バックアップ中にエラーが発生しました:', error);
      setBackupStatus('error');
      setTimeout(() => setBackupStatus('idle'), 3000);
    }
  };

  // キャッシュクリア機能
  const clearCache = async () => {
    try {
      setCacheStatus('clearing');
      console.log('🗑️ キャッシュクリアを開始...');
      
      const response = await fetch('/api/admin/clear-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('キャッシュクリアに失敗しました');
      }
      
      const result = await response.json();
      console.log('✅ キャッシュクリアが完了しました:', result);
      
      setCacheStatus('success');
      setTimeout(() => setCacheStatus('idle'), 3000);
      
    } catch (error) {
      console.error('❌ キャッシュクリア中にエラーが発生しました:', error);
      setCacheStatus('error');
      setTimeout(() => setCacheStatus('idle'), 3000);
    }
  };

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await adminService.revokeAdminPrivileges(userId, 'admin');
      } else {
        await adminService.grantAdminPrivileges(userId, 'admin');
      }
      await loadData(); // データを再読み込み
    } catch (err) {
      console.error('Error toggling admin status:', err);
      setError('管理者権限の変更中にエラーが発生しました');
    }
  };

  // 日付ベースの統計計算
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const endOfYesterday = new Date(startOfToday);
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // 投稿数統計
  const totalPosts = postLogs.length;
  const postsThisMonth = postLogs.filter(log => new Date(log.timestamp) >= startOfMonth).length;
  const postsThisWeek = postLogs.filter(log => new Date(log.timestamp) >= startOfWeek).length;
  const postsToday = postLogs.filter(log => new Date(log.timestamp) >= startOfToday).length;
  const postsYesterday = postLogs.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate >= startOfYesterday && logDate < endOfYesterday;
  }).length;
  
  // 今月の検索時間統計
  const logsThisMonth = postLogs.filter(log => new Date(log.timestamp) >= startOfMonth);
  const avgSearchTimeThisMonth = logsThisMonth.length > 0 
    ? logsThisMonth.reduce((sum, log) => sum + log.searchTime, 0) / logsThisMonth.length 
    : 0;
  const totalSearchTimeThisMonth = logsThisMonth.reduce((sum, log) => sum + log.searchTime, 0);
  
  // パフォーマンス統計の計算（全期間）
  const avgSearchTime = postLogs.length > 0 ? postLogs.reduce((sum, log) => sum + log.searchTime, 0) / postLogs.length : 0;
  const avgAiTime = postLogs.length > 0 ? postLogs.reduce((sum, log) => sum + log.aiGenerationTime, 0) / postLogs.length : 0;
  const avgTotalTime = postLogs.length > 0 ? postLogs.reduce((sum, log) => sum + log.totalTime, 0) / postLogs.length : 0;

  // パフォーマンスアラートの生成
  useEffect(() => {
    if (postLogs.length > 0) {
      const generatedAlerts = performanceAlertService.generateAlerts(postLogs);
      setAlerts(generatedAlerts);
    }
  }, [postLogs]);

  // エラー分析の実行
  useEffect(() => {
    if (postLogs.length > 0) {
      const analysis = errorAnalysisService.analyzeErrors(postLogs);
      setErrorAnalysis(analysis);
    }
  }, [postLogs]);
  const activeUsers = new Set(postLogs.map(log => log.userId)).size;
  
  // アクティブユーザー数計算（過去1時間以内のアクティビティ）
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentActiveUsers = new Set(
    postLogs
      .filter(log => new Date(log.timestamp) >= oneHourAgo)
      .map(log => log.userId)
  ).size;

  // 環境・データソースのヘルパー関数（共通ユーティリティを使用）
  const getEnvironmentForLog = (log: PostLog): 'development' | 'staging' | 'production' => {
    return getEnvironment(log.metadata);
  };

  const getDataSourceForLog = (log: PostLog): 'confluence' | 'jira' | 'mixed' | 'unknown' => {
    const dataSource = getDataSource(log.metadata, log.references);
    // google_driveはunknownとして扱う（管理画面では表示しない）
    if (dataSource === 'google_drive') {
      return 'unknown';
    }
    return dataSource;
  };

  // パフォーマンス分析用データ処理
  const getPerformanceData = () => {
    // 時間帯別データ（過去24時間、2時間間隔）
    const hourlyData = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i -= 2) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(now.getTime() - (i - 2) * 60 * 60 * 1000);
      
      const logsInHour = postLogs.filter(log => {
        const logTime = new Date(log.timestamp);
        return logTime >= hourStart && logTime < hourEnd;
      });
      
      const avgServerStartupTime = logsInHour.length > 0 
        ? logsInHour.reduce((sum, log) => sum + ((log as any).serverStartupTime || 0), 0) / logsInHour.length / 1000
        : 0;
      
      const avgTtfbTime = logsInHour.length > 0 
        ? logsInHour.reduce((sum, log) => sum + ((log as any).ttfbTime || 0), 0) / logsInHour.length / 1000
        : 0;
      
      const avgSearchTime = logsInHour.length > 0 
        ? logsInHour.reduce((sum, log) => sum + log.searchTime, 0) / logsInHour.length / 1000
        : 0;
      
      const avgAiTime = logsInHour.length > 0
        ? logsInHour.reduce((sum, log) => sum + log.aiGenerationTime, 0) / logsInHour.length / 1000
        : 0;
      
      const errorRate = logsInHour.length > 0
        ? (logsInHour.filter(log => log.errors && log.errors.length > 0).length / logsInHour.length) * 100
        : 0;
      
      hourlyData.push({
        time: `${hourStart.getHours()}:00`,
        serverStartupTime: avgServerStartupTime,
        ttfbTime: avgTtfbTime,
        searchTime: avgSearchTime,
        aiTime: avgAiTime,
        totalTime: avgServerStartupTime + avgSearchTime + avgAiTime,
        posts: logsInHour.length,
        errorRate: errorRate
      });
    }
    
    return hourlyData;
  };

  // 質問タイプ別パフォーマンス分析
  const getQuestionTypePerformance = () => {
    const types = {
      'ログイン関連': { keywords: ['ログイン', '認証', 'パスワード'], logs: [] },
      '教室・求人関連': { keywords: ['教室', '求人', '管理'], logs: [] },
      'システム関連': { keywords: ['システム', 'エラー', '設定'], logs: [] },
      'その他': { keywords: [], logs: [] }
    };
    
    // ログを分類
    postLogs.forEach(log => {
      let categorized = false;
      for (const [type, data] of Object.entries(types)) {
        if (type === 'その他') continue;
        if (data.keywords.some(keyword => log.question.toLowerCase().includes(keyword.toLowerCase()))) {
          data.logs.push(log);
          categorized = true;
          break;
        }
      }
      if (!categorized) {
        types['その他'].logs.push(log);
      }
    });
    
    return Object.entries(types).map(([type, data]) => ({
      type,
      count: data.logs.length,
      avgServerStartupTime: data.logs.length > 0 
        ? data.logs.reduce((sum, log) => sum + ((log as any).serverStartupTime || 0), 0) / data.logs.length / 1000
        : 0,
      avgSearchTime: data.logs.length > 0 
        ? data.logs.reduce((sum, log) => sum + log.searchTime, 0) / data.logs.length / 1000
        : 0,
      avgAiTime: data.logs.length > 0
        ? data.logs.reduce((sum, log) => sum + log.aiGenerationTime, 0) / data.logs.length / 1000
        : 0,
      errorRate: data.logs.length > 0
        ? (data.logs.filter(log => log.errors && log.errors.length > 0).length / data.logs.length) * 100
        : 0
    }));
  };

  // ユーザー別パフォーマンス分析
  const getUserPerformance = () => {
    const userStats = new Map();
    
    postLogs.forEach(log => {
      if (!userStats.has(log.userId)) {
        userStats.set(log.userId, {
          userId: log.userId,
          userName: users.find(u => u.uid === log.userId)?.displayName || 
                   users.find(u => u.uid === log.userId)?.email || 
                   'Unknown',
          posts: 0,
          totalSearchTime: 0,
          totalAiTime: 0,
          errors: 0
        });
      }
      
      const stats = userStats.get(log.userId);
      stats.posts++;
      stats.totalSearchTime += log.searchTime;
      stats.totalAiTime += log.aiGenerationTime;
      if (log.errors && log.errors.length > 0) stats.errors++;
    });
    
    return Array.from(userStats.values())
      .map(stats => ({
        ...stats,
        avgSearchTime: stats.posts > 0 ? stats.totalSearchTime / stats.posts / 1000 : 0,
        avgAiTime: stats.posts > 0 ? stats.totalAiTime / stats.posts / 1000 : 0,
        errorRate: stats.posts > 0 ? (stats.errors / stats.posts) * 100 : 0
      }))
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 10); // 上位10ユーザー
  };

  const performanceData = getPerformanceData();
  const questionTypeData = getQuestionTypePerformance();
  const userPerformanceData = getUserPerformance();

  // 管理者権限がない場合はアクセス拒否（JSX返却時にチェック）
  if (!isAdminLoading && !isAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-600">アクセス拒否</h3>
          <p className="text-muted-foreground">管理者権限が必要です。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">管理ダッシュボード</h2>
            <div className="text-sm text-muted-foreground">
              <p className="inline">
                最終更新: {lastUpdateTime.toLocaleString('ja-JP')}
              </p>
              {currentUser && (
                <span className="ml-2">
                  • ログインユーザー: {currentUser.displayName || currentUser.email}
                  {isAdmin && (
                    <Badge variant="default" className="ml-2 bg-blue-500">
                      <Shield className="h-3 w-3 mr-1" />
                      管理者
                    </Badge>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            更新
          </Button>
          <Button
            variant={isRealTimeEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
          >
            {isRealTimeEnabled ? 'リアルタイムON' : 'リアルタイムOFF'}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* JIRA：今月完了数 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">JIRA完了数</p>
                <p className="text-2xl font-bold">{jiraCompletedStats.thisMonth}</p>
                <p className="text-xs text-muted-foreground mt-1">今月</p>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span>今週: {jiraCompletedStats.thisWeek}</span>
                  <span>本日: {jiraCompletedStats.today}</span>
                  <span>昨日: {jiraCompletedStats.yesterday}</span>
              </div>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* 総投稿数・今月投稿数 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">総投稿数</p>
                <p className="text-2xl font-bold">{totalPosts}</p>
                <p className="text-xs text-muted-foreground mt-1">今月: {postsThisMonth}</p>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span>今週: {postsThisWeek}</span>
                  <span>本日: {postsToday}</span>
                  <span>昨日: {postsYesterday}</span>
              </div>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* 平均検索時間（今月）・総検索時間（今月） */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">平均検索時間</p>
                <p className="text-2xl font-bold">{(avgSearchTimeThisMonth / 1000).toFixed(1)}s</p>
                <p className="text-xs text-muted-foreground mt-1">今月の平均</p>
                <p className="text-xs text-muted-foreground mt-1">総検索時間: {(totalSearchTimeThisMonth / 1000).toFixed(0)}s</p>
              </div>
              <Search className="h-8 w-8 text-purple-500 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* アクティブユーザー数 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">アクティブユーザー</p>
                <p className="text-2xl font-bold">{activeUsers}</p>
                <p className="text-xs text-muted-foreground mt-1">総ユーザー数: {users.length}</p>
              </div>
              <Users className="h-8 w-8 text-green-500 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* タブコンテンツ */}
      <Tabs defaultValue="jira" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="jira">開発進捗ダッシュボード</TabsTrigger>
          <TabsTrigger value="performance">パフォーマンス分析</TabsTrigger>
          <TabsTrigger value="users">ユーザー管理</TabsTrigger>
          <TabsTrigger value="errors">エラー分析</TabsTrigger>
          <TabsTrigger value="data-sources">データソース管理</TabsTrigger>
        </TabsList>

        <TabsContent value="jira" className="space-y-4">
          <JiraDashboard />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {/* ユーザー管理 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
              <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    ユーザー管理 ({users.length}人)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    ユーザー一覧と管理者権限の管理
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    更新
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>ユーザーが登録されていません</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <ScrollArea className="w-full">
                    <div className="min-w-[1000px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">ユーザー名</TableHead>
                            <TableHead className="min-w-[250px]">メールアドレス</TableHead>
                            <TableHead className="min-w-[120px]">登録日</TableHead>
                            <TableHead className="min-w-[130px]">管理者権限</TableHead>
                            <TableHead className="min-w-[180px]">権限付与日時</TableHead>
                            <TableHead className="min-w-[180px]">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((user) => (
                            <TableRow key={user.uid}>
                              <TableCell className="min-w-[200px]">
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm font-medium">
                                      {user.displayName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium truncate" title={user.displayName || '名前未設定'}>
                                      {user.displayName || '名前未設定'}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[250px]">
                                <code className="text-sm break-all" title={user.email}>{user.email}</code>
                              </TableCell>
                              <TableCell className="min-w-[120px]">
                                <span className="text-sm whitespace-nowrap">
                                  {new Date(user.createdAt).toLocaleDateString('ja-JP')}
                                </span>
                              </TableCell>
                              <TableCell className="min-w-[130px]">
                                {user.isAdmin ? (
                                  <Badge variant="default" className="bg-blue-500 whitespace-nowrap">
                                    <Shield className="h-3 w-3 mr-1" />
                                    管理者
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="whitespace-nowrap">一般ユーザー</Badge>
                                )}
                              </TableCell>
                              <TableCell className="min-w-[180px]">
                                {user.isAdmin && user.adminGrantedAt ? (
                                  <div className="text-sm">
                                    <p className="whitespace-nowrap">
                                      {new Date(user.adminGrantedAt).toLocaleDateString('ja-JP')}
                                    </p>
                                    {user.adminGrantedBy && (
                                      <p className="text-xs text-muted-foreground truncate" title={`付与者: ${users.find(u => u.uid === user.adminGrantedBy)?.displayName || user.adminGrantedBy}`}>
                                        付与者: {users.find(u => u.uid === user.adminGrantedBy)?.displayName || user.adminGrantedBy}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="min-w-[180px]">
                                <Button
                                  variant={user.isAdmin ? "destructive" : "default"}
                                  size="sm"
                                  onClick={() => handleToggleAdmin(user.uid, user.isAdmin)}
                                  disabled={isLoading}
                                  className="whitespace-nowrap"
                                >
                                  {user.isAdmin ? (
                                    <>
                                      <XCircle className="h-4 w-4 mr-1" />
                                      権限削除
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="h-4 w-4 mr-1" />
                                      権限付与
                                    </>
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 統計情報 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">総ユーザー数</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">管理者数</p>
                    <p className="text-2xl font-bold">
                      {users.filter(u => u.isAdmin).length}
                    </p>
                  </div>
                  <Shield className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">一般ユーザー数</p>
                    <p className="text-2xl font-bold">
                      {users.filter(u => !u.isAdmin).length}
                    </p>
                  </div>
                  <UserIcon className="h-8 w-8 text-gray-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {/* 投稿ログ一覧 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    投稿ログ ({filteredPostLogs.length}件)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    ページ {currentPage} / {totalPages} (1ページあたり {pageSize}件)
                    {lastUpdateTime && (
                      <span className="ml-2">
                        • 最終更新: {lastUpdateTime.toLocaleTimeString('ja-JP')}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    更新
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* フィルター */}
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Filter className="h-4 w-4" />
                フィルター
              </CardTitle>
            </CardHeader>
            <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                <div>
                  <label className="text-sm font-medium">日付</label>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="today">今日</SelectItem>
                      <SelectItem value="week">過去1週間</SelectItem>
                      <SelectItem value="month">過去1ヶ月</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">ユーザー</label>
                  <Select value={userFilter} onValueChange={setUserFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      {users.map(user => (
                        <SelectItem key={user.uid} value={user.uid}>
                          {user.displayName || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                      <label className="text-sm font-medium">環境</label>
                      <Select value={environmentFilter} onValueChange={setEnvironmentFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                          <SelectItem value="development">開発環境</SelectItem>
                          <SelectItem value="staging">ステージング</SelectItem>
                          <SelectItem value="production">本番環境</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">データソース</label>
                      <Select value={dataSourceFilter} onValueChange={setDataSourceFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">すべて</SelectItem>
                          <SelectItem value="confluence">Confluence</SelectItem>
                          <SelectItem value="jira">Jira</SelectItem>
                          <SelectItem value="mixed">Confluence + Jira</SelectItem>
                          <SelectItem value="unknown">不明</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">検索</label>
                  <Input
                    placeholder="質問や回答を検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="flex items-end">
                      <Button variant="outline" onClick={resetFilters} className="w-full">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    リセット
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

              {paginatedLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>フィルター条件に一致する投稿ログがありません</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <ScrollArea className="w-full">
                    <div className="min-w-[1200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[160px]">日時</TableHead>
                            <TableHead className="min-w-[120px]">環境</TableHead>
                            <TableHead className="min-w-[140px]">データソース</TableHead>
                            <TableHead className="min-w-[180px]">ユーザー</TableHead>
                            <TableHead className="min-w-[300px]">質問</TableHead>
                            <TableHead className="min-w-[100px]">応答時間</TableHead>
                            <TableHead className="min-w-[80px]">参照数</TableHead>
                            <TableHead className="min-w-[100px]">ステータス</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedLogs.map((log) => {
                            const env = getEnvironmentForLog(log);
                            const dataSource = getDataSourceForLog(log);
                            return (
                            <TableRow 
                              key={log.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleLogClick(log)}
                            >
                              <TableCell className="min-w-[160px]">
                                <span className="text-sm whitespace-nowrap">
                                  {new Date(log.timestamp).toLocaleString('ja-JP')}
                                </span>
                              </TableCell>
                                <TableCell className="min-w-[120px]">
                                  <Badge className={`${getEnvironmentColor(env)} whitespace-nowrap`} variant="outline">
                                    {getEnvironmentName(env)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="min-w-[140px]">
                                  <Badge className={`${getDataSourceColor(dataSource)} whitespace-nowrap`} variant="outline">
                                    {getDataSourceName(dataSource)}
                                  </Badge>
                              </TableCell>
                              <TableCell className="min-w-[180px]">
                                {(() => {
                                  // ユーザー情報を取得（優先順位: metadata.userDisplayName > users配列から検索 > userId）
                                  let displayName = log.metadata?.userDisplayName;
                                  
                                  // metadata.userDisplayNameが'anonymous'または存在しない場合、users配列から検索
                                  if (!displayName || displayName === 'anonymous') {
                                    const user = users.find(u => u.uid === log.userId);
                                    displayName = user?.displayName || user?.email || null;
                                  }
                                  
                                  // それでも見つからない場合、userIdを使用（'anonymous'の場合はそのまま表示）
                                  const finalDisplayName = displayName || log.userId;
                                  
                                  return (
                                    <span className="text-sm truncate block" title={finalDisplayName}>
                                      {finalDisplayName}
                                </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="min-w-[300px] max-w-[400px]">
                                <p className="text-sm truncate" title={log.question}>
                                  {log.question}
                                </p>
                              </TableCell>
                              <TableCell className="min-w-[100px]">
                                <span className="text-sm whitespace-nowrap">
                                  {(log.totalTime / 1000).toFixed(1)}s
                                </span>
                              </TableCell>
                              <TableCell className="min-w-[80px]">
                                <span className="text-sm">{log.referencesCount}</span>
                              </TableCell>
                              <TableCell className="min-w-[100px]">
                                {log.errors && log.errors.length > 0 ? (
                                  <Badge variant="destructive" className="whitespace-nowrap">エラー</Badge>
                                ) : (
                                  <Badge variant="default" className="whitespace-nowrap">成功</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>

                  {/* ページネーション */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          前へ
                        </Button>
                        <span className="text-sm">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          次へ
                        </Button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">表示件数:</span>
                        <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 評価フィードバック */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                評価フィードバック ({feedbacks.length}件)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {feedbacks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>評価フィードバックがありません</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日時</TableHead>
                        <TableHead>ユーザー</TableHead>
                        <TableHead>評価</TableHead>
                        <TableHead>コメント</TableHead>
                        <TableHead>投稿ログID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feedbacks.map((feedback) => (
                        <TableRow key={feedback.id}>
                          <TableCell>
                            {new Date(feedback.timestamp).toLocaleString('ja-JP')}
                          </TableCell>
                          <TableCell>
                            {users.find(u => u.uid === feedback.userId)?.displayName || 
                             users.find(u => u.uid === feedback.userId)?.email || 
                             feedback.userId}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${
                                    star <= feedback.rating
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                              <span className="ml-2 text-sm font-medium">
                                {feedback.rating}/5
                              </span>
                          </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            {feedback.comment ? (
                              <p className="text-sm truncate" title={feedback.comment}>
                                {feedback.comment}
                              </p>
                            ) : (
                              <span className="text-sm text-muted-foreground">コメントなし</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {feedback.postLogId}
                            </code>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data-sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Google Driveインポート
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GoogleDriveImportSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          {/* エラー分析概要 */}
          {errorAnalysis ? (
            <>
              {/* エラー統計カード */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">総エラー数</p>
                        <p className="text-2xl font-bold">
                          {errorAnalysis.byCategory.search.count +
                           errorAnalysis.byCategory.ai.count +
                           errorAnalysis.byCategory.system.count +
                           errorAnalysis.byCategory.auth.count}
                        </p>
                  </div>
                      <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">未解決</p>
                        <p className="text-2xl font-bold text-red-600">
                          {errorAnalysis.resolutionStatus.unresolved}
                        </p>
                  </div>
                      <XCircle className="h-8 w-8 text-red-500" />
                </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">解決済み</p>
                        <p className="text-2xl font-bold text-green-600">
                          {errorAnalysis.resolutionStatus.resolved}
                        </p>
                  </div>
                      <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">調査中</p>
                        <p className="text-2xl font-bold text-yellow-600">
                          {errorAnalysis.resolutionStatus.investigating}
                        </p>
                  </div>
                      <AlertTriangle className="h-8 w-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* エラー種別別統計 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    エラー種別別統計
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {(['search', 'ai', 'system', 'auth'] as const).map((category) => {
                      const stats = errorAnalysis.byCategory[category];
                      return (
                        <Card key={category} className="border-l-4 border-l-red-500">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">
                                {errorAnalysisService.getCategoryName(category)}
                              </span>
                              <Badge variant="destructive">{stats.count}件</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {stats.percentage.toFixed(1)}% / 1日平均: {stats.avgOccurrencesPerDay.toFixed(1)}件
                            </p>
                            {stats.recentErrors.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">最近のエラー:</p>
                                {stats.recentErrors.slice(0, 2).map((error) => (
                                  <p key={error.id} className="text-xs truncate" title={error.message}>
                                    {error.message.substring(0, 50)}...
                                  </p>
                                ))}
                </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
              </div>
            </CardContent>
          </Card>

              {/* エラー発生率グラフ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 時間別エラー発生率 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      時間別エラー発生率（過去24時間）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={errorAnalysis.errorRateByHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip 
                            formatter={(value: any) => [`${value.toFixed(1)}%`, 'エラー率']}
                            labelFormatter={(label) => `時刻: ${label}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                            dataKey="errorRate" 
                            stroke="#ef4444" 
                      strokeWidth={2}
                            name="エラー率"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

                {/* 日別エラー発生率 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                      <BarChart className="h-5 w-5" />
                      日別エラー発生率（過去7日間）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={errorAnalysis.errorRateByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip 
                            formatter={(value: any) => [`${value.toFixed(1)}%`, 'エラー率']}
                            labelFormatter={(label) => `日付: ${label}`}
                      />
                      <Legend />
                          <Bar dataKey="errorRate" fill="#ef4444" name="エラー率" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
              </div>

              {/* エラーパターン分析 */}
              {errorAnalysis.errorPatterns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      エラーパターン分析（上位10パターン）
                </CardTitle>
              </CardHeader>
              <CardContent>
                    <div className="space-y-3">
                      {errorAnalysis.errorPatterns.map((pattern, index) => (
                        <Card key={index} className="border-l-4 border-l-orange-500">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">
                                    {errorAnalysisService.getCategoryName(pattern.category)}
                                  </Badge>
                                  <Badge variant={pattern.level === 'error' ? 'destructive' : 'default'}>
                                    {errorAnalysisService.getLevelName(pattern.level)}
                                  </Badge>
                                  <Badge variant="secondary">{pattern.count}回</Badge>
                                </div>
                                <p className="text-sm font-medium mb-1">{pattern.pattern}</p>
                                <p className="text-xs text-muted-foreground">
                                  初回: {pattern.firstOccurrence.toLocaleString('ja-JP')} / 
                                  最終: {pattern.lastOccurrence.toLocaleString('ja-JP')}
                                </p>
                              </div>
                </div>
              </CardContent>
            </Card>
                      ))}
          </div>
                  </CardContent>
                </Card>
              )}

              {/* 最近のエラー一覧 */}
              {errorAnalysis.recentErrors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      最近のエラー（上位20件）
              </CardTitle>
            </CardHeader>
            <CardContent>
                    <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                            <TableHead>日時</TableHead>
                            <TableHead>種別</TableHead>
                            <TableHead>レベル</TableHead>
                            <TableHead>メッセージ</TableHead>
                            <TableHead>ステータス</TableHead>
                            <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                          {errorAnalysis.recentErrors.map((error) => (
                            <TableRow key={error.id}>
                            <TableCell>
                                {new Date(error.timestamp).toLocaleString('ja-JP')}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {errorAnalysisService.getCategoryName(error.category)}
                              </Badge>
                            </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={error.level === 'error' ? 'destructive' : error.level === 'warning' ? 'default' : 'secondary'}
                                >
                                  {errorAnalysisService.getLevelName(error.level)}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-md truncate" title={error.message}>
                                {error.message}
                              </TableCell>
                              <TableCell>
                                {error.resolved ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    解決済み
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-red-50 text-red-700">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    未解決
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {!error.resolved && (
                                      <Button 
                                    variant="outline"
                                        size="sm" 
                                    onClick={() => {
                                      const resolvedError = errorAnalysisService.resolveError(error, 'admin');
                                      // TODO: Firestoreに保存する処理を追加
                                      setErrorAnalysis(prev => {
                                        if (!prev) return null;
                                        return {
                                          ...prev,
                                          recentErrors: prev.recentErrors.map(e => 
                                            e.id === error.id ? resolvedError : e
                                          ),
                                        };
                                      });
                                    }}
                                  >
                                    解決済み
                                      </Button>
                                    )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                  </ScrollArea>
            </CardContent>
          </Card>
              )}

              {/* エラーがない場合 */}
              {errorAnalysis.recentErrors.length === 0 && (
          <Card>
                  <CardContent className="p-12 text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">エラーはありません</h3>
                    <p className="text-muted-foreground">現在、エラーは発生していません。</p>
                    </CardContent>
                  </Card>
                )}
            </>
          ) : (
                  <Card>
              <CardContent className="p-12 text-center">
                <Loader2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
                <p className="text-muted-foreground">エラー分析を実行中...</p>
                    </CardContent>
                  </Card>
                )}
        </TabsContent>
      </Tabs>

      {/* ログ詳細モーダル */}
      <Dialog open={showLogDetail} onOpenChange={setShowLogDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              投稿ログ詳細
            </DialogTitle>
            <DialogDescription>
              質問内容、回答、パフォーマンス指標の詳細を表示
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-6">
              {/* 基本情報 */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">基本情報</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">日時:</span>
                      <span className="text-sm font-medium">
                        {new Date(selectedLog.timestamp).toLocaleString('ja-JP')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">ユーザー:</span>
                      <span className="text-sm font-medium">
                        {users.find(u => u.uid === selectedLog.userId)?.displayName || 
                         users.find(u => u.uid === selectedLog.userId)?.email || 
                         selectedLog.userId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">セッションID:</span>
                      <span className="text-sm font-mono text-xs">
                        {selectedLog.metadata?.sessionId || 'N/A'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">パフォーマンス指標</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">サーバー起動時間:</span>
                      <Badge variant="outline" className="text-purple-600">
                        {((selectedLog as any).serverStartupTime || 0)}ms
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">初期応答時間(TTFB):</span>
                      <Badge variant="outline" className="text-amber-600">
                        {((selectedLog as any).ttfbTime || 0)}ms
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">検索時間:</span>
                      <Badge variant="outline" className="text-blue-600">
                        {(selectedLog.searchTime / 1000).toFixed(1)}s
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">AI生成時間:</span>
                      <Badge variant="outline" className="text-orange-600">
                        {(selectedLog.aiGenerationTime / 1000).toFixed(1)}s
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">総処理時間:</span>
                      <Badge variant="outline" className="text-green-600">
                        {(selectedLog.totalTime / 1000).toFixed(1)}s
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">参照数:</span>
                      <Badge variant="outline">
                        {selectedLog.referencesCount}件
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 質問内容 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    質問内容
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{selectedLog.question}</p>
                  </div>
                </CardContent>
              </Card>

              {/* AI回答 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    AI回答
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedLog.answer);
                        // 簡単なトースト通知（実際の実装ではtoastライブラリを使用）
                      }}
                      className="ml-auto"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      コピー
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="prose prose-sm max-w-none text-sm leading-relaxed">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={sharedMarkdownComponents}
                      >
                        {formatMessageContent(selectedLog.answer)}
                      </ReactMarkdown>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* 参照元 */}
              {selectedLog.references && selectedLog.references.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      参照元 ({selectedLog.references.length}件)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedLog.references.map((reference, index) => {
                        // データソースを判定（優先順位: 1. dataSourceフィールド 2. URLから推測）
                        let dataSource: 'confluence' | 'jira' | 'unknown' = 'unknown';
                        if (reference.dataSource === 'confluence' || reference.dataSource === 'jira') {
                          dataSource = reference.dataSource;
                        } else if (reference.url) {
                          // URLから推測（フォールバック）
                          dataSource = 
                            reference.url.includes('jira') || reference.url.includes('atlassian.net/jira') ? 'jira' :
                            reference.url.includes('confluence') || reference.url.includes('atlassian.net') ? 'confluence' :
                            'unknown';
                        }
                        
                        return (
                        <div key={index} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm mb-1 line-clamp-2">
                                {reference.title}
                              </h4>
                              {reference.url && (
                                <a 
                                  href={reference.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 underline break-all"
                                >
                                  {reference.url}
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              <Badge variant="outline" className="text-xs">
                                  {dataSource === 'jira' ? 'Jira' : dataSource === 'confluence' ? 'Confluence' : 'Unknown'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {(reference.score * 100).toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 処理ステップ */}
              {selectedLog.processingSteps && selectedLog.processingSteps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      処理ステップ
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedLog.processingSteps.map((step, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              {step.status === 'completed' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : step.status === 'error' ? (
                                <XCircle className="h-4 w-4 text-red-600" />
                              ) : (
                                <Clock className="h-4 w-4 text-blue-600" />
                              )}
                              <span className="text-sm font-medium">{step.step}</span>
                            </div>
                            <div className="flex items-center gap-2 ml-auto">
                              {step.duration && (
                                <Badge variant="outline" className="text-xs">
                                  {(step.duration / 1000).toFixed(1)}s
                                </Badge>
                              )}
                              <Badge 
                                variant={step.status === 'completed' ? 'default' : 
                                        step.status === 'error' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {step.status}
                              </Badge>
                            </div>
                          </div>
                          {step.details && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                              <details>
                                <summary className="cursor-pointer font-medium">詳細情報</summary>
                                <pre className="mt-2 text-xs overflow-x-auto">
                                  {JSON.stringify(step.details, null, 2)}
                                </pre>
                              </details>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(step.timestamp).toLocaleString('ja-JP')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* エラー情報 */}
              {selectedLog.errors && selectedLog.errors.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      エラー情報
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedLog.errors.map((error, index) => (
                        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-red-800">
                              エラー {index + 1}
                            </span>
                            <Badge variant="destructive" className="text-xs">
                              {new Date(error.timestamp).toLocaleTimeString('ja-JP')}
                            </Badge>
                          </div>
                          <p className="text-sm text-red-700 mb-2">{error.message}</p>
                          {error.stack && (
                            <details className="mt-2">
                              <summary className="text-xs text-red-600 cursor-pointer">
                                スタックトレースを表示
                              </summary>
                              <pre className="text-xs text-red-600 mt-2 p-2 bg-red-100 rounded overflow-x-auto">
                                {error.stack}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* メタデータ */}
              {selectedLog.metadata && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      メタデータ
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">User Agent:</span>
                        <p className="font-mono text-xs break-all mt-1">
                          {selectedLog.metadata.userAgent || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">IP Address:</span>
                        <p className="font-mono text-xs mt-1">
                          {selectedLog.metadata.ipAddress || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
