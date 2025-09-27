'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, Search, Database, Brain, FileText, Loader2 } from 'lucide-react';

interface LoadingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  estimatedTime: string;
}

interface EnhancedLoadingProps {
  currentStep: number;
  totalSteps: number;
  isVisible: boolean;
}

const loadingSteps: LoadingStep[] = [
  {
    id: 'search',
    title: '検索中...',
    description: '関連ドキュメントを検索しています',
    icon: <Search className="h-4 w-4" />,
    estimatedTime: '2-3秒'
  },
  {
    id: 'vector',
    title: 'ベクトル検索',
    description: 'AIが意味を理解して検索中',
    icon: <Database className="h-4 w-4" />,
    estimatedTime: '3-5秒'
  },
  {
    id: 'keyword',
    title: 'キーワード分析',
    description: '専門用語を抽出中',
    icon: <FileText className="h-4 w-4" />,
    estimatedTime: '1-2秒'
  },
  {
    id: 'ai',
    title: 'AI回答生成',
    description: '最適な回答を作成中',
    icon: <Brain className="h-4 w-4" />,
    estimatedTime: '5-10秒'
  }
];

export const EnhancedLoadingStates: React.FC<EnhancedLoadingProps> = ({
  currentStep,
  totalSteps,
  isVisible
}) => {
  if (!isVisible) return null;

  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="flex items-start gap-4 max-w-full animate-in slide-in-from-top-2 duration-300">
      <div className="h-8 w-8 border rounded-full flex items-center justify-center shrink-0 bg-gradient-to-r from-blue-500 to-purple-500">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="flex flex-col gap-3 items-start max-w-[85%] sm:max-w-[75%] flex-1">
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
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* 現在のステップ */}
            <div className="space-y-3">
              {loadingSteps.map((step, index) => {
                const isActive = index === currentStep - 1;
                const isCompleted = index < currentStep - 1;
                const isPending = index > currentStep - 1;

                return (
                  <div 
                    key={step.id}
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
                        <Loader2 className="h-3 w-3 animate-spin" />
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
                        {step.description}
                        {isActive && (
                          <span className="ml-2 text-blue-600">
                            (約{step.estimatedTime})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ヒントメッセージ */}
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

// 段階的ローディングの管理フック
export const useProgressiveLoading = () => {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isVisible, setIsVisible] = React.useState(false);

  const startLoading = () => {
    setIsVisible(true);
    setCurrentStep(1);
  };

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const completeLoading = () => {
    setIsVisible(false);
    setCurrentStep(0);
  };

  const simulateProgressiveLoading = () => {
    startLoading();
    
    // 段階的に進行
    const intervals = [2000, 3000, 2000, 5000]; // 各ステップの時間
    
    intervals.forEach((delay, index) => {
      setTimeout(() => {
        nextStep();
      }, delay);
    });

    // 全体の完了
    setTimeout(() => {
      completeLoading();
    }, intervals.reduce((a, b) => a + b, 0));
  };

  return {
    currentStep,
    isVisible,
    startLoading,
    nextStep,
    completeLoading,
    simulateProgressiveLoading
  };
};
