'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  AlertCircle, 
  RefreshCw, 
  FileText, 
  HelpCircle, 
  Lightbulb,
  Database,
  Wifi,
  WifiOff
} from 'lucide-react';

interface EmptyStateProps {
  type: 'no-results' | 'error' | 'loading-timeout' | 'network-error' | 'database-error';
  message?: string;
  onRetry?: () => void;
  onRefresh?: () => void;
  suggestions?: string[];
}

export const EmptyStateHandler: React.FC<EmptyStateProps> = ({
  type,
  message,
  onRetry,
  onRefresh,
  suggestions = []
}) => {
  const getEmptyStateConfig = () => {
    switch (type) {
      case 'no-results':
        return {
          icon: <Search className="h-12 w-12 text-gray-400" />,
          title: '検索結果が見つかりませんでした',
          description: '別のキーワードで検索してみてください',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          suggestions: [
            'キーワードを変更してみる',
            'より具体的な検索語を使用する',
            '関連する用語で検索する'
          ]
        };
      
      case 'error':
        return {
          icon: <AlertCircle className="h-12 w-12 text-red-400" />,
          title: 'エラーが発生しました',
          description: message || 'システムエラーが発生しました。しばらく時間をおいてから再試行してください。',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          suggestions: [
            'ページを再読み込みする',
            'しばらく時間をおいてから再試行する',
            '管理者にお問い合わせする'
          ]
        };
      
      case 'loading-timeout':
        return {
          icon: <RefreshCw className="h-12 w-12 text-yellow-400 animate-spin" />,
          title: '処理に時間がかかっています',
          description: '検索処理が予想より時間がかかっています。もう少しお待ちください。',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          suggestions: [
            'しばらく待つ',
            '検索をキャンセルして再試行する',
            'より簡単な検索語を使用する'
          ]
        };
      
      case 'network-error':
        return {
          icon: <WifiOff className="h-12 w-12 text-orange-400" />,
          title: 'ネットワーク接続エラー',
          description: 'インターネット接続を確認してください。',
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          suggestions: [
            'インターネット接続を確認する',
            'Wi-Fiの接続を確認する',
            'ページを再読み込みする'
          ]
        };
      
      case 'database-error':
        return {
          icon: <Database className="h-12 w-12 text-purple-400" />,
          title: 'データベース接続エラー',
          description: 'データベースへの接続に問題があります。',
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          suggestions: [
            'しばらく時間をおいてから再試行する',
            '管理者にお問い合わせする',
            'システムの状態を確認する'
          ]
        };
      
      default:
        return {
          icon: <HelpCircle className="h-12 w-12 text-gray-400" />,
          title: '不明なエラー',
          description: '予期しないエラーが発生しました。',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          suggestions: []
        };
    }
  };

  const config = getEmptyStateConfig();
  const displaySuggestions = suggestions.length > 0 ? suggestions : config.suggestions;

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <Card className={`w-full max-w-md ${config.bgColor} ${config.borderColor} border-2`}>
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            {config.icon}
          </div>
          
          <h3 className={`text-lg font-semibold mb-2 ${config.color}`}>
            {config.title}
          </h3>
          
          <p className={`text-sm mb-6 ${config.color} opacity-80`}>
            {config.description}
          </p>

          {/* 提案事項 */}
          {displaySuggestions.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-gray-700">提案事項</span>
              </div>
              <ul className="text-left space-y-2">
                {displaySuggestions.map((suggestion, index) => (
                  <li key={index} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex gap-2 justify-center">
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                再試行
              </Button>
            )}
            
            {onRefresh && (
              <Button
                onClick={onRefresh}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                更新
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// 検索結果が空の場合のコンポーネント
export const NoResultsFound: React.FC<{
  query: string;
  onRetry: () => void;
  onNewSearch: () => void;
}> = ({ query, onRetry, onNewSearch }) => {
  return (
    <div className="flex items-start gap-4 max-w-full">
      <div className="h-8 w-8 border rounded-full flex items-center justify-center shrink-0 bg-gray-100">
        <Search className="h-4 w-4 text-gray-500" />
      </div>
      <div className="flex flex-col gap-2 items-start max-w-[85%] sm:max-w-[75%]">
        <Card className="bg-gray-50 border-gray-200 w-full">
          <CardContent className="p-4">
            <div className="text-center">
              <Search className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                「{query}」の検索結果が見つかりませんでした
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                別のキーワードで検索してみてください
              </p>
              
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={onRetry}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  再検索
                </Button>
                <Button
                  onClick={onNewSearch}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  新しい検索
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// エラー状態のコンポーネント
export const ErrorState: React.FC<{
  error: Error | string;
  onRetry: () => void;
}> = ({ error, onRetry }) => {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return (
    <div className="flex items-start gap-4 max-w-full">
      <div className="h-8 w-8 border rounded-full flex items-center justify-center shrink-0 bg-red-100">
        <AlertCircle className="h-4 w-4 text-red-500" />
      </div>
      <div className="flex flex-col gap-2 items-start max-w-[85%] sm:max-w-[75%]">
        <Card className="bg-red-50 border-red-200 w-full">
          <CardContent className="p-4">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-red-700 mb-2">
                エラーが発生しました
              </h3>
              <p className="text-xs text-red-600 mb-4">
                {errorMessage}
              </p>
              
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="text-xs border-red-300 text-red-600 hover:bg-red-50"
              >
                再試行
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
