const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'index.html');

function bumpCacheVersion() {
  let html = fs.readFileSync(HTML_PATH, 'utf8');
  const newVersion = String(Date.now());
  html = html.replace(/portfolio-data\.js(\?v=[^"']+)?/, `portfolio-data.js?v=${newVersion}`);
  html = html.replace(/app\.js(\?v=[^"']+)?/, `app.js?v=${newVersion}`);
  fs.writeFileSync(HTML_PATH, html);
}

function getCategoryMap() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const re = /<button class="filter-btn[^"]*" data-filter="([^"]+)">([^<]+)<\/button>/g;
  const map = {};
  let m;
  while ((m = re.exec(html))) {
    if (m[1] === 'all') continue;
    map[m[1]] = m[2].trim();
  }
  return map;
}

function addFilterButton(slug, label) {
  let html = fs.readFileSync(HTML_PATH, 'utf8');
  // Match the whole filters block and its closing </div>, independent of
  // exact surrounding whitespace (which can drift after repeated edits).
  const re = /(<div class="portfolio-filters">[\s\S]*?)(\n\s*)(<\/div>)/;
  if (!re.test(html)) throw new Error('Could not locate filter row insertion point');
  const newButton = `<button class="filter-btn" data-filter="${slug}">${label}</button>`;
  html = html.replace(re, (full, body, indent, closeTag) => {
    return body + indent + newButton + indent + closeTag;
  });
  fs.writeFileSync(HTML_PATH, html);
}

module.exports = { bumpCacheVersion, getCategoryMap, addFilterButton, HTML_PATH };
