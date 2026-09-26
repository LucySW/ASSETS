// Catálogo de ícones 3D do CircuitoVR (inventário de 26/09/2026).
// Cada build() devolve { root, anim(t) }:
//   root  – THREE.Group na pose de repouso
//   anim  – aplica a micro-animação de hover no instante t ∈ [0, 1) (laço).
//           anim(0) sempre reproduz a pose de repouso.
import * as THREE from 'three';
import {
  MAT, GRADIENTS as G, paint, roundedShape, extrude, tube, arcPoints, capsule,
  rbox, mergeGeos, mesh, group, pulse, wave, easeInOut,
} from './kit3d.js';

const TAU = Math.PI * 2;

// ------------------------------------------------------------ peças comuns

function arrowLeft(name = 'arrow', grad = G.gel) {
  const shape = roundedShape([
    [-1, 0], [-0.12, 0.82], [-0.12, 0.34], [0.95, 0.34], [0.95, -0.34], [-0.12, -0.34], [-0.12, -0.82],
  ], [0.16, 0.14, 0.08, 0.16, 0.16, 0.08, 0.14]);
  return mesh(name, paint(extrude(shape, 0.24, 0.13), grad, 'diag'), MAT.gel());
}

function chevron(name = 'chevron', dir = 1, grad = G.holo) {
  const s = dir;
  const shape = roundedShape([
    [-0.42 * s, 0.9], [0.62 * s, 0], [-0.42 * s, -0.9], [-0.74 * s, -0.62], [0.02 * s, 0], [-0.74 * s, 0.62],
  ], [0.16, 0.2, 0.16, 0.14, 0.08, 0.14]);
  const g = paint(extrude(shape, 0.28, 0.14), grad, (u, v) => (dir > 0 ? (u * 0.6 + (1 - v) * 0.4) : ((1 - u) * 0.6 + (1 - v) * 0.4)));
  return mesh(name, g, MAT.gel('#4a4dff', 0.28));
}

function playTri(name = 'play', scale = 1, grad = G.holo) {
  const shape = roundedShape([[-0.62, 0.86], [0.9, 0], [-0.62, -0.86]], 0.22);
  const g = extrude(shape, 0.3, 0.15);
  g.translate(-0.05, 0, 0);
  g.scale(scale, scale, scale);
  return mesh(name, paint(g, grad, 'diag'), MAT.gel('#3b58ff', 0.26));
}

function speaker() {
  const body = mesh('speaker_body', paint(rbox(0.46, 0.64, 0.5, 0.14), G.frost, 'y'), MAT.frost());
  body.position.set(-0.72, 0, 0);
  const coneGeo = new THREE.CylinderGeometry(0.82, 0.3, 0.62, 64, 1, false);
  coneGeo.rotateZ(-Math.PI / 2);
  coneGeo.translate(-0.22, 0, 0);
  const cone = mesh('speaker_cone', paint(coneGeo, G.frost, 'y'), MAT.frost());
  const rimGeo = new THREE.TorusGeometry(0.82, 0.07, 16, 72);
  rimGeo.rotateY(Math.PI / 2);
  rimGeo.translate(0.09, 0, 0);
  const rim = mesh('speaker_rim', paint(rimGeo, G.frost, 'y'), MAT.frost('#8fb0ff', 0.2));
  return group('speaker', body, cone, rim);
}

function bubbleShape() {
  return roundedShape([
    [-0.98, 0.72], [0.98, 0.72], [0.98, -0.46], [-0.22, -0.46], [-0.62, -0.9], [-0.56, -0.46], [-0.98, -0.46],
  ], [0.3, 0.3, 0.3, 0.16, 0.11, 0.16, 0.3]);
}

function checkMesh(name = 'check') {
  const shape = roundedShape([
    [-0.88, 0.08], [-0.6, 0.36], [-0.2, -0.04], [0.62, 0.78], [0.9, 0.5], [-0.2, -0.6],
  ], [0.16, 0.16, 0.16, 0.16, 0.16, 0.16]);
  return mesh(name, paint(extrude(shape, 0.3, 0.15), G.mint, 'diag'), MAT.gel('#12c98a', 0.3));
}

function starShape(outer = 1, inner = 0.47) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return roundedShape(pts, pts.map((_, i) => (i % 2 ? 0.12 : 0.1)));
}

function cubeMesh(name = 'cube', size = 1.2, grad = G.gel) {
  const m = mesh(name, paint(rbox(size, size, size, size * 0.12), grad, 'diag'), MAT.gel('#2f6bff', 0.28));
  return m;
}

