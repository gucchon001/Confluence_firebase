# 🚨 残課題・既知の問題

## 📊 管理ダッシュボード関連

### ❌ serverStartupTime表示問題

**問題**: 管理ダッシュボードで`serverStartupTime`が0.0sと表示される

**現状**:
- サーバー側では正しく計測・保存されている（ログで確認済み）
- Firestoreからも正しく取得されている（デバッグログで確認済み）
- しかし管理ダッシュボードのUIでは0.0sと表示される

**デバッグログで確認された内容**:
```
🔍 [convertPostLogToAdminFirestore] 入力データのserverStartupTime: 8
🔍 [convertPostLogToAdminFirestore] 出力データのserverStartupTime: 8
🔍 [convertFirestoreToPostLog] Firestoreデータ確認: {serverStartupTime: 8, ...}
🔍 [convertFirestoreToPostLog] 変換後PostLog確認: {serverStartupTime: 8, ...}
```

**影響範囲**:
- 管理ダッシュボードの投稿ログ詳細モーダル
- パフォーマンス画面の時間帯別グラフ
- 質問タイプ別パフォーマンスグラフ

**優先度**: 中（機能は動作するが、正確なパフォーマンス指標が表示されない）

**推定原因**:
- 管理ダッシュボードのUIコンポーネントでの表示処理に問題がある可能性
- 型変換やフォーマット処理での問題

**対応方針**:
- 時間がかかるため後回し
- 必要に応じて管理ダッシュボードの表示ロジックを詳細調査

---

## 🔧 技術的改善項目

### パフォーマンス最適化
- [ ] サーバー起動時間の短縮（現在5-12ms程度だが、さらに最適化可能）
- [ ] キャッシュ戦略の改善
- [ ] データベースクエリの最適化

### UI/UX改善
- [ ] 管理ダッシュボードのレスポンシブ対応
- [ ] ローディング状態の改善
- [ ] エラーメッセージの改善

### セキュリティ強化
- [ ] 認証・認可の強化
- [ ] データ匿名化の改善
- [ ] ログ出力の最適化

---

## 📝 更新履歴

- **2025-10-08**: serverStartupTime表示問題を追加
- **2025-10-08**: 残課題ドキュメントを初回作成

---

## 🔗 関連ドキュメント

- [management-dashboard-specification.md](../management-dashboard-specification.md)
- [current-implementation-status.md](./current-implementation-status.md)
- [error-handling.md](./error-handling.md)
