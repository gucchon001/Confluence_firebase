# Confluenceラベリングツールキット 移行パッケージ

他プロジェクトへの移行用ファイル一覧と使用方法

## 📦 移行ファイル一覧

### 🔧 メインファイル
- **`confluence_labeling_toolkit.py`** - メインツールキット（単体ファイル）
- **`confluence_labeling_README.md`** - 詳細な使用方法とAPI仕様

### ⚙️ 設定ファイル
- **`sample_settings.ini`** - 設定ファイルのサンプル
- **`sample_secrets.env`** - 環境変数ファイルのサンプル

### 📋 実行例
- **`migration_examples.py`** - 移行先での実行例集
- **`MIGRATION_PACKAGE.md`** - このファイル（移行手順）

## 🚀 移行手順

### 1. ファイルコピー
```bash
# 移行先プロジェクトに以下をコピー
cp confluence_labeling_toolkit.py /path/to/new/project/
cp confluence_labeling_README.md /path/to/new/project/
cp migration_examples.py /path/to/new/project/
```

### 2. 設定ファイル準備
```bash
# 設定ディレクトリ作成
mkdir -p /path/to/new/project/config/

# 設定ファイルコピー・編集
cp sample_settings.ini /path/to/new/project/config/settings.ini
cp sample_secrets.env /path/to/new/project/config/secrets.env

# 実際の値に編集
# - settings.ini: Confluenceドメイン、メールアドレス、スペースキー
# - secrets.env: Atlassian APIトークン
```

### 3. 依存関係インストール
```bash
pip install atlassian-python-api python-dotenv
```

### 4. 動作確認
```python
from confluence_labeling_toolkit import ConfluenceLabelingToolkit

# 接続テスト
toolkit = ConfluenceLabelingToolkit()
print("接続成功!")
```

## 📊 主な使用パターン

### パターン1: 小規模テスト
```python
toolkit = ConfluenceLabelingToolkit()
stats = toolkit.batch_label_by_category("analysis.csv", "議事録", max_pages=10)
```

### パターン2: カテゴリ別処理
```python
categories = ["議事録", "機能要件", "アーカイブ"]
for category in categories:
    stats = toolkit.batch_label_by_category("analysis.csv", category)
    toolkit.export_labeling_report(stats, f"report_{category}.md")
```

### パターン3: 全件一括処理
```python
stats = toolkit.batch_label_from_csv("analysis.csv")
toolkit.export_labeling_report(stats, "full_report.md")
```

## ⚠️ 重要な注意事項

### セキュリティ
- `secrets.env`ファイルはGitにコミットしない
- APIトークンは適切に管理する
- 本番環境では適切な権限設定を行う

### パフォーマンス
- 大量処理時はAPI制限に注意
- 必要に応じて待機時間を調整
- エラー処理を適切に実装

### 設定のカスタマイズ
```python
# カスタム設定例
config = LabelingConfig(
    atlassian_domain="your-domain.atlassian.net",
    atlassian_email="your-email@example.com", 
    atlassian_api_token="your-token",
    space_key="YOUR_SPACE"
)
toolkit = ConfluenceLabelingToolkit(config)
```

## 📈 期待される効果

### 導入前
- ページの検索が困難
- カテゴリ分類が不明確
- ナビゲーションが非効率

### 導入後
- ✅ 適切なラベルによる高速検索
- ✅ 明確なカテゴリ分類
- ✅ 効率的なナビゲーション
- ✅ 自動化による運用効率化

## 🔍 トラブルシューティング

### よくある問題と解決策

1. **認証エラー**
   - APIトークンの確認
   - ドメイン設定の確認

2. **権限エラー**
   - Confluenceページへの編集権限確認
   - スペースへのアクセス権限確認

3. **API制限エラー**
   - 処理間隔の調整（`time.sleep`を増やす）
   - バッチサイズの縮小

4. **ページが見つからない**
   - ページIDの確認
   - ページの削除状況確認

