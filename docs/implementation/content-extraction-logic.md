# コンテンツ抽出ロジックの整理

## 概要

LLMに渡すコンテンツを、クエリに関連する部分を優先的に抽出するためのロジックです。
ランクによる先頭取得とキーワードマッチングによる補完を組み合わせたハイブリッド方式を採用しています。

## 使用箇所

- `src/ai/flows/streaming-summarize-confluence-docs.ts`: LLMのコンテキスト生成時に使用
- `src/ai/flows/content-extraction-utils.ts`: 抽出ロジックの実装

## 処理フロー

### 1. キーワード抽出 (`extractKeywords`)

クエリからキーワードを抽出します。

#### 優先順位

1. **ドメイン知識連携のキーワード抽出サービス** (`unifiedKeywordExtractionService.extractKeywordsSync`)
   - ドメイン知識ベースからキーワードを抽出
   - より精度の高いキーワード抽出が可能

2. **フォールバック: 簡易版のキーワード抽出**
   - ストップワード（助詞など）を除外
   - 2文字以上の連続する文字列を抽出
   - ひらがな、カタカナ、漢字、数字、英字を単語として扱う

#### 例

```
クエリ: "会員情報の学年や現在の職業は自動で更新されますか"
抽出キーワード: ["会員情報", "学年", "職業", "更新"]
```

### 2. マーカー検出

コンテンツ内の重要なマーカー（表の中身、図、条件など）を検出します。

#### 検出パターン（優先順位順）

1. **表の中身（優先）**
   - `更新内容`, `更新前`, `更新後`
   - `学部\d+年生` (学部1年生、学部2年生など)
   - `修士\d+年生` (修士1年生、修士2年生など)
   - `博士\d+年生` (博士1年生、博士2年生など)
   - `入学見込み`, `卒業`, `中退`

2. **図・条件**
   - `図\d+` (図1, 図2など)
   - `条件\d+` (条件1, 条件2など)

3. **表のタイトル（補助的）**
   - `表\d+` (表1, 表2など)
   - 表の中身が含まれていれば必須ではない

#### 設計思想

- **表のタイトルよりも表の中身を優先**: 表の中身（「更新前」「更新後」「学部1年生」など）が含まれていれば、表のタイトル（「表1」「表2」）は必須ではない
- LLMは表の中身から情報を理解できるため、タイトルは補助的な情報として扱う

### 3. ハイブリッド抽出 (`extractRelevantContentMultiKeyword`)

#### ステップ1: ランクによる先頭取得

- ランクに基づいて先頭から`maxLength`分の文字数を取得
- 1位: 1500文字、2位: 1000文字、3位: 800文字、4-6位: 600文字、7-10位: 500文字

```typescript
let startPos = 0;
let endPos = Math.min(content.length, maxLength);
let extracted = content.substring(startPos, endPos);
```

#### ステップ2: キーワード範囲の確認

先頭取得した範囲内にキーワードが含まれているか確認します。

```typescript
const keywordsInRange = keywordPositions.filter(kp => kp.position < endPos);
const keywordsOutOfRange = keywordPositions.filter(kp => kp.position >= endPos);
```

#### ステップ3: 重要マーカーの検出

先頭範囲内の重要なマーカー（表の中身、図など）を検出します。

```typescript
const importantMarkersInRange = keywordsInRange.filter(kp => 
  /更新前|更新後|更新内容|学部\d+年生|修士\d+年生|博士\d+年生|入学見込み|卒業|中退|図\d+|条件\d+/.test(kp.keyword)
);
```

#### ステップ4: 範囲外キーワードの補完

範囲外のキーワードがある場合、それらを含むように範囲を拡張します。

##### ケース1: 全体の範囲が`maxLength`以内の場合

- 範囲外のキーワードまで含める
- 先頭の重要マーカーを保持することを優先

```typescript
if (totalSpan <= maxLength) {
  endPos = Math.min(content.length, lastOutOfRange + 50);
  // 先頭の重要マーカーが範囲外にならないように調整
  if (firstImportantMarker !== null && firstImportantMarker < maxLength) {
    endPos = Math.min(content.length, startPos + maxLength);
  } else {
    startPos = Math.max(0, endPos - maxLength);
  }
}
```

