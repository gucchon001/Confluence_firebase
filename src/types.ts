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
  }
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
};