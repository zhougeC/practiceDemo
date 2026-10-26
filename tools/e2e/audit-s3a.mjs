// TASK-002 证据完整性审计（S3a）：在同一冻结帧上同时取
//   (a) 真实相机的完整读数（位置/注视/上向量/FOV/near/far/aspect/投影矩阵/视口/渲染器），
//   (b) 渲染像素（整帧 / 隐藏海面 / 隐藏鹈鹕 三张，用于做差分掩膜），
//   (c) 由同一相机参数做的几何海面掩膜（与 app.mjs 的 rayHitsSea 同源公式）。
// 目的：判定"下半海面 65.32%"这类数值是否描述同一帧的真实渲染，还是算错了相机/常量。
// 只读诊断：不写应用源码、不改任何门禁阈值。
// 用法：PW_HEADLESS=1 node tools/e2e/audit-s3a.mjs --out=<dir>
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { decodePng } from './png.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const PAGE_URL = pathToFileURL(join(ROOT, 'index.html')).href;
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = /^--([^=]+)=?(.*)$/.exec(a);
  return m ? [m[1], m[2] === '' ? true : m[2]] : [a, true];
}));
const OUT = args.out || join(homedir(), '.evidence', 'task-002', 'audit', 's3a-audit');
mkdirSync(OUT, { recursive: true });

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

