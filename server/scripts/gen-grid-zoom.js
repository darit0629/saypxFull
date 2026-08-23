const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const IMG_PATH = path.join(__dirname, '..', 'uploads', 'bg-saypx-classic-original.jpg');
const IMG_URL = 'data:image/jpeg;base64,' + fs.readFileSync(IMG_PATH).toString('base64');

const W = 794;
const H = 1123;

// region: {x, y, w, h} in canvas units; zoom: scale factor
async function shoot(region, zoom, outName) {
  const zw = region.w * zoom;
  const zh = region.h * zoom;
  let gridLines = '';
  for (let y = 0; y <= region.h; y += 10) {
    const bold = y % 50 === 0;
    const realY = region.y + y;
    gridLines += `<div style="position:absolute;left:0;top:${y * zoom}px;width:100%;height:1px;background:${bold ? 'red' : 'rgba(255,0,0,0.3)'};"></div>`;
    gridLines += `<div style="position:absolute;left:2px;top:${y * zoom}px;font-size:11px;color:red;background:white;line-height:1;">${realY}</div>`;
  }
  for (let x = 0; x <= region.w; x += 10) {
    const bold = x % 50 === 0;
    const realX = region.x + x;
    gridLines += `<div style="position:absolute;top:0;left:${x * zoom}px;height:100%;width:1px;background:${bold ? 'blue' : 'rgba(0,0,255,0.3)'};"></div>`;
    gridLines += `<div style="position:absolute;top:12px;left:${x * zoom}px;font-size:11px;color:blue;background:white;line-height:1;">${realX}</div>`;
  }

  const html = `<!doctype html><html><head><style>
    * { margin:0; padding:0; }
    html,body { width:${zw}px; height:${zh}px; overflow:hidden; }
    .crop { position:relative; width:${zw}px; height:${zh}px; overflow:hidden; }
    .crop img { position:absolute; left:${-region.x * zoom}px; top:${-region.y * zoom}px; width:${W * zoom}px; height:${H * zoom}px; }
  </style></head><body>
    <div class="crop">
      <img src="${IMG_URL}" />
      ${gridLines}
    </div>
  </body></html>`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: Math.ceil(zw), height: Math.ceil(zh), deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(__dirname, '..', '..', outName) });
  await browser.close();
  console.log('wrote', outName);
}

async function main() {
  // Totals section (right side lines) + labels
  await shoot({ x: 380, y: 670, w: 380, h: 240 }, 2.5, 'zoom-totals.png');
  // Item table header bar
  await shoot({ x: 40, y: 290, w: 720, h: 100 }, 1.8, 'zoom-header.png');
  // Meta labels block
  await shoot({ x: 40, y: 190, w: 420, h: 160 }, 2, 'zoom-meta.png');
}

main().catch((e) => { console.error(e); process.exit(1); });
