#!/usr/bin/env tsx

import 'dotenv/config';
import { ConfluenceDataExtractor, type ExtractionConfig } from './confluence-data-extractor';
import { LLMKnowledgeExtractor, type LLMExtractionConfig } from './llm-knowledge-extractor';
import { KnowledgeValidator } from './knowledge-validator';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// 環境変数を展開する関数
function expandEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
  } else if (Array.isArray(obj)) {
    return obj.map(expandEnvVars);
  } else if (obj && typeof obj === 'object') {
    const expanded: any = {};
    for (const [key, value] of Object.entries(obj)) {
      expanded[key] = expandEnvVars(value);
    }
    return expanded;
  }
  return obj;
}

interface PipelineConfig {
  confluence: ExtractionConfig;
  llm: LLMExtractionConfig;
  skipConfluenceExtraction: boolean;
  skipLLMExtraction: boolean;
  skipValidation: boolean;
}

class DomainKnowledgePipeline {
  private config: PipelineConfig;

  constructor(config: PipelineConfig) {
    this.config = config;
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Domain Knowledge Extraction Pipeline');
    console.log('================================================');

    try {
      // Step 1: Confluence データ抽出
      if (!this.config.skipConfluenceExtraction) {
        await this.runConfluenceExtraction();
      } else {
        console.log('⏭️  Skipping Confluence extraction (skipConfluenceExtraction = true)');
      }

      // Step 2: LLM 知識抽出
      if (!this.config.skipLLMExtraction) {
        await this.runLLMExtraction();
      } else {
        console.log('⏭️  Skipping LLM extraction (skipLLMExtraction = true)');
      }

      // Step 3: 知識検証
      if (!this.config.skipValidation) {
        await this.runValidation();
      } else {
        console.log('⏭️  Skipping validation (skipValidation = true)');
      }

      console.log('✅ Pipeline completed successfully!');
      this.printSummary();

    } catch (error) {
      console.error('❌ Pipeline failed:', error);
      process.exit(1);
    }
  }

  private async runConfluenceExtraction(): Promise<void> {
    console.log('\n📥 Step 1: Confluence Data Extraction');
    console.log('------------------------------------');

    const extractor = new ConfluenceDataExtractor(this.config.confluence);
    const result = await extractor.extractAllData();

    console.log(`✅ Extracted ${result.pages.length} pages from space: ${result.name}`);
    console.log(`📁 Data saved to: ${this.config.confluence.outputDir}`);
  }

  private async runLLMExtraction(): Promise<void> {
    console.log('\n🤖 Step 2: LLM Knowledge Extraction');
    console.log('-----------------------------------');

    // Confluenceデータの読み込み
    const confluenceDataPath = join(this.config.confluence.outputDir, 'confluence-data.json');
    if (!existsSync(confluenceDataPath)) {
      throw new Error(`Confluence data not found at: ${confluenceDataPath}`);
    }

    const confluenceData = JSON.parse(readFileSync(confluenceDataPath, 'utf-8'));
    console.log(`📖 Loading ${confluenceData.pages.length} pages for LLM processing`);

    const extractor = new LLMKnowledgeExtractor(this.config.llm);
    const results = await extractor.extractFromPages(confluenceData.pages);

    console.log(`✅ Extracted knowledge from ${results.length} pages`);
    console.log(`📁 Results saved to: ${this.config.llm.outputDir}`);
  }

  private async runValidation(): Promise<void> {
    console.log('\n🔍 Step 3: Knowledge Validation');
    console.log('--------------------------------');

    // 抽出された知識の読み込み
    const extractedKnowledgePath = join(this.config.llm.outputDir, 'extracted-knowledge.json');
    if (!existsSync(extractedKnowledgePath)) {
      throw new Error(`Extracted knowledge not found at: ${extractedKnowledgePath}`);
    }

    const extractedKnowledge = JSON.parse(readFileSync(extractedKnowledgePath, 'utf-8'));
    console.log(`📊 Validating ${extractedKnowledge.length} extractions`);

    const validator = new KnowledgeValidator();
    const report = await validator.validateKnowledge(extractedKnowledge);

    console.log(`✅ Validation completed with overall score: ${report.overallScore.toFixed(1)}/100`);
    console.log(`📁 Validation report saved to: ./data/validation`);
  }

