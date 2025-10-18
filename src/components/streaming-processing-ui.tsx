/**
 * ストリーミング処理UIコンポーネント
 * 4つのステップを動的に更新して表示
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Brain, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { ProcessingStep } from '@/lib/streaming-process-client';

interface StreamingProcessingUIProps {
  currentStep: ProcessingStep | null;
  isVisible: boolean;
}

const STEP_ICONS = {
  search: Search,
  processing: Loader2,
  brain: Brain,
  check: CheckCircle,
  default: Clock
};

export const StreamingProcessingUI: React.FC<StreamingProcessingUIProps> = ({
  currentStep,
  isVisible
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (currentStep) {
      const progressPercentage = (currentStep.step / currentStep.totalSteps) * 100;
      setProgress(progressPercentage);
    }
  }, [currentStep]);

  if (!isVisible || !currentStep) {
    return null;
  }

  const IconComponent = STEP_ICONS[currentStep.icon as keyof typeof STEP_ICONS] || STEP_ICONS.default;

  return (
    <div className="flex items-start gap-4 max-w-full">
      <div className="h-8 w-8 border shrink-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
        <IconComponent className="h-4 w-4 text-white animate-pulse" />
      </div>
      <div className="flex flex-col gap-2 items-start max-w-[85%] sm:max-w-[75%]">
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 w-full min-w-[200px]">
          <CardContent className="p-4">
            {/* プログレスバー */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span className="font-medium">{currentStep.title}</span>
                <span className="font-bold">{currentStep.step}/{currentStep.totalSteps}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* ステップ表示 */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-100 border border-blue-300">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  {currentStep.step === 0 && (
                    <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {currentStep.step === 1 && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {currentStep.step === 2 && (
                    <Brain className="h-3 w-3" />
                  )}
                  {currentStep.step === 3 && (
                    <CheckCircle className="h-3 w-3" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-blue-900">
                    {currentStep.title}
                  </div>
                  <div className="text-xs text-blue-700">
                    {currentStep.description}
                  </div>
                </div>
                <div className="text-xs text-blue-600 font-bold">
                  {currentStep.step}/{currentStep.totalSteps}
                </div>
              </div>
            </div>

            {/* ヒントメッセージ */}
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-yellow-800">
                <div className="w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center">
                  <span className="text-yellow-800 text-xs">💡</span>
                </div>
                <span className="font-medium">ヒント:</span>
                <span>初回検索は時間がかかりますが、次回からは高速になります</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// エラー表示コンポーネント
interface StreamingErrorUIProps {
  error: string;
  isVisible: boolean;
}

export const StreamingErrorUI: React.FC<StreamingErrorUIProps> = ({
  error,
  isVisible
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="flex items-start gap-4 max-w-full">
      <div className="h-8 w-8 border shrink-0 rounded-full bg-red-500 flex items-center justify-center">
        <AlertCircle className="h-4 w-4 text-white" />
      </div>
      <div className="flex flex-col gap-2 items-start max-w-[85%] sm:max-w-[75%]">
        <Card className="bg-red-50 border-red-200 w-full min-w-[200px]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">エラーが発生しました</span>
            </div>
            <div className="mt-2 text-sm text-red-700">
              {error}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
