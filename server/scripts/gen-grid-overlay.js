const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const IMG_PATH = path.join(__dirname, '..', 'uploads', 'bg-saypx-classic-original.jpg');
const IMG_URL = 'data:image/jpeg;base64,' + fs.readFileSync(IMG_PATH).toString('base64');

const W = 794;
const H = 1123;

let gridLines = '';
for (let y = 0; y <= H; y += 25) {
  const bold = y % 100 === 0;
  gridLines += `<div style="position:absolute;left:0;top:${y}px;width:100%;height:1px;background:${bold ? 'red' : 'rgba(255,0,0,0.35)'};"></div>`;
  gridLines += `<div style="position:absolute;left:2px;top:${y}px;font-size:9px;color:red;background:white;line-height:1;">${y}</div>`;
}
for (let x = 0; x <= W; x += 50) {
  const bold = x % 100 === 0;
  gridLines += `<div style="position:absolute;top:0;left:${x}px;height:100%;width:1px;background:${bold ? 'blue' : 'rgba(0,0,255,0.35)'};"></div>`;
  gridLines += `<div style="position:absolute;top:2px;left:${x}px;font-size:9px;color:blue;background:white;line-height:1;">${x}</div>`;
}

const html = `<!doctype html><html><head><style>
  * { margin:0; padding:0; }
  html,body { width:${W}px; height:${H}px; }
  .page { position:relative; width:${W}px; height:${H}px; }
  .page img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
</style></head><body>
  <div class="page">
    <img src="${IMG_URL}" />
    ${gridLines}
  </div>
</body></html>`;

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(__dirname, '..', '..', 'grid-overlay.png') });
  await browser.close();
  console.log('wrote grid-overlay.png');
}

main().catch((e) => { console.error(e); process.exit(1); });
