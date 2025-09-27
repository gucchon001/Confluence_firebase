/**
 * ストリーミング要約API
 * Server-Sent Events (SSE) を使用してリアルタイムで回答を配信
 */

import { NextRequest, NextResponse } from 'next/server';
import { streamingSummarizeConfluenceDocs } from '@/ai/flows/streaming-summarize-confluence-docs';
import { retrieveRelevantDocs } from '@/ai/flows/retrieve-relevant-docs-lancedb';
import { screenTestLogger } from '@/lib/screen-test-logger';

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { question, chatHistory = [], labelFilters = { includeMeetingNotes: false } } = body;

    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }

    console.log('🌊 ストリーミング要約API開始:', question);
    screenTestLogger.info('ai', `Streaming AI request: "${question}"`, { 
      chatHistoryLength: chatHistory.length,
      labelFilters 
    });

    // 関連文書を取得
    const relevantDocs = await retrieveRelevantDocs({
      question,
      labels: [],
      labelFilters
    });

    console.log(`📚 関連文書取得完了: ${relevantDocs.length}件`);
    screenTestLogger.info('search', `Retrieved ${relevantDocs.length} relevant documents for streaming`);

    // ストリーミング応答の設定
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let chunkIndex = 0;
          let totalChunks = 0;
          let fullAnswer = '';

          // ストリーミング要約の実行
          for await (const result of streamingSummarizeConfluenceDocs({
            question,
            context: relevantDocs,
            chatHistory
          })) {
            
            if (result.isComplete) {
              totalChunks = result.chunkIndex;
              
              // 完了メッセージ
              const completionMessage = {
                type: 'completion',
                chunkIndex: result.chunkIndex,
                totalChunks: result.totalChunks,
                references: result.references,
                fullAnswer: fullAnswer.trim()
              };
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(completionMessage)}\n\n`)
              );
              
              // ログ記録
              screenTestLogger.logAIPerformance(question, performance.now(), fullAnswer.length, {
                streamingChunks: totalChunks,
                references: result.references.length,
                isStreaming: true
              });
              
              break;
            } else {
              // チャンクメッセージ
              const chunkMessage = {
                type: 'chunk',
                chunk: result.chunk,
                chunkIndex: result.chunkIndex,
                isComplete: false,
                references: result.references
              };
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunkMessage)}\n\n`)
              );
              
              fullAnswer += result.chunk;
              chunkIndex = result.chunkIndex;
            }
          }
          
          controller.close();
          
        } catch (error) {
          console.error('❌ ストリーミング要約エラー:', error);
          
          const errorMessage = {
            type: 'error',
            error: 'Streaming summarization failed',
            message: error instanceof Error ? error.message : 'Unknown error'
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
    console.error('❌ ストリーミング要約APIエラー:', error);
    
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
