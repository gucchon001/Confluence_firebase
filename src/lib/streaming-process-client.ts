/**
 * 処理ステップストリーミングクライアント
 * 参考: https://zenn.dev/japan/articles/bb236b66cb9e91
 */

export interface ProcessingStep {
  step: number;
  stepId: string;
  title: string;
  description: string;
  totalSteps: number;
  icon: string;
}

export interface StreamingMessage {
  type: 'step_update' | 'chunk' | 'completion' | 'error';
  step?: number;
  stepId?: string;
  title?: string;
  description?: string;
  totalSteps?: number;
  icon?: string;
  chunk?: string;
  chunkIndex?: number;
  isComplete?: boolean;
  references?: any[];
  fullAnswer?: string;
  error?: string;
  message?: string;
  postLogId?: string;
}

export class StreamingProcessClient {
  private controller: AbortController | null = null;

  /**
   * ストリーミング処理を開始
   */
  async startStreaming(
    question: string,
    onStepUpdate: (step: ProcessingStep) => void,
    onChunk: (chunk: string, chunkIndex: number) => void,
    onCompletion: (fullAnswer: string, references: any[], postLogId?: string) => void,
    onError: (error: string) => void,
    chatHistory: any[] = [],
    labelFilters: any = { includeMeetingNotes: false },
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    try {
      // 既存のストリーミングを停止
      if (this.controller) {
        this.controller.abort();
      }

      // 新しいAbortControllerを作成
      this.controller = new AbortController();

      console.log('🌊 ストリーミング処理開始:', question);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (userId) {
        headers['x-user-id'] = userId;
      }
      
      if (sessionId) {
        headers['x-session-id'] = sessionId;
      }

      const response = await fetch('/api/streaming-process', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question,
          chatHistory,
          labelFilters
        }),
        signal: this.controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // レスポンスボディをReadableStreamとして取得
      const reader = response.body.getReader();
      // UTF-8のテキストとしてデコードするためのデコーダー
      const decoder = new TextDecoder('utf-8');

      // ストリームからデータを読み続ける
      while (true) {
        const { done, value } = await reader.read();

        // ストリームが終了したらループを抜ける
        if (done) {
          console.log('Stream finished.');
          break;
        }
        
        // 受け取ったデータ (Uint8Array) を文字列に変換
        const chunk = decoder.decode(value, { stream: true });
        
        // 各行を処理
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as StreamingMessage;
              this.handleMessage(data, onStepUpdate, onChunk, onCompletion, onError);
            } catch (parseError) {
              console.warn('Failed to parse streaming data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Streaming was aborted');
        return;
      }
      
      console.error('Streaming failed:', error);
      onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * ストリーミングを停止
   */
  stopStreaming(): void {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  /**
   * メッセージを処理
   */
  private handleMessage(
    message: StreamingMessage,
    onStepUpdate: (step: ProcessingStep) => void,
    onChunk: (chunk: string, chunkIndex: number) => void,
    onCompletion: (fullAnswer: string, references: any[], postLogId?: string) => void,
    onError: (error: string) => void
  ): void {
    switch (message.type) {
      case 'step_update':
        if (message.step && message.stepId && message.title && message.description && message.totalSteps && message.icon) {
          const step: ProcessingStep = {
            step: message.step,
            stepId: message.stepId,
            title: message.title,
            description: message.description,
            totalSteps: message.totalSteps,
            icon: message.icon
          };
          onStepUpdate(step);
        }
        break;

      case 'chunk':
        console.log('🔍 [DEBUG] chunk message received:', message);
        console.log('🔍 [DEBUG] message.chunk:', message.chunk);
        console.log('🔍 [DEBUG] typeof message.chunk:', typeof message.chunk);
        
        if (message.chunk && message.chunkIndex !== undefined) {
          // 文字列型チェック
          let safeChunk = '';
          if (typeof message.chunk === 'string') {
            safeChunk = message.chunk;
          } else if (message.chunk !== null && message.chunk !== undefined) {
            safeChunk = String(message.chunk);
          }
          
          console.log('🔍 [DEBUG] safeChunk:', safeChunk);
          console.log('🔍 [DEBUG] [object Object]含む:', safeChunk.includes('[object Object]'));
          
          if (safeChunk && !safeChunk.includes('[object Object]')) {
            onChunk(safeChunk, message.chunkIndex);
          } else {
            console.warn('🔍 [DEBUG] Invalid chunk detected, skipping:', message.chunk);
          }
        }
        break;

      case 'completion':
        console.log('🔍 [DEBUG] completion message received:', message);
        console.log('🔍 [DEBUG] message.fullAnswer:', message.fullAnswer);
        console.log('🔍 [DEBUG] typeof message.fullAnswer:', typeof message.fullAnswer);
        
        if (message.fullAnswer && message.references) {
          // 文字列型チェック
          let safeAnswer = '';
          if (typeof message.fullAnswer === 'string') {
            safeAnswer = message.fullAnswer;
          } else if (message.fullAnswer !== null && message.fullAnswer !== undefined) {
            safeAnswer = String(message.fullAnswer);
          }
          
          console.log('🔍 [DEBUG] safeAnswer:', safeAnswer);
          console.log('🔍 [DEBUG] [object Object]含む:', safeAnswer.includes('[object Object]'));
          
          if (safeAnswer && !safeAnswer.includes('[object Object]')) {
            onCompletion(safeAnswer, message.references, message.postLogId);
          } else {
            console.warn('🔍 [DEBUG] Invalid fullAnswer detected, using fallback');
            onCompletion('回答の生成中にエラーが発生しました。', message.references);
          }
        }
        break;

      case 'error':
        const errorMessage = message.message || message.error || 'Unknown error';
        onError(errorMessage);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }
}

// シングルトンインスタンス
export const streamingProcessClient = new StreamingProcessClient();
