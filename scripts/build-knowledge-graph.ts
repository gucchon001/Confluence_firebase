/**
 * Knowledge Graph構築スクリプト（Phase 0A-2）
 */

import 'dotenv/config';
import { optimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import { getStructuredLabels } from '../src/lib/structured-label-service-admin';
import { kgReferenceExtractor } from '../src/lib/kg-reference-extractor';
import { kgLabelBuilder } from '../src/lib/kg-label-builder';
import { kgStorageService } from '../src/lib/kg-storage-service';
import type { KGNode, KGEdge } from '../src/types/knowledge-graph';

async function main() {
  console.log('\n🕸️ Knowledge Graph構築開始\n');
  
  try {
    // Step 1: 全ページを取得
    console.log('📦 LanceDBから全ページを取得中...');
    const connection = await optimizedLanceDBClient.getConnection();
    const table = connection.table;
    
    const arrow = await table.query().toArrow();
    
    const pages: Array<{
      pageId: string;
      title: string;
      content: string;
    }> = [];
    
    const pageIdSet = new Set<string>();
    
    for (let i = 0; i < arrow.numRows; i++) {
      const row: any = {};
      for (let j = 0; j < arrow.schema.fields.length; j++) {
        const field = arrow.schema.fields[j];
        const column = arrow.getChildAt(j);
        row[field.name] = column?.get(i);
      }
      
      const pageId = String(row.pageId || '');
      
      // 重複排除（chunk単位で保存されているため）
      if (pageIdSet.has(pageId)) continue;
      pageIdSet.add(pageId);
      
      pages.push({
        pageId,
        title: row.title || '',
        content: row.content || ''
      });
    }
    
    console.log(`✅ ${pages.length}ページ取得完了\n`);
    
    // Step 2: StructuredLabelsを取得
    console.log('🏷️ StructuredLabelsを取得中...');
    const pageIds = pages.map(p => p.pageId);
    const labelsMap = await getStructuredLabels(pageIds);
    console.log(`✅ ${labelsMap.size}件のラベル取得完了\n`);
    
    // Step 3: 参照関係を抽出
    console.log('🔗 参照関係を抽出中...');
    const referenceEdges: KGEdge[] = [];
    
    for (const page of pages) {
      const edges = kgReferenceExtractor.extractReferences(
        page.pageId,
        page.title,
        page.content
      );
      
      referenceEdges.push(...edges);
    }
    
    console.log(`✅ ${referenceEdges.length}件の参照関係を抽出\n`);
    
    // Step 4: StructuredLabelベースの関係を構築
    console.log('🏷️ StructuredLabelベースの関係を構築中...');
    
    const domainEdges = kgLabelBuilder.buildDomainEdges(labelsMap);
    console.log(`  ドメイン関係: ${domainEdges.length}件`);
    
    const tagEdges = kgLabelBuilder.buildTagEdges(labelsMap);
    console.log(`  タグ関係: ${tagEdges.length}件`);
    
    const conceptNodes = kgLabelBuilder.buildConceptNodes(labelsMap);
    console.log(`  概念ノード: ${conceptNodes.length}件\n`);
    
    // Step 5: ページノードを構築
    console.log('📄 ページノードを構築中...');
    const pageNodes: KGNode[] = pages.map(page => {
      const label = labelsMap.get(page.pageId);
      
      return {
        id: `page-${page.pageId}`,
        type: 'page' as const,
        name: page.title,
        pageId: page.pageId,
        structuredLabel: label,
        importance: 1.0  // 初期値（PageRankは後で計算）
      };
    });
    
    console.log(`✅ ${pageNodes.length}件のページノード構築完了\n`);
    
    // Step 6: Firestoreに保存
    console.log('💾 Firestoreに保存中...');
    
    const allNodes = [...pageNodes, ...conceptNodes];
    const allEdges = [...referenceEdges, ...domainEdges, ...tagEdges];
    
    console.log(`  ノード総数: ${allNodes.length}件`);
    console.log(`  エッジ総数: ${allEdges.length}件`);
    
    await kgStorageService.saveNodesBatch(allNodes);
    await kgStorageService.saveEdgesBatch(allEdges);
    
    console.log('✅ Firestore保存完了\n');
    
    // Step 7: 統計情報を表示
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Knowledge Graph構築完了');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ノード総数: ${allNodes.length}件`);
    console.log(`  - ページノード: ${pageNodes.length}件`);
    console.log(`  - 概念ノード: ${conceptNodes.length}件`);
    console.log(`エッジ総数: ${allEdges.length}件`);
    console.log(`  - 参照関係: ${referenceEdges.length}件`);
    console.log(`  - ドメイン関係: ${domainEdges.length}件`);
    console.log(`  - タグ関係: ${tagEdges.length}件`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

