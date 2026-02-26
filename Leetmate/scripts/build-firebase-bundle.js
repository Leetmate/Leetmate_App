// Build a local Firebase bundle for extension pages using esbuild.
// This avoids loading scripts from https://www.gstatic.com, which MV3 CSP blocks.
const esbuild = require('esbuild');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

esbuild
  .build({
    entryPoints: [path.join(ROOT, 'firebase-entry.js')],
    bundle: true,
    outfile: path.join(ROOT, 'firebase-bundle.js'),
    format: 'iife',
    sourcemap: false,
    minify: true
  })
  .then(() => {
    console.log('Built firebase-bundle.js');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