function axisArrow(name, color, len = 1.25, r = 0.065) {
  const mat = MAT.gel(color, 0.45);
  const shaft = new THREE.CylinderGeometry(r, r, len, 24);
  shaft.translate(0, len / 2, 0);
  const head = new THREE.ConeGeometry(r * 2.6, 0.34, 32);
  head.translate(0, len + 0.14, 0);
  const g = mergeGeos([shaft, head]);
  paint(g, [[0, color], [1, color]], 'y');
  return mesh(name, g, mat);
}

function axesGroup(name = 'axes', len = 1.25) {
  const x = axisArrow(`${name}_x`, '#ff5c7a', len); x.rotation.z = -Math.PI / 2;
  const y = axisArrow(`${name}_y`, '#4fe38e', len);
  const z = axisArrow(`${name}_z`, '#4aa3ff', len); z.rotation.x = Math.PI / 2;
  const o = mesh(`${name}_origin`, paint(new THREE.SphereGeometry(0.15, 32, 16), G.frost, 'y'), MAT.frost());
  return group(name, x, y, z, o);
}

function lockGroup(name = 'lock', grad = G.steel) {
  const body = mesh(`${name}_body`, paint(rbox(1.25, 0.98, 0.5, 0.18), grad, 'y'), MAT.frost('#7a8fd6', 0.12));
  body.position.y = -0.36;
  const sh = tube([...arcPoints(0, 0.14, 0.38, Math.PI, 0, 40).map(([x, y]) => [x, y, 0])].concat([]), 0.11);
  const legs = mergeGeos([
    tube([[-0.38, 0.14, 0], [-0.38, -0.05, 0]], 0.11, { caps: false }),
    tube([[0.38, 0.14, 0], [0.38, -0.05, 0]], 0.11, { caps: false }),
    sh,
  ]);
  const shackle = mesh(`${name}_shackle`, paint(legs, [[0, '#f4f7ff'], [1, '#9eabcc']], 'y'), MAT.gel('#6f86ff', 0.12));
  shackle.position.y = 0.12;
  const hole = mesh(`${name}_keyhole`, mergeGeos([
    new THREE.CylinderGeometry(0.1, 0.1, 0.08, 24).rotateX(Math.PI / 2).translate(0, 0.05, 0),
    new THREE.BoxGeometry(0.08, 0.22, 0.08).translate(0, -0.08, 0),
  ]), MAT.dark());
  hole.position.set(0, -0.36, 0.26);
  return group(name, shackle, body, hole);
}

// ------------------------------------------------------------ catálogo

