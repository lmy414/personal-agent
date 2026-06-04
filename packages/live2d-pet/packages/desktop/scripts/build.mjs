import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { buildSync } from 'esbuild'

// ── Bundle main process (main.ts → main.cjs) ──
// settings.ts is inlined via import; electron/ws remain external
buildSync({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/main.cjs',
  external: ['electron', 'ws'],
  banner: {
    js: 'var __import_meta_url = require("url").pathToFileURL(__filename).href;',
  },
  define: {
    'import.meta.url': '__import_meta_url',
  },
})

// Ensure directories
const dirs = ['dist/renderer', 'dist/vendor']
for (const d of dirs) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
}

// Copy static files
cpSync('src/preload.js', 'dist/preload.cjs')
cpSync('src/settings-preload.js', 'dist/settings-preload.cjs')
cpSync('src/renderer/index.html', 'dist/renderer/index.html')
cpSync('src/renderer/app.js', 'dist/renderer/app.js')
cpSync('src/renderer/settings.html', 'dist/renderer/settings.html')
cpSync('src/renderer/settings.js', 'dist/renderer/settings.js')

// Copy vendor files (SDK scripts required at runtime)
if (!existsSync('dist/vendor')) mkdirSync('dist/vendor', { recursive: true })
if (existsSync('src/vendor')) {
  const vendorFiles = ['pixi.min.js', 'live2dcubismcore.min.js', 'cubism4.min.js']
  for (const f of vendorFiles) {
    const src = `src/vendor/${f}`
    if (existsSync(src)) cpSync(src, `dist/vendor/${f}`)
  }
}

console.log('build OK')
