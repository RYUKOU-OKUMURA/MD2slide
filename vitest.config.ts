import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Workspace mode - 各パッケージの設定を統合
  test: {
    // グローバルtest関数を有効化
    globals: true,

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '.next/**',
        'build/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        'coverage/**',
      ],
    },

    // 並列実行
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
});
