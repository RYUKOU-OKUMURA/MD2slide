/**
 * Folder ID storage utilities
 * Manages the selected Google Drive folder for exports
 */

import { getItem, setItem, removeItem, STORAGE_KEYS } from './localStorage';

/**
 * Selected folder data structure
 */
export interface SelectedFolder {
  /** Google Drive folder ID */
  folderId: string;
  /** Display name of the folder */
  folderName: string;
}

/**
 * Save the selected folder to localStorage
 * @param folderId - Google Drive folder ID
 * @param folderName - Display name of the folder
 */
export function saveSelectedFolder(folderId: string, folderName: string): void {
  const folderData: SelectedFolder = {
    folderId,
    folderName,
  };

  try {
    setItem(STORAGE_KEYS.SELECTED_FOLDER, JSON.stringify(folderData));
  } catch (error) {
    console.error('[FolderStorage] Failed to save folder:', error);
    throw error;
  }
}

/**
 * Load the selected folder from localStorage
 * @returns The saved folder data, or null if not set
 */
export function loadSelectedFolder(): SelectedFolder | null {
  try {
    const stored = getItem(STORAGE_KEYS.SELECTED_FOLDER);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as unknown;

    // Validate the parsed data
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('folderId' in parsed) ||
      !('folderName' in parsed) ||
      typeof (parsed as SelectedFolder).folderId !== 'string' ||
      typeof (parsed as SelectedFolder).folderName !== 'string'
    ) {
      console.warn('[FolderStorage] Invalid stored folder data, clearing');
      clearSelectedFolder();
      return null;
    }

    return parsed as SelectedFolder;
  } catch (error) {
    console.error('[FolderStorage] Failed to load folder:', error);
    return null;
  }
}

/**
 * Clear the selected folder from localStorage
 */
export function clearSelectedFolder(): void {
  try {
    removeItem(STORAGE_KEYS.SELECTED_FOLDER);
  } catch (error) {
    console.error('[FolderStorage] Failed to clear folder:', error);
  }
}
