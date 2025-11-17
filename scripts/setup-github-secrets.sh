#!/bin/bash
# GitHub Secrets設定スクリプト
# 
# 使用方法:
#   chmod +x scripts/setup-github-secrets.sh
#   ./scripts/setup-github-secrets.sh
#
# 注意: .env.localファイルが存在することを前提としています

set -e

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔐 GitHub Secrets設定スクリプト"
echo "=================================="
echo ""

# .env.localファイルの存在確認
if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ .env.localファイルが見つかりません${NC}"
    exit 1
fi

# GitHub CLIのインストール確認
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) がインストールされていません${NC}"
    echo "インストール方法: https://cli.github.com/"
    exit 1
fi

# GitHub認証確認
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLIにログインしていません${NC}"
    echo "ログインコマンド: gh auth login"
    exit 1
fi

# .env.localから値を読み込む関数
get_env_value() {
    grep "^${1}=" .env.local | cut -d '=' -f2- | sed 's/^"//;s/"$//'
}

echo "📋 必須のSecretsを設定します..."
echo ""

# 必須のSecrets
echo -e "${GREEN}1. JIRA_PROJECT_KEY${NC}"
JIRA_PROJECT_KEY=$(get_env_value "JIRA_PROJECT_KEY")
if [ -z "$JIRA_PROJECT_KEY" ]; then
    echo -e "${RED}   ❌ JIRA_PROJECT_KEYが見つかりません${NC}"
    exit 1
fi
gh secret set JIRA_PROJECT_KEY --body "$JIRA_PROJECT_KEY"
echo -e "${GREEN}   ✅ 設定完了${NC}"
echo ""

echo -e "${GREEN}2. GEMINI_API_KEY${NC}"
GEMINI_API_KEY=$(get_env_value "GEMINI_API_KEY")
if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}   ❌ GEMINI_API_KEYが見つかりません${NC}"
    exit 1
fi
gh secret set GEMINI_API_KEY --body "$GEMINI_API_KEY"
echo -e "${GREEN}   ✅ 設定完了${NC}"
echo ""

