# ブランチ戦略ガイド

**最終更新日**: 2025年10月14日  
**バージョン**: 1.0

---

## 📋 概要

Phase 0A開発期間中（2025/10/28 〜 2025/12/20）は、本番環境（ユーザーテスト）と開発環境を分離するため、ブランチとポートを分けて運用します。

---

## 🌿 ブランチ構成

### **main ブランチ（本番・ユーザーテスト用）**

```bash
ブランチ: main
ポート: 9003
用途: 本番環境・ユーザーテスト
デプロイ: Firebase App Hosting（自動）
```

**運用ルール:**
- ✅ 安定版のみをコミット
- ✅ 緊急バグ修正のみ実施
- ❌ 大規模リファクタリングは禁止
- ❌ 実験的機能の追加は禁止

**コミット頻度:**
- 緊急バグ修正時のみ
- 週1回程度の軽微な修正

---

### **phase-0a ブランチ（Phase 0A開発用）**

```bash
ブランチ: phase-0a
ポート: 9004
用途: Phase 0A開発（基盤強化）
デプロイ: なし（ローカル開発のみ）
```

**運用ルール:**
- ✅ 自由に開発・実験可能
- ✅ 大規模リファクタリングOK
- ✅ 新機能の追加OK
- ✅ コミット頻度は自由

**開発内容:**
- Phase 0A-1: StructuredLabel（構造化ラベルシステム）
- Phase 0A-2: Knowledge Graph（知識グラフ構築）
- Phase 0A-3: パフォーマンス・品質最適化

---

## 🔄 ブランチ間の切り替え

### **本番環境でテスト（main）**

```bash
# mainブランチに切り替え
git checkout main

# 本番環境用ポート（9003）で起動
npm run dev:prod

# ブラウザでアクセス
# http://localhost:9003
```

### **Phase 0A開発（phase-0a）**

```bash
# phase-0aブランチに切り替え
git checkout phase-0a

# 開発環境用ポート（9004）で起動
npm run dev

# ブラウザでアクセス
# http://localhost:9004
```

---

## 📦 マージ戦略

### **定期マージ（phase-0a → main）**

**タイミング:**
- Phase 0A-1完了時（2025/11/11予定）
- Phase 0A-2完了時（2025/12/10予定）
- Phase 0A-3完了時（2025/12/20予定）
- または緊急バグ修正が必要な場合

**手順:**

```bash
# 1. phase-0aで最新の変更をコミット
git checkout phase-0a
git add .
git commit -m "feat: complete Phase 0A-1 (StructuredLabel)"

# 2. mainから最新を取得（コンフリクト回避）
git checkout main
git pull origin main

# 3. phase-0aにmainをマージ（事前テスト）
git checkout phase-0a
git merge main
# コンフリクトがあれば解決

# 4. テスト実行
npm run typecheck
npm run build
npm run test

# 5. 問題なければmainにマージ
git checkout main
git merge phase-0a
git push origin main
```

---

## 🚨 緊急バグ修正の手順

**本番環境（main）で緊急バグが発見された場合:**

### **手順1: mainで修正**

```bash
# mainブランチで修正
git checkout main

# 修正実施
# ...

# コミット
git add .
git commit -m "hotfix: fix critical bug in production"
git push origin main
```

### **手順2: phase-0aに反映**

```bash
# phase-0aに切り替え
git checkout phase-0a

# mainの修正を取り込む
git merge main

# コンフリクトがあれば解決
git push origin phase-0a
```

---

## 📊 ポート使用状況

| ポート | 用途 | ブランチ | npm コマンド |
|--------|------|---------|-------------|
| **9003** | 本番・ユーザーテスト | main | `npm run dev:prod` |
| **9004** | Phase 0A開発 | phase-0a | `npm run dev` |

---

## 🔧 開発環境のセットアップ

### **初回セットアップ**

```bash
# 1. リポジトリをクローン
git clone https://github.com/gucchon001/Confluence_firebase.git
cd Confluence_firebase

# 2. 依存関係をインストール
npm install

# 3. 環境変数を設定
cp .env.example .env.local
# .env.local を編集

# 4. データをダウンロード
npm run download:production-data

# 5. 開発サーバーを起動（phase-0aブランチ）
git checkout phase-0a
npm run dev  # port 9004
```

### **既存開発者向け**

```bash
# 最新のphase-0aを取得
git checkout phase-0a
git pull origin phase-0a

# 開発サーバー起動
npm run dev  # port 9004
```

---

## 📝 コミットメッセージ規約

### **main ブランチ**

```
hotfix: 緊急バグ修正
fix: バグ修正
docs: ドキュメント更新
```

### **phase-0a ブランチ**

```
feat: 新機能追加
refactor: リファクタリング
perf: パフォーマンス改善
test: テスト追加
chore: その他の変更
```

---

## 🔗 関連ドキュメント

- [Phase 0A実装計画書](../architecture/phase-0A-implementation-plan.md)
- [基盤強化優先戦略](../architecture/foundation-first-strategy.md)
- [プロジェクトWBS](../project-wbs-updated.tsv)

---

## ⚠️ 注意事項

### **1. データベースの共有**

両ブランチで同じLanceDB（`.lancedb/`）を共有します：
- ⚠️ スキーマ変更時は注意
- ⚠️ 互換性を保つこと
- ✅ 必要に応じてデータをバックアップ

### **2. Firebaseプロジェクトの共有**

両ブランチで同じFirebaseプロジェクトを使用します：
- ⚠️ Firestoreスキーマ変更時は注意
- ✅ テストデータは別コレクションを使用

### **3. 環境変数の管理**

`.env.local` は両ブランチで共有されます：
- ✅ ブランチ固有の設定は不要
- ⚠️ 新しい環境変数を追加した場合は、mainにも反映

---

## 📞 サポート

質問や問題が発生した場合は、開発チームに連絡してください。

---

## 🔄 更新履歴

- **2025-10-14**: 初版作成（Phase 0A開始に伴うブランチ分離）

