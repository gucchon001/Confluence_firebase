/**
 * GraphRAG用のナレッジグラフデータ生成スクリプト
 * domain-knowledge-extractionの結果からグラフデータを生成
 */

import fs from 'fs';
import path from 'path';

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
  };
}

interface ConfluencePage {
  id: string;
  title: string;
  content: string;
  parentId?: string;
  parentTitle?: string;
  labels: string[];
  url: string;
  spaceKey: string;
  lastModified: string;
  author: string;
}

interface GraphNode {
  id: string;
  type: 'Function' | 'SystemItem' | 'Keyword' | 'Page' | 'Label';
  name: string;
  properties: Record<string, any>;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: 'DESCRIBES' | 'CONTAINS' | 'RELATES_TO' | 'ASSOCIATED_WITH' | 'TAGGED_WITH';
  properties?: Record<string, any>;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    generatedAt: string;
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<string, number>;
  };
}

export class GraphDataGenerator {
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private nodeIdCounter = 1;

  constructor() {
    this.nodes = [];
    this.edges = [];
  }

  /**
   * ドメイン知識データからグラフデータを生成
   */
  async generateGraphData(): Promise<GraphData> {
    console.log('🔍 ドメイン知識データを読み込み中...');
    
    // 既存のドメイン知識データを読み込み
    const knowledgeData = await this.loadKnowledgeData();
    const confluenceData = await this.loadConfluenceData();

    console.log(`📊 処理対象: ${knowledgeData.length}件の知識データ`);

    // 各ページの知識データを処理
    for (const knowledge of knowledgeData) {
      await this.processKnowledgeItem(knowledge, confluenceData);
    }

    // ラベル関係を追加
    await this.addLabelRelationships(confluenceData);

    // 統計情報を生成
    const metadata = this.generateMetadata();

    const graphData: GraphData = {
      nodes: this.nodes,
      edges: this.edges,
      metadata
    };

    console.log(`✅ グラフデータ生成完了: ${metadata.totalNodes}ノード, ${metadata.totalEdges}エッジ`);

    return graphData;
  }

  /**
   * 知識データを処理してノードとエッジを生成
   */
  private async processKnowledgeItem(knowledge: ExtractedKnowledge, confluenceData: ConfluencePage[]): Promise<void> {
    const page = confluenceData.find(p => p.id === knowledge.pageId);
    if (!page) return;

    // ページノードを作成
    const pageNodeId = this.createNode('Page', page.title, {
      pageId: page.id,
      url: page.url,
      spaceKey: page.spaceKey,
      lastModified: page.lastModified,
      author: page.author,
      confidence: knowledge.confidence
    });

    // 各機能を処理
    for (const [functionName, keywords] of Object.entries(knowledge.functions)) {
      // 機能ノードを作成
      const functionNodeId = this.createNode('Function', functionName, {
        pageId: knowledge.pageId,
        confidence: knowledge.confidence,
        keywordCount: keywords.length
      });

      // ページ -> 機能の関係
      this.createEdge(pageNodeId, functionNodeId, 'DESCRIBES');

      // キーワードノードとエッジを作成
      for (const keyword of keywords) {
        const keywordNodeId = this.createNode('Keyword', keyword, {
          pageId: knowledge.pageId,
          functionName: functionName
        });

        // 機能 -> キーワードの関係
        this.createEdge(functionNodeId, keywordNodeId, 'ASSOCIATED_WITH');

        // システム項目として分類されるキーワードを特定
        if (this.isSystemItem(keyword)) {
          const systemItemNodeId = this.createNode('SystemItem', keyword, {
            pageId: knowledge.pageId,
            functionName: functionName,
            type: this.getSystemItemType(keyword)
          });

          // 機能 -> システム項目の関係
          this.createEdge(functionNodeId, systemItemNodeId, 'CONTAINS');
        }
      }
    }
  }

  /**
   * ラベル関係を追加
   */
  private async addLabelRelationships(confluenceData: ConfluencePage[]): Promise<void> {
    for (const page of confluenceData) {
      const pageNode = this.nodes.find(n => n.type === 'Page' && n.properties.pageId === page.id);
      if (!pageNode) continue;

      for (const label of page.labels) {
        const labelNodeId = this.createNode('Label', label, {
          type: this.getLabelType(label)
        });

        // ページ -> ラベルの関係
        this.createEdge(pageNode.id, labelNodeId, 'TAGGED_WITH');
      }
    }
  }

