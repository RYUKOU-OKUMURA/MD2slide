'use client';

import { useState, useEffect, useCallback } from 'react';
import { getItem, setItem, removeItem, StorageKey } from '@/lib/storage/localStorage';

/**
 * 汎用LocalStorageフック
 * SSR対応、ジェネリクス対応
 *
 * @param key - ストレージキー
 * @param initialValue - 初期値
 * @returns [値, セッター関数]
 */
export function useLocalStorage<T>(
  key: StorageKey,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // 初期値を設定（SSR時はinitialValueを使用）
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // クライアントサイドでLocalStorageから復元
  useEffect(() => {
    const item = getItem(key);
    if (item !== null) {
      try {
        const parsed = JSON.parse(item) as T;
        setStoredValue(parsed);
      } catch {
        // JSONパースに失敗した場合は初期値を使用
        console.warn(`[useLocalStorage] Failed to parse stored value for "${key}"`);
      }
    }
    setIsHydrated(true);
  }, [key]);

  // 値を設定してLocalStorageに保存
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prevValue) => {
        const newValue = value instanceof Function ? value(prevValue) : value;

        // LocalStorageに保存（クライアントサイドのみ）
        if (typeof window !== 'undefined') {
          try {
            setItem(key, JSON.stringify(newValue));
          } catch (error) {
            console.error(`[useLocalStorage] Failed to save "${key}":`, error);
            // エラー時は値をロールバックしない（UIの状態は維持）
          }
        }

        return newValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}

/**
 * LocalStorageから値を削除するフック
 *
 * @param key - ストレージキー
 * @returns 削除関数
 */
export function useRemoveLocalStorage(key: StorageKey): () => void {
  return useCallback(() => {
    removeItem(key);
  }, [key]);
}
