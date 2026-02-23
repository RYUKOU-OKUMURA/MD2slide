import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // テスト環境
    environment: 'jsdom',

    // グローバルtest関数を有効化
    globals: true,

    // テストファイルのパターン
    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    // 除外パターン
    exclude: ['node_modules', 'dist', '.next', 'build'],

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '.next/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        'coverage/**',
      ],
    },

    // セットアップファイル（必要に応じて作成）
    setupFiles: ['./src/test/setup.ts'],

    // 並列実行
    pool: 'threads',
  },
});