  /**
   * ノードを作成
   */
  private createNode(type: GraphNode['type'], name: string, properties: Record<string, any>): string {
    const nodeId = `node_${this.nodeIdCounter++}`;
    
    const node: GraphNode = {
      id: nodeId,
      type,
      name,
      properties
    };

    this.nodes.push(node);
    return nodeId;
  }

  /**
   * エッジを作成
   */
  private createEdge(source: string, target: string, relationship: GraphEdge['relationship'], properties?: Record<string, any>): void {
    const edge: GraphEdge = {
      source,
      target,
      relationship,
      properties
    };

    this.edges.push(edge);
  }

  /**
   * システム項目かどうかを判定
   */
  private isSystemItem(keyword: string): boolean {
    const systemItemPatterns = [
      /ボタン$/,
      /フォーム$/,
      /フィールド$/,
      /入力$/,
      /選択$/,
      /チェック$/,
      /ラベル$/,
      /メニュー$/,
      /タブ$/,
      /モーダル$/,
      /ダイアログ$/,
      /テーブル$/,
      /リスト$/,
      /カード$/,
      /パネル$/,
      /ウィンドウ$/,
      /画面$/,
      /ページ$/,
      /API$/,
      /エンドポイント$/,
      /データベース$/,
      /テーブル$/,
      /カラム$/,
      /フィールド$/,
      /CSV$/,
      /Excel$/,
      /PDF$/,
      /ファイル$/
    ];

    return systemItemPatterns.some(pattern => pattern.test(keyword));
  }

  /**
   * システム項目のタイプを取得
   */
  private getSystemItemType(keyword: string): string {
    if (/ボタン$/.test(keyword)) return 'Button';
    if (/フォーム$/.test(keyword)) return 'Form';
    if (/フィールド$/.test(keyword)) return 'Field';
    if (/API$/.test(keyword)) return 'API';
    if (/データベース$/.test(keyword)) return 'Database';
    if (/CSV$/.test(keyword) || /Excel$/.test(keyword) || /PDF$/.test(keyword)) return 'File';
    return 'UIComponent';
  }

  /**
   * ラベルのタイプを取得
   */
  private getLabelType(label: string): string {
    const labelTypes: Record<string, string> = {
      '機能要件': 'Requirement',
      '非機能要件': 'Requirement',
      '高優先度': 'Priority',
      '中優先度': 'Priority',
      '低優先度': 'Priority',
      '完了': 'Status',
      '進行中': 'Status',
      '未完了': 'Status',
      'レビュー中': 'Status',
      'アーカイブ': 'Status',
      'フォルダ': 'Category',
      '帳票': 'Category',
      'ワークフロー': 'Category',
      'メールテンプレート': 'Category'
    };

    return labelTypes[label] || 'General';
  }

  /**
   * 統計情報を生成
   */
  private generateMetadata() {
    const nodeTypes: Record<string, number> = {};
    for (const node of this.nodes) {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    }

    return {
      generatedAt: new Date().toISOString(),
      totalNodes: this.nodes.length,
      totalEdges: this.edges.length,
      nodeTypes
    };
  }

