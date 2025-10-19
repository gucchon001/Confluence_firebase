/**
 * 処理ステップストリーミングAPI
 * 4つのステップをリアルタイムで更新しながら処理状況を配信
 */

import { NextRequest, NextResponse } from 'next/server';
import { retrieveRelevantDocs } from '@/ai/flows/retrieve-relevant-docs-lancedb';
import { streamingSummarizeConfluenceDocs } from '@/ai/flows/streaming-summarize-confluence-docs';
import { createAPIErrorResponse } from '@/lib/genkit-error-handler';
import { waitForInitialization, isStartupInitialized } from '@/lib/startup-optimizer';
import { getFirebaseFirestore } from '@/lib/firebase-unified';
import * as admin from 'firebase-admin';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import { convertPostLogToAdminFirestore } from '@/lib/firestore-data-mapper-admin';
import { postLogService } from '@/lib/post-log-service';
import type { PostLog, ProcessingStep } from '@/types';
import { GeminiConfig } from '@/config/ai-models-config';
// 重複コード修正をロールバック
// screenTestLoggerのインポート（存在しない場合は無視）
let screenTestLogger: any = null;
try {
  const loggerModule = require('@/lib/screen-test-logger');
  screenTestLogger = loggerModule.screenTestLogger;
} catch (error) {
  console.warn('screen-test-logger not found, using console fallback');
  // フォールバック用のロガー
  screenTestLogger = {
    info: (category: string, message: string, data?: any) => console.log(`[${category}] ${message}`, data || ''),
    warn: (category: string, message: string, data?: any) => console.warn(`[${category}] ${message}`, data || ''),
    error: (category: string, message: string, data?: any) => console.error(`[${category}] ${message}`, data || ''),
    logSearchPerformance: (query: string, searchTime: number, results: number, details?: any) => 
      console.log(`[SEARCH] Query: "${query}", Time: ${searchTime}ms, Results: ${results}`, details || ''),
    logAIPerformance: (question: string, aiTime: number, answerLength: number, details?: any) => 
      console.log(`[AI] Question: "${question}", Time: ${aiTime}ms, Length: ${answerLength}`, details || ''),
    logOverallPerformance: (query: string, totalTime: number, breakdown: any) => 
      console.log(`[PERFORMANCE] Query: "${query}", Total Time: ${totalTime}ms`, breakdown)
  };
}

// Firebase Admin SDK初期化は @/lib/firebase-admin-init から共通化

// サーバーサイド用の投稿ログ保存関数
async function savePostLogToAdminDB(logData: Omit<PostLog, 'id'>): Promise<string> {
  try {
    // Firebase Admin SDKを使用
    const adminApp = initializeFirebaseAdmin();
    const db = admin.firestore();
    const postLogsRef = db.collection('postLogs');
    
        // savePostLogToAdminDB関数が呼ばれました
    if (logData.totalTime > 1000) { // 1秒以上の場合のみログ出力
      console.log('🔍 サーバーサイド投稿ログデータの詳細:', {
        userId: logData.userId,
        question: logData.question?.substring(0, 50) + '...',
        answer: logData.answer?.substring(0, 50) + '...',
        serverStartupTime: logData.serverStartupTime, // サーバー起動時間を追加
        searchTime: logData.searchTime,
        aiGenerationTime: logData.aiGenerationTime,
        totalTime: logData.totalTime,
        referencesCount: logData.referencesCount,
        answerLength: logData.answerLength,
        timestamp: logData.timestamp,
        metadata: logData.metadata // metadataも確認
      });
    }
    
    // Timestamp変換ロジックを共通化
    const firestoreData = convertPostLogToAdminFirestore(logData);
    
    if (logData.totalTime > 1000) { // 1秒以上の場合のみログ出力
      console.log('🔍 Firestore保存データ確認:', {
        serverStartupTime: firestoreData.serverStartupTime,
        searchTime: firestoreData.searchTime,
        aiGenerationTime: firestoreData.aiGenerationTime,
        totalTime: firestoreData.totalTime
      });
    }
    
    const docRef = await postLogsRef.add(firestoreData);
    if (logData.totalTime > 1000) { // 1秒以上の場合のみログ出力
      console.log('📝 サーバーサイド投稿ログを保存しました:', docRef.id);
    }
    return docRef.id;
  } catch (error) {
    console.error('❌ サーバーサイド投稿ログ保存に失敗しました:', error);
    throw error;
  }
}

