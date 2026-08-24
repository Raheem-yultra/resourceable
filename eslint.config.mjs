import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// Flat config, required since ESLint 9 / Next 16 — which also removed `next lint`,
// so the `lint` script calls the ESLint CLI directly now.
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',

      // Catches stale-closure bugs. Kept as a warning because the remaining
      // intentional exception (a mount-only effect) is marked inline.
      'react-hooks/exhaustive-deps': 'warn',

      // Back at error (its eslint-config-next default) now that every site is
      // fixed. The one remaining exception is marked inline in BrowseExperience,
      // where the rule cannot see past an async useCallback.
      'react-hooks/set-state-in-effect': 'error',
    },
  },
];

export default config;
