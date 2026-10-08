/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '../messages');
const enPath = path.join(messagesDir, 'en.json');
const locales = ['es', 'ko', 'pt'];

const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function syncKeys(target, source) {
  let modified = false;

  // Remove orphaned keys
  for (const key of Object.keys(target)) {
    if (!source.hasOwnProperty(key)) {
      delete target[key];
      modified = true;
    }
  }

  // Add missing keys & recurse
  for (const key of Object.keys(source)) {
    if (!target.hasOwnProperty(key)) {
      target[key] = source[key];
      modified = true;
    } else if (typeof source[key] === 'object' && source[key] !== null) {
      if (typeof target[key] !== 'object' || target[key] === null) {
        target[key] = source[key];
        modified = true;
      } else {
        const childModified = syncKeys(target[key], source[key]);
        if (childModified) modified = true;
      }
    }
  }

  return modified;
}

for (const locale of locales) {
  const filePath = path.join(messagesDir, `${locale}.json`);
  if (!fs.existsSync(filePath)) continue;

  const targetData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const changed = syncKeys(targetData, enData);

  if (changed) {
    fs.writeFileSync(
      filePath,
      JSON.stringify(targetData, null, 2) + '\n',
      'utf8'
    );
    console.log(`Synced ${locale}.json`);
  } else {
    console.log(`${locale}.json is already in sync`);
  }
}
