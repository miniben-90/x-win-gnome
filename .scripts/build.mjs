#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');

const { TAG = undefined } = process.env;

const version = (TAG?.startsWith('v') ? TAG.substring(1) : TAG) ?? '0.0.0';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function loadMetadata(isGnome42 = false) {
  const metadata = require(path.join(rootDir, 'metadata.json'));
  return metadata;
}

function generateArchive(isGnome42 = false, metadata = {}) {
  log(`\n📦 Generate archive for GNOME ${isGnome42 ? '42-44' : '45-49'} ...`, colors.bright + colors.blue);
  const folderName = isGnome42 ? 'gnome-42' : 'gnome-45';
  const folderDir = path.join(packagesDir, folderName);
  const copyDir = path.join(rootDir, 'dist', folderName, 'extension.js');
  const extensionDir = path.join(folderDir, 'extension.js');
  const metadataDir = path.join(folderDir, 'metadata.json');
  if (!fs.existsSync(folderDir)) {
    fs.mkdirSync(folderDir, { recursive: true });
  }
  if (!fs.existsSync(copyDir)) {
    throw new Error(`'${copyDir}' file not found!`);
  }
  if (isGnome42) {
    rewriteImportsForGnome42(copyDir);
  }
  fs.copyFileSync(copyDir, extensionDir);

  const versions = isGnome42 ? ["42", "43", "44"] : ["45", "46", "47", "48", "49"];
  metadata['shell-version'] = versions;

  fs.writeFileSync(metadataDir, JSON.stringify(metadata, null, 2), { flag: 'w', encoding: 'utf8' });

  log(`\n  ✓ ...Build successful for version ${version}`, colors.green);
}

function rewriteImportsForGnome42(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`'${filePath}' file not found!`);
  }

  log(`\n  📝 Rewrite extension.js for GNOME 42-44 to replace imports ...`, colors.yellow);
  let contents = fs.readFileSync(filePath, 'utf8');
  // Remove Extension import
  contents = contents.replace('import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";', '');
  contents = contents.replace(
    /import\s+(\w+)\s+from\s+['"]gi:\/\/(\w+)['"]/g,
    'const $1 = imports.gi.$2'
  );
  contents = contents.replace('const St = imports.gi.St;', 'const { Gtk: St } = imports.gi;');
  /** Remove part of extend */
  contents = contents.replace(' extends Extension', '');
  contents = contents.replace('        super(...arguments);', '');
  contents = contents.replace('export default XWinWaylandExtension;', `
function init() {
  return new XWinWaylandExtension();
}`);
  fs.writeFileSync(filePath, contents, {
    encoding: 'utf8',
    flag: 'w'
  });
}

try {
  log(`\n📦 Start build archives for GNOME Extensions v${version}`, colors.bright + colors.green);
  const metadata = loadMetadata();
  log(`\n ✓ metadata loaded`, colors.green);
  generateArchive(false, metadata);
  generateArchive(true, metadata);
  process.exit(0);
} catch (error) {
  log(`\n Fail Error: ${error.message}`, colors.red);
  process.exit(1);
}
