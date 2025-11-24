import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/e2e/**',
        '**/*.d.ts',
        'src/extension.ts', // Extension entry point - hard to test
        'src/commands/**', // Commands - require VS Code API mocking
        'src/views/**', // Views - require VS Code Webview API mocking
      ],
    },
  },
});


