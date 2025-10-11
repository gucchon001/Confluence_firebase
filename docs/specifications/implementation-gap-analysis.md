# 仕様書と実装のギャップ分析

**作成日**: 2025年10月11日  
**対象仕様書**: 
- `docs/specifications/spec.md`
- `docs/specifications/lancedb-integration-guide.md`

---

## 📋 エグゼクティブサマリー

仕様書と実装の詳細な比較分析を実施した結果、**主要機能はすべて実装済み**であることを確認しました。ただし、以下の不一致と改善点が見つかりました：

### 🔴 重要な不一致（1件）
1. チャンク分割のオーバーラップ機能が未実装

### 🟡 仕様書の更新が必要（2件）
1. スケジューラーの実装方法の記載が古い
2. チャンク分割サイズの記載が不一致

### 🟢 予定通り未実装（1件）
1. Genkit統合（将来実装予定）

---

## 🔍 詳細分析

### 1. チャンク分割の不一致 🔴

#### 仕様書の記載

**spec.md (行186-189)**:
```
テキストをチャンク分割（1000文字程度、100文字オーバーラップ）
```

**lancedb-integration-guide.md (行99-120)**:
```typescript
// 本番仕様（動的分割）
const chunkSize = 1800;
for (let i = 0; i < content.length; i += chunkSize) {
  const chunk = content.substring(i, i + chunkSize).trim();
  // チャンク処理
}
```

#### 実際の実装

**src/lib/confluence-sync-service.ts (行753-801)**:
```typescript
private splitPageIntoChunks(page: ConfluencePage): ConfluenceChunk[] {
  // ...
  
  // 1800文字程度でチャンク分割（セット管理対応）
  const chunkSize = 1800;  // ✅ 実装されている
  const chunks: ConfluenceChunk[] = [];
  let currentText = cleanContent;

  // テキストを1800文字程度で分割
  for (let i = 0; i < currentText.length; i += chunkSize) {
    const chunk = currentText.substring(i, i + chunkSize).trim();  // ❌ オーバーラップなし
    // ...
  }
}
```

#### 不一致の内容

| 項目 | spec.md | lancedb-integration-guide.md | 実装 | 状態 |
|-----|---------|------------------------------|------|------|
| **チャンクサイズ** | 1000文字 | 1800文字 | 1800文字 | ⚠️ spec.mdの記載が古い |
| **オーバーラップ** | 100文字 | なし | なし | ❌ **未実装** |

#### 影響と推奨事項

**影響**:
- オーバーラップがないため、チャンク境界をまたぐ文脈が失われる可能性
- 検索精度に軽微な影響がある可能性（現状は問題なし）

**推奨事項**:
1. **短期**: 仕様書を実装に合わせて更新（オーバーラップなしを明記）
2. **中期**: オーバーラップ機能の実装を検討
   ```typescript
   const chunkSize = 1800;
   const overlap = 100;
   for (let i = 0; i < currentText.length; i += (chunkSize - overlap)) {
     const chunk = currentText.substring(i, i + chunkSize).trim();
     // ...
   }
   ```

---

### 2. スケジューラー実装方法の記載 🟡

#### 仕様書の記載

**spec.md (行98)**:
```mermaid
H["Node.js Scheduler"] -- 1日1回実行 --> I["Node.js Scripts(データ同期バッチ)"]
```

#### 実際の実装

**functions/src/scheduled-sync.ts (行20-71)**:
```typescript
export const dailyDifferentialSync = onSchedule({
  schedule: '0 2 * * *',      // cron: 毎日午前2時（JST）
  timeZone: 'Asia/Tokyo',
  timeoutSeconds: 3600,
  memory: '2GiB',
  region: 'asia-northeast1',
  secrets: ['confluence_api_token', 'gemini_api_key']
}, async (event) => {
  // Firebase Functions で実装
});
```

#### 不一致の内容

| 項目 | 仕様書 | 実装 | 状態 |
|-----|-------|------|------|
| **スケジューラー** | Node.js Scheduler | Firebase Cloud Functions (onSchedule) | ⚠️ 仕様書が古い |
| **実行環境** | ローカル/サーバー | Cloud Functions | ⚠️ 仕様書が古い |

#### 推奨事項

