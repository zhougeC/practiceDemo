// ADR-34 机位独立复算（AMD-P10-001 §5.5 / §8 的"y 口径未定"与"dx=21 车道 −2.5 只有 26.2%"两项）。
// 只做几何，不读应用源码、不启动浏览器：常量逐条抄自 js/core/config.js 与 plan.md §1.1/§1.3/§4.7，
// 相机约定与 tools/e2e/app.mjs 的 projectWithCamera / rayHitsSea 同源（right = f × u）。
// 输出：每条车道在给定 (dx, y) 下的下半海面占比、车包围盒中心 ndc、车高 px、包围盒是否全在画内。
//
// 用法：node tools/e2e/adr34-projection.mjs [--json]

const ROAD_HALF = 4.5;
const SAND_SLOPE = 0.07;
const SEA_Y = -0.8;
const SHORE_X = ROAD_HALF + (-SEA_Y) / SAND_SLOPE;   // 15.928571428571429
const CLIFF_X = -16;
const CLIFF_SLOPE = 0.6;
const CLIFF_MAX = 12;

const W = 1920, H = 1080;
const ASPECT = W / H;
const FOV = 40;                 // §4.7 mode 1 的 FOV（竖直，度）
const NEAR = 0.1;

// 车包围盒（tests/selfcheck.js 的 CAR 中心 + §1.5 的极值）：y ∈ [0, 1.98]、z ∈ [−1.072, 0]。
// 横向半宽取 0.45 m（车把半宽 0.25、翼根 0.27，取保守值），用于"整车不出画"的判据。
const CAR_CENTER = { y: 0.99, z: -0.536 };
const CAR_Y0 = 0, CAR_Y1 = 1.98, CAR_Z0 = -1.072, CAR_Z1 = 0, CAR_HALF_X = 0.45;

/**
 * §1.1 地面高度场（与 config.ground 逐字一致）。
 * @param {number} x 横向坐标
 * @returns {number} 高度
 */
function ground(x) {
  if (x < CLIFF_X) {
    const h = (CLIFF_X - x) * CLIFF_SLOPE;
    return h < CLIFF_MAX ? h : CLIFF_MAX;
  }
  if (x <= ROAD_HALF) return 0;
  if (x <= SHORE_X) return -SAND_SLOPE * (x - ROAD_HALF);
  return SEA_Y;
}

/**
 * 由位置与注视点建正交基：f 前向、u 上、r 右（r = f × u，与 three.js 相机 x 轴同向）。
 * @param {{x:number,y:number,z:number}} pos 相机位置
 * @param {{x:number,y:number,z:number}} look 注视点
 * @returns {{pos:object,f:object,u:object,r:object,tan:number}} 相机基
 */
function basis(pos, look) {
  let f = { x: look.x - pos.x, y: look.y - pos.y, z: look.z - pos.z };
  const fl = Math.hypot(f.x, f.y, f.z) || 1;
  f = { x: f.x / fl, y: f.y / fl, z: f.z / fl };
  const up0 = { x: 0, y: 1, z: 0 };
  const d = up0.x * f.x + up0.y * f.y + up0.z * f.z;
  let u = { x: up0.x - d * f.x, y: up0.y - d * f.y, z: up0.z - d * f.z };
  const ul = Math.hypot(u.x, u.y, u.z) || 1;
  u = { x: u.x / ul, y: u.y / ul, z: u.z / ul };
  const r = { x: f.y * u.z - f.z * u.y, y: f.z * u.x - f.x * u.z, z: f.x * u.y - f.y * u.x };
  return { pos, f, u, r, tan: Math.tan(FOV * Math.PI / 180 / 2) };
}

/**
 * 世界点 → NDC（§1.3 公式；深度沿视轴）。
 * @param {object} cam basis()
 * @param {{x:number,y:number,z:number}} p 世界点
 * @returns {{x:number,y:number,depth:number}} ndc 与深度
 */
function project(cam, p) {
  const dx = p.x - cam.pos.x, dy = p.y - cam.pos.y, dz = p.z - cam.pos.z;
  const depth = dx * cam.f.x + dy * cam.f.y + dz * cam.f.z;
  const du = dx * cam.u.x + dy * cam.u.y + dz * cam.u.z;
  const dr = dx * cam.r.x + dy * cam.r.y + dz * cam.r.z;
  return { x: dr / depth / (cam.tan * ASPECT), y: du / depth / cam.tan, depth };
}

/**
 * NDC 像素射线的首次地面交点，判断是否为海面（x > SHORE_X）。
 * 用逐步推进 + 二分细化；只判"首次命中"，与渲染的深度遮挡一致。
 * @param {object} cam basis()
 * @param {number} ndcX NDC x
 * @param {number} ndcY NDC y
 * @returns {boolean} 首次命中点是否在海面
 */
function rayHitsSea(cam, ndcX, ndcY) {
  const a = ndcX * cam.tan * ASPECT, b = ndcY * cam.tan;
  const d = {
    x: cam.f.x + a * cam.r.x + b * cam.u.x,
    y: cam.f.y + a * cam.r.y + b * cam.u.y,
    z: cam.f.z + a * cam.r.z + b * cam.u.z
  };
  let t = 0, step = 0.25;
  for (let i = 0; i < 60000; i++) {
    const x = cam.pos.x + d.x * t, y = cam.pos.y + d.y * t;
    if (y <= ground(x)) {
      let lo = t - step, hi = t;
      for (let k = 0; k < 30; k++) {
        const m = (lo + hi) / 2;
        if (cam.pos.y + d.y * m <= ground(cam.pos.x + d.x * m)) hi = m; else lo = m;
      }
      return cam.pos.x + d.x * hi > SHORE_X;
    }
    if (t > 8000) return false;
    t += step;
    if (t > 200) step = 2;
  }
  return false;
}

