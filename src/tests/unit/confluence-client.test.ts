import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConfluenceServerInfo, getAllSpaceContent } from '@/lib/confluence-client';

// モックフェッチの作成
global.fetch = vi.fn();

describe('Confluence Client', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // 環境変数のモック
    process.env.CONFLUENCE_BASE_URL = 'https://test.atlassian.net';
    process.env.CONFLUENCE_USER_EMAIL = 'test@example.com';
    process.env.CONFLUENCE_API_TOKEN = 'test-token';
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('getConfluenceServerInfo', () => {
    it('should fetch server info successfully', async () => {
      const mockResponse = {
        cloudId: 'test-cloud-id',
        baseUrl: 'https://test.atlassian.net/wiki',
        siteTitle: 'Test Confluence',
        defaultLocale: 'en_US'
      };
      
      // モックレスポンスの設定
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json'
        },
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      });
      
      const result = await getConfluenceServerInfo();
      
      // 正しいURLとヘッダーでリクエストされたか確認
      expect(fetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/wiki/rest/api/settings/systemInfo',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.any(String),
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          })
        })
      );
      
      expect(result).toEqual(mockResponse);
    });
    
    it('should throw an error when API request fails', async () => {
      // エラーレスポンスのモック
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });
      
      await expect(getConfluenceServerInfo()).rejects.toThrow(/Confluence API request failed/);
    });
    
    it('should throw an error when environment variables are missing', async () => {
      // 環境変数を削除
      delete process.env.CONFLUENCE_BASE_URL;
      
      await expect(getConfluenceServerInfo()).rejects.toThrow(/environment variables are missing/);
    });
  });
  
  describe('getAllSpaceContent', () => {
    it('should fetch all space content successfully', async () => {
      const mockResponse = {
        results: [
          { id: '1', title: 'Page 1', body: { storage: { value: '<p>Content 1</p>' } } },
          { id: '2', title: 'Page 2', body: { storage: { value: '<p>Content 2</p>' } } },
          { id: '3', title: 'Page 3', body: { storage: { value: '<p>Content 3</p>' } } }
        ],
        size: 3,
        _links: {}
      };
      
      // モックレスポンスの設定
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      });
      
      const result = await getAllSpaceContent('TEST');
      
      // 正しいURLでリクエストされたか確認
      expect(fetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/wiki/rest/api/content?spaceKey=TEST&type=page&limit=25&start=0&expand=body.storage,version,metadata.labels',
        expect.anything()
      );
      
      // リクエストが1回呼ばれたことを確認
      expect(fetch).toHaveBeenCalledTimes(1);
      
      // 結果の確認
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
      expect(result[2].id).toBe('3');
    });
  });
});
