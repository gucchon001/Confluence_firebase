/**
 * Domain Knowledge読み込みサービス
 * Phase 0A-1: StructuredLabel生成で使用
 */

import * as fs from 'fs';
import * as path from 'path';

export interface DomainKnowledge {
  domainNames: string[];
  systemFields: string[];
  systemTerms: string[];
  metadata?: {
    extractedAt: string;
    version: string;
    totalPages: number;
    totalKeywords: number;
  };
}

// グローバルキャッシュ（メモリに保持）
let cachedDomainKnowledge: DomainKnowledge | null = null;

/**
 * Domain Knowledgeを読み込む（キャッシュあり）
 */
export async function loadDomainKnowledge(): Promise<DomainKnowledge> {
  // キャッシュがあれば返す
  if (cachedDomainKnowledge) {
    return cachedDomainKnowledge;
  }
  
  try {
    const filePath = path.join(
      process.cwd(),
      'data/domain-knowledge-v2/final-domain-knowledge-v2.json'
    );
    
    console.log(`📚 Domain Knowledgeを読み込み中: ${filePath}`);
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    cachedDomainKnowledge = {
      domainNames: data.domainNames || [],
      systemFields: data.systemFields || [],
      systemTerms: data.systemTerms || [],
      metadata: data.metadata || data.statistics
    };
    
    console.log(`✅ Domain Knowledge読み込み完了:`);
    console.log(`   - ドメイン数: ${cachedDomainKnowledge.domainNames.length}`);
    console.log(`   - システム項目数: ${cachedDomainKnowledge.systemFields.length}`);
    console.log(`   - システム用語数: ${cachedDomainKnowledge.systemTerms.length}`);
    
    return cachedDomainKnowledge;
  } catch (error: any) {
    console.error('❌ Domain Knowledge読み込みエラー:', error.message);
    
    // フォールバック: 空のデータを返す
    cachedDomainKnowledge = {
      domainNames: [],
      systemFields: [],
      systemTerms: []
    };
    
    return cachedDomainKnowledge;
  }
}

/**
 * キャッシュをクリア（テスト用）
 */
export function clearDomainKnowledgeCache(): void {
  cachedDomainKnowledge = null;
}

/**
 * ドメイン名の候補を抽出（テキストマッチング）
 */
export function findDomainCandidates(
  text: string,
  domainKnowledge: DomainKnowledge,
  maxResults: number = 5
): string[] {
  const normalizedText = text.toLowerCase();
  
  const candidates = domainKnowledge.domainNames.filter(domain =>
    normalizedText.includes(domain.toLowerCase())
  );
  
  return candidates.slice(0, maxResults);
}

/**
 * システム用語の候補を抽出（タグ用）
 */
export function findTermCandidates(
  text: string,
  domainKnowledge: DomainKnowledge,
  maxResults: number = 10
): string[] {
  const normalizedText = text.toLowerCase();
  
  const candidates = domainKnowledge.systemTerms.filter(term =>
    normalizedText.includes(term.toLowerCase())
  );
  
  return candidates.slice(0, maxResults);
}

