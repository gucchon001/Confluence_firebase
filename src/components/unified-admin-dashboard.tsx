'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Users, 
  AlertTriangle, 
  TrendingUp,
  BarChart3,
  Eye,
  RefreshCw,
  Zap,
  Target,
  Server,
  Database,
  Brain,
  Search,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

// 統合された管理ダッシュボード
// 仕様書に基づく4つの主要機能を統合
const UnifiedAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // 統合されたデータ取得
  const loadUnifiedData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // 全サービスからデータを並行取得
      const [
        // 投稿ログデータ
        // エラー監視データ  
        // システムヘルスデータ
        // パフォーマンスデータ
      ] = await Promise.all([
        // 実装予定
      ]);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('統合データ取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnifiedData();
    
    // リアルタイム更新（30秒間隔）
    const interval = setInterval(loadUnifiedData, 30000);
    return () => clearInterval(interval);
  }, [loadUnifiedData]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">管理ダッシュボード</h1>
          <p className="text-muted-foreground">
            最終更新: {lastUpdate.toLocaleString('ja-JP')}
          </p>
        </div>
        <Button onClick={loadUnifiedData} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      {/* タブナビゲーション */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            概要
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            監視
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            パフォーマンス
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            分析
          </TabsTrigger>
        </TabsList>

        {/* 概要タブ - 仕様書の「ダッシュボード（メイン画面）」 */}
        <TabsContent value="overview" className="space-y-6">
          {/* リアルタイムメトリクス */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">検索時間</CardTitle>
                <Search className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2.3s</div>
                <p className="text-xs text-muted-foreground">
                  平均応答時間
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI生成時間</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">15.2s</div>
                <p className="text-xs text-muted-foreground">
                  平均生成時間
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">総処理時間</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">17.5s</div>
                <p className="text-xs text-muted-foreground">
                  平均総時間
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">エラー率</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0.5%</div>
                <p className="text-xs text-muted-foreground">
                  過去24時間
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 現在進行中の会話 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                現在進行中の会話
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">ユーザーA</div>
                    <div className="text-sm text-muted-foreground">
                      "教室管理の詳細は..."
                    </div>
                  </div>
                  <Badge variant="secondary">検索中</Badge>
                  <div className="text-sm text-muted-foreground ml-4">00:05</div>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">ユーザーB</div>
                    <div className="text-sm text-muted-foreground">
                      "ログイン認証の仕組みは..."
                    </div>
                  </div>
                  <Badge variant="warning">AI生成中</Badge>
                  <div className="text-sm text-muted-foreground ml-4">00:12</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 監視タブ - 仕様書の「投稿監視画面」 */}
        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>投稿監視</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                投稿監視機能の実装予定
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* パフォーマンスタブ - 仕様書の「パフォーマンス分析画面」 */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>パフォーマンス分析</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                パフォーマンス分析機能の実装予定
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 分析タブ - 仕様書の「ログ分析画面」 */}
        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>ログ分析</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                ログ分析機能の実装予定
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UnifiedAdminDashboard;
