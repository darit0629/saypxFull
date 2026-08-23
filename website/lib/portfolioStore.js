const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'portfolio-data.js');

function readItems() {
  const content = fs.readFileSync(DATA_PATH, 'utf8');
  const match = content.match(/const PORTFOLIO_ITEMS = (\[[\s\S]*\]);/);
  if (!match) throw new Error('Could not parse portfolio-data.js');
  return JSON.parse(match[1]);
}

function writeItems(items) {
  const body = 'const PORTFOLIO_ITEMS = ' + JSON.stringify(items, null, 2) + ';\n';
  fs.writeFileSync(DATA_PATH, body);
}

function existingSlugSet(items) {
  const slugs = new Set();
  for (const item of items) {
    const file = item.src || item.video;
    if (!file) continue;
    const base = path.basename(file).replace(/\.[a-z0-9]+$/i, '');
    slugs.add(base);
  }
  return slugs;
}

module.exports = { readItems, writeItems, existingSlugSet, DATA_PATH };
