/**
 * 処理ステップストリーミングAPI
 * 4つのステップをリアルタイムで更新しながら処理状況を配信
 */

import { NextRequest, NextResponse } from 'next/server';
import { retrieveRelevantDocs } from '@/ai/flows/retrieve-relevant-docs-lancedb';
import { streamingSummarizeConfluenceDocs } from '@/ai/flows/streaming-summarize-confluence-docs';
import { createAPIErrorResponse } from '@/lib/genkit-error-handler';
import { initializeStartupOptimizations } from '@/lib/startup-optimizer';
import { getFirebaseFirestore } from '@/lib/firebase-unified';
import * as admin from 'firebase-admin';
import type { PostLog, ProcessingStep } from '@/types';
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

// Firebase Admin SDKを初期化する関数
function initializeFirebaseAdmin() {
  if (admin.apps.length === 0) {
    try {
      // 環境変数からサービスアカウントキーを取得
      const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (serviceAccount) {
        const serviceAccountData = require(serviceAccount);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountData)
        });
        console.log('✅ Firebase Admin SDK initialized');
      } else {
        console.warn('⚠️ GOOGLE_APPLICATION_CREDENTIALS not set, using default credentials');
        admin.initializeApp();
      }
    } catch (error) {
      console.error('❌ Firebase Admin SDK initialization failed:', error);
      throw error;
    }
  }
  return admin.app();
}

// サーバーサイド用の投稿ログ保存関数
async function savePostLogToAdminDB(logData: Omit<PostLog, 'id'>): Promise<string> {
  try {
    // Firebase Admin SDKを使用
    const adminApp = initializeFirebaseAdmin();
    const db = admin.firestore();
    const postLogsRef = db.collection('postLogs');
    
    console.log('🔍 サーバーサイド投稿ログデータの詳細:', {
      userId: logData.userId,
      question: logData.question?.substring(0, 50) + '...',
      answer: logData.answer?.substring(0, 50) + '...',
      searchTime: logData.searchTime,
      aiGenerationTime: logData.aiGenerationTime,
      totalTime: logData.totalTime,
      referencesCount: logData.referencesCount,
      answerLength: logData.answerLength,
      timestamp: logData.timestamp
    });
    
    const firestoreData = {
      ...logData,
      timestamp: admin.firestore.Timestamp.fromDate(logData.timestamp),
      processingSteps: logData.processingSteps.map(step => ({
        ...step,
        timestamp: admin.firestore.Timestamp.fromDate(step.timestamp)
      })),
      errors: logData.errors?.map(error => ({
        ...error,
        timestamp: admin.firestore.Timestamp.fromDate(error.timestamp),
        resolvedAt: error.resolvedAt ? admin.firestore.Timestamp.fromDate(error.resolvedAt) : null
      })) || [],
      metadata: logData.metadata
    };
    
    const docRef = await postLogsRef.add(firestoreData);
    console.log('📝 サーバーサイド投稿ログを保存しました:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ サーバーサイド投稿ログ保存に失敗しました:', error);
    throw error;
  }
}

