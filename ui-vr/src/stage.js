// Palco de renderização: instancia ícones, renderiza PNG com transparência,
// monta flipbooks de hover e exporta GLB com a animação "hover".
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { ICON_BY_ID } from './icons.js';
import { setGlow } from './kit3d.js';

// Leve inclinação padrão: mostra o volume sem perder a leitura frontal.
export const BASE_POSE = new THREE.Euler(0.12, -0.22, 0);
const FIT = { default: 2.15, ilustracao: 2.35 };

export function instantiate(id) {
  const def = ICON_BY_ID[id];
  if (!def) throw new Error(`Ícone desconhecido: ${id}`);
  const { root, anim } = def.build();
  anim(0);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center);
  const fit = new THREE.Group();
  fit.name = `${id}_fit`;
  fit.scale.setScalar((FIT[def.group] || FIT.default) / Math.max(size.x, size.y));
  fit.add(root);
  const pose = new THREE.Group();
  pose.name = `${id}_pose`;
  pose.rotation.copy(BASE_POSE);
  pose.add(fit);
  return {
    def, object: pose, fit, root, anim,
    update(t = 0, h = 0) { setGlow(pose, h); anim(t); },
  };
}

// Renderer + cena + luzes compartilhados pelo exportador e pela vitrine.
export function lightRig(r) {
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1.0;
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(r);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  const key = new THREE.DirectionalLight('#ffffff', 2.1);
  key.position.set(-3, 4, 5);
  const rimL = new THREE.DirectionalLight('#6fd6ff', 1.8); rimL.position.set(-5, 1, -3);
  const rimR = new THREE.DirectionalLight('#a57bff', 1.8); rimR.position.set(5, 2, -3);
  const fill = new THREE.DirectionalLight('#9cc4ff', 0.6); fill.position.set(3, -2, 4);
  scene.add(key, rimL, rimR, fill, new THREE.AmbientLight('#8aa8ff', 0.25));
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 50);
  camera.position.set(0, 0, 7.2);
  return { scene, key, camera };
}

export class Stage {
  constructor(canvas, { size = 512, supersample = 2 } = {}) {
    this.size = size;
    this.ss = supersample;
    const r = this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, preserveDrawingBuffer: true,
    });
    r.setPixelRatio(1);
    r.setSize(size * supersample, size * supersample, false);
    r.setClearColor(0x000000, 0);
    Object.assign(this, lightRig(r));
  }

  // Renderiza um frame da instância no canvas WebGL inteiro.
  draw(inst, t = 0, h = 0) {
    const r = this.renderer;
    r.setScissorTest(false);
    r.setViewport(0, 0, this.size * this.ss, this.size * this.ss);
    this.scene.add(inst.object);
    inst.update(t, h);
    this.key.intensity = 2.1 * (1 + 0.25 * h);
    r.clear();
    r.render(this.scene, this.camera);
    this.scene.remove(inst.object);
    return r.domElement;
  }

  // Renderiza e pós-processa (halo de brilho + reamostragem) num canvas 2D.
  sprite(inst, { t = 0, h = 0, size = this.size } = {}) {
    const src = this.draw(inst, t, h);
    return glowComposite(src, size, h);
  }

  // Flipbook do hover em grade cols x rows (t = i / frames, h = 1).
  sheet(inst, { cols = 4, rows = 4, cell = 256 } = {}) {
    const out = document.createElement('canvas');
    out.width = cols * cell; out.height = rows * cell;
    const ctx = out.getContext('2d');
    const n = cols * rows;
    for (let i = 0; i < n; i++) {
      const c = this.sprite(inst, { t: i / n, h: 1, size: cell });
      ctx.drawImage(c, (i % cols) * cell, Math.floor(i / cols) * cell);
    }
    inst.update(0, 0);
    return out;
  }
}

// Halo colorado feito a partir do próprio ícone (bloom barato que preserva
// transparência). h = 0 repouso, 1 hover.
export function glowComposite(src, size, h = 0) {
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const u = size / 512;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = `blur(${(14 + 10 * h) * u}px) saturate(1.6)`;
  ctx.globalAlpha = 0.28 + 0.4 * h;
  ctx.drawImage(src, 0, 0, size, size);
  if (h > 0) {
    ctx.filter = `blur(${5 * u}px) saturate(1.4)`;
    ctx.globalAlpha = 0.35 * h;
    ctx.drawImage(src, 0, 0, size, size);
  }
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.drawImage(src, 0, 0, size, size);
  return out;
}

// GLB com a animação "hover" amostrada dos mesmos anim(t) usados nos PNG.
// Orientação pronta para o Unity: frente do ícone para -Z (como um Quad/UI),
// ~8,5 cm de largura.
export async function exportGLB(id, { frames = 32, duration = 1.33, widthMeters = 0.085 } = {}) {
  const inst = instantiate(id);
  inst.update(0, 0);
  inst.object.rotation.set(0, 0, 0);
  const holder = new THREE.Group();
  holder.name = id;
  holder.rotation.y = Math.PI;
  const s = widthMeters / (inst.def.group === 'ilustracao' ? 2.35 : 2.15);
  holder.scale.setScalar(s);
  holder.add(inst.object);

  const nodes = [];
  inst.object.traverse((o) => nodes.push(o));
  const rest = nodes.map((o) => [o.position.toArray(), o.quaternion.toArray(), o.scale.toArray()].flat());
  const samples = nodes.map(() => ({ p: [], q: [], s: [], moved: false }));
  const times = [];
  for (let i = 0; i <= frames; i++) {
    const t = i / frames;
    inst.anim(i === frames ? 0 : t);
    times.push(t * duration);
    nodes.forEach((o, k) => {
      const smp = samples[k];
      smp.p.push(...o.position.toArray());
      smp.q.push(...o.quaternion.toArray());
      smp.s.push(...o.scale.toArray());
      const now = [o.position.toArray(), o.quaternion.toArray(), o.scale.toArray()].flat();
      if (now.some((v, j) => Math.abs(v - rest[k][j]) > 1e-5)) smp.moved = true;
    });
  }
  inst.anim(0);
  const tracks = [];
  nodes.forEach((o, k) => {
    const smp = samples[k];
    if (!smp.moved || !o.name) return;
    tracks.push(new THREE.VectorKeyframeTrack(`${o.name}.position`, times, smp.p));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${o.name}.quaternion`, times, smp.q));
    tracks.push(new THREE.VectorKeyframeTrack(`${o.name}.scale`, times, smp.s));
  });
  const clip = new THREE.AnimationClip('hover', duration, tracks);
  const buf = await new GLTFExporter().parseAsync(holder, { binary: true, animations: tracks.length ? [clip] : [] });
  return { buffer: buf, tracks: tracks.length / 3 };
}
