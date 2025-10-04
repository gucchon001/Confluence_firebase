'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  FileText
} from 'lucide-react';
import { adminService } from '@/lib/admin-service';
import { postLogService } from '@/lib/post-log-service';
import { useAdmin } from '@/hooks/use-admin';
import type { AdminUser, PostLog } from '@/types';

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

const AdminDashboard: React.FC = () => {
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [postLogs, setPostLogs] = useState<PostLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // ユーザー一覧と投稿ログを並行して取得
      const [userList, recentLogs] = await Promise.all([
        adminService.getAllUsers(),
        postLogService.getRecentPostLogs(20)
      ]);
      
      setUsers(userList);
      setPostLogs(recentLogs);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('データの取得中にエラーが発生しました');
    } finally {
      setIsLoading(false);
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
  const avgSearchTime = postLogs.reduce((sum, log) => sum + log.searchTime, 0) / postLogs.length;
  const avgAiTime = postLogs.reduce((sum, log) => sum + log.aiGenerationTime, 0) / postLogs.length;
  const avgTotalTime = postLogs.reduce((sum, log) => sum + log.totalTime, 0) / postLogs.length;
  const totalPosts = postLogs.length;
  const activeUsers = new Set(postLogs.map(log => log.userId)).size;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">管理ダッシュボード</h2>
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
                <p className="text-2xl font-bold">{activeUsers}</p>
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
              </div>
              <Brain className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* タブコンテンツ */}
      <Tabs defaultValue="monitoring" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monitoring">リアルタイム監視</TabsTrigger>
          <TabsTrigger value="users">ユーザー管理</TabsTrigger>
          <TabsTrigger value="performance">パフォーマンス</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                最近の投稿ログ
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {postLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>投稿ログがありません</p>
                    </div>
                  ) : (
                    postLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium truncate">{log.question}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Search className="h-3 w-3" />
                              {(log.searchTime / 1000).toFixed(1)}s
                            </span>
                            <span className="flex items-center gap-1">
                              <Brain className="h-3 w-3" />
                              {(log.aiGenerationTime / 1000).toFixed(1)}s
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {log.answerLength}文字
                            </span>
                          </div>
                        </div>
                        <Badge 
                          variant={log.errors && log.errors.length > 0 ? "destructive" : "outline"} 
                          className="flex items-center gap-1"
                        >
                          {log.errors && log.errors.length > 0 ? (
                            <>
                              <XCircle className="h-3 w-3" />
                              エラー
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              完了
                            </>
                          )}
                        </Badge>
                      </div>
                    ))
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                パフォーマンス分析
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">平均検索時間</p>
                    <p className="text-2xl font-bold text-blue-600">{(avgSearchTime / 1000).toFixed(1)}s</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">平均AI生成時間</p>
                    <p className="text-2xl font-bold text-orange-600">{(avgAiTime / 1000).toFixed(1)}s</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">平均総処理時間</p>
                    <p className="text-2xl font-bold text-green-600">{(avgTotalTime / 1000).toFixed(1)}s</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">最近の投稿ログ</h4>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {postLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-2 border rounded text-sm">
                          <div className="flex-1">
                            <p className="font-medium truncate">{log.question}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>検索: {(log.searchTime / 1000).toFixed(1)}s</span>
                              <span>AI: {(log.aiGenerationTime / 1000).toFixed(1)}s</span>
                              <span>総時間: {(log.totalTime / 1000).toFixed(1)}s</span>
                              <span>参照: {log.referencesCount}件</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
