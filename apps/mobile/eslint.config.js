// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*']),
  expoConfig,
  {
    settings: {
      // Some Expo packages (e.g. expo-image-picker) ship a TypeScript
      // entry point as their package "main"; without .ts/.tsx here the
      // import resolver reports them as unresolved.
      'import/resolver': {
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
    },
  },
]);
