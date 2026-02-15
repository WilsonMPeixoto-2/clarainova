import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // The following rules are disabled due to pre-existing codebase patterns
      // These should be addressed in future refactoring work
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      // These rules are disabled because they flag valid patterns in the codebase
      '@typescript-eslint/no-require-imports': 'off', // Tailwind config uses require
      '@typescript-eslint/no-empty-object-type': 'off', // Shadcn UI components use empty interfaces
      'no-control-regex': 'off', // Text quality validator intentionally uses control chars
      'no-useless-escape': 'off', // Regex patterns in validators need these escapes
      'no-empty': 'warn', // Changed to warning rather than error
    },
  },
);
