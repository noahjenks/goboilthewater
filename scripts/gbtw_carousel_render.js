// GBTW carousel renderer: node gbtw_carousel_render.js specs.json outdir [C3 C4 ...]
// specs.json: {"C1": {"date": "2026-11-30", "theme": "light|dark|oak", "slides": [{"tag", "headline", "body"}]}, ...}
// Writes outdir/<date>-<id>/slide-NN.png (1080x1080) and outdir/<date>-<id>/preview.png (all slides on one sheet).
// Brand Bible: Parchment #F5EFE4 / Midnight Ink #1C1812 / Deep Oak #2E1A0E, Saddle #8B5C2A, Brass #C4925A,
// Playfair Display Italic Bold headlines, DM Sans body and tags.
// Set CHROMIUM_PATH to use an already installed Chromium (local testing).
const { chromium } = require('playwright');
const fs = require('fs');
const [, , specPath, outDir, ...only] = process.argv;
const specs = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const T = {
  light: { bg: '#F5EFE4', tag: '#8B5C2A', head: '#1C1812', body: '#4a4038', foot: '#A89080' },
  dark: { bg: '#1C1812', tag: '#C4925A', head: '#FFFFFF', body: '#D4C5B0', foot: '#A89080' },
  oak: { bg: '#2E1A0E', tag: '#C4925A', head: '#F5EFE4', body: '#D4C5B0', foot: '#A89080' },
};
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const page = (c, s, i, n, hs, bs) => `<html><head><style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,700&family=DM+Sans:wght@400;500&display=swap');
html,body{margin:0;width:1080px;height:1080px;overflow:hidden}
body{background:${c.bg};font-family:'DM Sans',sans-serif;box-sizing:border-box;padding:116px 110px 92px;display:flex;flex-direction:column}
.tag{font-weight:500;letter-spacing:.12em;text-transform:uppercase;font-size:27px;color:${c.tag}}
.rule{width:72px;height:3px;background:${c.tag};margin:22px 0 42px;flex:none}
h1{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;font-size:${hs}px;line-height:1.12;margin:0 0 34px;color:${c.head}}
.body{font-size:${bs}px;line-height:1.42;color:${c.body};max-width:860px}
#wrap{flex:1 1 auto;min-height:0}
.foot{display:flex;justify-content:space-between;font-size:25px;color:${c.foot};padding-top:24px}
</style></head><body><div id="wrap"><div class="tag">${esc(s.tag)}</div><div class="rule"></div>
<h1>${esc(s.headline)}</h1><div class="body">${esc(s.body)}</div></div>
<div class="foot"><span>@goboilthewater</span><span>${i + 1} / ${n}</span></div></body></html>`;

(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
  let tooLong = 0;
  for (const [id, spec] of Object.entries(specs)) {
    if (only.length && !only.includes(id)) continue;
    const dir = `${outDir}/${spec.date}-${id}`;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const c = T[spec.theme] || T.light;
    const shots = [];
    for (const [i, s] of spec.slides.entries()) {
      let hs = i === 0 ? 84 : 72, bs = 40, fit = false;
      while (!fit) {
        await p.setContent(page(c, s, i, spec.slides.length, hs, bs), { waitUntil: 'networkidle' });
        await p.evaluate(() => document.fonts.ready);
        fit = await p.evaluate(() => { const w = document.getElementById('wrap'); return w.scrollHeight <= w.clientHeight; });
        if (!fit) { hs -= 4; bs -= 2; if (bs < 28) { console.log('TOO LONG', id, 'slide', i + 1); tooLong++; break; } }
      }
      const file = `${dir}/slide-${String(i + 1).padStart(2, '0')}.png`;
      await p.screenshot({ path: file });
      shots.push(fs.readFileSync(file).toString('base64'));
    }
    // preview sheet: every slide on one image, 4 across, for approval in chat
    const cols = Math.min(4, shots.length), rows = Math.ceil(shots.length / cols), tile = 400, gap = 16;
    const W = cols * tile + (cols + 1) * gap, H = rows * tile + (rows + 1) * gap + 56;
    await p.setViewportSize({ width: W, height: H });
    await p.setContent(`<html><body style="margin:0;background:#ddd;font:500 26px sans-serif">
      <div style="padding:14px ${gap}px 0">${esc(id)} &middot; ${esc(spec.date)} &middot; ${shots.length} slides</div>
      <div style="display:grid;grid-template-columns:repeat(${cols},${tile}px);gap:${gap}px;padding:${gap}px">
      ${shots.map(s => `<img width="${tile}" height="${tile}" src="data:image/png;base64,${s}">`).join('')}</div></body></html>`);
    await p.screenshot({ path: `${dir}/preview.png`, fullPage: true });
    await p.setViewportSize({ width: 1080, height: 1080 });
    console.log('rendered', id, spec.slides.length);
  }
  await b.close();
  if (tooLong) { console.log(`${tooLong} slide(s) too long to fit. Shorten them.`); process.exit(1); }
})();