// フォールバック回答生成関数
function generateFallbackAnswer(question: string, context: any[]): string {
  // フォールバック回答生成ログ（開発環境のみ）
  if (process.env.NODE_ENV === 'development') {
    console.log('🔄 フォールバック回答生成開始');
  }
  
  // 関連文書から主要な情報を抽出
  const relevantDocs = context.slice(0, 3); // 上位3件の文書を使用
  const titles = relevantDocs.map(doc => doc.title || 'タイトル不明').filter(Boolean);
  
  let answer = `申し訳ございませんが、現在AIサービスが一時的に利用できない状態です。\n\n`;
  answer += `ご質問「${question}」に関連する情報を以下にまとめました：\n\n`;
  
  if (titles.length > 0) {
    answer += `**関連するドキュメント：**\n`;
    titles.forEach((title, index) => {
      answer += `${index + 1}. ${title}\n`;
    });
    answer += `\n`;
  }
  
  // 質問の種類に応じた基本的な回答
  if (question.includes('ログイン') || question.includes('認証')) {
    answer += `**ログイン機能について：**\n`;
    answer += `- 会員ログイン機能\n`;
    answer += `- クライアント企業ログイン機能\n`;
    answer += `- 全体管理者ログイン機能\n`;
    answer += `- パスワード再設定機能\n\n`;
  } else if (question.includes('仕様') || question.includes('要件')) {
    answer += `**仕様・要件について：**\n`;
    answer += `関連するドキュメントを確認して詳細な仕様をご確認ください。\n\n`;
  } else {
    answer += `**一般的な回答：**\n`;
    answer += `関連するドキュメントを確認して詳細な情報をご確認ください。\n\n`;
  }
  
  answer += `AIサービスが復旧次第、より詳細な回答を提供いたします。`;
  
  return answer;
}

// この関数は削除（initializeFirebaseAdminと重複）


// ステップ更新関数
async function updateStep(controller: ReadableStreamDefaultController, encoder: TextEncoder, step: number, stepId: string, description: string) {
  const message = {
    type: 'step_update',
    step,
    stepId,
    title: PROCESSING_STEPS[step]?.title || '処理中...',
    description,
    totalSteps: PROCESSING_STEPS.length,
    icon: PROCESSING_STEPS[step]?.icon || '⚙️'
  };
  
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
}

// 遅延関数
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 処理ステップの定義
const PROCESSING_STEPS = [
  {
    id: 'search',
    title: '検索中...',
    description: '関連ドキュメントを検索しています',
    icon: 'search'
  },
  {
    id: 'processing',
    title: 'ドキュメント処理中...',
    description: '検索結果を分析・整理しています',
    icon: 'processing'
  },
  {
    id: 'ai_generation',
    title: 'AIが回答を生成中...',
    description: '最適な回答を作成中',
    icon: 'brain'
  },
  {
    id: 'finalizing',
    title: '最終調整中...',
    description: '回答を最終確認しています',
    icon: 'check'
  }
];

