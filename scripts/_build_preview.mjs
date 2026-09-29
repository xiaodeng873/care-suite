import { build } from 'esbuild';
import path from 'node:path';

const entry = process.argv[2] || 'scripts/_diaper_preview.mjs';
const outfile = process.argv[3] || 'scripts/_diaper_preview.bundle.mjs';
const platform = process.argv[4] || 'node';

await build({
  entryPoints: [entry],
  bundle: true,
  platform,
  format: 'esm',
  outfile,
  loader: { '.ts': 'ts', '.tsx': 'ts', '.mjs': 'ts' },
  define: { 'import.meta.env': '{"BASE_URL":"/"}', 'import.meta.env.BASE_URL': '"/"' },
  plugins: [{
    name: 'stub-supabase',
    setup(b) {
      b.onResolve({ filter: /\/supabase$/ }, () => ({
        path: path.resolve('scripts/_supabase_stub.mjs'),
      }));
    },
  }],
});
console.log('bundled');
