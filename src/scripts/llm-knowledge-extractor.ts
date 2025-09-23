import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ConfluencePage } from './confluence-data-extractor';

interface ExtractedKnowledge {
  pageId: string;
  pageTitle: string;
  extractedAt: string;
  functions: {
    [functionName: string]: string[];
  };
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

export class LLMKnowledgeExtractor {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private config: LLMExtractionConfig;

  constructor(config: LLMExtractionConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: config.model });
  }

  async extractFromPages(pages: ConfluencePage[]): Promise<ExtractedKnowledge[]> {
    console.log(`[LLMKnowledgeExtractor] Starting extraction from ${pages.length} pages`);
    
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
      console.log(`[LLMKnowledgeExtractor] Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(pages.length / this.config.batchSize)}`);

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

    console.log(`[LLMKnowledgeExtractor] Extraction completed. Success: ${stats.successfulExtractions}/${stats.totalPages}`);
    return results;
  }

  private async processBatch(pages: ConfluencePage[], stats: ProcessingStats): Promise<ExtractedKnowledge[]> {
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
        console.error(`[LLMKnowledgeExtractor] Failed to process page ${pages[index].id}:`, result.reason);
        stats.failedExtractions++;
      }
    });

    return results;
  }

  private async extractFromPage(page: ConfluencePage): Promise<ExtractedKnowledge> {
    const startTime = Date.now();
    
    try {
      const prompt = this.buildPrompt(page);
      const response = await this.callLLMWithRetry(prompt);
      const extracted = this.parseResponse(response, page);
      
      const processingTime = Date.now() - startTime;
      
      return {
        ...extracted,
        metadata: {
          ...extracted.metadata,
          processingTime
        }
      };
    } catch (error) {
      console.error(`[LLMKnowledgeExtractor] Error processing page ${page.id}:`, error);
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

    return `# Role
あなたは仕様書を分析し、機能とそれに紐づくキーワードを抽出する専門家です。

# Context
これから渡すテキストは、大規模なシステム仕様書の一部です。
- ページタイトル: "${context.pageTitle}"
- 親ページ: "${context.parentTitle}"
- ラベル: "${context.labels}"
- URL: "${context.url}"
- 最終更新: "${context.lastModified}"
- 作成者: "${context.author}"

# Task
上記コンテキストを考慮して、このページで説明されている主要機能と、関連する操作キーワードを抽出してください。

# Rules
- 出力は必ずJSON形式にしてください
- フォーマット: { "機能名": ["キーワード1", "キーワード2", ...] }
- 機能名は具体的で分かりやすいものにしてください
- キーワードは検索に有効なものを抽出してください
- 機能名は最大5個まで、各機能のキーワードは最大10個まで
- 信頼度を0-1の数値で評価してください

# Output Format
{
  "functions": {
    "機能名1": ["キーワード1", "キーワード2"],
    "機能名2": ["キーワード3", "キーワード4"]
  },
  "confidence": 0.85
}

# Input
---
${page.content}
---`;
  }

  private async callLLMWithRetry(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[LLMKnowledgeExtractor] LLM call failed (attempt ${attempt}), retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error('All LLM retry attempts failed');
  }

  private parseResponse(response: string, page: ConfluencePage): ExtractedKnowledge {
    try {
      // JSON部分を抽出
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.functions || typeof parsed.functions !== 'object') {
        throw new Error('Invalid response format: missing functions');
      }

      return {
        pageId: page.id,
        pageTitle: page.title,
        extractedAt: new Date().toISOString(),
        functions: parsed.functions,
        confidence: parsed.confidence || 0.5,
        metadata: {
          processingTime: 0, // 後で設定
          tokenCount: response.length,
          model: this.config.model
        }
      };
    } catch (error) {
      console.error(`[LLMKnowledgeExtractor] Failed to parse response for page ${page.id}:`, error);
      console.error(`[LLMKnowledgeExtractor] Response:`, response);
      
      // フォールバック: 空の結果を返す
      return {
        pageId: page.id,
        pageTitle: page.title,
        extractedAt: new Date().toISOString(),
        functions: {},
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
    mkdirSync(this.config.outputDir, { recursive: true });

    // メイン結果ファイル
    const resultsFile = join(this.config.outputDir, 'extracted-knowledge.json');
    writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`[LLMKnowledgeExtractor] Results saved to: ${resultsFile}`);

    // 統計情報
    const statsFile = join(this.config.outputDir, 'extraction-stats.json');
    writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    console.log(`[LLMKnowledgeExtractor] Statistics saved to: ${statsFile}`);

    // 統合された知識ベース
    const mergedKnowledge = this.mergeKnowledge(results);
    const knowledgeFile = join(this.config.outputDir, 'merged-knowledge.json');
    writeFileSync(knowledgeFile, JSON.stringify(mergedKnowledge, null, 2));
    console.log(`[LLMKnowledgeExtractor] Merged knowledge saved to: ${knowledgeFile}`);
  }

  private mergeKnowledge(results: ExtractedKnowledge[]): any {
    const merged: any = {
      functions: {},
      statistics: {
        totalFunctions: 0,
        totalKeywords: 0,
        totalPages: results.length,
        averageConfidence: this.calculateAverageConfidence(results)
      }
    };

    results.forEach(result => {
      Object.entries(result.functions).forEach(([functionName, keywords]) => {
        if (!merged.functions[functionName]) {
          merged.functions[functionName] = {
            keywords: [],
            sources: [],
            confidence: 0,
            lastUpdated: result.extractedAt
          };
        }

        // キーワードの統合
        const existingKeywords = new Set(merged.functions[functionName].keywords);
        keywords.forEach(keyword => existingKeywords.add(keyword));
        merged.functions[functionName].keywords = Array.from(existingKeywords);

        // ソースの追加
        merged.functions[functionName].sources.push(result.pageId);

        // 信頼度の更新（平均）
        const currentConfidence = merged.functions[functionName].confidence;
        const sourceCount = merged.functions[functionName].sources.length;
        merged.functions[functionName].confidence = 
          (currentConfidence * (sourceCount - 1) + result.confidence) / sourceCount;

        // 最終更新日時の更新
        if (new Date(result.extractedAt) > new Date(merged.functions[functionName].lastUpdated)) {
          merged.functions[functionName].lastUpdated = result.extractedAt;
        }
      });
    });

    // 統計情報の計算
    merged.statistics.totalFunctions = Object.keys(merged.functions).length;
    merged.statistics.totalKeywords = Object.values(merged.functions)
      .reduce((sum: number, func: any) => sum + func.keywords.length, 0);

    return merged;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行スクリプト
async function main() {
  const config: LLMExtractionConfig = {
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    model: 'gemini-1.5-flash',
    batchSize: 5,
    outputDir: './data/llm-extraction',
    maxRetries: 3,
    delayBetweenRequests: 2000
  };

  if (!config.apiKey) {
    console.error('GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required');
    process.exit(1);
  }

  // Confluenceデータの読み込み
  const confluenceDataPath = './data/confluence-extraction/confluence-data.json';
  const confluenceData = JSON.parse(readFileSync(confluenceDataPath, 'utf-8'));

  const extractor = new LLMKnowledgeExtractor(config);
  
  try {
    const results = await extractor.extractFromPages(confluenceData.pages);
    console.log('LLM extraction completed successfully!');
    console.log(`Processed ${results.length} pages`);
  } catch (error) {
    console.error('LLM extraction failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { LLMKnowledgeExtractor, type ExtractedKnowledge, type LLMExtractionConfig, type ProcessingStats };
