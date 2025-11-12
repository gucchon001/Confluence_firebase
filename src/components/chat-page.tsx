'use client';

import type { User } from 'firebase/auth';
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Bot, Send, User as UserIcon, LogOut, Loader2, FileText, Link as LinkIcon, AlertCircle, Plus, MessageSquare, Settings, ChevronDown, Clock, Search, Brain, Shield, BarChart3, Menu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuthWrapper } from '@/hooks/use-auth-wrapper';
import { useAdmin } from '@/hooks/use-admin';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type Message } from '@/types';
import { askQuestion } from '@/app/actions';
import { getMessages, addMessageBatch } from '@/lib/chat-service';
import { 
  getConversations, 
  createConversation, 
  updateConversationTitle, 
  addMessageToConversation, 
  getConversation, 
  deleteConversation 
} from '@/lib/conversation-service';
import { useToast } from '@/hooks/use-toast';
import { showErrorToast, showSuccessToast, showApiErrorToast, handleNetworkError } from '@/lib/toast-helpers';
import { EmptyStateHandler, NoResultsFound, ErrorState } from '@/components/empty-state-handler';
import { TimeoutHandler, useSearchTimeout } from '@/components/timeout-handler';
import { StreamingProcessingUI, StreamingErrorUI } from '@/components/streaming-processing-ui';
import { streamingProcessClient, ProcessingStep } from '@/lib/streaming-process-client';
import AdminDashboard from '@/components/admin-dashboard';
import { FeedbackRating } from '@/components/feedback-rating';
import { fixMarkdownTables, normalizeMarkdownSymbols, sharedMarkdownComponents } from '@/lib/markdown-utils';
// 重複コード修正をロールバック
// import MigrationButton from '@/components/migration-button';

interface ChatPageProps {
  user: User;
}

