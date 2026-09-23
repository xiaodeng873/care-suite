// 打包 printUtils 做 browser IIFE 供測試用
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
esbuild.build({
  entryPoints: [path.resolve(__dirname, '../apps/web/src/utils/printUtils.ts')],
  bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'PrintUtils',
  define: { 'import.meta.env.BASE_URL': "'/'" },
}).then((r) => {
  fs.writeFileSync(path.resolve(__dirname, 'pu-bundle.js'), r.outputFiles[0].text);
  console.log('bundled', r.outputFiles[0].text.length);
});
