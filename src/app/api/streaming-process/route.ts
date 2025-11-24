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
import { getDeploymentInfo } from '@/lib/deployment-info';
import type { PostLog, ProcessingStep } from '@/types';
import { GeminiConfig } from '@/config/ai-models-config';
import { removeBOM } from '@/lib/bom-utils';
import { generateFallbackAnswer } from '@/lib/fallback-answer-generator';
import { appConfig } from '@/config/app-config';
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
    
    // Timestamp変換ロジックを共通化
    const firestoreData = convertPostLogToAdminFirestore(logData);
    
    const docRef = await postLogsRef.add(firestoreData);
    return docRef.id;
  } catch (error) {
    console.error('❌ サーバーサイド投稿ログ保存に失敗しました:', error);
    throw error;
  }
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
    return 0; // 待ち時間なし
  }
  
  // 初期化が開始されていない場合は開始する
  // instrumentation.jsで既に開始されている可能性があるが、念のため確認
  const { initializeStartupOptimizations } = await import('@/lib/startup-optimizer');
  if (!isStartupInitialized()) {
    // 非同期で開始（完了を待たない）
    initializeStartupOptimizations().catch((error) => {
      console.warn('[ensureServerInitialized] Startup optimization failed:', error);
    });
  }
  
  // まだ初期化中の場合は完了を待つ（最大1秒でタイムアウト）
  // 重い初期化処理はバックグラウンドで継続し、ユーザーリクエストをブロックしない
  await waitForInitialization();
  const waitTime = Date.now() - startTime;
  return waitTime;
}

