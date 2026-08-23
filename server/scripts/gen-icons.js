const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const OUT_DIR = path.join(__dirname, '..', '..', 'client', 'public', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

const LOGO_PATH = path.join('C:', 'Users', 'proba', 'Downloads', 'SAYPX LOGO Icon.png');
const LOGO_URL = 'data:image/png;base64,' + fs.readFileSync(LOGO_PATH).toString('base64');

function iconHtml(size, { maskable }) {
  // Maskable icons need the glyph inside a ~40% safe-zone margin so Android's
  // circular/squircle crop never clips it.
  const pad = maskable ? size * 0.22 : size * 0.1;
  const logoSize = size - pad * 2;
  return `<!doctype html><html><head><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:${size}px; height:${size}px; background:${maskable ? '#0B0D12' : 'transparent'}; }
    .icon {
      width:${size}px; height:${size}px;
      background: #0B0D12;
      border-radius: ${maskable ? 0 : size * 0.22}px;
      display:flex; align-items:center; justify-content:center;
    }
    img { width:${logoSize}px; height:${logoSize}px; object-fit:contain; }
  </style></head><body>
    <div class="icon"><img src="${LOGO_URL}" /></div>
  </body></html>`;
}

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const targets = [
    { size: 192, maskable: false, name: 'icon-192.png' },
    { size: 512, maskable: false, name: 'icon-512.png' },
    { size: 192, maskable: true, name: 'icon-192-maskable.png' },
    { size: 512, maskable: true, name: 'icon-512-maskable.png' },
  ];
  for (const t of targets) {
    const page = await browser.newPage();
    await page.setViewport({ width: t.size, height: t.size, deviceScaleFactor: 1 });
    await page.setContent(iconHtml(t.size, t), { waitUntil: 'load' });
    await page.screenshot({ path: path.join(OUT_DIR, t.name), omitBackground: !t.maskable });
    await page.close();
    console.log('wrote', t.name);
  }

  // Favicon: just the transparent logo, no forced background square, since browser tabs are tiny.
  const favSize = 128;
  const favPage = await browser.newPage();
  await favPage.setViewport({ width: favSize, height: favSize, deviceScaleFactor: 1 });
  await favPage.setContent(
    `<!doctype html><html><head><style>
      * { margin:0; padding:0; }
      html,body { width:${favSize}px; height:${favSize}px; background:transparent; }
      img { width:${favSize}px; height:${favSize}px; object-fit:contain; }
    </style></head><body><img src="${LOGO_URL}" /></body></html>`,
    { waitUntil: 'load' }
  );
  await favPage.screenshot({ path: path.join(__dirname, '..', '..', 'client', 'public', 'favicon.png'), omitBackground: true });
  await favPage.close();
  console.log('wrote favicon.png');
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