echo -e "${GREEN}3. GOOGLE_CLOUD_CREDENTIALS${NC}"
GOOGLE_APPLICATION_CREDENTIALS=$(get_env_value "GOOGLE_APPLICATION_CREDENTIALS")
if [ -z "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo -e "${RED}   ❌ GOOGLE_APPLICATION_CREDENTIALSが見つかりません${NC}"
    exit 1
fi

# パスを正規化（./ を削除）
CREDENTIALS_FILE="${GOOGLE_APPLICATION_CREDENTIALS#./}"
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo -e "${RED}   ❌ 認証情報ファイルが見つかりません: $CREDENTIALS_FILE${NC}"
    exit 1
fi

gh secret set GOOGLE_CLOUD_CREDENTIALS < "$CREDENTIALS_FILE"
echo -e "${GREEN}   ✅ 設定完了${NC}"
echo ""

echo "📋 オプションのSecretsを設定します（Confluence設定をフォールバックとして使用）..."
echo ""

# オプションのSecrets（Jira専用が設定されていない場合のみ）
echo -e "${YELLOW}4. JIRA_BASE_URL (オプション)${NC}"
CONFLUENCE_BASE_URL=$(get_env_value "CONFLUENCE_BASE_URL")
if [ -n "$CONFLUENCE_BASE_URL" ]; then
    read -p "   JIRA_BASE_URLを設定しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh secret set JIRA_BASE_URL --body "$CONFLUENCE_BASE_URL"
        echo -e "${GREEN}   ✅ 設定完了${NC}"
    else
        echo -e "${YELLOW}   ⏩ スキップ（CONFLUENCE_BASE_URLがフォールバックとして使用されます）${NC}"
    fi
else
    echo -e "${YELLOW}   ⏩ CONFLUENCE_BASE_URLが見つかりません${NC}"
fi
echo ""

echo -e "${YELLOW}5. JIRA_USER_EMAIL (オプション)${NC}"
CONFLUENCE_USER_EMAIL=$(get_env_value "CONFLUENCE_USER_EMAIL")
if [ -n "$CONFLUENCE_USER_EMAIL" ]; then
    read -p "   JIRA_USER_EMAILを設定しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh secret set JIRA_USER_EMAIL --body "$CONFLUENCE_USER_EMAIL"
        echo -e "${GREEN}   ✅ 設定完了${NC}"
    else
        echo -e "${YELLOW}   ⏩ スキップ（CONFLUENCE_USER_EMAILがフォールバックとして使用されます）${NC}"
    fi
else
    echo -e "${YELLOW}   ⏩ CONFLUENCE_USER_EMAILが見つかりません${NC}"
fi
echo ""

echo -e "${YELLOW}6. JIRA_API_TOKEN (オプション)${NC}"
CONFLUENCE_API_TOKEN=$(get_env_value "CONFLUENCE_API_TOKEN")
if [ -n "$CONFLUENCE_API_TOKEN" ]; then
    read -p "   JIRA_API_TOKENを設定しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh secret set JIRA_API_TOKEN --body "$CONFLUENCE_API_TOKEN"
        echo -e "${GREEN}   ✅ 設定完了${NC}"
    else
        echo -e "${YELLOW}   ⏩ スキップ（CONFLUENCE_API_TOKENがフォールバックとして使用されます）${NC}"
    fi
else
    echo -e "${YELLOW}   ⏩ CONFLUENCE_API_TOKENが見つかりません${NC}"
fi
echo ""

echo "📋 Confluenceワークフロー用のSecretsを確認します..."
echo ""

# Confluence用のSecrets（既に設定されている可能性がある）
CONFLUENCE_BASE_URL=$(get_env_value "CONFLUENCE_BASE_URL")
CONFLUENCE_USER_EMAIL=$(get_env_value "CONFLUENCE_USER_EMAIL")
CONFLUENCE_API_TOKEN=$(get_env_value "CONFLUENCE_API_TOKEN")
CONFLUENCE_SPACE_KEY=$(get_env_value "CONFLUENCE_SPACE_KEY")

if [ -n "$CONFLUENCE_BASE_URL" ]; then
    echo -e "${GREEN}7. CONFLUENCE_BASE_URL${NC}"
    read -p "   設定しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh secret set CONFLUENCE_BASE_URL --body "$CONFLUENCE_BASE_URL"
        echo -e "${GREEN}   ✅ 設定完了${NC}"
    fi
    echo ""
fi

if [ -n "$CONFLUENCE_USER_EMAIL" ]; then
    echo -e "${GREEN}8. CONFLUENCE_USER_EMAIL${NC}"
    read -p "   設定しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh secret set CONFLUENCE_USER_EMAIL --body "$CONFLUENCE_USER_EMAIL"
        echo -e "${GREEN}   ✅ 設定完了${NC}"
    fi
    echo ""
fi

if [ -n "$CONFLUENCE_API_TOKEN" ]; then
    echo -e "${GREEN}9. CONFLUENCE_API_TOKEN${NC}"
    read -p "   設定しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh secret set CONFLUENCE_API_TOKEN --body "$CONFLUENCE_API_TOKEN"
        echo -e "${GREEN}   ✅ 設定完了${NC}"
    fi
    echo ""
fi

if [ -n "$CONFLUENCE_SPACE_KEY" ]; then
    echo -e "${GREEN}10. CONFLUENCE_SPACE_KEY${NC}"
    read -p "    設定しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh secret set CONFLUENCE_SPACE_KEY --body "$CONFLUENCE_SPACE_KEY"
        echo -e "${GREEN}   ✅ 設定完了${NC}"
    fi
    echo ""
fi

echo "=================================="
echo -e "${GREEN}✅ GitHub Secrets設定が完了しました${NC}"
echo ""
echo "設定されたSecretsを確認するには:"
echo "  gh secret list"
echo ""

