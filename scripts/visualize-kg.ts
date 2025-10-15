/**
 * Knowledge Graph可視化スクリプト
 * 特定のページを中心としたKG構造を表示
 */

import { kgStorageService } from '../src/lib/kg-storage-service';
import { kgSearchService } from '../src/lib/kg-search-service';

async function visualizeKG(centerPageId: string, depth: number = 2) {
  console.log('\n🕸️ Knowledge Graph可視化\n');
  console.log(`中心ページ: ${centerPageId}`);
  console.log(`探索深度: ${depth}\n`);
  
  // 中心ノードを取得
  const centerNode = await kgStorageService.getNode(`page-${centerPageId}`);
  
  if (!centerNode) {
    console.error(`❌ ページ ${centerPageId} が見つかりません`);
    return;
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📄 中心ページ: ${centerNode.name}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 1-hop: 参照関係（reference/implements）
  console.log('🔗 参照関係（Reference/Implements）\n');
  
  const outgoingEdges = await kgStorageService.getOutgoingEdges(`page-${centerPageId}`);
  const referenceEdges = outgoingEdges.filter(e => 
    e.type === 'reference' || e.type === 'implements'
  );
  
  if (referenceEdges.length > 0) {
    const targetNodeIds = referenceEdges.map(e => e.to);
    const targetNodes = await kgStorageService.getNodes(targetNodeIds);
    
    for (const edge of referenceEdges) {
      const targetNode = targetNodes.get(edge.to);
      if (targetNode) {
        const arrow = edge.type === 'implements' ? '⇒' : '→';
        console.log(`  ${centerNode.name}`);
        console.log(`    ${arrow} [${edge.type}] (weight: ${edge.weight})`);
        console.log(`    ${targetNode.name}`);
        
        if (edge.metadata?.matchPattern) {
          console.log(`    📝 抽出元: "${edge.metadata.matchPattern}"`);
        }
        console.log('');
      }
    }
  } else {
    console.log('  （なし）\n');
  }
  
  // 2-hop: ドメイン関連（related - domain-based）
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏷️ ドメイン関連（Related - Domain-based）\n');
  
  const domainEdges = outgoingEdges.filter(e => 
    e.type === 'related' && e.metadata?.domain
  ).slice(0, 5); // 上位5件
  
  if (domainEdges.length > 0) {
    const targetNodeIds = domainEdges.map(e => e.to);
    const targetNodes = await kgStorageService.getNodes(targetNodeIds);
    
    for (const edge of domainEdges) {
      const targetNode = targetNodes.get(edge.to);
      if (targetNode) {
        console.log(`  ${centerNode.name}`);
        console.log(`    ⟷ [domain: ${edge.metadata?.domain}] (weight: ${edge.weight.toFixed(2)})`);
        console.log(`    ${targetNode.name}`);
        console.log('');
      }
    }
  } else {
    console.log('  （なし）\n');
  }
  
  // 3-hop: タグ関連（related - tag-based）
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏷️ タグ関連（Related - Tag-based）\n');
  
  const tagEdges = outgoingEdges.filter(e => 
    e.type === 'related' && e.metadata?.tagSimilarity
  ).slice(0, 5); // 上位5件
  
  if (tagEdges.length > 0) {
    const targetNodeIds = tagEdges.map(e => e.to);
    const targetNodes = await kgStorageService.getNodes(targetNodeIds);
    
    for (const edge of tagEdges) {
      const targetNode = targetNodes.get(edge.to);
      if (targetNode) {
        const similarity = (edge.metadata?.tagSimilarity || 0) * 100;
        console.log(`  ${centerNode.name}`);
        console.log(`    ⟷ [tag similarity: ${similarity.toFixed(0)}%] (weight: ${edge.weight.toFixed(2)})`);
        console.log(`    ${targetNode.name}`);
        console.log('');
      }
    }
  } else {
    console.log('  （なし）\n');
  }
  
  // 統計情報
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 統計情報\n');
  
  const stats = await kgStorageService.getStats();
  console.log(`総ノード数: ${stats.nodeCount}件`);
  console.log(`総エッジ数: ${stats.edgeCount}件`);
  console.log(`\nノード種別:`);
  Object.entries(stats.nodesByType).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}件`);
  });
  console.log(`\nエッジ種別:`);
  Object.entries(stats.edgesByType).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}件`);
  });
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function generateDOT(centerPageId: string, depth: number = 2) {
  console.log('\n🎨 Graphviz DOT形式でエクスポート\n');
  
  // 中心ノードを取得
  const centerNode = await kgStorageService.getNode(`page-${centerPageId}`);
  
  if (!centerNode) {
    console.error(`❌ ページ ${centerPageId} が見つかりません`);
    return;
  }
  
  let dot = 'digraph KnowledgeGraph {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box, style=rounded];\n\n';
  
  // 中心ノード
  dot += `  "${centerNode.name}" [style="rounded,filled", fillcolor=lightblue];\n\n`;
  
  // エッジを取得
  const outgoingEdges = await kgStorageService.getOutgoingEdges(`page-${centerPageId}`);
  
  // 参照関係
  const referenceEdges = outgoingEdges.filter(e => 
    e.type === 'reference' || e.type === 'implements'
  );
  
  if (referenceEdges.length > 0) {
    const targetNodeIds = referenceEdges.map(e => e.to);
    const targetNodes = await kgStorageService.getNodes(targetNodeIds);
    
    for (const edge of referenceEdges) {
      const targetNode = targetNodes.get(edge.to);
      if (targetNode) {
        const color = edge.type === 'implements' ? 'red' : 'blue';
        dot += `  "${centerNode.name}" -> "${targetNode.name}" [label="${edge.type}", color=${color}, penwidth=2];\n`;
      }
    }
  }
  
  // ドメイン関連（上位5件）
  const domainEdges = outgoingEdges.filter(e => 
    e.type === 'related' && e.metadata?.domain
  ).slice(0, 5);
  
  if (domainEdges.length > 0) {
    const targetNodeIds = domainEdges.map(e => e.to);
    const targetNodes = await kgStorageService.getNodes(targetNodeIds);
    
    for (const edge of domainEdges) {
      const targetNode = targetNodes.get(edge.to);
      if (targetNode) {
        dot += `  "${centerNode.name}" -> "${targetNode.name}" [label="${edge.metadata?.domain}", color=green, style=dashed];\n`;
      }
    }
  }
  
  dot += '}\n';
  
  console.log(dot);
  console.log('\n💡 使い方:');
  console.log('  1. 上記のDOT形式をコピー');
  console.log('  2. https://dreampuf.github.io/GraphvizOnline/ に貼り付け');
  console.log('  3. またはローカルで: dot -Tpng -o kg.png kg.dot\n');
}

async function main() {
  const args = process.argv.slice(2);
  const centerPageId = args[0] || '164'; // デフォルトは164_教室削除機能
  const format = args[1] || 'text'; // text or dot
  
  if (format === 'dot') {
    await generateDOT(centerPageId);
  } else {
    await visualizeKG(centerPageId);
  }
}

main().catch(console.error);

