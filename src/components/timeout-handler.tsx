'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, AlertTriangle, RefreshCw, X } from 'lucide-react';

interface TimeoutHandlerProps {
  timeout: number; // タイムアウト時間（ミリ秒）
  onTimeout: () => void;
  onCancel: () => void;
  onRetry: () => void;
  message?: string;
  showProgress?: boolean;
}

export const TimeoutHandler: React.FC<TimeoutHandlerProps> = ({
  timeout,
  onTimeout,
  onCancel,
  onRetry,
  message = '処理に時間がかかっています...',
  showProgress = true
}) => {
  const [timeLeft, setTimeLeft] = useState(timeout);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeLeft <= 0) {
      setIsTimedOut(true);
      onTimeout();
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1000) {
          setIsTimedOut(true);
          onTimeout();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeLeft, onTimeout]);

  const handleCancel = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    onCancel();
  };

  const handleRetry = () => {
    setTimeLeft(timeout);
    setIsTimedOut(false);
    onRetry();
  };

  const progress = ((timeout - timeLeft) / timeout) * 100;
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  if (isTimedOut) {
    return (
      <div className="flex items-start gap-4 max-w-full">
        <div className="h-8 w-8 border rounded-full flex items-center justify-center shrink-0 bg-yellow-100">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        </div>
        <div className="flex flex-col gap-2 items-start max-w-[85%] sm:max-w-[75%]">
          <Card className="bg-yellow-50 border-yellow-200 w-full">
            <CardContent className="p-4">
              <div className="text-center">
                <AlertTriangle className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-yellow-700 mb-2">
                  処理がタイムアウトしました
                </h3>
                <p className="text-xs text-yellow-600 mb-4">
                  検索処理が予想より時間がかかりました。再試行するか、別の検索を試してください。
                </p>
                
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={handleRetry}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    再試行
                  </Button>
                  <Button
                    onClick={onCancel}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    キャンセル
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4 max-w-full">
      <div className="h-8 w-8 border rounded-full flex items-center justify-center shrink-0 bg-blue-100">
        <Clock className="h-4 w-4 text-blue-500" />
      </div>
      <div className="flex flex-col gap-2 items-start max-w-[85%] sm:max-w-[75%]">
        <Card className="bg-blue-50 border-blue-200 w-full">
          <CardContent className="p-4">
            <div className="text-center">
              <Clock className="h-8 w-8 text-blue-400 mx-auto mb-3 animate-pulse" />
              <h3 className="text-sm font-medium text-blue-700 mb-2">
                {message}
              </h3>
              <p className="text-xs text-blue-600 mb-4">
                残り時間: {minutes > 0 ? `${minutes}分` : ''}{seconds}秒
              </p>
              
              {showProgress && (
                <div className="mb-4">
                  <Progress value={progress} className="h-2" />
                </div>
              )}
              
              <Button
                onClick={handleCancel}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                キャンセル
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// カスタムフック: タイムアウト管理
export const useTimeout = (callback: () => void, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const start = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => callbackRef.current(), delay);
  };

  const clear = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const reset = () => {
    clear();
    start();
  };

  useEffect(() => {
    return () => clear();
  }, []);

  return { start, clear, reset };
};

// 検索タイムアウトの管理
export const useSearchTimeout = (onTimeout: () => void, timeoutMs: number = 30000) => {
  const [isSearching, setIsSearching] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeoutMs);
  const { start, clear, reset } = useTimeout(onTimeout, timeoutMs);

  const startSearch = () => {
    setIsSearching(true);
    setTimeLeft(timeoutMs);
    start();
  };

  const stopSearch = () => {
    setIsSearching(false);
    clear();
  };

  const resetSearch = () => {
    setTimeLeft(timeoutMs);
    reset();
  };

  return {
    isSearching,
    timeLeft,
    startSearch,
    stopSearch,
    resetSearch
  };
};
