/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../messages');
const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf-8'));
const locales = ['es', 'ko', 'pt'];

function syncObject(source, target) {
  const result = {};
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      result[key] = syncObject(source[key], target[key] || {});
    } else {
      result[key] = target[key] !== undefined ? target[key] : source[key];
    }
  }
  return result;
}

locales.forEach((locale) => {
  const file = path.join(dir, `${locale}.json`);
  let current = {};
  if (fs.existsSync(file)) {
    current = JSON.parse(fs.readFileSync(file, 'utf-8'));
  }
  
  const synced = syncObject(en, current);
  fs.writeFileSync(file, JSON.stringify(synced, null, 2) + '\n');
  console.log(`✅ Synced missing/orphaned keys to ${locale}.json`);
});
