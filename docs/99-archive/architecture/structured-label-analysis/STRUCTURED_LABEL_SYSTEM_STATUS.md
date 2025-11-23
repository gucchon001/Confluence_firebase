# Structured Label System 実装状況

**作成日**: 2025年1月27日  
**Phase**: Phase 0A-1  
**ステータス**: 🟡 部分実装

---

## 📋 概要

Structured Label Systemは、Confluenceページのラベルを構造化し、検索の精度向上とカテゴリ管理を実現するシステムです。

---

## 🎯 実装状況

### ✅ 実装済みの機能

#### 1. **自動生成機能（Genkit Flow）**

**実装ファイル**: `src/ai/flows/auto-label-flow.ts`

**機能**:
- Genkit Flowによる自動ラベル生成
- ルールベース生成（80%のケース、信頼度 0.9）
- LLMベース生成（20%のケース、Gemini 2.0 Flash使用）

**生成フロー**:
```typescript
// Step 1: ルールベースで高速判定（80%のケースに対応）
const ruleBasedLabel = tryRuleBasedLabeling(input);
if (ruleBasedLabel && ruleBasedLabel.confidence >= 0.85) {
  return ruleBasedLabel;  // 高速・高精度
}

// Step 2: LLMベースでラベル生成（20%のケース）
const { text } = await ai.generate({
  model: GeminiConfig.model,
  prompt: buildLLMPrompt(input, domainCandidates, topDomains),
  config: {
    temperature: 0.1,  // 低温度で一貫性を重視
    maxOutputTokens: 500,
  },
});
```

**ルールベース判定の条件**:
- `status !== 'unknown'` AND `category !== 'other'` AND `domain !== 'その他'`
- 信頼度 >= 0.85 の場合、ルールベース結果を返す

**LLM生成の条件**:
- ルールベースで判定できない場合（20%のケース）
- Domain Knowledgeからドメイン候補を抽出
- プロンプトにドメイン候補と上位30件のドメイン一覧を含める

---

#### 2. **Firestore保存・取得機能**

**実装ファイル**: `src/lib/structured-label-service.ts`

**機能**:
- StructuredLabelの保存（`saveStructuredLabel`）
- StructuredLabelの取得（`getStructuredLabel`）
- 複数ページの一括取得（`getStructuredLabels`）
- 統計情報の取得（`getStructuredLabelStats`）

**Firestoreコレクション**: `structured_labels`

**スキーマ**:
```typescript
interface StructuredLabelDocument {
  pageId: string;                    // Confluenceページ ID
  structuredLabel: StructuredLabel;  // 構造化ラベル
  generatedAt: Date;                 // 生成日時
  generatedBy: 'rule-based' | 'llm-based';  // 生成方法
}
```

---

#### 3. **一括生成スクリプト**

**実装ファイル**: `scripts/generate-structured-labels.ts`

**機能**:
- 既存のConfluenceページに対してStructuredLabelを一括生成
- Firestoreに保存

**実行方法**:
```bash
npm run generate-structured-labels
```

---

### 📊 スキーマ

**StructuredLabel**:
```typescript
interface StructuredLabel {
  category: DocumentCategory;        // spec, data, template, workflow, meeting, manual, other
  domain: string;                    // ドメイン名（例: "ユーザー管理", "支払い"）
  feature: string;                   // 機能名（クリーンなタイトル）
  priority: Priority;                // critical, high, medium, low, unknown
  status: DocumentStatus;            // draft, review, approved, deprecated, unknown
  version?: string;                  // バージョン番号（オプショナル）
  tags?: string[];                   // 関連キーワード（オプショナル）
  confidence?: number;               // 信頼度 (0.0 - 1.0)
  content_length?: number;           // コンテンツ長（Phase 0A-1.5）
  is_valid?: boolean;                // 有効性（100文字以上が有効）
}
```

**フィールドの意味**:
- **category**: ドキュメントのカテゴリ（機能仕様、データ定義、テンプレートなど）
- **domain**: ドメイン名（ユーザー管理、支払い、予約など）
- **feature**: 機能名（タイトルからバージョン番号やステータスマーカーを除いたもの）
- **priority**: 優先度（critical, high, medium, low, unknown）
- **status**: ステータス（draft, review, approved, deprecated, unknown）
- **version**: バージョン番号（タイトルから抽出、例: "168"）
- **tags**: 関連キーワード（例: ["コピー", "一括処理", "管理画面"]）
- **confidence**: 信頼度（ルールベース: 0.9、LLMベース: 0.7）
- **content_length**: コンテンツ長（空ページ判定用）
- **is_valid**: 有効性（100文字以上が有効）

