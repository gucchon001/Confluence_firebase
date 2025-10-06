'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Server, 
  Database, 
  Search, 
  Brain,
  TrendingUp, 
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  Users,
  Zap,
  Monitor,
  Wifi,
  HardDrive
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { systemHealthService, type SystemStatus, type SystemAlert } from '@/lib/system-health-service';

interface SystemHealthDashboardProps {
  className?: string;
}

const SystemHealthDashboard: React.FC<SystemHealthDashboardProps> = ({ className }) => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<SystemAlert[]>([]);
  const [performanceTrend, setPerformanceTrend] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      const dashboardData = await systemHealthService.getHealthDashboardData();
      
      setSystemStatus(dashboardData.status);
      setRecentAlerts(dashboardData.recentAlerts);
      setPerformanceTrend(dashboardData.performanceTrend);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load system health data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // 1分ごとにデータを更新
    const interval = setInterval(loadData, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: 'healthy' | 'degraded' | 'critical'): string => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: 'healthy' | 'degraded' | 'critical') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <XCircle className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleString('ja-JP', {
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
            <Activity className="h-6 w-6 text-blue-500" />
            システムヘルス監視
          </h2>
          <p className="text-muted-foreground">
            最終更新: {lastUpdate.toLocaleString('ja-JP')}
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          更新
        </Button>
      </div>

      {/* システムステータス */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">全体ステータス</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {systemStatus && (
                <Badge className={getStatusColor(systemStatus.overall)}>
                  {getStatusIcon(systemStatus.overall)}
                  <span className="ml-1 capitalize">{systemStatus.overall}</span>
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">アプタイム</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {systemStatus?.metrics.uptime.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              過去24時間
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">レスポンス時間</CardTitle>
            <Zap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStatus?.metrics.responseTime}ms
            </div>
            <p className="text-xs text-muted-foreground">
              平均API応答時間
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">アクティブユーザー</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {systemStatus?.metrics.activeUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              現在オンライン
            </p>
          </CardContent>
        </Card>
      </div>

      {/* コンポーネントステータス */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">データベース</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {systemStatus && (
                <Badge className={getStatusColor(systemStatus.components.database)}>
                  {getStatusIcon(systemStatus.components.database)}
                  <span className="ml-1 capitalize">{systemStatus.components.database}</span>
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {systemStatus && (
                <Badge className={getStatusColor(systemStatus.components.api)}>
                  {getStatusIcon(systemStatus.components.api)}
                  <span className="ml-1 capitalize">{systemStatus.components.api}</span>
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">検索</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {systemStatus && (
                <Badge className={getStatusColor(systemStatus.components.search)}>
                  {getStatusIcon(systemStatus.components.search)}
                  <span className="ml-1 capitalize">{systemStatus.components.search}</span>
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {systemStatus && (
                <Badge className={getStatusColor(systemStatus.components.ai)}>
                  {getStatusIcon(systemStatus.components.ai)}
                  <span className="ml-1 capitalize">{systemStatus.components.ai}</span>
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 重要なアラート */}
      {recentAlerts.filter(alert => alert.severity === 'critical' || alert.severity === 'high').length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>注意:</strong> {recentAlerts.filter(alert => alert.severity === 'critical' || alert.severity === 'high').length}件の重要なアラートが発生しています。
          </AlertDescription>
        </Alert>
      )}

      {/* タブコンテンツ */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="alerts">アラート</TabsTrigger>
          <TabsTrigger value="performance">パフォーマンス</TabsTrigger>
          <TabsTrigger value="metrics">メトリクス</TabsTrigger>
        </TabsList>

        {/* 概要 */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* パフォーマンストレンド */}
            <Card>
              <CardHeader>
                <CardTitle>パフォーマンストレンド (過去24時間)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={performanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString('ja-JP')}
                      formatter={(value: number) => [`${value}ms`, 'レスポンス時間']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* システム概要 */}
            <Card>
              <CardHeader>
                <CardTitle>システム概要</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">エラー率</span>
                    <span className="text-sm text-muted-foreground">
                      {systemStatus?.metrics.errorRate}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">アクティブアラート</span>
                    <span className="text-sm text-muted-foreground">
                      {recentAlerts.filter(alert => !alert.resolved).length}件
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">最終更新</span>
                    <span className="text-sm text-muted-foreground">
                      {systemStatus?.lastUpdated.toLocaleTimeString('ja-JP')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* アラート */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>システムアラート (最新10件)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentAlerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>アラートはありません</p>
                  </div>
                ) : (
                  recentAlerts.map((alert) => (
                    <div key={alert.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant={
                                alert.severity === 'critical' ? 'destructive' :
                                alert.severity === 'high' ? 'destructive' :
                                alert.severity === 'medium' ? 'secondary' : 'outline'
                              }
                              className="text-xs"
                            >
                              {alert.severity}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {alert.alertType}
                            </Badge>
                            {alert.resolved && (
                              <Badge variant="outline" className="text-xs text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                解決済み
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium">{alert.message}</p>
                          {alert.metadata.component && (
                            <p className="text-xs text-muted-foreground mt-1">
                              コンポーネント: {alert.metadata.component}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => systemHealthService.resolveAlert(alert.id, 'admin')}
                          disabled={alert.resolved}
                        >
                          {alert.resolved ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {alert.resolved ? '解決済み' : '解決'}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        発生時刻: {formatTimestamp(alert.timestamp)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* パフォーマンス */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>パフォーマンスメトリクス</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {systemStatus?.metrics.responseTime}ms
                  </div>
                  <div className="text-sm text-muted-foreground">平均レスポンス時間</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {systemStatus?.metrics.uptime}%
                  </div>
                  <div className="text-sm text-muted-foreground">アプタイム</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {systemStatus?.metrics.errorRate}%
                  </div>
                  <div className="text-sm text-muted-foreground">エラー率</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* メトリクス */}
        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>リアルタイムメトリクス</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Monitor className="h-8 w-8 mx-auto mb-2" />
                <p>詳細なメトリクスデータは開発中です</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemHealthDashboard;
