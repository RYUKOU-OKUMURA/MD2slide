import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // テスト環境（共有モジュールは軽量なjsdom）
    environment: 'jsdom',

    // グローバルtest関数を有効化
    globals: true,

    // テストファイルのパターン
    include: ['src/**/*.{test,spec}.ts', 'types/**/*.{test,spec}.ts'],

    // 除外パターン
    exclude: ['node_modules', 'dist', 'build'],

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'types/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/**',
      ],
    },

    // 並列実行
    pool: 'threads',
  },
});