---

## 🔍 使用状況

### ✅ 検索システムでの使用

#### 1. **Composite Scoring（複合スコアリング）**

**実装ファイル**: `src/lib/composite-scoring-service.ts`

**使用箇所**:
- ラベルスコア計算（16%の重み）
- カテゴリ別の減衰・ブースト
- タグマッチングボーナス（Composite Scoring段階）

**実装内容**:
```typescript
// StructuredLabelマッチング（80%の重み）
if (structuredLabel.domain) {
  // ドメインマッチング
  const domainMatch = lowerKeywords.some(kw => domainLower.includes(kw));
  if (domainMatch) score += 1.5;
}

if (structuredLabel.feature) {
  // 機能名マッチング
  const featureMatch = lowerKeywords.some(kw => featureLower.includes(kw));
  if (featureMatch) score += 1.0;
}

if (Array.isArray(structuredLabel.tags) && structuredLabel.tags.length > 0) {
  // タグマッチング
  const matchedTags = tagsLower.filter(tag => 
    lowerKeywords.some(kw => tag.includes(kw) || kw.includes(tag))
  );
  if (matchedTags.length > 0) score += matchedTags.length * 0.5;
}

if (structuredLabel.category) {
  // カテゴリマッチング
  const categoryMatch = lowerKeywords.some(kw => categoryLower.includes(kw));
  if (categoryMatch) score += 0.5;
}

if (structuredLabel.status === 'approved') {
  // 承認済みドキュメントのブースト
  score += 0.3;
}
```

---

#### 2. **タグマッチングボーナス**

**実装ファイル**: 
- `src/lib/unified-search-result-processor.ts` (RRF段階)
- `src/lib/composite-scoring-service.ts` (Composite Scoring段階)

**RRF段階**:
- 1つのタグマッチ: **2.0倍**
- 2つ以上のタグマッチ: **3.0倍**

**Composite Scoring段階**:
- 1つのタグマッチ: **3.0倍**
- 2つ以上のタグマッチ: **6.0倍**

---

#### 3. **ドメイン減衰・ブースト**

**実装ファイル**: 
- `src/lib/composite-scoring-service.ts`

**カテゴリ別の減衰・ブースト**:
- **機能クエリ時のspecカテゴリブースト**: 50%ブースト（Composite Scoring段階のみ）
- **templateカテゴリの減衰**: 95%〜98%減衰（機能クエリ時、Composite Scoring段階のみ）
- **deprecatedステータスの減衰**: 95%減衰（Composite Scoring段階のみ）

---

#### 4. **空ページフィルター**

**実装ファイル**: `src/lib/lancedb-search-client.ts`

**実装内容**:
- StructuredLabelがある場合: `is_valid` で判定
- StructuredLabelがない場合: コンテンツ長で直接判定（100文字未満を除外）

---

### ⚠️ 既存システムとの統合

#### 1. **LanceDBへの統合**

**実装ファイル**: `src/lib/lancedb-schema-extended.ts`

**統合方法**:
- StructuredLabelをフラット化してLanceDBに保存
- すべてのStructuredLabelフィールドに`structured_`プレフィックスを付与
- 例: `structured_category`, `structured_domain`, `structured_feature`

**フラット化関数**:
```typescript
export function flattenStructuredLabel(label: any | null): Partial<ExtendedLanceDBRecord> {
  if (!label) return {};
  
  return {
    structured_category: label.category || undefined,
    structured_domain: label.domain || undefined,
    structured_feature: label.feature || undefined,
    structured_priority: label.priority || undefined,
    structured_status: label.status || undefined,
    structured_version: label.version || undefined,
    structured_tags: label.tags || undefined,
    structured_confidence: label.confidence || undefined,
    structured_content_length: label.content_length || undefined,
    structured_is_valid: label.is_valid !== undefined ? label.is_valid : undefined,
  };
}
```

---

#### 2. **同期処理**

