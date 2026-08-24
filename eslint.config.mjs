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

      // Catches stale-closure bugs. The three sites it currently reports were each
      // checked by hand and read only values already in their dependency array.
      'react-hooks/exhaustive-deps': 'warn',

      // A React Compiler rule, new in eslint-config-next 16 and error-by-default.
      // It fires on 15 pre-existing sites, almost all the same shape: an effect on
      // mount calls a loader that flips `setLoading(true)` before awaiting. The
      // pattern is sound but does cost one extra render.
      //
      // Downgraded rather than silenced, and deliberately NOT fixed here: undoing it
      // properly means moving those components onto a real data-fetching approach
      // (Suspense + `use`, or a query library), which is its own change and does not
      // belong inside a framework upgrade where it would be impossible to review.
      // Left visible so it stays on the list.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default config;
