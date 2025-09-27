'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, Search, Database, Brain, FileText } from 'lucide-react';

interface ResponsiveLoadingProps {
  isVisible: boolean;
  currentStep: number;
  totalSteps: number;
  isMobile?: boolean;
}

export const ResponsiveLoading: React.FC<ResponsiveLoadingProps> = ({
  isVisible,
  currentStep,
  totalSteps,
  isMobile = false
}) => {
  if (!isVisible) return null;

  const progress = (currentStep / totalSteps) * 100;

  const steps = [
    { icon: <Search className="h-4 w-4" />, title: '検索中', desc: '関連ドキュメントを検索' },
    { icon: <Database className="h-4 w-4" />, title: 'ベクトル検索', desc: 'AIが意味を理解' },
    { icon: <FileText className="h-4 w-4" />, title: 'キーワード分析', desc: '専門用語を抽出' },
    { icon: <Brain className="h-4 w-4" />, title: 'AI回答生成', desc: '最適な回答を作成' }
  ];

  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-sm bg-white">
          <CardContent className="p-6">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">処理中...</h3>
              <p className="text-sm text-gray-600">しばらくお待ちください</p>
            </div>

            {/* プログレスバー */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>進行状況</span>
                <span>{currentStep}/{totalSteps}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* 現在のステップ */}
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900">
                {steps[currentStep - 1]?.title || '処理中...'}
              </div>
              <div className="text-xs text-gray-600">
                {steps[currentStep - 1]?.desc || 'しばらくお待ちください'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
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
                <span>{currentStep}/{totalSteps}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* ステップ表示 */}
            <div className="space-y-2">
              {steps.map((step, index) => {
                const isActive = index === currentStep - 1;
                const isCompleted = index < currentStep - 1;
                const isPending = index > currentStep - 1;

                return (
                  <div 
                    key={index}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-300 ${
                      isActive 
                        ? 'bg-blue-100 border border-blue-300' 
                        : isCompleted 
                        ? 'bg-green-50 border border-green-200' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full ${
                      isActive 
                        ? 'bg-blue-500 text-white' 
                        : isCompleted 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-300 text-gray-500'
                    }`}>
                      {isActive ? (
                        <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : isCompleted ? (
                        <div className="h-3 w-3 text-xs">✓</div>
                      ) : (
                        step.icon
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${
                        isActive ? 'text-blue-700' : isCompleted ? 'text-green-700' : 'text-gray-500'
                      }`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {step.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
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
};

// モバイル検出フック
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};
