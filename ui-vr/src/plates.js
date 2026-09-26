// Placas de vidro (fundos dos botões/cards) desenhadas em canvas 2D, nos
// estados normal / hover / pressed / disabled, + halo externo separado para o
// Unity animar a opacidade. Também compõe botões prontos e as folhas de preview.

export const STYLES = {
  // Controle (vidro azul) – Pausar, Som, Legendas, Configurações
  control: { edge: ['#3f9bff', '#1f5fe6'], center: '#07206e', inner: '#4cc2ff', rim: '#aee8ff', glow: '#3cb8ff' },
  // Primário (degradê da marca) – Dica, Iniciar, Próximo
  primary: { edge: ['#2f80ed', '#7b6bed'], center: '#1b1c7e', inner: '#8f86ff', rim: '#d4ccff', glow: '#8a7bff' },
  // Silencioso (vidro escuro) – Seletor, Reiniciar, Voltar
  quiet: { edge: ['#33477e', '#27315f'], center: '#0b1230', inner: '#5b78d0', rim: '#95a9e6', glow: '#5a7bd6' },
  // Sucesso (verde) – Começar, Pular, Confirmar
  success: { edge: ['#3ddc8a', '#1fae8f'], center: '#073f33', inner: '#5cf0ae', rim: '#c4ffe0', glow: '#43e39a' },
  // Perigo (confirmação de ação destrutiva: "Confirmar?")
  danger: { edge: ['#ff7a66', '#e5476d'], center: '#4f0d22', inner: '#ff8a7a', rim: '#ffd0c8', glow: '#ff6f66' },
  // Violeta – card Balança de Expressões
  violet: { edge: ['#8a7bff', '#5a3fd6'], center: '#1e1266', inner: '#a797ff', rim: '#e0d8ff', glow: '#9d8dff' },
  // Laranja – selo "EM BREVE"
  warning: { edge: ['#ffb266', '#f2803a'], center: '#6b2a06', inner: '#ffc38a', rim: '#ffe3c4', glow: '#ffa65a' },
  // Neutro – card "Em breve" e estado desabilitado
  neutral: { edge: ['#7f8db5', '#5d6a91'], center: '#1f2744', inner: '#98a6cc', rim: '#d5ddf2', glow: '#9aa8d0' },
};
export const STYLE_NAMES = Object.keys(STYLES);

// Geometria de cada tipo de placa. border = margem + raio: valor do 9-slice.
export const KINDS = {
  square: { w: 512, h: 512, m: 56, r: 92 },
  pill: { w: 512, h: 216, m: 28, r: 76 },
  card: { w: 512, h: 640, m: 36, r: 64 },
  badge: { w: 256, h: 112, m: 20, r: 36 },
};

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, k) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
}
function rgba(hex, a) { return `rgba(${hexToRgb(hex).join(',')},${a})`; }

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
}

function stateStyle(style, state) {
  const s = { ...STYLES[style] };
  if (state === 'disabled') return { ...STYLES.neutral, alpha: 0.55, flat: true };
  if (state === 'hover') {
    s.edge = s.edge.map((c) => mix(c, '#ffffff', 0.14));
    s.center = mix(s.center, s.edge[0], 0.18);
  }
  if (state === 'pressed') {
    s.edge = s.edge.map((c) => mix(c, '#000814', 0.25));
    s.center = mix(s.center, '#000000', 0.25);
  }
  return s;
}

