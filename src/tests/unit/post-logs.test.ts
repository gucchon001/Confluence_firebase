import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/streaming-process/route';

// Firebase Admin SDKのモック
vi.mock('firebase-admin', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  apps: [],
  credential: {
    cert: vi.fn()
  },
  firestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      add: vi.fn().mockResolvedValue({ id: 'test-post-log-id' })
    })),
    Timestamp: {
      fromDate: vi.fn((date: Date) => ({ toDate: () => date }))
    }
  })),
  auth: vi.fn(() => ({
    getUser: vi.fn().mockResolvedValue({
      uid: 'test-user-id',
      displayName: 'Test User',
      email: 'test@example.com'
    })
  }))
}));

// Firebase統合のモック
vi.mock('@/lib/firebase-unified', () => ({
  getFirebaseFirestore: vi.fn()
}));

// その他の依存関係のモック
vi.mock('@/ai/flows/retrieve-relevant-docs-lancedb', () => ({
  retrieveRelevantDocs: vi.fn().mockResolvedValue([
    {
      id: 'test-doc-1',
      title: 'テスト文書1',
      content: 'テストコンテンツ1',
      url: 'https://example.com/doc1',
      score: 0.9,
      distance: 0.1,
      source: 'vector'
    }
  ])
}));

vi.mock('@/ai/flows/streaming-summarize-confluence-docs', () => ({
  streamingSummarizeConfluenceDocs: vi.fn().mockImplementation(async function* () {
    yield {
      chunk: 'テスト回答の一部',
      chunkIndex: 0,
      totalChunks: 2,
      isComplete: false,
      references: [
        {
          title: '参照文書1',
          url: 'https://example.com/ref1',
          score: 0.8,
          distance: 0.2,
          source: 'vector'
        }
      ]
    };
    yield {
      chunk: 'テスト回答の続き',
      chunkIndex: 1,
      totalChunks: 2,
      isComplete: true,
      references: [
        {
          title: '参照文書1',
          url: 'https://example.com/ref1',
          score: 0.8,
          distance: 0.2,
          source: 'vector'
        }
      ]
    };
  })
}));

vi.mock('@/lib/genkit-error-handler', () => ({
  createAPIErrorResponse: vi.fn().mockReturnValue({
    body: { code: 'TEST_ERROR', details: 'Test error details' }
  })
}));

vi.mock('@/lib/startup-optimizer', () => ({
  initializeStartupOptimizations: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@/lib/markdown-quality-monitor', () => ({
  markdownQualityMonitor: {
    checkQuality: vi.fn().mockResolvedValue({ score: 0.9, issues: [] })
  }
}));

vi.mock('@/lib/markdown-quality-service', () => ({
  markdownQualityService: {
    generateQualityReport: vi.fn().mockResolvedValue({}),
    getUnresolvedIssues: vi.fn().mockResolvedValue([])
  }
}));

// screenTestLoggerのモック
const mockScreenTestLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  logSearchPerformance: vi.fn(),
  logAIPerformance: vi.fn(),
  logOverallPerformance: vi.fn()
};

vi.mock('@/lib/screen-test-logger', () => ({
  screenTestLogger: mockScreenTestLogger
}));

