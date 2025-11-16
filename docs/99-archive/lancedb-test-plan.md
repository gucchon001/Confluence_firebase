# LanceDB テスト計画

## 1. テストの目的

このテスト計画は、LanceDBを使用したベクトル検索システムの機能性、パフォーマンス、および信頼性を検証することを目的としています。テストは段階的に行い、基本的な機能から高度な機能まで順次検証します。

## 2. テスト環境

### 2.1 開発環境

- **OS**: Windows 10/11
- **Node.js**: v18.x または v20.x（v22.xは一部機能に制限あり）
- **LanceDB**: v0.22.0
- **Xenova/transformers**: v2.17.2
- **Firebase Admin SDK**: v13.x

### 2.2 テストデータ

- **小規模テスト**: 10件のConfluenceページ（約30-50チャンク）
- **中規模テスト**: 50件のConfluenceページ（約150-250チャンク）
- **大規模テスト**: 200件のConfluenceページ（約600-1000チャンク）

## 3. 機能テスト

### 3.1 基本機能テスト

| テストID | テスト内容 | 前提条件 | 手順 | 期待結果 |
|---------|----------|---------|------|---------|
| BF-01 | LanceDB接続テスト | LanceDBがインストールされている | 1. `lancedb.connect()`を実行<br>2. 接続オブジェクトを取得 | 接続が正常に確立される |
| BF-02 | テーブル作成テスト | LanceDBに接続済み | 1. 最小スキーマでテーブルを作成<br>2. テーブル一覧を取得 | 新しいテーブルが作成され、一覧に表示される |
| BF-03 | レコード挿入テスト | テーブルが作成済み | 1. サンプルレコードを作成<br>2. `add`メソッドで挿入 | レコードが正常に挿入される |
| BF-04 | レコード読み取りテスト | レコードが挿入済み | 1. `query().toArray()`を実行 | 挿入したレコードが取得できる |
| BF-05 | ベクトル検索テスト | ベクトルデータが挿入済み | 1. クエリベクトルを生成<br>2. `search().toArray()`を実行 | 類似度に基づいた検索結果が返される |

### 3.2 高度な機能テスト

| テストID | テスト内容 | 前提条件 | 手順 | 期待結果 |
|---------|----------|---------|------|---------|
| AF-01 | フィルタリングテスト | データが挿入済み | 1. `search().where().toArray()`を実行 | フィルタ条件に一致する結果のみが返される |
| AF-02 | インデックス作成テスト | テーブルが作成済み | 1. ベクトルインデックスを作成 | インデックスが正常に作成される |
| AF-03 | インデックス検索テスト | インデックスが作成済み | 1. インデックスを使用して検索 | 検索が高速化される |
| AF-04 | 複合フィルタリングテスト | データが挿入済み | 1. 複数の条件でフィルタリング | すべての条件に一致する結果のみが返される |
| AF-05 | レコード更新テスト | レコードが挿入済み | 1. レコードを削除<br>2. 更新されたレコードを挿入 | レコードが正常に更新される |

### 3.3 Firestore連携テスト

| テストID | テスト内容 | 前提条件 | 手順 | 期待結果 |
|---------|----------|---------|------|---------|
| FS-01 | Firestoreメタデータ保存テスト | Firebase Admin SDKが初期化済み | 1. メタデータをFirestoreに保存 | メタデータが正常に保存される |
| FS-02 | LanceDB-Firestore統合検索テスト | LanceDBとFirestoreにデータが存在 | 1. LanceDBで検索<br>2. 結果IDでFirestoreからメタデータを取得<br>3. 結果を統合 | 統合された検索結果が返される |
| FS-03 | データ整合性テスト | LanceDBとFirestoreにデータが存在 | 1. LanceDBとFirestoreのレコード数を比較 | レコード数が一致する |

## 4. パフォーマンステスト

### 4.1 基本パフォーマンステスト

| テストID | テスト内容 | 前提条件 | 手順 | 期待結果 |
|---------|----------|---------|------|---------|
| PF-01 | 挿入パフォーマンステスト | テーブルが作成済み | 1. 1000レコードをバッチで挿入<br>2. 実行時間を計測 | 挿入が10秒以内に完了する |
| PF-02 | 検索パフォーマンステスト | 1000レコードが挿入済み | 1. 10回の検索を実行<br>2. 平均実行時間を計測 | 検索が100ms以内に完了する |
| PF-03 | フィルタリングパフォーマンステスト | 1000レコードが挿入済み | 1. フィルタ付き検索を10回実行<br>2. 平均実行時間を計測 | フィルタ付き検索が200ms以内に完了する |

### 4.2 スケーラビリティテスト

