# スコアリング簡素化の影響分析

## 変更概要

検索パフォーマンスを向上させるため、複雑なスコアリングロジックを簡素化しました。
本ドキュメントでは、削除したロジックと品質への影響を分析します。

---

## 1. 削除したロジックの詳細

### 1.1 キーワードスコア計算の簡素化

#### ❌ **削除前（複雑版）**
```typescript
// calculateKeywordScore関数を使用
const scoreResult = calculateKeywordScore(
  title, content, labels, keywords, 
  { highPriority, lowPriority }
);
const keywordScore = scoreResult.score;
const titleMatches = scoreResult.titleMatches;
const labelMatches = scoreResult.labelMatches;
const contentMatches = scoreResult.contentMatches;

// 詳細なデバッグログを出力
console.log(`  Score details: keyword=${keywordScore}, 
  title=${titleMatches}, label=${labelMatches}, 
  content=${contentMatches}, labelScore=0`);
```

**特徴**:
- タイトル、ラベル、コンテンツの全てでキーワードマッチングを実行
- 高優先度・低優先度キーワードで重み付け
- マッチ数を個別に追跡

#### ✅ **削除後（簡素版）**
```typescript
// 簡素化されたキーワードスコア計算（高速化）
let keywordScore = 0;
let titleMatches = 0;
let labelMatches = 0;
let contentMatches = 0;

// 高優先度キーワード（タイトル＋ラベルのみチェック）
for (const kw of highPriority) {
  const kwLower = kw.toLowerCase();
  if (title.includes(kwLower)) {
    titleMatches++;
    keywordScore += 10; // タイトル一致は高スコア
  }
  // ラベルチェック（簡素化）
  const labelStr = labels.join(' ').toLowerCase();
  if (labelStr.includes(kwLower)) {
    labelMatches++;
    keywordScore += 5;
  }
}
```

**変更点**:
- ✅ **コンテンツのキーワードチェックを削除**（最も時間がかかる処理）
- ✅ **低優先度キーワードのチェックを削除**
- ✅ **デバッグログを削除**（I/Oコストの削減）

**影響**:
- ⚠️ **コンテンツ内のキーワードマッチが評価されない**
  - 例: タイトルに「パーソナルオファー」がなくても、本文に詳細がある文書が低評価になる可能性
- ✅ タイトルとラベルは最も重要なので、品質低下は限定的

---

### 1.2 ハイブリッドスコア計算の簡素化

#### ❌ **削除前（複雑版）**
```typescript
const hybridScore = calculateHybridScore(
  resultWithScore._distance, 
  keywordScore, 
  labelMatches
);
```

`calculateHybridScore`関数の内部:
```typescript
function calculateHybridScore(
  distance: number, 
  keywordScore: number, 
  labelScore: number
): number {
  // ベクトル距離を正規化（0-1範囲）
  const normalizedDistance = Math.min(1, distance / 2.0);
  
  // キーワードスコアを正規化
  const normalizedKeyword = Math.min(1, keywordScore / 50);
  
  // ラベルスコアを正規化
  const normalizedLabel = Math.min(1, labelScore / 5);
  
  // 重み付け合成
  // ベクトル: 50%, キーワード: 35%, ラベル: 15%
  const hybrid = 
    (0.5 * normalizedDistance) + 
    (0.35 * (1 - normalizedKeyword)) + // 高スコア = 低距離
    (0.15 * (1 - normalizedLabel));
  
  return hybrid;
}
```

#### ✅ **削除後（簡素版）**
```typescript
// 簡素化されたハイブリッドスコア
// ベクトル距離 + キーワードブースト
const distanceScore = resultWithScore._distance || 1.0;
const keywordBoost = keywordScore > 0 ? -0.3 : 0;
const hybridScore = distanceScore + keywordBoost;
```

**変更点**:
- ✅ **正規化処理を削除**（計算コストの削減）
- ✅ **ラベルスコアの重みを削除**（簡素化）
- ✅ **シンプルな加算式に変更**

**影響**:
- ⚠️ **スコアのスケールが変わる**
  - 前: 0〜1の範囲に正規化
  - 後: ベクトル距離ベース（通常0.3〜2.0）
- ⚠️ **ラベルマッチの重みがなくなった**
  - 例: 適切なラベル（「教室管理」など）を持つ文書の優位性が低下
- ✅ シンプルな加算式なので、挙動が予測しやすい

---

### 1.3 BM25ブーストロジックの削除

#### ❌ **削除前（複雑版）**

**削除したロジック**:

1. **見出し一致ブースト**
```typescript
// Markdownや番号付きの見出し行での一致を加点
const headingLines = content
  .split(/\n+/)
  .filter((line) => /^(#{1,6}\s|\d+(?:\.\d+)*\s|...)/.test(line.trim()));
// 見出し内でのキーワードマッチに +0.15/hit（最大+1.0）
```

**目的**: 見出しに含まれるキーワードを高く評価
**コスト**: コンテンツの行分割・正規表現マッチング

