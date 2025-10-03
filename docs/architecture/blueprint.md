# **App Name**: Confluence Spec-Finder

## 更新履歴
- **2025年1月**: 現在の実装に合わせて最新化
  - ストリーミング機能の追加
  - Firebase認証のドメイン制限
  - マークダウン表示機能の実装
  - 技術スタックの詳細化

## Core Features:

- **Google Authentication**: Allow users to log in securely with their Google accounts (@tomonokai-corp.com domain restriction).
- **Question Submission**: Provide a text input field for users to submit questions about Confluence documentation.
- **Streaming Response**: Real-time answer generation with progress indicators and live updates.
- **Confluence Data Retrieval via Hybrid Search**: Use local LanceDB + Lunr.js + keyword search to retrieve relevant Confluence specification data based on user questions.
- **AI-Powered Summarization Tool**: Leverage the Gemini 2.5 Flash model to generate concise summaries of the retrieved Confluence data relevant to the user's query.
- **Markdown Rendering**: Advanced markdown display with table support, proper formatting, and normalization.
- **Response Display**: Display the summarized answer, along with a list of source Confluence page titles and URLs for reference.
- **Chat History**: Save and load conversation history using Firestore with user-specific data management.
- **Secure API Endpoints**: Implement API endpoints using Firebase Authentication with domain restrictions to handle user questions securely.

## Technical Stack:

- **Frontend**: Next.js 15.3.3 (React 18.3.1, TypeScript 5.9.2)
- **Styling**: Tailwind CSS 3.4.1 + @tailwindcss/typography
- **UI Components**: Radix UI (Headless UI)
- **Markdown**: ReactMarkdown + remark-gfm
- **Authentication**: Firebase Authentication 11.9.1
- **Database**: Firestore 11.9.1 (conversations, user data), LanceDB 0.22.0 (vector search)
- **Search Engine**: Hybrid search (LanceDB + Lunr.js + keyword search)
- **AI**: Google AI Gemini API (gemini-2.5-flash)
- **Vector Embeddings**: Xenova Transformers (paraphrase-multilingual-mpnet-base-v2, 768 dimensions)

## Style Guidelines:

- **Primary color**: Deep Indigo (#3F51B5) to convey professionalism and reliability.
- **Background color**: Light Indigo (#E8EAF6) for a clean and calm interface.
- **Accent color**: Vibrant Orange (#FF9800) to highlight key elements and actions.
- **Typography**: Inter font family for modern and neutral appearance.
- **Layout**: Centralized chat display with input box and submit button at the bottom.
- **UI/UX**: 
  - Real-time streaming responses with progress indicators
  - Advanced markdown rendering with table support
  - Responsive design for various screen sizes
  - Professional icons and subtle transitions
  - Clean and intuitive user interface