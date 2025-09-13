import { toast } from '@/hooks/use-toast';

// エラーコードとメッセージのマッピング
const errorMessages: Record<string, { title: string; description: string }> = {
  'unauthorized': {
    title: '認証エラー',
    description: 'セッションが切れました。再度ログインしてください。'
  },
  'confluence_api_error': {
    title: 'データ取得エラー',
    description: '仕様書の取得に失敗しました。時間をおいて再度お試しください。'
  },
  'llm_api_error': {
    title: '回答生成エラー',
    description: '回答の生成中にエラーが発生しました。別の質問をお試しください。'
  },
  'vector_search_error': {
    title: '検索エラー',
    description: '内部エラーが発生しました。管理者にお問い合わせください。'
  },
  'database_write_error': {
    title: '保存エラー',
    description: '会話履歴の保存に失敗しました。'
  },
  'resource_not_found': {
    title: 'リソースエラー',
    description: 'お探しの会話履歴は見つかりませんでした。'
  },
  'bad_request': {
    title: 'リクエストエラー',
    description: 'リクエストの形式が正しくありません。'
  }
};

// エラートーストを表示
export function showErrorToast(errorCode?: string, customMessage?: string) {
  const errorInfo = errorCode ? errorMessages[errorCode] : null;
  
  toast({
    variant: "destructive",
    title: errorInfo?.title || "エラー",
    description: customMessage || errorInfo?.description || "予期しないエラーが発生しました。",
  });
}

// 成功トーストを表示
export function showSuccessToast(title: string, description?: string) {
  toast({
    title,
    description,
  });
}

// 情報トーストを表示
export function showInfoToast(title: string, description?: string) {
  toast({
    title,
    description,
  });
}

// ローディングトーストを表示（返り値のdismiss関数で非表示にできる）
export function showLoadingToast(message: string = "処理中...") {
  return toast({
    title: message,
    description: "しばらくお待ちください。",
  });
}

// APIエラーレスポンスからトーストを表示
export function showApiErrorToast(error: any) {
  if (error?.error?.code) {
    showErrorToast(error.error.code, error.error.message);
  } else if (error?.message) {
    showErrorToast(undefined, error.message);
  } else {
    showErrorToast();
  }
}

// ネットワークエラーの判定とトースト表示
export function handleNetworkError(error: any) {
  if (!navigator.onLine) {
    showErrorToast(undefined, "インターネット接続を確認してください。");
    return true;
  }
  
  if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('network')) {
    showErrorToast(undefined, "ネットワークエラーが発生しました。接続を確認してください。");
    return true;
  }
  
  return false;
}
