# StructuredLabel（構造化ラベルシステム）設計書

**バージョン**: 1.0  
**作成日**: 2025年10月14日  
**Phase**: Phase 0A-1  
**ステータス**: 設計完了

---

## 📋 概要

既存の`string[]`ラベルを、より構造化された`StructuredLabel`に置き換えることで、以下を実現します：

1. ✅ **精密なフィルタリング**: カテゴリ、ドメイン、ステータスなど多軸でフィルタリング
2. ✅ **検索精度向上**: ラベル情報を活用したスコアリング改善
3. ✅ **将来の拡張性**: Jira、マニュアルなど他のデータソースとの統一的な管理
4. ✅ **自動分類**: LLMによる自動ラベル付けの基盤

---

## 📊 既存ラベルの問題点

### 分析結果（2025年10月14日）

| 項目 | 値 |
|------|-----|
| 総ページ数 | 1,207件 |
| 総ラベル数 | 19種類 |
| 平均ラベル数/ページ | 1.13個 |

### 問題点

1. **粒度がバラバラ**
   - 「機能要件」が64%を占める（粗すぎる）
   - 「教室管理」「会員管理」などのドメイン分類がない

2. **重複ラベル**
   - 「議事録」（169件）と「meeting-notes」（165件）が重複

3. **ステータス情報の不統一**
   - タイトルに【FIX】、【作成中】が埋め込まれている
   - ラベルとして管理されていない

4. **検索での活用が限定的**
   - 単純な包含チェックのみ
   - スコアリングに十分活用されていない

---

## 🎯 StructuredLabelスキーマ

### 型定義

```typescript
export interface StructuredLabel {
  category: DocumentCategory;     // spec, data, template, workflow, meeting, manual, other
  domain: SystemDomain;            // 会員管理, 求人管理, 教室管理, など
  feature: string;                 // 具体的な機能名
  priority: Priority;              // critical, high, medium, low, unknown
  status: DocumentStatus;          // draft, review, approved, deprecated, unknown
  version?: string;                // バージョン番号（例: "168", "515"）
  tags?: string[];                 // 追加の分類キーワード
  confidence?: number;             // 自動ラベル付けの信頼度（0.0 - 1.0）
}
```

---

## 📐 フィールド詳細

### 1. category（カテゴリ）

**目的**: ドキュメントの種類を分類

| 値 | 説明 | 使用例 | 割合（推定） |
|----|------|--------|-------------|
| `spec` | 仕様書・機能要件 | 「教室コピー機能」 | 56% |
| `data` | 帳票・データ定義 | 「会員：アカウント情報」 | 7% |
| `template` | メールテンプレート | 「応募完了メール」 | 7% |
| `workflow` | ワークフロー | 「ログイン・ログアウトフロー」 | 4% |
| `meeting` | 議事録 | 「2024-4-1 確認会」 | 14% |
| `manual` | マニュアル | （将来の拡張用） | - |
| `other` | その他 | - | 12% |

**推測ロジック:**
```typescript
if (oldLabels.includes('機能要件')) return 'spec';
if (oldLabels.includes('帳票')) return 'data';
if (oldLabels.includes('メールテンプレート')) return 'template';
if (oldLabels.includes('ワークフロー')) return 'workflow';
if (oldLabels.includes('議事録') || oldLabels.includes('meeting-notes')) return 'meeting';
```

---

### 2. domain（ドメイン）

**目的**: どの機能領域に属するかを分類

| ドメイン | 説明 | キーワード |
|---------|------|-----------|
| 会員管理 | エンドユーザー関連 | 会員、エンドユーザー |
| 求人管理 | 求人情報管理 | 求人 |
| 教室管理 | 教室・塾の管理 | 教室 |
| クライアント企業管理 | クライアント企業機能 | クライアント企業 |
| 全体管理 | 全体管理者・サイト運営 | 全体管理、サイト運営 |
| オファー管理 | オファー機能 | オファー |
| 採用フロー | 応募・選考・採用 | 応募、選考、採用 |
| 口コミ・評価 | 評価・口コミ | 口コミ、評価 |
| システム共通 | 共通要件・インフラ | 共通要件、インフラ |
| その他 | 上記以外 | - |

**推測ロジック:**
```typescript
const text = title + ' ' + content;

if (text.includes('会員') && !text.includes('クライアント企業')) return '会員管理';
if (text.includes('求人')) return '求人管理';
if (text.includes('教室')) return '教室管理';
// ... 以下同様
```

