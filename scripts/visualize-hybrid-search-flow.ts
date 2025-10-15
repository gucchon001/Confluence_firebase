/**
 * ハイブリッド検索フローの視覚的比較
 */

console.log('╔════════════════════════════════════════════════════════════════════════╗');
console.log('║       ハイブリッド検索フロー：現在 vs 推奨                              ║');
console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 現在のフロー（Phase 0A-3）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('  [クエリ受信]\n      ↓');
console.log('  [並列前処理]');
console.log('    ├─ キーワード抽出');
console.log('    ├─ エンベディング生成');
console.log('    └─ LanceDB接続\n      ↓');
console.log('  [ベクトル検索] ← 最初の検索');
console.log('    ├─ topK * 2件取得（100件）');
console.log('    ├─ 距離閾値フィルタ（maxDistance=2.0）');
console.log('    ├─ ラベルフィルタリング（excludeLabels）');
console.log('    ├─ タイトルブースト ← ⚠️ ここで初めてタイトル検索');
console.log('    └─ topK件に制限（50件）\n      ↓');
console.log('  [BM25検索]');
console.log('    ├─ キーワード検索（Lunr.js）');
console.log('    └─ ラベルフィルタリング\n      ↓');
console.log('  [RRF融合]');
console.log('    ├─ ベクトル順位');
console.log('    └─ BM25順位\n      ↓');
console.log('  [結果返却] 50件\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚨 現在のフローの問題点');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('  1. タイトル検索がベクトル検索の後');
console.log('     → ベクトルtopKに入らないと無効');
console.log('     → 046_会員退会機能が678位 → タイトル検索に到達しない\n');

console.log('  2. ラベルがフィルタリングのみ');
console.log('     → スコアに貢献しない');
console.log('     → domain/category情報が活用されていない\n');

console.log('  3. KGが検索フローに統合されていない');
console.log('     → 最終段階でのみ適用');
console.log('     → 検索候補の拡張が遅い\n');

console.log('  4. チャンクサイズが大きすぎる');
console.log('     → TOKEN_LIMIT=8,192（推奨の8倍）');
console.log('     → 平均1,907文字が1つのベクトルに圧縮\n');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ 推奨フロー（Multi-Stage Retrieval）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('  [クエリ受信]\n      ↓');
console.log('  [並列前処理]');
console.log('    ├─ キーワード抽出');
console.log('    ├─ エンベディング生成');
console.log('    └─ LanceDB接続\n      ↓');
console.log('  ┌─────────────────────────────────┐');
console.log('  │ Stage 1: 高速一致検索（優先） │');
console.log('  └─────────────────────────────────┘');
console.log('  ├─ タイトル厳格一致検索 ← ⭐ 最優先');
console.log('  │   └─ 発見 → 即座に返す（Early Exit）');
console.log('  ├─ タイトル部分一致検索（キーワードベース）');
console.log('  │   ├─ 全キーワードマッチ → 最優先候補');
console.log('  │   └─ 2つ以上マッチ → 優先候補');
console.log('  └─ ラベル一致検索');
console.log('      └─ domain + category一致 → 優先候補\n      ↓');
console.log('  ┌─────────────────────────────────┐');
console.log('  │ Stage 2: セマンティック検索      │');
console.log('  └─────────────────────────────────┘');
console.log('  【並列実行】');
console.log('  ├─ ベクトル検索（topK * 5）');
console.log('  ├─ BM25検索（topK * 3）');
console.log('  └─ ラベル類似検索（topK * 2）\n      ↓');
console.log('  ┌─────────────────────────────────┐');
console.log('  │ Stage 3: Knowledge Graph拡張     │');
console.log('  └─────────────────────────────────┘');
console.log('  ├─ Stage 1+2の結果から');
console.log('  ├─ 参照関係で拡張（weight >= 0.7）');
console.log('  └─ ドメイン関係で拡張（weight >= 0.5）\n      ↓');
console.log('  ┌─────────────────────────────────┐');
console.log('  │ Stage 4: 複合スコアリング        │');
console.log('  └─────────────────────────────────┘');
console.log('  score = (');
console.log('    title_exact * 0.40 +');
console.log('    title_partial * 0.25 +');
console.log('    vector * 0.20 +');
console.log('    bm25 * 0.10 +');
console.log('    label * 0.05');
console.log('  )\n      ↓');
console.log('  [最終Re-ranking]');
console.log('    └─ 複合スコアでソート → topK件\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 フロー比較表');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const flowComparison = [
  { feature: 'タイトル検索のタイミング', current: 'ベクトル検索の後', recommended: '最優先（Early Exit）', impact: '🔴 Critical' },
  { feature: 'タイトル検索の方法', current: 'query全体一致', recommended: 'キーワード単位', impact: '🔴 Critical' },
  { feature: 'ラベルの活用', current: 'フィルタのみ', recommended: 'スコアリングに統合', impact: '🟡 Major' },
  { feature: 'KGの統合', current: '最終段階', recommended: '早期統合', impact: '🟡 Major' },
  { feature: 'チャンクサイズ', current: '8,192トークン', recommended: '1,024トークン', impact: '🔴 Critical' },
  { feature: 'オーバーラップ', current: 'なし', recommended: '10-20% (200文字)', impact: '🟡 Major' },
  { feature: 'スコア計算', current: 'RRFのみ', recommended: '複合スコア', impact: '🟡 Major' }
];

