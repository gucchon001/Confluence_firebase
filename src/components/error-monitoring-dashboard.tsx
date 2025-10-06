'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  Bug, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart3,
  AlertCircle,
  Info,
  Zap
} from 'lucide-react';
import { errorMonitoringService, type ErrorLog, type ErrorSeverity } from '@/lib/error-monitoring-service';

interface ErrorMonitoringDashboardProps {
  className?: string;
}

const ErrorMonitoringDashboard: React.FC<ErrorMonitoringDashboardProps> = ({ className }) => {
  const [errorStats, setErrorStats] = useState<any>(null);
  const [recentErrors, setRecentErrors] = useState<ErrorLog[]>([]);
  const [criticalErrors, setCriticalErrors] = useState<ErrorLog[]>([]);
  const [errorPatterns, setErrorPatterns] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      const [stats, recent, critical, patterns] = await Promise.all([
        errorMonitoringService.getErrorStats('day'),
        errorMonitoringService.getErrorLogs({ limit: 20 }),
        errorMonitoringService.getUnresolvedCriticalErrors(),
        errorMonitoringService.analyzeErrorPatterns()
      ]);

      setErrorStats(stats);
      setRecentErrors(recent);
      setCriticalErrors(critical);
      setErrorPatterns(patterns);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load error monitoring data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createTestError = async () => {
    try {
      console.log('Creating test error...');
      await errorMonitoringService.createTestErrorLog();
      console.log('Test error created, reloading data...');
      // データを再読み込み
      await loadData();
      console.log('Data reloaded');
    } catch (error) {
      console.error('Failed to create test error:', error);
    }
  };

  const createManualError = async () => {
    try {
      console.log('Creating manual error...');
      await errorMonitoringService.logError(
        'MANUAL_TEST_ERROR',
        'Manual test error created from dashboard',
        'high',
        {
          component: 'ErrorMonitoringDashboard',
          action: 'manual-test',
          additionalInfo: {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
          }
        }
      );
      console.log('Manual error created, reloading data...');
      // データを再読み込み
      await loadData();
      console.log('Data reloaded');
    } catch (error) {
      console.error('Failed to create manual error:', error);
    }
  };

  useEffect(() => {
    loadData();
    
    // 5分ごとにデータを更新
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: ErrorSeverity): string => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <AlertCircle className="h-4 w-4" />;
      case 'medium': return <Info className="h-4 w-4" />;
      case 'low': return <Bug className="h-4 w-4" />;
      default: return <Bug className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 animate-pulse rounded mb-2" />
                <div className="h-8 bg-gray-200 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            エラー監視ダッシュボード
          </h2>
          <p className="text-muted-foreground">
            最終更新: {lastUpdate.toLocaleString('ja-JP')}
          </p>
        </div>
      <div className="flex gap-2">
        <Button onClick={createTestError} variant="secondary" size="sm">
          <Bug className="h-4 w-4 mr-2" />
          テストエラー作成
        </Button>
        <Button onClick={createManualError} variant="secondary" size="sm">
          <Bug className="h-4 w-4 mr-2" />
          手動エラー作成
        </Button>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          更新
        </Button>
      </div>
      </div>

      {/* 重要なアラート */}
      {criticalErrors.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>緊急:</strong> {criticalErrors.length}件の重要なエラーが未解決です。
            即座に対処が必要です。
          </AlertDescription>
        </Alert>
      )}

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総エラー数</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {errorStats?.trend > 0 ? (
                <TrendingUp className="h-3 w-3 text-red-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-green-500" />
              )}
              {Math.abs(errorStats?.trend || 0).toFixed(1)}% 前期間比
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">重要エラー</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(errorStats?.bySeverity?.critical || 0) + (errorStats?.bySeverity?.high || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              未解決: {criticalErrors.length}件
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">中程度エラー</CardTitle>
            <Info className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {errorStats?.bySeverity?.medium || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              過去24時間
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">軽微エラー</CardTitle>
            <Bug className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {errorStats?.bySeverity?.low || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              過去24時間
            </p>
          </CardContent>
        </Card>
      </div>

      {/* タブコンテンツ */}
      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recent">最近のエラー</TabsTrigger>
          <TabsTrigger value="critical">重要エラー</TabsTrigger>
          <TabsTrigger value="patterns">エラーパターン</TabsTrigger>
          <TabsTrigger value="trends">トレンド</TabsTrigger>
        </TabsList>

        {/* 最近のエラー */}
        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>最近のエラー (最新20件)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentErrors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>エラーはありません</p>
                  </div>
                ) : (
                  recentErrors.map((error) => (
                    <div key={error.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant={
                                error.severity === 'critical' ? 'destructive' :
                                error.severity === 'high' ? 'destructive' :
                                error.severity === 'medium' ? 'secondary' : 'outline'
                              }
                              className="text-xs flex items-center gap-1"
                            >
                              {getSeverityIcon(error.severity)}
                              {error.severity}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {error.errorType}
                            </Badge>
                            {error.resolved && (
                              <Badge variant="outline" className="text-xs text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                解決済み
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium">{error.message}</p>
                          {error.metadata.component && (
                            <p className="text-xs text-muted-foreground mt-1">
                              コンポーネント: {error.metadata.component}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => errorMonitoringService.resolveError(error.id, 'admin')}
                          disabled={error.resolved}
                        >
                          {error.resolved ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {error.resolved ? '解決済み' : '解決'}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        発生時刻: {formatTimestamp(error.timestamp)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 重要エラー */}
        <TabsContent value="critical" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                未解決の重要エラー
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {criticalErrors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>未解決の重要エラーはありません</p>
                  </div>
                ) : (
                  criticalErrors.map((error) => (
                    <div key={error.id} className="p-3 border border-red-200 rounded-lg bg-red-50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="destructive" className="text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {error.severity}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {error.errorType}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{error.message}</p>
                          {error.stackTrace && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer">
                                スタックトレースを表示
                              </summary>
                              <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                                {error.stackTrace}
                              </pre>
                            </details>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => errorMonitoringService.resolveError(error.id, 'admin')}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          緊急解決
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        発生時刻: {formatTimestamp(error.timestamp)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* エラーパターン */}
        <TabsContent value="patterns" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 頻発エラー */}
            <Card>
              <CardHeader>
                <CardTitle>頻発エラー (過去7日)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {errorPatterns?.frequentErrors?.slice(0, 10).map((error: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{error.errorType}</p>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              error.severity === 'critical' ? 'destructive' :
                              error.severity === 'high' ? 'destructive' :
                              error.severity === 'medium' ? 'secondary' : 'outline'
                            }
                            className="text-xs"
                          >
                            {error.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {error.count}回発生
                          </span>
                        </div>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center py-4 text-muted-foreground">
                      <p>データがありません</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* コンポーネント別エラー */}
            <Card>
              <CardHeader>
                <CardTitle>コンポーネント別エラー</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {errorPatterns?.topComponents?.slice(0, 10).map((component: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{component.component}</p>
                        <p className="text-xs text-muted-foreground">
                          {component.errorCount}件のエラー
                        </p>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center py-4 text-muted-foreground">
                      <p>データがありません</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* トレンド */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>エラー発生トレンド (過去7日)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {errorPatterns?.errorTrends?.map((trend: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{trend.date}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(100, (trend.count / Math.max(...errorPatterns.errorTrends.map((t: any) => t.count))) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {trend.count}件
                        </span>
                      </div>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>データがありません</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ErrorMonitoringDashboard;
