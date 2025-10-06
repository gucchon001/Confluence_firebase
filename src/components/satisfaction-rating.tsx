'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, MessageSquare, Send, ThumbsUp, ThumbsDown } from 'lucide-react';
import { satisfactionRatingService } from '@/lib/satisfaction-rating-service';
import type { SatisfactionRating } from '@/types';

interface SatisfactionRatingProps {
  postLogId: string;
  userId: string;
  sessionId: string;
  onRatingSubmitted?: (rating: SatisfactionRating) => void;
  onClose?: () => void;
}

export function SatisfactionRatingComponent({
  postLogId,
  userId,
  sessionId,
  onRatingSubmitted,
  onClose
}: SatisfactionRatingProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleRatingClick = (selectedRating: number) => {
    setRating(selectedRating);
  };

  const handleSubmit = async () => {
    if (!rating) return;

    setIsSubmitting(true);
    try {
      const ratingData: Omit<SatisfactionRating, 'id'> = {
        postLogId,
        userId,
        rating: rating as 1 | 2 | 3 | 4 | 5,
        comment: comment.trim() || undefined,
        timestamp: new Date(),
        metadata: {
          sessionId,
          userAgent: navigator.userAgent,
          ipAddress: '127.0.0.1' // 実際の実装では適切に取得
        }
      };

      const ratingId = await satisfactionRatingService.createRating(ratingData);
      
      const fullRating: SatisfactionRating = {
        id: ratingId,
        ...ratingData
      };

      setIsSubmitted(true);
      onRatingSubmitted?.(fullRating);
      
      // 3秒後に自動で閉じる
      setTimeout(() => {
        onClose?.();
      }, 3000);
    } catch (error) {
      console.error('❌ 満足度評価の送信に失敗しました:', error);
      alert('評価の送信に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = (ratingValue: number) => {
    switch (ratingValue) {
      case 1: return 'とても不満';
      case 2: return '不満';
      case 3: return '普通';
      case 4: return '満足';
      case 5: return 'とても満足';
      default: return '';
    }
  };

  const getRatingIcon = (ratingValue: number) => {
    if (ratingValue <= 2) return <ThumbsDown className="h-5 w-5" />;
    if (ratingValue === 3) return <MessageSquare className="h-5 w-5" />;
    return <ThumbsUp className="h-5 w-5" />;
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-green-600">
            <Star className="h-6 w-6 fill-current" />
            評価ありがとうございます！
          </CardTitle>
          <CardDescription>
            フィードバックをいただき、ありがとうございます。
            <br />
            今後の改善に活用させていただきます。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          回答の満足度を教えてください
        </CardTitle>
        <CardDescription>
          この回答はいかがでしたか？5段階で評価をお願いします。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 5段階評価 */}
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((ratingValue) => (
            <button
              key={ratingValue}
              onClick={() => handleRatingClick(ratingValue)}
              className={`
                p-3 rounded-lg border-2 transition-all duration-200 hover:scale-105
                ${rating === ratingValue
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-200 hover:border-gray-300 text-gray-500'
                }
              `}
              disabled={isSubmitting}
            >
              <div className="flex flex-col items-center gap-1">
                {getRatingIcon(ratingValue)}
                <span className="text-sm font-medium">{ratingValue}</span>
              </div>
            </button>
          ))}
        </div>

        {/* 評価ラベル */}
        {rating && (
          <div className="text-center">
            <p className="text-sm text-gray-600">
              選択: {rating} - {getRatingLabel(rating)}
            </p>
          </div>
        )}

        {/* コメント入力 */}
        <div className="space-y-2">
          <label htmlFor="comment" className="text-sm font-medium text-gray-700">
            コメント（任意）
          </label>
          <Textarea
            id="comment"
            placeholder="回答についてご意見やご要望があれば、お聞かせください..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[80px] resize-none"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500">
            {comment.length}/500文字
          </p>
        </div>

        {/* 送信ボタン */}
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={!rating || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                送信中...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                評価を送信
              </>
            )}
          </Button>
          {onClose && (
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              後で
            </Button>
          )}
        </div>

        {/* プライバシー情報 */}
        <p className="text-xs text-gray-500 text-center">
          評価は匿名で収集され、サービス改善にのみ使用されます。
        </p>
      </CardContent>
    </Card>
  );
}

// 簡単な評価コンポーネント（ミニマル版）
export function SimpleSatisfactionRating({
  postLogId,
  userId,
  sessionId,
  onRatingSubmitted
}: {
  postLogId: string;
  userId: string;
  sessionId: string;
  onRatingSubmitted?: (rating: SatisfactionRating) => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleRatingClick = async (selectedRating: number) => {
    if (isSubmitted) return;
    
    setRating(selectedRating);
    setIsSubmitted(true);

    try {
      const ratingData: Omit<SatisfactionRating, 'id'> = {
        postLogId,
        userId,
        rating: selectedRating as 1 | 2 | 3 | 4 | 5,
        timestamp: new Date(),
        metadata: {
          sessionId,
          userAgent: navigator.userAgent,
          ipAddress: '127.0.0.1'
        }
      };

      const ratingId = await satisfactionRatingService.createRating(ratingData);
      
      const fullRating: SatisfactionRating = {
        id: ratingId,
        ...ratingData
      };

      onRatingSubmitted?.(fullRating);
    } catch (error) {
      console.error('❌ 満足度評価の送信に失敗しました:', error);
      setIsSubmitted(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Star className="h-4 w-4 fill-current" />
        <span>評価ありがとうございます！</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-sm text-gray-600 mr-2">満足度:</span>
      {[1, 2, 3, 4, 5].map((ratingValue) => (
        <button
          key={ratingValue}
          onClick={() => handleRatingClick(ratingValue)}
          className={`
            p-1 rounded transition-colors duration-200
            ${rating === ratingValue
              ? 'text-yellow-500'
              : 'text-gray-300 hover:text-yellow-400'
            }
          `}
        >
          <Star className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
