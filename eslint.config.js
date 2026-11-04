export default [
  {
    ignores: [
      'dist/vendor/**', 'dist/server/**', 'dist/.openai/**',
      'dist/cloud/client.bundle.js', 'dist/sw.js', 'dist/reading/catalog.js',
      '.generated/**', '.local/**', 'artifacts/**', 'screenshots/**',
      'test-results/**', 'playwright-report/**',
    ],
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {ecmaVersion: 'latest', sourceType: 'module'},
    rules: {
      'no-const-assign': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-unreachable': 'error',
    },
  },
];
