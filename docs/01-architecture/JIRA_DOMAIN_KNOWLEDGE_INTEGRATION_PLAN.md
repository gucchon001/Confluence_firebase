# Jira課題へのドメイン知識統合計画

**作成日**: 2025年1月  
**ステータス**: 📋 計画段階

---

## 📋 概要

現在、ドメイン知識はConfluenceページのStructuredLabel生成にのみ使用されています。この計画では、Jira課題にもドメイン知識を適用し、StructuredLabel生成機能を追加します。

---

## 🎯 目標

1. **Jira課題のStructuredLabel生成**: Jira課題にもStructuredLabelを生成
2. **ドメイン知識の活用**: Jira課題にもドメイン知識を使用したラベル生成
3. **統一的なラベル管理**: ConfluenceとJiraで統一的なStructuredLabel管理

---

## 📊 現状分析

### ✅ 実装済み（Confluence）

- **StructuredLabel生成**: `auto-label-flow.ts`で実装済み
- **ドメイン知識の使用**: LLM生成時に使用
- **保存先**: Firestore `structuredLabels`コレクション
- **統合先**: LanceDB `confluence`テーブル（`structured_*`フィールド）

### ❌ 未実装（Jira）

- **StructuredLabel生成**: 未実装
- **ドメイン知識の使用**: 未実装
- **保存先**: Firestore（未実装）
- **統合先**: LanceDB `jira_issues`テーブル（未実装）

---

## 🔧 実装計画

### Phase 1: `auto-label-flow.ts`のJira対応

**方針**: 既存の`auto-label-flow.ts`を拡張して、Jira課題にも対応させる

#### 変更点

1. **入力スキーマの拡張**
```typescript
const InputSchema = z.object({
  title: z.string(),
  content: z.string(),
  labels: z.array(z.string()),
  // 新規追加
  source: z.enum(['confluence', 'jira']).optional().default('confluence'),
  issueType: z.string().optional(),      // Jira特有
  status: z.string().optional(),          // Jira特有（既存statusとの重複注意）
  priority: z.string().optional(),        // Jira特有
});
```

2. **プロンプトの調整**
```typescript
function buildLLMPrompt(
  input: z.infer<typeof InputSchema>,
  domainCandidates: string[],
  topDomains: string[],
  source: 'confluence' | 'jira' = 'confluence'
): string {
  const sourceName = source === 'jira' ? 'Jira課題' : 'Confluenceページ';
  
  return `以下の${sourceName}を分析し、StructuredLabelを生成してJSON形式で出力してください。

【${sourceName}情報】
タイトル: ${input.title}
内容: ${input.content.substring(0, 1500)}...
既存ラベル: ${input.labels.join(', ')}
${source === 'jira' ? `
【Jira特有情報】
種別: ${input.issueType || 'N/A'}
ステータス: ${input.status || 'N/A'}
優先度: ${input.priority || 'N/A'}` : ''}

【重要: この${sourceName}に関連するドメイン候補（優先的に使用）】
${domainCandidates.length > 0 ? domainCandidates.join(', ') : '（該当なし）'}

【参考: ドメイン一覧（上位30件）】
${topDomains.join(', ')}
...
`;
}
```

3. **ルールベース生成の調整**
```typescript
function tryRuleBasedLabeling(
  input: z.infer<typeof InputSchema>
): StructuredLabel | null {
  // Jiraの場合は既存のステータス/優先度を活用
  const status = input.source === 'jira' 
    ? mapJiraStatusToStructuredStatus(input.status)  // 新規関数
    : StructuredLabelHelper.extractStatusFromTitle(input.title);
  
  // ドメイン推測は共通ロジックを使用
  const domain = StructuredLabelHelper.inferDomainFromContent(
    input.title, 
    input.content
  );
  
  // ... 残りのロジック
}
```

4. **Jiraステータスマッピング関数の追加**
```typescript
function mapJiraStatusToStructuredStatus(jiraStatus?: string): DocumentStatus {
  if (!jiraStatus) return 'unknown';
  
  const statusLower = jiraStatus.toLowerCase();
  if (statusLower.includes('完了') || statusLower.includes('done')) {
    return 'approved';
  }
  if (statusLower.includes('進行中') || statusLower.includes('in progress')) {
    return 'review';
  }
  if (statusLower.includes('作成中') || statusLower.includes('to do')) {
    return 'draft';
  }
  return 'unknown';
}
```

### Phase 2: Jira課題用のStructuredLabel生成スクリプト

**新規ファイル**: `scripts/generate-jira-structured-labels.ts`