console.log('┌────────────────────────┬──────────────────┬──────────────────┬──────────┐');
console.log('│ 項目                   │ 現在             │ 推奨             │ 影響度   │');
console.log('├────────────────────────┼──────────────────┼──────────────────┼──────────┤');

flowComparison.forEach(item => {
  const feature = item.feature.padEnd(22, '　');
  const current = item.current.padEnd(16, '　');
  const recommended = item.recommended.padEnd(16, '　');
  const impact = item.impact.padEnd(8, '　');
  
  console.log(`│ ${feature} │ ${current} │ ${recommended} │ ${impact} │`);
});

console.log('└────────────────────────┴──────────────────┴──────────────────┴──────────┘\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 改善効果の予測');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('事例分析（事例1: 退会後の再登録）:\n');

console.log('現在のフロー:');
console.log('  1. ベクトル検索: 046が678位/1064件 → topK=50から除外');
console.log('  2. タイトル検索: 実行されない（ベクトルtopKに入っていないため）');
console.log('  3. 結果: ❌ 未発見\n');

console.log('推奨フロー:');
console.log('  1. タイトル部分一致: "退会" がマッチ → 優先候補');
console.log('  2. ラベル検索: domain="会員管理" → 候補に追加');
console.log('  3. KG拡張: 046 → 041（新規登録）の参照関係');
console.log('  4. 複合スコア:');
console.log('     - title_partial: 1/3キーワードマッチ → 0.25 * (1/3) = 0.083');
console.log('     - vector: 0.20 * (低スコア) = 0.02');
console.log('     - bm25: 0.10 * (中スコア) = 0.05');
console.log('     - label: 0.05 * (domain一致) = 0.05');
console.log('     → 総合: 0.203 → 上位候補');
console.log('  5. 結果: ✅ 発見（予測）\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 総合評価');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('┌──────────────────┬────────────┬────────────┬──────────┐');
console.log('│ 指標             │ 現在       │ 推奨       │ 改善     │');
console.log('├──────────────────┼────────────┼────────────┼──────────┤');
console.log('│ 発見率           │ 17% (1/6)  │ 80-95%     │ +63-78%  │');
console.log('│ タイトル一致     │ 0%         │ 100%       │ +100%    │');
console.log('│ ラベル活用       │ フィルタ   │ スコア統合 │ +++      │');
console.log('│ KG統合           │ 最終段階   │ 早期統合   │ ++       │');
console.log('│ レスポンス時間   │ 714ms      │ 300-500ms  │ -30-58%  │');
console.log('└──────────────────┴────────────┴────────────┴──────────┘\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 実装の優先順位');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('┌────┬──────────────────────────────┬────────────┬────────┐');
console.log('│ 優 │ 改善内容                     │ 期待効果   │ 工数   │');
console.log('├────┼──────────────────────────────┼────────────┼────────┤');
console.log('│ 1  │ タイトル検索を最優先化       │ +40-50%    │ 2時間  │');
console.log('│ 2  │ チャンクサイズ最適化         │ +30-40%    │ 1.5時間│');
console.log('│ 3  │ ラベルスコア統合             │ +10-15%    │ 1.5時間│');
console.log('│ 4  │ KG早期統合                   │ +5-10%     │ 1時間  │');
console.log('└────┴──────────────────────────────┴────────────┴────────┘');
console.log('  合計期待効果: 発見率 17% → 80-95%');
console.log('  総実装時間: 5-6時間\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 推奨アプローチ');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('選択肢A: 段階的改善（推奨） ✅');
console.log('  Step 1: タイトル検索の最優先化（2時間）');
console.log('    → 即座に発見率が40-50%に改善');
console.log('  Step 2: チャンクサイズ最適化（1.5時間 + rebuild 15分）');
console.log('    → 発見率が70-80%に改善');
console.log('  Step 3: 残りの改善（必要に応じて）\n');

console.log('選択肢B: Phase 0A-2復元 + 段階的改善');
console.log('  Step 1: Phase 0A-2のLanceDB復元（即座）');
console.log('    → 発見率が即座に100%に回復');
console.log('  Step 2: パフォーマンス最適化を慎重に適用');
console.log('    → 検索品質を維持しながら速度向上\n');

console.log('選択肢C: 全面的な再設計（リスク高）');
console.log('  すべての改善を一度に実装');
console.log('  → 効果は最大だが、デバッグが困難\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 推奨アクション');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('【即座に実施】');
console.log('  選択肢B: Phase 0A-2のLanceDB復元');
console.log('  理由:');
console.log('    1. 発見率を即座に100%に回復');
console.log('    2. 検証済みの検索品質');
console.log('    3. リスクゼロ\n');

console.log('【中長期的に実施】');
console.log('  選択肢A: 段階的改善');
console.log('  順序:');
console.log('    1. タイトル検索の最優先化');
console.log('    2. チャンクサイズの最適化（慎重にテスト）');
console.log('    3. ラベル・KGの統合\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('✅ 分析完了');
console.log('   詳細: docs/architecture/hybrid-search-flow-analysis.md\n');

