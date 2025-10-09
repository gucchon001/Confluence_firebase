#!/bin/bash
# Firebase Secret Managerにシークレットを設定するスクリプト

# 使用方法:
# 1. .env.localから環境変数を読み込む: source .env.local
# 2. Firebase CLIにログイン: firebase login
# 3. このスクリプトを実行: bash scripts/setup-firebase-secrets.sh

PROJECT_ID="confluence-copilot-ppjye"

echo "🔐 Setting up Firebase secrets for project: $PROJECT_ID"
echo ""

# 環境変数から読み込む
if [ -z "$CONFLUENCE_API_TOKEN" ]; then
  echo "⚠️  CONFLUENCE_API_TOKEN environment variable not set!"
  echo "Please run: source .env.local"
  exit 1
fi

# 1. Confluence API Token
echo "Setting up Confluence API Token..."
echo "$CONFLUENCE_API_TOKEN" | \
  gcloud secrets create confluence_api_token \
    --project=$PROJECT_ID \
    --data-file=- \
    2>/dev/null || echo "Secret already exists, updating..."

echo "$CONFLUENCE_API_TOKEN" | \
  gcloud secrets versions add confluence_api_token \
    --project=$PROJECT_ID \
    --data-file=-

echo "✅ Confluence API Token configured"
echo ""

# 2. Firebase Service Account Key
echo "Setting up Firebase Service Account Key..."
if [ -f "keys/firebase-adminsdk-key.json" ]; then
  gcloud secrets create firebase_service_account_key \
    --project=$PROJECT_ID \
    --data-file=keys/firebase-adminsdk-key.json \
    2>/dev/null || echo "Secret already exists, updating..."
  
  gcloud secrets versions add firebase_service_account_key \
    --project=$PROJECT_ID \
    --data-file=keys/firebase-adminsdk-key.json
  
  echo "✅ Firebase Service Account Key configured"
else
  echo "⚠️  keys/firebase-adminsdk-key.json not found, skipping"
fi
echo ""

echo "🎉 All secrets configured!"
echo ""
echo "Next steps:"
echo "1. Verify secrets: gcloud secrets list --project=$PROJECT_ID"
echo "2. Deploy your app: firebase deploy"

