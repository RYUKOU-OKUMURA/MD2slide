'use client';

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { loadSplitPaneWidth, saveSplitPaneWidth } from '@/lib/storage/localStorage';

export interface SplitPaneProps {
  /** 左パネルのコンテンツ */
  left: ReactNode;
  /** 右パネルのコンテンツ */
  right: ReactNode;
  /** 左パネルのデフォルト幅（パーセント）、デフォルト50 */
  defaultLeftWidth?: number;
  /** 左パネルの最小幅（パーセント）、デフォルト30 */
  minLeftWidth?: number;
  /** 左パネルの最大幅（パーセント）、デフォルト70 */
  maxLeftWidth?: number;
  /** 追加のクラス名 */
  className?: string;
}

/**
 * リサイズ可能な水平スプリットペインコンポーネント
 * - 左: エディタ、右: プレビュー
 * - ドラッグで幅を変更可能
 * - 最小幅/最大幅制約
 * - 幅の永続化（LocalStorage）
 */
export function SplitPane({
  left,
  right,
  defaultLeftWidth = 50,
  minLeftWidth = 30,
  maxLeftWidth = 70,
  className = '',
}: SplitPaneProps) {
  // SSR対応：初期値はdefaultLeftWidth、クライアントで復元
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // 幅の制約を適用
  const clampWidth = useCallback(
    (width: number): number => {
      return Math.min(Math.max(width, minLeftWidth), maxLeftWidth);
    },
    [minLeftWidth, maxLeftWidth]
  );

  // クライアントサイドでLocalStorageから復元
  useEffect(() => {
    const savedWidth = loadSplitPaneWidth();
    if (savedWidth !== null) {
      setLeftWidth(clampWidth(savedWidth));
    }
    setIsHydrated(true);
  }, [clampWidth]);

  // 幅をLocalStorageに保存
  useEffect(() => {
    if (!isHydrated) return;
    saveSplitPaneWidth(leftWidth);
  }, [leftWidth, isHydrated]);

  // ドラッグ開始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // ドラッグ中
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(clampWidth(newWidth));
    },
    [isDragging, clampWidth]
  );

  // ドラッグ終了
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // タッチイベント対応
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging || !containerRef.current || e.touches.length === 0) return;

      const rect = containerRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      const newWidth = ((touch.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(clampWidth(newWidth));
    },
    [isDragging, clampWidth]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // グローバルイベントリスナー
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);

      // ドラッグ中はテキスト選択を無効化
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);

      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full ${className}`}
      style={{ position: 'relative' }}
    >
      {/* 左パネル（エディタ） */}
      <div
        className="h-full overflow-hidden"
        style={{ width: `${leftWidth}%` }}
      >
        {left}
      </div>

      {/* リサイズハンドル */}
      <div
        className={`
          flex-shrink-0 h-full w-1
          bg-gray-300 hover:bg-blue-500
          cursor-col-resize
          transition-colors duration-150
          ${isDragging ? 'bg-blue-500' : ''}
        `}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={leftWidth}
        aria-valuemin={minLeftWidth}
        aria-valuemax={maxLeftWidth}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            setLeftWidth((prev) => clampWidth(prev - 1));
          } else if (e.key === 'ArrowRight') {
            setLeftWidth((prev) => clampWidth(prev + 1));
          }
        }}
      />

      {/* 右パネル（プレビュー） */}
      <div
        className="h-full overflow-hidden flex-1"
      >
        {right}
      </div>
    </div>
  );
}

export default SplitPane;
