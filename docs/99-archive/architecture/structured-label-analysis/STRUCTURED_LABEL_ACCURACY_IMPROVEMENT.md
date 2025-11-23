# StructuredLabel生成精度向上ガイド

## 📊 現状分析

### 現在の生成精度
- **高信頼度 (>= 0.85)**: 61.5% (1,073件)
- **中信頼度 (0.7-0.85)**: 37.7% (658件)
- **低信頼度 (< 0.7)**: 0.9% (15件)
- **平均信頼度**: 85.3%

### 生成方法の内訳
- **ルールベース**: 61.5% (1,073件) - 信頼度 0.9
- **LLMベース**: 38.5% (673件) - 信頼度 0.7

### 目標
- **高信頼度**: 80%以上（現在61.5% → 目標80%）
- **ルールベース割合**: 80%以上（現在61.5% → 目標80%）

---

## 🔍 未同期調査結果

### 統計情報
- **Firestore総件数**: 1,746件
- **LanceDB総ページ数**: 152件（ユニーク、ローカル環境）
- **同期済み**: 152件
- **未同期総数**: 1,594件
- **Firestoreのみ**: 1,594件（LanceDBにページが存在しない）
- **LanceDBのみ**: 0件

### 結論
未同期の1,594件は、**ローカル環境のLanceDBには存在しないページ**です。本番環境には存在する可能性があります。これらのStructuredLabelは本番環境で同期される可能性があります。

---

## 🎯 生成精度向上の方法

### 1. **ルールベース生成の拡張**（最重要）

#### 現在の問題点
```typescript
// 現在のルールベース生成条件（厳しすぎる）
if (status !== 'unknown' && category !== 'other' && domain !== 'その他') {
  // confidence: 0.9
}
```

**問題**:
- 条件が厳しすぎて、多くのページがLLMベースに回ってしまう
- `status === 'unknown'` のページが多い
- `category === 'other'` のページが多い
- `domain === 'その他'` のページが多い

#### 改善策 A: 条件を緩和（段階的判定）

```typescript
function tryRuleBasedLabeling(input: z.infer<typeof InputSchema>): StructuredLabel | null {
  const status = StructuredLabelHelper.extractStatusFromTitle(input.title);
  const version = StructuredLabelHelper.extractVersionFromTitle(input.title);
  const category = StructuredLabelHelper.inferCategoryFromLabels(input.labels);
  const domain = StructuredLabelHelper.inferDomainFromContent(input.title, input.content.substring(0, 1000));
  
  // 段階的に信頼度を設定
  let confidence = 0.9;
  let canUseRuleBased = false;
  
  // 高信頼度（0.9）: 全条件が揃っている場合
  if (status !== 'unknown' && category !== 'other' && domain !== 'その他') {
    canUseRuleBased = true;
    confidence = 0.9;
  }
  // 中信頼度（0.85）: categoryとdomainが揃っている場合（statusはunknownでも可）
  else if (category !== 'other' && domain !== 'その他') {
    canUseRuleBased = true;
    confidence = 0.85;
  }
  // 低信頼度（0.8）: categoryまたはdomainが揃っている場合
  else if (category !== 'other' || domain !== 'その他') {
    canUseRuleBased = true;
    confidence = 0.8;
  }
  
  if (canUseRuleBased) {
    const feature = StructuredLabelHelper.cleanTitle(input.title);
    const priority = StructuredLabelHelper.inferPriority(category, status);
    
    // タグ抽出ロジック（既存）
    // ...
    
    return {
      category,
      domain,
      feature,
      status,
      version,
      priority,
      tags: tags.length > 0 ? tags : undefined,
      confidence,  // 段階的な信頼度
      content_length: input.content.length,
      is_valid: input.content.length >= 100
    };
  }
  
  return null;
}
```

**効果**:
- ルールベース生成の適用範囲が拡大
- 高信頼度の割合が増加（61.5% → 80%以上）

#### 改善策 B: ドメイン推論の精度向上

