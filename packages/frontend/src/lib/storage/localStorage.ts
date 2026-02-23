/**
 * LocalStorage操作のカプセル化
 * SSR対応、エラーハンドリング含む
 */

export const STORAGE_KEYS = {
  MARKDOWN: 'md2slide_markdown',
  SPLIT_PANE_WIDTH: 'md2slide_split_width',
  SELECTED_FOLDER: 'md2slide_selected_folder',
  // 将来用: SETTINGS, DOCUMENTS等
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * ブラウザ環境でLocalStorageが利用可能かチェック
 */
function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const testKey = '__md2slide_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * LocalStorageから値を取得
 * @param key - ストレージキー
 * @returns 保存された値、または null
 */
export function getItem(key: StorageKey): string | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.error(`[LocalStorage] Failed to get item "${key}":`, error);
    return null;
  }
}

/**
 * LocalStorageに値を保存
 * @param key - ストレージキー
 * @param value - 保存する値
 * @throws QuotaExceededError - ストレージ容量超過時
 */
export function setItem(key: StorageKey, value: string): void {
  if (!isLocalStorageAvailable()) {
    console.warn('[LocalStorage] LocalStorage is not available');
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('[LocalStorage] Storage quota exceeded');
      throw new Error('Storage quota exceeded. Please clear some data.');
    }
    console.error(`[LocalStorage] Failed to set item "${key}":`, error);
    throw error;
  }
}

/**
 * LocalStorageから値を削除
 * @param key - ストレージキー
 */
export function removeItem(key: StorageKey): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error(`[LocalStorage] Failed to remove item "${key}":`, error);
  }
}

// ============================================
// マークダウン関連の操作
// ============================================

/**
 * マークダウンコンテンツを保存
 * @param content - マークダウンテキスト
 */
export function saveMarkdown(content: string): void {
  setItem(STORAGE_KEYS.MARKDOWN, content);
}

/**
 * マークダウンコンテンツを読み込み
 * @returns 保存されたマークダウン、または null
 */
export function loadMarkdown(): string | null {
  return getItem(STORAGE_KEYS.MARKDOWN);
}

// ============================================
// スプリットペイン幅の操作
// ============================================

/**
 * スプリットペインの左パネル幅を保存
 * @param width - 幅（パーセント）
 */
export function saveSplitPaneWidth(width: number): void {
  setItem(STORAGE_KEYS.SPLIT_PANE_WIDTH, String(width));
}

/**
 * スプリットペインの左パネル幅を読み込み
 * @returns 保存された幅（パーセント）、または null
 */
export function loadSplitPaneWidth(): number | null {
  const value = getItem(STORAGE_KEYS.SPLIT_PANE_WIDTH);
  if (value === null) {
    return null;
  }

  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return null;
  }

  return parsed;
}