---

### 3. feature（機能名）

**目的**: 具体的な機能を識別

**抽出方法:**
- タイトルから【FIX】、【作成中】、バージョン番号を除去
- 「○○機能」「○○帳票」などの機能名を抽出

**例:**
```
元のタイトル: "168_【FIX】教室コピー機能"
→ feature: "教室コピー機能"

元のタイトル: "【FIX】会員：アカウント情報"
→ feature: "会員アカウント情報"
```

---

### 4. status（ステータス）

**目的**: ドキュメントの完成度を管理

| ステータス | 説明 | タイトルマーカー |
|-----------|------|----------------|
| `draft` | 作成中 | 【作成中】 |
| `review` | レビュー中 | 【レビュー中】 |
| `approved` | 確定版 | 【FIX】 |
| `deprecated` | 非推奨・廃止 | （手動設定） |
| `unknown` | 不明 | （マーカーなし） |

**抽出ロジック:**
```typescript
if (title.includes('【FIX】')) return 'approved';
if (title.includes('【作成中】')) return 'draft';
if (title.includes('【レビュー中】')) return 'review';
return 'unknown';
```

---

### 5. priority（優先度）

**目的**: ビジネス上の重要度を管理

**推測ルール:**

| 条件 | 優先度 | 理由 |
|------|--------|------|
| category=spec AND status=approved | `high` | 確定版の機能要件 |
| category=spec AND status=draft | `medium` | 作成中の機能要件 |
| category=workflow | `high` | ワークフローは重要 |
| category=meeting OR template | `low` | 議事録やメールは参考情報 |
| その他 | `medium` | デフォルト |

---

### 6. version（バージョン）

**目的**: 仕様書のバージョン管理

**抽出方法:**
```typescript
"168_【FIX】教室コピー機能" → version: "168"
"515_【作成中】教室管理-教室コピー機能" → version: "515"
```

---

### 7. tags（タグ）

**目的**: 追加の分類キーワード

**使用例:**
```typescript
tags: ['コピー', '管理画面', '一括処理']
tags: ['認証', 'セキュリティ']
tags: ['バッチ処理', '非同期']
```

---

## 🔄 移行戦略

### Phase 1: ルールベース移行（70-80%）

```typescript
// タイトルと既存ラベルからStructuredLabelを生成
function migrateLabel(page: any): StructuredLabel {
  return {
    category: StructuredLabelHelper.inferCategoryFromLabels(page.labels),
    domain: StructuredLabelHelper.inferDomainFromContent(page.title, page.content),
    feature: StructuredLabelHelper.cleanTitle(page.title),
    status: StructuredLabelHelper.extractStatusFromTitle(page.title),
    version: StructuredLabelHelper.extractVersionFromTitle(page.title),
    priority: StructuredLabelHelper.inferPriority(category, status),
    confidence: 0.8  // ルールベースの信頼度
  };
}
```

### Phase 2: LLMベース移行（残り20-30%）

```typescript
// ルールベースで判定できないページはLLMで分類
const prompt = `
以下のConfluenceページを分析し、StructuredLabelを生成してください。

タイトル: ${page.title}
内容: ${page.content.substring(0, 500)}...

JSON形式で出力:
{
  "category": "spec|data|template|workflow|meeting|other",
  "domain": "会員管理|求人管理|...",
  "feature": "具体的な機能名",
  "priority": "high|medium|low",
  "status": "draft|review|approved",
  "tags": ["タグ1", "タグ2"]
}
`;
```

---

## 🔍 検索での活用

### フィルタリングの改善

```typescript
// 現在
labelFilters: { includeMeetingNotes: false }

// StructuredLabel後
structuredLabelFilters: {
  categories: ['spec', 'data'],           // 仕様書とデータ定義のみ
  domains: ['教室管理', '会員管理'],      // 特定ドメインのみ
  statuses: ['approved'],                 // 確定版のみ
  priorities: ['high', 'medium'],         // 高・中優先度のみ
  excludeMeetingNotes: true               // 議事録を除外（互換性）
}
```

### スコアリングの改善

```typescript
// ラベルマッチスコアの計算
function calculateLabelScore(query: string, label: StructuredLabel): number {
  let score = 0;
  
  // ドメインマッチ（高得点）
  if (query.includes(label.domain)) score += 10;
  
  // 機能名マッチ（最高得点）
  if (query.includes(label.feature)) score += 20;
  
  // カテゴリマッチ
  if (label.category === 'spec') score += 5;  // 仕様書を優遇
  
  // ステータスマッチ
  if (label.status === 'approved') score += 3;  // 確定版を優遇
  
  // 優先度マッチ
  if (label.priority === 'high') score += 2;
  
  return score;
}
```

