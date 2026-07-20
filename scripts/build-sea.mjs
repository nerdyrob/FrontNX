import { execSync } from 'child_process';
import { existsSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const seaDir = resolve(root, 'build/.sea');
const platform = process.platform;
const binaryName = platform === 'win32' ? 'frontnx.exe' : 'frontnx';
const outputName = `build/${binaryName}`;

mkdirSync(seaDir, { recursive: true });

// 1. Bundle Nitro server with esbuild
console.log('[sea] Bundling server with esbuild...');
execSync(
  `npx esbuild build/server/index.mjs --bundle --platform=node --format=cjs --log-level=error --outfile=${seaDir}/bundle.cjs`,
  { cwd: root, stdio: 'inherit' }
);

// 2. Fix _importMeta_ and prepend dotenv loader
console.log('[sea] Fixing _importMeta_ and prepending dotenv loader...');
let bundle = readFileSync(resolve(seaDir, 'bundle.cjs'), 'utf8');
// Fix CJS shims: esbuild initializes import_meta to {} for ESM modules,
// but that makes import_meta.url undefined. Point them at the real value.
bundle = bundle.replace(
  /\b(import_meta\d*)\s*=\s*\{\};?\n?/g,
  '$1 = globalThis._importMeta_;\n'
);

// css-tree ESM source uses createRequire(import.meta.url) to load JSON files.
// esbuild bundles the JSON but createRequire does a filesystem lookup at runtime
// inside a SEA binary. Replace with direct calls to the already-bundled modules.
bundle = bundle.replace(
  /import_module\d* = require\("module"\);\n\s*import_meta\d* = globalThis\._importMeta_;\n\s*require\d* = \(0, import_module\d*\.createRequire\)\(import_meta\d*\.url\);\n\s*patch = require\d*\("\.\.\/data\/patch\.json"\);\n\s*data_patch_default = patch;/,
  'patch = require_patch();\ndata_patch_default = patch;'
);
bundle = bundle.replace(
  /import_module\d* = require\("module"\);\n\s*init_data_patch\(\);\n\s*import_meta\d* = globalThis\._importMeta_;\n\s*require\d* = \(0, import_module\d*\.createRequire\)\(import_meta\d*\.url\);\n\s*mdnAtrules = require\d*\("mdn-data\/css\/at-rules\.json"\);\n\s*mdnProperties = require\d*\("mdn-data\/css\/properties\.json"\);\n\s*mdnSyntaxes = require\d*\("mdn-data\/css\/syntaxes\.json"\);/,
  'init_data_patch();\nmdnAtrules = require_at_rules();\nmdnProperties = require_properties();\nmdnSyntaxes = require_syntaxes();'
);
bundle = bundle.replace(
  /import_module\d* = require\("module"\);\n\s*import_meta\d* = globalThis\._importMeta_;\n\s*require\d* = \(0, import_module\d*\.createRequire\)\(import_meta\d*\.url\);\n\s*\(\{ version \} = require\d*\("\.\.\/package\.json"\)\);/,
  '({ version } = require_package());'
);
// Fix asset paths: bundled from build/server/ so paths use ../public/
// but in the SEA binary public/ sits alongside the binary, not one level up
bundle = bundle.replace(/"\.\.\/public\//g, '"public/');

// Replace require.resolve in jsdom's XMLHttpRequest-impl — the esbuild bundle's
// require function doesn't expose .resolve(). Use __dirname instead, and copy
// xhr-sync-worker.js alongside the binary.
bundle = bundle.replace(
  /var syncWorkerFile = require\.resolve\("\.\/xhr-sync-worker\.js"\)/,
  'var syncWorkerFile = __dirname + "/xhr-sync-worker.js"'
);

// Copy xhr-sync-worker.js alongside the binary (needed by jsdom for sync XHR)
const xhrSyncWorkerSrc = resolve(root, 'node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js');
const xhrSyncWorkerDest = resolve(root, 'build/xhr-sync-worker.js');
if (existsSync(xhrSyncWorkerSrc)) {
  cpSync(xhrSyncWorkerSrc, xhrSyncWorkerDest);
  console.log(`[sea] Copied xhr-sync-worker.js to build/`);
}

// Inline jsdom's default-stylesheet.css into the bundle to avoid ENOENT at runtime
const jsdomCssPath = resolve(root, 'node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css');
if (existsSync(jsdomCssPath)) {
  const jsdomCss = readFileSync(jsdomCssPath, 'utf8');
  bundle = bundle.replace(
    /(?:var|let|const)\s+defaultStyleSheet\s*=\s*\w+\.readFileSync\s*\(\s*(?:\w+\.resolve\s*\(\s*__dirname\s*,\s*["\'][^"\']*default-stylesheet\.css["\']\s*\))\s*,\s*\{[^}]*\}\s*\)\s*;?\n?/,
    `var defaultStyleSheet = ${JSON.stringify(jsdomCss)};\n`
  );
}

const loader = readFileSync(resolve(root, 'scripts/dotenv-loader.cjs'), 'utf8');
writeFileSync(resolve(seaDir, 'app.cjs'), loader + '\n' + bundle);
rmSync(resolve(seaDir, 'bundle.cjs'));

// 3. Generate SEA blob
console.log('[sea] Generating SEA blob...');
execSync(`node --experimental-sea-config sea-config.json`, { cwd: root, stdio: 'inherit' });

// 4. Copy Node.js binary and inject blob
console.log('[sea] Injecting blob into Node.js binary...');
const nodePath = process.execPath;
cpSync(nodePath, resolve(root, outputName));
const nullDevice = process.platform === 'win32' ? '2>nul' : '2>/dev/null';
execSync(
  `npx postject ${outputName} NODE_SEA_BLOB ${seaDir}/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 ${nullDevice}`,
  { cwd: root, stdio: 'inherit' }
);

// 5. Clean up
rmSync(resolve(seaDir, 'sea-prep.blob'));

console.log(`\n[sea] Done! Created ./${outputName}`);
console.log(`[sea] Distribute alongside: .env  (public/ is already inside build/)`);
console.log(`[sea] Also distribute: xhr-sync-worker.js (in the same directory as the binary)`);
