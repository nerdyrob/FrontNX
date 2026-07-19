{
const fs = require('fs');
const path = require('path');
try {
  const p = path.resolve('.env');
  const c = fs.readFileSync(p, 'utf8');
  for (const line of c.split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#') && t.includes('=')) {
      const i = t.indexOf('=');
      const k = t.slice(0, i).trim();
      if (k && !process.env[k]) {
        let v = t.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
          v = v.slice(1, -1);
        process.env[k] = v;
      }
    }
  }
} catch {}
globalThis._importMeta_ = { url: 'file://' + __filename, env: process.env };
const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';
const url = `http://${host}:${port}`;
setTimeout(() => {
  const { execSync } = require('child_process');
  try {
    execSync(`xdg-open "${url}" 2>/dev/null || open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || true`, { stdio: 'ignore', timeout: 5000 });
  } catch {}
}, 2000);
}
