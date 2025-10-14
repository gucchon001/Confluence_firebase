# 差分更新機能テスト計画書

## 1. 概要

このドキュメントでは、GitHub ActionsによるConfluence同期バッチの差分更新機能に対するテスト計画を定義します。差分更新機能は、前回の同期以降に更新されたページのみを取得して処理することで、同期処理の効率化を図る重要な機能です。

**更新履歴**: 2025年1月13日 - GitHub Actionsへの移行を反映

## 2. テスト環境

- **テスト環境**: 開発環境
- **必要なツール**: 
  - Node.js v22.19.0以上
  - Vitest
  - Firebase Emulator（オプション）
- **必要な認証情報**:
  - Confluence API認証情報（`.env`ファイルに設定）
  - Firebase Admin SDK認証情報（`GOOGLE_APPLICATION_CREDENTIALS`環境変数に設定）

## 3. テストの種類

### 3.1 ユニットテスト

`src/tests/unit/differential-sync.test.ts`で実装されたユニットテストでは、差分更新に関連する個別の関数をテストします。

- **テスト対象関数**:
  - `getLastSyncTime()`: 前回の同期時刻を取得する関数
  - `getConfluencePages()`: Confluenceからページを取得する関数

- **テストケース**:
  1. `getLastSyncTime()`が最後の同期時刻を正しく取得できること
  2. 同期履歴がない場合、`getLastSyncTime()`が`null`を返すこと
  3. `lastSyncTime`がある場合、`getConfluencePages()`が正しいCQLクエリを使用すること
  4. `lastSyncTime`がない場合、`getConfluencePages()`がCQLクエリを使用しないこと

### 3.2 統合テスト

`src/tests/integration/batch-sync-differential.test.ts`で実装された統合テストでは、差分更新機能の主要コンポーネント間の連携をテストします。

- **テスト対象**:
  - `batchSyncConfluence()`関数の差分更新モード

- **テストケース**:
  1. 差分更新モードで実行すると、前回の同期時刻を取得すること
  2. 差分更新モードでConfluence APIに正しいクエリを送信すること
  3. 差分更新モードで更新されたページのみを処理すること

### 3.3 E2Eテスト

`src/tests/e2e/differential-sync-e2e.test.ts`で実装されたE2Eテストでは、実際のConfluence APIとFirestoreを使用して差分更新機能の実際の動作をテストします。

- **テスト対象**:
  - 実際の差分更新処理の全体フロー
  - GitHub Actionsワークフローでの実行

- **テストケース**:
  1. 全同期を実行した後、差分更新を実行すると前回の同期以降に更新されたページのみを処理すること
  2. 差分更新のログに前回の同期時刻が含まれていること
  3. GitHub Actionsワークフローでの実行が正常に完了すること
  4. Cloud Storageへのアップロードが成功すること

## 4. テスト実行方法

### 4.1 ユニットテスト

```bash
npm run test:differential
```

### 4.2 統合テスト

```bash
npm run test:differential:integration
```

### 4.3 E2Eテスト

```bash
npm run test:differential:e2e
```

### 4.4 GitHub Actionsテスト

```bash
# GitHub Actionsでの手動実行テスト
# GitHub リポジトリ → Actions → Sync Confluence Data → Run workflow
```

### 4.5 全てのテスト

```bash
npm run test:differential:all
```

## 5. テスト実行時の注意点

1. **E2Eテスト実行前の準備**:
   - `.env`ファイルに有効なConfluence API認証情報が設定されていることを確認
   - `GOOGLE_APPLICATION_CREDENTIALS`環境変数が正しく設定されていることを確認
   - テスト用のConfluenceスペースに十分なテストデータがあることを確認
   - GitHub Secretsが正しく設定されていることを確認（GitHub Actionsテスト用）

2. **テスト実行時の注意**:
   - E2Eテストは実際のAPIとデータベースに対して実行されるため、テスト環境でのみ実行すること
   - E2Eテスト中に手動でConfluenceページを更新する必要がある場合があります
   - GitHub Actionsテストは実際のワークフローを実行するため、Cloud Storageにデータがアップロードされます

3. **テスト後のクリーンアップ**:
   - テスト実行後、不要なテストデータがある場合は削除すること
   - GitHub Actionsテストでアップロードされたテストデータは手動で削除することを推奨

## 6. テスト結果の評価

テスト結果は以下の基準で評価します:

1. **全てのユニットテストが成功すること**:
   - 差分更新に関連する個別の関数が期待通りに動作すること

2. **統合テストが成功すること**:
   - 差分更新モードでの処理フローが正しく機能すること

3. **E2Eテストが成功すること**:
   - 実際の環境で差分更新が正しく動作し、更新されたページのみを処理すること

4. **GitHub Actionsテストが成功すること**:
   - GitHub Actionsワークフローでの実行が正常に完了すること
   - Cloud Storageへのアップロードが成功すること

## 7. 今後の改善点

1. **テストカバレッジの向上**:
   - 現在のテストでカバーされていない部分（エラーケースなど）のテストを追加

2. **Firebase Emulatorの活用**:
   - E2Eテストで実際のFirestoreの代わりにFirebase Emulatorを使用することで、テストの安全性と再現性を向上

3. **自動化されたテスト環境の構築**:
   - CI/CDパイプラインにテストを組み込み、コード変更時に自動的にテストを実行する仕組みの構築
