# ベクトル検索テストガイド

## 概要

このドキュメントでは、実際のConfluenceデータのベクトルファイルを使用してベクトル検索の質を評価するテストの実行方法について説明します。

## 前提条件

### 1. 環境設定

```bash
# 必要なパッケージのインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルに以下の設定を追加:
# OPENAI_API_KEY=your_openai_api_key
# GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

### 2. データベースの準備

実際のベクトルファイルを使用するため、以下の条件を満たしている必要があります：

- `.lancedb`ディレクトリが存在する
- `confluence`テーブルが存在する
- テーブルに実際のデータが含まれている

#### データベースの確認

```bash
# データベースの存在確認
ls -la .lancedb/

# テーブルの確認
npx tsx -e "
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
async function checkTables() {
  const db = await lancedb.connect(path.resolve(process.cwd(), '.lancedb'));
  const tables = await db.tableNames();
  console.log('利用可能なテーブル:', tables);
  
  if (tables.includes('confluence')) {
    const tbl = await db.openTable('confluence');
    const count = await tbl.countRows();
    console.log('confluenceテーブルのレコード数:', count);
  }
}
checkTables();
"
```

## テストファイル構成

### 1. `real-vector-search-test.ts`
- **目的**: Vitestを使用した詳細なテストスイート
- **特徴**: 実際のベクトルデータを使用した包括的なテスト
- **実行方法**: `npx vitest run src/tests/lancedb/real-vector-search-test.ts`

### 2. `run-real-vector-tests.ts`
- **目的**: スタンドアロンでのテスト実行スクリプト
- **特徴**: 詳細なログ出力と結果分析
- **実行方法**: `npx tsx src/tests/lancedb/run-real-vector-tests.ts`

## 実行方法

### 1. スタンドアロンテストの実行

```bash
# 実際のベクトルファイルを使ったテストを実行
npx tsx src/tests/lancedb/run-real-vector-tests.ts
```

このコマンドは以下のテストを順次実行します：

1. **ベクトルデータ確認**
   - テーブルの存在確認
   - レコード数の確認
   - サンプルレコードの構造確認

2. **実際のクエリでのベクトル検索テスト**
   - 教室管理関連クエリ
   - 教室コピー機能関連クエリ
   - オファー機能関連クエリ

3. **検索結果の関連性評価**
   - 精度・再現率・F1スコアの計算
   - 期待されるキーワードとの一致度評価

4. **統合検索クライアントのテスト**
   - `searchLanceDB`関数を使用した検索
   - スコアリング機能の確認

5. **パフォーマンステスト**
   - 複数回の検索実行
   - 平均検索時間の測定

### 2. Vitestテストの実行

```bash
# 詳細なテストスイートを実行
npx vitest run src/tests/lancedb/real-vector-search-test.ts

# 特定のテストのみ実行
npx vitest run src/tests/lancedb/real-vector-search-test.ts -t "RV-02"

# ウォッチモードで実行
npx vitest src/tests/lancedb/real-vector-search-test.ts
```

## テスト結果の解釈

### 1. ベクトルデータ確認

```
利用可能なテーブル: ['confluence']
テーブル "confluence" のレコード数: 1234件

サンプルレコード:
1. 160_【FIX】教室管理機能
   ID: chunk_160_1
   ベクトル次元: 768
   コンテンツ: あり
   ラベル: あり
```

**確認ポイント**:
- テーブルが存在する
- レコード数が0より大きい
- ベクトル次元数が適切（通常768次元）
- 必要なフィールドが存在する

### 2. ベクトル検索結果

```
--- クエリ: "教室管理の詳細は" ---
埋め込みベクトル生成完了: 768次元
検索結果数: 10件

1. 160_【FIX】教室管理機能
   距離: 0.2345
   ID: chunk_160_1

2. 161_【FIX】教室一覧閲覧機能
   距離: 0.2678
   ID: chunk_161_1

距離統計: 最小=0.2345, 最大=0.4567, 平均=0.3456
```

**評価ポイント**:
- 検索結果が返される
- 距離が適切な範囲内（0-2）
- 関連性の高いページが上位に表示される

### 3. 関連性評価

```
関連性評価結果:
- 総検索結果: 20件
- 関連結果: 16件
- 精度: 80.0%
- 再現率: 75.0%
- F1スコア: 0.774
- 平均距離: 0.3456
```

**評価基準**:
- **精度**: 80%以上が良好
- **再現率**: 70%以上が良好
- **F1スコア**: 0.75以上が良好
- **平均距離**: 0.5以下が良好

### 4. パフォーマンス結果

```
パフォーマンス結果:
- 平均検索時間: 45.2ms
- 最小検索時間: 32ms
- 最大検索時間: 67ms
- 標準偏差: 12.3ms
```

**評価基準**:
- **平均検索時間**: 200ms以下が良好
- **標準偏差**: 平均の50%以下が良好

## トラブルシューティング

### よくある問題と解決方法

#### 1. テーブルが見つからない

```
Error: テーブル "confluence" が見つかりません
```

**解決方法**:
- `.lancedb`ディレクトリの存在確認
- テーブル名の確認（`confluence`以外の名前の可能性）
- データベースの初期化が必要

#### 2. データが存在しない

```
Error: テーブル "confluence" にデータがありません
```

**解決方法**:
- Confluenceデータの同期が必要
- ベクトル化処理の実行が必要
- データベースの再構築が必要

#### 3. 埋め込みベクトル生成エラー

```
Error: Embedding generation failed
```

**解決方法**:
- OpenAI APIキーの設定確認
- ネットワーク接続の確認
- API制限の確認

#### 4. 検索結果が0件

```
検索結果数: 0件
```

**解決方法**:
- クエリの変更
- フィルタ条件の緩和
- データベースの内容確認

### ログの確認

テスト実行時のログは以下の形式で出力されます：

```
🔍 実際のベクトルファイルを使ったベクトル検索テスト開始
================================================================================
テスト実行時刻: 2024-01-15T10:30:00.000Z

=== 実際のベクトルデータの確認 ===
利用可能なテーブル: ['confluence']
テーブル "confluence" のレコード数: 1234件

サンプルレコード:
1. 160_【FIX】教室管理機能
   ID: chunk_160_1
   ベクトル次元: 768
   コンテンツ: あり
   ラベル: あり

✅ ベクトルデータ確認: 0.5秒
```

## 継続的改善

### 定期的なテスト実行

#### 日次テスト
```bash
# 毎日実行してベクトル検索の品質を監視
npx tsx src/tests/lancedb/run-real-vector-tests.ts
```

#### 週次詳細分析
```bash
# 週次で詳細なテストスイートを実行
npx vitest run src/tests/lancedb/real-vector-search-test.ts
```

### テスト結果の活用

1. **品質監視**
   - 検索精度の推移を追跡
   - パフォーマンスの劣化を早期発見

2. **アルゴリズム改善**
   - テスト結果に基づくパラメータ調整
   - 新しい検索手法の評価

3. **データ品質向上**
   - 検索結果の品質向上
   - データベースの最適化

## 参考資料

- [ベクトル検索品質テストガイド](./vector-search-testing-guide.md)
- [教室管理検索品質テスト仕様書](./case_classroom-management-search-quality-test.md)
- [教室コピー機能検索品質テスト仕様書](./case_classroom-copy-function-search-quality-test.md)

## サポート

テスト実行で問題が発生した場合は、以下の情報を含めて報告してください：

1. 実行したコマンド
2. エラーメッセージ
3. 環境情報（OS、Node.jsバージョンなど）
4. データベースの状態（テーブル数、レコード数など）
5. ログファイル（該当する場合）
