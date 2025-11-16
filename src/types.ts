export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { 
    title: string; 
    url: string;
    distance?: number;
    source?: 'vector' | 'keyword';
  }[];
  createdAt: string; // ISO string date
  user?: {
    displayName: string | null;
    photoURL: string | null;
  };
  postLogId?: string; // フィードバック用の投稿ログID
};

// roleが'ai'ではなく'assistant'であることを保証する
export type MessageCreate = Omit<Message, 'id' | 'createdAt'>;

// Firestoreに保存されるメッセージ型
export type FirestoreMessage = {
  role: 'user' | 'assistant'; // 仕様書では'user'または'ai'となっているが、実装では'assistant'を使用
  content: string;
  timestamp: any; // Firestore Timestamp
  sources?: { 
    title: string; 
    url: string;
    distance?: number;
    source?: 'vector' | 'keyword';
  }[];
  user?: {
    displayName: string | null;
    photoURL: string | null;
  }
};

// Firestoreに保存される会話型
export type FirestoreConversation = {
  title: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  messages: FirestoreMessage[];
};

// ユーザープロフィール型
export type UserProfile = {
  uid: string;
  displayName: string | null;
  email: string;
  createdAt: Date;
  isAdmin?: boolean; // 管理者権限
  adminGrantedAt?: Date; // 管理者権限付与日時
  adminGrantedBy?: string; // 管理者権限付与者
};

// 管理者関連の型
export type AdminUser = {
  uid: string;
  displayName: string | null;
  email: string;
  createdAt: Date;
  isAdmin: boolean;
  adminGrantedAt?: Date;
  adminGrantedBy?: string;
};

// 参照元型
export type Reference = {
  title: string;
  url: string;
  score: number;
  source: 'vector' | 'bm25' | 'keyword';
};

// 投稿ログ型（管理画面用）
export type PostLog = {
  id: string;
  userId: string; // 匿名化済み
  question: string;
  answer: string;
  serverStartupTime: number; // ミリ秒 - サーバー起動処理時間
  ttfbTime?: number; // ミリ秒 - Time To First Byte（最初のストリーミングチャンクまでの時間）
  searchTime: number; // ミリ秒
  aiGenerationTime: number; // ミリ秒
  totalTime: number; // ミリ秒
  referencesCount: number;
  references?: Reference[]; // 参照元の詳細情報
  answerLength: number;
  qualityScore?: number;
  timestamp: Date;
  processingSteps: ProcessingStep[];
  errors?: ErrorLog[];
  metadata: {
    userAgent?: string;
    ipAddress?: string; // 匿名化済み
    sessionId: string;
    userDisplayName?: string; // ユーザー表示名
    environment?: 'development' | 'staging' | 'production'; // 環境情報
    dataSource?: 'confluence' | 'jira' | 'mixed' | 'unknown'; // データソース
  };
};

// 処理ステップ型
export type ProcessingStep = {
  step: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  duration?: number;
  timestamp: Date;
  details?: any;
};

// エラーログ型
export type ErrorLog = {
  id: string;
  timestamp: Date;
  level: 'error' | 'warning' | 'info';
  category: 'search' | 'ai' | 'system' | 'auth';
  message: string;
  stack?: string;
  context: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    operation?: string;
  };
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
};

// 満足度評価型（評価フィードバック機能用）
export type SatisfactionRating = {
  id: string;
  userId: string;
  postLogId: string;
  rating: number; // 1-5の評価
  comment?: string;
  timestamp: Date;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    sessionId: string;
    userDisplayName?: string;
  };
};

// パフォーマンスアラート型
export type PerformanceAlert = {
  id: string;
  type: 'search_time' | 'ai_generation_time' | 'error_rate' | 'system_load';
  severity: 'warning' | 'critical';
  message: string;
  value: number; // 実際の値
  threshold: number; // 閾値
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
};