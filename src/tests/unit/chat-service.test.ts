import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMessages, addMessage, addMessageBatch } from '@/lib/chat-service';
import { Timestamp } from 'firebase/firestore';

// Firestoreのモック
vi.mock('firebase/firestore', () => {
  const actualFirestore = vi.importActual('firebase/firestore');
  return {
    ...actualFirestore,
    getFirestore: vi.fn().mockReturnValue('mocked-firestore'),
    collection: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
    writeBatch: vi.fn(),
    doc: vi.fn(),
    Timestamp: {
      now: () => 'mocked-timestamp'
    }
  };
});

// Firebaseアプリのモック
vi.mock('@/lib/firebase', () => ({
  app: {}
}));

import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  addDoc,
  writeBatch,
  doc
} from 'firebase/firestore';

describe('Chat Service', () => {
  const mockUserId = 'test-user-123';
  
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('getMessages', () => {
    it('should fetch messages for a user', async () => {
      // モックデータの設定
      const mockMessages = [
        {
          id: 'msg1',
          data: () => ({
            role: 'user',
            content: 'テスト質問',
            createdAt: { toDate: () => new Date('2023-01-01') }
          })
        },
        {
          id: 'msg2',
          data: () => ({
            role: 'assistant',
            content: 'テスト回答',
            createdAt: { toDate: () => new Date('2023-01-01') }
          })
        }
      ];
      
      // モック関数の設定
      (collection as any).mockReturnValue('messages-collection');
      (query as any).mockReturnValue('messages-query');
      (orderBy as any).mockReturnValue('ordered-query');
      (getDocs as any).mockResolvedValue({
        docs: mockMessages
      });
      
      const result = await getMessages(mockUserId);
      
      // 正しいコレクションとクエリが使用されたか確認
      expect(collection).toHaveBeenCalledWith(expect.anything(), 'chats', mockUserId, 'messages');
      expect(query).toHaveBeenCalledWith('messages-collection', 'ordered-query');
      expect(getDocs).toHaveBeenCalledWith('messages-query');
      
      // 結果の確認
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg1');
      expect(result[0].role).toBe('user');
      expect(result[1].id).toBe('msg2');
      expect(result[1].role).toBe('assistant');
    });
  });
  
  describe('addMessage', () => {
    it('should add a message for a user', async () => {
      // モック関数の設定
      (collection as any).mockReturnValue('messages-collection');
      
      const mockMessage = {
        role: 'user',
        content: 'テスト質問'
      };
      
      await addMessage(mockUserId, mockMessage);
      
      // 正しいコレクションが使用されたか確認
      expect(collection).toHaveBeenCalledWith(expect.anything(), 'chats', mockUserId, 'messages');
      
      // addDocが正しく呼び出されたか確認
      expect(addDoc).toHaveBeenCalledWith('messages-collection', {
        ...mockMessage,
        createdAt: 'mocked-timestamp'
      });
    });
  });
  
  describe('addMessageBatch', () => {
    it('should add multiple messages in a batch', async () => {
      // モックオブジェクトの設定
      const mockBatch = {
        set: vi.fn(),
        commit: vi.fn()
      };
      (writeBatch as any).mockReturnValue(mockBatch);
      (collection as any).mockReturnValue('messages-collection');
      (doc as any).mockReturnValue('doc-ref');
      
      const mockMessages = [
        {
          role: 'user',
          content: 'テスト質問'
        },
        {
          role: 'assistant',
          content: 'テスト回答'
        }
      ];
      
      await addMessageBatch(mockUserId, mockMessages);
      
      // バッチが正しく使用されたか確認
      expect(writeBatch).toHaveBeenCalled();
      expect(collection).toHaveBeenCalledWith(expect.anything(), 'chats', mockUserId, 'messages');
      expect(doc).toHaveBeenCalledTimes(2);
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });
});