// フォールバック回答生成関数
function generateFallbackAnswer(question: string, context: any[]): string {
  console.log('🔄 フォールバック回答生成開始');
  
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

export const POST = async (req: NextRequest) => {
  try {
    // 起動時最適化を実行（初回のみ）
    await initializeStartupOptimizations();

    const body = await req.json();
    const { question, chatHistory = [], labelFilters = { includeMeetingNotes: false } } = body;

    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }

    console.log('🌊 処理ステップストリーミングAPI開始:', question);
    screenTestLogger.info('ai', `Streaming process request: "${question}"`, { 
      chatHistoryLength: chatHistory.length,
      labelFilters 
    });

    // ストリーミング応答の設定
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let currentStep = 0;
          let fullAnswer = '';
          let relevantDocs: any[] = [];
          
          // postLogs保存用の変数
          const startTime = Date.now();
          let searchTime = 0;
          let aiGenerationTime = 0;
          let totalTime = 0;
          let processingSteps: ProcessingStep[] = [];
          const userId = 'anonymous'; // 実際の実装では認証から取得
          const sessionId = crypto.randomUUID();
          const userAgent = 'unknown';
          const ipAddress = 'unknown';

          // ステップ1: 検索中...
          await updateStep(controller, encoder, 0, 'search', '関連ドキュメントを検索しています...');
          await delay(500); // 視覚的効果のための遅延

          // 実際の検索処理
          const searchStartTime = Date.now();
          relevantDocs = await retrieveRelevantDocs({
            question,
            labels: [],
            labelFilters
          });
          searchTime = Date.now() - searchStartTime;

          // ステップ2: ドキュメント処理中...
          await updateStep(controller, encoder, 1, 'processing', `検索結果 ${relevantDocs.length} 件を分析・整理しています...`);
          await delay(800);

          console.log(`📚 関連文書取得完了: ${relevantDocs.length}件`);
          screenTestLogger.info('search', `Retrieved ${relevantDocs.length} relevant documents for streaming`);

          // ステップ3: AIが回答を生成中...
          await updateStep(controller, encoder, 2, 'ai_generation', 'AIが回答を生成しています...');
          await delay(300);

          // ストリーミング要約の実行
          let chunkIndex = 0;
          let totalChunks = 0;
          const aiStartTime = Date.now();

          try {
            for await (const result of streamingSummarizeConfluenceDocs({
              question,
              context: relevantDocs,
              chatHistory
            })) {
            
            if (result.isComplete) {
              totalChunks = result.chunkIndex;
              fullAnswer = fullAnswer.trim();
              aiGenerationTime = Date.now() - aiStartTime;
              
              // ステップ4: 最終調整中...
              await updateStep(controller, encoder, 3, 'finalizing', '回答を最終確認しています...');
              await delay(500);

              // 完了メッセージ
              const completionMessage = {
                type: 'completion',
                step: 4,
                stepId: 'completed',
                title: '完了',
                description: '回答が生成されました',
                chunkIndex: result.chunkIndex,
                totalChunks: result.totalChunks,
                references: result.references,
                fullAnswer: fullAnswer
              };
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(completionMessage)}\n\n`)
              );
              
              // ログ記録
              screenTestLogger.logAIPerformance(question, performance.now(), fullAnswer.length, {
                streamingChunks: totalChunks,
                references: result.references.length,
                isStreaming: true,
                processingSteps: 4
              });
              
              // 成功時の投稿ログの保存
              console.log('🎯 ストリーミング処理完了 - postLogs保存処理を開始します');
              totalTime = Date.now() - startTime;
              processingSteps = [
                {
                  step: 'search',
                  status: 'completed' as const,
                  duration: searchTime,
                  timestamp: new Date(startTime)
                },
                {
                  step: 'processing',
                  status: 'completed' as const,
                  duration: 800,
                  timestamp: new Date(startTime + searchTime)
                },
                {
                  step: 'ai_generation',
                  status: 'completed' as const,
                  duration: aiGenerationTime,
                  timestamp: new Date(startTime + searchTime + 800)
                },
                {
                  step: 'finalizing',
                  status: 'completed' as const,
                  duration: 500,
                  timestamp: new Date(startTime + searchTime + 800 + aiGenerationTime)
                }
              ];
              
              try {
                console.log('📊 postLogs保存データを準備中:', {
                  userId,
                  question: question.substring(0, 50) + '...',
                  answerLength: fullAnswer.length,
                  searchTime,
                  aiGenerationTime,
                  totalTime,
                  referencesCount: result.references.length
                });
                
                const logData = {
                  userId,
                  question,
                  answer: fullAnswer,
                  searchTime,
                  aiGenerationTime,
                  totalTime,
                  referencesCount: result.references.length,
                  answerLength: fullAnswer.length,
                  timestamp: new Date(),
                  processingSteps,
                  metadata: {
                    sessionId,
                    userAgent,
                    ipAddress
                  }
                };
                
                const postLogId = await savePostLogToAdminDB(logData);
                console.log('✅ 投稿ログを保存しました:', postLogId);
              } catch (logError) {
                console.error('❌ 投稿ログの保存に失敗しました:', logError);
              }
              
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
                distance: doc.distance || 0.5,
                score: doc.score || 0,
                source: doc.source || 'vector'
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
            
            // フォールバック回答の完了メッセージを送信
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
                distance: doc.distance || 0.5,
                score: doc.score || 0,
                source: doc.source || 'vector'
              })),
              fullAnswer: fallbackAnswer
            };
            
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(fallbackCompletionMessage)}\n\n`)
            );
            
            // エラー時の投稿ログの保存
            totalTime = Date.now() - startTime;
            try {
              const errorLogData = {
                userId,
                question,
                answer: fallbackAnswer,
                searchTime,
                aiGenerationTime: 0, // AI生成は失敗したため0
                totalTime,
                referencesCount: relevantDocs.length,
                answerLength: fallbackAnswer.length,
                timestamp: new Date(),
                processingSteps: [
                  {
                    step: 'search',
                    status: 'completed' as const,
                    duration: searchTime,
                    timestamp: new Date(startTime)
                  },
                  {
                    step: 'processing',
                    status: 'completed' as const,
                    duration: 800,
                    timestamp: new Date(startTime + searchTime)
                  },
                  {
                    step: 'ai_generation',
                    status: 'error' as const,
                    duration: 0, // AI生成は失敗したため0
                    timestamp: new Date(startTime + searchTime + 800)
                  }
                ],
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
                  ipAddress
                }
              };
              
              const postLogId = await savePostLogToAdminDB(errorLogData);
              console.log('📝 エラー投稿ログを保存しました:', postLogId);
            } catch (logError) {
              console.error('❌ エラー時の投稿ログの保存に失敗しました:', logError);
            }
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
          
          console.log('[GenkitErrorHandler] Streaming error handling applied:', genkitErrorResponse.body);
          
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
          ipAddress: 'unknown'
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

// ステップ更新ヘルパー関数
async function updateStep(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  stepIndex: number,
  stepId: string,
  description: string
) {
  const stepMessage = {
    type: 'step_update',
    step: stepIndex + 1,
    stepId,
    title: PROCESSING_STEPS[stepIndex]?.title || '処理中...',
    description,
    totalSteps: PROCESSING_STEPS.length,
    icon: PROCESSING_STEPS[stepIndex]?.icon || 'default'
  };
  
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify(stepMessage)}\n\n`)
  );
}

// 遅延ヘルパー関数
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
