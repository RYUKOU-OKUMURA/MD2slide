/**
 * Google Picker API loader
 * Dynamically loads the Google Picker API script and provides access to the picker functionality
 */

// Type declarations for Google Picker API

/**
 * Google Picker interface
 */
export interface GooglePicker {
  PickerBuilder: GooglePickerBuilderConstructor;
  DocsView: GoogleDocsViewConstructor;
  ViewId: GooglePickerViewId;
  Feature: GooglePickerFeature;
  Action: GooglePickerAction;
}

/**
 * Picker instance returned by builder
 */
export interface GooglePickerInstance {
  setVisible(visible: boolean): void;
}

/**
 * Picker builder constructor
 */
export interface GooglePickerBuilderConstructor {
  new (): GooglePickerBuilder;
}

/**
 * Picker builder interface
 */
export interface GooglePickerBuilder {
  enableFeature(feature: number): GooglePickerBuilder;
  addView(view: GoogleView): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setCallback(callback: (data: GooglePickerResponse) => void): GooglePickerBuilder;
  setTitle(title: string): GooglePickerBuilder;
  build(): GooglePickerInstance;
}

/**
 * Base view interface
 */
export interface GoogleView {
  setMimeTypes(mimeTypes: string): GoogleView;
  setQuery(query: string): GoogleView;
  setMode(mode: number): GoogleView;
}

/**
 * DocsView constructor
 */
export interface GoogleDocsViewConstructor {
  new (viewId?: number): GoogleDocsView;
}

/**
 * DocsView interface for folder selection
 */
export interface GoogleDocsView extends GoogleView {
  setIncludeFolders(includeFolders: boolean): GoogleDocsView;
  setSelectFolderEnabled(selectFolderEnabled: boolean): GoogleDocsView;
  setParent(parent: string): GoogleDocsView;
}

/**
 * Picker response object
 */
export interface GooglePickerResponse {
  action: number;
  viewToken?: unknown[];
  docs?: GooglePickerDocument[];
  tokens?: GooglePickerToken[];
}

/**
 * Document object in picker response
 */
export interface GooglePickerDocument {
  id: string;
  name: string;
  description?: string;
  mimeType: string;
  url?: string;
  iconUrl?: string;
  sizeBytes?: number;
  lastEditedUtc?: number;
  parentId?: string;
}

/**
 * Token object in picker response
 */
export interface GooglePickerToken {
  access_token?: string;
  error?: string;
}

/**
 * ViewId constants
 */
export interface GooglePickerViewId {
  DOCS: number;
  DOCS_IMAGES: number;
  DOCS_IMAGES_AND_VIDEOS: number;
  DOCS_VIDEOS: number;
  DOCUMENTS: number;
  DRAWINGS: number;
  FOLDERS: number;
  FORMS: number;
  PDFS: number;
  PRESENTATIONS: number;
  SPREADSHEETS: number;
}

/**
 * Feature constants
 */
export interface GooglePickerFeature {
  MINE_ONLY: number;
  NAV_HIDDEN: number;
  MULTISELECT_ENABLED: number;
  SIMPLIFIED_UPLOAD: number;
}

/**
 * Action constants
 */
export interface GooglePickerAction {
  CANCEL: number;
  PICKED: number;
  LOADED: number;
}

// Extend Window interface
declare global {
  interface Window {
    gapi?: {
      load: (api: string, config: { callback?: () => void; onerror?: () => void }) => void;
    };
    google?: {
      picker?: GooglePicker;
    };
  }
}

// Singleton state for tracking API load status
let pickerApiLoadPromise: Promise<void> | null = null;

/**
 * Load Google Picker API script dynamically
 * Returns a Promise that resolves when gapi.picker is ready
 * @throws Error if script loading fails or takes too long
 */
export async function loadGooglePickerApi(): Promise<void> {
  // Return existing promise if already loading/loaded
  if (pickerApiLoadPromise) {
    return pickerApiLoadPromise;
  }

  pickerApiLoadPromise = new Promise<void>((resolve, reject) => {
    // Check if already loaded
    if (typeof window !== 'undefined' && window.google?.picker) {
      resolve();
      return;
    }

    // Check if gapi script is already present
    const existingScript = document.getElementById('google-picker-script');
    if (existingScript) {
      // Wait for existing script to load
      waitForPickerApi(resolve, reject);
      return;
    }

    // Create and inject script
    const script = document.createElement('script');
    script.id = 'google-picker-script';
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      waitForPickerApi(resolve, reject);
    };

    script.onerror = () => {
      pickerApiLoadPromise = null;
      reject(new Error('Failed to load Google Picker API script'));
    };

    document.head.appendChild(script);
  });

  return pickerApiLoadPromise;
}

/**
 * Wait for gapi.picker to be available
 */
function waitForPickerApi(resolve: () => void, reject: (error: Error) => void): void {
  const timeout = 10000; // 10 seconds timeout
  const startTime = Date.now();

  function checkApi(): void {
    // Check if window.google.picker is available
    if (typeof window !== 'undefined' && window.google?.picker) {
      resolve();
      return;
    }

    // Check timeout
    if (Date.now() - startTime > timeout) {
      pickerApiLoadPromise = null;
      reject(new Error('Timeout waiting for Google Picker API to load'));
      return;
    }

    // If gapi is available, load the picker module
    if (typeof window !== 'undefined' && window.gapi) {
      try {
        window.gapi.load('picker', {
          callback: () => {
            if (window.google?.picker) {
              resolve();
            } else {
              reject(new Error('Google Picker API loaded but not available'));
            }
          },
          onerror: () => {
            reject(new Error('Failed to load Google Picker module'));
          },
        });
        return;
      } catch {
        // Fall through to retry
      }
    }

    // Retry after a short delay
    setTimeout(checkApi, 100);
  }

  checkApi();
}

/**
 * Reset the loader state (useful for testing)
 */
export function resetPickerLoader(): void {
  pickerApiLoadPromise = null;
}

/**
 * Check if Google Picker API is loaded and ready
 */
export function isPickerApiReady(): boolean {
  return typeof window !== 'undefined' && !!window.google?.picker;
}
