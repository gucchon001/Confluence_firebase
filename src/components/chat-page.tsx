'use client';

import type { User } from 'firebase/auth';
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Bot, Send, User as UserIcon, LogOut, Loader2, FileText, Link as LinkIcon, AlertCircle, Plus, MessageSquare, Settings, ChevronDown, Clock, Search, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
import { EmptyStateHandler, NoResultsFound, ErrorState } from '@/components/empty-state-handler';
import { TimeoutHandler, useSearchTimeout } from '@/components/timeout-handler';
import { StreamingProcessingUI, StreamingErrorUI } from '@/components/streaming-processing-ui';
import { streamingProcessClient, ProcessingStep } from '@/lib/streaming-process-client';
// import MigrationButton from '@/components/migration-button';

// --- Markdown utilities ------------------------------------------------------
/**
 * Try to normalize malformed markdown tables produced by LLM so that remark-gfm
 * can render them. Heuristics:
 * - Ensure table header lines start with a single '|'
 * - Collapse multiple leading pipes (e.g. "|| 項目 |...")
 * - Insert separator line like "|:---|:---|" if missing after header
 * - Ensure each table row starts/ends with a pipe and is on its own line
 */
function fixMarkdownTables(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const fixed: string[] = [];
  let inTable = false;
  let pendingHeaderColumns: number | null = null;
  let currentColumns: number | null = null; // 現在のテーブル列数を保持

  const isSeparatorLine = (s: string) => /^\s*\|?\s*(:?-{3,}\s*\|\s*)+(:?-{3,}\s*)?\|?\s*$/.test(s);
  const normalizeRow = (s: string) => {
    let row = s.trim();
    // collapse multiple leading pipes
    row = row.replace(/^\|{2,}/, '|');
    // add leading pipe
    if (!row.startsWith('|')) row = '|' + row;
    // ensure single spaces around pipes for readability
    row = row.replace(/\s*\|\s*/g, ' | ');
    // add trailing pipe
    if (!row.endsWith('|')) row = row + ' |';
    return row;
  };

  for (let i = 0; i < lines.length; i++) {
    const original = lines[i];
    const trimmed = original.trim();

    const looksLikeRow = trimmed.includes('|') && (trimmed.match(/\|/g)?.length || 0) >= 2 && !trimmed.startsWith('```') && !trimmed.startsWith('- ');
    
    // 複数のテーブル行が1行に連結されている場合を検出
    const multipleRowsPattern = /(\|[^|]*\|)\s*(\|[^|]*\|)/;
    if (looksLikeRow && multipleRowsPattern.test(trimmed)) {
      // 複数の行を分割
      const rows = trimmed.split(/(?<=\|)\s*(?=\|)/).filter(row => row.trim());
      for (const row of rows) {
        const normalized = normalizeRow(row.trim());
        if (!inTable) {
          if (fixed.length > 0 && fixed[fixed.length - 1].trim() !== '') fixed.push('');
          inTable = true;
          pendingHeaderColumns = normalized.split('|').filter(c => c.trim().length > 0).length - 1;
          currentColumns = pendingHeaderColumns;
        }
        fixed.push(normalized);
      }
      continue;
    }

    if (looksLikeRow) {
      const normalized = normalizeRow(trimmed);
      if (!inTable) {
        // Ensure blank line before table for GFM
        if (fixed.length > 0 && fixed[fixed.length - 1].trim() !== '') fixed.push('');
        inTable = true;
        // compute column count from header
        pendingHeaderColumns = normalized.split('|').filter(c => c.trim().length > 0).length - 1; // exclude leading/trailing
        currentColumns = pendingHeaderColumns;
      }
      // 行を列数で分割して複数行に展開（1行に複数レコードが連結されている場合の対策）
      const cells = normalized
        .slice(1, normalized.length - 1) // 先頭/末尾のパイプを除去
        .split('|')
        .map(c => c.trim())
        .filter(c => !(c === '' && currentColumns !== null));

      if (currentColumns && cells.length > currentColumns) {
        for (let off = 0; off < cells.length; off += currentColumns) {
          const rowCells = cells.slice(off, off + currentColumns);
          if (rowCells.length === currentColumns) {
            fixed.push('| ' + rowCells.join(' | ') + ' |');
          }
        }
      } else {
        fixed.push(normalized);
      }

      // If it's the first line of the table (header) and next line isn't a separator, insert one
      const next = lines[i + 1]?.trim() ?? '';
      if (pendingHeaderColumns && !isSeparatorLine(next)) {
        const sepCells = Array(pendingHeaderColumns).fill(':---');
        fixed.push('| ' + sepCells.join(' | ') + ' |');
        pendingHeaderColumns = null;
        currentColumns = currentColumns || sepCells.length;
      } else if (isSeparatorLine(next)) {
        // We will let the next loop push the existing separator
        pendingHeaderColumns = null;
        currentColumns = currentColumns || (next.split('|').filter(c => c.includes('-')).length);
      }
      continue;
    }

    // If we encounter a separator that LLM emitted, pass it through normalized
    if (isSeparatorLine(trimmed)) {
      inTable = true;
      currentColumns = trimmed.split('|').filter(c => c.includes('-')).length;
      const normalized = '| ' + trimmed.replace(/\|/g, ' | ').replace(/\s+/g, ' ').trim() + ' |';
      fixed.push(normalized);
      continue;
    }

    if (inTable && trimmed === '') {
      // end of table block maintained
      fixed.push('');
      inTable = false;
      currentColumns = null;
      continue;
    }

    // Non-table content
    fixed.push(original);
    inTable = false;
    pendingHeaderColumns = null;
    currentColumns = null;
  }

  return fixed.join('\n');
}