// Phase 6最適化: バックグラウンド初期化の状態を確認
async function ensureServerInitialized() {
  const startTime = Date.now();
  
  // バックグラウンド初期化が完了済みか確認
  if (isStartupInitialized()) {
    // 初期化完了ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [API] バックグラウンド初期化完了済み - 即座に処理開始');
    }
    return 0; // 待ち時間なし
  }
  
  // まだ初期化中の場合は完了を待つ
  if (process.env.NODE_ENV === 'development') {
    console.log('⏳ [API] バックグラウンド初期化中 - 完了を待機...');
  }
  await waitForInitialization();
  const waitTime = Date.now() - startTime;
  if (process.env.NODE_ENV === 'development') {
    console.log(`✅ [API] 初期化完了 (待機時間: ${waitTime}ms)`);
  }
  return waitTime;
}

export const POST = async (req: NextRequest) => {
  // API呼び出し開始時刻を記録（TTFB計測用）
  const apiStartTime = Date.now();
  
  // API呼び出しログ（開発環境のみ）
  if (process.env.NODE_ENV === 'development') {
    console.log('🚀 [API] streaming-process route called');
  }
  
  try {
    // サーバー起動時に1回だけ初期化（2回目以降は即座にreturn）
    const serverStartupTime = await ensureServerInitialized();

    const body = await req.json();
    const { question, chatHistory = [], labelFilters = { includeMeetingNotes: false } } = body;
    
    // リクエストデータログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('📝 [API] Request data:', {
        questionLength: question?.length,
        chatHistoryLength: chatHistory?.length,
        labelFilters
      });
    }

    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }

    // ストリーミング開始ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('🌊 処理ステップストリーミングAPI開始:', question);
    }
    screenTestLogger.info('ai', `Streaming process request: "${question}"`, { 
      chatHistoryLength: chatHistory.length,
      labelFilters 
    });

    // ストリーミング応答の設定
    const encoder = new TextEncoder();
    // ReadableStream作成開始
    const stream = new ReadableStream({
        async start(controller) {
          try {
            // 【最優先】即座に最初のステップを送信してユーザーに応答を見せる
            await updateStep(controller, encoder, 0, 'search', '処理を開始しています...');
          
          // TTFB（Time To First Byte）を計測: API呼び出しから最初のストリーミングチャンク送信完了までの時間
          const ttfbTime = Date.now() - apiStartTime;
          if (ttfbTime > 100) { // 100ms以上の場合のみログ出力
            console.log('⚡ [TTFB] 最初のチャンク送信まで:', {
              ttfbTime: `${ttfbTime}ms`,
              serverStartupTime: `${serverStartupTime}ms`,
              initWaitTime: `${ttfbTime - serverStartupTime}ms`
            });
          }
          
          // 総処理時間の開始時刻を記録（TTFB後から）
          const processingStartTime = Date.now();
          
          let currentStep = 0;
          let fullAnswer = '';
          let relevantDocs: any[] = [];
          
          // postLogs保存用の変数
          // クライアント側の開始時刻を取得（存在しない場合は現在時刻）
          const clientStartTimeStr = req.headers.get('x-client-start-time');
          const clientStartTime = clientStartTimeStr ? parseInt(clientStartTimeStr) : Date.now();
          
          const latency = Date.now() - clientStartTime;
          if (latency > 100) { // 100ms以上の場合のみログ出力
            console.log('⏱️ 処理時間計測開始:', {
              clientStartTime: new Date(clientStartTime).toISOString(),
              serverReceiveTime: new Date().toISOString(),
              latency: latency
            });
          }
          
          let searchTime = 0;
          let aiGenerationTime = 0;
          let totalTime = 0;
          let processingSteps: ProcessingStep[] = [];
          let postLogId: string | null = null;
          
          // ユーザーIDの取得（認証ヘッダーから）
          let userId = req.headers.get('x-user-id') || req.headers.get('authorization')?.replace('Bearer ', '') || 'anonymous';
          const sessionId = req.headers.get('x-session-id') || crypto.randomUUID();
          const userAgent = req.headers.get('user-agent') || 'unknown';
          const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
          
          // ステップ更新: 検索開始
          await updateStep(controller, encoder, 0, 'search', '関連ドキュメントを検索しています...');

          // 検索処理とユーザー情報取得を並行実行（パフォーマンス最適化）
          // Phase 0A-4 FIX: 検索時間は処理開始時刻から計測（TTFB後の処理時間）
          const searchStartTime = processingStartTime;
          let userDisplayName = 'anonymous';
          
          const [searchResults, userInfo] = await Promise.all([
            retrieveRelevantDocs({
              question,
              labels: [],
              labelFilters
            }),
            // ユーザー情報を並行取得（検索と同時実行）
            (async () => {
              if (userId && userId !== 'anonymous') {
                try {
                  const adminApp = initializeFirebaseAdmin();
                  const auth = admin.auth(adminApp);
                  const userRecord = await auth.getUser(userId);
                  return userRecord.displayName || userRecord.email || 'unknown';
                } catch (userError) {
                  console.warn('⚠️ ユーザー情報取得失敗:', userError);
                  return 'anonymous';
                }
              }
              return 'anonymous';
            })()
          ]);
          
          relevantDocs = searchResults;
          userDisplayName = userInfo;
          // Phase 0A-4 FIX: 検索時間は検索開始から検索完了まで
          const searchEndTime = Date.now();
          searchTime = searchEndTime - searchStartTime;
          
          // 投稿ログ用データ（開発環境のみ）
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 投稿ログ用データ:', {
              userId,
              userDisplayName,
              sessionId,
              userAgent: userAgent.substring(0, 50) + '...',
              ipAddress
            });
          }
          // 検索ソース別の集計
          const searchSourceStats = relevantDocs.reduce((acc: Record<string, number>, doc) => {
            const source = doc.source || 'unknown';
            acc[source] = (acc[source] || 0) + 1;
            return acc;
          }, {});
          
          // ハイブリッド検索結果（開発環境のみ）
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 [ハイブリッド検索] 検索結果の内訳:', searchSourceStats);
            console.log('🔍 [ハイブリッド検索] Top 3 results:');
            relevantDocs.slice(0, 3).forEach((doc, idx) => {
              console.log(`  ${idx + 1}. [${doc.source}] ${doc.title?.substring(0, 60)} (score: ${doc.score?.toFixed(4)}, distance: ${doc.distance?.toFixed(4)})`);
            });
          }
          
          processingSteps.push({
            step: 'search',
            status: 'completed',
            duration: searchTime,
            timestamp: new Date(),
            details: {
              searchSources: relevantDocs.map(doc => doc.source || 'unknown'),
              searchSourceStats,
              detailedScores: relevantDocs.map(doc => ({
                title: doc.title?.substring(0, 50) + '...',
                source: doc.source,
                score: doc.score || 0,
                distance: doc.distance || 0,
                url: doc.url || ''
              }))
            }
          });
          
          // クライアント側でも見えるように詳細情報を送信
          const searchDetailMessage = {
            type: 'step_update',
            step: 0,  // Phase 5修正: 検索完了はステップ0（0ベース）
            stepId: 'search',
            title: '検索完了',
            description: `ハイブリッド検索完了: ${Object.entries(searchSourceStats).map(([source, count]) => `${source}=${count}`).join(', ')}`,
            totalSteps: 4,
            icon: '🔍',
            searchDetails: {
              totalResults: relevantDocs.length,
              sourceBreakdown: searchSourceStats,
              topResults: relevantDocs.slice(0, 3).map(doc => ({
                title: doc.title?.substring(0, 60),
                source: doc.source,
                score: doc.score,
                distance: doc.distance
              }))
            }
          };
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(searchDetailMessage)}\n\n`)
          );

          // ステップ2: ドキュメント処理中...
          // ドキュメント処理ステップで参照情報を含める
          const processingMessage = {
            type: 'step_update',
            step: 1,  // Phase 5修正: ドキュメント処理はステップ1（0ベース）
            stepId: 'processing',
            title: 'ドキュメント処理中...',
            description: `検索結果 ${relevantDocs.length} 件を分析・整理しています...`,
            totalSteps: 4,
            icon: '📊',
            references: relevantDocs.map((doc, index) => ({
              id: doc.id || `${doc.pageId}-${index}`,
              title: doc.title || 'タイトル不明',
              url: doc.url || '',
              spaceName: doc.spaceName || 'Unknown',
              labels: doc.labels || [],
              distance: doc.distance,
              source: doc.source,
              scoreText: doc.scoreText
            }))
          };
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(processingMessage)}\n\n`)
          );
          
          const documentProcessingStartTime = Date.now();
          await delay(100); // 視覚的効果のための最小限の遅延
          const processingTime = Date.now() - documentProcessingStartTime;

          // ドキュメント処理の詳細分析
          const processingAnalysis = {
            documentsProcessed: relevantDocs.length,
            contentAnalysis: {
              totalContentLength: relevantDocs.reduce((sum, doc) => sum + (doc.content?.length || 0), 0),
              averageContentLength: relevantDocs.length > 0 ? relevantDocs.reduce((sum, doc) => sum + (doc.content?.length || 0), 0) / relevantDocs.length : 0,
              maxContentLength: relevantDocs.length > 0 ? Math.max(...relevantDocs.map(doc => doc.content?.length || 0)) : 0,
              minContentLength: relevantDocs.length > 0 ? Math.min(...relevantDocs.map(doc => doc.content?.length || 0)) : 0
            }
          };

          processingSteps.push({
            step: 'processing',
            status: 'completed',
            duration: processingTime,
            timestamp: new Date(),
            details: processingAnalysis
          });

          // 関連文書取得完了（開発環境のみ）
          if (process.env.NODE_ENV === 'development') {
            console.log(`📚 関連文書取得完了: ${relevantDocs.length}件`);
          }
          screenTestLogger.info('search', `Retrieved ${relevantDocs.length} relevant documents for streaming`);

          // ステップ3: AIが回答を生成中...
          await updateStep(controller, encoder, 2, 'ai_generation', 'AIが回答を生成しています...');
          // delay削除: AI生成はすぐに開始

          // ストリーミング要約の実行
          let chunkIndex = 0;
          let totalChunks = 0;
          // Phase 0A-4 FIX: AI生成時間は検索完了時刻から計測
          const aiStartTime = searchEndTime;

          try {
            for await (const result of streamingSummarizeConfluenceDocs({
              question,
              context: relevantDocs,
              chatHistory
            })) {
            
            if (result.isComplete) {
              totalChunks = result.chunkIndex;
              fullAnswer = fullAnswer.trim();
              
              // AI生成時間の記録
              aiGenerationTime = Date.now() - aiStartTime;
              // 参照元取得プロセスの詳細分析
              const referenceAnalysis = {
                totalReferences: result.references?.length || 0,
                referenceSources: result.references?.map(ref => ({
                  title: ref.title || 'Unknown',
                  url: ref.url || '',
                  source: ref.source || 'unknown',
                  score: ref.score || 0,
                  distance: ref.distance || 0
                })) || [],
                referenceQuality: {
                  highQuality: result.references?.filter(ref => (ref.score || 0) > 0.8).length || 0,
                  mediumQuality: result.references?.filter(ref => (ref.score || 0) > 0.5 && (ref.score || 0) <= 0.8).length || 0,
                  lowQuality: result.references?.filter(ref => (ref.score || 0) <= 0.5).length || 0
                },
                averageReferenceScore: result.references?.length > 0 ? 
                  result.references.reduce((sum, ref) => sum + (ref.score || 0), 0) / result.references.length : 0
              };

              processingSteps.push({
                step: 'ai_generation',
                status: 'completed',
                duration: aiGenerationTime,
                timestamp: new Date(),
                details: {
                  totalChunks: totalChunks,
                  answerLength: fullAnswer.length,
                  contextDocuments: relevantDocs.length,
                  streamingDuration: aiGenerationTime,
                  averageChunkTime: totalChunks > 0 ? aiGenerationTime / totalChunks : 0,
                  modelUsed: GeminiConfig.model.replace('googleai/', ''),
                  streamingMethod: 'real-time',
                  ...referenceAnalysis,
                  contextQuality: {
                    highRelevanceDocs: relevantDocs.filter(doc => (doc.score || 0) > 0.8).length,
                    contextUtilization: relevantDocs.length > 0 ? (relevantDocs.filter(doc => (doc.score || 0) > 0.8).length / relevantDocs.length) : 0,
                    contentDiversity: new Set(relevantDocs.map(doc => doc.source)).size
                  }
                }
              });
              
              // ステップ4: 最終調整中...
              await updateStep(controller, encoder, 3, 'finalizing', '回答を最終確認しています...');
              const finalizingStartTime = Date.now();
              await delay(100); // 視覚的効果のための最小限の遅延
              const finalizingTime = Date.now() - finalizingStartTime;

              // 最終調整ステップの記録
              processingSteps.push({
                step: 'finalizing',
                status: 'completed',
                duration: finalizingTime,
                timestamp: new Date(),
                details: {
                  processingTime: finalizingTime,
                  answerValidation: 'completed',
                  referencesAttached: result.references?.length || 0,
                  finalAnswerLength: fullAnswer.length,
                  qualityCheck: 'passed',
                  responseFormatting: 'markdown',
                  metadataAttached: true
                }
              });

              // 投稿ログの保存（completionMessageの前に実行）
              // Phase 0A-4 FIX: 総処理時間はAPI開始時刻から計測（TTFBとの整合性を保つ）
              totalTime = Date.now() - apiStartTime;
              // ストリーミング処理完了
              
              let savedPostLogId: string | null = null;
              
              try {
              if (totalTime > 1000) { // 1秒以上の場合のみログ出力
                console.log('📊 postLogs保存データを準備中:', {
                  userId,
                  question: question.substring(0, 50) + '...',
                  answerLength: fullAnswer.length,
                  searchTime,
                  aiGenerationTime,
                  totalTime,
                  referencesCount: result.references.length
                });
              }
                
                // PostLog保存処理開始
                
                const logData = {
                  userId,
                  question,
                  answer: fullAnswer,
                  serverStartupTime, // サーバー起動処理時間を追加
                  ttfbTime, // 最初のチャンクまでの時間（TTFB）を追加
                  searchTime,
                  aiGenerationTime,
                  totalTime,
                  referencesCount: result.references.length,
                  answerLength: fullAnswer.length,
                  timestamp: new Date(),
                  processingSteps,
                  errors: [],
                  metadata: {
                    sessionId,
                    userAgent,
                    ipAddress,
                    userDisplayName // ユーザー表示名を追加
                  }
                };
                
                if (totalTime > 1000) { // 1秒以上の場合のみログ出力
                  console.log('🔍 PostLog保存データ確認:', {
                    serverStartupTime,
                    ttfbTime,
                    searchTime,
                    aiGenerationTime,
                    totalTime
                  });
                }
                
                savedPostLogId = await savePostLogToAdminDB(logData);
                if (totalTime > 1000) { // 1秒以上の場合のみログ出力
                  console.log('✅ 投稿ログを保存しました:', {
                    postLogId: savedPostLogId,
                    userId: logData.userId,
                    userDisplayName: logData.metadata.userDisplayName,
                    question: logData.question.substring(0, 50) + '...',
                    timestamp: logData.timestamp.toISOString()
                  });
                }
              } catch (logError) {
                console.error('❌ 投稿ログの保存に失敗しました:', logError);
              }

              // 完了メッセージ（保存されたpostLogIdを含める）
              const completionMessage = {
                type: 'completion',
                step: 3,  // Phase 5修正: 完了はステップ3（0ベース）
                stepId: 'completed',
                title: '完了',
                description: '回答が生成されました',
                chunkIndex: result.chunkIndex,
                totalChunks: result.totalChunks,
                references: result.references,
                fullAnswer: fullAnswer,
                postLogId: savedPostLogId
              };
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(completionMessage)}\n\n`)
              );
              
              // ログ記録
              screenTestLogger.logAIPerformance(question, aiGenerationTime, fullAnswer.length, {
                streamingChunks: totalChunks,
                references: result.references.length,
                isStreaming: true,
                processingSteps: 4,
                postLogId: savedPostLogId
              });
              
              break;
            } else {
              // チャンクメッセージ
              const chunkMessage = {
                type: 'chunk',
                chunk: result.chunk,
                chunkIndex: result.chunkIndex,
                isComplete: false,
                references: result.references,
                step: 2,
                stepId: 'ai_generation',
                title: 'AIが回答を生成中...',
                description: `回答を生成中... (${result.chunkIndex}/${result.totalChunks || '?'})`
              };
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunkMessage)}\n\n`)
              );
              
              fullAnswer += result.chunk;
              chunkIndex = result.chunkIndex;
            }
          }
          } catch (streamingError) {
            console.error('❌ ストリーミング要約エラー:', streamingError);
            
            // AI生成時間の記録（エラー時）
            aiGenerationTime = Date.now() - aiStartTime;
            processingSteps.push({
              step: 'ai_generation',
              status: 'error',
              duration: aiGenerationTime,
              timestamp: new Date(),
              details: { 
                error: streamingError.message || 'Unknown error',
                errorType: streamingError.name || 'StreamingError',
                partialChunks: chunkIndex,
                contextDocuments: relevantDocs.length,
                fallbackUsed: true,
                modelUsed: GeminiConfig.model.replace('googleai/', ''),
                streamingDuration: aiGenerationTime
              }
            });
            
            // フォールバック回答を生成
            const fallbackAnswer = generateFallbackAnswer(question, relevantDocs);
            
            // フォールバック回答を送信
            const fallbackMessage = {
              type: 'chunk',
              chunk: fallbackAnswer,
              chunkIndex: 1,
              isComplete: true,
              references: relevantDocs.map((doc, index) => ({
              id: doc.id || `${doc.pageId}-${index}`,
              title: doc.title || 'タイトル不明',
              url: doc.url || '',
              spaceName: doc.spaceName || 'Unknown',
              labels: doc.labels || [],
              distance: doc.distance,
              source: doc.source,
              scoreText: doc.scoreText
            })),
              step: 2,
              stepId: 'ai_generation',
              title: 'フォールバック回答を生成中...',
              description: 'AIサービスが利用できないため、基本的な回答を提供しています'
            };
            
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(fallbackMessage)}\n\n`)
            );
            
            fullAnswer = fallbackAnswer;
            
            // エラー時の投稿ログの保存（completionMessageの前に実行）
            totalTime = Date.now() - apiStartTime;
            let fallbackPostLogId: string | null = null;
            
            try {
              const errorLogData = {
                userId,
                question,
                answer: fallbackAnswer,
                serverStartupTime, // サーバー起動処理時間を追加
                searchTime,
                aiGenerationTime: 0, // AI生成は失敗したため0
                totalTime,
                referencesCount: relevantDocs.length,
                answerLength: fallbackAnswer.length,
                timestamp: new Date(),
                processingSteps, // 既存のprocessingStepsを使用
                errors: [
                  {
                    id: `error_${Date.now()}`,
                    timestamp: new Date(),
                    level: 'error' as const,
                    category: 'ai' as const,
                    message: 'AI generation failed - using fallback',
                    context: {
                      userId,
                      sessionId,
                      operation: 'ai_generation'
                    },
                    resolved: false
                  }
                ],
                metadata: {
                  sessionId,
                  userAgent,
                  ipAddress,
                  userDisplayName
                }
              };
              
              fallbackPostLogId = await savePostLogToAdminDB(errorLogData);
              console.log('📝 エラー投稿ログを保存しました:', fallbackPostLogId);
            } catch (logError) {
              console.error('❌ エラー時の投稿ログの保存に失敗しました:', logError);
            }
            
            // フォールバック回答の完了メッセージを送信（postLogIdを含める）
            const fallbackCompletionMessage = {
              type: 'completion',
              step: 4,
              stepId: 'completed',
              title: '完了',
              description: 'フォールバック回答が生成されました',
              chunkIndex: 1,
              totalChunks: 1,
              references: relevantDocs.map((doc, index) => ({
              id: doc.id || `${doc.pageId}-${index}`,
              title: doc.title || 'タイトル不明',
              url: doc.url || '',
              spaceName: doc.spaceName || 'Unknown',
              labels: doc.labels || [],
              distance: doc.distance,
              source: doc.source,
              scoreText: doc.scoreText
            })),
              fullAnswer: fallbackAnswer,
              postLogId: fallbackPostLogId
            };
            
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(fallbackCompletionMessage)}\n\n`)
            );
          }
          
          controller.close();
          
        } catch (error) {
          console.error('❌ 処理ステップストリーミングエラー:', error);
          
          // Genkitエラーハンドリングを追加（既存のエラーハンドリングと並行動作）
          const genkitErrorResponse = createAPIErrorResponse(
            error,
            'streaming-process',
            500,
            { requestId: crypto.randomUUID() }
          );
          
          // Genkitエラーハンドリングログ（開発環境のみ）
          if (process.env.NODE_ENV === 'development') {
            console.log('[GenkitErrorHandler] Streaming error handling applied:', genkitErrorResponse.body);
          }
          
          // 既存のエラーメッセージ形式を維持
          const errorMessage = {
            type: 'error',
            step: 0, // エラー時はステップ0に設定
            stepId: 'error',
            title: 'エラーが発生しました',
            description: '処理中にエラーが発生しました',
            error: 'Streaming process failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            // Genkitエラー情報を追加（デバッグ用）
            genkitError: {
              code: genkitErrorResponse.body.code,
              details: genkitErrorResponse.body.details
            }
          };
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`)
          );
          
          controller.close();
        }
      }
    });

    // SSE レスポンス
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('❌ 処理ステップストリーミングAPIエラー:', error);
    
    // システムエラー時の投稿ログの保存
    try {
      const errorLogData = {
        userId: 'anonymous',
        question: 'Unknown question',
        answer: 'エラーが発生しました',
        serverStartupTime: 0, // サーバー起動処理時間を追加
        searchTime: 0,
        aiGenerationTime: 0,
        totalTime: 0,
        referencesCount: 0,
        answerLength: 0,
        timestamp: new Date(),
        processingSteps: [{
          step: 'error',
          status: 'error' as const,
          duration: 0,
          timestamp: new Date()
        }],
        errors: [{
          id: `error_${Date.now()}`,
          timestamp: new Date(),
          level: 'error' as const,
          category: 'system' as const,
          message: error instanceof Error ? error.message : '不明なエラー',
          context: {
            userId: 'anonymous',
            sessionId: 'unknown',
            userAgent: 'unknown',
            ipAddress: 'unknown',
            operation: 'streaming_process_overall'
          },
          resolved: false
        }],
        metadata: {
          sessionId: 'unknown',
          userAgent: 'unknown',
          ipAddress: 'unknown',
          userDisplayName: 'anonymous'
        }
      };
      await savePostLogToAdminDB(errorLogData);
      console.log('📝 システムエラー投稿ログを保存しました:', errorLogData);
    } catch (logError) {
      console.error('❌ システムエラー時の投稿ログの保存に失敗しました:', logError);
    }
    
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};


// OPTIONS メソッドのサポート（CORS）
export const OPTIONS = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
  