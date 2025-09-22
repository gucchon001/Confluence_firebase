# Firebase Functions削除計画書

## 調査結果サマリー

### ✅ 安全に削除可能なファイル

#### 1. Firebase Functions関連（完全に独立）
```
functions/
├── src/
│   ├── sync-functions.ts          # Pub/Subスケジュール版
│   ├── index-batch.ts            # HTTPリクエスト版  
│   ├── index.ts                  # メイン同期処理
│   ├── index-minimal.ts          # 最小版
│   ├── index-new.ts              # 新規版
│   ├── confluence-service.ts     # Confluence APIサービス
│   ├── embedding-service.ts      # 埋め込み生成サービス
│   ├── firestore-service.ts      # Firestoreサービス
│   └── config.ts                 # 設定ファイル
├── lib/                          # コンパイル済みJSファイル
├── package.json                  # Firebase Functions依存関係
└── tsconfig.json                 # TypeScript設定
```

#### 2. 問題のあるファイル（削除対象）
```
src/functions/
├── scheduler.ts                  # 存在しないファイルをimport
└── sync-confluence-data.ts       # 存在しない（importされているが実体なし）

src/app/api/sync/
└── route.ts                      # 問題のあるscheduler.tsを使用
```

### ⚠️ 注意が必要なファイル

#### 1. 現在使用中のファイル
```
src/scripts/resync-specific-pages.ts  # batch-sync-confluenceから関数をimport
```

## 削除計画

### フェーズ1: 即座に削除可能

#### 1.1 Firebase Functionsディレクトリ全体
```bash
# 完全に独立しており、メインアプリケーションから使用されていない
rm -rf functions/
```

#### 1.2 firebase.jsonの修正
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": ".next",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
  // "functions" セクションを削除
}
```

### フェーズ2: 問題ファイルの修正

#### 2.1 存在しないファイルのimport修正
```typescript
// src/scripts/resync-specific-pages.ts の修正
// 現在:
import { getConfluenceLabels } from './batch-sync-confluence';

// 修正後:
import { getConfluenceLabels } from './batch-sync-confluence';
// または、必要に応じて別の実装に置き換え
```

#### 2.2 問題のあるAPIルートの修正
```typescript
// src/app/api/sync/route.ts の修正
// 現在:
import { scheduledSyncConfluenceData, manualSyncConfluenceData } from '@/functions/scheduler';

// 修正後:
// 1. ファイル全体を削除（LanceDB同期を使用）
// または
// 2. LanceDB同期へのリダイレクト実装
```

### フェーズ3: 代替機能の確認

#### 3.1 LanceDB同期システムの確認
- `src/scripts/batch-sync-confluence.ts` - メイン同期処理
- 差分同期機能 (`--differential`フラグ)
- 削除ページ検出機能
- ローカル実行可能

#### 3.2 新しいAPIエンドポイントの検討
```typescript
// 新しい同期API（LanceDB同期を使用）
// src/app/api/sync/route.ts
export async function POST(req: Request) {
  // LanceDB同期処理を呼び出し
  const result = await execLanceDBSync();
  return Response.json(result);
}
```

## 削除実行手順

### ステップ1: バックアップ
```bash
# 現在の状態をバックアップ
git add -A
git commit -m "Backup before Firebase Functions deletion"
```

### ステップ2: Firebase Functions削除
```bash
# Firebase Functionsディレクトリを削除
rm -rf functions/

# firebase.jsonからfunctions設定を削除
```

### ステップ3: 問題ファイルの修正
```bash
# 問題のあるAPIルートを削除または修正
# src/app/api/sync/route.ts を削除または修正

# 存在しないimportを修正
# src/scripts/resync-specific-pages.ts のimportを修正
```

### ステップ4: 依存関係の確認
```bash
# パッケージの依存関係を確認
npm list firebase-functions
# 結果: (empty) - 依存関係なし

# ビルドテスト
npm run build
```

### ステップ5: テスト実行
```bash
# 既存のテストが正常に動作することを確認
npm test

# LanceDB同期のテスト
npx tsx src/scripts/batch-sync-confluence.ts --help
```

## リスク評価

### 🟢 低リスク
- Firebase Functionsディレクトリの削除
- firebase.jsonの修正
- 未使用の依存関係の削除

### 🟡 中リスク  
- `src/app/api/sync/route.ts`の修正
- `src/scripts/resync-specific-pages.ts`のimport修正

### 🔴 高リスク
- なし（すべて安全に削除可能）

## 検証項目

### 削除後の確認事項
1. **ビルド成功**: `npm run build`が成功する
2. **テスト成功**: 既存のテストが全て通る
3. **LanceDB同期動作**: `batch-sync-confluence.ts`が正常動作
4. **依存関係クリーン**: 不要な依存関係が残っていない

### ロールバック計画
```bash
# 問題が発生した場合の復旧
git reset --hard HEAD~1  # 直前のコミットに戻る
```

## 結論

**Firebase Functions関連のコードは安全に削除可能です。**

### 削除理由
1. **完全に独立**: メインアプリケーションから使用されていない
2. **重複機能**: LanceDB同期システムが同等以上の機能を提供
3. **保守負荷**: 未使用のコードによる保守コスト
4. **設定複雑化**: 複数の同期システムによる混乱

### 削除による利益
1. **コード簡素化**: 重複コードの削除
2. **保守性向上**: 単一の同期システム
3. **デプロイ簡素化**: Firebase Functionsの設定不要
4. **コスト削減**: 未使用のクラウドリソース削除

**推奨**: 即座に削除を実行することを推奨します。
