import expo from 'eslint-config-expo/flat.js';

export default [
  {
    ignores: [
      'src/app/index.tsx',
      'src/app/explore.tsx',
      'src/components/animated-icon.*',
      'src/components/app-tabs.*',
      'src/components/external-link.tsx',
      'src/components/hint-row.tsx',
      'src/components/themed-*.tsx',
      'src/components/ui/**',
      'src/components/web-badge.tsx',
      'src/constants/**',
      'src/hooks/**',
    ],
  },
  ...expo,
];