| テストID | テスト内容 | 前提条件 | 手順 | 期待結果 |
|---------|----------|---------|------|---------|
| SC-01 | 小規模データセットテスト | 10件のConfluenceページデータ | 1. データをロード<br>2. 検索を実行<br>3. パフォーマンスを計測 | 検索が50ms以内に完了する |
| SC-02 | 中規模データセットテスト | 50件のConfluenceページデータ | 1. データをロード<br>2. 検索を実行<br>3. パフォーマンスを計測 | 検索が100ms以内に完了する |
| SC-03 | 大規模データセットテスト | 200件のConfluenceページデータ | 1. データをロード<br>2. 検索を実行<br>3. パフォーマンスを計測 | 検索が200ms以内に完了する |

### 4.3 メモリ使用量テスト

| テストID | テスト内容 | 前提条件 | 手順 | 期待結果 |
|---------|----------|---------|------|---------|
| MU-01 | 挿入時メモリ使用量テスト | テーブルが作成済み | 1. メモリ使用量を計測<br>2. 1000レコードを挿入<br>3. メモリ使用量の変化を計測 | メモリリークが発生しない |
| MU-02 | 検索時メモリ使用量テスト | 1000レコードが挿入済み | 1. メモリ使用量を計測<br>2. 100回の検索を実行<br>3. メモリ使用量の変化を計測 | メモリリークが発生しない |

## 5. 耐久性テスト

| テストID | テスト内容 | 前提条件 | 手順 | 期待結果 |
|---------|----------|---------|------|---------|
| DU-01 | 連続挿入テスト | テーブルが作成済み | 1. 100バッチの挿入を連続実行 | すべての挿入が成功する |
| DU-02 | 連続検索テスト | データが挿入済み | 1. 1000回の検索を連続実行 | すべての検索が成功し、結果が一貫している |

## 6. エラー処理テスト

| テストID | テスト内容 | 前提条件 | 手順 | 期待結果 |
|---------|----------|---------|------|---------|
| ER-01 | 無効なベクトルテスト | テーブルが作成済み | 1. 無効なベクトル（異なる次元数）を挿入 | 適切なエラーメッセージが返される |
| ER-02 | 無効なフィルタテスト | データが挿入済み | 1. 無効なフィルタ条件で検索 | 適切なエラーメッセージが返される |
| ER-03 | 存在しないテーブルテスト | LanceDBに接続済み | 1. 存在しないテーブルを開く | 適切なエラーメッセージが返される |
| ER-04 | 接続エラーテスト | なし | 1. 無効なパスでLanceDBに接続 | 適切なエラーメッセージが返される |

## 7. 統合テスト

| テストID | テスト内容 | 前提条件 | 手順 | 期待結果 |
|---------|----------|---------|------|---------|
| IT-01 | Confluenceデータ取得・保存テスト | Confluence APIとLanceDBが設定済み | 1. Confluenceからデータを取得<br>2. 埋め込みベクトルを生成<br>3. LanceDBに保存 | データが正常に取得・保存される |
| IT-02 | 検索API統合テスト | LanceDBにデータが存在 | 1. 検索APIを呼び出し<br>2. クエリパラメータを指定 | 適切な検索結果が返される |
| IT-03 | フロントエンド統合テスト | 検索APIが実装済み | 1. フロントエンドから検索リクエストを送信<br>2. 結果を表示 | 検索結果が正しく表示される |

## 8. テスト実行計画

### 8.1 フェーズ1: 基本機能検証

1. 基本機能テスト（BF-01〜BF-05）を実行
2. エラー処理テスト（ER-01〜ER-04）を実行
3. 小規模データセットでのパフォーマンステスト（SC-01）を実行

### 8.2 フェーズ2: 高度な機能検証

1. 高度な機能テスト（AF-01〜AF-05）を実行
2. Firestore連携テスト（FS-01〜FS-03）を実行
3. 中規模データセットでのパフォーマンステスト（SC-02）を実行

### 8.3 フェーズ3: パフォーマンスと耐久性検証

1. 基本パフォーマンステスト（PF-01〜PF-03）を実行
2. メモリ使用量テスト（MU-01〜MU-02）を実行
3. 耐久性テスト（DU-01〜DU-02）を実行
4. 大規模データセットでのパフォーマンステスト（SC-03）を実行

### 8.4 フェーズ4: 統合検証

1. 統合テスト（IT-01〜IT-03）を実行
2. エンドツーエンドのユーザーシナリオテストを実行

## 9. テスト自動化

### 9.1 自動化スクリプト

以下のスクリプトを作成して、テストを自動化します：

