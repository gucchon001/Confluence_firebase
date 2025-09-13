# 1. 概要

## 1.1 プロダクト名

Confluence仕様書要約チャットボット (仮称: Spec-Finder)

## 1.2 背景と目的

社内のConfluenceには、多数のプロダクト仕様書が蓄積されているが、情報が分散しており、目的の仕様を探し出すのに時間がかかるという課題がある。また、仕様の全体像を把握したり、複数の仕様書を横断して確認したりすることが困難である。
本プロダクトは、Atlassian APIを通じてConfluence上の仕様書をAIに学習させ、自然言語による対話形式で仕様の検索・要約・深掘りを可能にすることで、開発者やプロダクトマネージャーの情報検索コストを大幅に削減し、開発効率を向上させることを目的とする。

## 1.3 開発環境

**Firebase Studio**
AIによる開発支援、各種Firebaseサービスとのシームレスな統合、ブラウザベースでの環境構築不要といった利点を活かし、迅速なプロトタイピングと開発を実現する。

# 2. 機能要件

## 2.1 ユーザー向け機能

| ID      | 機能名             | 機能概要                                                                                             | 優先度 |
| :------ | :----------------- | :--------------------------------------------------------------------------------------------------- | :----- |
| USR-001 | Googleアカウント認証 | Googleアカウントでログインできる。アクセス制御の基盤となる。                                           | 高     |
| USR-002 | チャットインターフェース | ユーザーが自然言語で質問を入力できるUIを提供する。                                                   | 高     |
| USR-003 | 仕様の検索・要約   | 入力された質問に対し、関連する仕様書を検索し、要約した回答を生成して表示する。                         | 高     |
| USR-004 | 参照元リンク表示   | 回答の生成元となったConfluenceのページURLを明記し、ユーザーが一次情報を確認できるようにする。            | 高     |
| USR-005 | 深掘り質問         | 提示された回答に対して、追加の質問を投げかけることで、会話の文脈を維持したまま詳細な情報を引き出せる。 | 中     |
| USR-006 | 会話履歴の表示     | 過去の質疑応答の履歴を一覧で確認し、特定の会話を呼び出すことができる。                                 | 中     |

## 2.2 システム・管理機能

| ID      | 機能名                 | 機能概要                                                                                             |
| :------ | :--------------------- | :--------------------------------------------------------------------------------------------------- |
| SYS-001 | Confluenceデータ同期   | Atlassian APIを介して、指定されたConfluenceスペースから仕様書データを定期的に取得する。                |
| SYS-002 | ベクトルデータベース更新 | 取得した仕様書データを分割・ベクトル化し、ベクトルデータベースに保存・更新する。この処理は1日1回、夜間に自動実行される。 |

# 3. 非機能要件

| 項目         | 要件                                                                                             |
| :----------- | :----------------------------------------------------------------------------------------------- |
| パフォーマンス | ユーザーの質問から5秒以内に回答を返すことを目標とする。                                          |
| セキュリティ | ユーザー認証を行い、許可されたユーザーのみが利用できるようにする。Atlassian APIキーなどの機密情報は適切に管理する。 |
| 可用性       | Firebaseのインフラに準拠し、安定したサービス稼働を目指す。                                         |

# 4. システムアーキテクチャ

Firebase Studioを開発環境とし、各種FirebaseサービスとGoogle Cloudのサービスを連携させて構築する。

```mermaid
graph TD
    subgraph User Device
        A[ブラウザ]
    end

    subgraph Firebase / Google Cloud
        B[Firebase Hosting] --> C{Firebase Authentication};
        A --> B[静的Webサイト<br>(React/Next.js)];
        B --> D[Next.js API Routes<br>(チャットAPI / Genkitで実装)];
        D --> C;
        D --> E[Firestore<br>(会話履歴)];
        D --> F[Vertex AI<br>(Gemini API)];
        D --> G[Vertex AI Vector Search<br>(ベクトルDB)];

        H[Cloud Scheduler] -- 1日1回実行 --> I[Cloud Functions for Firebase<br>(データ同期バッチ)];
        I --> J[Atlassian API];
        J -- Confluenceデータ --> I;
        I --> F;
        I --> G;
    end

    subgraph External Service
        J[Atlassian Confluence];
    end

# 4.1 使用技術スタック

開発環境: Firebase Studio

フロントエンド: React (Next.js)

バックエンド: Next.js API Routes + Firebase Cloud Functions

AIフレームワーク: Genkit (core)

認証: Firebase Authentication

データベース (会話履歴): Firestore

LLM / Embedding: Google AI - Gemini API (Vertex AI)
- LLM: gemini-2.5-flash (Gemini Pro)
- Embedding: text-embedding-004

ベクトルデータベース: Vertex AI Vector Search

自動化: Cloud Scheduler

外部API: Atlassian API