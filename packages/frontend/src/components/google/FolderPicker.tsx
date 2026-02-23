'use client';

import { useState, useCallback } from 'react';
import {
  loadGooglePickerApi,
  isPickerApiReady,
  type GooglePickerResponse,
  type GooglePickerDocument,
} from '@/lib/google/pickerLoader';

/**
 * FolderPicker component props
 */
export interface FolderPickerProps {
  /** Callback when a folder is selected */
  onFolderSelect: (folderId: string, folderName: string) => void;
  /** Google OAuth2 access token */
  accessToken: string;
  /** Google API key (for Picker API) */
  apiKey?: string;
  /** Whether the picker button is disabled */
  disabled?: boolean;
  /** Currently selected folder name (for display) */
  currentFolderName?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Google Drive folder picker component
 *
 * Opens a Google Picker dialog for selecting a Drive folder.
 * Uses the Google Picker API for folder selection.
 */
export function FolderPicker({
  onFolderSelect,
  accessToken,
  apiKey = '',
  disabled = false,
  currentFolderName,
  className = '',
}: FolderPickerProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle picker button click
   */
  const handleClick = useCallback(async () => {
    if (disabled || isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      // Load Picker API if not ready
      if (!isPickerApiReady()) {
        await loadGooglePickerApi();
      }

      const picker = window.google?.picker;
      if (!picker) {
        throw new Error('Google Picker API not available');
      }

      // Create DocsView for folder selection
      const docsView = new picker.DocsView(picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);

      // Build the picker
      const pickerBuilder = new picker.PickerBuilder()
        .addView(docsView)
        .enableFeature(picker.Feature.NAV_HIDDEN)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setCallback((data: GooglePickerResponse) => {
          handlePickerCallback(data, picker!.Action, onFolderSelect, setError);
        })
        .setTitle('Select Export Folder');

      const pickerInstance = pickerBuilder.build();
      pickerInstance.setVisible(true);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to open folder picker';
      console.error('[FolderPicker] Error:', errorMessage);
      setError(errorMessage);
    }
  }, [accessToken, apiKey, disabled, isLoading, onFolderSelect]);

  return (
    <div className={`folder-picker ${className}`} data-testid="folder-picker">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={`
          inline-flex items-center gap-2 px-4 py-2
          text-sm font-medium rounded-md
          transition-colors duration-200
          ${
            disabled || isLoading
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100'
          }
        `}
        data-testid="folder-picker-button"
      >
        {/* Folder icon */}
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>

        {isLoading ? (
          <span>Loading...</span>
        ) : currentFolderName ? (
          <span>{currentFolderName}</span>
        ) : (
          <span>Select Folder</span>
        )}
      </button>

      {/* Error message */}
      {error && (
        <p className="mt-2 text-sm text-red-600" data-testid="folder-picker-error">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Handle picker callback
 */
function handlePickerCallback(
  data: GooglePickerResponse,
  action: { CANCEL: number; PICKED: number },
  onFolderSelect: (folderId: string, folderName: string) => void,
  setError: (error: string | null) => void
): void {
  if (data.action === action.PICKED) {
    const docs = data.docs;
    if (docs && docs.length > 0) {
      const selectedDoc: GooglePickerDocument = docs[0];

      // Verify it's a folder
      if (
        selectedDoc.mimeType === 'application/vnd.google-apps.folder' ||
        selectedDoc.mimeType === 'folder'
      ) {
        onFolderSelect(selectedDoc.id, selectedDoc.name);
        setError(null);
      } else {
        setError('Please select a folder, not a file');
      }
    }
  } else if (data.action === action.CANCEL) {
    // User cancelled - do nothing
    setError(null);
  }
}

export default FolderPicker;