1. **基本機能テストスクリプト**:
   ```typescript
   // src/tests/lancedb-basic-tests.ts
   import * as lancedb from '@lancedb/lancedb';
   import * as path from 'path';
   import { expect } from 'vitest';
   
   describe('LanceDB基本機能テスト', () => {
     let db;
     let tbl;
     
     beforeAll(async () => {
       db = await lancedb.connect(path.resolve('.lancedb'));
     });
     
     test('テーブル作成テスト', async () => {
       const tableName = `test_${Date.now()}`;
       tbl = await db.createTable(tableName, [{
         id: 'test-1',
         vector: Array(10).fill(0).map(() => Math.random()),
         title: 'テストタイトル',
         content: 'テスト内容'
       }]);
       
       const tables = await db.tableNames();
       expect(tables).toContain(tableName);
     });
     
     test('レコード挿入テスト', async () => {
       const initialCount = await tbl.countRows();
       
       await tbl.add([{
         id: 'test-2',
         vector: Array(10).fill(0).map(() => Math.random()),
         title: 'テストタイトル2',
         content: 'テスト内容2'
       }]);
       
       const newCount = await tbl.countRows();
       expect(newCount).toBe(initialCount + 1);
     });
     
     test('ベクトル検索テスト', async () => {
       const results = await tbl.search(Array(10).fill(0.5)).limit(5).toArray();
       
       expect(results.length).toBeGreaterThan(0);
       expect(results[0]).toHaveProperty('_distance');
     });
   });
   ```

2. **パフォーマンステストスクリプト**:
   ```typescript
   // src/tests/lancedb-performance-tests.ts
   import * as lancedb from '@lancedb/lancedb';
   import * as path from 'path';
   
   describe('LanceDBパフォーマンステスト', () => {
     let db;
     let tbl;
     
     beforeAll(async () => {
       db = await lancedb.connect(path.resolve('.lancedb'));
       tbl = await db.openTable('performance_test');
     });
     
     test('挿入パフォーマンステスト', async () => {
       const batchSize = 100;
       const batches = 10;
       
       const start = Date.now();
       
       for (let i = 0; i < batches; i++) {
         const records = Array(batchSize).fill(0).map((_, j) => ({
           id: `perf-${i}-${j}`,
           vector: Array(10).fill(0).map(() => Math.random()),
           title: `パフォーマンステスト ${i}-${j}`,
           content: `これはパフォーマンステスト用のレコード ${i}-${j} です`
         }));
         
         await tbl.add(records);
       }
       
       const duration = Date.now() - start;
       console.log(`${batchSize * batches}レコードの挿入時間: ${duration}ms`);
       
       expect(duration).toBeLessThan(10000); // 10秒以内
     });
     
     test('検索パフォーマンステスト', async () => {
       const iterations = 10;
       let totalDuration = 0;
       
       for (let i = 0; i < iterations; i++) {
         const vector = Array(10).fill(0).map(() => Math.random());
         
         const start = Date.now();
         await tbl.search(vector).limit(10).toArray();
         const duration = Date.now() - start;
         
         totalDuration += duration;
       }
       
       const averageDuration = totalDuration / iterations;
       console.log(`平均検索時間: ${averageDuration}ms`);
       
       expect(averageDuration).toBeLessThan(100); // 100ms以内
     });
   });
   ```

### 9.2 CI/CD統合

テストをCI/CDパイプラインに統合するための設定を作成します：

```yaml
# .github/workflows/lancedb-tests.yml
name: LanceDB Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run basic tests
      run: npm run test:lancedb:basic
    
    - name: Run performance tests
      run: npm run test:lancedb:performance
```

## 10. テストレポート

テスト結果は以下の形式でレポートします：

1. **テスト概要**:
   - 実行したテスト数
   - 成功したテスト数
   - 失敗したテスト数
   - テスト実行時間

2. **詳細レポート**:
   - 各テストケースの結果
   - 失敗したテストの詳細（エラーメッセージ、スタックトレース）
   - パフォーマンスメトリクス（実行時間、メモリ使用量）

3. **改善提案**:
   - パフォーマンスボトルネックの特定
   - 最適化の提案
   - 今後のテスト計画

## 11. テスト実行スクリプト

テスト実行を簡素化するためのnpmスクリプトを追加します：

```json
{
  "scripts": {
    "test:lancedb:basic": "vitest run src/tests/lancedb-basic-tests.ts",
    "test:lancedb:performance": "vitest run src/tests/lancedb-performance-tests.ts",
    "test:lancedb:integration": "vitest run src/tests/lancedb-integration-tests.ts",
    "test:lancedb:all": "vitest run src/tests/lancedb-*.ts"
  }
}
```
