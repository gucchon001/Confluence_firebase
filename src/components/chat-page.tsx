'use client';

import type { User } from 'firebase/auth';
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Bot, Send, User as UserIcon, LogOut, Loader2, FileText, Link as LinkIcon, AlertCircle, Plus, MessageSquare, Menu, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuthWrapper } from '@/hooks/use-auth-wrapper';
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
            <CardContent className="p-4 text-sm whitespace-pre-wrap break-words">
                <p>{msg.content}</p>
            </CardContent>
            {isAssistant && msg.sources && msg.sources.length > 0 && (
                <CardFooter className="flex flex-col items-start gap-2 border-t p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        参照元
                    </h4>
                    <div className="flex flex-col gap-2 w-full">
                        {msg.sources.map((source: any, index) => (
                        <a
                            key={index}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 w-full"
                        >
                            <LinkIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{source.title}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                                ({source.distance !== undefined && source.distance !== null
                                  ? Math.max(0, Math.min(100, Math.round((1 - source.distance) * 100)))
                                  : '??'}% 一致)
                            </span>
                            <span className="text-xs ml-1 font-bold" style={{color: 'blue'}}>
                                {source.source === 'keyword' ? '⌨️' : '🔍'}
                            </span>
                        </a>
                        ))}
                    </div>
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

const SkeletonMessage = () => (
    <div className="flex items-start gap-4 max-w-full">
      <Avatar className="h-8 w-8 border shrink-0">
        <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2 items-start max-w-[85%] sm:max-w-[75%]">
        <Card className="bg-white w-full min-w-[200px]">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse"></div>
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse delay-75"></div>
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-pulse delay-150"></div>
                </div>
                <div className="h-2 w-24 bg-muted-foreground/20 rounded animate-pulse"></div>
                <div className="h-2 w-32 bg-muted-foreground/20 rounded animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

export default function ChatPage({ user }: ChatPageProps) {
  const { signOut } = useAuthWrapper();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; lastMessage: string; timestamp: string }>>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  // ラベルフィルタの状態
  const [labelFilters, setLabelFilters] = useState({
    includeMeetingNotes: false,
    includeArchived: false
  });
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        // 既存の会話一覧を取得
        const userConversations = await getConversations(user.uid);
        setConversations(userConversations);
        console.log('[fetchConversations] Successfully loaded conversations');
        
        // 会話が存在する場合は最新の会話を選択
        if (userConversations.length > 0) {
          setCurrentConversationId(userConversations[0].id);
          
          // 選択された会話のメッセージを取得
          const conversation = await getConversation(user.uid, userConversations[0].id);
          setMessages(conversation.messages);
          console.log(`[fetchConversations] Loaded messages for conversation: ${userConversations[0].id}`);
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
          console.log('[fetchHistory] Successfully loaded chat history using legacy method');
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
    if (!input.trim() || isLoading) return;

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
    setIsLoading(true);

    // 非同期処理を実行
    try {
      const res = await askQuestion(currentInput, messages, labelFilters);
      console.log('[handleSubmit] Response from askQuestion:', JSON.stringify(res, null, 2));
      
      // デバッグ用：ブラウザのコンソールにもログを出力
      console.log('DEBUG - askQuestion response:', res);
      
      // レスポンスの参照元をログ出力
      if (res.references && res.references.length > 0) {
        console.log('[handleSubmit] References from response:');
        res.references.forEach((ref: any, idx: number) => {
          console.log(`[handleSubmit] Reference ${idx+1}: title=${ref.title}, source=${ref.source}`);
        });
      }
      
      // デバッグ用：参照元の詳細をログに出力
      console.log('[handleSubmit] Mapping references to sources:');
      const mappedSources = res.references.map((ref: any) => {
        const source = {
          title: ref.title || 'No Title',
          url: ref.url || '#',
          distance: ref.distance,
          source: ref.source
        };
        console.log(`[handleSubmit] Mapped source: ${JSON.stringify(source)}`);
        return source;
      });
      
      const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: res.answer,
          sources: mappedSources,
          createdAt: new Date().toISOString()
      };
      setMessages((prev: Message[]) => [...prev, assistantMessage]);
      
      // Firestoreに会話履歴を保存
      if (currentConversationId) {
        // 既存の会話に追加
        await addMessageToConversation(user.uid, currentConversationId, 
          { role: 'user', content: userMessage.content, user: userMessage.user }
        );
        await addMessageToConversation(user.uid, currentConversationId, 
          { role: 'assistant', content: assistantMessage.content, sources: assistantMessage.sources }
        );
        console.log(`[handleSubmit] Added messages to existing conversation: ${currentConversationId}`);
      } else {
        // 新しい会話を作成
        try {
          // まずユーザーメッセージで会話を作成
          const newConversationId = await createConversation(user.uid, 
            { role: 'user', content: userMessage.content, user: userMessage.user }
          );
          
          // AIの応答を追加
          await addMessageToConversation(user.uid, newConversationId, 
            { role: 'assistant', content: assistantMessage.content, sources: assistantMessage.sources }
          );
          
          // 現在の会話IDを更新
          setCurrentConversationId(newConversationId);
          
          // 会話一覧を更新
          const updatedConversations = await getConversations(user.uid);
          setConversations(updatedConversations);
          
          console.log(`[handleSubmit] Created new conversation: ${newConversationId}`);
        } catch (error) {
          console.error("Failed to create new conversation:", error);
          
          // 従来の方法でメッセージを保存（フォールバック）
          await addMessageBatch(user.uid, [
            { role: 'user', content: userMessage.content, user: userMessage.user },
            { role: 'assistant', content: assistantMessage.content, sources: assistantMessage.sources }
          ]);
          console.log('[handleSubmit] Saved messages using legacy method');
        }
      }

    } catch (error) {
      console.error('Failed to get answer:', error);
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
      setIsLoading(false);
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
      {/* サイドバー */}
      <div className={`${isSidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 bg-gray-50 border-r overflow-hidden flex flex-col`}>
        <div className="p-4 border-b">
          <Button className="w-full" onClick={async () => {
            // 新しい会話を開始
            setMessages([]);
            setCurrentConversationId(null);
            
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
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {conversations.length === 0 ? (
              <p className="text-sm text-gray-500 text-center">会話履歴がありません</p>
            ) : (
              conversations.map((conv: { id: string; title: string; lastMessage: string; timestamp: string }) => (
                <Button
                  key={conv.id}
                  variant={currentConversationId === conv.id ? "secondary" : "ghost"}
                  className="w-full justify-start text-left"
                  onClick={async () => {
                    // 会話を読み込む処理
                    setCurrentConversationId(conv.id);
                    setIsLoadingHistory(true);
                    
                    try {
                      // 選択された会話のメッセージを取得
                      const conversation = await getConversation(user.uid, conv.id);
                      setMessages(conversation.messages);
                      console.log(`[loadConversation] Loaded messages for conversation: ${conv.id}`);
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
                  <div className="flex-1 overflow-hidden">
                    <p className="font-medium truncate">{conv.title.length > 20 ? `${conv.title.substring(0, 20)}...` : conv.title}</p>
                    <p className="text-xs text-gray-500 truncate">{conv.lastMessage.length > 25 ? `${conv.lastMessage.substring(0, 25)}...` : conv.lastMessage}</p>
                  </div>
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-white/80 backdrop-blur-sm px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Bot className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold">Confluence Spec Chat</h1>
          </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? 'User'} />
                <AvatarFallback>{user.displayName?.charAt(0) ?? 'U'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <div className="p-2">
              <p className="text-sm font-medium">{user.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
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
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" viewportRef={scrollAreaRef}>
          <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
            {showSettings ? (
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
                  {Array.from({ length: 3 }).map((_, i) => <SkeletonMessage key={i} />)}
                </div>
            ) : messages.length > 0 ? (
                <div className="space-y-6">
                  {messages.map((msg: Message, index: number) => (
                    <div key={`message-${msg.id || index}`}>
                      <MessageCard msg={msg} />
                    </div>
                  ))}
                </div>
            ) : (
                <div className="space-y-6">
                    <Card className="max-w-xl mx-auto text-center">
                        <CardHeader>
                            <CardTitle>ようこそ！Confluence Spec Chatへ</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">このチャットボットは、Confluenceの仕様書に関する質問に回答します。</p>
                            <div className="mt-4 space-y-2">
                              <p className="text-xs text-muted-foreground">例えば、次のような質問ができます：</p>
                              <div className="text-sm space-y-1">
                                <p>• 「ログイン認証の仕組みはどうなっていますか？」</p>
                                <p>• 「求人詳細画面の仕様について教えてください」</p>
                                <p>• 「プロジェクトXの要件定義書を要約して」</p>
                              </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="max-w-xl mx-auto">
                        <CardHeader>
                            <CardTitle>使い方</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h3 className="font-semibold mb-1">① 質問を入力</h3>
                                <p className="text-sm text-muted-foreground">下の入力欄に質問を入力して送信します。</p>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">② 回答を確認</h3>
                                <p className="text-sm text-muted-foreground">チャットボットが関連する仕様書に基づいて回答します。</p>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">③ 会話を続ける</h3>
                                <p className="text-sm text-muted-foreground">追加質問や詳細の確認もできます。コンテキストを維持します。</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            {isLoading && <SkeletonMessage />}
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
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={labelFilters.includeArchived}
                  onCheckedChange={(checked) => 
                    setLabelFilters(prev => ({ ...prev, includeArchived: !!checked }))
                  }
                />
                <span>アーカイブを含める</span>
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
                disabled={isLoading}
              />
              <Button 
                type="submit" 
                disabled={isLoading || !input.trim()} 
                size="icon" 
                className={`${isLoading ? 'bg-muted' : 'bg-accent hover:bg-accent/90'}`}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        )}
      </footer>
      </div>
    </div>
  );
}

    