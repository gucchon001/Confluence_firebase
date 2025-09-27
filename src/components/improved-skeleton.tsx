'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, FileText, Link as LinkIcon } from 'lucide-react';

interface SkeletonMessageProps {
  type?: 'simple' | 'detailed' | 'with-sources';
}

export const SkeletonMessage: React.FC<SkeletonMessageProps> = ({ type = 'detailed' }) => {
  const renderSimpleSkeleton = () => (
    <div className="flex items-start gap-4 max-w-full">
      <div className="h-8 w-8 border rounded-full flex items-center justify-center shrink-0 bg-gradient-to-r from-blue-500 to-purple-500">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="flex flex-col gap-2 items-start max-w-[85%] sm:max-w-[75%]">
        <Card className="bg-white w-full min-w-[200px]">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderDetailedSkeleton = () => (
    <div className="flex items-start gap-4 max-w-full">
      <div className="h-8 w-8 border rounded-full flex items-center justify-center shrink-0 bg-gradient-to-r from-blue-500 to-purple-500">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="flex flex-col gap-2 items-start max-w-[85%] sm:max-w-[75%]">
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 w-full">
          <CardContent className="p-4">
            {/* プログレスバー */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>処理中...</span>
                <span>2/4</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full w-1/2 animate-pulse"></div>
              </div>
            </div>

            {/* ステップ表示 */}
            <div className="space-y-2">
              {['検索中...', 'AIが回答を生成中...'].map((step, index) => (
                <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-blue-100 border border-blue-300">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-700">{step}</div>
                    <div className="text-xs text-muted-foreground">
                      {index === 0 ? '関連ドキュメントを検索しています' : '最適な回答を作成中'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ヒント */}
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-xs text-yellow-800">
                💡 <strong>ヒント:</strong> 初回検索は時間がかかりますが、次回からは高速になります
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderWithSourcesSkeleton = () => (
    <div className="flex items-start gap-4 max-w-full">
      <div className="h-8 w-8 border rounded-full flex items-center justify-center shrink-0 bg-gradient-to-r from-blue-500 to-purple-500">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="flex flex-col gap-2 items-start max-w-[85%] sm:max-w-[75%]">
        <Card className="bg-white w-full">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </CardContent>
          <div className="border-t p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">参考資料</span>
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-gray-50 animate-pulse">
                  <LinkIcon className="h-3 w-3 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="h-3 w-3/4 bg-gray-200 rounded mb-1"></div>
                    <div className="h-2 w-1/4 bg-gray-200 rounded"></div>
                  </div>
                  <div className="h-4 w-8 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  switch (type) {
    case 'simple':
      return renderSimpleSkeleton();
    case 'with-sources':
      return renderWithSourcesSkeleton();
    default:
      return renderDetailedSkeleton();
  }
};

// パルスアニメーション付きのテキストスケルトン
export const TextSkeleton: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 3, 
  className = '' 
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className={`h-4 bg-gray-200 rounded animate-pulse ${
          i === lines - 1 ? 'w-3/4' : 'w-full'
        }`}
        style={{ animationDelay: `${i * 0.1}s` }}
      />
    ))}
  </div>
);

// カードスケルトン
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="animate-pulse">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
            <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
            <div className="h-3 w-2/3 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// プログレスバースケルトン
export const ProgressSkeleton: React.FC = () => (
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full w-1/2 animate-pulse"></div>
  </div>
);