// 全角記号などを半角Markdown記号に正規化し、連結したヘッダー/区切りを改行で分離
function normalizeMarkdownSymbols(markdown: string): string {
  if (!markdown) return markdown;
  let text = markdown
    // 全角→半角
    .replace(/｜/g, '|')       // U+FF5C FULLWIDTH VERTICAL LINE
    .replace(/：/g, ':')       // U+FF1A FULLWIDTH COLON
    .replace(/－/g, '-')       // U+FF0D FULLWIDTH HYPHEN-MINUS
    .replace(/〜/g, '~')
    .replace(/　/g, ' ');      // U+3000 IDEOGRAPHIC SPACE

  // ヘッダー行と区切り行が1行に連結されているケースを改行で分離
  // 例: "| 項目 | 説明 | 備考 | |:---|:---|:---|"
  text = text.replace(/(\|[^\n]*?\|)\s*(\|\s*:?-{3,}[^\n]*?\|)/g, '$1\n$2');
  
  // より複雑な連結パターンに対応（ヘッダー + セパレーター + データ行）
  // 例: "| 項目名 | 説明 | 備考 | |:---|:---|:---| | 教室情報 | | |"
  text = text.replace(/(\|[^\n]*?\|)\s*(\|\s*:?-{3,}[^\n]*?\|)\s*(\|[^\n]*?\|)/g, '$1\n$2\n$3');
  
  // 連続するパイプの間に改行を挿入（テーブル行の分離）
  // 例: "| 項目名 | 説明 | 備考 | | 教室情報 | | | | 基本情報 | ..."
  text = text.replace(/\|\s*\|\s*\|/g, ' |\n| ');

  // パイプの前後のスペースを統一
  text = text.replace(/\s*\|\s*/g, ' | ');
  
  // 見出しの前後の空行を正規化
  // 1. 通常の見出し（#記号から始まる）
  text = text.replace(/(\n|^)(#{1,6}\s+[^\n]+)(\n|$)/g, '\n\n$2\n\n');
  
  // 2. 絵文字見出し（#記号がない絵文字見出しに##を追加）
  text = text.replace(/(\n|^)([🔑👥🔗⚙️📊🎯💡🚀✅❌⚠️🔥⭐📄❓]+ [^\n]+)(\n|$)/g, (match, prefix, content, suffix) => {
    // 既に#記号がある場合は追加しない
    if (content.startsWith('#')) {
      return match;
    }
    return `\n\n## ${content}\n\n`;
  });
  
  // 3. 番号付きのセクション見出し（1. 2. 3. など）
  text = text.replace(/(\n|^)(\d+\.\s+[^:\n]+)(\n|$)/g, (match, prefix, content, suffix) => {
    // 既に#記号がある場合は追加しない
    if (content.startsWith('#')) {
      return match;
    }
    return `\n\n### ${content}\n\n`;
  });
  
  // 番号付きリストの正規化
  // 1. 段落内の番号付きリストパターンを改行で分離
  text = text.replace(/([^\d\n])(\d+\.\s+[^:\n]+:\s*)([^\n]+)/g, '$1\n$2\n  $3');
  
  // 2. 番号付きリスト項目の説明文を改行
  text = text.replace(/(\d+\.\s+[^:\n]+:\s*)([^\n]+)/g, '$1\n  $2');
  
  // 箇条書きの改行を正規化
  // 3. 段落内の箇条書きパターンを改行で分離
  text = text.replace(/([^-\n])(- [^:\n]+:\s*)([^\n]+)/g, '$1\n$2\n  $3');
  
  // 4. 連続する箇条書き（- 項目: - 説明）を分離
  text = text.replace(/(- [^:\n]+:\s*)(- [^\n]+)/g, '$1\n  $2');
  
  // 5. 太字の項目名の後の説明文を改行
  text = text.replace(/(\*\*[^*]+\*\*:\s*)([^\n]+)/g, '$1\n  $2');
  
  // 6. 通常の箇条書き項目の説明文を改行
  text = text.replace(/(- [^:\n]+:\s*)([^\n]+)/g, '$1\n  $2');
  
  // 連続する空行を2行までに制限
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text;
}

// 共通のMarkdownコンポーネント（保存済み表示/ストリーミングで共通化）
const sharedMarkdownComponents = {
  h1: ({children}: any) => <h1 className="text-lg font-bold mb-4 mt-4">{children}</h1>,
  h2: ({children}: any) => <h2 className="text-lg font-bold mb-4 mt-6 text-gray-800">{children}</h2>,
  h3: ({children}: any) => <h3 className="text-base font-bold mb-3 mt-4 text-gray-900">{children}</h3>,
  h4: ({children}: any) => <h4 className="text-sm font-semibold mb-1">{children}</h4>,
  p: ({children}: any) => <p className="mb-3 leading-relaxed">{children}</p>,
  ul: ({children}: any) => <ul className="list-disc list-outside mb-3 ml-4">{children}</ul>,
  ol: ({children}: any) => <ol className="list-decimal list-outside mb-3 ml-4">{children}</ol>,
  li: ({children}: any) => <li className="mb-1 leading-relaxed">{children}</li>,
  hr: ({children}: any) => <hr className="my-4 border-gray-300" />,
  strong: ({children}: any) => <strong className="font-bold">{children}</strong>,
  em: ({children}: any) => <em className="italic">{children}</em>,
  code: ({children}: any) => <code className="bg-gray-100 px-1 rounded text-xs font-mono">{children}</code>,
  pre: ({children}: any) => <pre className="bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto">{children}</pre>,
  table: ({children}: any) => <div className="overflow-x-auto"><table className="border-collapse border border-gray-300 w-full mb-4 min-w-max">{children}</table></div>,
  thead: ({children}: any) => <thead className="bg-gray-50">{children}</thead>,
  tbody: ({children}: any) => <tbody>{children}</tbody>,
  tr: ({children}: any) => <tr className="border-b border-gray-200">{children}</tr>,
  th: ({children}: any) => <th className="border border-gray-300 px-3 py-2 text-left font-semibold align-top break-words whitespace-pre-wrap bg-gray-50">{children}</th>,
  td: ({children}: any) => <td className="border border-gray-300 px-3 py-2 align-top break-words whitespace-pre-wrap">{children}</td>,
} as const;

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
                  {isAssistant ? fixMarkdownTables(normalizeMarkdownSymbols(msg.content)) : msg.content}
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
                                              if (source.distance !== undefined && source.distance !== null) {
                                                return Math.max(0, Math.min(100, Math.round((1 - source.distance) * 100)));
                                              }
                                              // フォールバック: ソースタイプに基づく推定値
                                              if (source.source === 'vector') return 85;
                                              if (source.source === 'bm25') return 75;
                                              if (source.source === 'keyword') return 90;
                                              return 80;
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

export default function ChatPage({ user }: ChatPageProps) {
  const { signOut } = useAuthWrapper();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; lastMessage: string; timestamp: string }>>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  // ストリーミング処理の状態
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStep, setCurrentStep] = useState<ProcessingStep | null>(null);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const [streamingAnswer, setStreamingAnswer] = useState<string>('');
  const [streamingReferences, setStreamingReferences] = useState<any[]>([]);

  // ストリーミング回答の安全な更新関数
  const updateStreamingAnswer = (newContent: any) => {
    let safeContent = '';
    
    if (typeof newContent === 'string') {
      safeContent = newContent;
    } else if (newContent !== null && newContent !== undefined) {
      safeContent = String(newContent);
    }
    
    // オブジェクトが混入していないかチェック
    if (safeContent && !safeContent.includes('[object Object]')) {
      setStreamingAnswer(prev => prev + safeContent);
    } else {
      console.warn('Invalid content detected, skipping:', newContent);
    }
  };

  // ストリーミング回答の安全な設定関数
  const setStreamingAnswerSafe = (content: any) => {
    let safeContent = '';
    
    if (typeof content === 'string') {
      safeContent = content;
    } else if (content !== null && content !== undefined) {
      safeContent = String(content);
    }
    
    // オブジェクトが混入していないかチェック
    if (safeContent && !safeContent.includes('[object Object]')) {
      setStreamingAnswer(safeContent);
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
    
    // ストリーミング処理の初期化
    setIsStreaming(true);
    setCurrentStep(null);
    setStreamingError(null);
    setStreamingAnswer('');
    setStreamingReferences([]);

    // ストリーミング処理を実行
    try {
      // ストリーミング処理を開始
      await streamingProcessClient.startStreaming(
        currentInput,
        messages,
        labelFilters,
        // ステップ更新コールバック
        (step: ProcessingStep) => {
          console.log('ステップ更新:', step);
          setCurrentStep(step);
        },
        // チャンク受信コールバック
        (chunk: string, chunkIndex: number) => {
          console.log(`チャンク受信 ${chunkIndex}:`, chunk);
          updateStreamingAnswer(chunk);
        },
        // 完了コールバック
        async (fullAnswer: string, references: any[]) => {
          console.log('ストリーミング完了:', fullAnswer);
          setStreamingAnswerSafe(fullAnswer);
          setStreamingReferences(references);
          
          // 最終的なメッセージを作成
      const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
            content: fullAnswer,
            createdAt: new Date().toISOString(),
            sources: references.map((ref: any) => ({
              title: ref.title || 'No Title',
              url: ref.url || '',
              distance: ref.distance !== undefined ? ref.distance : (ref.score !== undefined ? 1 - ref.score : 0.5),
              source: ref.source
            }))
          };

      setMessages((prev: Message[]) => [...prev, assistantMessage]);
      
          // 会話にメッセージを追加
          try {
            // デバッグ情報を出力
            console.log('[DEBUG] User info:', {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              emailVerified: user.emailVerified
            });
            
            if (currentConversationId) {
              // 既存の会話にメッセージを追加
              console.log(`[Firebase] Adding messages to existing conversation: ${currentConversationId}`);
              await addMessageToConversation(user.uid, currentConversationId, 
                { role: 'user', content: userMessage.content, user: userMessage.user }
              );
              await addMessageToConversation(user.uid, currentConversationId, 
                { role: 'assistant', content: assistantMessage.content, sources: assistantMessage.sources }
              );
              console.log(`[Firebase] Successfully saved messages to conversation: ${currentConversationId}`);
            } else {
              // 新しい会話を作成
              console.log(`[Firebase] Creating new conversation for user: ${user.uid}`);
              const newConversationId = await createConversation(user.uid, 
                { role: 'user', content: userMessage.content, user: userMessage.user }
              );
              await addMessageToConversation(user.uid, newConversationId, 
                { role: 'assistant', content: assistantMessage.content, sources: assistantMessage.sources }
              );
              setCurrentConversationId(newConversationId);
              console.log(`[Firebase] Successfully created new conversation: ${newConversationId}`);
          
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
        }
      );

    } catch (error) {
      console.error('Error starting streaming:', error);
      setStreamingError(error instanceof Error ? error.message : 'Unknown error');
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
      {/* サイドバー */}
      <div className="w-72 bg-gray-50 border-r overflow-hidden flex flex-col">
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
                  <div className="flex items-start gap-2">
                    <div className="flex-1 overflow-hidden text-left min-w-0">
                      <p className="font-medium text-sm leading-tight" style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {conv.title.length > 12 ? `${conv.title.substring(0, 12)}...` : conv.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 leading-tight" style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {conv.lastMessage.length > 14 ? `${conv.lastMessage.substring(0, 14)}...` : conv.lastMessage}
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

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-white/80 backdrop-blur-sm px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2">
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
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-4 max-w-full">
                      <div className="h-8 w-8 border shrink-0 bg-gray-200 animate-pulse rounded-full" />
                      <div className="flex-1 bg-gray-100 animate-pulse rounded-lg h-20" />
                    </div>
                  ))}
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
                                
                                return fixMarkdownTables(normalizeMarkdownSymbols(safeAnswer));
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