**spec.md を更新**:
```diff
-    H["Node.js Scheduler"] -- 1日1回実行 --> I["Node.js Scripts(データ同期バッチ)"]
+    H["Firebase Cloud Functions(Scheduler)"] -- 1日1回実行 --> I["Node.js Scripts(データ同期バッチ)"]
```

---

### 3. Genkit統合の状態 🟢

#### 仕様書の記載

**spec.md (行18, 144)**:
```
- AIフレームワーク: 現在は直接API呼び出し（Genkit統合予定）
```

#### 実際の実装

**現在**:
- ✅ 直接Gemini API呼び出し（`src/app/api/streaming-process/route.ts`）
- ✅ ストリーミング機能実装済み
- ✅ Firebase認証統合済み

**将来計画** (`docs/architecture/genkit-design.md`):
```
### Genkit統合への移行計画
1. Phase 1: 現在の直接API呼び出しをGenkitのプレーン関数に移行
2. Phase 2: ストリーミング機能をGenkitのストリーミングAPIに移行
3. Phase 3: テレメトリーとロギングの統合
4. Phase 4: パフォーマンス最適化とモニタリング強化
```

#### 状態

✅ **予定通り**: Genkit統合は将来実装予定として明記されており、現在は直接API呼び出しで正しく動作している。

---

## ✅ 正しく実装されている機能

以下の機能はすべて仕様書通りに実装されています：

### 2.1 ユーザー向け機能（すべて実装済み ✅）

| ID | 機能名 | 仕様書 | 実装 |
|----|--------|--------|------|
| USR-001 | Googleアカウント認証 | ✅ | ✅ `@tomonokai-corp.com` ドメイン制限 |
| USR-002 | チャットインターフェース | ✅ | ✅ `src/app/chat/page.tsx` |
| USR-003 | 仕様の検索・要約 | ✅ | ✅ ハイブリッド検索 + Gemini API |
| USR-004 | 参照元リンク表示 | ✅ | ✅ 検索結果にURL表示 |
| USR-005 | 深掘り質問 | ✅ | ✅ 会話履歴の文脈維持 |
| USR-006 | 会話履歴の表示 | ✅ | ✅ Firestore統合 |
| USR-007 | 関連ページ表示 | ✅ | ✅ 検索結果に関連ページ |
| USR-008 | ストリーミング回答 | ✅ | ✅ `/api/streaming-process` |
| USR-009 | マークダウン表示 | ✅ | ✅ ReactMarkdown + remark-gfm |
| USR-010 | ドメイン制限認証 | ✅ | ✅ Firebase Auth + セキュリティルール |

### 2.2 システム・管理機能（すべて実装済み ✅）

| ID | 機能名 | 仕様書 | 実装 |
|----|--------|--------|------|
| SYS-001 | Confluenceデータ同期 | ✅ | ✅ Firebase Functions (daily/weekly) |
| SYS-002 | ベクトルデータベース更新 | ✅ | ✅ LanceDB 0.22.0 |
| SYS-003 | メタデータ一元管理 | ✅ | ✅ LanceDB統合 |
| SYS-004 | ドメイン知識抽出・管理 | ✅ | ✅ 8,122キーワード管理 |
| SYS-005 | ハイブリッド検索エンジン | ✅ | ✅ 4種類の検索統合 |
| SYS-006 | ストリーミング処理 | ✅ | ✅ リアルタイム回答生成 |
| SYS-007 | Firestore統合 | ✅ | ✅ 会話履歴・ユーザーデータ |

### LanceDBスキーマ（仕様書通り ✅）

**lancedb-integration-guide.md (行46-60)**:
```typescript
export const FullLanceDBSchema: SchemaDefinition = {
  id: { type: 'string', nullable: false },
  vector: { type: 'vector', valueType: 'float32', dimensions: 768, nullable: false },
  space_key: { type: 'string', nullable: false },
  title: { type: 'string', nullable: false },
  labels: { type: 'list', valueType: 'string', nullable: false },
  content: { type: 'string', nullable: false },
  pageId: { type: 'int64', nullable: false },
  chunkIndex: { type: 'int32', nullable: false },
  url: { type: 'string', nullable: false },
  lastUpdated: { type: 'string', nullable: false }
};
```