export const ICONS = [
  {
    id: 'back', label: 'Voltar', use: 'Voltar (seletor), BTN_Back', group: 'navegacao',
    build() {
      const a = arrowLeft();
      const root = group('back', a);
      return { root, anim: (t) => { a.position.x = -0.16 * pulse(t, 0, 0.5) - 0.08 * pulse(t, 0.5, 0.4); } };
    },
  },
  {
    id: 'selector', label: 'Voltar ao seletor', use: 'Seletor (mesa)', group: 'navegacao',
    build() {
      const a = arrowLeft('arrow'); a.scale.setScalar(0.72); a.position.set(-0.28, 0.2, 0.1);
      const tiles = [];
      const tileMat = MAT.frost('#5f8dff', 0.2);
      for (let i = 0; i < 4; i++) {
        const tile = mesh(`tile_${i}`, paint(rbox(0.4, 0.4, 0.26, 0.1), [[0, '#d9ecff'], [1, '#7fb2ff']], 'diag'), tileMat);
        tile.position.set(0.32 + (i % 2) * 0.48, -0.26 - Math.floor(i / 2) * 0.48, 0.02);
        tiles.push(tile);
      }
      const root = group('selector', a, ...tiles);
      return {
        root, anim: (t) => {
          a.position.x = -0.28 - 0.18 * pulse(t, 0, 0.55);
          tiles.forEach((tile, i) => tile.scale.setScalar(1 + 0.16 * pulse(t, 0.25 + i * 0.1, 0.35)));
        },
      };
    },
  },
  {
    id: 'restart', label: 'Reiniciar', use: 'Reiniciar / Nova sessão; tutorial girar o disco', group: 'mesa',
    build() {
      const a0 = Math.PI * 0.53, a1 = a0 + TAU * 0.8;
      const ringGeo = tube(arcPoints(0, 0, 0.8, a0, a1, 96), 0.12, { segs: 160 });
      paint(ringGeo, G.holo, (u, v, w, x, y) => {
        let a = Math.atan2(y, x) - a0; a = ((a % TAU) + TAU) % TAU; return a / (TAU * 0.8);
      });
      const ring = mesh('ring', ringGeo, MAT.gel('#4d63ff', 0.3));
      const head = mesh('ring_head', paint(extrude(roundedShape([[-0.2, 0.3], [0.26, 0], [-0.2, -0.3]], 0.09), 0.2, 0.08), [[0, '#9ef0ff'], [1, '#56b4ff']], 'x'), MAT.gel('#3aa8ff', 0.3));
      head.position.set(0.8 * Math.cos(a0) + 0.08, 0.8 * Math.sin(a0), 0);
      const ringG = group('ring_group', ring, head);
      const cube = cubeMesh('cube', 0.62, G.frost);
      cube.material = MAT.frost('#5c8cff', 0.25);
      cube.rotation.set(0.6, 0.78, 0);
      const root = group('restart', ringG, cube);
      return {
        root, anim: (t) => {
          ringG.rotation.z = -TAU * easeInOut(t);
          cube.rotation.set(0.6, 0.78 + (Math.PI / 2) * easeInOut(t), 0);
        },
      };
    },
  },
  {
    id: 'bulb', label: 'Dica', use: 'Dica (escada de ajuda)', group: 'mesa',
    build() {
      const prof = [];
      prof.push(new THREE.Vector2(0.001, 0.87));
      for (let i = 1; i <= 26; i++) {
        const phi = Math.PI / 2 - (i / 26) * (Math.PI / 2 + 0.72);
        prof.push(new THREE.Vector2(0.62 * Math.cos(phi), 0.25 + 0.62 * Math.sin(phi)));
      }
      prof.push(new THREE.Vector2(0.34, -0.3), new THREE.Vector2(0.3, -0.42), new THREE.Vector2(0.001, -0.42));
      const glassGeo = new THREE.LatheGeometry(prof, 72);
      const glass = mesh('bulb_glass', glassGeo, MAT.glass('#ffb347', 0.86, '#ff8a1f', 1.1));
      glass.material.iridescence = 0.3;
      glass.userData.glow = 0.9;
      const baseProf = [
        [0.001, -0.42], [0.34, -0.42], [0.36, -0.48], [0.32, -0.54], [0.36, -0.6], [0.32, -0.66],
        [0.35, -0.72], [0.28, -0.8], [0.14, -0.9], [0.001, -0.92],
      ].map(([r, y]) => new THREE.Vector2(r, y));
      const base = mesh('bulb_base', paint(new THREE.LatheGeometry(baseProf, 64), [[0, '#7fb6ff'], [1, '#1f47c8']], 'y'), MAT.gel('#2b6bff', 0.3));
      const q = tube([...arcPoints(0, 0.42, 0.2, Math.PI * 0.95, -Math.PI * 0.35, 30), [0.02, 0.08, 0], [0.0, 0.02, 0]], 0.07, { tension: 0.3 });
      const dot = new THREE.SphereGeometry(0.085, 24, 16).translate(0, -0.16, 0);
      const glyph = mesh('bulb_glyph', mergeGeos([q, dot]), MAT.light('#fff4d0', 2.6));
      glyph.position.z = 0.05;
      const rays = [];
      const rayMat = MAT.light('#ffb52e', 2);
      [90, 38, 142, -5, 185].forEach((deg, i) => {
        const a = THREE.MathUtils.degToRad(deg);
        const r = mesh(`ray_${i}`, capsule(0.065, 0.2, 'y'), rayMat);
        const pivot = group(`ray_pivot_${i}`, r);
        pivot.position.set(1.02 * Math.cos(a), 0.25 + 1.02 * Math.sin(a), 0);
        pivot.rotation.z = a - Math.PI / 2;
        rays.push(pivot);
      });
      const swing = group('bulb_swing', glyph, glass, base);
      const root = group('bulb', swing, ...rays);
      return {
        root, anim: (t) => {
          swing.rotation.z = 0.1 * wave(t) * (1 - t);
          rays.forEach((r, i) => {
            const k = pulse(t, (i % 3) * 0.12, 0.6);
            r.scale.set(1 + 0.2 * k, 1 + 0.9 * k, 1 + 0.2 * k);
          });
          // multiplica o valor já definido por setGlow (chamado antes de anim)
          glyph.material.emissiveIntensity *= 1 + 0.8 * pulse(t, 0, 1);
        },
      };
    },
  },
  {
    id: 'play', label: 'Começar / Continuar', use: 'Começar, Continuar', group: 'mesa',
    build() {
      const p = playTri();
      const root = group('play', p);
      return {
        root, anim: (t) => {
          p.position.x = 0.14 * pulse(t, 0, 0.45);
          p.scale.setScalar(1 + 0.06 * pulse(t, 0.4, 0.5));
        },
      };
    },
  },
  {
    id: 'skip', label: 'Pular', use: 'Pular (micro-lição)', group: 'mesa',
    build() {
      const a = playTri('tri_a', 0.6); a.position.set(-0.52, 0, 0);
      const b = playTri('tri_b', 0.6); b.position.set(0.18, 0, 0);
      const bar = mesh('bar', paint(rbox(0.26, 1.04, 0.3, 0.12), G.holo, 'y'), MAT.gel('#5b4dff', 0.28));
      bar.position.set(0.8, 0, 0);
      const root = group('skip', a, b, bar);
      return {
        root, anim: (t) => {
          a.position.x = -0.52 + 0.16 * pulse(t, 0, 0.45);
          b.position.x = 0.18 + 0.12 * pulse(t, 0.15, 0.45);
          bar.scale.y = 1 + 0.08 * pulse(t, 0.3, 0.4);
        },
      };
    },
  },
  {
    id: 'pause', label: 'Pausar', use: 'Pausar', group: 'mesa',
    build() {
      const bars = [-0.38, 0.38].map((x, i) => {
        const b = mesh(`bar_${i}`, paint(rbox(0.46, 1.7, 0.36, 0.22), [[0, '#9ce8ff'], [0.5, '#4a9dff'], [1, '#3a5dff']], 'y'), MAT.gel('#2f6bff', 0.24));
        b.position.x = x;
        return b;
      });
      const root = group('pause', ...bars);
      return {
        root, anim: (t) => {
          bars.forEach((b, i) => {
            const k = pulse(t, i * 0.22, 0.5);
            b.scale.set(1 + 0.08 * k, 1 - 0.14 * k, 1);
          });
        },
      };
    },
  },
  {
    id: 'sound', label: 'Som', use: 'Som (ligado)', group: 'mesa',
    build() {
      const sp = speaker();
      const waves = [0.46, 0.8].map((r, i) => {
        const g = paint(tube(arcPoints(0.05, 0, r, -0.8, 0.8, 40), 0.075), [[0, '#9ff4ff'], [1, '#2fd0ff']], 'y');
        const w = mesh(`wave_${i}`, g, MAT.gel('#19c6ff', 0.55));
        const p = group(`wave_pivot_${i}`, w);
        return p;
      });
      const root = group('sound', sp, ...waves);
      root.position.x = 0.12;
      return {
        root, anim: (t) => {
          waves.forEach((w, i) => { w.scale.setScalar(1 + 0.12 * pulse(t, i * 0.2, 0.5)); });
          sp.scale.setScalar(1 + 0.04 * pulse(t, 0, 0.3));
        },
      };
    },
  },
  {
    id: 'muted', label: 'Sem som', use: 'Sem som', group: 'mesa',
    build() {
      const sp = speaker();
      sp.position.x = -0.12;
      const xs = [1, -1].map((s, i) => {
        const b = mesh(`x_${i}`, paint(capsule(0.12, 0.82, 'x'), G.coral, 'x'), MAT.gel('#ff3d5a', 0.4));
        b.rotation.z = s * Math.PI / 4;
        return b;
      });
      const x = group('x', ...xs);
      x.position.set(0.78, 0, 0.05);
      const root = group('muted', sp, x);
      return {
        root, anim: (t) => {
          x.rotation.z = 0.35 * wave(t, 2) * (1 - t);
          x.scale.setScalar(1 + 0.12 * pulse(t, 0, 0.4));
        },
      };
    },
  },
  {
    id: 'subtitles', label: 'Legendas', use: 'Legendas (ligadas)', group: 'mesa',
    build() {
      const b = mesh('bubble', paint(extrude(bubbleShape(), 0.3, 0.1), G.frost, 'y'), MAT.frost());
      const lineMat = MAT.gel('#1ec8ff', 0.5);
      const lines = [[-0.66, 0.34, 1.3], [-0.66, 0.0, 0.86]].map(([x, y, len], i) => {
        const g = capsule(0.085, len, 'x');
        g.translate(len / 2 + 0.085, 0, 0);
        const l = mesh(`line_${i}`, paint(g, [[0, '#a5f5ff'], [1, '#3a9dff']], 'x'), lineMat);
        l.position.set(x, y, 0.26);
        return l;
      });
      const root = group('subtitles', b, ...lines);
      return {
        root, anim: (t) => {
          lines.forEach((l, i) => { l.scale.x = 1 - 0.75 * pulse(t, i * 0.18, 0.6); });
        },
      };
    },
  },
  {
    id: 'subtitles_off', label: 'Sem legendas', use: 'Sem legendas', group: 'mesa',
    build() {
      const b = mesh('bubble', paint(extrude(bubbleShape(), 0.3, 0.1), G.steel, 'y'), MAT.frost('#6a7fc0', 0.1));
      const lineMat = MAT.frost('#5a78c8', 0.1);
      [[-0.66, 0.34, 1.3], [-0.66, 0.0, 0.86]].forEach(([x, y, len], i) => {
        const g = capsule(0.085, len, 'x');
        g.translate(len / 2 + 0.085, 0, 0);
        const l = mesh(`line_${i}`, paint(g, G.dim, 'x'), lineMat);
        l.position.set(x, y, 0.26);
        b.add(l);
      });
      const slash = mesh('slash', paint(capsule(0.1, 1.9, 'x'), G.coral, 'x'), MAT.gel('#ff3d5a', 0.4));
      slash.rotation.z = -Math.PI / 4; slash.position.z = 0.42;
      const root = group('subtitles_off', b, slash);
      return {
        root, anim: (t) => {
          slash.rotation.z = -Math.PI / 4 + 0.18 * wave(t, 2) * (1 - t);
          b.position.x = 0.04 * wave(t, 3) * (1 - t);
        },
      };
    },
  },
  {
    id: 'star', label: 'Estrela', use: 'Placar, estrelas do resultado', group: 'informativo',
    build() {
      const s = mesh('star', paint(extrude(starShape(), 0.36, 0.09), G.gold, 'y'), MAT.gold());
      const root = group('star', s);
      return { root, anim: (t) => { s.rotation.y = TAU * easeInOut(t); s.scale.setScalar(1 + 0.08 * pulse(t, 0.2, 0.6)); } };
    },
  },
  {
    id: 'star_off', label: 'Estrela apagada', use: 'Estrela não conquistada', group: 'informativo',
    build() {
      const s = mesh('star', paint(extrude(starShape(), 0.36, 0.09), G.dim, 'y'), MAT.frost('#44507a', 0.06));
      const root = group('star_off', s);
      return { root, anim: (t) => { s.rotation.y = 0.5 * wave(t) * (1 - t); } };
    },
  },
  {
    id: 'target', label: 'Alvo', use: 'Passo 1 "Leia o endereço"', group: 'informativo',
    build() {
      const rings = [[1.0, 0.76, 'gold'], [0.56, 0.34, 'frost']].map(([ro, ri, kind], i) => {
        const sh = new THREE.Shape(); sh.absarc(0, 0, ro, 0, TAU, false);
        const hole = new THREE.Path(); hole.absarc(0, 0, ri, 0, TAU, true); sh.holes.push(hole);
        const g = extrude(sh, 0.16, 0.08, 96);
        const m = kind === 'gold' ? mesh(`ring_${i}`, paint(g, G.gold, 'y'), MAT.gold(0.45))
          : mesh(`ring_${i}`, paint(g, G.frost, 'y'), MAT.frost());
        m.position.z = i * 0.08;
        return m;
      });
      const center = mesh('center', paint(new THREE.SphereGeometry(0.2, 40, 24), G.gold, 'y'), MAT.gold(0.8));
      center.scale.z = 0.8; center.position.z = 0.16;
      const root = group('target', ...rings, center);
      return {
        root, anim: (t) => {
          rings.forEach((r, i) => r.scale.setScalar(1 + 0.08 * pulse(t, 0.28 - i * 0.14, 0.45)));
          center.scale.set(1 + 0.35 * pulse(t, 0, 0.35), 1 + 0.35 * pulse(t, 0, 0.35), 0.8);
        },
      };
    },
  },
  {
    id: 'hand', label: 'Mão', use: 'Passo 2 "Pegue a esfera", tutorial de pegar', group: 'informativo',
    build() {
      const mat = MAT.frost('#6a8cff', 0.16);
      const palm = mesh('palm', paint(rbox(1.0, 0.92, 0.42, 0.22), G.frost, 'y'), mat);
      palm.position.y = -0.4;
      const fingers = [[-0.36, 0.5], [-0.12, 0.62], [0.12, 0.58], [0.36, 0.46]].map(([x, len], i) => {
        const g = capsule(0.12, len, 'y');
        g.translate(0, len / 2 + 0.06, 0);
        const f = mesh(`finger_${i}`, paint(g, G.frost, 'y'), mat);
        const pivot = group(`finger_pivot_${i}`, f);
        pivot.position.set(x, 0.0, 0);
        return pivot;
      });
      const tg = capsule(0.13, 0.46, 'y'); tg.translate(0, 0.3, 0);
      const thumb = group('thumb_pivot', mesh('thumb', paint(tg, G.frost, 'y'), mat));
      thumb.position.set(-0.44, -0.46, 0.08);
      thumb.rotation.z = 0.7;
      const root = group('hand', palm, ...fingers, thumb);
      root.position.y = 0.1;
      return {
        root, anim: (t) => {
          fingers.forEach((f, i) => { f.rotation.x = 1.25 * pulse(t, 0.04 * i, 0.8); });
          thumb.rotation.set(0.6 * pulse(t, 0.08, 0.75), 0, 0.7 - 0.45 * pulse(t, 0.08, 0.75));
        },
      };
    },
  },
  {
    id: 'check', label: 'Certo', use: 'Passo 3 "Solte no ponto"', group: 'informativo',
    build() {
      const c = checkMesh();
      const root = group('check', c);
      return { root, anim: (t) => { const k = pulse(t, 0, 0.5); c.scale.setScalar(1 + 0.14 * k); c.rotation.z = -0.12 * k; } };
    },
  },
  {
    id: 'confirm', label: 'Confirmar', use: 'Confirmar', group: 'navegacao',
    build() {
      const bubble = mesh('bubble', new THREE.SphereGeometry(1, 64, 40), MAT.glass('#aee2ff', 0.28));
      const rim = mesh('bubble_rim', new THREE.TorusGeometry(0.99, 0.03, 12, 96), MAT.light('#7fe0ff', 0.9));
      const c = checkMesh(); c.scale.setScalar(0.62); c.position.z = 0.05;
      const root = group('confirm', c, rim, bubble);
      return {
        root, anim: (t) => {
          const k = pulse(t, 0.1, 0.5);
          c.scale.setScalar(0.62 * (1 + 0.2 * k));
          bubble.scale.setScalar(1 + 0.04 * pulse(t, 0, 0.35));
          rim.scale.copy(bubble.scale);
        },
      };
    },
  },
  {
    id: 'cube', label: 'Cubo', use: 'Catálogo (sem uso atual)', group: 'informativo',
    build() {
      const c = cubeMesh('cube', 1.2);
      c.rotation.set(0.62, 0.78, 0);
      const root = group('cube_root', c);
      return { root, anim: (t) => { c.rotation.set(0.62, 0.78 + (Math.PI / 2) * easeInOut(t), 0); } };
    },
  },
  {
    id: 'axes', label: 'Eixos', use: 'Catálogo (sem uso atual)', group: 'informativo',
    build() {
      const a = axesGroup('axes', 1.2);
      const pivot = group('axes_pivot', a);
      pivot.rotation.set(0.35, -0.65, 0);
      a.position.set(-0.3, -0.35, 0);
      const root = group('axes_root', pivot);
      return { root, anim: (t) => { pivot.rotation.set(0.35, -0.65 + 0.6 * wave(t) * (1 - 0.3 * t), 0); } };
    },
  },
  {
    id: 'next', label: 'Próximo', use: 'Próximo / seta do Iniciar ›', group: 'navegacao',
    build() {
      const c = chevron('chevron', 1);
      const root = group('next', c);
      return { root, anim: (t) => { c.position.x = 0.16 * pulse(t, 0, 0.45) + 0.07 * pulse(t, 0.5, 0.35); } };
    },
  },
  {
    id: 'prev', label: 'Anterior', use: 'Seta do Voltar ‹', group: 'navegacao',
    build() {
      const c = chevron('chevron', -1);
      const root = group('prev', c);
      return { root, anim: (t) => { c.position.x = -0.16 * pulse(t, 0, 0.45) - 0.07 * pulse(t, 0.5, 0.35); } };
    },
  },
  {
    id: 'settings', label: 'Configurações', use: 'Configurações', group: 'navegacao',
    build() {
      const pts = [];
      const teeth = 8;
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * TAU;
        const w = TAU / teeth;
        const ro = 0.98, ri = 0.74;
        pts.push([ri * Math.cos(a - w * 0.3), ri * Math.sin(a - w * 0.3)]);
        pts.push([ro * Math.cos(a - w * 0.17), ro * Math.sin(a - w * 0.17)]);
        pts.push([ro * Math.cos(a + w * 0.17), ro * Math.sin(a + w * 0.17)]);
        pts.push([ri * Math.cos(a + w * 0.3), ri * Math.sin(a + w * 0.3)]);
      }
      const shape = roundedShape(pts, 0.1, [{ circle: [0, 0, 0.36] }]);
      const gear = mesh('gear', paint(extrude(shape, 0.36, 0.1, 48), G.frost, 'diag'), MAT.frost());
      const ringGeo = new THREE.TorusGeometry(0.38, 0.1, 24, 72);
      const ring = mesh('ring', paint(ringGeo, [[0, '#9ff3ff'], [1, '#2fb8ff']], 'diag'), MAT.gel('#12b8ff', 0.7));
      ring.position.z = 0.2;
      const root = group('settings', gear, ring);
      return { root, anim: (t) => { gear.rotation.z = -(TAU / 8) * easeInOut(t); ring.scale.setScalar(1 + 0.1 * pulse(t, 0.2, 0.5)); } };
    },
  },
  {
    id: 'lock', label: 'Bloqueado', use: 'Em breve / indisponível', group: 'informativo',
    build() {
      const l = lockGroup('lock');
      const shackle = l.getObjectByName('lock_shackle');
      const root = group('lock_root', l);
      return {
        root, anim: (t) => {
          shackle.position.y = 0.12 + 0.18 * pulse(t, 0.05, 0.5);
          l.rotation.z = 0.12 * wave(t, 2) * pulse(t, 0.5, 0.5);
        },
      };
    },
  },
  // ---------------------------------------------------- ilustrações dos cards
  {
    id: 'illus_coord', label: 'Coordenadas 3D', use: 'Card Coordenadas 3D (icon_coord)', group: 'ilustracao',
    build() {
      const a = axesGroup('axes', 1.45);
      a.position.set(-0.5, -0.55, -0.3);
      const dots = [];
      const dotMat = MAT.gel('#39c6ff', 0.5);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const d = mesh(`dot_${i}_${j}`, paint(new THREE.SphereGeometry(0.045, 16, 12), [[0, '#9ff0ff'], [1, '#5ab8ff']], 'y'), dotMat);
        d.position.set(-0.5 + (i + 1) * 0.32, -0.55 + (j + 1) * 0.32, -0.3);
        dots.push(d);
      }
      const ball = mesh('target_ball', paint(new THREE.SphereGeometry(0.2, 48, 32), G.gold, 'y'), MAT.gold(0.7));
      ball.position.set(0.46, 0.42, 0.2);
      const guides = mesh('guides', mergeGeos([
        new THREE.CylinderGeometry(0.012, 0.012, 0.97, 8).translate(0.46, -0.07, 0.2),
        new THREE.TorusGeometry(0.12, 0.018, 8, 48).rotateX(Math.PI / 2).translate(0.46, -0.55, 0.2),
      ]), MAT.light('#ffd98a', 1.2));
      const scene = group('coord_scene', a, ...dots, guides, ball);
      const pivot = group('coord_pivot', scene);
      pivot.rotation.set(0.3, -0.55, 0);
      const root = group('illus_coord', pivot);
      return {
        root, anim: (t) => {
          pivot.rotation.set(0.3, -0.55 + 0.45 * wave(t), 0);
          ball.position.y = 0.42 + 0.12 * pulse(t, 0.1, 0.5);
          ball.scale.setScalar(1 + 0.2 * pulse(t, 0.1, 0.5));
        },
      };
    },
  },
  {
    id: 'illus_balance', label: 'Balança de Expressões', use: 'Card Balança (icon_balance)', group: 'ilustracao',
    build() {
      const metal = MAT.frost('#6d74ff', 0.16);
      const base = mesh('base', paint(new THREE.CylinderGeometry(0.5, 0.62, 0.16, 48), [[0, '#8e9cff'], [1, '#3b2e9a']], 'y'), MAT.gel('#3b2e9a', 0.3));
      base.position.y = -0.95;
      const pole = mesh('pole', paint(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 24), G.steel, 'y'), metal);
      pole.position.y = -0.25;
      const knob = mesh('knob', paint(new THREE.SphereGeometry(0.13, 32, 16), G.gold, 'y'), MAT.gold(0.6));
      knob.position.y = 0.44;
      const beam = mesh('beam', paint(capsule(0.06, 1.7, 'x'), [[0, '#c7ccff'], [1, '#7b6bed']], 'x'), metal);
      const pans = [-0.9, 0.9].map((x, i) => {
        const pan = mesh(`pan_${i}`, paint(new THREE.CylinderGeometry(0.46, 0.32, 0.1, 48), [[0, '#d7dcff'], [1, '#7b6bed']], 'y'), metal);
        const strings = mesh(`strings_${i}`, mergeGeos([
          new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6).rotateZ(0.6).translate(-0.17, 0.26, 0),
          new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6).rotateZ(-0.6).translate(0.17, 0.26, 0),
        ]), MAT.light('#b9c1ff', 0.6));
        const load = [];
        if (i === 0) {
          const c = mesh('x_cube', paint(rbox(0.5, 0.5, 0.5, 0.08), [[0, '#efe9ff'], [1, '#9c8cff']], 'diag'), MAT.frost('#7b6bed', 0.25));
          c.position.y = 0.29; c.rotation.y = 0.5; load.push(c);
        } else {
          [[-0.15, 0.2], [0.17, 0.2], [0.01, 0.52]].forEach(([x, y], k) => {
            const c = mesh(`blue_cube_${k}`, paint(rbox(0.3, 0.3, 0.3, 0.06), G.gel, 'diag'), MAT.gel('#2f6bff', 0.3));
            c.position.set(x, y, 0); c.rotation.y = 0.3 * k; load.push(c);
          });
        }
        const hang = group(`hang_${i}`, strings, pan, ...load);
        hang.position.set(x, -0.52, 0);
        return hang;
      });
      const arm = group('arm', beam);
      arm.position.y = 0.3;
      const root = group('illus_balance', base, pole, knob, arm, ...pans);
      root.rotation.x = 0.18;
      const tilt = (a) => {
        arm.rotation.z = a;
        pans.forEach((p, i) => {
          const x = (i ? 0.9 : -0.9);
          p.position.set(x * Math.cos(a), -0.52 + x * Math.sin(a), 0);
        });
      };
      tilt(0);
      return { root, anim: (t) => tilt(0.16 * wave(t) * (1 - 0.4 * t)) };
    },
  },
  {
    id: 'illus_soon', label: 'Em breve', use: 'Card Em breve (icon_soon)', group: 'ilustracao',
    build() {
      const cone = mesh('cone', paint(new THREE.ConeGeometry(0.36, 0.8, 64), [[0, '#ffd3a1'], [1, '#f2994a']], 'y'), MAT.gel('#f2994a', 0.35));
      cone.position.set(-0.7, -0.15, -0.2);
      const cube = cubeMesh('cube', 0.62, [[0, '#cfe3ff'], [1, '#6f8fd9']]);
      cube.material = MAT.frost('#5a78c8', 0.12);
      cube.position.set(0.42, 0.45, -0.4); cube.rotation.set(0.5, 0.7, 0);
      const sphere = mesh('sphere', paint(new THREE.SphereGeometry(0.3, 48, 32), [[0, '#b9fff0'], [1, '#2bb59a']], 'y'), MAT.gel('#1fb59a', 0.25));
      sphere.position.set(0.78, -0.5, 0);
      const lock = lockGroup('lock'); lock.scale.setScalar(0.55); lock.position.set(0.02, -0.25, 0.35);
      const items = [cone, cube, sphere, lock];
      const rest = items.map((o) => o.position.y);
      const root = group('illus_soon', ...items);
      return {
        root, anim: (t) => {
          items.forEach((o, i) => { o.position.y = rest[i] + 0.12 * pulse(t, i * 0.14, 0.5); });
          cube.rotation.set(0.5, 0.7 + (Math.PI / 2) * easeInOut(t), 0);
        },
      };
    },
  },
];

export const ICON_BY_ID = Object.fromEntries(ICONS.map((d) => [d.id, d]));
