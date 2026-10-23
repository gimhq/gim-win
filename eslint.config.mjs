import antfu from '@antfu/eslint-config'

export default antfu(
  {
    react: true,
    typescript: true,
    ignores: [
      'src/app/routeTree.gen.ts',
      'src-tauri/**',
      'dist/**',
      'node_modules/**',
    ],
  },
  {
    // TanStack Router route files export the `Route` object and keep the
    // component local; the router plugin handles fast refresh for them.
    files: ['src/app/routes/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // shadcn primitives export their cva variants alongside the component.
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
)