##### ケース2: 全体の範囲が`maxLength`を超える場合

- 範囲外のキーワードを含む最小範囲を計算
- 先頭の重要マーカーを保持しつつ、範囲外のキーワードを含める

```typescript
else {
  const neededForOutOfRange = lastOutOfRange - firstOutOfRange + 100;
  
  if (neededForOutOfRange <= maxLength) {
    // 先頭の重要マーカーが前半にある場合、先頭を保持
    if (firstImportantMarker !== null && firstImportantMarker < maxLength * 0.5) {
      // 先頭範囲を保持したまま、範囲外キーワードを含める
      endPos = Math.min(content.length, lastOutOfRange + 50);
    } else {
      // 先頭範囲を少し削減して、範囲外キーワードを含める
      startPos = Math.max(0, firstOutOfRange - (maxLength - neededForOutOfRange));
      endPos = Math.min(content.length, lastOutOfRange + 50);
    }
  } else {
    // 範囲外のキーワードを含む範囲がmaxLengthを超える場合
    // 先頭の重要マーカーを優先的に保持
    if (firstImportantMarker !== null && firstImportantMarker < maxLength * 0.5) {
      endPos = Math.min(content.length, startPos + maxLength);
    } else {
      // 範囲外のキーワードを優先的に含める
      endPos = Math.min(content.length, lastOutOfRange + 50);
      startPos = Math.max(0, endPos - maxLength);
    }
  }
}
```

#### ステップ5: 最終調整

- 抽出した部分が`maxLength`を超える場合は切り詰める
- 先頭・末尾に`...`を追加（切り取られた場合）

```typescript
if (extracted.length > maxLength) {
  extracted = extracted.substring(0, maxLength);
  endPos = startPos + maxLength;
}

if (startPos > 0) {
  extracted = '...' + extracted;
}
if (endPos < content.length) {
  extracted = extracted + '...';
}
```

## 現在の問題点

### 問題1: 「表1」が含まれない

テスト結果:
- 「表2」: ✅ 含む
- 「表1」: ❌ 含まない
- 「現在の職業の更新」: ✅ 含む

**原因の仮説**:
- 「表1」の位置（502文字目）が先頭範囲（600文字）内にあるが、範囲外のキーワード（「現在の職業の更新」が1092文字目）を含めるために範囲が調整され、結果的に「表1」が範囲外になった可能性

**調査が必要な点**:
1. 「表1」が実際に抽出範囲内にあるか
2. 範囲外キーワードを含める際の調整ロジックが適切か
3. 重要マーカーの優先順位が正しいか

### 問題2: 「入学からの経過年数」が含まれない

テスト結果:
- 「入学からの経過年数」: ❌ 含まない

**原因の仮説**:
- 「入学からの経過年数」がマーカーパターンに含まれていない
- キーワード抽出で「入学からの経過年数」が抽出されていない可能性

**調査が必要な点**:
1. 「入学からの経過年数」がキーワードとして抽出されているか
2. マーカーパターンに追加すべきか

## 改善案

### 案1: 表の中身を優先する方針を維持

- 表のタイトル（「表1」「表2」）よりも、表の中身（「更新前」「更新後」など）を優先
- 表の中身が含まれていれば、表のタイトルは必須ではない
- **ただし、表の中身が含まれていない場合は、表のタイトルも検出対象に含める**

### 案2: 重要マーカーの優先順位を調整

- 先頭範囲内の重要マーカーを保持する際のロジックを改善
- 範囲外キーワードを含める際も、先頭範囲内の重要マーカーを確実に保持

### 案3: キーワード抽出の改善

- 「入学からの経過年数」などの複合キーワードを正しく抽出できるようにする
- ドメイン知識ベースに追加するか、マーカーパターンに追加

## テスト方法

```bash
# 学年自動更新バッチのコンテンツ抽出テスト
npx tsx scripts/test-grade-update-extraction.ts
```

## 関連ファイル

- `src/ai/flows/content-extraction-utils.ts`: 抽出ロジックの実装
- `src/ai/flows/streaming-summarize-confluence-docs.ts`: LLMコンテキスト生成
- `scripts/test-grade-update-extraction.ts`: テストスクリプト