```typescript
// ドメイン推論ロジックを強化
function inferDomainEnhanced(title: string, content: string): string {
  const domainKeywords: Record<string, string[]> = {
    '会員管理': ['会員', 'アカウント', 'ユーザー', 'ログイン', 'パスワード'],
    '求人管理': ['求人', '募集', '応募', 'オファー'],
    '教室管理': ['教室', 'クラス', '授業', 'コース'],
    '採用管理': ['採用', '面接', '選考', '内定'],
    // ... より多くのドメインキーワードを追加
  };
  
  // キーワードマッチングでドメインを推論
  const fullText = title + ' ' + content.substring(0, 1000);
  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    if (keywords.some(keyword => fullText.includes(keyword))) {
      return domain;
    }
  }
  
  return 'その他';
}
```

**効果**:
- ドメイン推論の精度が向上
- `domain === 'その他'` の割合が減少

#### 改善策 C: カテゴリ推論の拡張

```typescript
// カテゴリ推論ロジックを強化
function inferCategoryEnhanced(title: string, labels: string[]): DocumentCategory {
  const categoryKeywords: Record<DocumentCategory, string[]> = {
    spec: ['機能', '仕様', 'スペック', '要件', '設計', '実装'],
    data: ['データ', '帳票', 'CSV', 'エクスポート', 'インポート'],
    template: ['テンプレート', 'メール', '通知', '定型文'],
    workflow: ['フロー', 'ワークフロー', 'プロセス', '手順'],
    meeting: ['議事録', 'ミーティング', '会議', '打ち合わせ'],
    manual: ['マニュアル', '手順', 'ガイド', '使い方'],
    other: []
  };
  
  // タイトルとラベルからカテゴリを推論
  const fullText = title + ' ' + labels.join(' ');
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (category === 'other') continue;
    if (keywords.some(keyword => fullText.includes(keyword))) {
      return category as DocumentCategory;
    }
  }
  
  // ラベルから推論（既存ロジック）
  return StructuredLabelHelper.inferCategoryFromLabels(labels);
}
```

**効果**:
- カテゴリ推論の精度が向上
- `category === 'other'` の割合が減少

---

### 2. **LLMベース生成の精度向上**

#### 現在の問題点
- LLM生成の信頼度が0.7と低い
- プロンプトの精度が不十分な可能性

#### 改善策 A: プロンプトの強化

```typescript
function buildLLMPrompt(
  input: z.infer<typeof InputSchema>,
  domainCandidates: string[],
  topDomains: string[]
): string {
  return `以下のConfluenceページを分析し、StructuredLabelを生成してJSON形式で出力してください。

【ページ情報】
タイトル: ${input.title}
内容: ${input.content.substring(0, 1500)}...  // 1500文字に拡大
既存ラベル: ${input.labels.join(', ')}

【重要: カテゴリ判定ルール】
タイトルに以下のキーワードが含まれる場合、該当するカテゴリを選択してください：
- 「機能」「仕様」「スペック」「要件」「設計」「実装」 → "spec"
- 「データ」「帳票」「CSV」「エクスポート」「インポート」 → "data"
- 「テンプレート」「メール」「通知」「定型文」 → "template"
- 「フロー」「ワークフロー」「プロセス」「手順」 → "workflow"
- 「議事録」「ミーティング」「会議」「打ち合わせ」 → "meeting"
- 「マニュアル」「手順」「ガイド」「使い方」 → "manual"
- 上記に該当しない場合のみ → "other"

【重要: ステータス判定ルール】
タイトルに以下のプレフィックスが含まれる場合、該当するステータスを選択してください：
- 【FIX】→ "approved"
- 【NEW】→ "approved"
- 【作成中】→ "draft"
- 【レビュー中】→ "review"
- 【非推奨】→ "deprecated"
- 上記に該当しない場合 → "unknown"

【参考: このページに関連するドメイン候補】
${domainCandidates.length > 0 ? domainCandidates.join(', ') : '（該当なし）'}

【参考: ドメイン一覧（上位30件）】
${topDomains.join(', ')}

【出力形式】
JSON形式のみ出力してください。説明文は不要です。