  private printSummary(): void {
    console.log('\n📊 Pipeline Summary');
    console.log('==================');

    // Confluence統計
    if (!this.config.skipConfluenceExtraction) {
      const statsPath = join(this.config.confluence.outputDir, 'extraction-stats.json');
      if (existsSync(statsPath)) {
        const stats = JSON.parse(readFileSync(statsPath, 'utf-8'));
        console.log(`📥 Confluence: ${stats.totalPages} pages extracted`);
      }
    }

    // LLM統計
    if (!this.config.skipLLMExtraction) {
      const statsPath = join(this.config.llm.outputDir, 'extraction-stats.json');
      if (existsSync(statsPath)) {
        const stats = JSON.parse(readFileSync(statsPath, 'utf-8'));
        console.log(`🤖 LLM: ${stats.successfulExtractions}/${stats.totalPages} pages processed successfully`);
        console.log(`⏱️  Processing time: ${(stats.totalProcessingTime / 1000 / 60).toFixed(1)} minutes`);
      }
    }

    // 検証統計
    if (!this.config.skipValidation) {
      const reportPath = './data/validation/quality-report.json';
      if (existsSync(reportPath)) {
        const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
        console.log(`🔍 Validation: ${report.statistics.validPages}/${report.statistics.totalPages} pages valid`);
        console.log(`📈 Overall quality score: ${report.overallScore.toFixed(1)}/100`);
      }
    }

    console.log('\n📁 Output Files:');
    console.log(`   - Confluence data: ${this.config.confluence.outputDir}/`);
    console.log(`   - LLM extraction: ${this.config.llm.outputDir}/`);
    console.log(`   - Validation: ./data/validation/`);
  }
}

// 設定の読み込み
function loadConfig(): PipelineConfig {
  const configPath = './config/domain-knowledge-config.json';
  
  if (existsSync(configPath)) {
    console.log(`📋 Loading configuration from: ${configPath}`);
    const rawConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    return expandEnvVars(rawConfig);
  }

  // デフォルト設定
  console.log('📋 Using default configuration');
  return {
    confluence: {
      spaceKey: process.env.CONFLUENCE_SPACE_KEY || 'CLIENTTOMO',
      outputDir: './data/confluence-extraction',
      batchSize: 50,
      includeArchived: false,
      maxPages: 1000
    },
    llm: {
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
      model: 'gemini-1.5-flash',
      batchSize: 5,
      outputDir: './data/llm-extraction',
      maxRetries: 3,
      delayBetweenRequests: 2000
    },
    skipConfluenceExtraction: process.env.SKIP_CONFLUENCE === 'true',
    skipLLMExtraction: process.env.SKIP_LLM === 'true',
    skipValidation: process.env.SKIP_VALIDATION === 'true'
  };
}

// 設定ファイルの生成
function generateConfigFile(): void {
  const configDir = './config';
  const configPath = join(configDir, 'domain-knowledge-config.json');
  
  if (!existsSync(configDir)) {
    require('fs').mkdirSync(configDir, { recursive: true });
  }

  const defaultConfig: PipelineConfig = {
    confluence: {
      spaceKey: 'CLIENTTOMO',
      outputDir: './data/confluence-extraction',
      batchSize: 50,
      includeArchived: false,
      maxPages: 1000
    },
    llm: {
      apiKey: '',
      model: 'gemini-1.5-flash',
      batchSize: 5,
      outputDir: './data/llm-extraction',
      maxRetries: 3,
      delayBetweenRequests: 2000
    },
    skipConfluenceExtraction: false,
    skipLLMExtraction: false,
    skipValidation: false
  };

  require('fs').writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  console.log(`📋 Default configuration file created: ${configPath}`);
  console.log('   Please edit the configuration file and set your API keys.');
}

// メイン実行
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--generate-config')) {
    generateConfigFile();
    return;
  }

  if (args.includes('--help')) {
    console.log(`
Domain Knowledge Extraction Pipeline

Usage:
  npx tsx src/scripts/run-domain-knowledge-extraction.ts [options]

Options:
  --generate-config    Generate default configuration file
  --help              Show this help message

Environment Variables:
  CONFLUENCE_BASE_URL     Confluence base URL
  CONFLUENCE_USERNAME     Confluence username
  CONFLUENCE_API_TOKEN    Confluence API token
  CONFLUENCE_SPACE_KEY    Confluence space key (default: CLIENTTOMO)
  GEMINI_API_KEY         Gemini API key
  SKIP_CONFLUENCE        Skip Confluence extraction (true/false)
  SKIP_LLM              Skip LLM extraction (true/false)
  SKIP_VALIDATION       Skip validation (true/false)

Examples:
  # Generate configuration file
  npx tsx src/scripts/run-domain-knowledge-extraction.ts --generate-config

  # Run full pipeline
  npx tsx src/scripts/run-domain-knowledge-extraction.ts

  # Run only LLM extraction (skip Confluence)
  SKIP_CONFLUENCE=true npx tsx src/scripts/run-domain-knowledge-extraction.ts
`);
    return;
  }

  // 設定の読み込み
  const config = loadConfig();

  // API キーの確認
  if (!config.llm.apiKey) {
    console.error('❌ GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required');
    console.error('   Set the API key or edit the configuration file');
    process.exit(1);
  }

  // パイプラインの実行
  const pipeline = new DomainKnowledgePipeline(config);
  await pipeline.run();
}

if (require.main === module) {
  main().catch(console.error);
}

export { DomainKnowledgePipeline, type PipelineConfig };