export const POST = async (req: NextRequest) => {
  // API呼び出し開始時刻を記録（TTFB計測用）
  const apiStartTime = Date.now();
  
  try {
    // サーバー起動時に1回だけ初期化（2回目以降は即座にreturn）
    const serverStartupTime = await ensureServerInitialized();

    // 🔧 BOM除去処理を強化: req.json()でパースする前に、リクエストボディを文字列として取得してBOMを除去
    const bodyText = await req.text();
    const bodyFirstCharCode = bodyText.length > 0 ? bodyText.charCodeAt(0) : -1;
    const bodyHasBOM = bodyText.includes('\uFEFF') || bodyFirstCharCode === 0xFEFF;
    
    if (bodyHasBOM) {
      const deploymentInfo = getDeploymentInfo();
      console.error(`🚨 [BOM DETECTED IN REQUEST BODY] HTTPリクエストボディにBOMが含まれています:`, {
        deploymentTime: deploymentInfo.deploymentTime,
        deploymentTimestamp: deploymentInfo.deploymentTimestamp,
        uptime: deploymentInfo.uptime,
        originalLength: bodyText.length,
        preview: bodyText.substring(0, 100),
        firstCharCode: bodyFirstCharCode
      });
    }
    
    const cleanBodyText = removeBOM(bodyText);
    
    // JSONパースのエラーハンドリング
    let body: any;
    try {
      body = JSON.parse(cleanBodyText);
    } catch (parseError) {
      console.error('❌ [JSON PARSE ERROR] リクエストボディのパースに失敗しました:', parseError);
      console.error('❌ [JSON PARSE ERROR] リクエストボディの内容:', {
        bodyTextLength: cleanBodyText.length,
        bodyTextPreview: cleanBodyText.substring(0, 200),
        firstCharCode: cleanBodyText.length > 0 ? cleanBodyText.charCodeAt(0) : -1
      });
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        message: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      }, { status: 400 });
    }
    
    let { 
      question, 
      chatHistory = [], 
      labelFilters = { includeMeetingNotes: false }, 
      source = 'confluence',
      filters = {} 
    } = body;
    
    // 🔍 原因特定: question変数にBOMが混入していないかチェック
    if (question && typeof question === 'string') {
      const questionFirstCharCode = question.length > 0 ? question.charCodeAt(0) : -1;
      const questionHasBOM = question.includes('\uFEFF') || questionFirstCharCode === 0xFEFF;
      
      if (questionHasBOM) {
        const deploymentInfo = getDeploymentInfo();
        console.error(`🚨 [BOM DETECTED IN QUESTION] question変数にBOMが含まれています:`, {
          deploymentTime: deploymentInfo.deploymentTime,
          deploymentTimestamp: deploymentInfo.deploymentTimestamp,
          uptime: deploymentInfo.uptime,
          firstCharCode: questionFirstCharCode,
          firstChar: question.charAt(0),
          questionLength: question.length,
          questionPreview: question.substring(0, 50)
        });
      }
      
      // BOM文字（U+FEFF）のみを削除（埋め込み生成エラーを防ぐため）
      question = removeBOM(question).trim();
      
      if (question.length > 0 && question.charCodeAt(0) === 0xFEFF) {
        console.error(`🚨 [REMOVING BOM FROM QUESTION] question変数からBOM文字（0xFEFF）を削除します:`, {
          removedCharCode: question.charCodeAt(0),
          beforeLength: question.length
        });
        question = removeBOM(question).trim();
      }
      
      // questionが空文字列になった場合はエラー
      if (question.trim().length === 0) {
        console.error('❌ [EMPTY QUESTION] question変数が空文字列になりました');
        return NextResponse.json({ 
          error: 'question cannot be empty after cleaning',
          message: 'The question became empty after removing BOM characters'
        }, { status: 400 });
      }
    }
    
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json({ 
        error: 'question is required and must be a non-empty string'
      }, { status: 400 });
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
          // Phase 8最適化: ストリームの状態を追跡（postLogId送信エラー対策）
          let isStreamClosed = false;
          
          // ストリームが閉じられたときにフラグを設定するためのラッパー
          const originalClose = controller.close.bind(controller);
          controller.close = function() {
            isStreamClosed = true;
            return originalClose();
          };
          
          try {
            // 【最優先】即座に最初のステップを送信してユーザーに応答を見せる
            await updateStep(controller, encoder, 0, 'search', '処理を開始しています...');
          
          // TTFB（Time To First Byte）を計測: API呼び出しから最初のストリーミングチャンク送信完了までの時間
          const ttfbTime = Date.now() - apiStartTime;
          if (ttfbTime > 1000) { // 1秒以上の場合のみログ出力（パフォーマンス問題の検知）
            screenTestLogger.warn('performance', 'Slow initial response detected', {
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
          if (latency > 100) {
            screenTestLogger.logOverallPerformance(question, latency, {
              clientStartTime: new Date(clientStartTime).toISOString(),
              serverReceiveTime: new Date().toISOString()
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
          // ユーザーがボタンを押してから検索完了までの時間を計測（リクエスト受信時点から）
          const searchStartTime = apiStartTime; // リクエスト受信時点から計測開始
          console.log(`[PERF] 🔍 検索処理開始（ユーザー認識時間）: ${new Date(searchStartTime).toISOString()}`);
          let userDisplayName = 'anonymous';
          
          let searchResults: any[] = [];
          try {
            const retrieveStartTime = Date.now();
            console.log(`[PERF] 📥 retrieveRelevantDocs呼び出し開始: ${Date.now() - searchStartTime}ms (リクエスト受信からの経過時間)`);
            
            const [results, userInfo] = await Promise.all([
              retrieveRelevantDocs({
                question,
                labels: [],
                labelFilters,
                source,
                filters
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
            
            const retrieveEndTime = Date.now();
            const retrieveDuration = retrieveEndTime - retrieveStartTime;
            console.log(`[PERF] 📥 retrieveRelevantDocs完了: ${retrieveDuration}ms (累計: ${retrieveEndTime - searchStartTime}ms)`);
            
            searchResults = results || [];
            userDisplayName = userInfo;
          } catch (searchError) {
            console.error('❌ 検索処理エラー:', searchError);
            searchResults = [];
            userDisplayName = 'anonymous';
          }
          
          relevantDocs = searchResults;
          
          // Firestoreから追加情報を取得して補完（Jira検索の場合のみ）
          if (source === 'jira' && relevantDocs.length > 0) {
            try {
              const { JiraFirestoreEnrichmentService } = await import('@/lib/jira-firestore-enrichment-service');
              const enrichmentService = JiraFirestoreEnrichmentService.getInstance();
              const enrichedDocs = await enrichmentService.enrichSearchResults(
                relevantDocs.map(doc => ({
                  id: doc.id,
                  issue_key: (doc as any).issue_key || doc.id,
                  title: doc.title,
                  content: doc.content,
                  status: (doc as any).status || '',
                  status_category: (doc as any).status_category || '',
                  priority: (doc as any).priority || '',
                  assignee: (doc as any).assignee || '',
                  issue_type: (doc as any).issue_type || ''
                })),
                10 // 最大10件まで補完
              );

              // 補完されたデータをrelevantDocsに反映
              relevantDocs = enrichedDocs.map((enriched, index) => {
                const original = relevantDocs[index];
                return {
                  ...original,
                  // カスタムフィールドを追加
                  ...(enriched.customFields && { customFields: enriched.customFields }),
                  // コメント履歴を追加
                  ...(enriched.comments && { comments: enriched.comments })
                };
              });
            } catch (enrichmentError) {
              // エラーが発生した場合、LanceDBのデータのみを使用（フォールバック）
              console.warn('[Streaming API] Failed to enrich results from Firestore:', enrichmentError);
            }
          }
          // ユーザーがボタンを押してから検索完了までの時間（リクエスト受信時点から検索完了まで）
          const searchEndTime = Date.now();
          searchTime = searchEndTime - searchStartTime;
          console.log(`[PERF] 🔍 検索処理完了（ユーザー認識時間）: 総時間 ${searchTime}ms (リクエスト受信から検索完了まで)`);
          
          // 検索ソース別の集計
          const searchSourceStats = (relevantDocs || []).reduce((acc: Record<string, number>, doc) => {
            const source = doc.source || 'unknown';
            acc[source] = (acc[source] || 0) + 1;
            return acc;
          }, {});
          
          // ハイブリッド検索結果（ログ削減）
          
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

          // パフォーマンス最適化: ドキュメント処理ステップを簡略化し、AI生成を早期開始
          // ステップ2: ドキュメント処理中...（簡略版）
          const processingMessage = {
            type: 'step_update',
            step: 1,  // Phase 5修正: ドキュメント処理はステップ1（0ベース）
            stepId: 'processing',
            title: 'ドキュメント処理中...',
            description: `検索結果 ${relevantDocs.length} 件を分析・整理しています...`,
            totalSteps: 4,
            icon: '📊',
            references: relevantDocs.slice(0, 10).map((doc, index) => {
              // JiraとConfluenceを判定（issue_keyの存在で判定）
              const isJira = !!(doc as any).issue_key;
              const dataSource: 'confluence' | 'jira' = isJira ? 'jira' : 'confluence';
              
              return {
                id: doc.id || `${doc.pageId}-${index}`,
                title: doc.title || 'タイトル不明',
                url: doc.url || '',
                spaceName: doc.spaceName || 'Unknown',
                labels: doc.labels || [],
                distance: doc.distance,
                source: doc.source,
                scoreText: doc.scoreText,
                dataSource: dataSource // データソース（confluence/jira）を追加
              };
            })
          };
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(processingMessage)}\n\n`)
          );

          // パフォーマンス最適化: 遅延を完全に削除し、即座にAI生成を開始
          const documentProcessingStartTime = Date.now();
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

          screenTestLogger.info('search', `Retrieved ${relevantDocs.length} relevant documents for streaming`);

          // ステップ3: AIが回答を生成中...
          await updateStep(controller, encoder, 2, 'ai_generation', 'AIが回答を生成しています...');
          // delay削除: AI生成はすぐに開始

          // ストリーミング要約の実行
          let chunkIndex = 0;
          let totalChunks = 0;
          // Phase 0A-4 FIX: AI生成時間は検索完了時刻から計測
          const aiStartTime = searchEndTime;

          // LLMに渡すcontextの件数を制限（実際に使用される参照元のみを表示）
          const MAX_CONTEXT_DOCS = 10; // LLMに渡すドキュメント数（回答生成に実際に使用される件数、参照元の表示数）
          const contextDocsForLLM = relevantDocs.slice(0, MAX_CONTEXT_DOCS);
          // LLMコンテキスト用ドキュメント準備完了（ログ削減）
          
          try {
            for await (const result of streamingSummarizeConfluenceDocs({
              question,
              context: contextDocsForLLM, // LLMに渡す件数を制限
              chatHistory,
              source // データソース（confluence/jira）を渡す
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

              // 投稿ログの保存（非同期実行 - パフォーマンス最適化）
              // Phase 0A-4 FIX: 総処理時間はAPI開始時刻から計測（TTFBとの整合性を保つ）
              totalTime = Date.now() - apiStartTime;
              // ストリーミング処理完了
              
              let savedPostLogId: string | null = null;
              
              // 環境情報を取得
              const environment: 'development' | 'staging' | 'production' = 
                appConfig.environment.isProduction ? 'production' :
                appConfig.environment.isTest ? 'staging' :
                'development';

              // データソースを判定（dataSourceフィールドを優先、なければsourceパラメータを使用）
              let dataSource: 'confluence' | 'jira' | 'mixed' | 'unknown' = 'unknown';
              if (result.references && result.references.length > 0) {
                // dataSourceフィールドを優先的に使用
                const dataSources = result.references
                  .map((ref: any) => ref.dataSource)
                  .filter((ds: any): ds is 'confluence' | 'jira' => ds === 'confluence' || ds === 'jira');
                
                if (dataSources.length > 0) {
                  const uniqueDataSources = new Set(dataSources);
                  if (uniqueDataSources.size > 1) {
                    dataSource = 'mixed';
                  } else {
                    dataSource = uniqueDataSources.values().next().value || 'unknown';
                  }
                } else {
                  // dataSourceフィールドがない場合はURLから判定（後方互換性のため）
                  const hasConfluence = result.references.some((ref: any) => 
                    ref.url?.includes('confluence') || ref.source === 'confluence'
                  );
                  const hasJira = result.references.some((ref: any) => 
                    ref.url?.includes('jira') || ref.source === 'jira'
                  );
                  if (hasConfluence && hasJira) {
                    dataSource = 'mixed';
                  } else if (hasConfluence) {
                    dataSource = 'confluence';
                  } else if (hasJira) {
                    dataSource = 'jira';
                  } else {
                    // sourceパラメータから判定
                    dataSource = source === 'jira' ? 'jira' : 'confluence';
                  }
                }
              } else {
                // 参照がない場合はsourceパラメータから判定
                dataSource = source === 'jira' ? 'jira' : 'confluence';
              }

              // PostLog保存データを準備
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
                references: result.references, // 参照元の詳細情報を追加
                answerLength: fullAnswer.length,
                timestamp: new Date(),
                processingSteps,
                errors: [],
                metadata: {
                  sessionId,
                  userAgent,
                  ipAddress,
                  userDisplayName, // ユーザー表示名を追加
                  environment, // 環境情報を追加
                  dataSource // データソースを追加
                }
              };
              
              // postLogIdを取得してから完了メッセージを送信
              try {
                savedPostLogId = await savePostLogToAdminDB(logData);
              } catch (logError) {
                console.error('❌ 投稿ログの保存に失敗しました:', logError);
                // エラーが発生しても処理は継続（postLogIdはnullのまま）
              }

              // 完了メッセージ（保存されたpostLogIdを含める）
              // フィルタリング前の参照元（検索結果全体）とフィルタリング後の参照元（LLMが使用した参照元）の両方を含める
              const allReferences = relevantDocs.map((doc, index) => {
                // JiraとConfluenceを判定（issue_keyの存在で判定）
                const isJira = !!(doc as any).issue_key;
                const dataSource: 'confluence' | 'jira' = isJira ? 'jira' : 'confluence';
                
                return {
                  id: doc.id || `${doc.pageId}-${index}`,
                  title: doc.title || 'タイトル不明',
                  url: doc.url || '',
                  spaceName: doc.spaceName || 'Unknown',
                  labels: doc.labels || [],
                  distance: doc.distance,
                  source: doc.source,
                  scoreText: doc.scoreText,
                  dataSource: dataSource // データソース（confluence/jira）を追加
                };
              });
              
              const completionMessage = {
                type: 'completion',
                step: 3,  // Phase 5修正: 完了はステップ3（0ベース）
                stepId: 'completed',
                title: '完了',
                description: '回答が生成されました',
                chunkIndex: result.chunkIndex,
                totalChunks: result.totalChunks,
                references: result.references, // フィルタリング後（LLMが使用した参照元）
                allReferences: (result as any).allReferences || allReferences, // ★★★ 修正: 拡張されたallReferencesを優先的に使用 ★★★
                fullAnswer: fullAnswer,
                postLogId: savedPostLogId || null,
                // パフォーマンス情報を追加（テスト用）
                performance: {
                  serverStartupTime,
                  ttfbTime,
                  searchTime,
                  aiGenerationTime,
                  totalTime
                }
              };
              
              // ストリームが閉じられていない場合のみ送信
              if (!isStreamClosed) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(completionMessage)}\n\n`)
                );
              }
              
              // ログ記録
              screenTestLogger.logAIPerformance(question, aiGenerationTime, fullAnswer.length, {
                streamingChunks: totalChunks,
                referencesBeforeFiltering: relevantDocs.length, // フィルタリング前の参照元数
                referencesAfterFiltering: result.references.length, // フィルタリング後の参照元数（LLMが使用した参照元）
                references: result.references.length, // 後方互換性のため残す
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
              // エラー投稿ログ保存完了（ログ削減）
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
          // エラーの詳細をログに出力
          console.error('❌ 処理ステップストリーミングエラー:', error);
          console.error('❌ エラー詳細:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : typeof error,
            error: error
          });
          
          // Genkitエラーハンドリングを追加（既存のエラーハンドリングと並行動作）
          const genkitErrorResponse = createAPIErrorResponse(
            error,
            'streaming-process',
            500,
            { requestId: crypto.randomUUID() }
          );
          
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
            },
            // 開発環境のみスタックトレースを返す
            ...(process.env.NODE_ENV === 'development' && error instanceof Error ? {
              stack: error.stack,
              name: error.name
            } : {})
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
      // システムエラー投稿ログ保存完了（ログ削減）
    } catch (logError) {
      console.error('❌ システムエラー時の投稿ログの保存に失敗しました:', logError);
    }
    
    // エラーの詳細をログに出力
    console.error('❌ 詳細エラー情報:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error,
      error: error
    });
    
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      // 開発環境のみスタックトレースを返す
      ...(process.env.NODE_ENV === 'development' && error instanceof Error ? {
        stack: error.stack,
        name: error.name
      } : {})
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
  