/**
 * 下半幅（ndc_y ∈ [−1, 0)）的海面像素占比，逐像素精确计数（无网格误差）。
 * @param {object} cam basis()
 * @returns {number} 百分比
 */
function lowerSeaPct(cam) {
  let n = 0, sea = 0;
  for (let py = H / 2; py < H; py++) {
    const ndcY = 1 - (py + 0.5) / H * 2;
    for (let px = 0; px < W; px++) {
      n++;
      if (rayHitsSea(cam, (px + 0.5) / W * 2 - 1, ndcY)) sea++;
    }
  }
  return 100 * sea / n;
}

/**
 * 一条车道的全部读数。
 * @param {number} bx 车 x
 * @param {number} dx 相机相对车的 x 偏移
 * @param {number} y 相机与注视点的世界绝对高度
 * @returns {object} 读数
 */
function laneReport(bx, dx, y) {
  const pos = { x: bx + dx, y, z: -22 };
  const look = { x: bx, y, z: 7 };
  const cam = basis(pos, look);
  const center = project(cam, { x: bx, y: CAR_CENTER.y, z: CAR_CENTER.z });
  const top = project(cam, { x: bx, y: CAR_Y1, z: CAR_CENTER.z });
  const bottom = project(cam, { x: bx, y: CAR_Y0, z: CAR_CENTER.z });
  const heightPx = Math.abs(top.y - bottom.y) * (H / 2);
  // 整车包围盒 8 角是否都在画内（|ndc| ≤ 1 且 depth > near）
  let inside = true, worst = 0;
  for (const sx of [-1, 1]) {
    for (const yy of [CAR_Y0, CAR_Y1]) {
      for (const zz of [CAR_Z0, CAR_Z1]) {
        const p = project(cam, { x: bx + sx * CAR_HALF_X, y: yy, z: zz });
        const m = Math.max(Math.abs(p.x), Math.abs(p.y));
        if (m > worst) worst = m;
        if (m > 1 || p.depth <= NEAR) inside = false;
      }
    }
  }
  return {
    laneX: bx,
    camX: pos.x,
    camY: y,
    camFloor: Math.max(ground(pos.x) + 0.4, SEA_Y + 0.8),
    lowerSeaPct: lowerSeaPct(cam),
    carNdcX: center.x,
    carNdcY: center.y,
    carHeightPx: heightPx,
    carInside: inside,
    carWorstNdc: worst
  };
}

const LANES = [-2.5, 0, 2.5];
const Y_ABS = [0.6, 1.0, 1.2, 1.6, 2.2];
const DX = [20, 21, 22, 23, 24, 25, 26, 27, 28];

const rows = [];
for (const dx of DX) {
  for (const y of Y_ABS) {
    const lanes = LANES.map((bx) => laneReport(bx, dx, y));
    const minSea = Math.min(...lanes.map((l) => l.lowerSeaPct));
    const maxNdcX = Math.max(...lanes.map((l) => Math.abs(l.carNdcX)));
    const minH = Math.min(...lanes.map((l) => l.carHeightPx));
    const allInside = lanes.every((l) => l.carInside);
    const floorOk = lanes.every((l) => l.camY >= l.camFloor - 1e-9);
    rows.push({
      dx, y,
      sea: lanes.map((l) => +l.lowerSeaPct.toFixed(2)),
      minSea: +minSea.toFixed(2),
      ndcX: lanes.map((l) => +l.carNdcX.toFixed(3)),
      maxNdcX: +maxNdcX.toFixed(3),
      heightPx: lanes.map((l) => +l.carHeightPx.toFixed(1)),
      minH: +minH.toFixed(1),
      allInside, floorOk,
      pass40: minSea >= 40,
      passCentre: maxNdcX <= 1 / 3,
      passHeight: minH >= 90,
      pass: minSea >= 40 && maxNdcX <= 1 / 3 && minH >= 90 && allInside && floorOk
    });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ lanes: LANES, shoreX: SHORE_X, rows }, null, 2));
} else {
  console.log(`SHORE_X=${SHORE_X.toFixed(6)}  1080p  fov=${FOV}  lanes=${LANES.join('/')}`);
  console.log('dx   y    lowerSea%[L0,L1,L2]      min    ndcX[L0,L1,L2]        carHpx[L0,L1,L2]   in  pass');
  for (const r of rows) {
    console.log(
      `${String(r.dx).padStart(2)}  ${r.y.toFixed(1)}  ` +
      `[${r.sea.map((v) => v.toFixed(1).padStart(5)).join(',')}]  ${r.minSea.toFixed(1).padStart(6)}  ` +
      `[${r.ndcX.map((v) => v.toFixed(3).padStart(6)).join(',')}]  ` +
      `[${r.heightPx.map((v) => v.toFixed(1).padStart(5)).join(',')}]  ` +
      `${r.allInside ? 'Y' : 'n'}  ${r.pass ? 'PASS' : '-'}`
    );
  }
}
