/**
 * 差分更新ロジックのユニットテスト
 * 
 * このテストでは、差分更新に関連する個別の関数をユニットテストします。
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as admin from 'firebase-admin';
import axios from 'axios';

// テスト対象の関数をインポート
// 注意: getLastSyncTimeとgetConfluencePagesという関数は存在しません
// 差分同期機能はscripts/archive/differential-sync.tsに実装されていますが、
// テスト対象の関数（getLastSyncTime, getConfluencePages）は存在しないため、このテストは不要です
// import { getLastSyncTime, getConfluencePages } from '../../scripts/batch-sync-confluence';

// モック
vi.mock('axios');
vi.mock('firebase-admin');
vi.mock('dotenv');

describe.skip('差分更新ロジックのユニットテスト', () => {
  beforeEach(() => {
    // 環境変数のモック
    vi.spyOn(process, 'env', 'get').mockImplementation(() => ({
      CONFLUENCE_BASE_URL: 'https://example.atlassian.net',
      CONFLUENCE_USER_EMAIL: 'test@example.com',
      CONFLUENCE_API_TOKEN: 'test-token',
      CONFLUENCE_SPACE_KEY: 'TEST'
    }));

    // Firebaseのモック
    const mockFirestore = {
      collection: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false,
        docs: [{
          data: () => ({
            timestamp: {
              toDate: () => new Date('2023-01-01T00:00:00Z')
            }
          })
        }]
      })
    };

    vi.spyOn(admin, 'firestore').mockReturnValue(mockFirestore as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getLastSyncTime', () => {
    it('最後の同期時刻を正しく取得できること', async () => {
      const result = await getLastSyncTime();
      expect(result).toBe('2023-01-01T00:00:00.000Z');
    });

    it('同期履歴がない場合はnullを返すこと', async () => {
      const mockFirestore = {
        collection: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          empty: true,
          docs: []
        })
      };

      vi.spyOn(admin, 'firestore').mockReturnValue(mockFirestore as any);

      const result = await getLastSyncTime();
      expect(result).toBeNull();
    });
  });

  describe('getConfluencePages', () => {
    it('lastSyncTimeがある場合はCQLクエリを使用すること', async () => {
      // axiosのモック
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          results: [],
          size: 0,
          limit: 10,
          start: 0
        }
      });
      vi.mocked(axios.get).mockImplementation(mockGet);

      const lastSyncTime = '2023-01-01T00:00:00.000Z';
      await getConfluencePages('TEST', 0, 10, lastSyncTime);

      // CQLクエリが正しく設定されていることを確認
      expect(mockGet).toHaveBeenCalledWith(
        'https://example.atlassian.net/wiki/rest/api/content',
        expect.objectContaining({
          params: expect.objectContaining({
            cql: `lastModified >= "${lastSyncTime}" AND space = "TEST"`
          })
        })
      );
    });

    it('lastSyncTimeがない場合はCQLクエリを使用しないこと', async () => {
      // axiosのモック
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          results: [],
          size: 0,
          limit: 10,
          start: 0
        }
      });
      vi.mocked(axios.get).mockImplementation(mockGet);

      await getConfluencePages('TEST', 0, 10);

      // CQLクエリが設定されていないことを確認
      expect(mockGet).toHaveBeenCalledWith(
        'https://example.atlassian.net/wiki/rest/api/content',
        expect.objectContaining({
          params: expect.not.objectContaining({
            cql: expect.anything()
          })
        })
      );
    });
  });
});