const MessageCard = ({ msg }: { msg: Message }) => {
    const isAssistant = msg.role === 'assistant';
    return (
      <div className={`flex items-start gap-4 ${isAssistant ? '' : 'justify-end'} max-w-full`}>
        {isAssistant && (
          <Avatar className="h-8 w-8 border shrink-0">
            <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
          </Avatar>
        )}
        <div className={`flex flex-col gap-2 ${isAssistant ? 'items-start' : 'items-end'} max-w-[85%] sm:max-w-[75%]`}>
            <Card className={`w-full ${isAssistant ? 'bg-white' : 'bg-primary text-primary-foreground'}`}>
            <CardContent className={`p-4 text-sm break-words ${isAssistant ? 'prose prose-sm max-w-none' : ''}`}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={sharedMarkdownComponents as any}
                >
                  {isAssistant ? normalizeMarkdownSymbols(fixMarkdownTables(msg.content)) : msg.content}
                </ReactMarkdown>
            </CardContent>
            {isAssistant && msg.sources && msg.sources.length > 0 && (
                <CardFooter className="border-t p-4">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="references" className="border-none">
                            <AccordionTrigger className="py-2 px-0 hover:no-underline">
                                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                    参照元 ({msg.sources.length}件)
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2">
                                <div className="flex flex-col gap-2 w-full">
                                    {msg.sources.map((source: any, index) => (
                                    <a
                                        key={index}
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline flex items-center gap-1 w-full p-2 rounded-md hover:bg-gray-50 transition-colors"
                                    >
                                        <LinkIcon className="h-3 w-3 shrink-0" />
                                        <span className="truncate flex-1">{source.title}</span>
                                        <span className="text-xs text-muted-foreground ml-1 shrink-0">
                                            ({(() => {
                                              // 優先順位1: 既に計算済みのscoreフィールド（0-100の範囲）
                                              if (typeof source.score === 'number' && !isNaN(source.score) && isFinite(source.score)) {
                                                return Math.max(0, Math.min(100, Math.round(source.score)));
                                              }
                                              // 優先順位2: Composite Score（0-1の範囲を0-100に変換）
                                              if (typeof source._compositeScore === 'number' && !isNaN(source._compositeScore) && isFinite(source._compositeScore)) {
                                                return Math.max(0, Math.min(100, Math.round(source._compositeScore * 100)));
                                              }
                                              // 優先順位3: distanceから計算（ベクトル距離の場合）
                                              if (typeof source.distance === 'number' && !isNaN(source.distance) && isFinite(source.distance)) {
                                                // distanceが0-1の範囲の場合
                                                if (source.distance >= 0 && source.distance <= 1) {
                                                  return Math.max(0, Math.min(100, Math.round((1 - source.distance) * 100)));
                                                }
                                                // distanceが1を超える場合（ユークリッド距離など）
                                                return Math.max(0, Math.min(100, Math.round((1 / (1 + source.distance)) * 100)));
                                              }
                                              // フォールバック: 不明な場合は表示しない（または0%を表示）
                                              return 0;
                                            })()}% 一致)
                                        </span>
                                        <span className="text-xs ml-1 font-bold shrink-0" style={{color: 'blue'}}>
                                            {source.source === 'keyword' ? '⌨️' : '🔍'}
                                        </span>
                                    </a>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardFooter>
            )}
            </Card>
            <p className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleTimeString()}</p>
        </div>
        {!isAssistant && (
          <Avatar className="h-8 w-8 border shrink-0">
            <AvatarImage src={msg.user?.photoURL || ''} alt={msg.user?.displayName || 'User'} />
            <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
          </Avatar>
        )}
      </div>
    );
};

// SkeletonMessageコンポーネントは削除されました

/**
 * マークダウン記号を除去してプレーンテキストに変換
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')           // 見出し記号を除去
    .replace(/\*\*/g, '')                  // 太字を除去
    .replace(/\*/g, '')                    // イタリックを除去
    .replace(/`/g, '')                     // コードを除去
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')  // リンクを除去（テキストのみ残す）
    .replace(/\n/g, ' ')                   // 改行をスペースに
    .trim();
}

export default function ChatPage({ user }: ChatPageProps) {
  const { signOut } = useAuthWrapper();
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // モバイルでは初期状態は閉じる
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; lastMessage: string; timestamp: string }>>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  // ストリーミング処理の状態
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStep, setCurrentStep] = useState<ProcessingStep | null>(null);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const [streamingAnswer, setStreamingAnswer] = useState<string>('');
  const [streamingReferences, setStreamingReferences] = useState<any[]>([]);
  const [currentPostLogId, setCurrentPostLogId] = useState<string | null>(null);
  const [isStreamingComplete, setIsStreamingComplete] = useState<boolean>(false);
  const [currentSessionId] = useState<string>(() => `session_${Date.now()}`);

  // ストリーミング回答の安全な更新関数
  const updateStreamingAnswer = (newContent: any) => {
    // 元のコードに戻す
    if (typeof newContent === 'string' && newContent) {
      setStreamingAnswer(prev => {
        const combined = prev + newContent;
        
        // 最小ルール: 表直前に空行を1つ確保するのみ
        const processedContent = combined.replace(/([。？！｡！？])\n(\|\s*[^\n]+\s*\|)/g, '$1\n\n$2');
        return processedContent;
      });
    } else {
      console.warn('Invalid content detected, skipping:', newContent);
    }
  };

  // ストリーミング回答の安全な設定関数
  const setStreamingAnswerSafe = (content: any) => {
    // 元のコードに戻す
    if (typeof content === 'string' && content) {
      // 最小ルール: 表直前に空行を1つ確保（句読点直後のみ）
      const processedContent = content.replace(/([。？！｡！？])\n(\|\s*[^\n]+\s*\|)/g, '$1\n\n$2');
      setStreamingAnswer(processedContent);
    } else {
      console.warn('Invalid content detected, using fallback:', content);
      setStreamingAnswer('回答の生成中にエラーが発生しました。');
    }
  };
  
  // ラベルフィルタの状態
  const [labelFilters, setLabelFilters] = useState({
    includeMeetingNotes: false
  });
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // 画面サイズに応じてサイドバーの初期状態を設定
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true); // デスクトップでは常に表示
      } else {
        setIsSidebarOpen(false); // モバイルでは閉じる
      }
    };
    
    // 初回実行
    handleResize();
    
    // リサイズイベントリスナー
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        // 既存の会話一覧を取得
        const userConversations = await getConversations(user.uid);
        setConversations(userConversations);
        
        // 会話が存在する場合は最新の会話を選択
        if (userConversations.length > 0) {
          setCurrentConversationId(userConversations[0].id);
          
          // 選択された会話のメッセージを取得
          const conversation = await getConversation(user.uid, userConversations[0].id);
          setMessages(conversation.messages);
        } else {
          // 会話が存在しない場合は空の配列をセット
          setMessages([]);
        }
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
        
        // 新しい会話構造が失敗した場合は、従来の方法でメッセージを取得
        try {
          const history = await getMessages(user.uid);
          setMessages(history);
        } catch (legacyError) {
          console.error("Failed to fetch chat history using legacy method:", legacyError);
          if (!handleNetworkError(error)) {
            showErrorToast('database_read_error', '会話履歴の読み込みに失敗しました。');
          }
        }
      } finally {
        setIsLoadingHistory(false);
      }
    };
    fetchConversations();
  }, [user.uid, toast]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isLoading]);

  const handleSignOut = async () => {
    await signOut();
  };


  // テキストエリアの参照を保持するためのref
  const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = async (e?: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLTextAreaElement>) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || isStreaming) return;

    // 入力内容を一時変数に保存（非同期処理で使用するため）
    const currentInput = input;
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: currentInput,
      createdAt: new Date().toISOString(),
      user: {
        displayName: user.displayName,
        photoURL: user.photoURL,
      }
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setInput(''); // 入力フィールドをクリア
    
    // 処理開始時刻を記録（ユーザー体感時間を正確に測定）
    const clientStartTime = Date.now();
    
    // ストリーミング処理の初期化
    setIsStreaming(true);
    setIsStreamingComplete(false);
    setCurrentStep(null); // サーバーからのステップ更新を待つ
    setStreamingError(null);
    setStreamingAnswer('');
    setStreamingReferences([]);

    // ストリーミング処理を実行
    try {
      // ストリーミング処理を開始（開始時刻を渡す）
      await streamingProcessClient.startStreaming(
        currentInput,
        // ステップ更新コールバック
        (step: ProcessingStep) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('ステップ更新:', step);
          }
          setCurrentStep(step);
        },
        // チャンク受信コールバック
        (chunk: string, chunkIndex: number) => {
          updateStreamingAnswer(chunk);
        },
        // 完了コールバック
        async (fullAnswer: string, references: any[], postLogId?: string) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('ストリーミング完了:', fullAnswer);
            console.log('🔍 [DEBUG] postLogId received:', postLogId);
          }
          setStreamingAnswerSafe(fullAnswer);
          setStreamingReferences(references);
          setCurrentPostLogId(postLogId || null);
          
          // 最終的なメッセージを作成（テーブル処理を適用）
          let processedFullAnswer = fullAnswer;
          
          const messageId = `assistant-${Date.now()}`;
          const assistantMessage: Message = {
            id: messageId,
            role: 'assistant',
            content: processedFullAnswer,
            createdAt: new Date().toISOString(),
            sources: references.map((ref: any) => ({
              title: ref.title || 'No Title',
              url: ref.url || '',
              distance: ref.distance !== undefined ? ref.distance : (ref.score !== undefined ? 1 - ref.score : 0.5),
              source: ref.source
            })),
            postLogId: postLogId || undefined
          };

          setMessages((prev: Message[]) => [...prev, assistantMessage]);
          
          // 会話にメッセージを追加
          try {
            
            if (currentConversationId) {
              // 既存の会話にメッセージを追加
              if (process.env.NODE_ENV === 'development') {
                console.log(`[Firebase] Adding messages to existing conversation: ${currentConversationId}`);
              }
              await addMessageToConversation(user.uid, currentConversationId, 
                { role: 'user', content: userMessage.content, user: userMessage.user }
              );
              await addMessageToConversation(user.uid, currentConversationId, 
                { role: 'assistant', content: assistantMessage.content, sources: assistantMessage.sources }
              );
            } else {
              // 新しい会話を作成
              if (process.env.NODE_ENV === 'development') {
                console.log(`[Firebase] Creating new conversation for user: ${user.uid}`);
              }
              const newConversationId = await createConversation(user.uid, 
                { role: 'user', content: userMessage.content, user: userMessage.user }
              );
              await addMessageToConversation(user.uid, newConversationId, 
                { role: 'assistant', content: assistantMessage.content, sources: assistantMessage.sources }
              );
              setCurrentConversationId(newConversationId);
              if (process.env.NODE_ENV === 'development') {
                console.log(`[Firebase] Successfully created new conversation: ${newConversationId}`);
              }
              
              // 会話一覧を更新
              try {
                const updatedConversations = await getConversations(user.uid);
                setConversations(updatedConversations);
              } catch (error) {
                console.error("Failed to refresh conversations:", error);
              }
            }
          } catch (error) {
            console.error('[Firebase] Failed to save messages:', error);
            // エラーが発生してもUIの動作は継続
          }

          // ストリーミング完了をマーク
          setIsStreamingComplete(true);
          
          // ストリーミング状態をリセット
          setTimeout(() => {
            setIsStreaming(false);
            setCurrentStep(null);
            setStreamingAnswer('');
            setStreamingReferences([]);
          }, 1000);
        },
        // エラーコールバック
        (error: string) => {
          console.error('ストリーミングエラー:', error);
          setStreamingError(error);
          setIsStreamingComplete(false);
          setIsStreaming(false);
          setCurrentStep(null);
          
          // エラーメッセージを表示
          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `エラーが発生しました: ${error}`,
            createdAt: new Date().toISOString(),
            sources: []
          };
          
          setMessages((prev: Message[]) => [...prev, errorMessage]);
        },
        // postLogId更新コールバック（エラーコールバックの後）
        (postLogId: string) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 [DEBUG] postLogId更新を受信:', postLogId);
          }
          setCurrentPostLogId(postLogId);
          
          // 最後のアシスタントメッセージを更新
          setMessages((prev: Message[]) => {
            const updated = [...prev];
            // 最後から逆順に検索してアシスタントメッセージを見つける
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].role === 'assistant' && !updated[i].postLogId) {
                updated[i] = { ...updated[i], postLogId };
                if (process.env.NODE_ENV === 'development') {
                  console.log('🔍 [DEBUG] メッセージを更新:', updated[i].id, 'postLogId:', postLogId);
                }
                break;
              }
            }
            return updated;
          });
        },
        // オプションパラメータ
        messages,
        labelFilters,
        user?.uid, // ユーザーID
        currentSessionId, // セッションID
        clientStartTime // クライアント側の開始時刻
      );

    } catch (error) {
      console.error('Error starting streaming:', error);
      setStreamingError(error instanceof Error ? error.message : 'Unknown error');
      setIsStreamingComplete(false);
      setIsStreaming(false);
      setCurrentStep(null);
      
      const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: "Sorry, something went wrong. Please try again.",
          createdAt: new Date().toISOString()
      };
      setMessages((prev: Message[]) => [...prev, errorMessage]);
      
      if (!handleNetworkError(error)) {
        showApiErrorToast(error);
      }
    } finally {
      // ストリーミング状態はコールバック内で管理されるため、ここでは何もしない
      // 処理完了後にテキストエリアにフォーカスを当てる
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
    }
  };

  return (
    <div className="flex h-screen">
      {/* サイドバー - デスクトップ: 常に表示、モバイル: 切り替え可能 */}
      <div className={`w-72 bg-gray-50 border-r overflow-hidden flex flex-col transition-transform duration-200 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 fixed md:static inset-y-0 left-0 z-40`}>
        <div className="p-4 border-b">
          <Button className="w-full" onClick={async () => {
            // 新しい会話を開始
            setMessages([]);
            setCurrentConversationId(null);
            
            // モバイルでサイドバーを閉じる
            if (window.innerWidth < 768) {
              setIsSidebarOpen(false);
            }
            
            // 会話一覧を更新
            try {
              const updatedConversations = await getConversations(user.uid);
              setConversations(updatedConversations);
            } catch (error) {
              console.error("Failed to refresh conversations:", error);
            }
          }}>
            <Plus className="mr-2 h-4 w-4" />
            新しいチャット
          </Button>
        </div>
        <ScrollArea className="flex-1 h-0">
          <div className="p-4 space-y-2 pb-4">

            {/* 通常の会話履歴 */}
            {conversations.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">会話履歴がありません</p>
            ) : (
              conversations.map((conv: { id: string; title: string; lastMessage: string; timestamp: string }) => (
                <div
                  key={conv.id}
                  className={`w-full cursor-pointer rounded-md p-3 transition-colors ${
                    currentConversationId === conv.id 
                      ? "bg-secondary" 
                      : "hover:bg-gray-100"
                  }`}
                  onClick={async () => {
                    // 会話を読み込む処理
                    setCurrentConversationId(conv.id);
                    setIsLoadingHistory(true);
                    
                    // モバイルでサイドバーを閉じる
                    if (window.innerWidth < 768) {
                      setIsSidebarOpen(false);
                    }
                    
                    try {
                      // 選択された会話のメッセージを取得
                      const conversation = await getConversation(user.uid, conv.id);
                      setMessages(conversation.messages);
                    } catch (error) {
                      console.error(`Failed to load conversation ${conv.id}:`, error);
                      if (!handleNetworkError(error)) {
                        showErrorToast('conversation_load_error', '会話の読み込みに失敗しました。');
                      }
                    } finally {
                      setIsLoadingHistory(false);
                    }
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 overflow-hidden text-left min-w-0">
                      <p className="font-medium text-sm leading-tight" style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {(() => {
                          const plainTitle = stripMarkdown(conv.title);
                          return plainTitle.length > 12 ? `${plainTitle.substring(0, 12)}...` : plainTitle;
                        })()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 leading-tight" style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {(() => {
                          const plainText = stripMarkdown(conv.lastMessage);
                          return plainText.length > 14 ? `${plainText.substring(0, 14)}...` : plainText;
                        })()}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-xs text-gray-400 ml-2">
                      {(() => {
                        const date = new Date(conv.timestamp);
                        const now = new Date();
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                        
                        if (messageDate.getTime() === today.getTime()) {
                          // 当日の場合は時刻を表示
                          return date.toLocaleTimeString('ja-JP', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: false 
                          });
                        } else {
                          // 前日以上の場合は日付を表示
                          return date.toLocaleDateString('ja-JP', { 
                            month: 'numeric', 
                            day: 'numeric' 
                          });
                        }
                      })()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* オーバーレイ（モバイルでサイドバーが開いているとき） */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-white/80 backdrop-blur-sm px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            {/* ハンバーガーメニュー（モバイルのみ） */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Bot className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold">
              {showAdminDashboard ? '管理ダッシュボード' : 'Confluence Spec Chat'}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* 管理者ダッシュボードトグルボタン */}
            {!isAdminLoading && isAdmin && (
              <Button
                variant={showAdminDashboard ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAdminDashboard(!showAdminDashboard)}
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                {showAdminDashboard ? 'チャットに戻る' : '管理画面'}
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? 'User'} />
                    <AvatarFallback>{user.displayName?.charAt(0) ?? 'U'}</AvatarFallback>
                  </Avatar>
                  {!isAdminLoading && isAdmin && (
                    <div className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full flex items-center justify-center">
                      <Shield className="h-2 w-2 text-white" />
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="p-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    {user.displayName}
                    {!isAdminLoading && isAdmin && <Shield className="h-3 w-3 text-blue-500" />}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  {!isAdminLoading && isAdmin && (
                    <p className="text-xs text-blue-600 font-medium">管理者</p>
                  )}
                </div>
                <DropdownMenuItem onClick={() => setShowSettings(!showSettings)}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>設定</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>ログアウト</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" viewportRef={scrollAreaRef}>
          <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
            {showAdminDashboard ? (
              <AdminDashboard />
            ) : showSettings ? (
                <div className="max-w-xl mx-auto space-y-6 py-6">
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>設定</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* <MigrationButton 
                                user={user} 
                                onComplete={() => {
                                    // 移行完了後に会話一覧を更新
                                    const refreshConversations = async () => {
                                        try {
                                            const userConversations = await getConversations(user.uid);
                                            setConversations(userConversations);
                                            console.log('[refreshConversations] Successfully refreshed conversations');
                                        } catch (error) {
                                            console.error("Failed to refresh conversations:", error);
                                        }
                                    };
                                    refreshConversations();
                                }}
                            /> */}
                            <div className="text-sm text-muted-foreground">
                                移行機能は一時的に無効化されています
                            </div>
                            <div className="mt-4">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowSettings(false)}
                                    className="w-full"
                                >
                                    戻る
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : isLoadingHistory ? (
                <div className="space-y-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-4 max-w-full">
                      <div className="h-8 w-8 border shrink-0 bg-gray-200 animate-pulse rounded-full" />
                      <div className="flex-1 bg-gray-100 animate-pulse rounded-lg h-20" />
                    </div>
                  ))}
                </div>
            ) : messages.length > 0 ? (
                <div className="space-y-6">
                  {messages.map((msg: Message, index: number) => {
                    const isLastMessage = index === messages.length - 1;
                    const isAssistantMessage = msg.role === 'assistant';
                    // メッセージのpostLogIdで判定（currentPostLogIdは後方互換性のため保持）
                    const shouldShowFeedback = isLastMessage && isAssistantMessage && (msg.postLogId || currentPostLogId);
                    const postLogIdForFeedback = msg.postLogId || currentPostLogId;
                    
                    return (
                      <div key={`message-${msg.id || index}`}>
                        <MessageCard msg={msg} />
                        {/* 最後のアシスタントメッセージの後に評価フィードバックを表示 */}
                        {shouldShowFeedback && postLogIdForFeedback && (
                          <div className="ml-12 mt-4">
                            <FeedbackRating 
                              postLogId={postLogIdForFeedback}
                              userId={user?.uid}
                              sessionId={currentSessionId}
                              onSubmitted={(rating, comment) => {
                                if (process.env.NODE_ENV === 'development') {
                                  console.log('評価が送信されました:', { rating, comment });
                                }
                              }}
                            />
                          </div>
                        )}
                        {/* デバッグ用 */}
                        {process.env.NODE_ENV === 'development' && isLastMessage && isAssistantMessage && (
                          <div className="ml-12 mt-2 text-xs text-gray-500">
                            Debug: msg.postLogId={msg.postLogId || 'null'}, currentPostLogId={currentPostLogId || 'null'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
            ) : (
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="max-w-md mx-auto text-center">
                        <h1 className="text-2xl font-bold mb-4">ようこそ！Confluence Spec Chatへ</h1>
                        <p className="text-muted-foreground">このチャットボットは、Confluenceの仕様書に関する質問に回答します。</p>
                        <div className="mt-4 space-y-2">
                          <p className="text-xs text-muted-foreground">例えば、次のような質問ができます：</p>
                          <div className="text-sm space-y-1">
                            <p>• 「ログイン認証の仕組みはどうなっていますか？」</p>
                            <p>• 「求人詳細画面の仕様について教えてください」</p>
                            <p>• 「プロジェクトXの要件定義書を要約して」</p>
                          </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ストリーミング処理中の表示 */}
            {isStreaming && (
              <div className="space-y-6">
                <StreamingProcessingUI 
                  currentStep={currentStep} 
                  isVisible={isStreaming} 
                />
                {streamingError && (
                  <StreamingErrorUI 
                    error={streamingError} 
                    isVisible={true} 
                  />
                )}
                {streamingAnswer && (
                  <div className="flex items-start gap-4 max-w-full">
                    <div className="h-8 w-8 border shrink-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex flex-col gap-2 items-start max-w-[85%] sm:max-w-[75%]">
                      <Card className="bg-white w-full min-w-[200px]">
                        <CardContent className="p-4 text-sm break-words">
                          <div className="flex items-center">
                            <div>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={sharedMarkdownComponents as any}
                            >
                              {(() => {
                                let safeAnswer = '';
                                if (typeof streamingAnswer === 'string') {
                                  safeAnswer = streamingAnswer;
                                } else if (streamingAnswer !== null && streamingAnswer !== undefined) {
                                  safeAnswer = String(streamingAnswer);
                                }
                                
                                if (safeAnswer.includes('[object Object]')) {
                                  safeAnswer = '回答の生成中にエラーが発生しました。';
                                }
                                
                                return normalizeMarkdownSymbols(fixMarkdownTables(safeAnswer));
                              })()}
                              </ReactMarkdown>
                            </div>
                            <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
      <footer className="border-t p-4 bg-white/80 backdrop-blur-sm">
        {!showSettings && (
          <div className="mx-auto max-w-3xl">
            {/* ラベルフィルタ */}
            <div className="flex gap-4 mb-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={labelFilters.includeMeetingNotes}
                  onCheckedChange={(checked) => 
                    setLabelFilters(prev => ({ ...prev, includeMeetingNotes: !!checked }))
                  }
                />
                <span>議事録を含める</span>
              </label>
            </div>
            
            <form onSubmit={handleSubmit} className="flex items-start gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                placeholder="Confluenceドキュメントについて質問..."
                className="flex-1 resize-none bg-white"
                rows={1}
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                disabled={isLoading || isStreaming}
              />
              <Button 
                type="submit" 
                disabled={isLoading || isStreaming || !input.trim()} 
                size="icon" 
                className={`${isLoading || isStreaming ? 'bg-muted' : 'bg-accent hover:bg-accent/90'}`}
              >
                {isLoading || isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        )}
      </footer>
      </div>
    </div>
  );
}