**実装ファイル**: `src/lib/confluence-sync-service.ts`

**同期フロー**:
1. Confluenceからページを取得
2. FirestoreからStructuredLabelを取得（ページ単位で1回のみ）
3. StructuredLabelをフラット化
4. LanceDBに保存（拡張スキーマ）

**実装内容**:
```typescript
// FirestoreからStructuredLabelを取得
const structuredLabel = await getStructuredLabel(page.id);
if (structuredLabel) {
  structuredLabelFlat = flattenStructuredLabel(structuredLabel);
  // LanceDBに保存
}
```

---

## 📈 統計情報

### 現在の状態

**Firestore**:
- `structured_labels` コレクション: 639ドキュメント（確認済み）

**生成方法の内訳**:
- ルールベース: 80%のケース（信頼度 0.9）
- LLMベース: 20%のケース（信頼度 0.7）

**カバレッジ**:
- 約50%のページでStructuredLabelが未生成
- 一括生成スクリプトで対応可能

---

## 🔧 実装コンポーネント

### 1. **自動生成Flow**

**ファイル**: `src/ai/flows/auto-label-flow.ts`

**機能**:
- Genkit Flowによる自動ラベル生成
- ルールベースとLLMベースの2段階生成

**入力スキーマ**:
```typescript
{
  title: string;
  content: string;
  labels: string[];
}
```

**出力スキーマ**:
```typescript
{
  category: 'spec' | 'data' | 'template' | 'workflow' | 'meeting' | 'manual' | 'other';
  domain: string;
  feature: string;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  status: 'draft' | 'review' | 'approved' | 'deprecated' | 'unknown';
  version?: string;
  tags?: string[];
  confidence?: number;
}
```

---

### 2. **Firestoreサービス**

**ファイル**: `src/lib/structured-label-service.ts`

**機能**:
- `saveStructuredLabel`: StructuredLabelを保存
- `getStructuredLabel`: StructuredLabelを取得
- `getStructuredLabels`: 複数ページの一括取得
- `getStructuredLabelStats`: 統計情報を取得

**BOM対策**:
- `sanitizeStructuredLabel` 関数でBOM文字を除去
- すべての文字列フィールドをサニタイズ

---

### 3. **一括生成スクリプト**

**ファイル**: `scripts/generate-structured-labels.ts`

**機能**:
- 既存のConfluenceページに対してStructuredLabelを一括生成
- Firestoreに保存

**実行方法**:
```bash
npm run generate-structured-labels
```

---

## ⚠️ 制限事項と課題

### 1. **部分実装の状態**

**現在の状態**:
- ✅ 自動生成機能完成
- ✅ Firestore保存・取得機能完成
- ✅ 一括生成スクリプト完成
- ⚠️ 検索では既存の `labels: string[]` を使用（StructuredLabelも併用）
- ⚠️ 約50%のページでStructuredLabelが未生成

---

### 2. **既存システムとの統合**

**課題**:
- 検索では既存の `labels: string[]` を使用している
- StructuredLabelは補助的に使用されている（Composite Scoring、タグマッチングボーナスなど）
- 完全移行は未完了

**対応**:
- 段階的な移行を計画
- 既存の `labels: string[]` との併用を継続

---

### 3. **生成精度**

**課題**:
- ルールベース: 信頼度 0.9（80%のケース）
- LLMベース: 信頼度 0.7（20%のケース）
- 精度向上の余地あり

**対応**:
- ルールベースの精度向上
- LLMベースのプロンプト改善

---

## 📝 今後の計画

### Phase 0A-2（完了）

- ✅ StructuredLabelのLanceDBへの統合
- ✅ 検索スコアリングでの使用
- ✅ タグマッチングボーナスの実装

### Phase 0A-3（予定）

- ⚠️ 生成精度の向上
- ⚠️ カバレッジの向上（100%を目指す）
- ⚠️ 既存システムへの完全統合

---

## 📚 関連ドキュメント

- `docs/01-architecture/01.02.01-lancedb-firestore-integration-design.md`: LanceDB-Firestore統合設計書
- `docs/99-archive/phase-0a-1-completion-report.md`: Phase 0A-1完了レポート

---

**作成者**: AI Assistant  
**作成日**: 2025年1月27日  
**更新日**: 2025年1月27日

