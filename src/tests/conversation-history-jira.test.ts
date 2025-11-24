/**
 * Jira検索時の会話履歴管理テスト
 * 
 * テスト項目:
 * 1. Jira検索時に会話履歴が保存されること
 * 2. issue_keyが正しく保存されること
 * 3. dataSourceが'jira'として保存されること
 * 4. 会話履歴からJira検索結果を再表示できること
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  createConversation, 
  addMessageToConversation, 
  getConversation,
  getConversations,
  deleteConversation
} from '@/lib/conversation-service';

// テスト用のユーザーID
const TEST_USER_ID = 'test-user-jira-conversation';

describe('Jira検索時の会話履歴管理', () => {
  let conversationId: string | null = null;

  afterAll(async () => {
    // テスト後に会話を削除
    if (conversationId) {
      try {
        await deleteConversation(TEST_USER_ID, conversationId);
      } catch (error) {
        console.warn('Failed to delete test conversation:', error);
      }
    }
  });

  it('Jira検索時に会話履歴が保存されること', async () => {
    // 1. 新しい会話を作成
    const userMessage = {
      role: 'user' as const,
      content: 'Jiraの課題を検索したい',
      user: {
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg'
      }
    };

    conversationId = await createConversation(TEST_USER_ID, userMessage);
    expect(conversationId).toBeTruthy();

    // 2. Jira検索結果を含むアシスタントメッセージを追加
    const assistantMessage = {
      role: 'assistant' as const,
      content: 'Jiraの課題を検索しました。以下の課題が見つかりました。',
      sources: [
        {
          title: 'CTJ-1234: 応募移管機能の開発',
          url: 'https://giginc.atlassian.net/browse/CTJ-1234',
          distance: 0.5,
          source: 'vector',
          dataSource: 'jira' as const,
          issue_key: 'CTJ-1234'
        },
        {
          title: 'CTJ-5678: ログイン機能の改善',
          url: 'https://giginc.atlassian.net/browse/CTJ-5678',
          distance: 0.6,
          source: 'bm25',
          dataSource: 'jira' as const,
          issue_key: 'CTJ-5678'
        }
      ]
    };

    await addMessageToConversation(TEST_USER_ID, conversationId, assistantMessage);

    // 3. 会話を取得して確認
    const conversation = await getConversation(TEST_USER_ID, conversationId);
    expect(conversation).toBeTruthy();
    expect(conversation.messages.length).toBe(2); // ユーザーメッセージ + アシスタントメッセージ

    const savedAssistantMessage = conversation.messages.find(m => m.role === 'assistant');
    expect(savedAssistantMessage).toBeTruthy();
    expect(savedAssistantMessage?.sources).toBeTruthy();
    expect(savedAssistantMessage?.sources?.length).toBe(2);
  });

  it('issue_keyが正しく保存されること', async () => {
    if (!conversationId) {
      throw new Error('Conversation ID is not set');
    }

    const conversation = await getConversation(TEST_USER_ID, conversationId);
    const assistantMessage = conversation.messages.find(m => m.role === 'assistant');
    
    expect(assistantMessage?.sources).toBeTruthy();
    
    // issue_keyが保存されていることを確認
    const sources = assistantMessage?.sources || [];
    expect(sources.length).toBeGreaterThan(0);
    
    sources.forEach((source: any) => {
      expect(source.issue_key).toBeTruthy();
      expect(typeof source.issue_key).toBe('string');
      expect(source.issue_key).toMatch(/^CTJ-\d+$/); // CTJ-XXXX形式
    });
  });

  it('dataSourceが"jira"として保存されること', async () => {
    if (!conversationId) {
      throw new Error('Conversation ID is not set');
    }

    const conversation = await getConversation(TEST_USER_ID, conversationId);
    const assistantMessage = conversation.messages.find(m => m.role === 'assistant');
    
    expect(assistantMessage?.sources).toBeTruthy();
    
    // dataSourceが'jira'として保存されていることを確認
    const sources = assistantMessage?.sources || [];
    expect(sources.length).toBeGreaterThan(0);
    
    sources.forEach((source: any) => {
      expect(source.dataSource).toBe('jira');
    });
  });

  it('会話一覧でdataSourceが正しく表示されること', async () => {
    const result = await getConversations(TEST_USER_ID, 10);
    
    // テストで作成した会話が含まれていることを確認
    const testConversation = result.conversations.find(c => c.id === conversationId);
    expect(testConversation).toBeTruthy();
    
    // dataSourceが'jira'として設定されていることを確認
    expect(testConversation?.dataSource).toBe('jira');
  });

  it('会話履歴からJira検索結果を再表示できること', async () => {
    if (!conversationId) {
      throw new Error('Conversation ID is not set');
    }

    const conversation = await getConversation(TEST_USER_ID, conversationId);
    const assistantMessage = conversation.messages.find(m => m.role === 'assistant');
    
    expect(assistantMessage).toBeTruthy();
    expect(assistantMessage?.sources).toBeTruthy();
    
    // 再表示に必要な情報がすべて含まれていることを確認
    const sources = assistantMessage?.sources || [];
    sources.forEach((source: any) => {
      expect(source.title).toBeTruthy();
      expect(source.url).toBeTruthy();
      expect(source.issue_key).toBeTruthy();
      expect(source.dataSource).toBe('jira');
    });
  });

  it('ConfluenceとJiraの混合検索結果が正しく保存されること', async () => {
    // 混合検索結果を含む会話を作成
    const mixedConversationId = await createConversation(TEST_USER_ID, {
      role: 'user' as const,
      content: 'ConfluenceとJiraの両方を検索したい',
      user: {
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg'
      }
    });

    const mixedAssistantMessage = {
      role: 'assistant' as const,
      content: 'ConfluenceとJiraの両方の検索結果です。',
      sources: [
        {
          title: 'Confluenceページ: ログイン機能仕様',
          url: 'https://confluence.example.com/pages/viewpage.action?pageId=123456789',
          distance: 0.4,
          source: 'vector',
          dataSource: 'confluence' as const
        },
        {
          title: 'CTJ-1234: 応募移管機能の開発',
          url: 'https://giginc.atlassian.net/browse/CTJ-1234',
          distance: 0.5,
          source: 'vector',
          dataSource: 'jira' as const,
          issue_key: 'CTJ-1234'
        }
      ]
    };

    await addMessageToConversation(TEST_USER_ID, mixedConversationId, mixedAssistantMessage);

    // 会話を取得して確認
    const conversation = await getConversation(TEST_USER_ID, mixedConversationId);
    const assistantMessage = conversation.messages.find(m => m.role === 'assistant');
    
    expect(assistantMessage?.sources).toBeTruthy();
    expect(assistantMessage?.sources?.length).toBe(2);
    
    // dataSourceが正しく保存されていることを確認
    const sources = assistantMessage?.sources || [];
    const dataSources = sources.map((s: any) => s.dataSource);
    expect(dataSources).toContain('confluence');
    expect(dataSources).toContain('jira');

    // 会話一覧でdataSourceが'mixed'として表示されることを確認
    const result = await getConversations(TEST_USER_ID, 10);
    const mixedConversation = result.conversations.find(c => c.id === mixedConversationId);
    expect(mixedConversation?.dataSource).toBe('mixed');

    // クリーンアップ
    await deleteConversation(TEST_USER_ID, mixedConversationId);
  });
});