2. **制約表現検出ブースト**
```typescript
// 否定/制限語や期間表現の共起に微加点
const constraintRe = /(不可|できない|できません|禁止|制限|...)/g;
const timeRe = /([0-9０-９]{1,4})\s*(日|日間|時間|週|...)/g;
// 制約表現とキーワードの近接（30文字以内）で加点
```

**目的**: 「〜できない」「〜日以内」などの制約情報を含む文書を優遇
**コスト**: 複数の正規表現マッチング・近接検索

3. **近接・フレーズブースト**
```typescript
// タイトル内でクエリ語の距離が近い場合の微小加点
const terms = searchKeywords.slice(0, 3).filter(Boolean);
const pos = terms.map(t => title.indexOf(t)).filter(p => p >= 0);
const span = pos[pos.length - 1] - pos[0];
if (span > 0 && span < 20) {
  totalScore += 0.3; // 近接ボーナス
}
```

**目的**: キーワードが近接している文書を優遇
**コスト**: 位置計算・ソート

#### ✅ **削除後（簡素版）**
```typescript
// フレーズブーストのみ（最も効果的）
const rawQuery = (params.query || '').trim();
if (rawQuery) {
  const phrase = rawQuery.replace(/[\s　]+/g, '');
  const titlePlain = title.replace(/[\s　]+/g, '');
  const contentPlain = content.replace(/[\s　]+/g, '');
  const phraseInTitle = titlePlain.includes(phrase);
  const phraseInBody = contentPlain.includes(phrase);
  if (phraseInTitle) totalScore += 2.0; // タイトル一致
  if (phraseInBody) totalScore += 0.5;  // 本文一致
}
```

**変更点**:
- ✅ **見出し一致ブーストを削除**
- ✅ **制約表現検出を削除**
- ✅ **近接ボーナスを削除**
- ✅ **クエリ全体のフレーズマッチのみ維持**（最も効果的）

**影響**:
- ⚠️ **見出しにキーワードがある文書の優位性が低下**
  - 例: 「## パーソナルオファーの送信制限」という見出しがあっても評価されない
- ⚠️ **制約情報を含む文書の優位性が低下**
  - 例: 「最大100件まで送信可能」という制約情報が評価されない
- ⚠️ **キーワードの近接度が評価されない**
  - 例: 「教室 コピー 機能」と「教室管理のコピー機能」の区別がつかない
- ✅ クエリ全体のフレーズマッチは維持（最も重要）

---

### 1.4 RRF融合の簡素化

#### ❌ **削除前（複雑版）**
```typescript
// 4つのランキングを融合
const byVector = [...results].sort((a, b) => a._distance - b._distance);
const byKeyword = [...results].sort((a, b) => b._keywordScore - a._keywordScore);
const byTitleExact = results.filter(r => r._sourceType === 'title-exact');
const byBm25 = results.filter(r => r._sourceType === 'bm25');

// 各ランキングの順位を取得
const vecRank = new Map(); // ベクトル距離順位
const kwRank = new Map();  // キーワードスコア順位
const titleRank = new Map(); // タイトル完全一致順位
const bm25Rank = new Map(); // BM25スコア順位

// 重み付きRRFスコアを計算
// vector=1.0, keyword=0.8, title-exact=1.2, bm25=0.6
let rrf = (1.0 / (60 + vr)) + 
          0.8 * (1 / (60 + kr)) + 
          (tr ? 1.2 * (1 / (60 + tr)) : 0) + 
          (br ? 0.6 * (1 / (60 + br)) : 0);

// ドメイン減衰（議事録、汎用文書）
if (hasPenalty) rrf *= 0.9;
if (isGenericDoc) rrf *= 0.8;

// 制約表現の加点
const add = Math.min(0.02, cHits * 0.003 + tHits * 0.002);
rrf += add;
```

**特徴**:
- 4つの異なるランキングを融合
- 複雑なペナルティ・ブースト計算

#### ✅ **削除後（簡素版）**
```typescript
// ハイブリッドスコアのみでソート
const byHybrid = [...results].sort((a, b) => 
  (a._hybridScore ?? 1) - (b._hybridScore ?? 1)
);

for (let i = 0; i < byHybrid.length; i++) {
  const r = byHybrid[i];
  // シンプルなRRFスコア
  let rrf = 1.0 / (60 + i + 1);
  
  // 簡素化されたペナルティ（議事録のみ）
  const titleStr = String(r.title || '').toLowerCase();
  if (titleStr.includes('議事録') || titleStr.includes('本システム外')) {
    rrf *= 0.8;
  }
  
  r._rrfScore = rrf;
}
```

**変更点**:
- ✅ **4つのランキング → 1つのハイブリッドスコア**
- ✅ **複雑なペナルティを2つのみに削減**
- ✅ **制約表現の加点を削除**

**影響**:
- ⚠️ **BM25とタイトル完全一致の独立評価がなくなった**
  - 例: タイトル完全一致文書の優位性が低下
- ⚠️ **汎用文書ペナルティの削除**
  - 例: 「用語集」「ガイドライン」などの汎用文書が上位に来やすくなる可能性
- ✅ シンプルで高速

---

### 1.5 その他の削除

