'use client';

import React, { useState } from 'react';
import { Star, Send, MessageSquare } from 'lucide-react';

interface FeedbackRatingProps {
  postLogId: string;
  userId?: string;
  sessionId?: string;
  onSubmitted?: (rating: number, comment: string) => void;
}

export const FeedbackRating: React.FC<FeedbackRatingProps> = ({ 
  postLogId, 
  userId,
  sessionId,
  onSubmitted 
}) => {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const handleRatingClick = (selectedRating: number) => {
    if (isSubmitted) return;
    setRating(selectedRating);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('評価を選択してください');
      return;
    }

    setIsSubmitting(true);

    try {
      // ヘッダーにユーザー情報を含める
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (userId) {
        headers['x-user-id'] = userId;
      }
      
      if (sessionId) {
        headers['x-session-id'] = sessionId;
      }

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          postLogId,
          rating,
          comment: comment.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('評価の保存に失敗しました');
      }

      const result = await response.json();
      console.log('評価を保存しました:', result);
      
      setIsSubmitted(true);
      onSubmitted?.(rating, comment);
      
    } catch (error) {
      console.error('評価保存エラー:', error);
      alert('評価の保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <div className="flex items-center justify-center mb-2">
          <Star className="w-5 h-5 text-green-500 fill-current" />
          <span className="ml-2 text-green-700 font-medium">
            評価を送信しました！
          </span>
        </div>
        <p className="text-sm text-green-600">
          ご協力ありがとうございます。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          この回答はいかがでしたか？
        </h3>
        
        {/* 5段階評価 */}
        <div className="flex items-center space-x-1 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRatingClick(star)}
              disabled={isSubmitting}
              className={`p-1 transition-colors ${
                star <= rating
                  ? 'text-yellow-400 hover:text-yellow-500'
                  : 'text-gray-300 hover:text-yellow-400'
              } ${isSubmitting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Star 
                className={`w-6 h-6 ${
                  star <= rating ? 'fill-current' : ''
                }`} 
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-600">
            {rating > 0 && (
              rating === 1 ? 'とても不満' :
              rating === 2 ? '不満' :
              rating === 3 ? '普通' :
              rating === 4 ? '満足' :
              'とても満足'
            )}
          </span>
        </div>

        {/* コメント入力 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MessageSquare className="w-4 h-4 inline mr-1" />
            コメント（任意）
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="改善点やご意見をお聞かせください..."
            disabled={isSubmitting}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            rows={3}
            maxLength={500}
          />
          <div className="text-right text-xs text-gray-500 mt-1">
            {comment.length}/500文字
          </div>
        </div>

        {/* 送信ボタン */}
        <button
          onClick={handleSubmit}
          disabled={rating === 0 || isSubmitting}
          className={`w-full flex items-center justify-center px-4 py-2 rounded-md font-medium transition-colors ${
            rating === 0 || isSubmitting
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              送信中...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              評価を送信
            </>
          )}
        </button>
      </div>
    </div>
  );
};
