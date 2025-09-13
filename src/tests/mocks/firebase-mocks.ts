// Firebase関連のモック

import { mockMessages, mockChatHistory } from './chat-data';
import { Message } from '@/types';

// Firestoreのモック
export const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({
    docs: mockMessages.map(msg => ({
      id: msg.id,
      data: () => msg
    }))
  }),
  add: jest.fn().mockResolvedValue({ id: 'new-message-id' }),
  set: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({})
};

// チャットサービスのモック
export const mockChatService = {
  getMessages: jest.fn().mockResolvedValue(mockMessages),
  addMessage: jest.fn().mockImplementation((userId: string, message: Omit<Message, 'id' | 'createdAt'>) => {
    return Promise.resolve({
      ...message,
      id: 'new-message-id',
      createdAt: new Date().toISOString(),
      userId
    });
  }),
  addMessageBatch: jest.fn().mockResolvedValue(true),
  getChatHistory: jest.fn().mockResolvedValue(mockChatHistory)
};

// Vertex AI / RAG関連のモック
export const mockRAGService = {
  retrieveRelevantDocs: jest.fn().mockResolvedValue([
    {
      id: 'doc-1',
      title: '[PROJ-123] 求人詳細画面仕様書',
      content: '求人詳細画面は、求職者に求人情報を詳細に伝えるための重要な画面です。...',
      url: 'https://example.atlassian.net/wiki/spaces/PROJ/pages/123456/job-detail-spec'
    },
    {
      id: 'doc-2',
      title: '[ARCH-45] 求人データモデル定義',
      content: '求人データは以下のフィールドで構成されています：id, title, company, location, salary, ...',
      url: 'https://example.atlassian.net/wiki/spaces/ARCH/pages/45678/job-data-model'
    }
  ]),
  summarizeConfluenceDocs: jest.fn().mockResolvedValue({
    summary: '求人詳細機能は、主に以下の3つの主要コンポーネントで構成されています：\n\n1. 求人情報の表示エリア\n2. 応募ボタンと関連アクション\n3. 関連求人の表示セクション',
    sources: [
      {
        title: '[PROJ-123] 求人詳細画面仕様書',
        url: 'https://example.atlassian.net/wiki/spaces/PROJ/pages/123456/job-detail-spec'
      },
      {
        title: '[ARCH-45] 求人データモデル定義',
        url: 'https://example.atlassian.net/wiki/spaces/ARCH/pages/45678/job-data-model'
      }
    ]
  })
};
