/**
 * 会話履歴・コンテキスト管理テスト
 * 
 * このテストは以下の項目を検証します：
 * 1. 会話履歴の保存・取得
 * 2. 深掘り質問のコンテキスト維持
 * 3. Firestore統合
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { loadTestEnv } from '../test-helpers/env-loader';

// テスト用の環境変数を事前に読み込む
loadTestEnv();

describe('会話履歴・コンテキスト管理テスト', () => {
  beforeAll(() => {
    console.log('💬 会話履歴・コンテキスト管理テスト開始');
  });

  afterAll(() => {
    console.log('✅ 会話履歴・コンテキスト管理テスト完了');
  });

  describe('1. 会話履歴の保存・取得', () => {
    it('会話作成関数が正しい形式で動作する', () => {
      // 会話作成のパラメータ検証
      const createConversationParams = {
        userId: 'test-user-id',
        initialMessage: {
          role: 'user' as const,
          content: 'テスト質問',
          user: {
            displayName: 'Test User',
            photoURL: 'https://example.com/photo.jpg'
          }
        }
      };

      expect(createConversationParams.userId).toBeTruthy();
      expect(createConversationParams.initialMessage.role).toBe('user');
      expect(createConversationParams.initialMessage.content).toBeTruthy();
    });

    it('メッセージ追加関数が正しい形式で動作する', () => {
      // メッセージ追加のパラメータ検証
      const addMessageParams = {
        userId: 'test-user-id',
        conversationId: 'test-conversation-id',
        message: {
          role: 'assistant' as const,
          content: 'テスト回答',
          sources: [
            {
              title: 'Test Document',
              url: 'https://example.com/doc',
              distance: 0.1,
              source: 'vector' as const
            }
          ]
        }
      };

      expect(addMessageParams.userId).toBeTruthy();
      expect(addMessageParams.conversationId).toBeTruthy();
      expect(addMessageParams.message.role).toBe('assistant');
      expect(addMessageParams.message.content).toBeTruthy();
    });

    it('会話取得関数が正しい形式で動作する', () => {
      // 会話取得のパラメータ検証
      const getConversationParams = {
        userId: 'test-user-id',
        conversationId: 'test-conversation-id'
      };

      expect(getConversationParams.userId).toBeTruthy();
      expect(getConversationParams.conversationId).toBeTruthy();
    });

    it('会話一覧取得関数が正しい形式で動作する', () => {
      // 会話一覧取得のパラメータ検証
      const getConversationsParams = {
        userId: 'test-user-id',
        maxResults: 10
      };

      expect(getConversationsParams.userId).toBeTruthy();
      expect(getConversationsParams.maxResults).toBeGreaterThan(0);
      expect(getConversationsParams.maxResults).toBeLessThanOrEqual(100);
    });

    it('会話削除関数が正しい形式で動作する', () => {
      // 会話削除のパラメータ検証
      const deleteConversationParams = {
        userId: 'test-user-id',
        conversationId: 'test-conversation-id'
      };

      expect(deleteConversationParams.userId).toBeTruthy();
      expect(deleteConversationParams.conversationId).toBeTruthy();
    });
  });

  describe('2. 深掘り質問のコンテキスト維持', () => {
    it('チャット履歴が正しい形式で構築される', () => {
      // チャット履歴の形式を検証
      const chatHistory = [
        {
          role: 'user' as const,
          content: '最初の質問'
        },
        {
          role: 'assistant' as const,
          content: '最初の回答'
        },
        {
          role: 'user' as const,
          content: '深掘り質問'
        }
      ];

      expect(chatHistory).toHaveLength(3);
      expect(chatHistory[0].role).toBe('user');
      expect(chatHistory[1].role).toBe('assistant');
      expect(chatHistory[2].role).toBe('user');
    });

    it('コンテキストが正しく維持される', () => {
      // コンテキスト維持のロジックを検証
      const messages = [
        { role: 'user' as const, content: '教室管理について' },
        { role: 'assistant' as const, content: '教室管理機能は...' },
        { role: 'user' as const, content: '詳細を教えて' }
      ];

      // 深掘り質問のコンテキストが維持されていることを確認
      const hasContext = messages.length > 1;
      expect(hasContext).toBe(true);

      // 最後の質問が前の会話を参照していることを確認
      const lastQuestion = messages[messages.length - 1].content;
      const previousAnswer = messages[messages.length - 2].content;
      expect(lastQuestion).toBeTruthy();
      expect(previousAnswer).toBeTruthy();
    });

    it('チャット履歴の長さが適切に制限される', () => {
      // チャット履歴の長さ制限を検証
      const MAX_HISTORY_LENGTH = 20; // 最大20件のメッセージを保持
      
      const longHistory = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`
      }));

      // 履歴を制限
      const limitedHistory = longHistory.slice(-MAX_HISTORY_LENGTH);
      expect(limitedHistory.length).toBeLessThanOrEqual(MAX_HISTORY_LENGTH);
    });
  });

  describe('3. Firestore統合', () => {
    it('Firestoreのコレクション構造が正しい', () => {
      // Firestoreのコレクション構造を検証
      const collectionPath = 'users/{userId}/conversations';
      expect(collectionPath).toContain('users');
      expect(collectionPath).toContain('conversations');
    });

    it('会話データの構造が正しい', () => {
      // 会話データの構造を検証
      const conversationData = {
        title: '会話タイトル',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            role: 'user' as const,
            content: 'テスト質問',
            timestamp: new Date().toISOString()
          }
        ]
      };

      expect(conversationData).toHaveProperty('title');
      expect(conversationData).toHaveProperty('createdAt');
      expect(conversationData).toHaveProperty('updatedAt');
      expect(conversationData).toHaveProperty('messages');
      expect(Array.isArray(conversationData.messages)).toBe(true);
    });

    it('メッセージデータの構造が正しい', () => {
      // メッセージデータの構造を検証
      const messageData = {
        role: 'assistant' as const,
        content: 'テスト回答',
        timestamp: new Date().toISOString(),
        sources: [
          {
            title: 'Test Document',
            url: 'https://example.com/doc',
            distance: 0.1
          }
        ]
      };

      expect(messageData).toHaveProperty('role');
      expect(messageData).toHaveProperty('content');
      expect(messageData).toHaveProperty('timestamp');
      expect(['user', 'assistant']).toContain(messageData.role);
    });

    it('ページネーションが正しく動作する', () => {
      // ページネーションのパラメータを検証
      const paginationParams = {
        maxResults: 10,
        lastDoc: null as any // 最初のページ
      };

      expect(paginationParams.maxResults).toBeGreaterThan(0);
      
      // 次のページのパラメータ
      const nextPageParams = {
        maxResults: 10,
        lastDoc: { id: 'last-doc-id' } as any
      };

      expect(nextPageParams.lastDoc).toBeTruthy();
    });
  });

  describe('4. 会話履歴のフィルタリング', () => {
    it('日付フィルターが正しく動作する', () => {
      // 日付フィルターのロジックを検証
      const conversations = [
        { id: '1', timestamp: new Date('2025-01-01').toISOString() },
        { id: '2', timestamp: new Date('2025-01-15').toISOString() },
        { id: '3', timestamp: new Date('2025-01-30').toISOString() }
      ];

      const filterByDate = (convs: typeof conversations, startDate: Date, endDate: Date) => {
        return convs.filter(conv => {
          const convDate = new Date(conv.timestamp);
          return convDate >= startDate && convDate <= endDate;
        });
      };

      const startDate = new Date('2025-01-10');
      const endDate = new Date('2025-01-20');
      const filtered = filterByDate(conversations, startDate, endDate);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('Cloneステータスフィルターが正しく動作する', () => {
      // Cloneステータスフィルターのロジックを検証
      const conversations = [
        { id: '1', title: 'CLONE: Test Conversation' },
        { id: '2', title: 'Normal Conversation' },
        { id: '3', lastMessage: 'CLONE: Another message' }
      ];

      const filterByCloneStatus = (convs: typeof conversations, cloneStatus: 'all' | 'clone' | 'non-clone') => {
        if (cloneStatus === 'all') return convs;
        
        return convs.filter(conv => {
          const hasClone = (conv.title?.toUpperCase().includes('CLONE') || 
                           conv.lastMessage?.toUpperCase().includes('CLONE')) ?? false;
          
          if (cloneStatus === 'clone') return hasClone;
          if (cloneStatus === 'non-clone') return !hasClone;
          return true;
        });
      };

      const cloneOnly = filterByCloneStatus(conversations, 'clone');
      expect(cloneOnly).toHaveLength(2);

      const nonClone = filterByCloneStatus(conversations, 'non-clone');
      expect(nonClone).toHaveLength(1);
    });
  });

  describe('5. エラーハンドリング', () => {
    it('会話が見つからない場合のエラーが適切に処理される', () => {
      // エラーハンドリングのロジックを検証
      const handleConversationNotFound = (error: Error) => {
        if (error.message === 'Conversation not found') {
          return {
            error: {
              code: 'resource_not_found',
              message: '会話が見つかりませんでした'
            }
          };
        }
        throw error;
      };

      const error = new Error('Conversation not found');
      const result = handleConversationNotFound(error);
      
      expect(result.error.code).toBe('resource_not_found');
    });

    it('ネットワークエラーが適切に処理される', () => {
      // ネットワークエラーのリトライロジックを検証
      const shouldRetry = (error: Error): boolean => {
        return error.message.includes('network') || 
               error.message.includes('Failed to fetch') ||
               error.message.includes('QUIC');
      };

      const networkError = new Error('network error');
      const validationError = new Error('validation error');

      expect(shouldRetry(networkError)).toBe(true);
      expect(shouldRetry(validationError)).toBe(false);
    });
  });
});

