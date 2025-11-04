# Firestoreラベル統合が「教室削除機能」検索品質に与える影響分析

**作成日**: 2025年11月2日  
**目的**: Firestoreラベル統合が「教室削除機能」の検索品質改善に役立つかを分析

## 📋 現状の問題

### 問題の詳細
- **クエリ**: 「教室削除ができないのは何が原因ですか」
- **期待される結果**: 「164__【FIX】教室削除機能」（pageId: 718373062）が1位に表示される
- **実際の結果**: 「155_【FIX】教室グループ削除機能」が上位に表示される
- **注**: 「164」はタイトル内のプレフィックスであり、実際のpageIdは`718373062`である

### 根本原因
1. **機能名マッチングの問題**: 「教室削除」というキーワードは「教室削除機能」と「教室グループ削除機能」の両方にマッチ
2. **ドメイン知識の未活用**: 「教室削除機能」がドメイン知識に含まれているが、抽出されていない
3. **タイトル部分一致検索の未統合**: `title-partial`がRRF融合に含まれていない

## 🔍 Firestore StructuredLabelの活用状況

### 1. StructuredLabelが検索で活用されているか

**確認結果**: ✅ **活用されている**

#### 1.1 Composite Scoringでの活用

```248:330:src/lib/composite-scoring-service.ts
private calculateLabelScore(labels: string[], keywords: string[], structuredLabel?: any): number {
  // Part 1: 旧形式ラベル（labels: string[]）のマッチング（20%の重み）
  // ...
  
  // Part 2: StructuredLabelマッチング（80%の重み）
  if (!structuredLabel) {
    // StructuredLabelがない場合は早期リターン（Part 1のスコアのみ）
    return part1Score;
  }
  
  // StructuredLabel処理
  let part2Score = 0;
  
  // ドメインマッチング
  if (structuredLabel.domain) {
    const domainLower = structuredLabel.domain.toLowerCase();
    // 完全一致または部分一致でスコアを追加
  }
  
  // 機能名マッチング（最重要）
  if (structuredLabel.feature) {
    const featureLower = structuredLabel.feature.toLowerCase();
    // 完全一致で高スコア、部分一致で中スコア
  }
  
  // タグマッチング
  if (Array.isArray(structuredLabel.tags) && structuredLabel.tags.length > 0) {
    // タグとキーワードの一致度でスコアを追加
  }
  
  // カテゴリマッチング
  if (structuredLabel.category) {
    // カテゴリマッチでスコアを追加
  }
  
  // ステータスブースト（approvedは高スコア）
  if (structuredLabel.status === 'approved') {
    part2Score *= 1.2; // 20%追加ブースト
  }
  
  return part1Score * 0.2 + part2Score * 0.8;
}
```

#### 1.2 StructuredLabel Scorerでの活用

```36:70:src/lib/structured-label-scorer.ts
// 1. 機能名マッチング（最重要）
if (label.feature) {
  const featureLower = label.feature.toLowerCase();
  
  // 完全一致
  if (queryLower.includes(featureLower)) {
    score += featureWeight * 2; // featureWeight = 5.0 → 10.0
  }
  // 逆方向の完全一致
  else if (featureLower.includes(queryLower)) {
    score += featureWeight * 1.5; // 7.5
  }
  // 部分一致（文字列の類似度チェック）
  else {
    // 機能名から2文字以上の部分文字列を抽出してマッチング
    // 汎用語を除外し、意味のある部分のみマッチング
  }
}
```

### 2. Firestoreに「教室削除機能」のStructuredLabelが含まれているか

**確認が必要**: Firestoreの`structured_labels`コレクションに「164__【FIX】教室削除機能」のStructuredLabelが存在するか

**想定されるStructuredLabel**:
```typescript
{
  pageId: "164",
  structuredLabel: {
    category: "spec",
    domain: "教室管理",
    feature: "教室削除機能",  // ← 重要: 機能名が含まれている
    priority: "high",
    status: "approved",
    version: "164",
    tags: ["教室", "削除", "機能"],
    confidence: 0.9,
    is_valid: true
  }
}
```

### 3. 改善の可能性

#### 改善案1: Firestoreラベル統合により機能名マッチングが強化される

**実装内容**:
```typescript
// クエリ: 「教室削除ができないのは何が原因ですか」
// キーワード: ['教室削除', '削除', '原因']

// StructuredLabel.feature = "教室削除機能"
// calculateLabelMatchScore()で機能名マッチング
if (structuredLabel.feature) {
  const featureLower = "教室削除機能".toLowerCase();
  const queryLower = "教室削除ができないのは何が原因ですか".toLowerCase();
  
  // 部分一致チェック
  // "教室削除"がクエリに含まれる → マッチ ✅
  if (queryLower.includes("教室削除")) {
    score += featureWeight * 2; // 10.0点
  }
}
```