  /**
   * ドメイン知識データを読み込み
   */
  private async loadKnowledgeData(): Promise<ExtractedKnowledge[]> {
    const filePath = path.join(process.cwd(), 'data/llm-extraction-v2/extracted-knowledge-v2.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('ドメイン知識データが見つかりません。先にdomain-knowledge-extractionを実行してください。');
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data : data.results || [];
  }

  /**
   * Confluenceデータを読み込み
   */
  private async loadConfluenceData(): Promise<ConfluencePage[]> {
    const filePath = path.join(process.cwd(), 'data/confluence-extraction-v2/confluence-data.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Confluenceデータが見つかりません。先にdomain-knowledge-extractionを実行してください。');
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.pages || [];
  }

  /**
   * グラフデータをファイルに保存
   */
  async saveGraphData(graphData: GraphData, outputDir: string = 'data/graph-data'): Promise<void> {
    // 出力ディレクトリを作成
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // JSON形式で保存
    const jsonPath = path.join(outputDir, 'knowledge-graph.json');
    fs.writeFileSync(jsonPath, JSON.stringify(graphData, null, 2));

    // Neo4j用のCSVファイルを生成
    await this.generateNeo4jCSV(graphData, outputDir);

    // 統計レポートを生成
    await this.generateReport(graphData, outputDir);

    console.log(`💾 グラフデータを保存しました: ${outputDir}`);
  }

  /**
   * Neo4j用のCSVファイルを生成
   */
  private async generateNeo4jCSV(graphData: GraphData, outputDir: string): Promise<void> {
    // ノードCSV
    const nodesCsv = this.generateNodesCSV(graphData.nodes);
    fs.writeFileSync(path.join(outputDir, 'nodes.csv'), nodesCsv);

    // エッジCSV
    const edgesCsv = this.generateEdgesCSV(graphData.edges);
    fs.writeFileSync(path.join(outputDir, 'edges.csv'), edgesCsv);

    console.log('📊 Neo4j用CSVファイルを生成しました');
  }

  /**
   * ノードCSVを生成
   */
  private generateNodesCSV(nodes: GraphNode[]): string {
    const headers = ['id:ID', 'type:LABEL', 'name', 'properties'];
    const rows = nodes.map(node => [
      node.id,
      node.type,
      `"${node.name}"`,
      JSON.stringify(node.properties)
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * エッジCSVを生成
   */
  private generateEdgesCSV(edges: GraphEdge[]): string {
    const headers = [':START_ID', ':END_ID', ':TYPE', 'properties'];
    const rows = edges.map(edge => [
      edge.source,
      edge.target,
      edge.relationship,
      edge.properties ? JSON.stringify(edge.properties) : '{}'
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * 統計レポートを生成
   */
  private async generateReport(graphData: GraphData, outputDir: string): Promise<void> {
    const report = `
# GraphRAG ナレッジグラフ統計レポート

## 生成日時
${graphData.metadata.generatedAt}

## 基本統計
- 総ノード数: ${graphData.metadata.totalNodes}
- 総エッジ数: ${graphData.metadata.totalEdges}

## ノードタイプ別統計
${Object.entries(graphData.metadata.nodeTypes)
  .map(([type, count]) => `- ${type}: ${count}件`)
  .join('\n')}

## 関係性別統計
${this.getRelationshipStats(graphData.edges)}

## グラフの特徴
- 平均接続数: ${(graphData.metadata.totalEdges / graphData.metadata.totalNodes).toFixed(2)}
- 最大接続ノード: ${this.getMostConnectedNode(graphData)}

## 推奨事項
1. Neo4jにインポートしてクエリテストを実行
2. グラフの可視化で関係性を確認
3. 検索クエリのテストケースを作成
`;

    fs.writeFileSync(path.join(outputDir, 'graph-report.md'), report);
  }

  private getRelationshipStats(edges: GraphEdge[]): string {
    const stats: Record<string, number> = {};
    for (const edge of edges) {
      stats[edge.relationship] = (stats[edge.relationship] || 0) + 1;
    }

    return Object.entries(stats)
      .map(([rel, count]) => `- ${rel}: ${count}件`)
      .join('\n');
  }

  private getMostConnectedNode(graphData: GraphData): string {
    const connections: Record<string, number> = {};
    
    for (const edge of graphData.edges) {
      connections[edge.source] = (connections[edge.source] || 0) + 1;
      connections[edge.target] = (connections[edge.target] || 0) + 1;
    }

    const maxConnections = Math.max(...Object.values(connections));
    const mostConnected = Object.entries(connections).find(([, count]) => count === maxConnections);
    
    if (mostConnected) {
      const node = graphData.nodes.find(n => n.id === mostConnected[0]);
      return node ? `${node.name} (${node.type})` : '不明';
    }
    
    return '不明';
  }
}

// メイン実行
async function main() {
  try {
    console.log('🚀 GraphRAG用ナレッジグラフデータ生成を開始...');
    
    const generator = new GraphDataGenerator();
    const graphData = await generator.generateGraphData();
    
    await generator.saveGraphData(graphData);
    
    console.log('✅ GraphRAG用ナレッジグラフデータ生成完了！');
    console.log(`📊 生成されたデータ: ${graphData.metadata.totalNodes}ノード, ${graphData.metadata.totalEdges}エッジ`);
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain()を呼び出し
if (require.main === module) {
  main();
}

// GraphDataGenerator is already exported above
