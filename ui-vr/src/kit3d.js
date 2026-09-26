// Helpers de geometria e materiais usados pelos ícones 3D do CircuitoVR.
// Convenção: cada ícone é modelado no plano XY, de frente para +Z, cabendo
// aproximadamente em [-1, 1]. O palco normaliza a escala depois.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Paleta da marca (UI Asset Sheet) + tons de apoio para os ícones.
export const PALETTE = {
  unimontes: '#3B2E9A',
  roxo: '#7B6BED',
  verde: '#4CAF50',
  verdeClaro: '#8ED081',
  azul: '#2F80ED',
  laranja: '#F2994A',
  vermelho: '#EB5757',
  cinzaClaro: '#E5EAF2',
  cinzaEscuro: '#2D3748',
  // apoio
  ciano: '#5fe0ff',
  azulGel: '#3a8cff',
  indigo: '#5b5cff',
  rosa: '#e07bff',
  menta: '#4dffc3',
  ouro: '#ffb547',
  ouroClaro: '#ffe39a',
  gelo: '#e4ecff',
};

export const GRADIENTS = {
  gel: [[0, '#86e6ff'], [0.45, '#2f86ff'], [1, '#3b48ff']],
  holo: [[0, '#7fe6ff'], [0.35, '#2f86ff'], [0.7, '#6f5cf0'], [1, '#e070ff']],
  mint: [[0, '#9dffd9'], [0.5, '#3fe39a'], [1, '#18b7a0']],
  gold: [[0, '#fff1b8'], [0.45, '#ffc14f'], [1, '#ff8a1f']],
  frost: [[0, '#ffffff'], [0.55, '#d3dfff'], [1, '#8ea6ea']],
  coral: [[0, '#ffb0a6'], [0.5, '#ff6b6b'], [1, '#e2365f']],
  steel: [[0, '#e3e9f7'], [0.6, '#a9b6d6'], [1, '#6f7fa8']],
  dim: [[0, '#a7b3d4'], [1, '#6a7899']],
};

// ---------------------------------------------------------------- materiais

// Todos os materiais guardam a emissão base em userData para o hover poder
// "acender" o ícone sem acumular (setGlow é idempotente).
function tag(mat, glow = 0.25) {
  mat.userData.e0 = mat.emissiveIntensity;
  mat.userData.glow = glow;
  return mat;
}

export const MAT = {
  // Gel colorido por vértice (degradê), verniz e leve iridescência.
  gel(emissive = '#2a5cff', e = 0.16) {
    return tag(new THREE.MeshPhysicalMaterial({
      color: 0xffffff, vertexColors: true,
      roughness: 0.16, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.05,
      iridescence: 0.5, iridescenceIOR: 1.32, iridescenceThicknessRange: [140, 460],
      emissive: new THREE.Color(emissive), emissiveIntensity: e,
    }));
  },
  // Vidro fosco branco-lavanda (engrenagem, alto-falante, balão).
  frost(emissive = '#6d8dff', e = 0.14) {
    return tag(new THREE.MeshPhysicalMaterial({
      color: 0xffffff, vertexColors: true,
      roughness: 0.38, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.12,
      sheen: 0.5, sheenColor: new THREE.Color('#8fb4ff'), sheenRoughness: 0.35,
      iridescence: 0.25, iridescenceIOR: 1.3,
      emissive: new THREE.Color(emissive), emissiveIntensity: e,
    }), 0.2);
  },
  // Ouro luminoso (lâmpada, estrela, alvo).
  gold(e = 0.55) {
    return tag(new THREE.MeshPhysicalMaterial({
      color: 0xffffff, vertexColors: true,
      roughness: 0.18, metalness: 0.15,
      clearcoat: 1, clearcoatRoughness: 0.04,
      emissive: new THREE.Color('#ff9a1f'), emissiveIntensity: e,
    }), 0.5);
  },
  // Luz pura (raios, filamento): quase só emissão.
  light(color = '#ffd67a', e = 2.2) {
    return tag(new THREE.MeshStandardMaterial({
      color: new THREE.Color(color), roughness: 0.3,
      emissive: new THREE.Color(color), emissiveIntensity: e,
    }), 1.2);
  },
  // Vidro transparente (bolha do Confirmar, bulbo da lâmpada).
  glass(color = '#9fdcff', opacity = 0.3, emissive = '#3aa0ff', e = 0.08) {
    return tag(new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color), roughness: 0.04, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.02,
      iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 520],
      transparent: true, opacity, depthWrite: false,
      emissive: new THREE.Color(emissive), emissiveIntensity: e,
    }), 0.15);
  },
  // Metal/plástico escuro (fechadura, detalhes).
  dark(color = '#1a2350') {
    return tag(new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color), roughness: 0.25, metalness: 0.2,
      clearcoat: 1, clearcoatRoughness: 0.1,
      emissive: new THREE.Color('#0b1640'), emissiveIntensity: 0.3,
    }), 0.05);
  },
};