**期待される効果**:
- ✅ 「教室削除機能」のStructuredLabelがLanceDBに含まれる
- ✅ `calculateLabelScore()`で機能名マッチングが実行される
- ✅ 「教室削除機能」のスコアが「教室グループ削除機能」より高くなる

#### 改善案2: ドメイン知識とStructuredLabelの連携

**実装内容**:
```typescript
// ドメイン知識から「教室削除機能」を抽出できない場合でも
// StructuredLabel.feature = "教室削除機能"がLanceDBに含まれている場合
// タイトルマッチング時に機能名を直接チェックできる

// calculateTitleMatch()で機能名を直接チェック
function calculateTitleMatch(
  title: string, 
  keywords: string[],
  structuredFeature?: string  // 新規追加
): {
  matchedKeywords: string[];
  titleMatchRatio: number;
  functionNameMatch?: boolean;
} {
  // StructuredLabel.featureがタイトルに含まれる場合
  if (structuredFeature && title.includes(structuredFeature)) {
    return {
      matchedKeywords: [...keywords, structuredFeature],
      titleMatchRatio: 1.0, // 完全一致
      functionNameMatch: true
    };
  }
  // ...
}
```

**期待される効果**:
- ✅ タイトルマッチング時に機能名を直接チェックできる
- ✅ 機能名完全一致の場合は高いスコアを付与できる

## 📊 改善の可能性評価

### 改善が期待できるケース

#### ケース1: Firestoreに「教室削除機能」のStructuredLabelが存在する場合

**改善効果**: ✅ **高**

**理由**:
1. `structured_feature = "教室削除機能"`がLanceDBに含まれる
2. `calculateLabelScore()`で機能名マッチングが実行される
3. 「教室削除ができない」というクエリに「教室削除」が含まれる → マッチ
4. 機能名マッチングのスコア（featureWeight * 2 = 10.0）が加算される
5. 「教室削除機能」のスコアが「教室グループ削除機能」より高くなる

**期待される改善**:
- 「教室削除機能」が上位に表示される
- 機能名完全一致の優先度が上がる

#### ケース2: FirestoreにStructuredLabelが存在しない場合

**改善効果**: ⚠️ **中**（間接的な改善）

**理由**:
1. Firestoreラベル統合により、将来的にStructuredLabelが含まれるようになる
2. しかし、現時点ではStructuredLabelがないため、直接的な改善は期待できない
3. ただし、ラベル統合により、他の機能（例：ドメイン知識の活用）との連携が可能になる

### 改善が期待できないケース

#### ケース3: StructuredLabelが存在しても、機能名マッチングが不十分な場合

**改善効果**: ❌ **低**

**理由**:
1. `calculateLabelMatchScore()`の機能名マッチングロジックが不十分
2. 「教室削除ができない」というクエリから「教室削除機能」を抽出できない
3. 機能名マッチングの条件が厳しすぎる

## 🎯 結論

### Firestoreラベル統合の効果

**改善の可能性**: ✅ **高**

**理由**:
1. ✅ **機能名マッチングが強化される**
   - `structured_feature = "教室削除機能"`がLanceDBに含まれる
   - `calculateLabelScore()`で機能名マッチングが実行される
   - 機能名マッチングのスコア（featureWeight * 2 = 10.0）が加算される

2. ✅ **ドメイン知識との連携が可能になる**
   - StructuredLabelがLanceDBに含まれることで、タイトルマッチング時に機能名を直接チェックできる
   - ドメイン知識の逆方向マッチングと組み合わせて、より正確なマッチングが可能

3. ✅ **既存の検索品質改善案と相乗効果**
   - ドメイン知識の逆方向マッチング（改善案1C）
   - タイトル部分一致検索の統合（改善案2）
   - 機能名マッチングの強化（改善案3）
   - これらと組み合わせることで、より効果的な改善が期待できる

### 推奨実装順序

1. **Firestoreラベル統合**（基礎）
   - 通常の同期プロセスにFirestoreラベル取得を統合
   - StructuredLabelがLanceDBに含まれるようになる

2. **機能名マッチングの強化**（改善案1C）
   - タイトルマッチング時に機能名を直接チェック
   - StructuredLabel.featureを活用

3. **ドメイン知識の活用**（改善案1C）
   - ドメイン知識の逆方向マッチング
   - StructuredLabel.featureと組み合わせて、より正確なマッチング

4. **タイトル部分一致検索の統合**（改善案2）
   - `title-partial`をRRF融合に追加
   - StructuredLabel.featureを活用

## 🔗 関連ドキュメント

- [Firestoreラベル統合プラン](./firestore-labels-integration-plan.md)
- [ドメイン知識活用の問題点分析](./domain-knowledge-utilization-issue.md)
- [検索品質問題詳細分析](./search-quality-classroom-deletion-detailed-analysis.md)
- [StructuredLabelスコアリング実装](../src/lib/structured-label-scorer.ts)
- [Composite Scoring実装](../src/lib/composite-scoring-service.ts)

