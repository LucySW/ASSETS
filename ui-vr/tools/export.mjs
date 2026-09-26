// Exporta o kit de ícones para o Unity.
//   node export.mjs                 -> tudo
//   node export.mjs --only bulb,gear -> só esses ícones (PNG/sheets/GLB)
//   node export.mjs --skip-glb       -> sem modelos
// Renderiza em Chromium headless (WebGL via SwiftShader), servindo o three.js
// de node_modules no lugar do CDN usado pelas páginas.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUTTONS, PLATE_KINDS, PREVIEWS } from './manifest.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const THREE_DIR = path.join(HERE, 'node_modules', 'three');
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.186.1/';

const args = process.argv.slice(2);
const only = (() => { const i = args.indexOf('--only'); return i >= 0 ? args[i + 1].split(',') : null; })();
const skipGlb = args.includes('--skip-glb');
const skipButtons = args.includes('--skip-buttons');
const quick = args.includes('--quick'); // só idle/hover, sem sheets/GLB/botões
const OUT = (() => { const i = args.indexOf('--out'); return i >= 0 ? path.resolve(args[i + 1]) : path.join(ROOT, 'Unity', 'CircuitoVR_IconKit'); })();

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[page error]', e.message));
await page.route(`${CDN}**`, (route) => {
  const rel = route.request().url().slice(CDN.length);
  route.fulfill({ path: path.join(THREE_DIR, rel), contentType: 'text/javascript' });
});
await page.goto(`${base}/export.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

const write = (rel, dataUrl) => {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, Buffer.from(dataUrl.replace(/^data:[^,]+,/, ''), 'base64'));
};
const call = (fn, ...a) => page.evaluate(([fn, a]) => window.api[fn](...a), [fn, a]);

const icons = (await call('icons')).filter((i) => !only || only.includes(i.id));
const t0 = Date.now();
for (const ic of icons) {
  const dir = ic.group === 'ilustracao' ? 'Illustrations' : 'Icons';
  write(`Sprites/${dir}/${ic.id}_idle.png`, await call('iconPNG', ic.id, 0));
  write(`Sprites/${dir}/${ic.id}_hover.png`, await call('iconPNG', ic.id, 1));
  if (quick) { console.log(`ícone ${ic.id} ok`); continue; }
  write(`Sprites/${dir}/HoverSheets/${ic.id}_hover_sheet.png`, await call('sheetPNG', ic.id));
  if (!skipGlb) {
    const g = await call('glb', ic.id);
    const f = path.join(OUT, 'Models', `${ic.id}.glb`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(g.data, 'base64'));
  }
  console.log(`ícone ${ic.id} ok (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

if (!only && !skipButtons && !quick) {
  for (const [kind, styles] of Object.entries(PLATE_KINDS)) {
    for (const style of styles) {
      for (const state of ['normal', 'hover', 'pressed', 'disabled']) {
        write(`Sprites/Plates/${kind}_${style}_${state}.png`, await call('plate', kind, style, state));
      }
      write(`Sprites/Plates/${kind}_${style}_glow.png`, await call('glow', kind, style));
    }
  }
  console.log('placas ok');
  for (const b of BUTTONS) {
    for (const state of ['normal', 'hover', 'pressed', 'disabled']) {
      write(`Sprites/Buttons/${b.name}_${state}.png`, await call('button', b.icon, b.style, state));
    }
  }
  console.log('botões ok');
  for (const p of PREVIEWS) {
    const f = path.join(ROOT, 'preview', `${p.name}.png`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from((await call('preview', p)).split(',')[1], 'base64'));
  }
  console.log('previews ok');
}

await browser.close();
server.close();
console.log(`pronto em ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${path.relative(process.cwd(), OUT)}`);
