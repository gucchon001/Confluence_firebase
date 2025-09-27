'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Clock, Zap, Brain, Search } from 'lucide-react';

interface MicroInteractionProps {
  type: 'typing' | 'searching' | 'thinking' | 'success' | 'error';
  message?: string;
  duration?: number;
}

export const MicroInteraction: React.FC<MicroInteractionProps> = ({
  type,
  message,
  duration = 2000
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => setIsVisible(false), duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const getIcon = () => {
    switch (type) {
      case 'typing':
        return <Clock className="h-4 w-4 animate-pulse" />;
      case 'searching':
        return <Search className="h-4 w-4 animate-spin" />;
      case 'thinking':
        return <Brain className="h-4 w-4 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'typing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'searching':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'thinking':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium ${getColor()}`}
        >
          {getIcon()}
          <span>{message || getDefaultMessage()}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  function getDefaultMessage() {
    switch (type) {
      case 'typing':
        return '入力中...';
      case 'searching':
        return '検索中...';
      case 'thinking':
        return '考え中...';
      case 'success':
        return '完了！';
      case 'error':
        return 'エラー';
    }
  }
};

// 段階的アニメーション付きのローディング
export const StagedLoading: React.FC<{ stages: string[]; currentStage: number }> = ({
  stages,
  currentStage
}) => {
  return (
    <div className="space-y-3">
      {stages.map((stage, index) => {
        const isActive = index === currentStage;
        const isCompleted = index < currentStage;
        const isPending = index > currentStage;

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ 
              opacity: 1, 
              x: 0,
              scale: isActive ? 1.02 : 1
            }}
            transition={{ 
              duration: 0.3,
              delay: index * 0.1
            }}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
              isActive 
                ? 'bg-blue-100 border border-blue-300 shadow-sm' 
                : isCompleted 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-gray-50 border border-gray-200'
            }`}
          >
            <motion.div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                isActive 
                  ? 'bg-blue-500 text-white' 
                  : isCompleted 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-300 text-gray-500'
              }`}
              animate={isActive ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
            >
              {isCompleted ? (
                <CheckCircle className="h-3 w-3" />
              ) : isActive ? (
                <motion.div
                  className="w-3 h-3 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              ) : (
                <div className="w-3 h-3 bg-current rounded-full" />
              )}
            </motion.div>
            <div className="flex-1">
              <div className={`text-sm font-medium ${
                isActive ? 'text-blue-700' : isCompleted ? 'text-green-700' : 'text-gray-500'
              }`}>
                {stage}
              </div>
            </div>
            {isActive && (
              <motion.div
                className="text-xs text-blue-600"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                処理中...
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

// パルス効果付きのボタン
export const PulseButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}> = ({ children, onClick, disabled = false, className = '' }) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        disabled 
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
          : 'bg-blue-500 text-white hover:bg-blue-600'
      } ${className}`}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      <motion.div
        animate={isPressed ? { scale: 1.1 } : { scale: 1 }}
        transition={{ duration: 0.1 }}
      >
        {children}
      </motion.div>
      {!disabled && (
        <motion.div
          className="absolute inset-0 rounded-lg bg-white opacity-20"
          animate={{ scale: [1, 1.2, 1], opacity: [0, 0.3, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
};

// 成功/エラーのトースト通知
export const ToastNotification: React.FC<{
  type: 'success' | 'error' | 'info';
  message: string;
  isVisible: boolean;
  onClose: () => void;
}> = ({ type, message, isVisible, onClose }) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'info':
        return <Zap className="h-5 w-5 text-blue-500" />;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`fixed bottom-4 right-4 p-4 rounded-lg border shadow-lg ${getColor()} z-50`}
        >
          <div className="flex items-center gap-3">
            {getIcon()}
            <span className="font-medium">{message}</span>
            <button
              onClick={onClose}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
