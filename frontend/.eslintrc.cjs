module.exports = {
  env: { browser: true, es2022: true, node: true },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react', 'react-hooks'],
  settings: { react: { version: 'detect' } },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    // Keep framework-specific noise low while retaining the core correctness
    // checks that catch undefined names, unused values, and hook mistakes.
    'no-irregular-whitespace': 'off',
    'react/no-unescaped-entities': 'off',
  },
};
