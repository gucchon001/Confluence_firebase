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
import { fixMarkdownTables, normalizeMarkdownSymbols, sharedMarkdownComponents } from '@/lib/markdown-utils';
/**
 * Try to normalize malformed markdown tables produced by LLM so that remark-gfm
 * can render them. Heuristics:
 * - Ensure table header lines start with a single '|'
 * - Collapse multiple leading pipes (e.g. "|| 項目 |...")
 * - Insert separator line like "|:---|:---|" if missing after header
 * - Ensure each table row starts/ends with a pipe and is on its own line
 */
function fixMarkdownTables(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const fixed: string[] = [];
  let inTable = false;
  let pendingHeaderColumns: number | null = null;
  let currentColumns: number | null = null; // 現在のテーブル列数を保持

  const isSeparatorLine = (s: string) => /^\s*\|?\s*(:?-{3,}\s*\|\s*)+(:?-{3,}\s*)?\|?\s*$/.test(s);
  const normalizeRow = (s: string) => {
    let row = s.trim();
    // collapse multiple leading pipes
    row = row.replace(/^\|{2,}/, '|');
    // add leading pipe
    if (!row.startsWith('|')) row = '|' + row;
    // ensure single spaces around pipes for readability
    row = row.replace(/\s*\|\s*/g, ' | ');
    // add trailing pipe
    if (!row.endsWith('|')) row = row + ' |';
    return row;
  };

  for (let i = 0; i < lines.length; i++) {
    const original = lines[i];
    const trimmed = original.trim();
    
    // Skip empty lines but preserve them
    if (trimmed === '') {
      if (inTable) {
        // End of table
        inTable = false;
        pendingHeaderColumns = null;
        currentColumns = null;
      }
      fixed.push(original);
      continue;
    }

    const looksLikeRow = /^\s*\|/.test(trimmed) && trimmed.includes('|');

    if (looksLikeRow) {
      const normalized = normalizeRow(trimmed);
      if (!inTable) {
        // Ensure blank line before table for GFM
        if (fixed.length > 0 && fixed[fixed.length - 1].trim() !== '') fixed.push('');
        inTable = true;
        // compute column count from header
        pendingHeaderColumns = normalized.split('|').filter(c => c.trim().length > 0).length - 1; // exclude leading/trailing
        currentColumns = pendingHeaderColumns;
      }
      // 行を列数で分割して複数行に展開（1行に複数レコードが連結されている場合の対策）
      const cells = normalized
        .slice(1, normalized.length - 1) // 先頭/末尾のパイプを除去
        .split('|')
        .map(c => c.trim())
        .filter(c => !(c === '' && currentColumns !== null));

      if (currentColumns && cells.length > currentColumns) {
        for (let off = 0; off < cells.length; off += currentColumns) {
          const rowCells = cells.slice(off, off + currentColumns);
          if (rowCells.length === currentColumns) {
            fixed.push('| ' + rowCells.join(' | ') + ' |');
          }
        }
      } else {
        fixed.push(normalized);
      }

      // If it's the first line of the table (header) and next line isn't a separator, insert one
      const next = lines[i + 1]?.trim() ?? '';
      if (pendingHeaderColumns && !isSeparatorLine(next)) {
        const sepCells = Array(pendingHeaderColumns).fill(':---');
        fixed.push('| ' + sepCells.join(' | ') + ' |');
        pendingHeaderColumns = null;
        currentColumns = currentColumns || sepCells.length;
      } else if (isSeparatorLine(next)) {
        // We will let the next loop push the existing separator
        pendingHeaderColumns = null;
        currentColumns = currentColumns || (next.split('|').filter(c => c.includes('-')).length);
      }
      continue;
    }

    // If we encounter a separator that LLM emitted, pass it through normalized
    if (isSeparatorLine(trimmed)) {
      if (inTable) {
        fixed.push(normalizeRow(trimmed));
        pendingHeaderColumns = null;
        currentColumns = currentColumns || (trimmed.split('|').filter(c => c.includes('-')).length);
      } else {
        fixed.push(original);
      }
      continue;
    }

    // Non-table line
    if (inTable) {
      // End of table
      inTable = false;
      pendingHeaderColumns = null;
      currentColumns = null;
    }
    fixed.push(original);
  }

  return fixed.join('\n');
}

