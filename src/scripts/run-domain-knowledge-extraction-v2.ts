#!/usr/bin/env node

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ConfluenceDataExtractor } from './confluence-data-extractor';
import { LLMKnowledgeExtractorV2 } from './llm-knowledge-extractor-v2';
import { KnowledgeValidator } from './knowledge-validator';
import { deduplicateFunctionKeywords, deduplicateGlobalKeywords } from '../lib/keyword-deduplicator-v2';

interface Config {
  confluence: {
    baseUrl: string;
    email: string;
    apiToken: string;
    spaceKey: string;
    maxPages: number;
    batchSize: number;
    outputDir: string;
  };
  llm: {
    apiKey: string;
    model: string;
    batchSize: number;
    outputDir: string;
    maxRetries: number;
    delayBetweenRequests: number;
  };
  validation: {
    outputDir: string;
  };
  pipeline: {
    steps: string[];
    outputDir: string;
  };
}

/**
 * 環境変数を展開するユーティリティ
 */
function expandEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
  } else if (Array.isArray(obj)) {
    return obj.map(expandEnvVars);
  } else if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = expandEnvVars(obj[key]);
    }
    return result;
  }
  return obj;
}

/**
 * 設定を読み込み
 */
function loadConfig(): Config {
  const configPath = 'config/domain-knowledge-config.json';
  const configData = readFileSync(configPath, 'utf8');
  const config = JSON.parse(configData);
  return expandEnvVars(config);
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('🚀 データドリブンなドメイン知識抽出パイプライン開始');
  
  const config = loadConfig();
  console.log('📋 設定を読み込みました');
  console.log('🔧 パイプラインステップ:', config.pipeline.steps);
  
  // 出力ディレクトリの作成
  mkdirSync(config.pipeline.outputDir, { recursive: true });
  
  try {
    // Step 1: Confluenceデータ抽出
    if (config.pipeline.steps.includes('confluence')) {
      console.log('\n📥 Step 1: Confluenceデータ抽出');
      const confluenceExtractor = new ConfluenceDataExtractor({
        spaceKey: config.confluence.spaceKey,
        outputDir: config.confluence.outputDir,
        batchSize: config.confluence.batchSize,
        includeArchived: false,
        maxPages: config.confluence.maxPages,
        // specificPageId: undefined // 本番実行では全ページを対象
      });
      
      const confluenceData = await confluenceExtractor.extractAllData();
      console.log(`✅ Confluenceデータ抽出完了: ${confluenceData.pages.length}ページ`);
    }
    
    // Step 2: LLM知識抽出（V2）
    if (config.pipeline.steps.includes('llm')) {
      console.log('\n🧠 Step 2: LLM知識抽出（V2）');
      const llmExtractor = new LLMKnowledgeExtractorV2({
        apiKey: config.llm.apiKey,
        model: config.llm.model,
        batchSize: config.llm.batchSize,
        outputDir: config.llm.outputDir,
        maxRetries: config.llm.maxRetries,
        delayBetweenRequests: config.llm.delayBetweenRequests
      });
      
      // Confluenceデータを読み込み
      const confluenceDataPath = join(config.confluence.outputDir, 'confluence-data.json');
      const confluenceData = JSON.parse(readFileSync(confluenceDataPath, 'utf8'));
      
      const extractedKnowledge = await llmExtractor.extractFromPages(confluenceData.pages);
      console.log(`✅ LLM知識抽出完了: ${extractedKnowledge.length}ページ`);
      
      // 重複削除を実行
      console.log('\n🔄 重複削除を実行中...');
      const functions = extractedKnowledge.reduce((acc, page) => {
        acc[page.pageId] = {
          domainNames: page.domainNames,
          functionNames: page.functionNames,
          operationNames: page.operationNames,
          systemFields: page.systemFields || [],
          systemTerms: page.systemTerms || [],
          relatedKeywords: page.relatedKeywords
        };
        return acc;
      }, {} as Record<string, any>);
      
      // systemFieldsとsystemTermsを保護して重複削除を実行
      const deduplicatedFunctions = deduplicateFunctionKeywords(functions, {
        protectDomainNames: true,
        minLength: 2,
        maxLength: 50
      });
      
      const globalDeduplication = deduplicateGlobalKeywords(functions, {
        protectDomainNames: true,
        minLength: 2,
        maxLength: 50
      });
      
      console.log(`✅ 重複削除完了: ${globalDeduplication.statistics.originalCount} → ${globalDeduplication.statistics.uniqueCount} (${globalDeduplication.statistics.reductionRate.toFixed(1)}%削減)`);
      console.log(`🛡️ 保護されたキーワード: ${globalDeduplication.statistics.protectedCount}件`);
      
      // 重複削除結果を保存
      const deduplicationResult = {
        functions: deduplicatedFunctions,
        global: globalDeduplication,
        extractedAt: new Date().toISOString()
      };
      
      const deduplicationPath = join(config.llm.outputDir, 'deduplication-result-v2.json');
      writeFileSync(deduplicationPath, JSON.stringify(deduplicationResult, null, 2));
      console.log(`💾 重複削除結果を保存: ${deduplicationPath}`);
    }
    
    // Step 3: 知識検証（オプション）
    if (config.pipeline.steps.includes('validation')) {
      console.log('\n🔍 Step 3: 知識検証');
      const validator = new KnowledgeValidator();
      
      // 重複削除結果を読み込み
      const deduplicationPath = join(config.llm.outputDir, 'deduplication-result-v2.json');
      const deduplicationResult = JSON.parse(readFileSync(deduplicationPath, 'utf8'));
      
      // 重複削除結果から元の抽出知識を復元
      const extractedKnowledge = Object.entries(deduplicationResult.functions).map(([pageId, funcData]) => {
        const data = funcData as any;
        return {
          pageId,
          pageTitle: `Page ${pageId}`, // 実際のタイトルは別途取得が必要
          extractedAt: new Date().toISOString(),
          functions: {
            ...data.functionNames?.reduce((acc: any, name: string) => {
              acc[name] = [...(data.domainNames || []), ...(data.operationNames || []), ...(data.systemFields || []), ...(data.systemTerms || []), ...(data.relatedKeywords || [])];
              return acc;
            }, {}) || {}
          },
          confidence: 0.8, // デフォルト値
          metadata: {
            processingTime: 0,
            tokenCount: 0,
            model: config.llm.model
          }
        };
      });
      
      const validationResult = await validator.validateKnowledge(extractedKnowledge);
      console.log(`✅ 知識検証完了: スコア ${validationResult.overallScore.toFixed(2)}`);
    } else {
      console.log('\n⏭️ Step 3: 知識検証をスキップ');
    }
    
    // Step 4: 最終結果の統合
    console.log('\n📊 Step 4: 最終結果の統合');
    
    // 重複削除結果を読み込み
    const deduplicationPath = join(config.llm.outputDir, 'deduplication-result-v2.json');
    const deduplicationResult = JSON.parse(readFileSync(deduplicationPath, 'utf8'));
    
    // ドメイン名を個別ページから集約（機能領域のみ）
    const allDomainNames = new Set<string>();
    Object.values(deduplicationResult.functions).forEach((pageData: any) => {
      if (pageData.domainNames && Array.isArray(pageData.domainNames)) {
        pageData.domainNames.forEach((domain: string) => {
          if (domain && domain.trim() && (domain.includes('管理') || domain.includes('機能'))) {
            allDomainNames.add(domain.trim());
          }
        });
      }
    });

    const domainStats = {
      totalDomainNames: allDomainNames.size,
      topDomainNames: Array.from(allDomainNames).slice(0, 20)
    };
    
    // 全キーワードを統合（新しいフィールドも含める）
    const allKeywords = new Set<string>();
    Object.values(deduplicationResult.functions).forEach((pageData: any) => {
      if (pageData.domainNames) pageData.domainNames.forEach((k: string) => allKeywords.add(k));
      if (pageData.functionNames) pageData.functionNames.forEach((k: string) => allKeywords.add(k));
      if (pageData.operationNames) pageData.operationNames.forEach((k: string) => allKeywords.add(k));
      if (pageData.systemFields) pageData.systemFields.forEach((k: string) => allKeywords.add(k));
      if (pageData.systemTerms) pageData.systemTerms.forEach((k: string) => allKeywords.add(k));
      if (pageData.relatedKeywords) pageData.relatedKeywords.forEach((k: string) => allKeywords.add(k));
    });

    const finalResult = {
      metadata: {
        extractedAt: new Date().toISOString(),
        version: '2.1',
        description: 'データドリブンなドメイン知識抽出結果（システム項目・用語対応版）'
      },
      statistics: {
        totalPages: Object.keys(deduplicationResult.functions).length,
        totalKeywords: allKeywords.size,
        domainNames: domainStats.totalDomainNames,
        reductionRate: deduplicationResult.global.statistics.reductionRate,
        protectedKeywords: deduplicationResult.global.statistics.protectedCount
      },
      domainNames: Array.from(allDomainNames),
      allKeywords: Array.from(allKeywords),
      functions: deduplicationResult.functions,
      topDomainNames: domainStats.topDomainNames
    };
    
    const finalPath = join(config.pipeline.outputDir, 'final-domain-knowledge-v2.json');
    writeFileSync(finalPath, JSON.stringify(finalResult, null, 2));
    
    console.log(`✅ 最終結果を保存: ${finalPath}`);
    console.log(`📈 統計情報:`);
    console.log(`   - 総ページ数: ${finalResult.statistics.totalPages}`);
    console.log(`   - 総キーワード数: ${finalResult.statistics.totalKeywords}`);
    console.log(`   - ドメイン名数: ${finalResult.statistics.domainNames}`);
    console.log(`   - 削減率: ${finalResult.statistics.reductionRate ? finalResult.statistics.reductionRate.toFixed(1) : 0}%`);
    console.log(`   - 保護キーワード数: ${finalResult.statistics.protectedKeywords}`);
    
    console.log('\n🎉 データドリブンなドメイン知識抽出パイプライン完了！');
    
  } catch (error) {
    console.error('❌ パイプライン実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// コマンドライン引数の処理
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
データドリブンなドメイン知識抽出パイプライン

使用方法:
  npm run domain-knowledge-extraction-v2 [オプション]

オプション:
  --help, -h     このヘルプを表示
  --steps        実行するステップを指定 (confluence,llm,validation)
  --config       設定ファイルのパスを指定

例:
  npm run domain-knowledge-extraction-v2
  npm run domain-knowledge-extraction-v2 -- --steps confluence,llm
  `);
  process.exit(0);
}

// メイン実行
if (require.main === module) {
  main().catch(console.error);
}
