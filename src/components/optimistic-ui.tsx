'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, User, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface OptimisticMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  status: 'sending' | 'processing' | 'completed' | 'error';
  timestamp: Date;
  estimatedTime?: number;
}

interface OptimisticUIProps {
  onMessageSubmit: (content: string) => Promise<void>;
  onMessageComplete: (messageId: string, response: string) => void;
  onMessageError: (messageId: string, error: string) => void;
}

export const OptimisticUI: React.FC<OptimisticUIProps> = ({
  onMessageSubmit,
  onMessageComplete,
  onMessageError
}) => {
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting) return;

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    // 1. 即座にユーザーメッセージを表示
    const userMessage: OptimisticMessage = {
      id: userMessageId,
      content: input,
      role: 'user',
      status: 'completed',
      timestamp: new Date()
    };

    // 2. 即座にアシスタントの「処理中」メッセージを表示
    const assistantMessage: OptimisticMessage = {
      id: assistantMessageId,
      content: '質問を理解しています...',
      role: 'assistant',
      status: 'processing',
      timestamp: new Date(),
      estimatedTime: 15 // 15秒の予想時間
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsSubmitting(true);

    // 3. 段階的にメッセージを更新
    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: '関連ドキュメントを検索中...', status: 'processing' as const }
          : msg
      ));
    }, 2000);

    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: 'AIが回答を生成中...', status: 'processing' as const }
          : msg
      ));
    }, 5000);

    try {
      // 4. 実際のAPI呼び出し
      await onMessageSubmit(input);
      
      // 5. 成功時の処理
      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { 
                ...msg, 
                content: '回答が生成されました。詳細を取得中...', 
                status: 'completed' as const 
              }
            : msg
        ));
        
        // 実際の回答で置き換え
        setTimeout(() => {
          onMessageComplete(assistantMessageId, '実際の回答がここに表示されます');
        }, 1000);
      }, 8000);

    } catch (error) {
      // 6. エラー時の処理
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { 
              ...msg, 
              content: 'エラーが発生しました。もう一度お試しください。', 
              status: 'error' as const 
            }
          : msg
      ));
      onMessageError(assistantMessageId, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: OptimisticMessage['status']) => {
    switch (status) {
      case 'sending':
        return <Clock className="h-3 w-3 animate-pulse" />;
      case 'processing':
        return <Clock className="h-3 w-3 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
    }
  };

  const getStatusColor = (status: OptimisticMessage['status']) => {
    switch (status) {
      case 'sending':
        return 'border-yellow-200 bg-yellow-50';
      case 'processing':
        return 'border-blue-200 bg-blue-50';
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* メッセージ表示エリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
            {message.role === 'assistant' && (
              <div className="h-8 w-8 border rounded-full flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
            )}
            
            <div className={`flex flex-col gap-2 ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
              <Card className={`w-full ${getStatusColor(message.status)}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(message.status)}
                    <span className="text-xs text-muted-foreground">
                      {message.status === 'processing' && message.estimatedTime && 
                        `約${message.estimatedTime}秒で完了予定`
                      }
                    </span>
                  </div>
                  <div className="text-sm">
                    {message.content}
                    {message.status === 'processing' && (
                      <div className="mt-2 flex items-center gap-1">
                        <div className="h-1 w-1 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="h-1 w-1 bg-blue-500 rounded-full animate-bounce delay-75"></div>
                        <div className="h-1 w-1 bg-blue-500 rounded-full animate-bounce delay-150"></div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>

            {message.role === 'user' && (
              <div className="h-8 w-8 border rounded-full flex items-center justify-center shrink-0">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 入力フォーム */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex items-start gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 p-3 border rounded-lg resize-none"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting || !input.trim()}
            className="px-4 py-3 bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '送信中...' : '送信'}
          </button>
        </form>
      </div>
    </div>
  );
};
