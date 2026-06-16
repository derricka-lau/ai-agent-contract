#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const [fragmentPath, targetPath] = process.argv.slice(2);

if (!fragmentPath || !targetPath) {
  console.error('Usage: node scripts/merge-vscode-settings.js <fragment.json> <target settings.json>');
  process.exit(1);
}

const fragment = JSON.parse(fs.readFileSync(fragmentPath, 'utf8'));

let current = {};
if (fs.existsSync(targetPath)) {
  const raw = fs.readFileSync(targetPath, 'utf8').trim();
  if (raw) {
    try {
      current = JSON.parse(raw);
    } catch (error) {
      console.warn(`Skipping merge: ${targetPath} is not plain JSON (it may contain comments).`);
      console.warn(`Add this manually: ${JSON.stringify(fragment)}`);
      process.exit(0);
    }
  }
}

const merged = { ...current, ...fragment };

if (JSON.stringify(current) === JSON.stringify(merged)) {
  console.log(`${targetPath} already has the required settings.`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`);
console.log(`Merged settings into ${targetPath}.`);
