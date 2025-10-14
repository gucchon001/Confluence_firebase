/**
 * StructuredLabelからKnowledge Graph関係を構築（Phase 0A-2）
 */

import type { StructuredLabel } from '@/types/structured-label';
import type { KGEdge, KGNode } from '@/types/knowledge-graph';

/**
 * StructuredLabelベースのKG構築サービス
 */
export class KGLabelBuilder {
  /**
   * ドメイン関係を構築
   */
  buildDomainEdges(
    labels: Map<string, StructuredLabel>
  ): KGEdge[] {
    const edges: KGEdge[] = [];
    const domainGroups = new Map<string, string[]>();
    
    // ドメインでグループ化
    labels.forEach((label, pageId) => {
      if (!domainGroups.has(label.domain)) {
        domainGroups.set(label.domain, []);
      }
      domainGroups.get(label.domain)!.push(pageId);
    });
    
    // 同一ドメイン内のページを相互リンク
    domainGroups.forEach((pageIds, domain) => {
      for (let i = 0; i < pageIds.length; i++) {
        for (let j = i + 1; j < pageIds.length; j++) {
          const label1 = labels.get(pageIds[i])!;
          const label2 = labels.get(pageIds[j])!;
          
          // カテゴリが同じ場合は重み増加
          const categoryBonus = label1.category === label2.category ? 0.2 : 0;
          
          edges.push({
            id: `${pageIds[i]}-domain-${pageIds[j]}`,
            from: `page-${pageIds[i]}`,
            to: `page-${pageIds[j]}`,
            type: 'related',
            weight: 0.5 + categoryBonus,
            extractedFrom: 'structured-label',
            metadata: {
              domain
            }
          });
        }
      }
    });
    
    return edges;
  }
  
  /**
   * タグ関係を構築（Jaccard類似度ベース）
   */
  buildTagEdges(
    labels: Map<string, StructuredLabel>
  ): KGEdge[] {
    const edges: KGEdge[] = [];
    
    const labelsArray = Array.from(labels.entries());
    
    for (let i = 0; i < labelsArray.length; i++) {
      for (let j = i + 1; j < labelsArray.length; j++) {
        const [pageId1, label1] = labelsArray[i];
        const [pageId2, label2] = labelsArray[j];
        
        // タグがない場合はスキップ
        if (!label1.tags || !label2.tags) continue;
        if (label1.tags.length === 0 || label2.tags.length === 0) continue;
        
        // Jaccard類似度を計算
        const tags1 = new Set(label1.tags);
        const tags2 = new Set(label2.tags);
        
        const intersection = new Set(
          [...tags1].filter(tag => tags2.has(tag))
        );
        
        const union = new Set([...tags1, ...tags2]);
        
        const jaccardSimilarity = intersection.size / union.size;
        
        // 類似度が0.3以上の場合のみエッジを作成
        if (jaccardSimilarity >= 0.3) {
          edges.push({
            id: `${pageId1}-tag-${pageId2}`,
            from: `page-${pageId1}`,
            to: `page-${pageId2}`,
            type: 'related',
            weight: jaccardSimilarity,
            extractedFrom: 'structured-label',
            metadata: {
              tagSimilarity: jaccardSimilarity
            }
          });
        }
      }
    }
    
    return edges;
  }
  
  /**
   * ドメイン・カテゴリノードを構築
   */
  buildConceptNodes(
    labels: Map<string, StructuredLabel>
  ): KGNode[] {
    const nodes: KGNode[] = [];
    const domains = new Set<string>();
    const categories = new Set<string>();
    
    // ドメインとカテゴリを収集
    labels.forEach(label => {
      domains.add(label.domain);
      categories.add(label.category);
    });
    
    // ドメインノードを作成
    domains.forEach(domain => {
      nodes.push({
        id: `domain-${domain}`,
        type: 'domain',
        name: domain,
        properties: {
          pageCount: Array.from(labels.values()).filter(l => l.domain === domain).length
        }
      });
    });
    
    // カテゴリノードを作成
    categories.forEach(category => {
      nodes.push({
        id: `category-${category}`,
        type: 'category',
        name: category,
        properties: {
          pageCount: Array.from(labels.values()).filter(l => l.category === category).length
        }
      });
    });
    
    return nodes;
  }
}

export const kgLabelBuilder = new KGLabelBuilder();

