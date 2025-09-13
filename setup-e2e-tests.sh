#!/bin/bash
# E2Eテスト環境セットアップスクリプト

# Playwrightのインストール
npm install -D @playwright/test

# ブラウザのインストール
npx playwright install

echo "E2Eテスト環境のセットアップが完了しました"
echo "テストを実行するには:"
echo "npm run test:e2e     # コマンドラインでテストを実行"
echo "npm run test:e2e:ui  # UIモードでテストを実行"