### デバッグ方法
```python
import logging
logging.getLogger().setLevel(logging.DEBUG)

# 個別ページでテスト
result = toolkit.add_labels_to_page("known_page_id", ["test"])
print(result)
```

## 📞 サポート

移行に関する質問や問題は、元開発チームまでお問い合わせください。

---

## 📋 チェックリスト

移行完了前に以下を確認してください：

- [ ] 全ファイルがコピーされている
- [ ] 設定ファイルが正しく編集されている  
- [ ] 依存関係がインストールされている
- [ ] 接続テストが成功している
- [ ] 小規模テストが動作している
- [ ] ログが適切に出力されている
- [ ] エラーハンドリングが動作している
- [ ] レポート出力が動作している

## 🎯 移行成功の指標

- [ ] 100件以上のページにラベル追加成功
- [ ] エラー率が10%以下
- [ ] 処理時間が予想範囲内
- [ ] レポートファイルが正常に生成される
- [ ] ログファイルにエラーが記録されていない

移行完了後は、このツールキットを使用して効率的なConfluenceページ管理を実現してください！


#!/usr/bin/env python3
"""
Confluenceラベリングツールキット移行用実行例

このファイルは、他プロジェクトでツールキットを使用する際の
実行例を示しています。実際の用途に応じてカスタマイズしてください。
"""

from confluence_labeling_toolkit import ConfluenceLabelingToolkit
import logging
import sys