#### ❌ **合意スコア加点**
```typescript
// クエリ上位語をタイトル/本文に含むドキュメント群の合意度で微加点
// 全結果を相互比較（O(n²)の計算）
```

**影響**: 複数の文書で共通して言及されているトピックの優遇がなくなる

#### ❌ **MMR多様化**
```typescript
// Jaccard類似度を使った多様性の確保
// タイトルのbi-gramで類似文書を除外
```

**影響**: タイトルが似ている文書が連続して表示される可能性

#### ❌ **Cross-Encoderスタブ**
```typescript
// 将来的な実装のためのプレースホルダー
```

**影響**: なし（未実装機能）

---

## 2. 品質への影響予測

### 2.1 品質が維持される可能性が高いケース ✅

**理由**: タイトルとラベルが適切に設定されている文書が多い

1. **タイトルにキーワードが含まれる質問**
   - 例: 「教室コピー機能とは？」
   - → タイトル「教室コピー機能」でマッチ
   - ✅ **影響なし**

2. **クエリ全体がタイトルや本文に含まれる質問**
   - 例: 「パーソナルオファーは最大何件送れますか」
   - → フレーズマッチで検出
   - ✅ **影響なし**

3. **シンプルなファクト質問**
   - 例: 「ログイン認証の仕組みは？」
   - → ベクトル検索で十分
   - ✅ **影響なし**

### 2.2 品質が低下する可能性があるケース ⚠️

**理由**: 削除したロジックに依存していた検索シナリオ

1. **制約・条件に関する質問**
   - 例: 「パーソナルオファーは何件まで送れますか？」
   - ❌ 制約表現検出が削除されたため、「上限100件」などの制約情報の評価が低下
   - **リスク**: 中程度

2. **見出しにキーワードがあるが、タイトルには含まれない文書**
   - 例: タイトル「機能一覧」、見出し「## パーソナルオファー機能」
   - ❌ 見出しブーストが削除されたため、評価が低下
   - **リスク**: 低（Confluenceでは通常タイトルが適切）

3. **複合的なキーワードを含む質問**
   - 例: 「教室グループの求人設定」
   - ❌ キーワードの近接度評価が削除
   - **リスク**: 低（ベクトル検索で補完可能）

4. **汎用文書の混入**
   - 例: 「用語集」「ガイドライン」などが上位に来る
   - ❌ 汎用文書ペナルティが削減
   - **リスク**: 中程度

5. **タイトルが似ている文書の重複表示**
   - 例: 「【FIX】パーソナルオファー - 登録」「【FIX】パーソナルオファー - 削除」
   - ❌ MMR多様化が削除
   - **リスク**: 低（重複除去ロジックは維持）

---

## 3. 推奨される検証方法

### 3.1 A/Bテスト用の質問リスト

**高リスク質問**（制約・条件系）:
1. 「パーソナルオファーは最大何件送れますか？」
2. 「求人は何日間掲載されますか？」
3. 「ログイン失敗は何回までできますか？」
4. 「画像のアップロード上限は？」

**中リスク質問**（複合キーワード系）:
1. 「教室グループの求人設定方法は？」
2. 「クライアント企業の契約管理」
3. 「会員の応募履歴確認」

**低リスク質問**（シンプル系）:
1. 「教室コピー機能とは？」
2. 「ログイン認証の仕組みは？」
3. 「求人検索機能について」

### 3.2 品質メトリクス

比較すべき指標:

1. **参照文書の関連性**
   - 上位5件の文書が質問に適切に答えているか
   - スコア: 1（完全一致）〜 0（無関係）

2. **回答の品質**
   - AIが生成した回答が正確か
   - スコア: 1（正確）〜 0（不正確）

3. **検索時間**
   - 最適化前後での時間短縮効果

4. **重複文書の有無**
   - 同じトピックの文書が連続表示されていないか

### 3.3 検証手順

1. **事前準備**
   - 最適化前のコードをブランチに保存
   - テスト質問リストを準備

2. **最適化前の測定**
   - 各質問で検索を実行
   - 参照文書、回答、検索時間を記録

3. **最適化後の測定**
   - 同じ質問で検索を実行
   - 同様に記録

4. **比較分析**
   - 品質メトリクスを比較
   - 劣化が見られた質問パターンを特定

---

## 4. 結論

### 期待される結果

**パフォーマンス改善**: ✅
- 検索時間: 11.8秒 → **5-6秒**（約50%削減）

**品質への影響**: ⚠️ **限定的**
- **維持される**: タイトルベースの検索、フレーズマッチ
- **低下リスク**: 制約条件検索、見出しマッチ、汎用文書除外

### 推奨アクション

1. **実際のユーザークエリでA/Bテスト**を実施
2. 品質低下が確認された場合、**重要なロジックのみ復元**:
   - 制約表現検出（最も影響大）
   - 汎用文書ペナルティ（中程度の影響）
3. **段階的な最適化**:
   - 現在の簡素版でテスト
   - 問題があれば、ロジックを1つずつ復元
   - パフォーマンスと品質のバランスを見つける

---

**作成日**: 2025-10-08
**バージョン**: 1.0