// Desenha a placa (sem halo externo) dentro do retângulo informado.
export function drawPlate(ctx, x, y, w, h, r, style, state = 'normal') {
  const s = stateStyle(style, state);
  const hov = state === 'hover' ? 1 : 0;
  const prs = state === 'pressed' ? 1 : 0;
  const k = Math.min(w, h);
  ctx.save();
  ctx.globalAlpha = s.alpha ?? 1;

  // 1. base: degradê diagonal das cores de borda
  rr(ctx, x, y, w, h, r);
  const lin = ctx.createLinearGradient(x, y, x + w, y + h);
  lin.addColorStop(0, s.edge[0]);
  lin.addColorStop(1, s.edge[1]);
  ctx.fillStyle = lin;
  ctx.fill();
  ctx.clip();

  // 2. miolo escuro (profundidade do vidro)
  const cx = x + w / 2, cy = y + h * 0.48;
  const rad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.62);
  rad.addColorStop(0, rgba(s.center, 0.92));
  rad.addColorStop(0.55, rgba(s.center, 0.62 - 0.12 * hov));
  rad.addColorStop(1, rgba(s.center, 0));
  ctx.fillStyle = rad;
  ctx.fillRect(x, y, w, h);

  // 3. brilho interno junto à borda
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = `blur(${k * (0.035 + 0.015 * hov)}px)`;
  ctx.strokeStyle = rgba(s.inner, 0.55 + 0.35 * hov - 0.25 * prs);
  ctx.lineWidth = k * (0.07 + 0.03 * hov);
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();

  // 4. reflexo superior (vidro)
  if (!s.flat) {
    const g = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
    g.addColorStop(0, `rgba(255,255,255,${0.2 + 0.08 * hov - 0.12 * prs})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h * 0.5);
    // faixa de luz diagonal sutil
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const d = ctx.createLinearGradient(x, y, x + w, y + h);
    d.addColorStop(0.18, 'rgba(255,255,255,0)');
    d.addColorStop(0.26, `rgba(255,255,255,${0.05 + 0.04 * hov})`);
    d.addColorStop(0.34, 'rgba(255,255,255,0)');
    ctx.fillStyle = d;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // 5. sombra interna quando pressionado
  if (prs) {
    ctx.save();
    ctx.filter = `blur(${k * 0.04}px)`;
    ctx.strokeStyle = 'rgba(0,4,20,0.55)';
    ctx.lineWidth = k * 0.1;
    rr(ctx, x, y - k * 0.03, w, h + k * 0.02, r);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // 6. aro nítido
  ctx.save();
  ctx.globalAlpha = (s.alpha ?? 1) * (0.8 + 0.2 * hov - 0.25 * prs);
  rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5);
  ctx.lineWidth = Math.max(2, k * 0.011 * (1 + 0.5 * hov));
  const rimG = ctx.createLinearGradient(x, y, x, y + h);
  rimG.addColorStop(0, s.rim);
  rimG.addColorStop(0.5, rgba(s.rim, 0.55));
  rimG.addColorStop(1, s.rim);
  ctx.strokeStyle = rimG;
  ctx.stroke();
  ctx.restore();
}

// Halo externo (sprite separado; no Unity anime a opacidade).
export function drawGlow(ctx, x, y, w, h, r, style, strength = 1) {
  const s = STYLES[style];
  const k = Math.min(w, h);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.filter = `blur(${k * 0.03}px)`;
  ctx.strokeStyle = s.glow;
  ctx.lineWidth = k * 0.04;
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.filter = `blur(${k * 0.012}px)`;
  ctx.strokeStyle = rgba(s.rim, 0.9);
  ctx.lineWidth = k * 0.012;
  ctx.stroke();
  ctx.restore();
}

export function plate(kind, style, state = 'normal') {
  const K = KINDS[kind];
  const c = canvas(K.w, K.h);
  drawPlate(c.getContext('2d'), K.m, K.m, K.w - 2 * K.m, K.h - 2 * K.m, K.r, style, state);
  return c;
}

export function glow(kind, style) {
  const K = KINDS[kind];
  const c = canvas(K.w, K.h);
  drawGlow(c.getContext('2d'), K.m, K.m, K.w - 2 * K.m, K.h - 2 * K.m, K.r, style);
  return c;
}

const GLOW_BY_STATE = { normal: 0.45, hover: 1, pressed: 0.7, disabled: 0 };

// Botão quadrado pronto: halo + placa + ícone (com sombra de "flutuação").
export function button(icon, style, state = 'normal', size = 512) {
  const K = KINDS.square;
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const u = size / K.w;
  ctx.scale(u, u);
  const inner = K.w - 2 * K.m;
  if (GLOW_BY_STATE[state]) drawGlow(ctx, K.m, K.m, inner, inner, K.r, style, GLOW_BY_STATE[state]);
  drawPlate(ctx, K.m, K.m, inner, inner, K.r, style, state);
  const scale = { normal: 1, hover: 1.07, pressed: 0.93, disabled: 1 }[state];
  const lift = { normal: 0, hover: -8, pressed: 3, disabled: 0 }[state];
  const d = inner * 0.86 * scale;
  const x = K.w / 2 - d / 2, y = K.w / 2 - d / 2 + lift;
  ctx.save();
  // sombra projetada na placa (maior no hover = ícone "sai" do vidro)
  ctx.filter = `blur(${state === 'hover' ? 16 : 9}px) brightness(0)`;
  ctx.globalAlpha = state === 'disabled' ? 0.15 : 0.4;
  ctx.drawImage(icon, x, y + (state === 'hover' ? 22 : 10), d, d);
  ctx.restore();
  ctx.save();
  if (state === 'pressed') ctx.filter = 'brightness(0.85)';
  if (state === 'disabled') { ctx.filter = 'grayscale(1) brightness(0.9)'; ctx.globalAlpha = 0.45; }
  ctx.drawImage(icon, x, y, d, d);
  ctx.restore();
  return c;
}

// Folha de preview com rótulos (só para visualização; no Unity use TMP).
export function previewSheet(spec, sprite) {
  const cell = spec.cell || 300, cols = spec.cols || 4, pad = 36, top = 110;
  const rows = Math.ceil(spec.items.length / cols);
  const c = canvas(pad * 2 + cols * cell, top + rows * (cell + 44) + pad);
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0, '#f4f7ff'); bg.addColorStop(1, '#e3eafa');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#3B2E9A';
  ctx.font = '600 16px "DejaVu Sans", "Liberation Sans", sans-serif';
  ctx.fillText((spec.kicker || 'CIRCUITOVR · ÍCONES 3D').split('').join(' '), pad, 44);
  ctx.font = '800 34px "DejaVu Sans", "Liberation Sans", sans-serif';
  ctx.fillText(spec.title, pad, 86);
  spec.items.forEach((it, i) => {
    const x = pad + (i % cols) * cell, y = top + Math.floor(i / cols) * (cell + 44);
    const state = it.state || 'normal';
    const icon = sprite(it.icon, state === 'hover' ? 1 : 0);
    const b = button(icon, it.style, state, cell);
    ctx.drawImage(b, x, y);
    if (it.label) {
      ctx.save();
      ctx.font = `600 ${Math.round(cell * 0.07)}px "DejaVu Sans", "Liberation Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2D3748';
      ctx.fillText(it.label, x + cell / 2, y + cell + 14);
      ctx.restore();
    }
  });
  return c;
}
