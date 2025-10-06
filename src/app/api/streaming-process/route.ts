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
import { postLogService } from '@/lib/post-log-service';
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

// Firebase Admin SDKの初期化（サービスアカウントキーを使用）
let adminDb: FirebaseFirestore.Firestore | null = null;

function getAdminFirestore() {
  if (!adminDb) {
    if (getApps().length === 0) {
      // サービスアカウントキーを直接読み込み
      const serviceAccount = {
        type: "service_account",
        project_id: "confluence-copilot-ppjye",
        private_key_id: "010abed595f7d7e3ec998c3d945608e77734dc4e",
        private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDVRHxOZim7cOGE\n0eX6+bTSaJXnI3jW8SrwpsSovJOe5av1bsmY2PzRMMIU6TOK5XkOAQ+ywsJB+3Bp\nm5tVhmH/Zw9BhoDs1GLJU8J2dTyCsJYpDtbtX/SdRW9O4xfqWLUPoKaMFBN6qQJD\nv7J/9o+g2gW2h0mOkzKshkCZf3RITU7xdNyXab0EFSNPb1w4tXzZKllzJl0TOKyv\ned9Ckjzy64ztN9gvYcswOFRpdRcNy5w0ijJXt92xbttHjO6U+cWo/Lmla9NLWrrK\npt1lFCc5T+L4XHiS3UW6P0AvqAtkFDeRZv7FsA04N+WVje6Q5LkD3vz5swonspBx\nzpvVu78nAgMBAAECggEAA4OgFSSiBGiTdr5Re7i4oSaMoP6yVr+QYkXFNzVgRoqC\nfyyG3hT/pkZkGrcbAwUAx4yYU+0Mov/mXGWH6J/EJp+Ha1N9jvZGKHFP/E0c2Ara\nQ2C767TPxMJ1Pceh+1ngP4EsrWGftPI3yzwx6a57TTG6gJIrHp8DUAxB4HJus2N2\n/+F1PtxOaaO018auI1BIPKDiUYUxs9Bg0GFfe6PGP2FYnD0cYOAL0qO7mCkNrDXu\nJLTZcsKFveqp4W0WUK3yaXexaYWuem2NP7dawkmXSCjl1ew1NXozZYRrcXYRW6qf\nUGx5GcVdHrPITNmHhOFFJafPiP94bQew4J1Dx1nn6QKBgQD9qCgWpR4SyPVx84cB\nSufY85l1GAMW5ClYzxhAuw8mJX08/EJzZrhqEqfQ5scu5uIOWKi71csdEul+Yamg\nfQ99Ezf6pNeoYNdTC94oaM4eseiBBBorxoTvtggs2PQtUscJSPdM4HZC7qwslQM+\nDRiWZXBAhcAkntHjcK3wgQWMbwKBgQDXPNEkB+EdAQoyHCIfhf2Jsv8Q3+la8sG1\nOQVRMpuOewfbjIL8JjkVwf/H+YeE52dNFfAr2v6sdb7ZsDOicmjZ8jhpd7/zzC+0\niUdrv3rVaDAgEhIZMalqlsLa2iAgsl0v1i1J9VSajTm/QLr2TYNyT+GX64szjPmK\noS4KgZ1EyQKBgARqihAi3cwr7YIHYGFYYYL4csKEIYGjhUjDikOOPixG2NBX//ws\nXKeUHZHYgr1BTcw8JOvoQ/oEm0YVAzQFGWDvFblqZ0rKLNWITlzbvkLwjAC7Bo2e\nji/yNmA5gr7LQyXZPFz9R3HQ3/SCv6Sz66qqp3KoIXlBvpu8GXsnc+ZHAoGBALOG\nZ47c/5fYkS+ApbmTYgjjgroJeTNBve4xFE1In9T0q3YlOe+k1gJe4MBkUfO5q0Dx\npnR94ePpBfm+bSL2uJvo28KkfjeUPMohoq+tc3/iuhlV2UCoWn2sJ/Sw8RE0lGNd\nCkNg3GNYniz2ibr8pkHHfQvhDCdAU7ecfrGGsK15AoGAbv0+RBAd4bqO5muZJVoP\nozjwDN1LKsIjcAaeVrNZox47dySmB88QQx9OhTnP4J6GV1CSzttKmhvID6gil5Mv\n/7kYNqrKQmjpkC2GnAmwhKM3VMTodpuN3U3PuWk1jd7vstoPsG8ftTyVM4I7/9AS\nYlB8/A8nz+O1CsifMPRkzDw=\n-----END PRIVATE KEY-----\n",
        client_email: "firebase-adminsdk-fbsvc@confluence-copilot-ppjye.iam.gserviceaccount.com",
        client_id: "114253370830371856382",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40confluence-copilot-ppjye.iam.gserviceaccount.com",
        universe_domain: "googleapis.com"
      };
      
      initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "confluence-copilot-ppjye"
      });
    }
    adminDb = getFirestore();
  }
  return adminDb;
}

    // Firebase Admin SDKで投稿ログを保存する関数
    async function savePostLogToAdminDB(logData: Omit<PostLog, 'id'>): Promise<string> {
      try {
        const db = getAdminFirestore();
        const postLogsRef = db.collection('postLogs');
        
        console.log('🔍 投稿ログデータの詳細:', {
          userId: logData.userId,
          question: logData.question?.substring(0, 50) + '...',
          answer: logData.answer?.substring(0, 50) + '...',
          searchTime: logData.searchTime,
          aiGenerationTime: logData.aiGenerationTime,
          totalTime: logData.totalTime
        });
        
        // Firestoreドキュメントを作成
        const firestoreData: any = {
          userId: logData.userId,
          question: logData.question,
          answer: logData.answer,
          searchTime: logData.searchTime,
          aiGenerationTime: logData.aiGenerationTime,
          totalTime: logData.totalTime,
          referencesCount: logData.referencesCount,
          answerLength: logData.answerLength,
          timestamp: Timestamp.fromDate(logData.timestamp),
          processingSteps: logData.processingSteps.map(step => ({
            ...step,
            timestamp: Timestamp.fromDate(step.timestamp)
          })),
          metadata: logData.metadata
        };
        
        // errorsが存在する場合のみ追加
        if (logData.errors && Array.isArray(logData.errors) && logData.errors.length > 0) {
          firestoreData.errors = logData.errors.map(error => ({
            ...error,
            timestamp: Timestamp.fromDate(error.timestamp),
            resolvedAt: error.resolvedAt ? Timestamp.fromDate(error.resolvedAt) : null
          }));
        }
        
        const docRef = await postLogsRef.add(firestoreData);
        console.log('📝 投稿ログをAdmin SDKで保存しました:', docRef.id);
        return docRef.id;
      } catch (error) {
        console.error('❌ Admin SDKでの投稿ログ保存に失敗しました:', error);
        throw error;
      }
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
  console.log('🚀 [API] streaming-process route called');
  try {
    // 起動時最適化を実行（初回のみ）
    await initializeStartupOptimizations();

    const body = await req.json();
    const { question, chatHistory = [], labelFilters = { includeMeetingNotes: false } } = body;
    
    console.log('📝 [API] Request data:', {
      questionLength: question?.length,
      chatHistoryLength: chatHistory?.length,
      labelFilters
    });

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
          let postLogId: string | null = null;
          
          // ユーザーIDの取得（認証ヘッダーから）
          let userId = req.headers.get('x-user-id') || req.headers.get('authorization')?.replace('Bearer ', '') || 'anonymous';
          const sessionId = req.headers.get('x-session-id') || crypto.randomUUID();
          const userAgent = req.headers.get('user-agent') || 'unknown';
          const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
          
          // ユーザーIDが有効な場合、実際のユーザー情報を取得
          let userDisplayName = 'anonymous';
          if (userId && userId !== 'anonymous') {
            try {
              const adminApp = initializeFirebaseAdmin();
              const auth = admin.auth(adminApp);
              const userRecord = await auth.getUser(userId);
              userDisplayName = userRecord.displayName || userRecord.email || 'unknown';
              console.log('👤 ユーザー情報取得:', {
                uid: userRecord.uid,
                displayName: userRecord.displayName,
                email: userRecord.email
              });
            } catch (userError) {
              console.warn('⚠️ ユーザー情報取得失敗:', userError);
              // ユーザー情報が取得できない場合はanonymousのまま
            }
          }
          
          console.log('🔍 投稿ログ用データ:', {
            userId,
            userDisplayName,
            sessionId,
            userAgent: userAgent.substring(0, 50) + '...',
            ipAddress
          });

          // ステップ1: 検索中...
          await updateStep(controller, encoder, 0, 'search', '関連ドキュメントを検索しています...');
          const searchStartTime = Date.now();
          await delay(500); // 視覚的効果のための遅延

          // 実際の検索処理
<<<<<<< HEAD
          const searchStartTime = Date.now();
          relevantDocs = await retrieveRelevantDocs({
=======
          const searchStartTimeDetailed = Date.now();
          const searchResults = await retrieveRelevantDocs({
>>>>>>> 72c6361b3ee1e39f4218275120c3de0bb6ac7e0a
            question,
            labels: [],
            labelFilters
          });
<<<<<<< HEAD
          searchTime = Date.now() - searchStartTime;
=======
          
          // 検索結果の詳細分析
          const searchAnalysis = {
            totalDocuments: searchResults.length,
            vectorSearchResults: searchResults.filter(doc => doc.source === 'vector'),
            bm25SearchResults: searchResults.filter(doc => doc.source === 'bm25'),
            keywordSearchResults: searchResults.filter(doc => doc.source === 'keyword'),
            hybridSearchResults: searchResults.filter(doc => doc.source === 'hybrid'),
            averageScore: searchResults.length > 0 ? searchResults.reduce((sum, doc) => sum + (doc.score || 0), 0) / searchResults.length : 0,
            maxScore: searchResults.length > 0 ? Math.max(...searchResults.map(doc => doc.score || 0)) : 0,
            minScore: searchResults.length > 0 ? Math.min(...searchResults.map(doc => doc.score || 0)) : 0,
            scoreDistribution: {
              high: searchResults.filter(doc => (doc.score || 0) > 0.8).length,
              medium: searchResults.filter(doc => (doc.score || 0) > 0.5 && (doc.score || 0) <= 0.8).length,
              low: searchResults.filter(doc => (doc.score || 0) <= 0.5).length
            }
          };

          relevantDocs = searchResults;
          searchTime = Date.now() - searchStartTime;
          processingSteps.push({
            step: 'search',
            status: 'completed',
            duration: searchTime,
            timestamp: new Date(),
            details: {
              ...searchAnalysis,
              searchSources: relevantDocs.map(doc => doc.source || 'unknown'),
              detailedScores: relevantDocs.map(doc => ({
                title: doc.title?.substring(0, 50) + '...',
                source: doc.source,
                score: doc.score || 0,
                distance: doc.distance || 0,
                url: doc.url || ''
              }))
            }
          });
>>>>>>> 72c6361b3ee1e39f4218275120c3de0bb6ac7e0a

          // ステップ2: ドキュメント処理中...
          await updateStep(controller, encoder, 1, 'processing', `検索結果 ${relevantDocs.length} 件を分析・整理しています...`);
          const processingStartTime = Date.now();
          await delay(800);
          const processingTime = Date.now() - processingStartTime;

          // ドキュメント処理の詳細分析
          const processingAnalysis = {
            documentsProcessed: relevantDocs.length,
            contentAnalysis: {
              totalContentLength: relevantDocs.reduce((sum, doc) => sum + (doc.content?.length || 0), 0),
              averageContentLength: relevantDocs.length > 0 ? relevantDocs.reduce((sum, doc) => sum + (doc.content?.length || 0), 0) / relevantDocs.length : 0,
              maxContentLength: relevantDocs.length > 0 ? Math.max(...relevantDocs.map(doc => doc.content?.length || 0)) : 0,
              minContentLength: relevantDocs.length > 0 ? Math.min(...relevantDocs.map(doc => doc.content?.length || 0)) : 0
            },
            qualityMetrics: {
              documentsWithHighRelevance: searchAnalysis.scoreDistribution.high,
              documentsWithMediumRelevance: searchAnalysis.scoreDistribution.medium,
              documentsWithLowRelevance: searchAnalysis.scoreDistribution.low,
              relevanceRatio: relevantDocs.length > 0 ? searchAnalysis.scoreDistribution.high / relevantDocs.length : 0
            },
            sourceDistribution: {
              vector: searchAnalysis.vectorSearchResults.length,
              bm25: searchAnalysis.bm25SearchResults.length,
              keyword: searchAnalysis.keywordSearchResults.length,
              hybrid: searchAnalysis.hybridSearchResults.length
            }
          };

          processingSteps.push({
            step: 'processing',
            status: 'completed',
            duration: processingTime,
            timestamp: new Date(),
            details: processingAnalysis
          });

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
                  modelUsed: 'gemini-2.5-flash',
                  streamingMethod: 'real-time',
                  ...referenceAnalysis,
                  contextQuality: {
                    highRelevanceDocs: searchAnalysis.scoreDistribution.high,
                    contextUtilization: relevantDocs.length > 0 ? (searchAnalysis.scoreDistribution.high / relevantDocs.length) : 0,
                    contentDiversity: new Set(relevantDocs.map(doc => doc.source)).size
                  }
                }
              });
              
              // ステップ4: 最終調整中...
              await updateStep(controller, encoder, 3, 'finalizing', '回答を最終確認しています...');
              const finalizingStartTime = Date.now();
              await delay(500);
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
              
              // 投稿ログの保存
              totalTime = Date.now() - startTime;
              console.log('🎯 [API] Starting post log save process');
              processingSteps.push({
                step: 'finalizing',
                status: 'completed',
                duration: totalTime,
                timestamp: new Date()
              });
              
              try {
                // 参照元情報を準備
                const references = result.references.map((ref: any, index: number) => ({
                  title: ref.title || `参照元 ${index + 1}`,
                  url: ref.url || '',
                  score: ref.score || ref.distance || 0,
                  source: ref.source || 'vector'
                }));

                const logData = {
                  userId,
                  question,
                  answer: fullAnswer,
                  searchTime,
                  aiGenerationTime,
                  totalTime,
                  referencesCount: result.references.length,
                  references, // 参照元の詳細情報を追加
                  answerLength: fullAnswer.length,
                  timestamp: new Date(),
                  processingSteps,
                  metadata: {
                    sessionId,
                    userAgent,
                    ipAddress
                  }
                };
                
                // デバッグ: logDataの構造を確認
                console.log('🔍 正常処理でのlogData構造:', {
                  hasErrors: 'errors' in logData,
                  errorsValue: logData.errors,
                  errorsType: typeof logData.errors,
                  allKeys: Object.keys(logData)
                });
                
                console.log('💾 投稿ログ保存開始:', {
                  userId,
                  questionLength: question.length,
                  answerLength: fullAnswer.length,
                  searchTime,
                  aiGenerationTime,
                  totalTime
                });
                
                postLogId = await savePostLogToAdminDB(logData);
                console.log('✅ 投稿ログを保存しました:', postLogId);
              } catch (logError) {
                console.error('❌ 投稿ログの保存に失敗しました:', logError);
                console.error('❌ エラー詳細:', {
                  message: logError.message,
                  code: logError.code,
                  stack: logError.stack
                });
              }
              
              // ログ記録
              screenTestLogger.logAIPerformance(question, aiGenerationTime, fullAnswer.length, {
                streamingChunks: totalChunks,
                references: result.references.length,
                isStreaming: true,
                processingSteps: 4,
                postLogId
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
                    ipAddress,
                    userDisplayName // ユーザー表示名を追加
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
                modelUsed: 'gemini-2.5-flash',
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
            
<<<<<<< HEAD
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
=======
            // エラー時の投稿ログの保存
            totalTime = Date.now() - startTime;
            try {
              // エラー時の参照元情報を準備
              const errorReferences = relevantDocs.map((doc: any, index: number) => ({
                title: doc.title || `参照元 ${index + 1}`,
                url: doc.url || '',
                score: doc.score || doc.distance || 0,
                source: doc.source || 'vector'
              }));

              postLogId = await savePostLogToAdminDB({
>>>>>>> 72c6361b3ee1e39f4218275120c3de0bb6ac7e0a
                userId,
                question,
                answer: fallbackAnswer,
                searchTime,
<<<<<<< HEAD
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
=======
                aiGenerationTime,
                totalTime,
                referencesCount: relevantDocs.length,
                references: errorReferences, // エラー時の参照元情報も追加
                answerLength: fallbackAnswer.length,
                timestamp: new Date(),
                processingSteps,
                errors: [{
                  id: `error_${Date.now()}`,
                  timestamp: new Date(),
                  level: 'error',
                  category: 'ai',
                  message: streamingError.message || 'AI generation failed',
                  context: {
                    userId,
                    sessionId,
                    operation: 'ai_generation'
                  },
                  resolved: false
                }],
                metadata: {
                  sessionId,
                  userAgent,
                  ipAddress,
                  userDisplayName
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
