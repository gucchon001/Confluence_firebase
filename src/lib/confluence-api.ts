interface ConfluenceAPIConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  timeout?: number;
}

interface PageSearchOptions {
  spaceKey: string;
  start: number;
  limit: number;
  includeArchived?: boolean;
  expand?: string[];
}

interface PageDetails {
  id: string;
  title: string;
  body: any;
  parentId?: string;
  parentTitle?: string;
  labels: string[];
  space: {
    key: string;
    name: string;
  };
  version: {
    when: string;
    by: {
      displayName: string;
    };
  };
  _links: {
    webui: string;
  };
}

export class ConfluenceAPI {
  private config: ConfluenceAPIConfig;
  private baseHeaders: Record<string, string>;

  constructor(config?: Partial<ConfluenceAPIConfig>) {
    this.config = {
      baseUrl: process.env.CONFLUENCE_BASE_URL || '',
      username: process.env.CONFLUENCE_USER_EMAIL || '',
      apiToken: process.env.CONFLUENCE_API_TOKEN || '',
      timeout: 30000,
      ...config
    };

    if (!this.config.baseUrl || !this.config.username || !this.config.apiToken) {
      throw new Error('Confluence API configuration is incomplete. Please set CONFLUENCE_BASE_URL, CONFLUENCE_USER_EMAIL, and CONFLUENCE_API_TOKEN environment variables.');
    }

    this.baseHeaders = {
      'Authorization': `Basic ${Buffer.from(`${this.config.username}:${this.config.apiToken}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async getSpace(spaceKey: string): Promise<{ key: string; name: string }> {
    // 既存のクライアントと同じアプローチを使用（v1 API）
    const url = `${this.config.baseUrl}/wiki/rest/api/content?spaceKey=${spaceKey}&limit=1&expand=space`;
    
    try {
      const response = await this.makeRequest(url);
      if (response.results && response.results.length > 0) {
        const space = response.results[0].space;
        return {
          key: space.key,
          name: space.name
        };
      } else {
        throw new Error(`No content found in space ${spaceKey}`);
      }
    } catch (error) {
      console.error(`[ConfluenceAPI] Failed to get space ${spaceKey}:`, error);
      throw error;
    }
  }

  async getPages(options: PageSearchOptions): Promise<PageDetails[]> {
    // 既存のクライアントと同じアプローチを使用（v1 API）
    const url = `${this.config.baseUrl}/wiki/rest/api/content`;
    const params = new URLSearchParams({
      spaceKey: options.spaceKey,
      start: options.start.toString(),
      limit: options.limit.toString(),
      expand: (options.expand || ['version', 'space', 'body.storage']).join(','),
      type: 'page',
      ...(options.includeArchived ? { status: 'current,archived' } : { status: 'current' })
    });

    try {
      const response = await this.makeRequest(`${url}?${params}`);
      return response.results || [];
    } catch (error) {
      console.error(`[ConfluenceAPI] Failed to get pages:`, error);
      throw error;
    }
  }

  async getPageDetails(pageId: string): Promise<PageDetails> {
    // 入力パラメータの型チェック
    if (!pageId || typeof pageId !== 'string') {
      throw new Error('Invalid pageId: must be a non-empty string');
    }

    const url = `${this.config.baseUrl}/wiki/rest/api/content/${pageId}`;
    const params = new URLSearchParams({
      expand: 'version,space,body.storage,ancestors,descendants,children'
    });

    try {
      const response = await this.makeRequest(`${url}?${params}`);
      
      // レスポンスの型チェック
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response: expected object');
      }
      
      // 親ページ情報を追加
      if (response.ancestors && Array.isArray(response.ancestors) && response.ancestors.length > 0) {
        const parent = response.ancestors[response.ancestors.length - 1];
        if (parent && typeof parent === 'object' && parent.id && parent.title) {
          response.parentId = parent.id;
          response.parentTitle = parent.title;
        }
      }

      return response;
    } catch (error) {
      console.error(`[ConfluenceAPI] Failed to get page details for ${pageId}:`, error);
      throw error;
    }
  }

  async searchPages(query: string, spaceKey?: string): Promise<PageDetails[]> {
    const url = `${this.config.baseUrl}/wiki/rest/api/content/search`;
    const params = new URLSearchParams({
      cql: spaceKey ? `space = ${spaceKey} AND text ~ "${query}"` : `text ~ "${query}"`,
      expand: 'version,space,body.storage',
      limit: '100'
    });

    try {
      const response = await this.makeRequest(`${url}?${params}`);
      return response.results || [];
    } catch (error) {
      console.error(`[ConfluenceAPI] Failed to search pages:`, error);
      throw error;
    }
  }

  async getPageLabels(pageId: string): Promise<string[]> {
    const url = `${this.config.baseUrl}/wiki/rest/api/content/${pageId}/label`;
    
    try {
      const response = await this.makeRequest(url);
      return response.results?.map((label: any) => label.name) || [];
    } catch (error) {
      console.error(`[ConfluenceAPI] Failed to get labels for page ${pageId}:`, error);
      return [];
    }
  }

  private async makeRequest(url: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      console.log(`[ConfluenceAPI] Making request to: ${url}`);
      console.log(`[ConfluenceAPI] Headers:`, this.baseHeaders);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.baseHeaders,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      
      throw error;
    }
  }

  // レート制限対応のリクエスト実行
  async makeRequestWithRetry(url: string, maxRetries: number = 3): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeRequest(url);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 指数バックオフ
          console.log(`[ConfluenceAPI] Request failed (attempt ${attempt}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  // バッチ処理用のヘルパー
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 10,
    delayBetweenBatches: number = 1000
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      console.log(`[ConfluenceAPI] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);
      
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      
      results.push(...batchResults);
      
      // バッチ間の遅延
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
    
    return results;
  }
}

export { type ConfluenceAPIConfig, type PageSearchOptions, type PageDetails };