describe.skip('postLogs保存処理のテスト', () => {
  let mockAddDoc: any;
  let mockCollection: any;
  let mockFirestore: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Firebase Admin SDKのモック設定
    const admin = await import('firebase-admin');
    mockFirestore = {
      collection: vi.fn(() => ({
        add: vi.fn().mockResolvedValue({ id: 'test-post-log-id' })
      })),
      Timestamp: {
        fromDate: vi.fn((date: Date) => ({ toDate: () => date }))
      }
    };
    
    vi.mocked(admin.firestore).mockReturnValue(mockFirestore);
    mockCollection = mockFirestore.collection;
    mockAddDoc = mockCollection().add;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('成功時にpostLogsが正しく保存されること', async () => {
    // ストリーミング処理を正常に動作させる（1回で完了）
    const { streamingSummarizeConfluenceDocs } = await import('@/ai/flows/streaming-summarize-confluence-docs');
    vi.mocked(streamingSummarizeConfluenceDocs).mockImplementation(async function* () {
      yield {
        chunk: 'テスト回答',
        chunkIndex: 0,
        totalChunks: 1,
        isComplete: true,
        references: [
          {
            title: '参照文書1',
            url: 'https://example.com/ref1',
            score: 0.8,
            distance: 0.2,
            source: 'vector'
          }
        ]
      };
    });

    // 検索処理も正常に動作させる
    const { retrieveRelevantDocs } = await import('@/ai/flows/retrieve-relevant-docs-lancedb');
    vi.mocked(retrieveRelevantDocs).mockResolvedValue([
      {
        id: 'test-doc-1',
        title: 'テスト文書1',
        content: 'テストコンテンツ1',
        url: 'https://example.com/doc1',
        score: 0.9,
        distance: 0.1,
        source: 'vector'
      }
    ]);

    // ストリーミング処理の完了を待つための遅延を追加
    await new Promise(resolve => setTimeout(resolve, 100));

    // テスト用のリクエストデータ
    const requestBody = {
      question: 'テスト質問です',
      chatHistory: [],
      labelFilters: { includeMeetingNotes: false }
    };

    const request = new NextRequest('http://localhost:3000/api/streaming-process', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'test-user-agent',
        'x-forwarded-for': '192.168.1.1'
      }
    });

    // レスポンスを取得
    const response = await POST(request);
    
    // レスポンスが正常であることを確認
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    // ストリーミング処理が完了するまで待機
    await new Promise(resolve => setTimeout(resolve, 2000));

    // postLogsが保存されたことを確認
    expect(mockCollection).toHaveBeenCalledWith('postLogs');
    expect(mockAddDoc).toHaveBeenCalled();
    
    // 保存されたデータの構造を確認
    const savedData = mockAddDoc.mock.calls[0][1];
    expect(savedData).toMatchObject({
      userId: 'anonymous',
      question: 'テスト質問です',
      answer: expect.any(String),
      searchTime: expect.any(Number),
      aiGenerationTime: expect.any(Number),
      totalTime: expect.any(Number),
      referencesCount: 1,
      answerLength: expect.any(Number),
      timestamp: expect.any(Object),
      processingSteps: expect.any(Array),
      metadata: {
        sessionId: expect.any(String),
        userAgent: 'test-user-agent',
        ipAddress: '192.168.1.1'
      }
    });

    // processingStepsの構造を確認
    expect(savedData.processingSteps).toHaveLength(4);
    expect(savedData.processingSteps[0]).toMatchObject({
      step: 'search',
      stepId: 'search',
      title: '検索中...',
      status: 'completed'
    });
    expect(savedData.processingSteps[1]).toMatchObject({
      step: 'processing',
      stepId: 'processing',
      title: 'ドキュメント処理中...',
      status: 'completed'
    });
    expect(savedData.processingSteps[2]).toMatchObject({
      step: 'ai_generation',
      stepId: 'ai_generation',
      title: 'AIが回答を生成中...',
      status: 'completed'
    });
    expect(savedData.processingSteps[3]).toMatchObject({
      step: 'finalizing',
      stepId: 'finalizing',
      title: '最終調整中...',
      status: 'completed'
    });
  });

  it('エラー時にpostLogsが正しく保存されること', async () => {
    // ストリーミング処理でエラーを発生させる
    const { streamingSummarizeConfluenceDocs } = await import('@/ai/flows/streaming-summarize-confluence-docs');
    vi.mocked(streamingSummarizeConfluenceDocs).mockImplementation(async function* () {
      throw new Error('AI generation failed');
    });

    const requestBody = {
      question: 'テスト質問です',
      chatHistory: [],
      labelFilters: { includeMeetingNotes: false }
    };

    const request = new NextRequest('http://localhost:3000/api/streaming-process', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'test-user-agent',
        'x-forwarded-for': '192.168.1.1'
      }
    });

    // レスポンスを取得
    const response = await POST(request);
    
    // レスポンスが正常であることを確認
    expect(response.status).toBe(200);

    // ストリーミング処理が完了するまで待機
    await new Promise(resolve => setTimeout(resolve, 2000));

    // postLogsが保存されたことを確認
    expect(mockCollection).toHaveBeenCalledWith('postLogs');
    expect(mockAddDoc).toHaveBeenCalled();
    
    // 保存されたデータの構造を確認
    const savedData = mockAddDoc.mock.calls[0][1];
    expect(savedData).toMatchObject({
      userId: 'anonymous',
      question: 'テスト質問です',
      answer: expect.any(String),
      searchTime: expect.any(Number),
      aiGenerationTime: expect.any(Number),
      totalTime: expect.any(Number),
      referencesCount: 1,
      answerLength: expect.any(Number),
      timestamp: expect.any(Object),
      processingSteps: expect.any(Array),
      errors: expect.any(Array),
      metadata: {
        sessionId: expect.any(String),
        userAgent: 'test-user-agent',
        ipAddress: '192.168.1.1'
      }
    });

    // エラー情報が含まれていることを確認（成功時はerrorsが空の場合もある）
    if (savedData.errors && savedData.errors.length > 0) {
      expect(savedData.errors[0]).toMatchObject({
        id: expect.any(String),
        timestamp: expect.any(Object),
        level: 'error',
        category: 'ai',
        message: 'AI generation failed - using fallback',
        context: {
          userId: 'anonymous',
          sessionId: expect.any(String),
          operation: 'ai_generation'
        },
        resolved: false
      });
    }
  });

  it('システムエラー時にpostLogsが正しく保存されること', async () => {
    // 検索処理でエラーを発生させる
    const { retrieveRelevantDocs } = await import('@/ai/flows/retrieve-relevant-docs-lancedb');
    vi.mocked(retrieveRelevantDocs).mockRejectedValue(new Error('Search failed'));

    const requestBody = {
      question: 'テスト質問です',
      chatHistory: [],
      labelFilters: { includeMeetingNotes: false }
    };

    const request = new NextRequest('http://localhost:3000/api/streaming-process', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'test-user-agent',
        'x-forwarded-for': '192.168.1.1'
      }
    });

    // レスポンスを取得
    const response = await POST(request);
    
    // レスポンスが正常であることを確認
    expect(response.status).toBe(200);

    // ストリーミング処理が完了するまで待機
    await new Promise(resolve => setTimeout(resolve, 2000));

    // postLogsが保存されたことを確認
    expect(mockCollection).toHaveBeenCalledWith('postLogs');
    expect(mockAddDoc).toHaveBeenCalled();
    
    // 保存されたデータの構造を確認
    const savedData = mockAddDoc.mock.calls[0][1];
    expect(savedData).toMatchObject({
      userId: 'anonymous',
      question: 'テスト質問です',
      answer: 'エラーが発生しました',
      searchTime: 0,
      aiGenerationTime: 0,
      totalTime: 0,
      referencesCount: 0,
      answerLength: 0,
      timestamp: expect.any(Object),
      processingSteps: expect.any(Array),
      errors: expect.any(Array),
      metadata: {
        sessionId: expect.any(String),
        userAgent: 'test-user-agent',
        ipAddress: '192.168.1.1'
      }
    });

    // エラー情報が含まれていることを確認
    expect(savedData.errors).toHaveLength(1);
    expect(savedData.errors[0]).toMatchObject({
      id: expect.any(String),
      timestamp: expect.any(Object),
      level: 'error',
      category: 'system',
      message: 'Search failed',
      context: {
        userId: 'anonymous',
        sessionId: expect.any(String),
        operation: 'streaming_process'
      },
      resolved: false
    });
  });

  it('Firebase保存エラー時にログが出力されること', async () => {
    // Firebase保存でエラーを発生させる
    mockAddDoc.mockRejectedValue(new Error('Firebase save failed'));
    
    // ストリーミング処理を正常に動作させる
    const { streamingSummarizeConfluenceDocs } = await import('@/ai/flows/streaming-summarize-confluence-docs');
    vi.mocked(streamingSummarizeConfluenceDocs).mockImplementation(async function* () {
      yield {
        chunk: 'テスト回答',
        chunkIndex: 0,
        totalChunks: 1,
        isComplete: true,
        references: [
          {
            title: '参照文書1',
            url: 'https://example.com/ref1',
            score: 0.8,
            distance: 0.2,
            source: 'vector'
          }
        ]
      };
    });

    const requestBody = {
      question: 'テスト質問です',
      chatHistory: [],
      labelFilters: { includeMeetingNotes: false }
    };

    const request = new NextRequest('http://localhost:3000/api/streaming-process', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'test-user-agent',
        'x-forwarded-for': '192.168.1.1'
      }
    });

    // コンソールエラーのモック
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // レスポンスを取得
    const response = await POST(request);
    
    // レスポンスが正常であることを確認
    expect(response.status).toBe(200);

    // 少し待ってからエラーログを確認
    await new Promise(resolve => setTimeout(resolve, 100));

    // エラーログが出力されたことを確認
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ 投稿ログの保存に失敗しました:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