function normalizeMarkdownSymbols(markdown: string): string {
  let text = markdown;
  
  // 特殊文字の正規化
  text = text.replace(/【FIX】/g, '**FIX**');
  text = text.replace(/【NEW】/g, '**NEW**');
  text = text.replace(/【REVIEW】/g, '**REVIEW**');
  text = text.replace(/【FIXME】/g, '**FIXME**');
  
  // 連続する改行を2つまでに制限
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text;
}
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
  Trash2
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
import { useAdmin } from '@/hooks/use-admin';
import type { AdminUser, PostLog, Reference, SatisfactionRating } from '@/types';

// ダミーデータ（実際の実装ではAPIから取得）
const mockPostLogs: PostLog[] = [
  {
    id: '1',
    userId: 'user1',
    question: '教室管理の詳細は？',
    answer: '教室管理機能について...',
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
  const [searchQuery, setSearchQuery] = useState('');
  
  // ページネーション状態
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  // リアルタイム更新の状態（デフォルトで無効）
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  // 管理者権限がない場合はアクセス拒否
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
      
      const [userList, recentLogs, feedbackList] = await Promise.all([
        adminService.getAllUsers(),
        postLogService.getRecentPostLogs(100), // より多くのログを取得
        fetchFeedbacks() // 評価フィードバックを取得
      ]);
      
      console.log('📊 管理ダッシュボード: データ取得完了', {
        userCount: userList.length,
        postLogCount: recentLogs.length
      });
      
      setUsers(userList);
      setPostLogs(recentLogs);
      setFeedbacks(feedbackList);
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

    setFilteredPostLogs(filtered);
    setTotalPages(Math.ceil(filtered.length / pageSize));
    // フィルター条件変更時のみページをリセット（postLogsの変更時はリセットしない）
  }, [postLogs, dateFilter, userFilter, questionTypeFilter, searchQuery, pageSize]);
  
  // フィルター条件変更時のみページをリセット
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, userFilter, questionTypeFilter, searchQuery, pageSize]);

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
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'clearing' | 'success' | 'error'>('idle');
  
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

  // パフォーマンス統計の計算
  const avgSearchTime = postLogs.length > 0 ? postLogs.reduce((sum, log) => sum + log.searchTime, 0) / postLogs.length : 0;
  const avgAiTime = postLogs.length > 0 ? postLogs.reduce((sum, log) => sum + log.aiGenerationTime, 0) / postLogs.length : 0;
  const avgTotalTime = postLogs.length > 0 ? postLogs.reduce((sum, log) => sum + log.totalTime, 0) / postLogs.length : 0;
  const totalPosts = postLogs.length;
  const activeUsers = new Set(postLogs.map(log => log.userId)).size;
  
  // アクティブユーザー数計算（過去1時間以内のアクティビティ）
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentActiveUsers = new Set(
    postLogs
      .filter(log => new Date(log.timestamp) >= oneHourAgo)
      .map(log => log.userId)
  ).size;

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

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">管理ダッシュボード</h2>
            <p className="text-sm text-muted-foreground">
              最終更新: {lastUpdateTime.toLocaleString('ja-JP')}
            </p>
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
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">総投稿数</p>
                <p className="text-2xl font-bold">{totalPosts}</p>
                <p className="text-xs text-muted-foreground">全期間</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">アクティブユーザー</p>
                <p className="text-2xl font-bold">{recentActiveUsers}</p>
                <p className="text-xs text-muted-foreground">過去1時間以内</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">平均検索時間</p>
                <p className="text-2xl font-bold">{(avgSearchTime / 1000).toFixed(1)}s</p>
                <p className="text-xs text-muted-foreground">全投稿の平均</p>
              </div>
              <Search className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">平均AI生成時間</p>
                <p className="text-2xl font-bold">{(avgAiTime / 1000).toFixed(1)}s</p>
                <p className="text-xs text-muted-foreground">全投稿の平均</p>
              </div>
              <Brain className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* タブコンテンツ */}
      <Tabs defaultValue="monitoring" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="monitoring">リアルタイム監視</TabsTrigger>
          <TabsTrigger value="users">ユーザー管理</TabsTrigger>
          <TabsTrigger value="performance">パフォーマンス</TabsTrigger>
          <TabsTrigger value="feedback">評価フィードバック</TabsTrigger>
          <TabsTrigger value="backup">バックアップ</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-4">
          {/* フィルター */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                フィルター
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                  <label className="text-sm font-medium">質問タイプ</label>
                  <Select value={questionTypeFilter} onValueChange={setQuestionTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="login">ログイン関連</SelectItem>
                      <SelectItem value="classroom">教室・求人関連</SelectItem>
                      <SelectItem value="system">システム関連</SelectItem>
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
                  <Button variant="outline" onClick={resetFilters}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    リセット
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 投稿ログ一覧 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    投稿ログ ({filteredPostLogs.length}件)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
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
                  <Button
                    variant={isRealTimeEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {isRealTimeEnabled ? 'リアルタイム ON' : 'リアルタイム OFF'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {paginatedLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>フィルター条件に一致する投稿ログがありません</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日時</TableHead>
                        <TableHead>ユーザー</TableHead>
                        <TableHead>質問</TableHead>
                        <TableHead>応答時間</TableHead>
                        <TableHead>参照数</TableHead>
                        <TableHead>ステータス</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLogs.map((log) => (
                        <TableRow 
                          key={log.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleLogClick(log)}
                        >
                          <TableCell>
                            {new Date(log.timestamp).toLocaleString('ja-JP')}
                          </TableCell>
                          <TableCell>
                            {log.metadata?.userDisplayName || 
                             users.find(u => u.uid === log.userId)?.displayName || 
                             users.find(u => u.uid === log.userId)?.email || 
                             log.userId}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {log.question}
                          </TableCell>
                          <TableCell>
                            {(log.totalTime / 1000).toFixed(1)}s
                          </TableCell>
                          <TableCell>
                            {log.referencesCount}
                          </TableCell>
                          <TableCell>
                            {log.errors && log.errors.length > 0 ? (
                              <Badge variant="destructive">エラー</Badge>
                            ) : (
                              <Badge variant="default">成功</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

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
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                ユーザー管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {users.map((user) => (
                      <div key={user.uid} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{user.displayName || '名前なし'}</p>
                            {user.isAdmin && (
                              <Badge variant="default" className="flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                管理者
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground">
                            登録日: {user.createdAt.toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant={user.isAdmin ? "destructive" : "default"}
                          size="sm"
                          onClick={() => handleToggleAdmin(user.uid, user.isAdmin)}
                        >
                          {user.isAdmin ? '管理者権限削除' : '管理者権限付与'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {/* パフォーマンス概要 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                パフォーマンス概要
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <Search className="h-5 w-5 text-blue-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">平均検索時間</p>
                  <p className="text-2xl font-bold text-blue-600">{(avgSearchTime / 1000).toFixed(1)}s</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <Brain className="h-5 w-5 text-orange-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">平均AI生成時間</p>
                  <p className="text-2xl font-bold text-orange-600">{(avgAiTime / 1000).toFixed(1)}s</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <Clock className="h-5 w-5 text-green-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">平均総処理時間</p>
                  <p className="text-2xl font-bold text-green-600">{(avgTotalTime / 1000).toFixed(1)}s</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">エラー率</p>
                  <p className="text-2xl font-bold text-red-600">
                    {postLogs.length > 0 
                      ? ((postLogs.filter(log => log.errors && log.errors.length > 0).length / postLogs.length) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 時間帯別パフォーマンス */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                時間帯別パフォーマンス（過去24時間）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${typeof value === 'number' ? value.toFixed(1) : value}s`, 
                        name === 'serverStartupTime' ? 'サーバー起動時間' :
                        name === 'searchTime' ? '検索時間' : 
                        name === 'aiTime' ? 'AI生成時間' : 
                        name === 'totalTime' ? '総処理時間' : name
                      ]}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="serverStartupTime" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      name="サーバー起動時間"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="searchTime" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="検索時間"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="aiTime" 
                      stroke="#f97316" 
                      strokeWidth={2}
                      name="AI生成時間"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="totalTime" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="総処理時間"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 質問タイプ別パフォーマンス */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  質問タイプ別パフォーマンス
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={questionTypeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => [
                          `${typeof value === 'number' ? value.toFixed(1) : value}s`, 
                          name === 'avgServerStartupTime' ? '平均サーバー起動時間' :
                          name === 'avgSearchTime' ? '平均検索時間' : 
                          name === 'avgAiTime' ? '平均AI生成時間' : name
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="avgServerStartupTime" fill="#8b5cf6" name="平均サーバー起動時間" />
                      <Bar dataKey="avgSearchTime" fill="#3b82f6" name="平均検索時間" />
                      <Bar dataKey="avgAiTime" fill="#f97316" name="平均AI生成時間" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 質問タイプ別分布 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  質問タイプ別分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={questionTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ type, count, percent }) => `${type}: ${count}件 (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {questionTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#3b82f6', '#f97316', '#10b981', '#8b5cf6'][index % 4]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ユーザー別パフォーマンス */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                ユーザー別パフォーマンス（上位10ユーザー）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={userPerformanceData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="userName" type="category" width={100} />
                      <Tooltip 
                        formatter={(value, name) => [
                          `${typeof value === 'number' ? value.toFixed(1) : value}s`, 
                          name === 'avgSearchTime' ? '平均検索時間' : 
                          name === 'avgAiTime' ? '平均AI生成時間' : name
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="avgSearchTime" fill="#3b82f6" name="平均検索時間" />
                      <Bar dataKey="avgAiTime" fill="#f97316" name="平均AI生成時間" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* ユーザー別詳細テーブル */}
                <div className="mt-6">
                  <h4 className="font-medium mb-3">ユーザー別詳細統計</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ユーザー</TableHead>
                          <TableHead>投稿数</TableHead>
                          <TableHead>平均検索時間</TableHead>
                          <TableHead>平均AI時間</TableHead>
                          <TableHead>エラー率</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userPerformanceData.map((user, index) => (
                          <TableRow key={user.userId}>
                            <TableCell className="font-medium">{user.userName}</TableCell>
                            <TableCell>{user.posts}</TableCell>
                            <TableCell>{user.avgSearchTime.toFixed(1)}s</TableCell>
                            <TableCell>{user.avgAiTime.toFixed(1)}s</TableCell>
                            <TableCell>
                              <Badge variant={user.errorRate > 10 ? "destructive" : "outline"}>
                                {user.errorRate.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                評価フィードバック ({feedbacks.length}件)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 評価統計 */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map((rating) => {
                    const count = feedbacks.filter(f => f.rating === rating).length;
                    const percentage = feedbacks.length > 0 ? (count / feedbacks.length) * 100 : 0;
                    return (
                      <Card key={rating}>
                        <CardContent className="p-4 text-center">
                          <div className="flex items-center justify-center mb-2">
                            {Array.from({ length: rating }, (_, i) => (
                              <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                            ))}
                          </div>
                          <div className="text-2xl font-bold">{count}</div>
                          <div className="text-sm text-muted-foreground">
                            {percentage.toFixed(1)}%
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* 評価一覧 */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">評価一覧</h3>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {feedbacks.map((feedback) => {
                        // PostLog IDから対応する投稿ログを検索
                        const relatedPostLog = postLogs.find(log => log.id === feedback.postLogId);
                        
                        return (
                          <Card key={feedback.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="flex items-center">
                                      {Array.from({ length: feedback.rating }, (_, i) => (
                                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                                      ))}
                                      {Array.from({ length: 5 - feedback.rating }, (_, i) => (
                                        <Star key={i} className="w-4 h-4 text-gray-300" />
                                      ))}
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                      {feedback.metadata.userDisplayName || feedback.userId || '匿名ユーザー'}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(feedback.timestamp).toLocaleString('ja-JP')}
                                    </span>
                                  </div>
                                  
                                  {/* 評価された質問内容を表示 */}
                                  {relatedPostLog && (
                                    <div className="mb-2 p-2 bg-blue-50 rounded border-l-4 border-blue-200">
                                      <div className="text-xs text-blue-600 font-medium mb-1">評価された質問:</div>
                                      <div className="text-sm text-gray-700">
                                        {relatedPostLog.question.length > 100 
                                          ? `${relatedPostLog.question.substring(0, 100)}...` 
                                          : relatedPostLog.question
                                        }
                                      </div>
                                    </div>
                                  )}
                                  
                                  {feedback.comment && (
                                    <p className="text-sm text-gray-700 mt-2 p-2 bg-gray-50 rounded">
                                      {feedback.comment}
                                    </p>
                                  )}
                                  
                                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                                    <span>PostLog ID: {feedback.postLogId}</span>
                                    {relatedPostLog && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => handleLogClick(relatedPostLog)}
                                        className="h-6 px-2 text-xs"
                                      >
                                        <Eye className="w-3 h-3 mr-1" />
                                        詳細表示
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                バックアップ管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">フルバックアップ</h3>
                        <Shield className="h-6 w-6 text-blue-500" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        全データの完全バックアップを実行します
                      </p>
                      <Button 
                        onClick={() => runBackup('full')} 
                        disabled={backupStatus === 'running'}
                        className="w-full"
                      >
                        {backupStatus === 'running' ? '実行中...' : 'フルバックアップ実行'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">緊急バックアップ</h3>
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        緊急時の即座バックアップを実行します
                      </p>
                      <Button 
                        onClick={() => runBackup('emergency')} 
                        disabled={backupStatus === 'running'}
                        variant="destructive"
                        className="w-full"
                      >
                        {backupStatus === 'running' ? '実行中...' : '緊急バックアップ実行'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {backupStatus !== 'idle' && (
                  <Card className={backupStatus === 'success' ? 'border-green-200 bg-green-50' : backupStatus === 'error' ? 'border-red-200 bg-red-50' : ''}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        {backupStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                        {backupStatus === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                        {backupStatus === 'running' && <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />}
                        <span className={backupStatus === 'success' ? 'text-green-600' : backupStatus === 'error' ? 'text-red-600' : 'text-blue-600'}>
                          {backupStatus === 'success' && 'バックアップが完了しました'}
                          {backupStatus === 'error' && 'バックアップ中にエラーが発生しました'}
                          {backupStatus === 'running' && 'バックアップを実行中...'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* キャッシュ管理セクション */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">キャッシュ管理</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  永続化キャッシュとメモリキャッシュを管理し、起動時間を最適化します
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Trash2 className="h-4 w-4 text-red-600" />
                        <h4 className="font-medium">キャッシュクリア</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        永続化キャッシュとメモリキャッシュをクリアし、次回起動時にフレッシュな状態にします
                      </p>
                      <Button 
                        onClick={clearCache} 
                        disabled={cacheStatus === 'clearing'}
                        variant="outline"
                        className="w-full border-red-200 text-red-600 hover:bg-red-50"
                      >
                        {cacheStatus === 'clearing' ? 'クリア中...' : 'キャッシュクリア'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-yellow-600" />
                        <h4 className="font-medium">起動最適化</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        キャッシュにより次回起動時間が大幅に短縮されます（通常3秒以下）
                      </p>
                      <div className="text-xs text-muted-foreground">
                        <div>• トークナイザー状態: キャッシュ済み</div>
                        <div>• 起動最適化: 有効</div>
                        <div>• バックグラウンド更新: 有効</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {cacheStatus !== 'idle' && (
                  <Card className={cacheStatus === 'success' ? 'border-green-200 bg-green-50' : cacheStatus === 'error' ? 'border-red-200 bg-red-50' : ''}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        {cacheStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                        {cacheStatus === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                        {cacheStatus === 'clearing' && <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />}
                        <span className={cacheStatus === 'success' ? 'text-green-600' : cacheStatus === 'error' ? 'text-red-600' : 'text-blue-600'}>
                          {cacheStatus === 'success' && 'キャッシュが正常にクリアされました'}
                          {cacheStatus === 'error' && 'キャッシュクリア中にエラーが発生しました'}
                          {cacheStatus === 'clearing' && 'キャッシュをクリア中...'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
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
                        {normalizeMarkdownSymbols(fixMarkdownTables(selectedLog.answer))}
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
                      {selectedLog.references.map((reference, index) => (
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
                                {reference.source}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {(reference.score * 100).toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
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