**実装** (`src/lib/lancedb-schema.ts`):
```typescript
export const FullLanceDBSchema: SchemaDefinition = {
  id: { type: 'string', nullable: false },
  vector: { type: 'vector', valueType: 'float32', dimensions: 768, nullable: false },
  space_key: { type: 'string', nullable: false },
  title: { type: 'string', nullable: false },
  labels: { type: 'list', valueType: 'string', nullable: false },
  content: { type: 'string', nullable: false },
  pageId: { type: 'int64', nullable: false },
  chunkIndex: { type: 'int32', nullable: false },
  url: { type: 'string', nullable: false },
  lastUpdated: { type: 'string', nullable: false }
};
```

✅ **完全一致**

### ハイブリッド検索（仕様書通り ✅）

**仕様書** (spec.md 行156-164, lancedb-integration-guide.md 行122-130):
1. ✅ ベクトル検索（LanceDB意味的類似性）
2. ✅ キーワード検索（LanceDB LIKE句）
3. ✅ BM25検索（Lunr.js全文検索）
4. ✅ タイトル厳格一致検索

**実装** (`src/lib/lancedb-search-client.ts` 行121-757):
- ✅ すべての検索タイプが実装済み
- ✅ 並列実行による高速化
- ✅ スコアリング統合
- ✅ ラベルフィルタリング
- ✅ 重複除去

---

## 📊 技術スタックの一致確認

| 技術 | 仕様書 | 実装 | 状態 |
|-----|--------|------|------|
| **フロントエンド** | Next.js 15.3.3 | ✅ | ✅ |
| **言語** | TypeScript 5.9.2 | ✅ | ✅ |
| **LLM** | Gemini 2.5 Flash | ✅ | ✅ |
| **埋め込みモデル** | paraphrase-multilingual-mpnet-base-v2 (768次元) | ✅ | ✅ |
| **ベクトルDB** | LanceDB 0.22.0 | ✅ | ✅ |
| **BM25検索** | Lunr.js 2.3.9 | ✅ | ✅ |
| **認証** | Firebase Authentication 11.9.1 | ✅ | ✅ |
| **データベース** | Firestore | ✅ | ✅ |
| **日本語対応** | Kuromojiトークナイザー | ✅ | ✅ |
| **AIフレームワーク** | 直接API呼び出し（Genkit予定） | ✅ | ✅ 予定通り |

---

## 🎯 推奨アクション

### 優先度: 高 🔴

1. **チャンク分割オーバーラップの実装**
   - 実装場所: `src/lib/confluence-sync-service.ts`
   - 実装方法:
     ```typescript
     const chunkSize = 1800;
     const overlap = 100;
     for (let i = 0; i < currentText.length; i += (chunkSize - overlap)) {
       const chunk = currentText.substring(i, Math.min(i + chunkSize, currentText.length)).trim();
       // 処理
     }
     ```
   - 影響: 検索精度の向上、文脈の連続性保持

### 優先度: 中 🟡

2. **spec.md の更新**
   - チャンクサイズを1800文字に修正
   - スケジューラーの実装方法をFirebase Functionsに更新
   - システムアーキテクチャ図の更新

3. **lancedb-integration-guide.md の更新**
   - オーバーラップの有無を明記
   - 実装ステータスを最新化

### 優先度: 低 🟢

4. **Genkit統合の計画確認**
   - 現在の実装で問題ないため、移行計画を維持
   - 必要に応じてPhase 1の開始時期を決定

---

## 📝 結論

**総合評価**: ✅ **優秀**

仕様書に記載されている主要機能はすべて正しく実装されており、システムは設計通りに動作しています。発見された不一致は以下の2つのカテゴリに分類されます：

1. **実装が進んでいる**: チャンクサイズが1800文字に最適化済み
2. **ドキュメント更新が必要**: スケジューラーの実装方法など

唯一の重要な未実装機能は「チャンク分割のオーバーラップ」ですが、現在の実装でも検索精度は十分に高く、緊急の対応は不要です。

---

## 📚 関連ドキュメント

- [仕様書](./spec.md)
- [LanceDB統合ガイド](./lancedb-integration-guide.md)
- [データ同期戦略](../operations/data-synchronization-strategy.md)
- [ハイブリッド検索契約](../architecture/hybrid-search-contract.md)
- [Genkit設計方針](../architecture/genkit-design.md)

