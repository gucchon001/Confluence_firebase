import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ConfluencePage } from './confluence-data-extractor';

interface ExtractedKnowledge {
  pageId: string;
  pageTitle: string;
  extractedAt: string;
  domainNames: string[];        // ドメイン名（最優先）
  functionNames: string[];      // 機能名（二次的）
  operationNames: string[];     // 操作名（三次的）
  systemFields: string[];       // システム項目・フィールド名
  systemTerms: string[];        // システム用語
  relatedKeywords: string[];    // 関連キーワード
  confidence: number;
  metadata: {
    processingTime: number;
    tokenCount: number;
    model: string;
  };
}

interface LLMExtractionConfig {
  apiKey: string;
  model: string;
  batchSize: number;
  outputDir: string;
  maxRetries: number;
  delayBetweenRequests: number;
}

interface ProcessingStats {
  totalPages: number;
  processedPages: number;
  successfulExtractions: number;
  failedExtractions: number;
  averageConfidence: number;
  totalProcessingTime: number;
  startTime: string;
  endTime?: string;
}

export class LLMKnowledgeExtractorV2 {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private config: LLMExtractionConfig;
  private cache: Map<string, ExtractedKnowledge> = new Map(); // キャッシュシステム

  constructor(config: LLMExtractionConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: config.model });
  }

  async extractFromPages(pages: ConfluencePage[]): Promise<ExtractedKnowledge[]> {
    console.log(`[LLMKnowledgeExtractorV2] Starting extraction from ${pages.length} pages`);
    
    const stats: ProcessingStats = {
      totalPages: pages.length,
      processedPages: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      averageConfidence: 0,
      totalProcessingTime: 0,
      startTime: new Date().toISOString()
    };

    const results: ExtractedKnowledge[] = [];
    const startTime = Date.now();

    // バッチ処理
    for (let i = 0; i < pages.length; i += this.config.batchSize) {
      const batch = pages.slice(i, i + this.config.batchSize);
      const batchNumber = Math.floor(i / this.config.batchSize) + 1;
      const totalBatches = Math.ceil(pages.length / this.config.batchSize);
      const progress = Math.round((i / pages.length) * 100);
      const estimatedTimeRemaining = Math.round(((pages.length - i) * 800) / 1000); // 0.8秒/ページで推定
      console.log(`[LLMKnowledgeExtractorV2] Processing batch ${batchNumber}/${totalBatches} (${progress}% complete) - 残り時間: ${estimatedTimeRemaining}秒`);

      const batchResults = await this.processBatch(batch, stats);
      results.push(...batchResults);

      // バッチ間の遅延
      if (i + this.config.batchSize < pages.length) {
        await this.delay(this.config.delayBetweenRequests);
      }
    }

    stats.endTime = new Date().toISOString();
    stats.totalProcessingTime = Date.now() - startTime;
    stats.averageConfidence = this.calculateAverageConfidence(results);

    // 結果の保存
    await this.saveResults(results, stats);

    console.log(`[LLMKnowledgeExtractorV2] Extraction completed. Success: ${stats.successfulExtractions}/${stats.totalPages}`);
    return results;
  }

  private async processBatch(pages: ConfluencePage[], stats: ProcessingStats): Promise<ExtractedKnowledge[]> {
    // 超高速並列処理でバッチ内のすべてのページを同時に処理
    // 最大並列度で処理し、エラー耐性を確保
    const batchResults = await Promise.allSettled(
      pages.map(page => this.extractFromPage(page))
    );

    const results: ExtractedKnowledge[] = [];
    
    batchResults.forEach((result, index) => {
      stats.processedPages++;
      
      if (result.status === 'fulfilled') {
        results.push(result.value);
        stats.successfulExtractions++;
      } else {
        console.error(`[LLMKnowledgeExtractorV2] Failed to process page ${pages[index].id}:`, result.reason);
        stats.failedExtractions++;
      }
    });

    return results;
  }

  private async extractFromPage(page: ConfluencePage): Promise<ExtractedKnowledge> {
    const startTime = Date.now();
    
    try {
      // 空のコンテンツをスキップ
      if (!page.content || page.content.trim() === '') {
        console.log(`[LLMKnowledgeExtractorV2] Skipping page ${page.id} (empty content): ${page.title}`);
        return {
          pageId: page.id,
          pageTitle: page.title,
          extractedAt: new Date().toISOString(),
          domainNames: [],
          functionNames: [],
          operationNames: [],
          systemFields: [],
          systemTerms: [],
          relatedKeywords: [],
          confidence: 0.0,
          metadata: {
            processingTime: 0,
            tokenCount: 0,
            model: this.config.model
          }
        };
      }
      
      const prompt = this.buildPrompt(page);
      const response = await this.callLLMWithRetry(prompt);
      const result = this.parseResponse(response, page);
      
      result.metadata.processingTime = Date.now() - startTime;
      return result;
    } catch (error) {
      console.error(`[LLMKnowledgeExtractorV2] Error processing page ${page.id}:`, error);
      throw error;
    }
  }

  private buildPrompt(page: ConfluencePage): string {
    const context = {
      pageTitle: page.title,
      parentTitle: page.parentTitle || 'なし',
      labels: page.labels.join(', ') || 'なし',
      url: page.url,
      lastModified: page.lastModified,
      author: page.author
    };

    return `# システム仕様書からドメイン知識を抽出

## ページ情報
- タイトル: "${context.pageTitle}"
- 親ページ: "${context.parentTitle}"

## 重要：以下のキーワードは必ず抽出してください
**必須抽出キーワード**: 
- システム項目: 商品概要、対象サイト、有効期限、無効な契約も表示、ページ番号、契約番号、対象教室グループ名、サービス種別、契約種別、商品名称、総額、開始日、有効期限、無効化日時、課金形態種別、オプション種別、単価、数量、無料フラグ
- システム用語: 入力フォーム、データベース、ログ、ユーザーエージェント、アクセス元IPアドレス、管理者ID、企業番号、権限、帳票、ワークフロー、エラーチェック、妥当性検査、SQLインジェクション対策、HTMLエスケープ処理、ページネーション、フィルタリング、絞り込み、AND結合、セレクトボックス、チェックボックス
- 操作名: 新規登録、閲覧、検索、更新、絞り込み、フィルタリング、ページネーション、押下、遷移、選択、適用

## 抽出対象（詳細版）

### 1. ドメイン名
「管理」「機能」で終わる機能領域
- 例: 教室管理、求人管理、企業管理、クライアント企業管理

### 2. 機能名
具体的な機能名
- 例: 求人情報新規登録機能、求人一覧閲覧機能、求人情報コピー機能

### 3. 操作名
基本操作
- 例: 新規登録、閲覧、編集、削除、コピー、検索、作成、保存、表示、遷移

### 4. システム項目・フィールド名
入力フォームの項目名、データベースのフィールド名、画面表示項目名
- 例: 商品概要、対象サイト、有効期限、無効な契約も表示、ページ番号、契約番号、対象教室グループ名、サービス種別、契約種別、商品名称、総額、開始日、有効期限、無効化日時、課金形態種別、オプション種別、単価、数量、無料フラグ、求人タイトル、表示順、指導特徴、雇用形態、給与形態、想定年収、昇給、賞与、年間休日、待遇、仕事内容、質問1、質問2、質問3、メッセージ

### 5. システム用語
技術的な用語、システム関連の用語、UIコンポーネント名
- 例: 入力フォーム、データベース、ログ、ユーザーエージェント、アクセス元IPアドレス、管理者ID、求人番号、企業番号、権限、帳票、ワークフロー、エラーチェック、妥当性検査、SQLインジェクション対策、HTMLエスケープ処理、ページネーション、フィルタリング、絞り込み、AND結合、セレクトボックス、チェックボックス、コンポーネント、レコード、URLパラメータ

### 6. 関連キーワード
検索に有効な用語
- 例: 教室、企業、管理者、ステーション、キャリア、掲載フラグ、対象サイト

## 出力形式（JSON）
{
  "domainNames": ["教室管理", "求人管理"],
  "functionNames": ["求人情報新規登録機能", "求人一覧閲覧機能"],
  "operationNames": ["新規登録", "閲覧", "編集", "削除", "コピー"],
  "systemFields": ["求人タイトル", "表示順", "指導特徴", "雇用形態", "給与形態"],
  "systemTerms": ["入力フォーム", "データベース", "ログ", "ユーザーエージェント", "権限"],
  "relatedKeywords": ["教室", "企業", "管理者", "ステーション", "キャリア"],
  "confidence": 0.9
}

## 対象テキスト
${page.content.substring(0, 1500)}...`;
  }

  private async callLLMWithRetry(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    console.log(`[LLMKnowledgeExtractorV2] Starting LLM call with prompt length: ${prompt.length}`);

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`[LLMKnowledgeExtractorV2] Attempt ${attempt}/${this.config.maxRetries}`);
        const result = await this.model.generateContent(prompt);
        console.log(`[LLMKnowledgeExtractorV2] Model response received`);
        const response = await result.response;
        console.log(`[LLMKnowledgeExtractorV2] Response object received`);
        const text = response.text();
        console.log(`[LLMKnowledgeExtractorV2] Text extracted: ${text.length} characters`);
        console.log(`[LLMKnowledgeExtractorV2] LLM call successful on attempt ${attempt}`);
        return text;
      } catch (error) {
        lastError = error as Error;
        console.log(`[LLMKnowledgeExtractorV2] LLM call failed (attempt ${attempt}):`, error.message);
        console.log(`[LLMKnowledgeExtractorV2] Error details:`, error);
        console.log(`[LLMKnowledgeExtractorV2] Error stack:`, error.stack);
        console.log(`[LLMKnowledgeExtractorV2] Error type:`, typeof error);
        console.log(`[LLMKnowledgeExtractorV2] Error constructor:`, error.constructor.name);
        console.log(`[LLMKnowledgeExtractorV2] Error keys:`, Object.keys(error));
        console.log(`[LLMKnowledgeExtractorV2] Error toString:`, error.toString());
        
        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[LLMKnowledgeExtractorV2] Retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    console.log(`[LLMKnowledgeExtractorV2] All retry attempts failed`);
    throw lastError || new Error('All LLM retry attempts failed');
  }

  private parseResponse(response: string, page: ConfluencePage): ExtractedKnowledge {
    try {
      // JSON部分を抽出（より堅牢な処理）
      let jsonText = response;
      
      // ```json で囲まれている場合はそれを除去
      const codeBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
        console.log(`[LLMKnowledgeExtractorV2] Extracted JSON from code block: ${jsonText.substring(0, 100)}...`);
      } else {
        // 通常のJSON抽出
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
          console.log(`[LLMKnowledgeExtractorV2] Extracted JSON from match: ${jsonText.substring(0, 100)}...`);
        }
      }
      
      if (!jsonText) {
        console.log(`[LLMKnowledgeExtractorV2] No JSON found in response: ${response}`);
        throw new Error('No JSON found in response');
      }

      // JSONをクリーンアップ（コメントや不正な文字を除去）
      jsonText = jsonText
        .replace(/\/\*[\s\S]*?\*\//g, '') // ブロックコメント除去
        .replace(/\/\/.*$/gm, '') // 行コメント除去
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 制御文字のみ除去（日本語は保持）
        .trim();

      console.log(`[LLMKnowledgeExtractorV2] Attempting to parse JSON: ${jsonText.substring(0, 100)}...`);
      
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
        console.log(`[LLMKnowledgeExtractorV2] JSON parsed successfully:`, parsed);
      } catch (parseError) {
        console.log(`[LLMKnowledgeExtractorV2] JSON parse error: ${parseError.message}`);
        console.log(`[LLMKnowledgeExtractorV2] Problematic JSON: ${jsonText}`);

        // JSONを修正しようと試みる
        const fixedJsonText = jsonText
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 制御文字のみ除去（日本語は保持）
          .replace(/,\s*}/g, '}') // 末尾のカンマを除去
          .replace(/,\s*]/g, ']') // 配列の末尾カンマを除去
          .replace(/\n/g, ' ') // 改行を除去
          .replace(/\s+/g, ' ') // 複数のスペースを1つに
          .trim();

        console.log(`[LLMKnowledgeExtractorV2] Fixed JSON: ${fixedJsonText}`);

        try {
          parsed = JSON.parse(fixedJsonText);
          console.log(`[LLMKnowledgeExtractorV2] JSON successfully fixed and parsed:`, parsed);
        } catch (secondError) {
          console.log(`[LLMKnowledgeExtractorV2] Could not fix JSON: ${secondError.message}`);
          throw new Error(`Failed to parse JSON even after fixing: ${secondError.message}`);
        }
      }
      
      // 必須フィールドのチェック
      if (!parsed.domainNames || !Array.isArray(parsed.domainNames)) {
        throw new Error('Invalid response format: missing domainNames');
      }
      if (!parsed.functionNames || !Array.isArray(parsed.functionNames)) {
        throw new Error('Invalid response format: missing functionNames');
      }
      if (!parsed.operationNames || !Array.isArray(parsed.operationNames)) {
        throw new Error('Invalid response format: missing operationNames');
      }
      if (!parsed.relatedKeywords || !Array.isArray(parsed.relatedKeywords)) {
        throw new Error('Invalid response format: missing relatedKeywords');
      }

      // 空文字列をフィルタリング
      const filterEmpty = (arr: string[]) => arr.filter(item => item && item.trim() !== '');
      
      return {
        pageId: page.id,
        pageTitle: page.title,
        extractedAt: new Date().toISOString(),
        domainNames: filterEmpty(parsed.domainNames),
        functionNames: filterEmpty(parsed.functionNames),
        operationNames: filterEmpty(parsed.operationNames),
        systemFields: filterEmpty(parsed.systemFields || []),
        systemTerms: filterEmpty(parsed.systemTerms || []),
        relatedKeywords: filterEmpty(parsed.relatedKeywords),
        confidence: parsed.confidence || 0.5,
        metadata: {
          processingTime: 0, // 後で設定
          tokenCount: response.length,
          model: this.config.model
        }
      };
    } catch (error) {
      console.error(`[LLMKnowledgeExtractorV2] Failed to parse response for page ${page.id}:`, error);
      console.error(`[LLMKnowledgeExtractorV2] Response:`, response);
      
      // フォールバック: 空の結果を返す
      return {
        pageId: page.id,
        pageTitle: page.title,
        extractedAt: new Date().toISOString(),
        domainNames: [],
        functionNames: [],
        operationNames: [],
        systemFields: [],
        systemTerms: [],
        relatedKeywords: [],
        confidence: 0.0,
        metadata: {
          processingTime: 0,
          tokenCount: response.length,
          model: this.config.model
        }
      };
    }
  }

  private calculateAverageConfidence(results: ExtractedKnowledge[]): number {
    if (results.length === 0) return 0;
    const totalConfidence = results.reduce((sum, result) => sum + result.confidence, 0);
    return totalConfidence / results.length;
  }

  private async saveResults(results: ExtractedKnowledge[], stats: ProcessingStats): Promise<void> {
    // 出力ディレクトリの作成
    mkdirSync(this.config.outputDir, { recursive: true });

    // 個別結果の保存
    const extractedKnowledgePath = join(this.config.outputDir, 'extracted-knowledge-v2.json');
    writeFileSync(extractedKnowledgePath, JSON.stringify(results, null, 2));

    // 統計情報の保存
    const statsPath = join(this.config.outputDir, 'extraction-stats-v2.json');
    writeFileSync(statsPath, JSON.stringify(stats, null, 2));

    // マージされた知識の保存
    const mergedKnowledge = this.mergeKnowledge(results);
    const mergedPath = join(this.config.outputDir, 'merged-knowledge-v2.json');
    writeFileSync(mergedPath, JSON.stringify(mergedKnowledge, null, 2));

    console.log(`[LLMKnowledgeExtractorV2] Results saved to ${this.config.outputDir}`);
  }

  private mergeKnowledge(results: ExtractedKnowledge[]): any {
    const merged = {
      domainNames: new Set<string>(),
      functionNames: new Set<string>(),
      operationNames: new Set<string>(),
      relatedKeywords: new Set<string>(),
      pages: results.length,
      extractedAt: new Date().toISOString()
    };

    results.forEach(result => {
      result.domainNames.forEach(domain => merged.domainNames.add(domain));
      result.functionNames.forEach(func => merged.functionNames.add(func));
      result.operationNames.forEach(op => merged.operationNames.add(op));
      result.relatedKeywords.forEach(keyword => merged.relatedKeywords.add(keyword));
    });

    return {
      domainNames: Array.from(merged.domainNames),
      functionNames: Array.from(merged.functionNames),
      operationNames: Array.from(merged.operationNames),
      relatedKeywords: Array.from(merged.relatedKeywords),
      pages: merged.pages,
      extractedAt: merged.extractedAt
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
