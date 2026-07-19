import { execSync } from 'child_process';
import { existsSync, cpSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const seaDir = resolve(root, 'build/.sea');
const platform = process.platform;
const binaryName = platform === 'win32' ? 'frontnx.exe' : 'frontnx';
const outputName = `build/${binaryName}`;

execSync(`mkdir -p ${seaDir}`, { cwd: root });

// 1. Bundle Nitro server with esbuild
console.log('[sea] Bundling server with esbuild...');
execSync(
  `npx esbuild build/server/index.mjs --bundle --platform=node --format=cjs --log-level=error --outfile=${seaDir}/bundle.cjs`,
  { cwd: root, stdio: 'inherit' }
);

// 2. Fix _importMeta_ and prepend dotenv loader
console.log('[sea] Fixing _importMeta_ and prepending dotenv loader...');
let bundle = readFileSync(resolve(seaDir, 'bundle.cjs'), 'utf8');
// Remove unconditional _importMeta_ assignments from CJS shims
bundle = bundle.replace(
  /globalThis\._importMeta_\s*=\s*\{ url:\s*(?:import\.meta\.url|import_meta\d*\.url).*?\};?\n?/g,
  ''
);
// Fix asset paths: bundled from build/server/ so paths use ../public/
// but in the SEA binary public/ sits alongside the binary, not one level up
bundle = bundle.replace(/"\.\.\/public\//g, '"public/');
const loader = readFileSync(resolve(root, 'scripts/dotenv-loader.cjs'), 'utf8');
writeFileSync(resolve(seaDir, 'app.cjs'), loader + '\n' + bundle);
rmSync(resolve(seaDir, 'bundle.cjs'));

// 3. Generate SEA blob
console.log('[sea] Generating SEA blob...');
execSync(`node --experimental-sea-config sea-config.json`, { cwd: root, stdio: 'inherit' });

// 4. Copy Node.js binary and inject blob
console.log('[sea] Injecting blob into Node.js binary...');
const whichCmd = process.platform === 'win32' ? 'where node' : 'command -v node';
const nodePath = execSync(whichCmd, { encoding: 'utf8' }).trim();
cpSync(nodePath, resolve(root, outputName));
execSync(
  `npx postject ${outputName} NODE_SEA_BLOB ${seaDir}/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 2>/dev/null`,
  { cwd: root, stdio: 'inherit' }
);

// 5. Clean up
rmSync(resolve(seaDir, 'sea-prep.blob'));

console.log(`\n[sea] Done! Created ./${outputName}`);
console.log(`[sea] Distribute alongside: .env  (public/ is already inside build/)`);