def setup_logging():
    """ログ設定"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('confluence_labeling.log'),
            logging.StreamHandler(sys.stdout)
        ]
    )

def example_1_small_test():
    """例1: 小規模テスト（10件のみ）"""
    print("=== 例1: 小規模テスト ===")
    
    toolkit = ConfluenceLabelingToolkit()
    
    # 議事録カテゴリを10件のみテスト
    stats = toolkit.batch_label_by_category(
        "analysis_results.csv", 
        "議事録", 
        max_pages=10
    )
    
    print(f"結果: 成功={stats['success_count']}, エラー={stats['error_count']}")
    
    # レポート出力
    toolkit.export_labeling_report(stats, "test_report.md")

def example_2_category_processing():
    """例2: カテゴリ別順次処理"""
    print("=== 例2: カテゴリ別処理 ===")
    
    toolkit = ConfluenceLabelingToolkit()
    
    # 処理対象カテゴリ
    categories = ["議事録", "機能要件", "アーカイブ", "メールテンプレート"]
    
    for category in categories:
        print(f"\n--- {category}カテゴリ処理開始 ---")
        
        stats = toolkit.batch_label_by_category("analysis_results.csv", category)
        
        # レポート出力
        toolkit.export_labeling_report(stats, f"report_{category}.md")
        
        print(f"{category}完了: 成功={stats['success_count']}, エラー={stats['error_count']}")

def example_3_full_processing():
    """例3: 全件一括処理"""
    print("=== 例3: 全件一括処理 ===")
    
    toolkit = ConfluenceLabelingToolkit()
    
    # カテゴリ分析
    print("1. カテゴリ分析")
    categories = toolkit.analyze_csv_categories("analysis_results.csv")
    
    print("カテゴリ別ページ数:")
    for category, count in sorted(categories.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {category}: {count}件")
    
    # 全件処理実行
    print("\n2. 全件処理開始...")
    stats = toolkit.batch_label_from_csv("analysis_results.csv")
    
    # 詳細レポート出力
    toolkit.export_labeling_report(stats, "full_labeling_report.md")
    
    print(f"\n3. 処理完了:")
    print(f"  総ページ数: {stats['total_pages']}")
    print(f"  成功: {stats['success_count']}")
    print(f"  既存: {stats['existing_count']}")
    print(f"  エラー: {stats['error_count']}")
    print(f"  追加ラベル数: {stats['total_labels_added']}")

def example_4_individual_pages():
    """例4: 個別ページ処理"""
    print("=== 例4: 個別ページ処理 ===")
    
    toolkit = ConfluenceLabelingToolkit()
    
    # 個別ページにラベル追加
    test_pages = [
        {"id": "123456", "labels": ["議事録", "2025年"]},
        {"id": "234567", "labels": ["機能要件", "ユーザー管理"]},
        {"id": "345678", "labels": ["アーカイブ", "旧システム"]}
    ]
    
    for page in test_pages:
        print(f"\nページ {page['id']} 処理中...")
        
        # 現在のラベル確認
        current = toolkit.get_page_labels(page['id'])
        print(f"  現在のラベル: {current}")
        
        # ラベル追加
        result = toolkit.add_labels_to_page(page['id'], page['labels'])
        
        if result['success']:
            print(f"  追加されたラベル: {result['added_labels']}")
            print(f"  既存ラベル: {result['existing_labels']}")
        else:
            print(f"  エラー: {result['error']}")

def example_5_error_handling():
    """例5: エラーハンドリング"""
    print("=== 例5: エラーハンドリング ===")
    
    try:
        toolkit = ConfluenceLabelingToolkit()
        
        # 存在しないページIDでテスト
        result = toolkit.add_labels_to_page("invalid_page_id", ["test"])
        
        if result['success']:
            print("ラベル追加成功")
        else:
            print(f"ラベル追加失敗: {result['error']}")
            
    except Exception as e:
        print(f"予期しないエラー: {str(e)}")
        logging.error(f"システムエラー: {str(e)}")

def example_6_custom_config():
    """例6: カスタム設定での実行"""
    print("=== 例6: カスタム設定 ===")
    
    from confluence_labeling_toolkit import LabelingConfig
    
    # カスタム設定
    config = LabelingConfig(
        atlassian_domain="custom-domain.atlassian.net",
        atlassian_email="custom@example.com",
        atlassian_api_token="custom_token",
        space_key="CUSTOM_SPACE"
    )
    
    # カスタム設定でツールキット初期化
    toolkit = ConfluenceLabelingToolkit(config)
    
    print("カスタム設定でツールキット初期化完了")

def main():
    """メイン実行関数"""
    setup_logging()
    
    print("Confluenceラベリングツールキット 移行用実行例")
    print("=" * 50)
    
    # 実行する例を選択（実際の移行時は必要な例のみ実行）
    examples = {
        "1": example_1_small_test,
        "2": example_2_category_processing,
        "3": example_3_full_processing,
        "4": example_4_individual_pages,
        "5": example_5_error_handling,
        "6": example_6_custom_config
    }
    
    print("\n実行可能な例:")
    for key, func in examples.items():
        print(f"  {key}: {func.__doc__.split('(')[0].replace('例' + key + ': ', '')}")
    
    choice = input("\n実行する例を選択してください (1-6, または 'all' for all): ")
    
    if choice.lower() == 'all':
        for func in examples.values():
            try:
                func()
                print("\n" + "-" * 50)
            except Exception as e:
                print(f"エラー: {str(e)}")
                logging.error(f"実行エラー: {str(e)}")
    elif choice in examples:
        try:
            examples[choice]()
        except Exception as e:
            print(f"エラー: {str(e)}")
            logging.error(f"実行エラー: {str(e)}")
    else:
        print("無効な選択です。")

if __name__ == "__main__":
    main()

"""
実際の移行時の推奨手順:

1. 環境準備
   - confluence_labeling_toolkit.py をプロジェクトにコピー
   - sample_settings.ini を config/settings.ini としてコピー・編集
   - sample_secrets.env を config/secrets.env としてコピー・編集
   - 必要な依存関係をインストール

2. 接続テスト
   - example_4_individual_pages() で小規模テスト

3. 段階的実行
   - example_1_small_test() で動作確認
   - example_2_category_processing() でカテゴリ別処理
   - example_3_full_processing() で全件処理

4. 運用
   - ログファイルの確認
   - レポートファイルの確認
   - エラーハンドリングの実装

5. カスタマイズ
   - API制限に応じた待機時間調整
   - ログレベルの調整
   - エラー処理のカスタマイズ
"""
