'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { saveMarkdown, loadMarkdown } from '@/lib/storage/localStorage';

export type SaveStatus = 'saved' | 'saving' | 'error' | 'idle';

interface UseAutoSaveOptions {
  /** デバウンス時間（ミリ秒）、デフォルト3000ms */
  debounceMs?: number;
  /** 初期コンテンツ */
  initialContent?: string;
  /** 保存エラー時のコールバック */
  onError?: (error: Error) => void;
  /** 保存成功時のコールバック */
  onSave?: () => void;
}

interface UseAutoSaveReturn {
  /** 現在のコンテンツ */
  content: string;
  /** コンテンツを更新 */
  setContent: (content: string) => void;
  /** 保存状態 */
  saveStatus: SaveStatus;
  /** 手動保存 */
  save: () => void;
  /** エラーメッセージ */
  errorMessage: string | null;
  /** 初期化完了フラグ */
  isInitialized: boolean;
}

/**
 * 自動保存フック
 * - 3秒デバウンスで自動保存
 * - 保存状態表示（saved, saving, error）
 * - 初期化時にLocalStorageから復元
 *
 * @param options - 設定オプション
 * @returns 自動保存の状態と操作
 */
export function useAutoSave(options: UseAutoSaveOptions = {}): UseAutoSaveReturn {
  const { debounceMs = 3000, initialContent = '', onError, onSave } = options;

  const [content, setContentState] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>('');

  // 初期化：LocalStorageから復元
  useEffect(() => {
    const savedContent = loadMarkdown();
    if (savedContent !== null) {
      setContentState(savedContent);
      lastSavedContentRef.current = savedContent;
    }
    setIsInitialized(true);
  }, []);

  // 実際の保存処理
  const performSave = useCallback(
    (contentToSave: string) => {
      // 変更がない場合はスキップ
      if (contentToSave === lastSavedContentRef.current) {
        setSaveStatus('saved');
        return;
      }

      setSaveStatus('saving');
      setErrorMessage(null);

      try {
        saveMarkdown(contentToSave);
        lastSavedContentRef.current = contentToSave;
        setSaveStatus('saved');
        onSave?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setSaveStatus('error');
        setErrorMessage(err.message);
        onError?.(err);
      }
    },
    [onError, onSave]
  );

  // コンテンツ更新とデバウンス保存
  const setContent = useCallback(
    (newContent: string) => {
      setContentState(newContent);
      setSaveStatus('idle');

      // 既存のタイマーをクリア
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // デバウンス保存をスケジュール
      debounceTimerRef.current = setTimeout(() => {
        performSave(newContent);
      }, debounceMs);
    },
    [debounceMs, performSave]
  );

  // 手動保存
  const save = useCallback(() => {
    // デバウンスタイマーをクリア
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    performSave(content);
  }, [content, performSave]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    content,
    setContent,
    saveStatus,
    save,
    errorMessage,
    isInitialized,
  };
}