// Aplica o brilho de hover (0..1) em todos os materiais de um objeto.
export function setGlow(root, h) {
  root.traverse((o) => {
    if (!o.material) return;
    for (const m of [].concat(o.material)) {
      if (m.userData.e0 === undefined) continue;
      m.emissiveIntensity = m.userData.e0 * (1 + 1.1 * h) + m.userData.glow * h;
    }
  });
}

// ---------------------------------------------------------------- geometria

// Degradê por vértice. `axis` recebe (x, y, z) normalizados 0..1 dentro da
// caixa do objeto e devolve t. Atalhos: 'x', 'y', 'diag', 'angle'.
export function paint(geo, stops, axis = 'diag', box = null) {
  geo.computeBoundingBox();
  const bb = box || geo.boundingBox;
  const size = new THREE.Vector3(); bb.getSize(size);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cs = stops.map(([t, c]) => [t, new THREE.Color(c)]);
  const tmp = new THREE.Color();
  const fn = typeof axis === 'function' ? axis : {
    x: (u) => u,
    y: (u, v) => 1 - v,
    diag: (u, v) => (u + (1 - v)) / 2,
    angle: (u, v, w, x, y) => {
      const a = Math.atan2(y, x); // -pi..pi
      return ((Math.PI / 2 - a) / (2 * Math.PI) + 1) % 1;
    },
  }[axis];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const u = size.x ? (x - bb.min.x) / size.x : 0.5;
    const v = size.y ? (y - bb.min.y) / size.y : 0.5;
    const w = size.z ? (z - bb.min.z) / size.z : 0.5;
    let t = THREE.MathUtils.clamp(fn(u, v, w, x, y, z), 0, 1);
    let k = 0;
    while (k < cs.length - 2 && t > cs[k + 1][0]) k++;
    const [t0, c0] = cs[k], [t1, c1] = cs[k + 1];
    tmp.copy(c0).lerp(c1, THREE.MathUtils.clamp((t - t0) / (t1 - t0 || 1), 0, 1));
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// Suaviza normais de geometrias não indexadas (Extrude/Tube) para um visual
// "gel" contínuo.
export function smooth(geo) {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const g = mergeVertices(geo, 1e-4);
  g.computeVertexNormals();
  return g;
}

// Polígono com cantos arredondados (filete por curva quadrática).
export function roundedShape(points, r = 0.12, holes = []) {
  const shape = new THREE.Shape();
  traceRounded(shape, points, r);
  for (const h of holes) {
    const path = new THREE.Path();
    if (h.circle) path.absarc(h.circle[0], h.circle[1], h.circle[2], 0, Math.PI * 2, true);
    else traceRounded(path, h.points, h.r ?? r);
    shape.holes.push(path);
  }
  return shape;
}

// Filete por arco circular de raio real (um filete quadrático fica com raio
// efetivo menor que o chanfro em pontas agudas e dobra a malha).
function traceRounded(path, pts, r) {
  const n = pts.length;
  const V = pts.map(([x, y]) => new THREE.Vector2(x, y));
  const radii = Array.isArray(r) ? r : V.map(() => r);
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = V[i], a = V[(i - 1 + n) % n], b = V[(i + 1) % n];
    const ua = a.clone().sub(p), ub = b.clone().sub(p);
    const limit = Math.min(ua.length(), ub.length()) * 0.49;
    ua.normalize(); ub.normalize();
    const theta = Math.acos(THREE.MathUtils.clamp(ua.dot(ub), -1, 1));
    const half = Math.tan(theta / 2);
    if (theta > Math.PI - 1e-3 || half < 1e-4) { out.push(p.clone()); continue; }
    let rad = radii[i];
    let d = rad / half;
    if (d > limit) { d = limit; rad = d * half; }
    const s = p.clone().addScaledVector(ua, d);
    const e = p.clone().addScaledVector(ub, d);
    const c = p.clone().addScaledVector(ua.clone().add(ub).normalize(), rad / Math.sin(theta / 2));
    const a0 = Math.atan2(s.y - c.y, s.x - c.x);
    let da = Math.atan2(e.y - c.y, e.x - c.x) - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const steps = Math.max(3, Math.ceil(Math.abs(da) / (Math.PI / 24)));
    for (let k = 0; k <= steps; k++) {
      const ang = a0 + da * (k / steps);
      out.push(new THREE.Vector2(c.x + rad * Math.cos(ang), c.y + rad * Math.sin(ang)));
    }
  }
  path.moveTo(out[0].x, out[0].y);
  for (let i = 1; i < out.length; i++) {
    if (out[i].distanceTo(out[i - 1]) > 1e-5) path.lineTo(out[i].x, out[i].y);
  }
  path.closePath();
}

