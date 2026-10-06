// Cloudflare Pages hardcodes an exclusion for any folder literally named
// "node_modules" when publishing static assets, with no way to override it
// (see https://developers.cloudflare.com/pages/platform/known-issues/). Metro's
// web export puts vector-icon fonts (and any other node_modules-sourced
// asset) under dist/assets/node_modules/..., so Cloudflare silently drops
// those files and falls back to serving index.html for their URLs (200 OK,
// wrong content) -- that's why icons render as empty boxes in production.
// This renames that folder after the export and rewrites every reference to
// it across the built output, so the deployed site never has a path segment
// literally named "node_modules".
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const FROM = 'assets/node_modules';
const TO = 'assets/vendor_modules';
const TEXT_EXTENSIONS = new Set(['.js', '.html', '.css', '.json']);

function walk(dir, onFile) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, onFile);
    else onFile(full);
  }
}

const fromDir = path.join(DIST_DIR, 'assets', 'node_modules');
const toDir = path.join(DIST_DIR, 'assets', 'vendor_modules');

if (!fs.existsSync(fromDir)) {
  console.log(`[fix-cf-pages-assets] ${fromDir} not found, nothing to do.`);
  process.exit(0);
}

fs.renameSync(fromDir, toDir);

let filesEdited = 0;
walk(DIST_DIR, (file) => {
  if (!TEXT_EXTENSIONS.has(path.extname(file))) return;
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(FROM)) return;
  fs.writeFileSync(file, text.split(FROM).join(TO));
  filesEdited += 1;
});

console.log(`[fix-cf-pages-assets] Renamed ${fromDir} -> ${toDir}, rewrote ${filesEdited} file(s).`);
