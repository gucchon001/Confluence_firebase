# Knowledge Graph / GraphRAG ドキュメント一覧

**最終更新**: 2025年10月19日

---

## 📚 ドキュメント構成

### 🌟 メインドキュメント

#### [Knowledge Graph 総合ドキュメント](./knowledge-graph-comprehensive-overview.md)
**すべてのKG/GraphRAG情報を統合した総合ドキュメント**

- エグゼクティブサマリー
- 現在の実装状況
- GraphRAGとの比較
- パフォーマンス分析
- 将来的な導入計画（デュアルモード検索）
- 技術仕様

**推奨**: まずこのドキュメントをお読みください。

---

## 📂 関連ドキュメント

### 提案書（Proposals）

#### [GraphRAG デュアルモード検索提案](../proposals/graphrag-dual-mode-search.md)
**将来的な実装計画の詳細**

- デュアルモード検索のコンセプト
- UI/UX設計
- 段階的な実装計画
- 期待される効果
- リスクと対策

### 分析レポート（Analysis）

#### [GraphRAG パフォーマンス影響分析](../analysis/graphrag-performance-impact.md)
**GraphRAG導入時のパフォーマンス影響を詳細分析**

- グラフトラバーサルのコスト
- Community Detectionの計算量
- Firestoreクエリのボトルネック
- 最適化後の予測

### 実装ドキュメント（Implementation）

#### [KG 貢献度分析レポート](../implementation/kg-contribution-analysis-report.md)
**Phase 0A-2でのKG拡張無効化の判断根拠**

- KG構築状況
- 検索結果とKGの関係
- コスト分析
- 推奨アクション

---

## 📦 アーカイブ（Archive）

以下のドキュメントは参考情報として保管されています。

### [KG仕様書（Phase 0A-2）](../archive/kg-specification-phase-0a-2.md)
**Knowledge Graph の詳細仕様**

- グラフ構造
- エッジ抽出ロジック
- 実装方法
- パフォーマンス計測

### [GraphRAG アーキテクチャ](../archive/graphrag-tuned-architecture.md)
**初期のGraphRAG設計ドキュメント**

- ナレッジグラフ構築
- 多層的検索プロセス
- 進化したラベルシステム

### [Phase 0A Knowledge Graph Impact](../archive/phase-0a-knowledge-graph-impact.md)
**KGで解決できる問題の分析**

- 問題分類と解決可能性
- 6つの事例での効果予測
- 実装優先度

---

## 🎯 ドキュメントナビゲーション

### あなたの目的に応じて

#### 「KGとは何か知りたい」
→ [総合ドキュメント: 3. Knowledge Graph の基礎](./knowledge-graph-comprehensive-overview.md#3-knowledge-graph-の基礎)

#### 「なぜKG拡張を無効化したのか知りたい」
→ [総合ドキュメント: 5. パフォーマンス分析](./knowledge-graph-comprehensive-overview.md#5-パフォーマンス分析)  
→ [KG貢献度分析レポート](../implementation/kg-contribution-analysis-report.md)

#### 「GraphRAGとの違いを知りたい」
→ [総合ドキュメント: 4. GraphRAG との比較](./knowledge-graph-comprehensive-overview.md#4-graphrag-との比較)

#### 「将来的な導入計画を知りたい」
→ [総合ドキュメント: 6. 将来的な導入計画](./knowledge-graph-comprehensive-overview.md#6-将来的な導入計画デュアルモード検索)  
→ [GraphRAG デュアルモード検索提案](../proposals/graphrag-dual-mode-search.md)

#### 「技術仕様を知りたい」
→ [総合ドキュメント: 7. 技術仕様](./knowledge-graph-comprehensive-overview.md#7-技術仕様)  
→ [KG仕様書（Phase 0A-2）](../archive/kg-specification-phase-0a-2.md)

#### 「パフォーマンス影響を知りたい」
→ [GraphRAG パフォーマンス影響分析](../analysis/graphrag-performance-impact.md)

---

## 📊 クイックリファレンス

### 現在の状態

```
実装状況: KG構築システム完成、KG拡張は無効化
理由: パフォーマンス悪化（9.2秒）に対して品質向上なし
検索時間: 0.88秒（KG無効化後）
発見率: 100%
```

### 将来の方向性

```
推奨: デュアルモード検索
- ⚡高速検索（デフォルト）: 1秒
- 🔬詳細分析（オプション）: 10-30秒
参考: OpenAI o1の「Thinking Mode」
```

### 次のアクション

```
1. プロトタイプ作成（1-2日）
2. 効果測定（1週間）
3. 本格実装判断
```

---

## 🔗 外部リンク

### 参考資料

- [ナレッジグラフを活用するGraphRAGを俯瞰する](https://zenn.dev/zenkigen_tech/articles/0a25b2eaefb304)
- [Graph Retrieval-Augmented Generation: A Survey](https://arxiv.org/abs/2408.08921)
- [GraphRAGをわかりやすく解説](https://qiita.com/ksonoda/items/98a6607f31d0bbb237ef)

### 実装事例

- OpenAI o1 "Thinking Mode"
- Google Search "Deep Research" モード
- Microsoft GraphRAG

---

## 📝 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-10-19 | 総合ドキュメント作成、関連ドキュメント整理 |
| 2025-10-15 | KG貢献度分析、無効化判断 |
| 2025-10-14 | Phase 0A-2 KG実装完了 |

---

**質問・フィードバック**: プロジェクトチームまで

