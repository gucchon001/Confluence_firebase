import React from 'react';
import { errorMonitoringService } from './error-monitoring-service';

/**
 * グローバルエラーハンドラー
 * アプリケーション全体のエラーをキャッチして監視システムに送信
 */
class GlobalErrorHandler {
  private isInitialized = false;

  /**
   * エラーハンドラーを初期化
   */
  init(): void {
    if (this.isInitialized) {
      return;
    }

    // 未キャッチのJavaScriptエラーをハンドリング
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'javascript_error',
        message: event.message,
        stackTrace: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        component: 'global'
      });
    });

    // 未キャッチのPromise拒否をハンドリング
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'unhandled_promise_rejection',
        message: event.reason?.message || 'Unhandled promise rejection',
        stackTrace: event.reason?.stack,
        component: 'global'
      });
    });

    // React Error Boundary用のカスタムイベント
    window.addEventListener('react-error', (event: any) => {
      this.handleError({
        type: 'react_error',
        message: event.detail?.message || 'React component error',
        stackTrace: event.detail?.stackTrace,
        component: event.detail?.component || 'react_component'
      });
    });

    this.isInitialized = true;
    console.log('[GlobalErrorHandler] Initialized');
  }

  /**
   * エラーをハンドリング
   */
  private async handleError(errorInfo: {
    type: string;
    message: string;
    stackTrace?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    component?: string;
    additionalInfo?: Record<string, any>;
  }): Promise<void> {
    try {
      // エラーの重要度を判定
      const severity = this.determineSeverity(errorInfo);

      // エラーログを記録
      await errorMonitoringService.logError(
        errorInfo.type,
        errorInfo.message,
        severity,
        {
          stackTrace: errorInfo.stackTrace,
          component: errorInfo.component,
          additionalInfo: {
            ...errorInfo.additionalInfo,
            filename: errorInfo.filename,
            lineno: errorInfo.lineno,
            colno: errorInfo.colno
          }
        }
      );

      console.error('[GlobalErrorHandler] Error logged:', errorInfo);
    } catch (error) {
      // エラーログ記録自体が失敗した場合はコンソールに出力
      console.error('[GlobalErrorHandler] Failed to log error:', error);
      console.error('[GlobalErrorHandler] Original error:', errorInfo);
    }
  }

  /**
   * エラーの重要度を判定
   */
  private determineSeverity(errorInfo: {
    type: string;
    message: string;
    filename?: string;
  }): 'low' | 'medium' | 'high' | 'critical' {
    const { type, message, filename } = errorInfo;

    // 重要なエラーパターン
    if (
      message.includes('Network Error') ||
      message.includes('Failed to fetch') ||
      message.includes('Connection refused') ||
      type === 'unhandled_promise_rejection'
    ) {
      return 'high';
    }

    // 認証関連のエラー
    if (
      message.includes('Unauthorized') ||
      message.includes('Authentication failed') ||
      message.includes('Token expired')
    ) {
      return 'critical';
    }

    // API関連のエラー
    if (
      message.includes('API Error') ||
      message.includes('HTTP') ||
      filename?.includes('/api/')
    ) {
      return 'medium';
    }

    // React関連のエラー
    if (type === 'react_error') {
      return 'medium';
    }

    // その他のJavaScriptエラー
    if (type === 'javascript_error') {
      return 'low';
    }

    return 'medium';
  }

  /**
   * 手動でエラーをログ
   */
  async logManualError(
    errorType: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    options: {
      stackTrace?: string;
      userId?: string;
      sessionId?: string;
      component?: string;
      action?: string;
      additionalInfo?: Record<string, any>;
    } = {}
  ): Promise<void> {
    try {
      await errorMonitoringService.logError(errorType, message, severity, options);
    } catch (error) {
      console.error('[GlobalErrorHandler] Failed to log manual error:', error);
    }
  }

  /**
   * React Error Boundary用のエラー送信
   */
  sendReactError(error: Error, errorInfo: any, componentName?: string): void {
    const event = new CustomEvent('react-error', {
      detail: {
        message: error.message,
        stackTrace: error.stack,
        component: componentName,
        errorInfo
      }
    });
    window.dispatchEvent(event);
  }
}

export const globalErrorHandler = new GlobalErrorHandler();

/**
 * React Error Boundary
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; componentName?: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; componentName?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any): void {
    globalErrorHandler.sendReactError(error, errorInfo, this.props.componentName);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            エラーが発生しました
          </h2>
          <p className="text-red-600">
            申し訳ございません。予期しないエラーが発生しました。
            ページを再読み込みしてください。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            ページを再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