```typescript
async function main() {
  // Step 1: Domain Knowledgeを読み込み
  const domainKnowledge = await loadDomainKnowledge();
  
  // Step 2: LanceDBに接続（jira_issuesテーブル）
  const lanceDb = await lancedb.connect('.lancedb');
  const table = await lanceDb.openTable('jira_issues');
  
  // Step 3: 全課題を取得
  const arrow = await table.query().limit(maxIssues).toArrow();
  
  // Step 4: 各課題に対してStructuredLabelを生成
  for (const issue of issues) {
    const label = await autoLabelFlow({
      title: issue.summary || issue.title,
      content: (issue.description || '') + ' ' + (issue.latestComment || ''),
      labels: issue.labels || [],
      source: 'jira',
      issueType: issue.issue_type,
      status: issue.status,
      priority: issue.priority,
    });
    
    // Step 5: Firestoreに保存
    await saveStructuredLabel(issue.issue_key, label, 'llm-based');
  }
}
```

### Phase 3: LanceDB `jira_issues`テーブルへの統合

**新規ファイル**: `scripts/sync-firestore-jira-labels-to-lancedb.ts`

```typescript
async function syncJiraLabelsToLanceDB() {
  // Firestoreから全Jira課題のStructuredLabelを取得
  const labelsMap = await getAllJiraStructuredLabels();
  
  // LanceDBに接続
  const db = await connect('.lancedb');
  const table = await db.openTable('jira_issues');
  
  // 既存データを取得
  const existingData = await table.query().toArrow();
  
  // StructuredLabelを統合
  for (const record of existingData) {
    const issueKey = record.issue_key || record.id;
    const structuredLabel = labelsMap.get(issueKey);
    
    if (structuredLabel) {
      // structured_*フィールドに統合
      const extendedRecord = {
        ...record,
        ...flattenStructuredLabel(structuredLabel),
      };
      
      // 更新
      await table.update(extendedRecord);
    }
  }
}
```

### Phase 4: 検索システムへの統合

**既存ファイル**: `src/lib/composite-scoring-service.ts`

- 既存の実装で`jira_issues`テーブルも対応済み（`extractStructuredLabel`で共通処理）
- 追加実装不要

---

## 📝 実装手順

### Step 1: `auto-label-flow.ts`のJira対応

1. 入力スキーマに`source`フィールドを追加
2. プロンプト生成関数をJira対応
3. ルールベース生成関数をJira対応
4. Jiraステータスマッピング関数を追加

### Step 2: Jira課題用のStructuredLabel生成スクリプト

1. `scripts/generate-jira-structured-labels.ts`を作成
2. LanceDB `jira_issues`テーブルから課題を読み込み
3. `auto-label-flow`を呼び出してラベル生成
4. Firestoreに保存

### Step 3: LanceDB統合

1. `scripts/sync-firestore-jira-labels-to-lancedb.ts`を作成
2. FirestoreからJira課題のStructuredLabelを取得
3. LanceDB `jira_issues`テーブルに統合

### Step 4: データ同期

1. Jira課題のStructuredLabelを生成
2. Firestoreに保存
3. LanceDBに同期
4. インデックス再作成
5. GCSにアップロード

---

## ⚠️ 注意事項

### 1. ステータスの重複回避

- Jiraの`status`フィールドとStructuredLabelの`status`フィールドの重複
- マッピング関数で適切に変換

### 2. ドメイン知識の適用範囲

- Confluenceと同じドメイン知識を使用
- Jira課題特有のドメインがある場合は拡張を検討

### 3. パフォーマンス

- Jira課題数が多い場合（5,000件以上）はバッチ処理を考慮
- 並列処理で生成時間を短縮

---

## 🎯 期待される効果

### 1. 検索精度の向上

- Jira課題にもStructuredLabelを適用
- Composite Scoringでラベル情報を活用
- ドメイン知識によるドメイン推測精度向上

### 2. 統一的な管理

- ConfluenceとJiraで統一的なStructuredLabel管理
- 横断的な検索が可能

### 3. 将来的な拡張性

- 他のデータソース（Google Driveなど）にも適用可能
- 統一的なラベル管理システムの基盤

---

## 📚 関連ドキュメント

- [StructuredLabel実装状況](./STRUCTURED_LABEL_SYSTEM_STATUS.md)
- [Jira検索システム仕様](../02-specifications/02.03-jira-spec.md)
- [Phase 1改善まとめ](./PHASE1_IMPROVEMENT_SUMMARY.md)
- [Phase 2改善まとめ](./PHASE2_IMPROVEMENT_SUMMARY.md)

---

## 📝 更新履歴

**2025年1月**: 初版作成
- Jira課題へのドメイン知識統合計画を追加