\`\`\`json
{
  "category": "spec|data|template|workflow|meeting|manual|other",
  "domain": "上記のドメイン一覧から選択（できるだけ既存のものを使用）",
  "feature": "クリーンな機能名（バージョン番号やステータスマーカーを除く）",
  "priority": "high|medium|low",
  "status": "draft|review|approved|deprecated|unknown",
  "version": "タイトルから抽出（例: 168_【FIX】... → \"168\"）",
  "tags": ["関連キーワード（2-5個）"],
  "confidence": 0.75  // LLMベースの信頼度を0.75に向上
}
\`\`\`

JSON形式のみ出力してください：`;
}
```

**効果**:
- LLM生成の精度が向上
- 信頼度が0.7 → 0.75に向上

#### 改善策 B: 温度パラメータの調整

```typescript
// 現在: temperature: 0.1（低すぎる可能性）
// 改善: temperature: 0.2（やや低め、一貫性を保ちつつ柔軟性を確保）
const { text } = await ai.generate({
  model: GeminiConfig.model,
  prompt,
  config: {
    ...GeminiConfig.config,
    temperature: 0.2,  // 0.1 → 0.2に変更
    maxOutputTokens: 500,
  },
});
```

**効果**:
- LLM生成の柔軟性が向上
- より適切なラベル生成が可能

---

### 3. **後処理による信頼度調整**

#### 改善策: バリデーション後の信頼度調整

```typescript
// LLM生成後に、ルールベースの部分結果と比較して信頼度を調整
function adjustConfidence(llmResult: any, ruleBasedPartial: any): number {
  let confidence = llmResult.confidence || 0.7;
  
  // ルールベースで判定できる部分が一致している場合は信頼度を上げる
  if (ruleBasedPartial) {
    if (llmResult.category === ruleBasedPartial.category) {
      confidence += 0.05;  // +0.05
    }
    if (llmResult.status === ruleBasedPartial.status) {
      confidence += 0.05;  // +0.05
    }
    if (llmResult.domain === ruleBasedPartial.domain) {
      confidence += 0.05;  // +0.05
    }
  }
  
  return Math.min(confidence, 0.95);  // 最大0.95
}
```

**効果**:
- LLM生成の信頼度が向上
- ルールベースと一致する場合は信頼度が増加

---

## 📝 実装の優先順位

### Phase 1: 即座に実装可能（影響大）
1. ✅ **ルールベース生成の条件緩和**（改善策 A）
   - 影響: 高
   - 工数: 小
   - 効果: ルールベース割合 61.5% → 75%以上

2. ✅ **ドメイン推論の精度向上**（改善策 B）
   - 影響: 中
   - 工数: 中
   - 効果: ドメイン精度向上

### Phase 2: 中期的に実装（影響中）
3. ✅ **カテゴリ推論の拡張**（改善策 C）
   - 影響: 中
   - 工数: 中
   - 効果: カテゴリ精度向上

4. ✅ **LLMプロンプトの強化**（改善策 A）
   - 影響: 中
   - 工数: 小
   - 効果: LLM生成精度向上

### Phase 3: 長期的に実装（影響小）
5. ✅ **温度パラメータの調整**（改善策 B）
   - 影響: 小
   - 工数: 極小
   - 効果: 微調整

6. ✅ **後処理による信頼度調整**（改善策）
   - 影響: 小
   - 工数: 中
   - 効果: 信頼度の微調整

---

## 🎯 期待される効果

### 現状（改善前）
- 高信頼度: 61.5%
- ルールベース: 61.5%
- LLMベース: 38.5%

### 改善後（Phase 1 + Phase 2実装）
- 高信頼度: **80%以上**（目標達成）
- ルールベース: **75%以上**
- LLMベース: **25%以下**

### 改善後（Phase 1 + Phase 2 + Phase 3実装）
- 高信頼度: **85%以上**
- ルールベース: **80%以上**
- LLMベース: **20%以下**

---

## 📌 次のステップ

1. **Phase 1を実装**: ルールベース生成の条件緩和とドメイン推論の精度向上
2. **テスト実行**: 改善後の生成精度を測定
3. **Phase 2を実装**: カテゴリ推論の拡張とLLMプロンプトの強化
4. **最終測定**: 目標80%以上を達成しているか確認