---

## 📈 期待される効果

### 1. 検索品質の向上

**シナリオ: 「教室コピー機能でコピー可能な項目は？」**

```
現在の問題:
- BM25で「バッチエラー時通知先」が上位に来る
- 「教室コピー機能」が下位に押し下げられる

StructuredLabel後:
✅ category='spec', domain='教室管理', feature='教室コピー機能'
   → ラベルスコアが大幅アップ
✅ 「バッチエラー時通知先」は category='data', domain='システム共通'
   → ラベルスコアが低い
✅ 総合スコアで「教室コピー機能」が上位に
```

### 2. フィルタリングの精度向上

```typescript
// 「会員管理の確定版仕様書のみを検索」
filters: {
  categories: ['spec'],
  domains: ['会員管理'],
  statuses: ['approved']
}
```

### 3. UIでの表示改善

```
現在: [機能要件]
改善後: spec > 教室管理 > 教室コピー機能 > approved (v.168)
```

---

## 🛠️ 実装計画

### 1. スキーマ定義 ✅完了
- `src/types/structured-label.ts` を作成
- ヘルパー関数を実装

### 2. データモデル更新（次のステップ）
- LanceDBスキーマ拡張
- Firestoreスキーマ拡張

### 3. 自動ラベル付けFlow（Phase 0A-1-2）
- Genkit Flow実装
- gemini-1.5-flash使用

### 4. 移行スクリプト（Phase 0A-1-3）
- ルールベース移行（80%）
- LLMベース移行（20%）

---

## 📝 使用例

### 例1: 機能要件ページ

```typescript
// 元のページ
{
  title: "168_【FIX】教室コピー機能",
  labels: ["機能要件"]
}

// StructuredLabel変換後
{
  title: "教室コピー機能",  // クリーンなタイトル
  labels: ["機能要件"],      // 互換性のため保持
  structuredLabel: {
    category: 'spec',
    domain: '教室管理',
    feature: '教室コピー機能',
    priority: 'high',
    status: 'approved',
    version: '168',
    tags: ['コピー', '管理画面'],
    confidence: 0.95
  }
}
```

### 例2: メールテンプレート

```typescript
// 元のページ
{
  title: "【作成中】応募完了メール（会員宛）",
  labels: ["メールテンプレート"]
}

// StructuredLabel変換後
{
  title: "応募完了メール（会員宛）",
  labels: ["メールテンプレート"],
  structuredLabel: {
    category: 'template',
    domain: '採用フロー',
    feature: '応募完了通知',
    priority: 'low',
    status: 'draft',
    tags: ['通知', '会員向け'],
    confidence: 0.90
  }
}
```

### 例3: 議事録

```typescript
// 元のページ
{
  title: "2024-4-1 確認会ミーティング議事録",
  labels: ["議事録", "meeting-notes"]  // 重複
}

// StructuredLabel変換後
{
  title: "2024-4-1 確認会ミーティング議事録",
  labels: ["meeting-notes"],  // 統一
  structuredLabel: {
    category: 'meeting',
    domain: 'その他',
    feature: '確認会議事録',
    priority: 'low',
    status: 'approved',
    tags: ['2024年4月'],
    confidence: 1.0
  }
}
```

---

## 🔗 関連ドキュメント

- [Phase 0A実装計画書](./phase-0A-implementation-plan.md)
- [基盤強化優先戦略](./foundation-first-strategy.md)
- [ラベルシステム概要](../implementation/label-system-overview.md)
- [ラベルシステム設計](../implementation/label-system-design.md)

---

## 📊 次のステップ

1. ✅ **スキーマ定義完了**
2. 📋 **データモデル更新**: LanceDB・Firestoreスキーマ拡張
3. 🤖 **自動ラベル付けFlow実装**: Genkit + gemini-1.5-flash
4. 🔧 **LabelManagerV2実装**: 新ラベル管理ライブラリ
5. 🔄 **移行スクリプト実装**: 既存ラベル→StructuredLabel
6. ✅ **テスト・検証**: 検索精度向上の確認

---

## 📞 サポート

質問や提案がある場合は、開発チームに連絡してください。

---

## 🔄 更新履歴

- **2025-10-14**: 初版作成（Phase 0A-1開始）

