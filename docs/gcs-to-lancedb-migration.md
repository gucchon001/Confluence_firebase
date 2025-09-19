# GCSからLanceDBへの移行ガイド [アーカイブ]

> **注意**: このドキュメントは古い設計に基づいており、現在は使用されていません。現在の実装ではLanceDBのみを使用し、GCSとの連携は行っていません。このドキュメントは参考のために保存されています。

## 移行ステップ

1. **LanceDBのセットアップ**

```bash
# LanceDBディレクトリの作成
mkdir -p .lancedb
```

2. **データのロード**

```bash
# 既存のVector Searchデータをロード
npx tsx src/scripts/lancedb-load.ts ./data/vector-search-data-latest.json
```

> **注意**: 以下のステップは古い設計に基づいており、現在は使用されていません。

~~3. **LanceDBとFirestoreの同期**~~

~~```bash
# LanceDBからFirestoreへの同期
npx tsx src/scripts/lancedb-firestore-sync.ts
```~~