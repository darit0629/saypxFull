const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const LOGO_PATH = path.join('C:', 'Users', 'proba', 'Downloads', 'SAYPX LOGO Icon.png');
const LOGO_URL = 'data:image/png;base64,' + fs.readFileSync(LOGO_PATH).toString('base64');

const OUT_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_FILE = path.join(OUT_DIR, 'bg-saypx-classic-template.png');

const W = 794;
const H = 1123;

const html = `<!doctype html><html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${W}px; height:${H}px; background:#ececec; font-family: 'Segoe UI', Arial, sans-serif; overflow:hidden; }
  .page { position:relative; width:${W}px; height:${H}px; }

  /* soft abstract brush-stroke texture, top band */
  .stroke { position:absolute; background: linear-gradient(120deg, rgba(120,120,120,0.10), rgba(120,120,120,0)); border-radius: 50%; filter: blur(2px); }

  .ring { position:absolute; width:44px; height:44px; border:6px solid #1a1a1a; border-radius:50%; }
  .dot { position:absolute; width:16px; height:16px; background:#f5b400; border-radius:50%; }

  .circle-yellow { position:absolute; background:#f5b400; border-radius:50%; }
  .bar-yellow { position:absolute; left:0; right:0; height:14px; background:#f5b400; }

  .logo-wrap { position:absolute; top:34px; left:44px; display:flex; align-items:center; gap:12px; }
  .logo-wrap img { width:56px; height:56px; }
  .logo-wrap .word { font-size:34px; font-weight:800; letter-spacing:0.03em; color:#1a1a1a; }

  .invoice-heading { position:absolute; top:44px; right:44px; font-size:52px; font-weight:800; letter-spacing:0.02em; color:#2b2b2b; }

  .sig-line { position:absolute; height:1px; background:#999; }
  .sig-label { position:absolute; font-size:11px; letter-spacing:0.08em; color:#777; text-transform:uppercase; }
  .sig-script { position:absolute; font-family: 'Segoe Script', 'Brush Script MT', cursive; font-size:30px; color:#1a1a1a; transform: rotate(-3deg); }

  .social { position:absolute; font-size:11px; font-weight:700; color:#8a6d00; }
  .social .icon { display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; background:#1a1a1a; color:#fff; font-size:9px; margin-left:4px; }
  .dotgrid { position:absolute; display:grid; grid-template-columns: repeat(2, 14px); gap:10px; }
  .dotgrid span { width:14px; height:14px; border-radius:50%; background:#2b2b2b; }
</style></head><body>
  <div class="page">
    <!-- decorative torn-paper style strokes, top area -->
    <div class="stroke" style="width:1000px;height:320px;left:-260px;top:-170px;transform:rotate(-8deg);background:linear-gradient(120deg, rgba(120,120,120,0.16), rgba(120,120,120,0));"></div>
    <div class="stroke" style="width:760px;height:240px;left:300px;top:-110px;transform:rotate(6deg);background:linear-gradient(120deg, rgba(120,120,120,0.14), rgba(120,120,120,0));"></div>
    <div class="stroke" style="width:400px;height:150px;left:120px;top:0px;transform:rotate(-4deg);background:linear-gradient(120deg, rgba(150,150,150,0.18), rgba(150,150,150,0));"></div>
    <div class="stroke" style="width:520px;height:170px;left:520px;top:40px;transform:rotate(-10deg);background:linear-gradient(120deg, rgba(120,120,120,0.12), rgba(120,120,120,0));"></div>

    <!-- pencil scribble, top-left -->
    <svg style="position:absolute;left:8px;top:6px;" width="140" height="70" viewBox="0 0 140 70">
      <path d="M4 40 C 20 8, 40 8, 50 30 S 80 55, 95 22 S 120 5, 132 30" stroke="#9a9a9a" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55"/>
    </svg>

    <!-- paperclip, clipped into the top edge -->
    <svg style="position:absolute;left:378px;top:-14px;transform:rotate(8deg);" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#9a9a9a" stroke-width="1.6" opacity="0.6">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
    </svg>

    <div class="ring" style="top:200px;right:78px;"></div>
    <div class="dot" style="top:178px;right:56px;"></div>

    <div class="logo-wrap">
      <img src="${LOGO_URL}" />
      <span class="word">SAYPX</span>
    </div>

    <div class="invoice-heading">INVOICE</div>

    <!-- bottom decoration -->
    <div class="circle-yellow" style="width:220px;height:220px;left:-90px;bottom:-70px;"></div>
    <div class="dotgrid" style="left:150px;bottom:174px;">
      <span></span><span></span><span></span><span></span>
    </div>

    <div class="sig-label" style="left:180px;bottom:112px;">Official Signature</div>
    <div class="sig-script" style="left:190px;bottom:128px;">Sayan Das</div>
    <div class="sig-line" style="left:180px;width:280px;bottom:108px;"></div>

    <div class="sig-label" style="right:118px;bottom:112px;">Customer Signature</div>
    <div class="sig-line" style="right:44px;width:280px;bottom:108px;"></div>

    <div class="social" style="left:180px;bottom:56px;">
      Follow us on SAYPX
      <span class="icon">f</span>
      <span class="icon">X</span>
      <span class="icon">@</span>
    </div>

    <div class="bar-yellow" style="bottom:0;"></div>
  </div>
</body></html>`;

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: OUT_FILE });
  await browser.close();
  console.log('wrote', OUT_FILE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
