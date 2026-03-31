#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');

const textFiles = [
  ['index.html', 'html'],
  ['styles.css', 'css'],
  ['app.js', 'js'],
  ['manifest.webmanifest', 'json'],
  ['service-worker.js', 'js'],
];

const assetFiles = ['icon-192.svg', 'icon-512.svg'];

function ensureCleanDist() {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
}

function minifyCss(css) {
  return css
    .replace(/\/\*[^]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

function minifyJs(js) {
  return js
    .replace(/\/\/[^\n\r]*/g, '')
    .replace(/\n+/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*([{}();,:+\-*/=<>&|!?])\s*/g, '$1')
    .trim();
}

function minifyHtml(html) {
  return html
    .replace(/<!--[^]*?-->/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

function minify(file, type) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  if (type === 'css') return minifyCss(src);
  if (type === 'js') return minifyJs(src);
  if (type === 'html') return minifyHtml(src);
  if (type === 'json') return JSON.stringify(JSON.parse(src));
  return src;
}

ensureCleanDist();

for (const [file, type] of textFiles) {
  fs.writeFileSync(path.join(distDir, file), minify(file, type), 'utf8');
}

for (const file of assetFiles) {
  fs.copyFileSync(path.join(root, file), path.join(distDir, file));
}

console.log('Build complete. Production files generated in ./dist');