const browser = await chromium.launch({ headless: process.env.PW_HEADLESS !== '0' });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const consoleMsgs = [];
page.on('console', (m) => { if (m.type() === 'error') consoleMsgs.push(m.text()); });
page.on('pageerror', (e) => consoleMsgs.push(String(e && e.message)));
await page.goto(`${PAGE_URL}?debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });

// 与 app.mjs p10-screens 的 prepShot 完全同序：先收敛 3.2 s，再冻结，再等 160 ms。
await page.evaluate(() => {
  window.PB.debug.setHudVisible(false);
  clearInterval(window.__keepAwake);
  window.__keepAwake = setInterval(() => window.PB.input.markActivity(performance.now() / 1000), 200);
});
const prep = `PB.debug.setPhase(0.50); PB.debug.setSpeed(8); PB.input.markActivity(performance.now()/1000);` +
  'var G=PB.main.state(); G.bike.lane=1; G.bike.laneT=1; G.bike.x=0; G.bike.laneFromX=0; G.bike.laneToX=0;' +
  'G.bike.y=0; G.bike.lean=0; G.bike.wheelie=0;' +
  'G.cam.orbit.lastInteractT=performance.now()/1000;PB.debug.setCamera(1);PB.debug.freezeTime(false);';
await page.evaluate(async (code) => {
  const apply = new Function('PB', code);
  const t0 = performance.now();
  await new Promise((res) => {
    const tick = () => { apply(window.PB); if (performance.now() - t0 < 3200) requestAnimationFrame(tick); else res(); };
    tick();
  });
}, prep);
await page.evaluate(() => { window.PB.debug.setPhase(0.50); window.PB.debug.setSpeed(8); window.PB.debug.freezeTime(true); });
await page.waitForTimeout(160);

// 相机 + 渲染器 + 状态读数（同一帧、截图之前）
const read = await page.evaluate(() => {
  const PB = window.PB, G = PB.main.state();
  const cam = PB.camera.object();
  const e = cam.matrixWorld.elements;
  const fx = -e[8], fy = -e[9], fz = -e[10];
  const fl = Math.hypot(fx, fy, fz) || 1;
  const ux = e[4], uy = e[5], uz = e[6];
  const ul = Math.hypot(ux, uy, uz) || 1;
  const r = PB.scene.renderer();
  const gl = r.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const scene = PB.scene.scene();
  let oceanMesh = null;
  const tree = [];
  scene.traverse((o) => {
    if (o.isMesh || o.isGroup || o.isPoints) {
      tree.push({ type: o.type, name: o.name || '', visible: o.visible, mat: o.material && (o.material.type || '') });
    }
    if (!oceanMesh && o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uPhase) oceanMesh = o;
  });
  return {
    canvas: { w: r.domElement.width, h: r.domElement.height, cw: r.domElement.clientWidth, ch: r.domElement.clientHeight },
    renderer: {
      unmasked: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null,
      version: gl.getParameter(gl.VERSION),
      isWebGL2: r.capabilities.isWebGL2,
      pixelRatio: r.getPixelRatio(),
      drawingBuffer: { w: gl.drawingBufferWidth, h: gl.drawingBufferHeight },
    },
    camera: {
      pos: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
      fwd: { x: fx / fl, y: fy / fl, z: fz / fl },
      up: { x: ux / ul, y: uy / ul, z: uz / ul },
      fov: cam.fov, near: cam.near, far: cam.far, aspect: cam.aspect,
      projectionMatrix: Array.from(cam.projectionMatrix.elements),
      matrixWorldInverse: Array.from(cam.matrixWorldInverse.elements).slice(0, 16),
      mode: G.cam.mode, blendT: G.cam.blendT,
    },
    bike: { x: G.bike.x, y: G.bike.y, z: 0, lane: G.bike.lane, v: G.bike.v, lean: G.bike.lean },
    env: { lamps: G.env.lamps, nightMix: G.env.nightMix, phase: G.env.phase },
    S: G.S, t: G.t,
    frozen: true,
    oceanMeshFound: !!oceanMesh,
    sceneTree: tree,
    oceanCfg: { X0: PB.config.OCEAN.X0, X1: PB.config.OCEAN.X1, Z0: PB.config.OCEAN.Z0, Z1: PB.config.OCEAN.Z1 },
    cfgSide: PB.config.CAM_SIDE,
    shoreX: PB.config.SHORE_X,
    seaY: PB.config.SEA_Y,
  };
});

const shot = async (name) => {
  const p = join(OUT, name);
  await page.screenshot({ path: p });
  return { path: p, sha256: sha256(p), bytes: readFileSync(p).length };
};

const full = await shot('s3a-full.png');

// 隐藏海面网格 → 差分得到"渲染出来的海面"像素掩膜
await page.evaluate(() => {
  const scene = window.PB.scene.scene();
  scene.traverse((o) => {
    if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uPhase) { o.userData.__vis = o.visible; o.visible = false; }
  });
});
await page.waitForTimeout(120);
const noOcean = await shot('s3a-no-ocean.png');
await page.evaluate(() => {
  window.PB.scene.scene().traverse((o) => {
    if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uPhase) o.visible = o.userData.__vis !== false;
  });
});

// 隐藏鹈鹕（车+骑手）→ 差分得到车的真实像素包围盒
await page.evaluate(() => {
  const root = window.PB.pelican.root();
  root.userData.__vis = root.visible; root.visible = false;
});
await page.waitForTimeout(120);
const noPelican = await shot('s3a-no-pelican.png');
await page.evaluate(() => { const r = window.PB.pelican.root(); r.visible = r.userData.__vis !== false; });

// 同一相机参数的几何掩膜（下半区每 4 px 采样，与 rayHitsSea 同源）
const geo = await page.evaluate(() => {
  const PB = window.PB;
  const cam = PB.camera.object();
  const e = cam.matrixWorld.elements;
  const fx = -e[8], fy = -e[9], fz = -e[10];
  const fl = Math.hypot(fx, fy, fz) || 1;
  const f = { x: fx / fl, y: fy / fl, z: fz / fl };
  const u0 = { x: 0, y: 1, z: 0 };
  const dot = u0.x * f.x + u0.y * f.y + u0.z * f.z;
  let u = { x: u0.x - dot * f.x, y: u0.y - dot * f.y, z: u0.z - dot * f.z };
  const ul = Math.hypot(u.x, u.y, u.z) || 1;
  u = { x: u.x / ul, y: u.y / ul, z: u.z / ul };
  const r = { x: f.y * u.z - f.z * u.y, y: f.z * u.x - f.x * u.z, z: f.x * u.y - f.y * u.x };
  const tan = Math.tan(cam.fov * Math.PI / 360);
  const CFG = PB.config, SHORE_X = CFG.SHORE_X, SEA_Y = CFG.SEA_Y;
  const groundY = (x) => {
    if (x < -16) return Math.min((-16 - x) * 0.6, 12);
    if (x <= 4.5) return 0;
    if (x <= SHORE_X) return -0.07 * (x - 4.5);
    return SEA_Y;
  };
  const rayHitsSea = (ndcX, ndcY) => {
    const a = ndcX * tan * cam.aspect, b = ndcY * tan;
    const d = { x: f.x + a * r.x + b * u.x, y: f.y + a * r.y + b * u.y, z: f.z + a * r.z + b * u.z };
    let t = 0, dt = 0.25;
    for (let i = 0; i < 40000; i++) {
      if (cam.position.y + d.y * t <= groundY(cam.position.x + d.x * t)) {
        let lo = t - dt, hi = t;
        for (let k = 0; k < 24; k++) {
          const m = (lo + hi) / 2;
          if (cam.position.y + d.y * m <= groundY(cam.position.x + d.x * m)) hi = m; else lo = m;
        }
        return cam.position.x + d.x * hi > SHORE_X;
      }
      if (t > 6000) return false;
      t += dt;
      if (t > 200) dt = 2;
    }
    return false;
  };
  const W = 1920, H = 1080, step = 4;
  const rows = [];
  let lowerN = 0, lowerSea = 0, allN = 0, allSea = 0;
  const mask = [];
  for (let py = 0; py < H; py += step) {
    const line = [];
    for (let px = 0; px < W; px += step) {
      const hit = rayHitsSea((px + 0.5) / W * 2 - 1, 1 - (py + 0.5) / H * 2);
      line.push(hit ? 1 : 0);
      allN++; if (hit) allSea++;
      if (py >= H / 2) { lowerN++; if (hit) lowerSea++; }
    }
    mask.push(line);
  }
  return { lowerSeaPct: 100 * lowerSea / lowerN, allSeaPct: 100 * allSea / allN, mask, step };
});
writeFileSync(join(OUT, 'geo-mask.json'), JSON.stringify({ mask: geo.mask, step: geo.step }) + '\n');

// 同一帧的渲染侧掩膜：整帧 vs 隐藏海面 / 隐藏鹈鹕 的真实渲染差分。
// 这是给"几何射线算出来的 65% 到底是不是画面里的海"一个像素级答案，而不是再摆一套几何。
const fullImg = decodePng(readFileSync(full.path));
const noSeaImg = decodePng(readFileSync(noOcean.path));
const noCarImg = decodePng(readFileSync(noPelican.path));
const diffMask = (a, b, thr) => {
  const n = a.width * a.height;
  const m = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const d = Math.abs(a.data[j] - b.data[j]) + Math.abs(a.data[j + 1] - b.data[j + 1]) + Math.abs(a.data[j + 2] - b.data[j + 2]);
    if (d > thr) m[i] = 1;
  }
  return m;
};
const seaMask = diffMask(fullImg, noSeaImg, 12);
const carMask = diffMask(fullImg, noCarImg, 12);
const W = fullImg.width, H = fullImg.height;
let lowerN = 0, lowerSea = 0, allSea = 0;
let inter = 0, uni = 0, geoN = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const r = seaMask[i] === 1;
    if (r) { allSea++; if (y >= H / 2) lowerSea++; }
    if (y >= H / 2) lowerN++;
    const g = geo.mask[Math.floor(y / geo.step)] && geo.mask[Math.floor(y / geo.step)][Math.floor(x / geo.step)] === 1;
    if (g) geoN++;
    if (r && g) inter++;
    if (r || g) uni++;
  }
}
const carBBox = (() => {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (carMask[y * W + x]) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  return n ? { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, px: n } : null;
})();
const rendered = {
  lowerHalfSeaPct: (100 * lowerSea) / lowerN,
  allSeaPct: (100 * allSea) / (W * H),
  geoLowerHalfSeaPct: (100 * geoN) / lowerN,
  geoVsRenderedIoU: uni ? inter / uni : 0,
  geoInsideRendered: geoN ? inter / geoN : 0,
  renderedInsideGeo: allSea ? inter / allSea : 0,
  carBBox,
};

const report = {
  generatedAt: new Date().toISOString(),
  page: PAGE_URL,
  out: OUT,
  shots: { full, noOcean, noPelican },
  read,
  geo: { lowerSeaPct: geo.lowerSeaPct, allSeaPct: geo.allSeaPct, step: geo.step },
  rendered,
  consoleErrors: consoleMsgs,
};
writeFileSync(join(OUT, 'audit.json'), JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify({
  shots: report.shots, camera: read.camera, renderer: read.renderer, canvas: read.canvas,
  bike: read.bike, env: read.env, oceanCfg: read.oceanCfg, cfgSide: read.cfgSide,
  geo: report.geo, rendered, oceanMeshFound: read.oceanMeshFound, consoleErrors: read.consoleErrors,
}, null, 1));
await browser.close();