// Extrusão centrada em Z com chanfro arredondado.
export function extrude(shape, depth = 0.22, bevel = 0.1, curveSegments = 32) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, curveSegments,
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.85,
    bevelOffset: -bevel * 0.85, bevelSegments: 7,
  });
  geo.translate(0, 0, -depth / 2);
  return smooth(geo);
}

// Tubo ao longo de pontos (Catmull-Rom) com tampas esféricas.
export function tube(points, radius = 0.1, { closed = false, tension = 0.5, segs = 96, caps = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2] || 0)), closed, 'catmullrom', tension);
  let geo = smooth(new THREE.TubeGeometry(curve, segs, radius, 24, closed));
  if (caps && !closed) {
    const parts = [geo];
    for (const t of [0, 1]) {
      const s = new THREE.SphereGeometry(radius, 24, 16);
      const p = curve.getPoint(t);
      s.translate(p.x, p.y, p.z);
      parts.push(s);
    }
    geo = mergeGeos(parts);
  }
  return geo;
}

export function arcPoints(cx, cy, r, a0, a1, n = 48, z = 0) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
  }
  return pts;
}

export function capsule(radius, length, axis = 'x') {
  const g = new THREE.CapsuleGeometry(radius, length, 12, 32);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
}

export function rbox(w, h, d, r) {
  const g = new RoundedBoxGeometry(w, h, d, 6, r);
  g.deleteAttribute('uv');
  return g;
}

export function mergeGeos(geos) {
  // Mesclagem simples preservando só posição/normal (e cor se todos tiverem).
  const hasColor = geos.every((g) => g.attributes.color);
  const prepared = geos.map((g) => {
    let x = g.index ? g.toNonIndexed() : g;
    if (!x.attributes.normal) x.computeVertexNormals();
    return x;
  });
  const total = prepared.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  const col = hasColor ? new Float32Array(total * 3) : null;
  let o = 0;
  for (const g of prepared) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (col) col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

// Malha nomeada (nomes estáveis viram nós no GLB e trilhas da animação).
export function mesh(name, geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  return m;
}

export function group(name, ...children) {
  const g = new THREE.Group();
  g.name = name;
  for (const c of children) g.add(c);
  return g;
}

// ---------------------------------------------------------------- tempo

// Curvas de animação em laço: todas valem 0 em t = 0 e t = 1, então o
// primeiro quadro do hover é idêntico à pose de repouso (sem "salto").
export const ease = (x) => x * x * (3 - 2 * x);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export function pulse(t, start = 0, dur = 1) {
  const x = (t - start) / dur;
  if (x <= 0 || x >= 1) return 0;
  return Math.sin(Math.PI * x) ** 2;
}
export const wave = (t, k = 1) => Math.sin(2 * Math.PI * k * t);
