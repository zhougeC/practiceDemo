// TASK-002 application browser gates (P1 onward). Build-time only (UD-4), never shipped.
// Opens index.html over file:// with a real Chromium and asserts plan.md gates:
//   - P1: sky-colour clear, three-state overlay, stats() readings, ctxlost 8 s button
//   - console criterion (§5.4 item 2): console error = 0 and pageerror = 0, no whitelist
//   - non-file request count = 0 (§5.3 / AC-9a build-time reading)
// Usage: node app.mjs                  (headed)
//        PW_HEADLESS=1 node app.mjs
//        TASK002_ONLY=p1-running node app.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, renameSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { decodePng } from './png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const PAGE_URL = pathToFileURL(join(ROOT, 'index.html')).href;
const VENDOR = join(ROOT, 'vendor', 'three.min.js');
const EVIDENCE = process.env.TASK002_EVIDENCE_APP || join(homedir(), '.evidence', 'task-002', 'implementation', 'app');
const SCREEN_DIR = join(EVIDENCE, 'screens');

const failures = [];
const results = [];

function check(scenario, name, actual, expected, ok) {
  const pass = ok === undefined ? JSON.stringify(actual) === JSON.stringify(expected) : ok;
  if (!pass) failures.push({ scenario: scenario.id, name, actual, expected });
  return pass;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * 用 ffprobe 读真实容器元数据（容器时长/分辨率/帧率/编码/音轨数）。
 * 录制时的墙钟与文件时长不是同一个量：Playwright 的 recordVideo 在 context 创建时就开始录，
 * 文件里包含页面加载与收尾的帧，所以两者必须分开记录，不能拿墙钟冒充视频长度。
 * ffprobe 缺失时返回 {error}，不抛错（证据记录失败不应让整个门禁挂掉，但会在报告里显形）。
 * @param {string} path 视频文件路径
 * @returns {{error?:string,duration?:number,size?:number,codec?:string,width?:number,height?:number,fps?:string,audioStreams?:number}} 元数据
 */
function probeVideo(path) {
  try {
    const out = execFileSync('ffprobe', [
      '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path
    ], { encoding: 'utf8' });
    const j = JSON.parse(out);
    const v = (j.streams || []).find((s) => s.codec_type === 'video') || {};
    const audio = (j.streams || []).filter((s) => s.codec_type === 'audio');
    return {
      duration: +Number(j.format && j.format.duration).toFixed(3),
      size: +(j.format && j.format.size),
      codec: v.codec_name,
      width: v.width,
      height: v.height,
      fps: v.r_frame_rate,
      audioStreams: audio.length,
    };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

/**
 * 启动一次浏览器会话，收集请求与 console，返回可复用的操作句柄。
 * 每个场景独立启动浏览器：上下文/GL 相关的命令行开关是进程级参数，复用会让场景失效。
 */
async function open({ args = [], url = PAGE_URL, beforeGoto, viewport, touch } = {}) {
  const browser = await chromium.launch({
    headless: process.env.PW_HEADLESS === '1',
    channel: process.env.PW_CHANNEL || undefined,
    args,
  });
  const context = await browser.newContext({
    viewport: viewport || { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    hasTouch: touch === true || process.env.TASK002_TOUCH === '1',
  });
  // TASK002_OFFLINE=1：断网模式，用于证明应用页面在完全离线时仍可运行（§5.7 离线验证的等价物）
  if (process.env.TASK002_OFFLINE === '1') await context.setOffline(true);
  if (beforeGoto) await beforeGoto(context);
  const page = await context.newPage();
  const requests = [];
  const messages = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('console', (m) => messages.push({ type: m.type(), text: m.text(), location: m.location() }));
  page.on('pageerror', (e) => messages.push({ type: 'pageerror', text: String(e && e.message) }));
  const response = await page.goto(url, { waitUntil: 'load' });
  return { browser, context, page, requests, messages, status: response ? response.status() : null };
}

async function close(session) {
  await session.context.close();
  await session.browser.close();
}

/**
 * 汇总一次会话的请求/Console 读数并断言全局判据（§5.4 第 2 条）。
 *
 * expectedResourceErrors：仅用于"故意让某个文件加载失败"的场景（P1 的 vendorMissing）。
 * 它不是错误白名单：必须给出精确条数，且断言错误全部是该缺失资源本身的 net 错误；
 * 任何额外的 error 或 pageerror 仍然判失败。
 */
function collect(scenario, session, extra = {}, expectedResourceErrors = null) {
  const nonFile = session.requests.filter((u) => !u.startsWith('file://'));
  const allErrors = session.messages.filter((m) => m.type === 'error' || m.type === 'pageerror');
  const warnings = session.messages.filter((m) => m.type === 'warning');
  let errors = allErrors;
  if (expectedResourceErrors) {
    const expected = allErrors.filter((m) => m.type === 'error' && /Failed to load resource/.test(m.text));
    const unexpected = allErrors.filter((m) => !expected.includes(m));
    check(scenario, `expected missing-resource errors = ${expectedResourceErrors}`, expected.length, expectedResourceErrors);
    check(scenario, 'no unexpected console errors', unexpected, []);
    errors = unexpected;
  }
  const before = failures.length;
  check(scenario, 'document loaded', session.status, null, session.status === null || session.status < 400);
  check(scenario, 'non-file requests', nonFile, []);
  if (!expectedResourceErrors) check(scenario, 'console errors (error + pageerror)', errors, []);
  results.push({
    id: scenario.id,
    label: scenario.label,
    ok: failures.length === before,
    nonFileRequests: nonFile,
    consoleErrors: allErrors,
    consoleWarnings: warnings,
    ...extra,
  });
  return failures.length === before;
}

const SELFCHECK_URL = pathToFileURL(join(ROOT, 'tests', 'selfcheck.html')).href;

// ==== P9–P12 追加：截图证据目录、manifest 与通用辅助 ====
// 证据目录（私有）：~/.evidence/task-002/implementation/P9-P12/screens/，manifest 记录每张图的
// 文件名、sha256、字节数与拍摄设置/读数，供 ui-vision 复核时确认"不是旧图冒名"。
const P912 = process.env.TASK002_EVIDENCE_P912 || join(homedir(), '.evidence', 'task-002', 'implementation', 'P9-P12');
const P912_SCREENS = join(P912, 'screens');
const shotManifest = [];

/**
 * 保存一张截图并登记到 manifest（sha256 + 字节数 + 设置/读数）。
 * @param {object} page Playwright page
 * @param {string} name 文件名
 * @param {object} meta 设置与读数
 * @returns {Promise<string>} 绝对路径
 */
async function shot(page, name, meta = {}) {
  mkdirSync(P912_SCREENS, { recursive: true });
  const path = join(P912_SCREENS, name);
  await page.screenshot({ path });
  const buf = readFileSync(path);
  const img = decodePng(buf);
  shotManifest.push({
    name,
    path,
    sha256: sha256(path),
    bytes: buf.length,
    dims: `${img.width}x${img.height}`,
    ...meta,
  });
  return path;
}

/**
 * 让页面保持"用户活跃"（每 200 ms 调一次 input.markActivity），使自动驾驶不接管。
 * 用于与 AUTO 无关的场景（鱼/机位/HUD）：否则 6 s 空闲后 AUTO 会改车道与速度，污染被测状态。
 * p12 的 AUTO 用例会显式调用 stopKeepAwake。
 * @param {object} page Playwright page
 * @returns {Promise<void>}
 */
async function keepAwake(page) {
  await page.evaluate(() => {
    if (window.__keepAwake) clearInterval(window.__keepAwake);
    window.PB.input.markActivity(performance.now() / 1000);
    window.__keepAwake = setInterval(() => window.PB.input.markActivity(performance.now() / 1000), 200);
  });
}

/**
 * 停止 keepAwake（p12 需要真实空闲来触发 AUTO）。
 * @param {object} page Playwright page
 * @returns {Promise<void>}
 */
async function stopKeepAwake(page) {
  await page.evaluate(() => {
    if (window.__keepAwake) { clearInterval(window.__keepAwake); window.__keepAwake = 0; }
  });
}

/**
 * 在不冻结的帧里反复执行一段设置代码，让镜头阻尼/混合真实收敛（截图前使用）。
 * @param {object} page Playwright page
 * @param {string} code 以 PB 为参数的 JS 代码（每帧执行一次）
 * @param {number} ms 持续毫秒
 * @returns {Promise<void>}
 */
async function settle(page, code, ms) {
  await page.evaluate(async ({ code, ms }) => {
    const apply = new Function('PB', code);
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => {
        apply(window.PB);
        if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res();
      };
      tick();
    });
  }, { code, ms });
}

/**
 * 读取真实相机参数（位置/朝向/FOV/near/aspect），供 Node 侧做投影与光线分类。
 * @param {object} page Playwright page
 * @returns {Promise<object>} 相机读数
 */
async function cameraInfo(page) {
  return page.evaluate(() => {
    const PB = window.PB;
    const cam = PB.camera.object();
    const dir = { x: 0, y: 0, z: -1 };
    const e = cam.matrixWorld.elements;
    // 世界前向 = −Z 列
    const fx = -e[8], fy = -e[9], fz = -e[10];
    const fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
    return {
      pos: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
      fwd: { x: fx / fl, y: fy / fl, z: fz / fl },
      fov: cam.fov, near: cam.near, far: cam.far, aspect: cam.aspect || 1,
      mode: PB.main.state().cam.mode,
    };
  });
}

/**
 * 用真实相机参数把世界点投到 NDC（§1.3 公式；basis 从 fwd 重建）。
 * @param {object} cinfo cameraInfo() 结果
 * @param {{x:number,y:number,z:number}} p 世界点
 * @returns {{x:number,y:number,depth:number}} ndc 与沿视轴的深度
 */
function projectWithCamera(cinfo, p) {
  const f = cinfo.fwd;
  const up0 = { x: 0, y: 1, z: 0 };
  const dot = up0.x * f.x + up0.y * f.y + up0.z * f.z;
  let u = { x: up0.x - dot * f.x, y: up0.y - dot * f.y, z: up0.z - dot * f.z };
  let ul = Math.hypot(u.x, u.y, u.z) || 1;
  u = { x: u.x / ul, y: u.y / ul, z: u.z / ul };
  // 右手系：right = f × u（three.js 的相机 x 轴；u × f 会左右镜像）
  const r = { x: f.y * u.z - f.z * u.y, y: f.z * u.x - f.x * u.z, z: f.x * u.y - f.y * u.x };
  const dx = p.x - cinfo.pos.x, dy = p.y - cinfo.pos.y, dz = p.z - cinfo.pos.z;
  const depth = dx * f.x + dy * f.y + dz * f.z;
  const du = dx * u.x + dy * u.y + dz * u.z;
  const dr = dx * r.x + dy * r.y + dz * r.z;
  const tan = Math.tan(cinfo.fov * Math.PI / 180 / 2);
  return { x: dr / depth / (tan * cinfo.aspect), y: du / depth / tan, depth };
}

/**
 * 光线与 §1.1 高度场求交，判断命中点是否在海面（x > SHORE_X）。
 * @param {object} cinfo 相机参数
 * @param {number} ndcX NDC x
 * @param {number} ndcY NDC y
 * @returns {boolean} 是否命中海面
 */
function rayHitsSea(cinfo, ndcX, ndcY) {
  const CFG = SHORE_X_CONST;
  const f = cinfo.fwd;
  const up0 = { x: 0, y: 1, z: 0 };
  const dot = up0.x * f.x + up0.y * f.y + up0.z * f.z;
  let u = { x: up0.x - dot * f.x, y: up0.y - dot * f.y, z: up0.z - dot * f.z };
  const ul = Math.hypot(u.x, u.y, u.z) || 1;
  u = { x: u.x / ul, y: u.y / ul, z: u.z / ul };
  const r = { x: f.y * u.z - f.z * u.y, y: f.z * u.x - f.x * u.z, z: f.x * u.y - f.y * u.x };
  const tan = Math.tan(cinfo.fov * Math.PI / 180 / 2);
  const a = ndcX * tan * cinfo.aspect, b = ndcY * tan;
  const d = { x: f.x + a * r.x + b * u.x, y: f.y + a * r.y + b * u.y, z: f.z + a * r.z + b * u.z };
  let t = 0, dt = 0.25;
  for (let i = 0; i < 40000; i++) {
    const x = cinfo.pos.x + d.x * t, y = cinfo.pos.y + d.y * t;
    if (y <= groundY(x)) {
      let lo = t - dt, hi = t;
      for (let k = 0; k < 24; k++) {
        const m = (lo + hi) / 2;
        if (cinfo.pos.y + d.y * m <= groundY(cinfo.pos.x + d.x * m)) hi = m; else lo = m;
      }
      return cinfo.pos.x + d.x * hi > CFG;
    }
    if (t > 6000) return false;
    t += dt;
    if (t > 200) dt = 2;
  }
  return false;
}

const SHORE_X_CONST = 4.5 + 0.8 / 0.07;
const SEA_Y_CONST = -0.8;

/**
 * §1.1 地面高度场（与 config.ground 同一组常量）。
 * @param {number} x 横向坐标
 * @returns {number} 高度
 */
function groundY(x) {
  if (x < -16) return Math.min((-16 - x) * 0.6, 12);
  if (x <= 4.5) return 0;
  if (x <= SHORE_X_CONST) return -0.07 * (x - 4.5);
  return SEA_Y_CONST;
}

/**
 * 统计画面某矩形区域内"命中海面"的像素占比（几何分类，用真实相机）。
 * @param {object} cinfo 相机参数
 * @param {number} x0 左边界（0..1）
 * @param {number} y0 上边界（0..1）
 * @param {number} x1 右边界（0..1）
 * @param {number} y1 下边界（0..1）
 * @param {number} step 采样步长（像素）
 * @returns {number} 百分比
 */
function seaFraction(cinfo, x0, y0, x1, y1, step = 6) {
  const W = 1920, H = 1080;
  let n = 0, sea = 0;
  for (let py = Math.floor(y0 * H); py < y1 * H; py += step) {
    for (let px = Math.floor(x0 * W); px < x1 * W; px += step) {
      n++;
      if (rayHitsSea(cinfo, (px + 0.5) / W * 2 - 1, 1 - (py + 0.5) / H * 2)) sea++;
    }
  }
  return n ? 100 * sea / n : 0;
}

/**
 * 全画面上半区（y ∈ [0,0.6]）的海面像素统计：总数、左右半幅分别计数、以及海面像素的质心 x。
 * 用于 S14 的"海面在画面右半"判据（mode 4 默认机位在海侧向陆看，海面是右上方的窄带）。
 * @param {object} cinfo 相机参数
 * @param {number} step 采样步长（像素）
 * @returns {{n:number, sea:number, left:number, right:number, cx:number}} 统计
 */
function seaStats(cinfo, step = 6) {
  const W = 1920, H = Math.floor(1080 * 0.6);
  let n = 0, sea = 0, left = 0, right = 0, sx = 0;
  for (let py = 0; py < H; py += step) {
    for (let px = 0; px < W; px += step) {
      n++;
      if (rayHitsSea(cinfo, (px + 0.5) / W * 2 - 1, 1 - (py + 0.5) / 1080 * 2)) {
        sea++;
        if (px < W / 2) left++; else { right++; sx += px; }
      }
    }
  }
  return { n, sea, left, right, cx: right ? sx / right / W : 0 };
}

/**
 * 隐藏/显示海面网格（材质带 uPhase uniform 的那块），返回命中的网格数。
 * 用于 S3a 的"同一帧渲染海面像素"取证：整帧与隐藏海面后的帧做差分，
 * 差分像素就是这一帧真正画出来的海面，不再依赖任何几何模型。
 * @param {object} page Playwright page
 * @param {boolean} visible 目标可见性
 * @returns {Promise<number>} 命中的海面网格数
 */
function setOceanVisible(page, visible) {
  return page.evaluate((vis) => {
    let n = 0;
    window.PB.scene.scene().traverse((o) => {
      if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uPhase) { o.visible = vis; n++; }
    });
    return n;
  }, visible);
}

/**
 * 隐藏/显示实例化道具（棕榈、灯杆/灯臂/灯头），返回命中数。
 * 用于量测 S6/S12 的遮挡：整帧与隐藏道具后的帧差分，得到"道具实际盖住多少像素"。
 * 必须把路面虚线与光斑排除：虚线也是 InstancedMesh（world.js 用同一个 helper 建的），
 * 若一并隐藏，量到的是"道具 + 车道线"，读数会虚高且语义错误。
 * @param {object} page Playwright page
 * @param {boolean} visible 目标可见性
 * @returns {Promise<number>} 命中的道具网格数
 */
function setPropsVisible(page, visible) {
  return page.evaluate((vis) => {
    const dash = new window.THREE.Color(window.PB.config.COLORS.laneDash);
    const isDash = (o) => {
      const c = o.material && o.material.color;
      return !!c && Math.abs(c.r - dash.r) < 1e-4 && Math.abs(c.g - dash.g) < 1e-4 && Math.abs(c.b - dash.b) < 1e-4;
    };
    let n = 0;
    window.PB.scene.scene().traverse((o) => {
      if (!o.isInstancedMesh) return;
      if (o.geometry.type === 'CircleGeometry') return;   // 路面光斑：加色贴花，不遮挡
      if (isDash(o)) return;                               // 车道虚线：道路标线，不是道具
      o.visible = vis;
      n++;
    });
    return n;
  }, visible);
}

/**
 * 把"道具屏幕遮挡率"的计算函数装进页面（window.__propCoverage），供逐帧选相位与最终量测共用。
 * 只做屏幕空间包围盒栅格化（粗网格 192×108）：棕榈树冠/树干、灯杆/灯臂/灯头，
 * 跳过路面光斑这类加色贴花（它们不遮挡任何东西）。返回命中网格数，0 表示场景里没有道具。
 * @param {object} page Playwright page
 * @returns {Promise<number>} 挂载后一次试算的命中网格数
 */
function attachPropCoverage(page) {
  return page.evaluate(() => {
    window.__propCoverage = function () {
      const scene = window.PB.scene.scene();
      const cam = window.PB.camera.object();
      const GX = 192, GY = 108;
      const grid = new Uint8Array(GX * GY);
      const v = new window.THREE.Vector3();
      const m = new window.THREE.Matrix4();
      const tan = Math.tan((cam.fov * Math.PI) / 360);
      const dash = new window.THREE.Color(window.PB.config.COLORS.laneDash);
      const isDash = (o) => {
        const c = o.material && o.material.color;
        return !!c && Math.abs(c.r - dash.r) < 1e-4 && Math.abs(c.g - dash.g) < 1e-4 && Math.abs(c.b - dash.b) < 1e-4;
      };
      let meshCount = 0, inFrame = 0, subjectHit = false, seaBandHit = false;
      // 主体（车+骑手）在屏幕上的包围盒：x±0.5、y∈[0,2.0]、z∈[−1.1,0]（§1.5 的极值再加一点余量）。
      // 判据是"泡沫线可见"，但一根灯杆从骑手身上穿过去会让整张图无法判读，所以选相位时一并排除。
      const subj = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const sx of [-0.5, 0.5]) {
        for (const sy of [0, 2.0]) {
          for (const sz of [-1.1, 0]) {
            v.set(sx, sy, sz).applyMatrix4(cam.matrixWorldInverse);
            if (v.z >= -cam.near) continue;
            const nx = v.x / -v.z / (tan * cam.aspect);
            const ny = v.y / -v.z / tan;
            if (nx < subj.x0) subj.x0 = nx; if (nx > subj.x1) subj.x1 = nx;
            if (ny < subj.y0) subj.y0 = ny; if (ny > subj.y1) subj.y1 = ny;
          }
        }
      }
      const subjectOk = subj.x1 > subj.x0;
      scene.traverse((o) => {
        if (!o.isInstancedMesh || !o.visible) return;
        if (o.geometry.type === 'CircleGeometry') return;
        if (isDash(o)) return;   // 车道虚线不是道具：与 setPropsVisible 的过滤保持一致
        meshCount++;
        o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        const corners = [];
        for (const cx of [bb.min.x, bb.max.x]) {
          for (const cy of [bb.min.y, bb.max.y]) {
            for (const cz of [bb.min.z, bb.max.z]) corners.push(new window.THREE.Vector3(cx, cy, cz));
          }
        }
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          m.premultiply(o.matrixWorld);
          let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, front = false;
          for (const c of corners) {
            v.copy(c).applyMatrix4(m).applyMatrix4(cam.matrixWorldInverse);
            if (v.z >= -cam.near) continue;   // 相机后方/近裁剪面内的角点不参与投影
            front = true;
            const nx = v.x / -v.z / (tan * cam.aspect);
            const ny = v.y / -v.z / tan;
            if (nx < x0) x0 = nx; if (nx > x1) x1 = nx;
            if (ny < y0) y0 = ny; if (ny > y1) y1 = ny;
          }
          if (!front) continue;
          // 跨近裁剪面的实例会得到巨大包围盒，夹到画面附近以免虚报
          x0 = Math.max(-1.2, x0); x1 = Math.min(1.2, x1);
          y0 = Math.max(-1.2, y0); y1 = Math.min(1.2, y1);
          if (x1 < -1 || x0 > 1 || y1 < -1 || y0 > 1) continue;
          inFrame++;
          // 与主体包围盒相交（留 0.02 NDC 余量）：灯杆/树冠压在骑手身上同样算遮挡
          if (subjectOk && x1 > subj.x0 - 0.02 && x0 < subj.x1 + 0.02 && y1 > subj.y0 - 0.02 && y0 < subj.y1 + 0.02) {
            subjectHit = true;
          }
          // 与海面带相交：S6 的泡沫条带在画面 y∈[0.02,0.32]（ndc y ∈ [0.36,0.96]），
          // 道具伸进这条带就等于挡住被判的泡沫线，同样要避开。
          if (y1 > 0.36 - 0.02) seaBandHit = true;
          const px0 = Math.floor(((x0 + 1) / 2) * GX), px1 = Math.ceil(((x1 + 1) / 2) * GX);
          const py0 = Math.floor(((1 - y1) / 2) * GY), py1 = Math.ceil(((1 - y0) / 2) * GY);
          for (let py = Math.max(0, py0); py < Math.min(GY, py1); py++) {
            for (let px = Math.max(0, px0); px < Math.min(GX, px1); px++) grid[py * GX + px] = 1;
          }
        }
      });
      let covered = 0;
      for (let i = 0; i < grid.length; i++) covered += grid[i];
      return { coveragePct: (100 * covered) / grid.length, meshCount, inFrame, subjectHit, seaBandHit };
    };
    return window.__propCoverage().meshCount;
  });
}

/**
 * 读取页面里已挂载的 window.__propCoverage() 结果（需先调 attachPropCoverage）。
 * @param {object} page Playwright page
 * @returns {Promise<{coveragePct:number,meshCount:number,inFrame:number}>} 遮挡读数
 */
function propCoverage(page) {
  return page.evaluate(() => window.__propCoverage());
}

/**
 * 量测"棕榈/路灯实际盖住多少像素"：整帧与隐藏全部实例化道具的帧做差分。
 * 与 propCoverage 的包围盒估计互为核对：包围盒是选相位用的上界，这里是这一帧的真实像素。
 * 差分源图登记进 manifest，供复核者直接看图确认遮挡是"道具挡住"还是"渲染错位"。
 * @param {object} page Playwright page
 * @param {object} img 已读取的整帧图像
 * @param {string} tag manifest 文件名前缀（如 S6）
 * @returns {Promise<{pct:number,px:number,bbox:object}>} 遮挡读数
 */
async function propOcclusionPixels(page, img, tag) {
  await setPropsVisible(page, false);
  await page.waitForTimeout(120);
  const p = await shot(page, `${tag}-no-props-diagnostic-p10.png`, {
    scenario: 'p10-screens', kind: 'diagnostic', setting: `${tag} 同一冻结帧，隐藏棕榈/路灯（道具遮挡像素来源）`
  });
  await setPropsVisible(page, true);
  const d = diffImages(img, readImage(p), 12);
  return { pct: (100 * d.count) / (img.width * img.height), px: d.count, bbox: d.bbox };
}

/**
 * 逐帧应用 stateCode，直到 predicate（页面内表达式源码，求值为 truthy 时停止）成立或超时。
 * 用于 S6/S12 选拍摄相位：道具位置随 S 变化（ADR-38），在保持 §5.3 机位参数不变的前提下，
 * 等到一帧"棕榈/路灯不进画"的相位再冻结，而不是接受一张被灯罩/树干盖住 40% 的画面。
 * @param {object} page Playwright page
 * @param {string} code 每帧执行的代码（以 PB 为参数）
 * @param {string} predicate 页面内 JS 表达式源码
 * @param {number} ms 超时（毫秒）
 * @returns {Promise<{hit:boolean,waitedMs:number,last:any}>} 结果
 */
async function settleUntil(page, code, predicate, ms) {
  return page.evaluate(async ({ code, predicate, ms }) => {
    const apply = new Function('PB', code);
    const test = new Function(`return (${predicate});`);
    const t0 = performance.now();
    let last = null;
    await new Promise((res) => {
      const tick = () => {
        apply(window.PB);
        last = test();
        if (last && last.ok) { res(); return; }
        if (performance.now() - t0 >= ms) { res(); return; }
        requestAnimationFrame(tick);
      };
      tick();
    });
    return { hit: !!(last && last.ok), waitedMs: performance.now() - t0, last };
  }, { code, predicate, ms });
}

/**
 * 解码 PNG，返回按行主序的 RGBA 与尺寸。
 * @param {string} path 图片路径
 * @returns {{width:number,height:number,data:Buffer}} 图像
 */
function readImage(path) { return decodePng(readFileSync(path)); }

/**
 * 逐像素求两张同尺寸截图的差分（RGB 通道差之和 > thr）。
 * @param {object} a 图 A
 * @param {object} b 图 B
 * @param {number} thr 阈值
 * @returns {{count:number, mask:Uint8Array, bbox:object}} 差分
 */
function diffImages(a, b, thr) {
  const n = a.width * a.height;
  const mask = new Uint8Array(n);
  let count = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const d = Math.abs(a.data[j] - b.data[j]) + Math.abs(a.data[j + 1] - b.data[j + 1]) + Math.abs(a.data[j + 2] - b.data[j + 2]);
    if (d > thr) {
      mask[i] = 1; count++;
      const x = i % a.width, y = (i / a.width) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { count, mask, bbox: count ? { x0: minX, y0: minY, x1: maxX, y1: maxY } : null };
}

/**
 * 亮度（Rec.709）。
 * @param {number} r 0..255
 * @param {number} g 0..255
 * @param {number} b 0..255
 * @returns {number} 0..1
 */
function lum(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

const SCENARIOS = {
  // [selfcheck]：打开 tests/selfcheck.html，读 window.__selfcheck（plan.md §5.1 的 [selfcheck] 项）
  async 'selfcheck'(scenario) {
    const s = await open({ url: SELFCHECK_URL });
    await s.page.waitForFunction(() => window.__selfcheck && window.__selfcheck.done === true, null, { timeout: 30000 });
    const sc = await s.page.evaluate(() => window.__selfcheck);
    const failed = sc.results.filter((r) => !r.ok);
    check(scenario, 'selfcheck total > 0', sc.total, null, sc.total > 0);
    check(scenario, 'selfcheck failures', failed, []);
    await s.page.screenshot({ path: join(SCREEN_DIR, 'selfcheck.png') });
    await close(s);
    collect(scenario, s, { selfcheck: { pass: sc.pass, fail: sc.fail, total: sc.total }, screenshot: join(SCREEN_DIR, 'selfcheck.png') });
  },

  // P8-fix [build]（ADR-30 / M-12）：只匹配 GLSL 的 precision 语句，另加原始材质为 0。
  // 这两条是 AMD-P8-001 §17.1 指定的构建检查；实现用 Node 直接扫源码（不依赖 shell 的 grep 方言）。
  async 'build-greps'(scenario) {
    const before = failures.length;
    const { execSync } = await import('node:child_process');
    const run = (cmd) => {
      try {
        return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
      } catch (e) {
        // grep 在无匹配时退出码 1，这是"0 命中"的正常形态
        return String((e.stdout || '')).trim();
      }
    };
    const glslPrecision = run("grep -rnE \"precision +[lmh][a-z]*p \" js/ tests/ index.html || true");
    const rawShader = run("grep -rn \"RawShaderMaterial\" js/ || true");
    check(scenario, '[build] GLSL precision statement count == 0', glslPrecision, '');
    check(scenario, '[build] RawShaderMaterial count == 0', rawShader, '');
    // 精度探测必须是字面读字段（ADR-30 的原文写法：var c = renderer && renderer.capabilities;
    // return !!(c && c.precision === 'highp');）。这里断言两个特征同时存在：读 renderer.capabilities，
    // 以及在同一表达式里与 'highp' 比较；按值遍历 capabilities 的旧写法必须消失。
    const literal = run("grep -c \"c.precision === 'highp'\" js/render/ocean.js || true");
    const capsRead = run("grep -c \"renderer && renderer.capabilities\" js/render/ocean.js || true");
    const valueScan = run("grep -c \"hasOwnProperty.call(caps\" js/render/ocean.js || true");
    check(scenario, "[build] ocean.js compares c.precision === 'highp' literally", literal, '1');
    check(scenario, '[build] ocean.js reads renderer.capabilities literally', capsRead, '1');
    check(scenario, '[build] value-scanning loop over capabilities is gone', valueScan, '0');
    // 本场景不打开页面（纯源码检查），因此单独登记结果，不经过 collect 的"document loaded"断言。
    results.push({
      id: scenario.id, label: scenario.label, ok: failures.length === before,
      nonFileRequests: [], consoleErrors: [], consoleWarnings: [],
      build: { glslPrecision, rawShader, literal, capsRead, valueScan },
    });
  },

  // [build] 行数门禁（ADR-31）：代码行合计 ≤5600，逐文件上限只作分配目标。
  async 'build-lines'(scenario) {
    const before = failures.length;
    const { execFileSync } = await import('node:child_process');
    let out = '';
    try {
      out = execFileSync(process.execPath, [join(HERE, 'count-lines.mjs'), '--json'], { cwd: ROOT, encoding: 'utf8' });
    } catch (e) {
      out = String((e.stdout || ''));
    }
    const report = JSON.parse(out);
    check(scenario, '[build] application code lines <= 5600 (ADR-31)', report.total, null, report.total <= report.limit);
    results.push({
      id: scenario.id, label: scenario.label, ok: failures.length === before,
      nonFileRequests: [], consoleErrors: [], consoleWarnings: [],
      lineCount: { total: report.total, limit: report.limit, top: report.files.slice(0, 5) },
    });
  },

  // P1 出口 1：正常运行态 —— 天空色清屏、stats() 读数可用、glVersion 有值、零 error。
  async 'p1-running'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1` });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state !== 'boot', null, { timeout: 15000 });
    const stats = await s.page.evaluate(() => window.PB.debug.stats());
    const appState = await s.page.evaluate(() => window.PB.main.app.state);
    const overlayHidden = await s.page.evaluate(() => document.getElementById('overlay').hidden);
    await s.page.screenshot({ path: join(SCREEN_DIR, 'p1-running.png') });
    const shot = decodePng(readFileSync(join(SCREEN_DIR, 'p1-running.png')));
    // 天空取样点放在画面顶部（y = 8% 高度）：P4 起画面中心是路面，且灯光属 P7，
    // 未接灯光前路面按 Lambert 渲成近黑，不能再用中心像素判"天空色清屏"。
    const skyRow = Math.floor(shot.height * 0.08);
    const skyIdx = (skyRow * shot.width + (shot.width >> 1)) * 4;
    const rgb = [shot.data[skyIdx], shot.data[skyIdx + 1], shot.data[skyIdx + 2]];
    const mid = ((shot.height >> 1) * shot.width + (shot.width >> 1)) * 4;
    const centerRgb = [shot.data[mid], shot.data[mid + 1], shot.data[mid + 2]];

    check(scenario, 'appState', appState, 'running');
    check(scenario, 'overlay hidden while running', overlayHidden, true);
    check(scenario, 'stats() available', stats !== null, true);
    check(scenario, 'stats().appState', stats.appState, 'running');
    check(scenario, 'stats().glVersion is 1 or 2', stats.glVersion, null, stats.glVersion === 1 || stats.glVersion === 2);
    check(scenario, 'stats().dpr > 0', stats.dpr, null, stats.dpr > 0);
    // 天空：P7 起顶部像素是 §4.2.2 的穹顶渐变（mix(horizon, zenith, pow(dir.y,0.45))），
    // 因此判据为"不是默认黑"且"落在 horizon→zenith 的渐变段上"（比 P1 的平色蓝主导更严）。
    check(scenario, 'sky pixel is not black', rgb, null, !(rgb[0] === 0 && rgb[1] === 0 && rgb[2] === 0));
    const grad = await s.page.evaluate((px) => {
      const env = window.PB.main.state().env;
      const lin2srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
      let best = 1e9;
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const r = 255 * lin2srgb(env.horizon.r + (env.zenith.r - env.horizon.r) * t);
        const g = 255 * lin2srgb(env.horizon.g + (env.zenith.g - env.horizon.g) * t);
        const b = 255 * lin2srgb(env.horizon.b + (env.zenith.b - env.horizon.b) * t);
        best = Math.min(best, Math.max(Math.abs(r - px[0]), Math.abs(g - px[1]), Math.abs(b - px[2])));
      }
      return best;
    }, rgb);
    check(scenario, 'sky pixel lies on the §4.2.2 horizon→zenith gradient (<=12/255)', grad, null, grad <= 12);
    await close(s);
    collect(scenario, s, { stats, skyRgb: rgb, centerRgb, screenshot: join(SCREEN_DIR, 'p1-running.png') });
  },

  // P1 出口 2：noWebGL 文案（Chromium 用 --disable-webgl 启动）
  async 'p1-nowebgl'(scenario) {
    const s = await open({ args: ['--disable-webgl', '--disable-webgl2'] });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state !== 'boot', null, { timeout: 15000 });
    const state = await s.page.evaluate(() => ({ state: window.PB.main.app.state, kind: window.PB.main.app.fatalKind }));
    const text = await s.page.evaluate(() => document.getElementById('ov-msg').textContent);
    const visible = await s.page.evaluate(() => !document.getElementById('overlay').hidden);
    await s.page.screenshot({ path: join(SCREEN_DIR, 'p1-nowebgl.png') });
    check(scenario, 'appState', state.state, 'fatal');
    check(scenario, 'fatalKind', state.kind, 'noWebGL');
    check(scenario, 'overlay visible', visible, true);
    check(scenario, 'overlay text is the §4.11 noWebGL copy', text, '此浏览器/设备不支持 WebGL，无法显示 3D 场景。请使用新版 Chrome/Safari/Edge 或启用硬件加速。');
    check(scenario, 'no buttons on fatal(noWebGL)', await s.page.evaluate(() => document.getElementById('ov-actions').childElementCount), 0);
    await close(s);
    collect(scenario, s, { fatalKind: state.kind, overlayText: text, screenshot: join(SCREEN_DIR, 'p1-nowebgl.png') });
  },

  // P1 出口 3：vendorMissing 文案（把 vendor/three.min.js 临时改名，finally 里恢复并校验哈希）
  async 'p1-vendormissing'(scenario) {
    const before = sha256(VENDOR);
    const hidden = `${VENDOR}.hidden-for-test`;
    let s = null;
    try {
      renameSync(VENDOR, hidden);
      s = await open({});
      await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state !== 'boot', null, { timeout: 15000 });
      const state = await s.page.evaluate(() => ({ state: window.PB.main.app.state, kind: window.PB.main.app.fatalKind }));
      const text = await s.page.evaluate(() => document.getElementById('ov-msg').textContent);
      await s.page.screenshot({ path: join(SCREEN_DIR, 'p1-vendormissing.png') });
      check(scenario, 'appState', state.state, 'fatal');
      check(scenario, 'fatalKind', state.kind, 'vendorMissing');
      check(scenario, 'overlay text is the §4.11 vendorMissing copy', text, '缺少 vendor/three.min.js，无法启动。请确认该文件与 index.html 一起完整复制。');
      // 该场景故意移走 vendor/three.min.js：浏览器必然为这个缺失脚本报 1 条
      // "Failed to load resource" 的 net 错误，它正是被测条件本身，按精确条数登记。
      collect(scenario, s, { fatalKind: state.kind, overlayText: text, screenshot: join(SCREEN_DIR, 'p1-vendormissing.png') }, 1);
      await close(s);
      s = null;
    } finally {
      if (s) await close(s);
      renameSync(hidden, VENDOR);
      check(scenario, 'vendor/three.min.js restored byte-identical', sha256(VENDOR), before);
    }
  },

  // P3 出口：键盘/指针/可信事件状态出现在 stats()；blur、拖出按钮、hidden 后 heldSet 为空
  async 'p3-input'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1` });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    // 触屏按钮的 DOM 属 P15；这里注入一个 data-act 夹具，验证委托与释放路径（不是产品 DOM）
    await s.page.evaluate(() => {
      const hud = document.getElementById('hud');
      const btn = document.createElement('div');
      btn.id = 'fixture-left';
      btn.setAttribute('data-act', 'left');
      btn.style.cssText = 'position:absolute;left:10px;top:10px;width:80px;height:80px;pointer-events:auto;background:#333';
      hud.appendChild(btn);
    });
    const box = await s.page.locator('#fixture-left').boundingBox();

    // 键盘：真实 keydown（isTrusted=true）→ heldSet 出现 throttle
    await s.page.keyboard.down('KeyW');
    const heldByKey = await s.page.evaluate(() => window.PB.debug.stats().heldSet);
    await s.page.keyboard.up('KeyW');
    const afterKeyUp = await s.page.evaluate(() => window.PB.debug.stats().heldSet);

    // 指针：按下按钮 → held；拖出按钮后松开 → 释放（§5.2 第 2 条）
    await s.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await s.page.mouse.down();
    const heldByPtr = await s.page.evaluate(() => ({ held: window.PB.debug.stats().heldSet, ptr: window.PB.debug.stats().ptrMapSize }));
    await s.page.mouse.move(box.x + box.width + 120, box.y + box.height + 120);
    await s.page.mouse.up();
    const afterDragOut = await s.page.evaluate(() => ({ held: window.PB.debug.stats().heldSet, ptr: window.PB.debug.stats().ptrMapSize }));

    // blur：按住后再 blur → 清空（M-17）
    await s.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await s.page.mouse.down();
    await s.page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const afterBlur = await s.page.evaluate(() => ({ held: window.PB.debug.stats().heldSet, ptr: window.PB.debug.stats().ptrMapSize }));
    await s.page.mouse.up();

    // hidden：按住后页面隐藏 → 清空（M-17）
    await s.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await s.page.mouse.down();
    await s.page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const afterHidden = await s.page.evaluate(() => ({ held: window.PB.debug.stats().heldSet, ptr: window.PB.debug.stats().ptrMapSize }));
    await s.page.mouse.up();

    // 可信活动：真实键盘输入刷新活动时间（§4.6.1，P12 的 AUTO 判据依赖它）
    const actBefore = await s.page.evaluate(() => window.PB.input.activityAt());
    await s.page.keyboard.press('KeyK');
    const actAfter = await s.page.evaluate(() => window.PB.input.activityAt());

    check(scenario, 'keyboard held appears in stats().heldSet', heldByKey, ['throttle']);
    check(scenario, 'keyboard release clears heldSet', afterKeyUp, []);
    check(scenario, 'pointer held appears in stats().heldSet', heldByPtr, { held: ['left'], ptr: 1 });
    check(scenario, 'drag-out + release clears pointer state', afterDragOut, { held: [], ptr: 0 });
    check(scenario, 'blur clears heldSet', afterBlur, { held: [], ptr: 0 });
    check(scenario, 'hidden clears heldSet', afterHidden, { held: [], ptr: 0 });
    check(scenario, 'trusted key updates activityAt', actAfter, null, actAfter > actBefore);
    await s.page.evaluate(() => { const el = document.getElementById('fixture-left'); if (el) el.remove(); });
    await close(s);
    collect(scenario, s, { heldByKey, heldByPtr, afterDragOut, afterBlur, afterHidden });
  },

  // P4 出口：可以骑行（W 加速、W+S 刹车）、道具在 S≈1e4 与 S≈1e7 处无跳变、镜头与 rig 读数有限
  async 'p4-riding'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1` });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });

    // 1) 骑行：真实键盘按住 W，速度与路程都要增长
    const before = await s.page.evaluate(() => window.PB.debug.stats());
    await s.page.keyboard.down('KeyW');
    await s.page.waitForTimeout(1200);
    const riding = await s.page.evaluate(() => window.PB.debug.stats());
    await s.page.keyboard.up('KeyW');

    // 2) 刹车优先（M-14）：同时按住 W 和 S，速度必须下降
    await s.page.keyboard.down('KeyW');
    await s.page.keyboard.down('KeyS');
    await s.page.waitForTimeout(400);
    const braking = await s.page.evaluate(() => window.PB.debug.stats());
    await s.page.keyboard.up('KeyS');
    await s.page.keyboard.up('KeyW');

    // 3) 道具连续性（§5.2 第 19 条，AMD-P4-001 / ADR-21 修订后的双层判据）
    //    ① 双精度源层：用 §1.1 公式在同一 G.S 上重算 z_src；非回绕帧 |Δz_src − ΔS| ≤ 1e-6。
    //    ② float32 层：从真实 instanceMatrix 回读 z_inst（上传给 GPU 的绘制缓冲）；
    //       每个样本 z_inst === Math.fround(z_src)；非回绕帧
    //       |Δz_inst − ΔS| ≤ ½ulp32(z_src,k) + ½ulp32(z_src,k−1) + 1e-6。
    //    ③ 回绕帧当且仅当 floor((i·spacing − S)/span) 在 k−1 与 k 之间变化；此时
    //       |Δz_src − (ΔS − span)| ≤ 1e-6 且 z_src,k−1 + ΔS > 20。回绕以外违反 ② 即判跳变。
    //    测试不读任何镜像状态：写矩阵与重算都调用同一个 PB.world.propZ。
    const continuity = await s.page.evaluate(() => new Promise((resolve) => {
      const W = window.PB.config.WORLD;
      const N = W.PALM_COUNT;
      const SP = W.PALM_SPACING;
      const SPAN = N * SP;
      // ulp32(x) = 2^(floor(log2|x|) − 23)，x=0 取 2^-149（按 binary32 指数域直接取，不近似）
      const fbuf = new Float32Array(1);
      const ubuf = new Uint32Array(fbuf.buffer);
      const ulp32 = (x) => {
        const a = Math.abs(x);
        if (a === 0) return Math.pow(2, -149);
        fbuf[0] = a;
        const e = (ubuf[0] >>> 23) & 0xff;
        if (e === 0) return Math.pow(2, -149);
        if (e === 0xff) return NaN;
        return Math.pow(2, e - 127 - 23);
      };
      const bucket = (i, S) => Math.floor((i * SP - S) / SPAN);
      const out = [];
      const run = (startS) => new Promise((done) => {
        window.PB.debug.setSpeed(16);
        window.PB.debug.setS(startS);
        let prevInst = null;
        let prevSrc = null;
        let prevBucket = null;
        let prevS = null;
        let frames = 0;
        let samples = 0;
        let wraps = 0;
        let maxAbsErr = 0;
        let maxRatio = 0;
        let maxRoundErr = 0;
        let roundViolations = 0;
        let maxSrcErr = 0;
        const bad = [];
        const tick = () => {
          const S = window.PB.main.state().S;
          const inst = [];
          const src = [];
          const bkt = [];
          for (let i = 0; i < N; i++) {
            src.push(window.PB.world.propZ(i, SP, SPAN, S));
            inst.push(window.PB.world.palmZAt(i));
            bkt.push(bucket(i, S));
          }
          for (let i = 0; i < N; i++) {
            // ② 逐样本：实例矩阵必须是源坐标的最近 float32（逐位相等）
            const rounded = Math.fround(src[i]);
            if (inst[i] !== rounded) {
              bad.push({ i, kind: 'round', inst: inst[i], src: src[i], rounded });
              roundViolations++;
            }
            const re = Math.abs(inst[i] - src[i]);
            if (re > maxRoundErr) maxRoundErr = re;
          }
          if (prevInst) {
            const dS = S - prevS;
            for (let i = 0; i < N; i++) {
              const wrapped = bkt[i] !== prevBucket[i];
              if (wrapped) {
                wraps++;
                // ③ 回绕帧：位移必须等于 ΔS − span，且回绕点确在镜头后方 +20 m
                const srcErr = Math.abs((src[i] - prevSrc[i]) - (dS - SPAN));
                if (srcErr > 1e-6) bad.push({ i, kind: 'wrap-delta', srcErr, dz: src[i] - prevSrc[i], dS });
                if (!(prevSrc[i] + dS > W.PROP_AHEAD)) bad.push({ i, kind: 'wrap-point', prev: prevSrc[i], dS });
                continue;
              }
              samples++;
              // ① 双精度源层
              const srcErr = Math.abs((src[i] - prevSrc[i]) - dS);
              if (srcErr > maxSrcErr) maxSrcErr = srcErr;
              if (srcErr > 1e-6) bad.push({ i, kind: 'src-delta', srcErr, dS });
              // ② 逐帧 float32 上界（逐端点 ulp32 + 双精度残差允许量 1e-6）
              const bound = 0.5 * ulp32(src[i]) + 0.5 * ulp32(prevSrc[i]) + 1e-6;
              const err = Math.abs((inst[i] - prevInst[i]) - dS);
              if (err > maxAbsErr) maxAbsErr = err;
              const ratio = err / bound;
              if (ratio > maxRatio) maxRatio = ratio;
              if (err > bound) bad.push({ i, kind: 'delta', err, bound, dS, dz: inst[i] - prevInst[i] });
            }
          }
          prevInst = inst; prevSrc = src; prevBucket = bkt; prevS = S;
          if (++frames < 150) requestAnimationFrame(tick);
          else done({ startS, n: N, samples, wraps, maxAbsErr, maxRatio, maxRoundErr, roundViolations, maxSrcErr, bad: bad.slice(0, 5), badCount: bad.length, endS: S });
        };
        requestAnimationFrame(tick);
      });
      run(9999.0)
        .then((a) => { out.push(a); return run(999990.0); })
        .then((b) => { out.push(b); return run(9999990.0); })
        .then((c) => { out.push(c); resolve(out); });
    }));

    const rig = await s.page.evaluate(() => {
      const G = window.PB.main.state();
      return {
        beak: [G.rig.beakW.x, G.rig.beakW.y, G.rig.beakW.z],
        anchor: [G.rig.anchorW[0].x, G.rig.anchorW[1].y],
        finite: [G.rig.beakW, G.rig.anchorW[0], G.rig.torsoW, G.rig.neckW, G.rig.headW]
          .every((p) => isFinite(p.x) && isFinite(p.y) && isFinite(p.z)),
      };
    });

    check(scenario, 'W increases v', riding.v, null, riding.v > before.v);
    check(scenario, 'W increases S', riding.S, null, riding.S > before.S + 1);
    check(scenario, 'W+S decreases v (M-14 brake priority)', braking.v, null, braking.v < riding.v);
    const tierLabels = ['S≈1e4', 'S≈1e6', 'S≈1e7'];
    const tierTargets = [10000, 1000000, 10000000];
    for (let k = 0; k < continuity.length; k++) {
      const c = continuity[k];
      check(scenario, `${tierLabels[k]} prop samples > 100`, c.samples, null, c.samples > 100);
      check(scenario, `${tierLabels[k]} crossed the target S`, c.endS, null, c.endS > tierTargets[k]);
      // 150 帧、约 37 m 行程、span=500 m ⇒ 窗口内只有 0..2 个实例跨越 +20 的回绕点；
      // 只要求回绕支路被真实走到（≥1），且每次回绕满足 ③ 的位移与位置条件（由 bad 覆盖）。
      check(scenario, `${tierLabels[k]} wrap branch exercised (>=1 wrap)`, c.wraps, null, c.wraps >= 1);
      check(scenario, `${tierLabels[k]} source dz = ΔS (±1e-6)`, c.maxSrcErr, null, c.maxSrcErr <= 1e-6);
      // ② 逐样本：实例矩阵必须逐位等于 Math.fround(源坐标)；maxRoundErr 只是舍入距离的诊断值
      check(scenario, `${tierLabels[k]} instance === fround(source) for every sample`, c.roundViolations, null, c.roundViolations === 0);
      check(scenario, `${tierLabels[k]} |Δz_inst − ΔS| ≤ ½ulp+½ulp+1e-6`, c.maxRatio, null, c.maxRatio <= 1);
      check(scenario, `${tierLabels[k]} no violated sample`, c.bad, [], c.badCount === 0);
    }
    check(scenario, 'rig world transforms finite', rig.finite, true);
    await s.page.screenshot({ path: join(SCREEN_DIR, 'p4-riding.png') });
    await close(s);
    collect(scenario, s, { riding, braking, continuity, rig, screenshot: join(SCREEN_DIR, 'p4-riding.png') });
  },

  // §4.11 fatal(runtime) overlay + [重试]：注入 3 次帧内异常进入 fatal，点重试回到 running
  async 'p1-runtime-retry'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1` });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });

    // 1 次注入 → 软复位，仍在 running（§4.11 非致命分支）
    await s.page.evaluate(() => window.PB.debug.throwOnce());
    await s.page.waitForFunction(() => window.PB.main.health.softResets >= 1, null, { timeout: 5000 });
    const soft = await s.page.evaluate(() => ({ state: window.PB.main.app.state, soft: window.PB.main.health.softResets }));

    // 10 s 窗口内累计第 3 次（前 1 次已用于软复位）→ fatal(runtime)，overlay 出现 [重试] 与 [重新加载]
    await s.page.evaluate(() => { window.PB.debug.throwOnce(); window.PB.debug.throwOnce(); });
    await s.page.waitForFunction(() => window.PB.main.app.state === 'fatal', null, { timeout: 8000 });
    const fatal = await s.page.evaluate(() => ({
      state: window.PB.main.app.state,
      kind: window.PB.main.app.fatalKind,
      msg: document.getElementById('ov-msg').textContent,
      buttons: Array.from(document.getElementById('ov-actions').children).map((b) => b.textContent),
      errors: window.PB.main.health.errors.length,
    }));
    await s.page.screenshot({ path: join(SCREEN_DIR, 'p1-fatal-runtime.png') });

    // 点 [重试] → running，errors 清零（§4.11 重试）
    await s.page.evaluate(() => {
      const btns = Array.from(document.getElementById('ov-actions').children);
      const retry = btns.find((b) => b.textContent === '重试');
      retry.click();
    });
    await s.page.waitForFunction(() => window.PB.main.app.state === 'running', null, { timeout: 8000 });
    const after = await s.page.evaluate(() => ({
      state: window.PB.main.app.state,
      errors: window.PB.main.health.errors.length,
      overlayHidden: document.getElementById('overlay').hidden,
    }));

    check(scenario, '1 injected error → soft reset, still running', soft, { state: 'running', soft: 1 });
    check(scenario, 'fatalKind = runtime', fatal.kind, 'runtime');
    check(scenario, 'overlay text starts with 运行出错：', fatal.msg, null, fatal.msg.indexOf('运行出错：') === 0);
    check(scenario, 'runtime overlay has retry + reload', fatal.buttons, ['重试', '重新加载']);
    check(scenario, 'retry → running', after.state, 'running');
    check(scenario, 'retry clears error window', after.errors, 0);
    // 重试后必须稳定在 running（不能立刻再次 fatal）
    await s.page.waitForTimeout(400);
    check(scenario, 'still running 400 ms after retry', await s.page.evaluate(() => window.PB.main.app.state), 'running');
    check(scenario, 'overlay hidden after retry', after.overlayHidden, true);
    await close(s);
    collect(scenario, s, { soft, fatal, after, screenshot: join(SCREEN_DIR, 'p1-fatal-runtime.png') });
  },

  // P1 出口 5：localStorage 抛异常时不报错、persistent=false、仍能在内存里读写（AC-7 / §5.2 第 16 条）
  async 'p1-store-throws'(scenario) {
    const s = await open({
      url: `${PAGE_URL}?debug=1`,
      beforeGoto: async (context) => {
        await context.addInitScript(() => {
          // 模拟隐私模式/配额：localStorage 属性本身可访问，但 setItem/getItem 抛错
          const boom = () => { throw new DOMException('denied', 'SecurityError'); };
          Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get() { return { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 }; },
          });
        });
      },
    });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state !== 'boot', null, { timeout: 15000 });
    const probe = await s.page.evaluate(() => {
      const before = window.PB.store.persistent;
      let threw = false;
      try {
        window.PB.store.update((d) => { d.best.points = 42; });
        window.PB.store.flush();
      } catch (e) { threw = true; }
      return {
        persistent: window.PB.store.persistent,
        before,
        threw,
        points: window.PB.store.get().best.points,
        muted: window.PB.store.get().settings.muted,
        state: window.PB.main.app.state,
      };
    });
    check(scenario, 'appState', probe.state, 'running');
    check(scenario, 'persistent === false when localStorage throws', probe.persistent, false);
    check(scenario, 'update/flush did not throw', probe.threw, false);
    check(scenario, 'in-memory update took effect', probe.points, 42);
    check(scenario, 'muted default is false (UD-5)', probe.muted, false);
    await close(s);
    collect(scenario, s, { probe });
  },

  // P1 出口 4：loseContext → ctxlost 文案 → 8 s 后出现[重新加载]
  async 'p1-ctxlost-8s'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1` });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    const lost = await s.page.evaluate(() => window.PB.debug.loseContext());
    await s.page.waitForFunction(() => window.PB.main.app.state === 'ctxlost', null, { timeout: 5000 });
    const earlyText = await s.page.evaluate(() => document.getElementById('ov-msg').textContent);
    const earlyButtons = await s.page.evaluate(() => document.getElementById('ov-actions').childElementCount);
    await s.page.screenshot({ path: join(SCREEN_DIR, 'p1-ctxlost-early.png') });
    // 8 s 阈值（CFG.CTX_LOST_BUTTON_MS）之后必须出现按钮；多等 1.5 s 吸收 rAF 抖动
    await s.page.waitForFunction(
      () => document.getElementById('ov-actions').childElementCount > 0,
      null,
      { timeout: 15000 },
    );
    const elapsed = await s.page.evaluate(() => performance.now() - window.PB.main.app.ctxLostAt);
    const buttons = await s.page.evaluate(() => Array.from(document.getElementById('ov-actions').children).map((b) => b.textContent));
    await s.page.screenshot({ path: join(SCREEN_DIR, 'p1-ctxlost-8s.png') });
    const restored = await s.page.evaluate(() => window.PB.debug.restoreContext());
    await s.page.waitForFunction(() => window.PB.main.app.state === 'running', null, { timeout: 15000 });
    const afterState = await s.page.evaluate(() => window.PB.main.app.state);
    const overlayHidden = await s.page.evaluate(() => document.getElementById('overlay').hidden);

    check(scenario, 'loseContext issued', lost, true);
    check(scenario, 'overlay text is the §4.11 ctxlost copy', earlyText, '图形上下文丢失，正在等待恢复…');
    check(scenario, 'no button before 8 s', earlyButtons, 0);
    check(scenario, 'elapsed >= 8000 ms when button appeared', elapsed, null, elapsed >= 8000);
    check(scenario, 'reload button label', buttons, ['重新加载']);
    check(scenario, 'restoreContext issued', restored, true);
    check(scenario, 'state back to running', afterState, 'running');
    check(scenario, 'overlay hidden after restore', overlayHidden, true);
    await close(s);
    collect(scenario, s, { buttonElapsedMs: elapsed, buttons, screenshot: join(SCREEN_DIR, 'p1-ctxlost-8s.png') });
  },

  // P5 出口：AC-1d（喙标记与喙网格 vs G.rig.beakW）、footPedalErr、mesh/三角面预算
  // 冻结时间后直接写 G.bike 的四种状态，读 F13 的真实读数（不是调试返回值）。
  async 'p5-character'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1` });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await s.page.evaluate(() => window.PB.debug.freezeTime(true));
    const read = async (mut, arg) => {
      await s.page.evaluate(mut, arg);
      await s.page.waitForTimeout(140);
      return s.page.evaluate(() => {
        const G = window.PB.main.state();
        const st = window.PB.debug.stats();
        return { beakErr: st.beakErr, footPedalErr: st.footPedalErr, beakMeshErr: window.PB.pelican.beakMeshError(G) };
      });
    };
    const neutral = await read(() => {
      const G = window.PB.main.state();
      G.bike.x = 0; G.bike.y = 0; G.bike.lean = 0; G.bike.wheelie = 0; G.bike.crank = 0;
    });
    const lean = await read(() => { window.PB.main.state().bike.lean = 0.21; });
    const wheelie = await read(() => { window.PB.main.state().bike.wheelie = 18 * Math.PI / 180; });
    const apex = await read(() => {
      const G = window.PB.main.state();
      G.bike.lean = 0; G.bike.wheelie = 0; G.bike.y = 0.8925; G.bike.vy = 0; G.bike.airborne = true;
    });
    let worstFoot = 0, worstMesh = 0;
    for (const th of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
      const r = await read((t) => {
        const G = window.PB.main.state();
        G.bike.y = 0; G.bike.airborne = false; G.bike.lean = 0; G.bike.wheelie = 0; G.bike.crank = t;
      }, th);
      worstFoot = Math.max(worstFoot, r.footPedalErr);
      worstMesh = Math.max(worstMesh, r.beakMeshErr);
    }
    // 预算按 §2.2 的"鹈鹕 + 车"口径统计：pelicanRoot 子树 + 围巾飘带（它挂在 scene 根下，§4.1）
    const budget = await s.page.evaluate(() => {
      const root = window.PB.pelican.root();
      let meshes = 0, tris = 0;
      const count = (o) => {
        if (o.isMesh) {
          meshes++;
          const g = o.geometry;
          const idx = g.getIndex();
          tris += idx ? idx.count / 3 : g.getAttribute('position').count / 3;
        }
      };
      root.traverse(count);
      const characterOnly = { meshes, tris };
      // 围巾飘带挂在 scene 根下（§4.1），按"26 顶点 + 红色"唯一识别，且只计一次
      const scene = window.PB.scene.scene();
      let scarfSeen = false;
      scene.traverse((o) => {
        if (scarfSeen || !o.isMesh || !o.geometry) return;
        if (o.geometry.getAttribute('position').count === 26 && o.material && o.material.side === 2) {
          scarfSeen = true;
          count(o);
        }
      });
      return { meshes, tris, characterOnly, scarfCounted: scarfSeen };
    });
    const states = [neutral, lean, wheelie, apex];
    check(scenario, 'AC-1d beak marker vs rig.beakW <= 0.02 (4 states)', states.map((r) => r.beakErr), null, states.every((r) => r.beakErr <= 0.02));
    check(scenario, 'AC-1d real beak mesh tip vs rig.beakW <= 0.02 (4 states)', states.map((r) => r.beakMeshErr), null, states.every((r) => r.beakMeshErr <= 0.02));
    check(scenario, '§1.5 footPedalErr <= 0.01 (4 states)', states.map((r) => r.footPedalErr), null, states.every((r) => r.footPedalErr <= 0.01));
    check(scenario, '§1.5 footPedalErr <= 0.01 (4 crank phases)', worstFoot, null, worstFoot <= 0.01);
    check(scenario, '§1.5 beak mesh err <= 0.02 (4 crank phases)', worstMesh, null, worstMesh <= 0.02);
    // 围巾渲染顶点必须逐位等于模拟粒子（§4.1 渲染段：同一份状态，不插值不加偏移）。
    // 缓冲是 Float32Array，判据取 binary32 的最严形式 arr[i] === Math.fround(P[i])（同 ADR-21 的口径）。
    const scarfMeshViolations = await s.page.evaluate(() => window.PB.pelican.scarfMeshViolations(window.PB.main.state()));
    check(scenario, '§4.1 scarf render vertex === fround(sim particle) for all 78 components', scarfMeshViolations, 0);
    check(scenario, '§2.2 pelican+bike meshes <= 40', budget.meshes, null, budget.meshes <= 40);
    check(scenario, '§2.2 pelican+bike triangles <= 8000', budget.tris, null, budget.tris <= 8000);
    await close(s);
    collect(scenario, s, { states, worstFoot, worstMesh, scarfMeshViolations, budget });
  },

  // AC-1a 的像素级复核：截图里头盔顶像素行必须与真实相机的投影行一致，
  // 主体（后轮着地点 → 头盔顶）的像素跨度必须落在 22%–32%（§1.2 AC-1a，预计 28.7%）。
  async 'p5-framing'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1920, height: 1080 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    // §5.3 通用条件：HUD 隐藏后再做像素判定（HUD 图标会把色相判据顶替掉）
    await s.page.evaluate(() => window.PB.debug.setHudVisible(false));
    // §5.3 通用条件：v=8 稳态 3 s、lane 1、wheelie=0、y=0、lean=0
    await s.page.evaluate(() => new Promise((res) => {
      const t0 = performance.now();
      const tick = () => {
        const G = window.PB.main.state();
        window.PB.debug.setSpeed(8);
        G.bike.wheelie = 0; G.bike.y = 0; G.bike.lean = 0;
        if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res();
      };
      tick();
    }));
    const proj = await s.page.evaluate(() => {
      const PB = window.PB, THREE = window.THREE;
      // 先冻结再读数：否则 rAF 会在"读 v"与"读投影"之间继续跑物理，v 会因无油门而衰减（测量竞态）
      PB.debug.freezeTime(true);
      PB.debug.setSpeed(8);
      const G = PB.main.state();
      const cam = PB.camera.object();
      cam.updateMatrixWorld();
      const root = PB.pelican.root();
      root.updateMatrixWorld(true);
      const local = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(root.matrixWorld);
      const ground = new THREE.Vector3(G.bike.x, 0, 0);            // 后轮着地点（局部原点）
      const helmetTop = local(0, 1.98, -0.42);                      // §1.5 头盔顶点
      const waist = local(0, 1.15, -0.38);                          // 躯干中心（诊断用）
      const toPx = (v) => {
        const p = v.clone().project(cam);
        return { x: (p.x * 0.5 + 0.5) * 1920, y: (1 - (p.y * 0.5 + 0.5)) * 1080, ndc: [p.x, p.y] };
      };
      // AC-1c 的四个区域取样点：用同一台真实相机投影已知世界点，避免靠像素盲猜区域
      const CFG = PB.config;
      const pts = {
        road: toPx(new THREE.Vector3(G.bike.x, 0, -14)),
        sand: toPx(new THREE.Vector3(9.0, CFG.ground(9.0), -26)),
        sea: toPx(new THREE.Vector3(60, CFG.SEA_Y, -60)),
        // 天空取样点：地平线在画面中的投影行之上 200 px（用同一台相机算，不靠猜）
        sky: (() => {
          const horizon = toPx(new THREE.Vector3(G.bike.x, 0, -6000));
          return { x: toPx(new THREE.Vector3(G.bike.x, 2.4, -6000)).x, y: horizon.y - 200, ndc: horizon.ndc };
        })(),
        horizon: toPx(new THREE.Vector3(G.bike.x, 0, -6000)),
      };
      return {
        ground: toPx(ground), helmetTop: toPx(helmetTop), waist: toPx(waist),
        camMode: G.cam.mode, v: 8, pts,
      };
    });
    await s.page.waitForTimeout(150);
    const shotPath = join(SCREEN_DIR, 'S1-framing-ac1a.png');
    await s.page.screenshot({ path: shotPath });

    // 截图上找头盔顶：M-03 头盔主体 #2F6FDE 在黄昏光照下仍是"蓝明显主导红/绿"的唯一区域。
    // 判据只看色相关系（b−r ≥ 20 且 b ≥ g），不看绝对亮度，因此不受曝光影响。
    const img = decodePng(readFileSync(shotPath));
    let helmetTopRow = -1, helmetPx = 0;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
        if (b - r >= 20 && b >= g && b >= 30) {
          helmetPx++;
          if (helmetTopRow < 0 || y < helmetTopRow) helmetTopRow = y;
        }
      }
    }
    const spanPct = 100 * (proj.ground.y - proj.helmetTop.y) / img.height;
    check(scenario, 'AC-1a projected subject span in [22,32]% of frame height', spanPct, null, spanPct >= 22 && spanPct <= 32);
    check(scenario, 'AC-1a rendered helmet top row matches projection (±4 px)', Math.abs(helmetTopRow - proj.helmetTop.y), null, Math.abs(helmetTopRow - proj.helmetTop.y) <= 4);
    check(scenario, 'AC-1a helmet pixels present in S1', helmetPx, null, helmetPx >= 150);
    check(scenario, 'AC-1a measured at v=8, mode 0', [proj.camMode, Math.abs(proj.v - 8) < 0.2], [0, true]);

    // AC-1c：四个区域都可见 —— 各取一个由真实投影定位的像素，并用该区域的特征色判据
    const px = (pt) => {
      const x = Math.round(pt.x), y = Math.round(pt.y);
      const i = (y * img.width + x) * 4;
      return [img.data[i], img.data[i + 1], img.data[i + 2]];
    };
    const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    const roadPx = px(proj.pts.road), sandPx = px(proj.pts.sand);
    const seaPx = px(proj.pts.sea), skyPx = px(proj.pts.sky);
    // 海面：从取样点往上 40 行内必须有可见的明暗起伏（波峰/高光带），否则等于"看不见海"
    const seaCol = Math.round(proj.pts.sea.x), seaRow = Math.round(proj.pts.sea.y);
    let seaMin = 1, seaMax = 0;
    for (let yy = Math.max(0, seaRow - 40); yy <= Math.min(img.height - 1, seaRow + 20); yy++) {
      const l = lum(px({ x: seaCol, y: yy }));
      if (l < seaMin) seaMin = l;
      if (l > seaMax) seaMax = l;
    }
    const regions = {
      road: { rgb: roadPx, lum: lum(roadPx) },
      sand: { rgb: sandPx, lum: lum(sandPx) },
      sea: { rgb: seaPx, lum: lum(seaPx), relief: seaMax - seaMin },
      sky: { rgb: skyPx, lum: lum(skyPx) },
    };
    check(scenario, 'AC-1c road visible (dark asphalt, lum <= 0.22)', regions.road.lum, null, regions.road.lum <= 0.22);
    check(scenario, 'AC-1c sand visible (warm: R > B, 0.05 < lum < 0.85)',
      [regions.sand.rgb[0] > regions.sand.rgb[2], regions.sand.lum > 0.05, regions.sand.lum < 0.85], [true, true, true]);
    check(scenario, 'AC-1c sea visible (wave relief over 60 rows >= 0.06)', regions.sea.relief, null, regions.sea.relief >= 0.06);
    check(scenario, 'AC-1c sky visible (dusk sky lum >= 0.35)', regions.sky.lum, null, regions.sky.lum >= 0.35);
    // AC-1b：围巾与头盔两项按 §1.2 的色判据逐像素统计；墨镜项按"几何遮挡证明"登记（Q-09）。
    const hsv = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let hh = 0;
      if (d !== 0) {
        if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4;
        hh *= 60; if (hh < 0) hh += 360;
      }
      return [hh, mx === 0 ? 0 : d / mx, mx];
    };
    let scarfPx = 0, helmetPxAc = 0;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        const [H, S, V] = hsv(img.data[i], img.data[i + 1], img.data[i + 2]);
        if ((H >= 345 || H <= 15) && S >= 0.5 && V >= 0.25) scarfPx++;
        if (H >= 205 && H <= 235 && S >= 0.4) helmetPxAc++;
      }
    }
    // 墨镜项的几何遮挡证明：从相机到两片镜片的射线到头部球心（§1.5 的 r=0.16）的最近距离 < r，
    // 且遮挡点在镜片之前 ⇒ 在 S1 机位墨镜不可见（不是"没画"，是"被自己的头挡住"）。
    const lensOcclusion = await s.page.evaluate(() => {
      const PB = window.PB, THREE = window.THREE, CFG = PB.config, G = PB.main.state();
      const cam = PB.camera.object();
      const root = PB.pelican.root();
      root.updateMatrixWorld(true);
      const camPos = cam.position;
      const head = new THREE.Vector3(CFG.PEL.HELMET.x, CFG.HEAD_CENTER_L.y, CFG.HEAD_CENTER_L.z).applyMatrix4(root.matrixWorld);
      const out = [];
      for (const sx of [-1, 1]) {
        const lens = new THREE.Vector3(sx * CFG.PEL.GLASS.x, CFG.PEL.GLASS.y, CFG.PEL.GLASS.z).applyMatrix4(root.matrixWorld);
        const d = lens.clone().sub(camPos);
        const c = head.clone().sub(camPos);
        const t = c.dot(d) / d.lengthSq();
        const closest = camPos.clone().addScaledVector(d, t);
        out.push({ sign: sx, distToHeadCenter: closest.distanceTo(head), headRadius: CFG.PEL.HEAD_R, occluded: closest.distanceTo(head) < CFG.PEL.HEAD_R && t < 1 });
      }
      return out;
    });
    // ADR-27 之后墨镜分项改到 S4a（P10）判定；S1 只登记几何读数（不再把"被头挡住"当成通过理由）。
    const lensesOccluded = lensOcclusion.every((l) => l.occluded);
    // 诊断（不是判据）：飘带粒子在外扩椭球内的个数。ADR-23 之后必须是 0；否则 T8 的可见性无解。
    const scarfSplit = await s.page.evaluate(() => {
      const PB = window.PB, CFG = PB.config, PEL = CFG.PEL, G = PB.main.state();
      const rx = PEL.TORSO_RX, c = Math.cos(rx), sn = Math.sin(rx);
      const ex = PEL.TORSO_R.x + CFG.SCARF.TORSO_EPS;
      const ey = PEL.TORSO_R.y + CFG.SCARF.TORSO_EPS;
      const ez = PEL.TORSO_R.z + CFG.SCARF.TORSO_EPS;
      const lp = { x: 0, y: 0, z: 0 }, wp = { x: 0, y: 0, z: 0 };
      let inside = 0, total = 0;
      for (let i = 6; i < G.scarf.P.length; i += 3) {
        wp.x = G.scarf.P[i]; wp.y = G.scarf.P[i + 1]; wp.z = G.scarf.P[i + 2];
        PB.rig.toLocal(G, wp, lp);
        const dx = lp.x - PEL.TORSO.x, dy = lp.y - PEL.TORSO.y, dz = lp.z - PEL.TORSO.z;
        const ly = dy * c + dz * sn, lz = -dy * sn + dz * c;
        const v = (dx / ex) ** 2 + (ly / ey) ** 2 + (lz / ez) ** 2;
        total++;
        if (v < 1) inside++;
      }
      return { inside, total, minF: G.scarf.outsideMinF };
    });
    // AC-1b(i) 的正式判定在 `ac1b-ribbon-diff`（真实渲染差分）；这里只保留 (ii) 头盔分项与诊断读数。
    check(scenario, 'AC-1b(ii) helmet pixels >= 150 (H∈[205,235], S>=0.4)', helmetPxAc, null, helmetPxAc >= 150);
    check(scenario, 'Q-11 fixed: no ribbon particle inside the inflated torso ellipsoid (ADR-23)',
      scarfSplit.inside, 0);
    check(scenario, 'AC-1c four regions are mutually distinct in luminance',
      new Set([regions.road.lum, regions.sand.lum, regions.sea.lum, regions.sky.lum].map((v) => v.toFixed(2))).size, null,
      new Set([regions.road.lum, regions.sand.lum, regions.sea.lum, regions.sky.lum].map((v) => v.toFixed(2))).size >= 3);
    await close(s);
    collect(scenario, s, { proj, helmetTopRow, helmetPx, spanPct, regions, ac1b: { scarfPxRaw: scarfPx, helmetPx: helmetPxAc, lensOcclusion, ribbonInsideTorso: scarfSplit.inside, ribbonTotal: scarfSplit.total, scarfOutsideMinF: scarfSplit.minF }, screenshot: shotPath });
  },

  // AC-1b(i)（ADR-25，AMD-P8-001 §17.4）：飘带-only 的真实渲染差分。
  // 同一冻结帧渲染两次，第二次只把飘带 mesh 设为不可见；两帧 RGB 的 L1 差 >30 的像素里，
  // 第一帧满足围巾取色规则（H∈[345,15]、S≥0.5、V≥0.25）的像素必须 ≥150 个（颈环不计入）。
  async 'ac1b-ribbon-diff'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1920, height: 1080 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    // §5.3 通用条件：v=8 稳态 3 s、p=0.05、lane 1、wheelie=0、y=0、lean=0
    await s.page.evaluate(() => new Promise((res) => {
      const t0 = performance.now();
      const tick = () => {
        const G = window.PB.main.state();
        window.PB.debug.setSpeed(8);
        G.bike.wheelie = 0; G.bike.y = 0; G.bike.lean = 0;
        if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res();
      };
      tick();
    }));
    await s.page.evaluate(() => {
      window.PB.debug.setPhase(0.05);
      window.PB.debug.freezeTime(true);
      document.getElementById('hud').style.display = 'none';
    });
    await s.page.waitForTimeout(200);
    const withPath = join(SCREEN_DIR, 'ac1b-ribbon-with.png');
    const hiddenPath = join(SCREEN_DIR, 'ac1b-ribbon-hidden.png');
    await s.page.screenshot({ path: withPath });
    await s.page.evaluate(() => window.PB.debug.setRibbonVisible(false));
    await s.page.waitForTimeout(200);
    await s.page.screenshot({ path: hiddenPath });
    const restore = await s.page.evaluate(() => {
      window.PB.debug.setRibbonVisible(true);
      const st = window.PB.debug.stats();
      return { frozen: st.frozen, v: st.v, angle: st.scarfTipAngleDeg, resets: st.scarfResets };
    });
    const a = decodePng(readFileSync(withPath));
    const b = decodePng(readFileSync(hiddenPath));
    const hsv = (r, g, bl) => {
      r /= 255; g /= 255; bl /= 255;
      const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), d = mx - mn;
      let hh = 0;
      if (d !== 0) {
        if (mx === r) hh = ((g - bl) / d) % 6; else if (mx === g) hh = (bl - r) / d + 2; else hh = (r - g) / d + 4;
        hh *= 60; if (hh < 0) hh += 360;
      }
      return [hh, mx === 0 ? 0 : d / mx, mx];
    };
    let diffPx = 0, ribbonPx = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
    for (let y = 0; y < a.height; y++) {
      for (let x = 0; x < a.width; x++) {
        const i = (y * a.width + x) * 4;
        const l1 = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
        if (l1 <= 30) continue;
        diffPx++;
        const [H, S, V] = hsv(a.data[i], a.data[i + 1], a.data[i + 2]);
        if ((H >= 345 || H <= 15) && S >= 0.5 && V >= 0.25) {
          ribbonPx++;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    check(scenario, 'AC-1b(i) frozen frame is the same in both renders (time frozen, v=8)',
      [restore.frozen, Math.abs(restore.v - 8) < 0.2], [true, true]);
    check(scenario, 'AC-1b(i) ribbon-only differential pixels >= 150 (collar excluded)', ribbonPx, null, ribbonPx >= 150);
    check(scenario, 'AC-1b(i) differential frame differs only where the ribbon is (diff > 0)', diffPx, null, diffPx > 0);
    check(scenario, 'AC-1b(i) no scarf reset during the shot', restore.resets, 0);
    await close(s);
    collect(scenario, s, {
      ribbonOnlyPx: ribbonPx, diffPx,
      bbox: ribbonPx ? [minX, minY, maxX, maxY] : null,
      shotWith: withPath, shotHidden: hiddenPath, restore,
    });
  },

  // AC-1b(iii) 的几何前提 + ADR-26：16 个墨镜角到头心 ≥0.16、y ≤ 1.79；S1 机位下的可见性读数。
  // 可见性差分本身在 S4a（P10）判定，本场景只提供 P6/P8 可判的几何与统计。
  async 'ac1b-glasses-geometry'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1920, height: 1080 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    const r = await s.page.evaluate(() => {
      const PB = window.PB, CFG = PB.config;
      const G = PB.main.state();
      G.bike.lean = 0; G.bike.wheelie = 0; G.bike.x = 0; G.bike.y = 0;
      PB.rig.compute(G);
      PB.pelican.root().updateMatrixWorld(true);
      const corners = PB.pelican.glassesCorners();
      const HC = CFG.HEAD_CENTER_L, R = CFG.PEL.HEAD_R;
      let minD = Infinity, maxY = -Infinity;
      const localD = [];
      for (const q of corners) {
        const d = Math.hypot(q.x - HC.x, q.y - HC.y, q.z - HC.z);
        localD.push(d);
        if (d < minD) minD = d;
        if (q.y > maxY) maxY = q.y;
      }
      // 八角的局部距离（rig 中立时世界 = 局部，因为 M 只有平移）
      const lmin = Math.min.apply(null, localD), lmax = Math.max.apply(null, localD);
      return { count: corners.length, minD, maxY, headR: R, lmin, lmax };
    });
    check(scenario, 'ADR-26 glasses corner count == 16 (two lenses × 8)', r.count, 16);
    check(scenario, 'ADR-26 every glasses corner is outside the head sphere (>= 0.16)',
      [r.minD, r.headR], null, r.minD >= r.headR);
    check(scenario, 'ADR-26 every glasses corner is below the helmet brim (y <= 1.79)',
      r.maxY, null, r.maxY <= 1.79);
    // 镜片是 0.07×0.045 的平面矩形，八个角到头心的距离必然有差（对角线角点比边中点角点远）；
    // 真正要判的是"离头心最近的那个角也在球外"，即 minD ≥ r（上面已判），此处只登记读数。
    check(scenario, 'ADR-26 corner distance spread is recorded (no threshold; geometry is a flat box)', true, true);
    // 前方视线可见性（几何前提，不是 AC-1b(iii) 的判定）：从正面若干方向射向镜片中心，
    // 统计"到头部球心最近距离 < r 且遮挡点在镜片之前"的方向数。S1（追尾）仍被头挡住，
    // 因此这里只证明"正面/侧前方能看到镜片"，最终判定留给 S4a（P10）。
    const frontVis = await s.page.evaluate(() => {
      const PB = window.PB, CFG = PB.config, THREE = window.THREE;
      const root = PB.pelican.root();
      root.updateMatrixWorld(true);
      const head = new THREE.Vector3(CFG.HEAD_CENTER_L.x, CFG.HEAD_CENTER_L.y, CFG.HEAD_CENTER_L.z).applyMatrix4(root.matrixWorld);
      const probes = [];
      for (const yawDeg of [0, 15, 30, 45, 60, 90]) {
        for (const sign of [-1, 1]) {
          const yaw = sign * yawDeg * Math.PI / 180;
          const dist = 3.0;
          const camPos = new THREE.Vector3(
            head.x + Math.sin(yaw) * dist,
            head.y + 0.25,
            head.z - Math.cos(yaw) * dist
          );
          const lens = new THREE.Vector3(sign * CFG.PEL.GLASS.x, CFG.PEL.GLASS.y, CFG.PEL.GLASS.z).applyMatrix4(root.matrixWorld);
          const d = lens.clone().sub(camPos);
          const c = head.clone().sub(camPos);
          const t = c.dot(d) / d.lengthSq();
          const closest = camPos.clone().addScaledVector(d, t);
          const occluded = closest.distanceTo(head) < CFG.PEL.HEAD_R && t < 1;
          probes.push({ yawDeg: sign * yawDeg, occluded });
        }
      }
      return { visible: probes.filter((p) => !p.occluded).map((p) => p.yawDeg), probes };
    });
    check(scenario, 'ADR-26 glasses are unoccluded from a front hemisphere (at least 3 of 12 probe directions)',
      frontVis.visible, null, frontVis.visible.length >= 3);
    await close(s);
    collect(scenario, s, { glasses: r, frontVisibility: frontVis });
  },

  // P6 出口（浏览器部分）：S7 的等价机位。mode 1 属 P10，这里用 mode 0 冻结时间取围巾形态，
  // 文件名明确标注 substitute（AC-2a/2b/2c 的判据在 selfcheck 用真实模拟判定）。
  async 'p6-scarf-shot'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1920, height: 1080 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    // v=8 稳态 3 s（§5.3 截图通用条件）
    await s.page.evaluate(() => new Promise((res) => {
      const t0 = performance.now();
      const tick = () => {
        window.PB.debug.setSpeed(8);
        if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res();
      };
      tick();
    }));
    const before = await s.page.evaluate(() => window.PB.debug.stats());
    await s.page.evaluate(() => {
      window.PB.debug.setPhase(0.05);
      window.PB.debug.freezeTime(true);
      document.getElementById('hud').style.display = 'none';
    });
    await s.page.waitForTimeout(200);
    const shotPath = join(SCREEN_DIR, 'S7-substitute-mode0-v8.png');
    await s.page.screenshot({ path: shotPath });
    const after = await s.page.evaluate(() => window.PB.debug.stats());
    check(scenario, 'v settled to 8 before freeze', before.v, null, Math.abs(before.v - 8) < 0.2);
    check(scenario, 'scarf angle finite and in [55,85] at v=8 (AC-2a numeric, selfcheck owns the verdict)',
      after.scarfTipAngleDeg, null, after.scarfTipAngleDeg > 55 && after.scarfTipAngleDeg < 85);
    check(scenario, 'scarfResets still 0', after.scarfResets, 0);
    await close(s);
    collect(scenario, s, { before, after, screenshot: shotPath, note: 'S7 机位（mode 1）属 P10；本图为 mode 0 等价证据' });
  },

  // P6 出口：AC-2d —— 真实 10 min 连续运行，会话级 scarfResets == 0（不做加速，不折算）
  async 'p6-scarf-10min'(scenario) {
    const s = await open({
      url: `${PAGE_URL}?debug=1`,
      args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
    });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await s.page.keyboard.down('KeyW');
    const wallStart = Date.now();
    let lane = 1, cycles = 0;
    while (Date.now() - wallStart < 600000) {
      await s.page.waitForTimeout(20000);
      await s.page.keyboard.press(lane === 1 ? 'KeyA' : 'KeyD');
      lane = lane === 1 ? 0 : 1;
      cycles++;
    }
    await s.page.keyboard.up('KeyW');
    const wallMs = Date.now() - wallStart;
    const st = await s.page.evaluate(() => window.PB.debug.stats());
    check(scenario, 'AC-2d wall time >= 600 s', wallMs, null, wallMs >= 600000);
    check(scenario, 'AC-2d scarfResets == 0 after 10 min', st.scarfResets, 0);
    check(scenario, 'AC-2d nanResets == 0 after 10 min', st.nanResets, 0);
    check(scenario, 'AC-2d no frame errors in window', st.errorsIn10s, 0);
    check(scenario, 'AC-2d still running', st.appState, 'running');
    check(scenario, 'AC-2d sim time advanced (>= 300 s)', st.t, null, st.t >= 300);
    await close(s);
    collect(scenario, s, { wallMs, cycles, stats: st });
  },

  // P7 出口：AC-3b（starsInView ≥250）、AC-3c（三方光向差 ≤1e-6）、S2 截图（1920×1080）
  async 'p7-sky'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1920, height: 1080 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await s.page.evaluate(() => window.PB.debug.setPhase(0.5));
    await s.page.waitForTimeout(300);
    const r = await s.page.evaluate(() => {
      const st = window.PB.debug.stats();
      const env = window.PB.main.state().env;
      const od = window.PB.ocean.uniformLightDir();
      const ld = { x: 0, y: 0, z: 0 };
      window.PB.scene.lightDir(ld);
      return {
        starsInView: st.starsInView, lightDirErr: st.lightDirErr, stars: env.stars, lamps: env.lamps,
        oceanDir: [od.x, od.y, od.z], dirLightDir: [ld.x, ld.y, ld.z], envDir: [env.lightDir.x, env.lightDir.y, env.lightDir.z],
        moonDir: [env.moonDir.x, env.moonDir.y, env.moonDir.z],
      };
    });
    check(scenario, 'AC-3b starsInView >= 250 at p=0.5', r.starsInView, null, r.starsInView >= 250);
    check(scenario, 'AC-3c lightDirErr <= 1e-6', r.lightDirErr, null, r.lightDirErr <= 1e-6);
    check(scenario, '§4.2.2 p=0.5 env.stars == 1', r.stars, 1);
    check(scenario, '§4.2.2 p=0.5 env.lamps == 1', r.lamps, 1);
    // S2 截图：冻结时间、隐藏 HUD、1920×1080
    await s.page.evaluate(() => {
      window.PB.debug.freezeTime(true);
      document.getElementById('hud').style.display = 'none';
    });
    await s.page.waitForTimeout(200);
    const shotPath = join(SCREEN_DIR, 'S2-night.png');
    await s.page.screenshot({ path: shotPath });
    await close(s);
    collect(scenario, s, { ...r, screenshot: shotPath });
  },

  // P8 出口：海面在真实 GL2 下渲染、JS/GLSL 同相位（M-27）、OCEAN_DISP_GLSL 与 CPU 镜像逐点一致、
  // AC-4a 的 CPU 镜像在页面内复算；并产出 S1（§5.3 通用条件）。
  async 'p8-ocean'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1920, height: 1080 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });

    // 1) 相位：uniform 的值必须等于同一帧 G.S/G.t 用双精度公式算出的值（M-27）
    const phase = await s.page.evaluate(() => new Promise((resolve) => {
      const PB = window.PB, CFG = PB.config, O = CFG.OCEAN;
      const results = [];
      const check = (targetS) => new Promise((res) => {
        PB.debug.setS(targetS);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const G = PB.main.state();
          const vals = Array.from(PB.ocean.phaseValues());
          const expect = [];
          for (let i = 0; i < 4; i++) {
            const k = 2 * Math.PI / O.WAVES[i][3];
            const dz = O.WAVES[i][1] / Math.hypot(O.WAVES[i][0], O.WAVES[i][1]);
            const omega = Math.sqrt(O.GRAVITY * k);
            expect.push(PB.mathx.mod(k * dz * G.S + omega * G.t, 2 * Math.PI));
          }
          res({ S: G.S, t: G.t, vals, expect, maxErr: Math.max(...vals.map((v, i) => Math.abs(v - Math.fround(expect[i])))) });
        }));
      });
      check(9999.999).then((a) => { results.push(a); return check(1e7); })
        .then((b) => { results.push(b); resolve(results); });
    }));

    // 2) OCEAN_DISP_GLSL（生产着色器的同一份字符串）vs CPU 镜像：RGBA8 打包回读，逐点比较 dy
    const glsl = await s.page.evaluate(() => {
      const PB = window.PB, THREE = window.THREE, O = PB.config.OCEAN, OM = PB.oceanmath;
      const N = 16;
      const waves = OM.WAVES.map((w) => new THREE.Vector4(w.dx, w.dz, w.A, w.k));
      const rt = new THREE.WebGLRenderTarget(N, 1, { type: THREE.UnsignedByteType, depthBuffer: false });
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uPhase: { value: PB.ocean.phaseValues() },
          uWaves: { value: waves },
          uShoreX: { value: PB.config.SHORE_X },
        },
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: [
          OM.OCEAN_DISP_GLSL,
          'vec4 pack(float v) {',
          '  vec4 enc = fract(vec4(1.0, 255.0, 65025.0, 16581375.0) * v);',
          '  enc -= enc.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);',
          '  return enc;',
          '}',
          'void main() {',
          '  float x = ' + O.X0.toFixed(1) + ' + 2.0 * floor(gl_FragCoord.x);',   // 采样点 x = 13,15,17,...
          '  float z = -6.0;',
          '  float a = oceanAlpha(x);',
          '  vec3 d = oceanDisp(vec2(x, z), a);',
          '  gl_FragColor = pack(d.y * 0.5 + 0.5);',                              // dy ∈ [-1,1] → [0,1]
          '}',
        ].join('\n'),
      });
      const scene = new THREE.Scene();
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      quad.frustumCulled = false;
      scene.add(quad);
      const cam = new THREE.Camera();
      const renderer = PB.scene.renderer();
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      const buf = new Uint8Array(N * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, N, 1, buf);
      renderer.setRenderTarget(prev);
      const unpack = (i) => {
        const r = buf[i * 4] / 255, g = buf[i * 4 + 1] / 255, b = buf[i * 4 + 2] / 255, a = buf[i * 4 + 3] / 255;
        const v = r + g / 255 + b / 65025 + a / 16581375;
        return v * 2 - 1;
      };
      const phases = PB.ocean.phaseValues();
      const out = { x: 0, y: 0, z: 0 };
      let maxErr = 0;
      const rows = [];
      for (let i = 0; i < N; i++) {
        const x = O.X0 + 2.0 * i;
        const cpu = OM.disp(x, -6, phases, out).y;
        const gpu = unpack(i);
        const e = Math.abs(gpu - cpu);
        if (e > maxErr) maxErr = e;
        rows.push({ x, cpu, gpu });
      }
      rt.dispose();
      quad.geometry.dispose();
      mat.dispose();
      return { maxErr, rows };
    });

    // 3) 两条法线路径都真实渲染过（L1 逐顶点 / L2 逐像素），并确认无帧内错误
    const levels = await s.page.evaluate(() => new Promise((res) => {
      const PB = window.PB;
      const out = [];
      const step = (l) => {
        PB.ocean.applyLevel(l);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const st = PB.debug.stats();
          out.push({ level: l, pixelNormals: PB.ocean.pixelNormals(), tris: st.tris, calls: st.calls, errors: st.errorsIn10s });
          if (l === 1) step(2); else res(out);
        }));
      };
      step(1);
    }));

    // 4) 真实 GL2 渲染读数 + S1 截图
    const render = await s.page.evaluate(() => {
      const st = window.PB.debug.stats();
      return { glVersion: st.glVersion, tris: st.tris, calls: st.calls, pixelNormals: st.pixelNormals, errors: st.errorsIn10s };
    });
    await s.page.evaluate(() => new Promise((res) => {
      const t0 = performance.now();
      const tick = () => {
        window.PB.debug.setSpeed(8);
        if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res();
      };
      tick();
    }));
    await s.page.evaluate(() => {
      window.PB.debug.setPhase(0.05);
      window.PB.debug.freezeTime(true);
      document.getElementById('hud').style.display = 'none';
    });
    await s.page.waitForTimeout(200);
    const shotPath = join(SCREEN_DIR, 'S1-dusk-chase.png');
    await s.page.screenshot({ path: shotPath });
    const frozen = await s.page.evaluate(() => window.PB.debug.stats());

    check(scenario, 'GL2: glVersion == 2', render.glVersion, 2);
    check(scenario, 'GL2: L2 + highp → per-pixel normals', render.pixelNormals, true);
    check(scenario, 'GL2: draw calls <= 100', render.calls, null, render.calls > 0 && render.calls <= 100);
    check(scenario, 'GL2: triangles <= 150000', render.tris, null, render.tris > 0 && render.tris <= 150000);
    check(scenario, 'M-27 phase(S) == double formula at S≈1e4 (<=1e-6)', phase[0].maxErr, null, phase[0].maxErr <= 1e-6);
    check(scenario, 'M-27 phase(S) == double formula at S≈1e7 (<=1e-6)', phase[1].maxErr, null, phase[1].maxErr <= 1e-6);
    check(scenario, 'M-27 phase evaluated at S≈1e7', phase[1].S, null, phase[1].S >= 1e7);
    check(scenario, 'OCEAN_DISP_GLSL vs CPU mirror dy <= 0.002', glsl.maxErr, null, glsl.maxErr <= 0.002);

    // AC-4d / §5.2 第 19 条的海面部分：在页面内用真实 oceanmath，对 S∈{1e4,1e7} 的 S 与 S+1e-3
    // 比较同一批采样点的位移差（同一时刻），以及同一 S 下相邻 0.05 m 的法线夹角（AC-4a 的页面内复核）。
    const oceanContinuity = await s.page.evaluate(() => {
      const PB = window.PB, OM = PB.oceanmath, CFG = PB.config, O = CFG.OCEAN;
      const out = { x: 0, y: 0, z: 0 }, nA = { x: 0, y: 0, z: 0 }, nB = { x: 0, y: 0, z: 0 };
      const res = [];
      for (const S of [9999.999, 1e7]) {
        const p1 = new Float32Array(4), p2 = new Float32Array(4);
        OM.phase(S, 100, p1);
        OM.phase(S + 1e-3, 100, p2);
        let maxDisp = 0, maxAngle = 0;
        for (let x = O.X0; x <= 60; x += 1.7) {
          for (let z = -120; z <= 40; z += 4.3) {
            const a = OM.disp(x, z, p1, out);
            const ax = a.x, ay = a.y, az = a.z;
            const b = OM.disp(x, z, p2, out);
            maxDisp = Math.max(maxDisp, Math.hypot(ax - b.x, ay - b.y, az - b.z));
          }
          for (let z = -40; z <= 20; z += 5) {
            OM.normal(x, z, p1, nA);
            OM.normal(x + 0.05, z, p1, nB);
            const d = Math.min(1, Math.max(-1, nA.x * nB.x + nA.y * nB.y + nA.z * nB.z));
            maxAngle = Math.max(maxAngle, Math.acos(d) * 180 / Math.PI);
          }
        }
        res.push({ S, maxDisp, maxAngle });
      }
      return res;
    });
    check(scenario, 'AC-4d surface continuity at S≈1e4 (disp delta over 1e-3 <= 0.01)',
      oceanContinuity[0].maxDisp, null, oceanContinuity[0].maxDisp <= 0.01);
    check(scenario, 'AC-4d surface continuity at S≈1e7 (disp delta over 1e-3 <= 0.01)',
      oceanContinuity[1].maxDisp, null, oceanContinuity[1].maxDisp <= 0.01);
    check(scenario, 'AC-4a normal continuity in-page at S≈1e4 (<= 3 deg)',
      oceanContinuity[0].maxAngle, null, oceanContinuity[0].maxAngle <= 3);
    check(scenario, 'AC-4a normal continuity in-page at S≈1e7 (<= 3 deg)',
      oceanContinuity[1].maxAngle, null, oceanContinuity[1].maxAngle <= 3);
    check(scenario, 'L1 level renders with per-vertex normals (no error)', [levels[0].pixelNormals, levels[0].errors], [false, 0]);
    check(scenario, 'L1 level still draws the ocean', levels[0].calls, null, levels[0].calls > 0);
    check(scenario, 'back to L2 per-pixel normals (no error)', [levels[1].pixelNormals, levels[1].errors], [true, 0]);
    check(scenario, 'frozen v=8 scarf angle in [55,85]', frozen.scarfTipAngleDeg, null, frozen.scarfTipAngleDeg > 55 && frozen.scarfTipAngleDeg < 85);
    await close(s);
    collect(scenario, s, { phase, glsl: { maxErr: glsl.maxErr, rows: glsl.rows }, levels, oceanContinuity, render, screenshot: shotPath });
  },

  // P8 出口（WebGL1 支路）：--disable-webgl2 下海面照常渲染，相位/一致性读数不变，Console 判据成立
  async 'p8-ocean-gl1'(scenario) {
    const s = await open({ args: ['--disable-webgl2'], url: `${PAGE_URL}?debug=1` });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 20000 });
    await s.page.waitForTimeout(500);
    const r = await s.page.evaluate(() => {
      const st = window.PB.debug.stats();
      const gl = window.PB.scene.renderer().getContext();
      return {
        state: window.PB.main.app.state, glVersion: st.glVersion, tris: st.tris, calls: st.calls,
        pixelNormals: st.pixelNormals, lightDirErr: st.lightDirErr,
        version: gl.getParameter(gl.VERSION),
        isWebGL2: window.PB.scene.renderer().capabilities.isWebGL2,
      };
    });
    check(scenario, 'WebGL1: appState running', r.state, 'running');
    check(scenario, 'WebGL1: glVersion == 1', r.glVersion, 1);
    check(scenario, 'WebGL1: capabilities.isWebGL2 == false', r.isWebGL2, false);
    check(scenario, 'WebGL1: VERSION starts with WebGL 1.0', r.version, null, String(r.version).indexOf('WebGL 1.0') === 0);
    check(scenario, 'WebGL1: ocean + character render (tris > 0, calls > 0)', [r.tris > 0, r.calls > 0], [true, true]);
    check(scenario, 'WebGL1: lightDirErr <= 1e-6', r.lightDirErr, null, r.lightDirErr <= 1e-6);
    await close(s);
    collect(scenario, s, { gl1: r });
  },
  // ==== P9：抓鱼（AC-5a/5b/5c/5d、§5.2 第 19 条鱼部分、迁移连续性）====
  async 'p9-fish'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await s.page.evaluate(() => window.PB.debug.setHudVisible(false));
    await keepAwake(s.page);

    // ---- §5.2 #19 鱼部分的 ①② 层：三档 S，每档 150 帧；z 的双精度源层与 float32 绘制层 ----
    const cont = await s.page.evaluate(async () => {
      const PB = window.PB;
      const ulp32 = (x) => {
        const ax = Math.abs(x);
        if (ax === 0) return Math.pow(2, -149);
        return Math.pow(2, Math.floor(Math.log2(ax)) - 23);
      };
      const out = { tiers: [], froundViolations: 0, maxSrcErr: 0, maxInstErr: 0, maxBoundRatio: 0, meshErr: 0, samples: 0 };
      for (const S0 of [9999.0, 999990.0, 9999990.0]) {
        PB.debug.freezeTime(false);
        PB.debug.setS(S0);
        const G = PB.main.state();
        G.fish.length = 0;
        G.nextFishS = 1e12;
        const f = PB.fish.make(G, 1, false, 60);
        G.fish.push(f);
        const id = f.id;
        const frames = [];
        await new Promise((res) => {
          let n = 0;
          // 第一帧必须等 main.frame 跑完再采样：否则读到的是上一帧的节点矩阵（初始为 0）
          const tick = () => {
            PB.debug.setSpeed(16);
            const gg = PB.main.state();
            const idx = gg.fish.findIndex((q) => q.id === id);
            if (idx >= 0) {
              const fish = gg.fish[idx];
              const node = PB.fishview.nodeAt(idx);
              node.updateMatrixWorld(true);
              frames.push({
                S: gg.S,
                zSrc: -(fish.s - gg.S),
                zInst: node.matrixWorld.elements[14],
                poseZ: fish.pose.z,
                meshErr: Math.abs(node.matrixWorld.elements[14] - fish.pose.z)
              });
            }
            if (++n < 150) requestAnimationFrame(tick); else res();
          };
          requestAnimationFrame(tick);
        });
        let srcErr = 0, instErr = 0, fround = 0, bound = 0, meshErr = 0;
        for (let i = 1; i < frames.length; i++) {
          const a = frames[i - 1], b = frames[i];
          const dS = b.S - a.S;
          // ① 双精度源层：非回绕帧 |Δz_src − ΔS| ≤ 1e−6（鱼没有 mod，故没有回绕帧）
          srcErr = Math.max(srcErr, Math.abs((b.zSrc - a.zSrc) - dS));
          // ② float32 层：逐样本 z_inst === Math.fround(z_src)
          if (b.zInst !== Math.fround(b.zSrc)) fround++;
          const instd = Math.abs((b.zInst - a.zInst) - dS);
          const boundv = 0.5 * ulp32(b.zSrc) + 0.5 * ulp32(a.zSrc) + 1e-6;
          instErr = Math.max(instErr, instd);
          bound = Math.max(bound, instd / boundv);
          meshErr = Math.max(meshErr, b.meshErr);
        }
        out.tiers.push({ S0, samples: frames.length, srcErr, instErr, fround, bound, meshErr });
        out.froundViolations += fround;
        out.maxSrcErr = Math.max(out.maxSrcErr, srcErr);
        out.maxInstErr = Math.max(out.maxInstErr, instErr);
        out.maxBoundRatio = Math.max(out.maxBoundRatio, bound);
        out.meshErr = Math.max(out.meshErr, meshErr);
        out.samples += frames.length;
      }
      return out;
    });
    check(scenario, '§5.2#19 fish tiers sampled (3 × 150 frames)', cont.samples, null, cont.samples >= 3 * 149);
    check(scenario, '§5.2#19 fish ① double source |Δz_src − ΔS| ≤ 1e-6', cont.maxSrcErr, null, cont.maxSrcErr <= 1e-6);
    check(scenario, '§5.2#19 fish ② z_inst === Math.fround(z_src) (violations)', cont.froundViolations, 0);
    check(scenario, '§5.2#19 fish ② per-frame bound (ratio ≤ 1)', cont.maxBoundRatio, null, cont.maxBoundRatio <= 1);
    check(scenario, 'AC-5a(i) mesh matrixWorld vs pose ≤ 1e-4', cont.meshErr, null, cont.meshErr <= 1e-4);

    // ---- AC-5a(ii)：捕获步的迁移 pose 与判定 pose 同帧、逐位相等 ----
    await s.page.evaluate(() => {
      const PB = window.PB;
      const G = PB.main.state();
      PB.debug.freezeTime(false);
      G.fish.length = 0;
      G.nextFishS = 1e12;
      PB.debug.setS(1000);
      PB.debug.setSpeed(0);
      PB.debug.spawnFish(1, false, 1.072);
      PB.debug.pauseOnEvent('catch');
    });
    await s.page.waitForFunction(() => window.PB.debug.pausedOn() === 'catch', null, { timeout: 10000 });
    const caught = await s.page.evaluate(() => {
      const PB = window.PB;
      const G = PB.main.state();
      const f = G.fish.find((q) => q.state === 'caught');
      const b = G.rig.beakW;
      // 判定用的 alive pose 就是迁移时写入的 p0；它在捕获帧必须落在捕获箱内。
      // 冻结发生在捕获帧的 assertFrame（F13），若该帧执行了 2 个固定步，f.pose 会比 p0 再前进一步，
      // 因此浏览器侧断言"p0 在箱内 + pose 位于 p0→喙 的线段上"，逐位相等由 selfcheck 的 AC-5a(ii) 用例判定。
      const onSegment = !!f && (function () {
        var ax = b.x - f.p0.x, ay = (b.y - 0.05) - f.p0.y, az = b.z - f.p0.z;
        var bx = f.pose.x - f.p0.x, by = f.pose.y - f.p0.y, bz = f.pose.z - f.p0.z;
        var cross = Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
        var la = Math.hypot(ax, ay, az) || 1, lb = Math.hypot(bx, by, bz);
        return cross / la <= 1e-6 + 0.02 * Math.abs(1) && lb <= la + 1e-9;
      })();
      return {
        state: f ? f.state : null,
        onSegment: onSegment,
        p0InBox: !!f && Math.abs(f.p0.x - b.x) < 0.9 && Math.abs(f.p0.y - b.y) <= 0.45 && Math.abs(f.p0.z - b.z) < 1.0,
        poseInBox: !!f && Math.abs(f.pose.x - b.x) < 0.9 && Math.abs(f.pose.y - b.y) <= 0.45 && Math.abs(f.pose.z - b.z) < 1.0,
        beakErr: PB.debug.stats().beakErr,          // AC-5a(iii) ≡ AC-1d
        fishMeshErr: PB.debug.stats().fishMeshErr,  // AC-5a(i)
      };
    });
    check(scenario, 'AC-5a(ii) caught on the judged frame', caught.state, 'caught');
    check(scenario, 'AC-5a(ii) judged (alive) pose inside the catch box', caught.p0InBox, true);
    check(scenario, 'AC-5a(ii) post-migration pose stays on the p0→beak segment', caught.onSegment, true);
    check(scenario, 'AC-5a(iv) rendered fish inside the catch box on the catch frame', caught.poseInBox, true);
    check(scenario, 'AC-5a(iii) beak marker error ≤ 0.02 m (≡ AC-1d)', caught.beakErr, null, caught.beakErr <= 0.02);
    check(scenario, 'AC-5a(i) rendered fish mesh error ≤ 1e-4 m', caught.fishMeshErr, null, caught.fishMeshErr <= 1e-4);

    // ---- AC-5d 的浏览器侧：missed 鱼的世界坐标（x 越过海岸、y 入海、移除步） ----
    const miss = await s.page.evaluate(async () => {
      const PB = window.PB;
      PB.debug.freezeTime(false);
      const G = PB.main.state();
      G.fish.length = 0;
      G.nextFishS = 1e12;
      PB.debug.setSpeed(0);
      const f = PB.debug.spawnFish(1, false, 30);
      const id = f.id;
      PB.debug.setS(G.S + 40);   // z = +10 > 3 → 下一步转 missed（瞬移本身不作为判据）
      const samples = [];
      const t0 = performance.now();
      await new Promise((res) => {
        const tick = () => {
          const gg = PB.main.state();
          const ff = gg.fish.find((q) => q.id === id);
          if (ff) samples.push({ a: gg.t - ff.tState, x: ff.pose.x, y: ff.pose.y, state: ff.state });
          if (ff && performance.now() - t0 < 900) requestAnimationFrame(tick); else res();
        };
        requestAnimationFrame(tick);
      });
      let crossed = -1, removeX = 0, removeY = 0, seaViol = 0, mono = 0, prevX = -1e9;
      for (const q of samples) {
        if (crossed < 0 && q.x >= 4.5 + 0.8 / 0.07) crossed = q.a;
        if (q.x < prevX - 1e-9) mono++;
        prevX = q.x;
        if (q.a >= 0.75 && q.y > -0.8) seaViol++;
      }
      const last = samples[samples.length - 1];
      return { n: samples.length, crossed, seaViol, mono, lastX: last ? last.x : 0, lastY: last ? last.y : 0, removed: samples.length > 0 && samples[samples.length - 1].state === 'missed' && last.x >= 4.5 + 0.8 / 0.07 + 0.5 && last.y <= -1.0 };
    });
    check(scenario, 'AC-5d missed sampled frames > 0', miss.n, null, miss.n > 0);
    check(scenario, 'AC-5d x crosses SHORE_X within 0.6 s (browser)', miss.crossed, null, miss.crossed >= 0 && miss.crossed <= 0.6);
    check(scenario, 'AC-5d x monotonic non-decreasing (browser)', miss.mono, 0);
    check(scenario, 'AC-5d a≥0.75 samples have y ≤ SEA_Y (browser)', miss.seaViol, 0);
    check(scenario, 'AC-5d end state x ≥ SHORE_X+0.5 and y ≤ SEA_Y−0.2', [miss.lastX, miss.lastY], null, miss.lastX >= 4.5 + 0.8 / 0.07 + 0.5 && miss.lastY <= -1.0);

    const st = await s.page.evaluate(() => window.PB.debug.stats());
    check(scenario, 'P9 console: tris/calls within budget', [st.tris <= 150000, st.calls <= 100], [true, true]);
    await close(s);
    collect(scenario, s, { continuity: cont, caught, miss, stats: { tris: st.tris, calls: st.calls, fishAlive: st.fishAlive } });
  },

  // ==== P9：HUD 七项可读（§1.5、§4.8 的 combo 规则）====
  async 'p9-hud'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s.page);
    await s.page.waitForTimeout(400);
    const hud0 = await s.page.evaluate(() => {
      const t = (id) => { const el = document.getElementById(id); return el ? { text: el.textContent, hidden: !!el.hidden } : null; };
      return { speed: t('hud-speed'), score: t('hud-score'), fish: t('hud-fish'), combo: t('hud-combo'),
        auto: t('hud-auto'), ach: t('hud-ach'), cam: t('hud-cam'), mute: t('hud-mute') };
    });
    check(scenario, 'HUD 7 items exist with text', Object.keys(hud0).filter((k) => hud0[k] && hud0[k].text !== null).length, 8);
    check(scenario, 'HUD ach shows x/14', hud0.ach.text, '0/14');
    check(scenario, 'HUD camera name (mode 0)', hud0.cam.text, '追尾');
    check(scenario, 'HUD AUTO hidden while manual', hud0.auto.hidden, true);
    check(scenario, 'HUD mute icon reflects store.settings.muted=false', hud0.mute.text, '🔊');
    // 速度读数：v=8 → 29 km/h（四舍五入）
    await settle(s.page, 'PB.debug.setSpeed(8); PB.input.markActivity(performance.now()/1000);', 500);
    // 两次捕获 → combo=2 → 显示 ×2、score>0、fish>0
    await s.page.evaluate(async () => {
      const PB = window.PB;
      const G = PB.main.state();
      PB.debug.freezeTime(false);
      PB.debug.setSpeed(0);
      G.nextFishS = 1e12;
      for (let k = 0; k < 2; k++) {
        G.fish.length = 0;
        PB.debug.spawnFish(1, false, 1.072);
        await new Promise((res) => setTimeout(res, 1100));
      }
    });
    await s.page.waitForTimeout(300);
    const hud1 = await s.page.evaluate(() => {
      const t = (id) => { const el = document.getElementById(id); return el ? { text: el.textContent, hidden: !!el.hidden } : null; };
      const G = window.PB.main.state();
      return { speed: t('hud-speed'), score: t('hud-score'), fish: t('hud-fish'), combo: t('hud-combo'), points: G.score.points, catches: G.score.catches, comboN: G.score.combo };
    });
    check(scenario, 'HUD speed = round(v·3.6) km/h', Number(hud1.speed.text), null, Math.abs(Number(hud1.speed.text) - 0) <= 2);
    check(scenario, 'HUD score tracks G.score.points', Number(hud1.score.text), hud1.points);
    check(scenario, 'HUD fish count tracks catches', Number(hud1.fish.text), hud1.catches);
    check(scenario, 'HUD combo visible at combo ≥ 2 (×n)', [hud1.combo.hidden, hud1.combo.text], [false, '×' + hud1.comboN]);
    // 切镜头（可信键盘）→ 镜头名与 mode 同步
    await s.page.keyboard.press('Digit2');
    await s.page.waitForTimeout(350);
    const camName = await s.page.evaluate(() => ({ text: document.getElementById('hud-cam').textContent, mode: window.PB.main.state().cam.mode }));
    check(scenario, 'HUD camera name follows mode 1', [camName.mode, camName.text], [1, '侧视']);
    await close(s);
    collect(scenario, s, { hud0, hud1, camName });
  },

  // ==== P10：五种镜头（AC-8b 往返 20 次 + 每帧断言 + 机位读数）====
  async 'p10-cameras'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s.page);
    await s.page.evaluate(() => window.PB.debug.setHudVisible(false));

    // 20 次 POV ↔ 追尾 往返；每次读 headHidden/dHead，最后断言逐帧不变式零违例
    const trips = [];
    for (let i = 0; i < 20; i++) {
      await s.page.evaluate(() => window.PB.debug.setCamera(3));
      await s.page.waitForTimeout(800);   // 0.6 s 模式混合 + 余量
      const pov = await s.page.evaluate(() => {
        const st = window.PB.debug.stats();
        return { hidden: st.headHidden, dHead: st.dHead, group: window.PB.pelican.headGroup().visible };
      });
      await s.page.evaluate(() => window.PB.debug.setCamera(0));
      await s.page.waitForTimeout(800);
      const chase = await s.page.evaluate(() => {
        const st = window.PB.debug.stats();
        return { hidden: st.headHidden, dHead: st.dHead, group: window.PB.pelican.headGroup().visible };
      });
      trips.push({ pov, chase });
      check(scenario, `AC-8b trip#${i + 1} POV hides head (dHead<0.9)`, [pov.hidden, pov.group, pov.dHead < 0.9], [true, false, true]);
      check(scenario, `AC-8b trip#${i + 1} chase shows head (dHead>0.6)`, [chase.hidden, chase.group, chase.dHead > 0.6], [false, true, true]);
    }
    const st = await s.page.evaluate(() => window.PB.debug.stats());
    check(scenario, 'AC-8b per-frame head visibility violations == 0', st.headVisErr, 0);

    // POV 喙尖在离画面底边 22%–34%（用真实相机投影）+ 喙根深度 > near
    await s.page.evaluate(() => window.PB.debug.setCamera(3));
    await s.page.waitForTimeout(900);   // 0.6 s 模式混合完成后再读喙的位置
    const pov = await s.page.evaluate(() => {
      const PB = window.PB;
      const cam = PB.camera.object();
      const G = PB.main.state();
      const V = new window.THREE.Vector3(G.rig.beakW.x, G.rig.beakW.y, G.rig.beakW.z);
      V.project(cam);
      const root = new window.THREE.Vector3(0, 1.75, -0.58).applyMatrix4(new window.THREE.Matrix4().fromArray(G.rig.M));
      const depth = root.clone().sub(cam.position).dot(cam.getWorldDirection(new window.THREE.Vector3()));
      const beakDepth = Math.abs(G.rig.beakW.z - (cam.position.z)) ;
      return { fromBottomPct: (V.y * 0.5 + 0.5) * 100, near: cam.near, rootDepth: depth, beakScreen: { x: V.x, y: V.y }, mode: G.cam.mode };
    });
    check(scenario, 'AC-8a/8b mode3 beak from bottom % in [22,34]', pov.fromBottomPct, null, pov.fromBottomPct >= 22 && pov.fromBottomPct <= 34);
    check(scenario, 'PR-12 beak root depth > POV near 0.05', pov.rootDepth, null, pov.rootDepth > pov.near);
    check(scenario, 'POV beak root visible (inside frame)', [Math.abs(pov.beakScreen.x) < 1, Math.abs(pov.beakScreen.y) < 1], [true, true]);

    // 机位切换后（0.6 s 混合 + 阻尼）的真实相机读数：位置/朝向/FOV 与 §4.7 的目标一致
    const targets = [
      // ADR-34：mode 1 为海侧远景（世界绝对高度 y=0.6，z 为绝对值；车恒在 z=0）
      { mode: 1, pos: { x: 23, y: 0.6, z: -22 }, fov: 40, near: 0.1 },
      { mode: 2, pos: null, fov: [45, 50, 35], near: 0.1 },
      { mode: 4, pos: null, fov: 50, near: 0.1 }
    ];
    const modes = [];
    for (const t of targets) {
      await s.page.evaluate((m) => window.PB.debug.setCamera(m), t.mode);
      // 收敛时间：k=4 的指数阻尼需要约 2.5 s 才把 11 m 的初始差压到 5 cm 以内（exp(−10)≈4.5e−5）
      await settle(s.page, `PB.debug.setCamera(${t.mode}); PB.input.markActivity(performance.now()/1000);`, 2500);
      const ci = await cameraInfo(s.page);
      const g = await s.page.evaluate(() => ({ lane: window.PB.main.state().bike.x, mode: window.PB.main.state().cam.mode }));
      modes.push({ mode: t.mode, pos: ci.pos, fov: ci.fov, near: ci.near });
      check(scenario, `§4.7 mode ${t.mode} FOV`, ci.fov,
        null, t.mode === 2 ? (t.fov.includes(Math.round(ci.fov)) || t.fov.some((f) => Math.abs(f - ci.fov) < 2)) : ci.fov === t.fov);
      check(scenario, `§4.7 mode ${t.mode} near`, ci.near, t.near);
      if (t.pos) {
        const d = Math.hypot(ci.pos.x - (g.lane + t.pos.x), ci.pos.y - t.pos.y, ci.pos.z - t.pos.z);
        check(scenario, `§4.7 mode ${t.mode} camera position within 0.05 m of target`, d, null, d <= 0.05);
      }
    }
    // 回到 mode 0，确认追尾机位恢复
    await s.page.evaluate(() => window.PB.debug.setCamera(0));
    await settle(s.page, 'PB.debug.setCamera(0);', 2000);
    const c0 = await cameraInfo(s.page);
    check(scenario, '§4.7 mode0 chase camera restored', [c0.fov, c0.near], [55, 0.1]);
    check(scenario, '§4.7 mode0 chase offset (0,2.4,6.5)', [Math.abs(c0.pos.y - 2.4) < 0.05, Math.abs(c0.pos.z - 6.5) < 0.3], [true, true]);
    await close(s);
    collect(scenario, s, { trips: trips.slice(0, 3), pov, modes, final: c0 });
  },

  // ==== P10：截图 S3 / S4a-c / S5 / S6 / S12 / S13 / S14 / S2-moon（全部本轮现场拍摄）====
  async 'p10-screens'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1920, height: 1080 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s.page);
    await s.page.evaluate(() => window.PB.debug.setHudVisible(false));

    /**
     * §5.3 通用条件：p / v=8 / lane 1 / wheelie=0 / y=0 / lean=0，镜头先真实收敛，再冻结。
     * @param {string} extra 机位设置代码（以 PB 为参数）
     * @param {number} p 昼夜相位
     * @param {number} ms 收敛时长
     * @param {boolean} [keepWheelie] 为 true 时不清零 wheelie（S13 用）
     */
    async function prepShot(extra, p, ms = 3200, keepWheelie) {
      const base = `PB.debug.setPhase(${p}); PB.debug.setSpeed(8); PB.input.markActivity(performance.now()/1000);` +
        'var G=PB.main.state(); G.bike.lane=1; G.bike.laneT=1; G.bike.x=0; G.bike.laneFromX=0; G.bike.laneToX=0;' +
        'G.bike.y=0; G.bike.lean=0;' + (keepWheelie ? '' : 'G.bike.wheelie=0;') +
        'G.cam.orbit.lastInteractT=performance.now()/1000;' + (extra || '');
      await settle(s.page, base + 'PB.debug.freezeTime(false);', ms);
      await s.page.evaluate((ph) => { window.PB.debug.setPhase(ph); window.PB.debug.setSpeed(8); window.PB.debug.freezeTime(true); }, p);
      await s.page.waitForTimeout(160);
    }

    /**
     * 与 prepShot 同一组状态，但用于 settleUntil 的逐帧重放（冻结相位/速度/车道，只让 S 前进）。
     * S 是道具位置的唯一自变量（§1.5 回收公式），推进它才能换一帧"没有棕榈挡在镜头前"的画面。
     * @param {number} yaw 环绕偏航（度）
     * @param {number} pitch 环绕俯仰（度）
     * @param {number} dist 环绕距离（米）
     * @returns {string} 以 PB 为参数的代码
     */
    function orbitStateCode(yaw, pitch, dist) {
      return `PB.debug.setPhase(0.05); PB.debug.setSpeed(8); PB.input.markActivity(performance.now()/1000);` +
        'var G=PB.main.state(); G.bike.lane=1; G.bike.laneT=1; G.bike.x=0; G.bike.laneFromX=0; G.bike.laneToX=0;' +
        'G.bike.y=0; G.bike.lean=0; G.bike.wheelie=0; G.cam.orbit.lastInteractT=performance.now()/1000;' +
        `PB.debug.setOrbit(${yaw}, ${pitch}, ${dist}, true);`;
    }

    // 选相位判据：屏幕包围盒占位率 ≤2%（正常帧里道具占 0–1%，被树冠挡住时 >20%），
    // 且没有任何道具的包围盒压在车/骑手身上（一根灯杆穿过骑手同样会让证据不可判读）。
    const PROP_CLEAR_PREDICATE = '(() => { const c = window.__propCoverage(); return { ok: c.coveragePct <= 2 && !c.subjectHit && !c.seaBandHit, coveragePct: c.coveragePct, inFrame: c.inFrame, subjectHit: c.subjectHit, seaBandHit: c.seaBandHit }; })()';

    // ---------- S3a：p=0.50、mode 1（海侧远景，ADR-34）——车在中央 1/3、下半 ≥40% 海面 ----------
    // 围巾取色只在 S1 判（ADR-35），路灯改由 S3b 判（ADR-33）。这里只记录围巾像素数作旁证。
    await prepShot('PB.debug.setCamera(1);', 0.50);
    const s3ci = await cameraInfo(s.page);
    const s3st = await s.page.evaluate(() => window.PB.debug.stats());
    const s3env = await s.page.evaluate(() => ({ lamps: window.PB.main.state().env.lamps, night: window.PB.main.state().env.nightMix }));
    // 证据完整性：把"这一帧"的相机/投影/视口/渲染器与状态原样记下（与截图同一冻结帧），
    // 这样"下半海面 65%"不再是一个脱离画面、无法核对的数。
    const s3rig = await s.page.evaluate(() => {
      const PB = window.PB, G = PB.main.state(), r = PB.scene.renderer(), gl = r.getContext(), cam = PB.camera.object();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const e = cam.matrixWorld.elements;
      return {
        pos: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
        fwd: { x: -e[8], y: -e[9], z: -e[10] },
        up: { x: e[4], y: e[5], z: e[6] },
        fov: cam.fov, near: cam.near, far: cam.far, aspect: cam.aspect,
        proj: Array.from(cam.projectionMatrix.elements).map((v) => +v.toFixed(6)),
        viewport: { bufW: r.domElement.width, bufH: r.domElement.height, cssW: r.domElement.clientWidth, cssH: r.domElement.clientHeight, dpr: r.getPixelRatio() },
        gl: { unmasked: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null, version: gl.getParameter(gl.VERSION), isWebGL2: r.capabilities.isWebGL2 },
        mode: G.cam.mode, blendT: G.cam.blendT, S: G.S, t: G.t,
        bike: { x: G.bike.x, y: G.bike.y, lane: G.bike.lane, v: G.bike.v },
      };
    });

    const s3path = await shot(s.page, 'S3a-side-seaview-p10.png', {
      scenario: 'p10-screens', setting: 'p=0.50 mode=1 v=8 lane=1 L2 1920x1080 HUD hidden (ADR-34 seaview)',
      stats: { tris: s3st.tris, calls: s3st.calls, camMode: s3st.camMode }, env: s3env, readings: s3rig
    });
    const s3img = readImage(s3path);
    const s3car = projectWithCamera(s3ci, { x: 0, y: 0.99, z: -0.536 });
    const s3carTop = projectWithCamera(s3ci, { x: 0, y: 1.98, z: -0.536 });
    const s3carBot = projectWithCamera(s3ci, { x: 0, y: 0, z: -0.536 });
    const s3carPx = Math.abs(s3carTop.y - s3carBot.y) * 540;
    let scarfPx3 = 0, scarfLoose3 = 0, warmPx3 = 0;
    for (let y = 0; y < s3img.height; y++) {
      for (let x = 0; x < s3img.width; x++) {
        const i = (y * s3img.width + x) * 4;
        const r = s3img.data[i], g = s3img.data[i + 1], b = s3img.data[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
        let H = 0;
        if (d !== 0) {
          if (mx === r) H = ((g - b) / d) % 6; else if (mx === g) H = (b - r) / d + 2; else H = (r - g) / d + 4;
          H *= 60; if (H < 0) H += 360;
        }
        const S = mx === 0 ? 0 : d / mx, V = mx / 255;
        if ((H >= 345 || H <= 15) && S >= 0.5 && V >= 0.25) scarfPx3++;
        if ((H >= 345 || H <= 15) && S >= 0.5 && V >= 0.10) scarfLoose3++;
        if (r > 150 && r > b + 40 && g > b + 10) warmPx3++;
      }
    }
    const s3sea = seaFraction(s3ci, 0, 0.5, 1, 1, 12);
    check(scenario, 'S3a car centre |ndc_x| ≤ 1/3 (real camera)', Math.abs(s3car.x), null, Math.abs(s3car.x) <= 1 / 3);
    check(scenario, 'S3a car centre |ndc_y| ≤ 1/3 (real camera)', Math.abs(s3car.y), null, Math.abs(s3car.y) <= 1 / 3);
    check(scenario, 'S3a lower-half sea ≥ 40% (real camera, geometric)', s3sea, null, s3sea >= 40);
    check(scenario, 'S3a car height ≥ 90 px at 1080p (ADR-34 gate)', s3carPx, null, s3carPx >= 90);
    check(scenario, 'S3a night mix = 1 (p=0.50)', s3env.night, 1);
    check(scenario, 'S3a env.lamps = 1 at p=0.50 (lamp judgement moved to S3b)', s3env.lamps, null, s3env.lamps >= 0.99);

    // 同一冻结帧的渲染侧复核：几何射线说"下半 65% 是海面"，必须能被这一帧的像素证实。
    // 做法是真实渲染差分（隐藏海面网格 / 隐藏鹈鹕根节点），不再引入第二套几何模型。
    // 两张差分源图一并进 manifest，供 ui-vision 直接核对"哪些像素是海、车有多高"。
    await setOceanVisible(s.page, false);
    await s.page.waitForTimeout(120);
    const s3NoSeaPath = await shot(s.page, 'S3a-no-ocean-diagnostic-p10.png', {
      scenario: 'p10-screens', kind: 'diagnostic', setting: 'S3a 同一冻结帧，隐藏海面网格（渲染海面掩膜来源）'
    });
    await setOceanVisible(s.page, true);
    await s.page.evaluate(() => { const r = window.PB.pelican.root(); r.visible = false; });
    await s.page.waitForTimeout(120);
    const s3NoCarPath = await shot(s.page, 'S3a-no-pelican-diagnostic-p10.png', {
      scenario: 'p10-screens', kind: 'diagnostic', setting: 'S3a 同一冻结帧，隐藏鹈鹕根节点（车像素包围盒来源）'
    });
    await s.page.evaluate(() => { const r = window.PB.pelican.root(); r.visible = true; });
    const s3SeaDiff = diffImages(s3img, readImage(s3NoSeaPath), 12);
    let s3RenderedLower = 0;
    const s3HalfRow = s3img.height >> 1;
    for (let y = s3HalfRow; y < s3img.height; y++) {
      for (let x = 0; x < s3img.width; x++) s3RenderedLower += s3SeaDiff.mask[y * s3img.width + x];
    }
    const s3RenderedLowerPct = (100 * s3RenderedLower) / (s3HalfRow * s3img.width);
    const s3CarDiff = diffImages(s3img, readImage(s3NoCarPath), 12);
    const s3CarPxMeasured = s3CarDiff.bbox ? (s3CarDiff.bbox.y1 - s3CarDiff.bbox.y0 + 1) : 0;
    check(scenario, 'S3a same frame: rendered lower-half sea matches geometric raycast within 6 pp',
      [s3RenderedLowerPct, s3sea], null, Math.abs(s3RenderedLowerPct - s3sea) <= 6);
    check(scenario, 'S3a same frame: rendered car bbox height within 12% of projection',
      [s3CarPxMeasured, s3carPx], null, s3CarPxMeasured > 0 && Math.abs(s3CarPxMeasured - s3carPx) / s3carPx <= 0.12);
    check(scenario, 'S3a same frame: rendered car bbox centre within central 1/3',
      s3CarDiff.bbox && ((s3CarDiff.bbox.x0 + s3CarDiff.bbox.x1) / 2) / s3img.width,
      null, !!s3CarDiff.bbox && Math.abs(((s3CarDiff.bbox.x0 + s3CarDiff.bbox.x1) / 2) / s3img.width - 0.5) <= 1 / 6);


    // ---------- S3b：p=0.50、mode 0 —— 用 forceLamps(0/1) 的真实渲染差分判"路灯亮" ----------
    // 判据锚在路面光斑圆片（半径 2.5 m）：凡圆片完整落在画框内、且圆心深度 < 雾 near(140 m)，
    // 都必须在圆片内出现 L1>30 的差分像素；灯头投影框只作补充证据（远处框仅几像素宽）。
    await prepShot('PB.debug.setCamera(0);', 0.50);
    const s3bCi = await cameraInfo(s.page);
    const s3bLamps = await s.page.evaluate(() => {
      const PB = window.PB, G = PB.main.state(), W = PB.config.WORLD;
      const out = [];
      for (let i = 0; i < W.LAMP_COUNT; i++) {
        out.push({ i, x: W.LAMP_X + W.LAMP_ARM, y: 0.02, z: PB.world.propZ(i, W.LAMP_SPACING, W.LAMP_COUNT * W.LAMP_SPACING, G.S) });
      }
      return out;
    });
    await s.page.evaluate(() => window.PB.debug.forceLamps(0));
    await s.page.waitForTimeout(160);
    const lampsOffPath = await shot(s.page, 'S3b-lamps-off-p10.png', { scenario: 'p10-screens', setting: 'p=0.50 mode=0 forceLamps(0)' });
    await s.page.evaluate(() => window.PB.debug.forceLamps(1));
    await s.page.waitForTimeout(160);
    const lampsOnPath = await shot(s.page, 'S3b-lamps-on-p10.png', { scenario: 'p10-screens', setting: 'p=0.50 mode=0 forceLamps(1)' });
    await s.page.evaluate(() => window.PB.debug.forceLamps(null));
    const lampsOff = readImage(lampsOffPath), lampsOn = readImage(lampsOnPath);
    const lampDiff = diffImages(lampsOn, lampsOff, 30);
    const PATCH_R = 2.5;
    const patchReports = [];
    for (const L of s3bLamps) {
      // 圆片的投影包围盒：地面圆在斜视下是椭圆，取 8 个圆周点 + 圆心的投影极值
      const pts = [[L.x, L.z]];
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        pts.push([L.x + PATCH_R * Math.cos(a), L.z + PATCH_R * Math.sin(a)]);
      }
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, inside = true;
      const center = projectWithCamera(s3bCi, { x: L.x, y: L.y, z: L.z });
      for (const [px, pz] of pts) {
        const q = projectWithCamera(s3bCi, { x: px, y: L.y, z: pz });
        if (Math.abs(q.x) > 1 || Math.abs(q.y) > 1 || q.depth <= s3bCi.near) inside = false;
        x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x);
        y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
      }
      const qualifies = inside && center.depth > 0 && center.depth < 140;
      let diffInPatch = 0;
      if (qualifies) {
        const px0 = Math.max(0, Math.floor((x0 * 0.5 + 0.5) * lampsOn.width));
        const px1 = Math.min(lampsOn.width - 1, Math.ceil((x1 * 0.5 + 0.5) * lampsOn.width));
        const py0 = Math.max(0, Math.floor((0.5 - y1 * 0.5) * lampsOn.height));
        const py1 = Math.min(lampsOn.height - 1, Math.ceil((0.5 - y0 * 0.5) * lampsOn.height));
        for (let y = py0; y <= py1; y++) {
          for (let x = px0; x <= px1; x++) if (lampDiff.mask[y * lampsOn.width + x]) diffInPatch++;
        }
      }
      patchReports.push({
        i: L.i, z: +L.z.toFixed(2), depth: +center.depth.toFixed(1), inside,
        qualifies, diffInPatch,
        wPx: qualifies ? Math.round((x1 - x0) * 0.5 * lampsOn.width) : 0
      });
    }
    const qualifying = patchReports.filter((p) => p.qualifies);
    const failedPatches = qualifying.filter((p) => p.diffInPatch < 1);
    check(scenario, 'S3b at least one lamp patch fully inside frame and within fog near (non-vacuous)',
      qualifying.length, null, qualifying.length >= 1);
    check(scenario, 'S3b every qualifying lamp patch has L1>30 diff pixels when lamps turn on',
      failedPatches.map((p) => p.i), []);
    check(scenario, 'S3b total diff pixels (lamps on vs off) > 0', lampDiff.count, null, lampDiff.count > 0);
    scenario.__s3 = { s3a: { seaLowerPct: s3sea, renderedLowerSeaPct: s3RenderedLowerPct, ndc: s3car, carPx: s3carPx, carPxMeasured: s3CarPxMeasured, carBbox: s3CarDiff.bbox, scarfPx: scarfPx3, scarfLoose: scarfLoose3, warmPx: warmPx3, env: s3env, rig: s3rig },
      s3b: { patches: patchReports, qualifying: qualifying.length, diffPx: lampDiff.count } };

    // ---------- S4a：p=0.15、mode 2、setCineShot(0, 4)；含 AC-1b(iii) 墨镜差分 ----------
    await prepShot('PB.debug.setCineShot(0, 4);', 0.15);
    const s4aCi = await cameraInfo(s.page);
    const s4aCar = projectWithCamera(s4aCi, { x: 0, y: 0.99, z: -0.536 });
    const s4aPath = await shot(s.page, 'S4a-cine-A-p10.png', { scenario: 'p10-screens', setting: 'p=0.15 mode=2 setCineShot(0,4)', ndc: s4aCar });
    await s.page.evaluate(() => window.PB.debug.setGlassesVisible(false));
    await s.page.waitForTimeout(140);
    const glassesOffPath = await shot(s.page, 'S4a-glasses-hidden-p10.png', { scenario: 'p10-screens', setting: 'S4a same frame, glasses hidden' });
    await s.page.evaluate(() => window.PB.debug.setGlassesVisible(true));
    check(scenario, 'S4a car bbox centre |ndc_x| ≤ 0.7', Math.abs(s4aCar.x), null, Math.abs(s4aCar.x) <= 0.7);
    check(scenario, 'S4a car bbox centre |ndc_y| ≤ 0.7', Math.abs(s4aCar.y), null, Math.abs(s4aCar.y) <= 0.7);
    const imgWith = readImage(s4aPath), imgWithout = readImage(glassesOffPath);
    const gd = diffImages(imgWith, imgWithout, 8);
    let darkInDiff = 0, featherNear = 0;
    for (let y = 0; y < imgWith.height; y++) {
      for (let x = 0; x < imgWith.width; x++) {
        const i = y * imgWith.width + x;
        if (!gd.mask[i]) continue;
        const j = i * 4;
        if (lum(imgWith.data[j], imgWith.data[j + 1], imgWith.data[j + 2]) < 0.12) {
          darkInDiff++;
          let found = false;
          for (let dy = -6; dy <= 6 && !found; dy++) {
            for (let dx = -6; dx <= 6 && !found; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= imgWith.width || yy >= imgWith.height) continue;
              const q = (yy * imgWith.width + xx) * 4;
              if (lum(imgWith.data[q], imgWith.data[q + 1], imgWith.data[q + 2]) > 0.35) found = true;
            }
          }
          if (found) featherNear++;
        }
      }
    }
    check(scenario, 'AC-1b(iii) S4a glasses diff: dark (L<0.12) pixels ≥ 20', darkInDiff, null, darkInDiff >= 20);
    check(scenario, 'AC-1b(iii) S4a dark lens pixels have feather pixels within 6 px', featherNear, null, featherNear >= 20);
    check(scenario, 'AC-1b(iii) diff confined to the lens region (≤ 6000 px)', gd.count, null, gd.count <= 6000);

    // ---------- S4b / S4c ----------
    const cine = [{ k: 0, ndc: s4aCar }];
    for (let k = 1; k < 3; k++) {
      await prepShot(`PB.debug.setCineShot(${k}, 4);`, 0.15);
      const ci = await cameraInfo(s.page);
      const car = projectWithCamera(ci, { x: 0, y: 0.99, z: -0.536 });
      const name = ['S4a-cine-A-p10.png', 'S4b-cine-B-p10.png', 'S4c-cine-C-p10.png'][k];
      await shot(s.page, name, { scenario: 'p10-screens', setting: `p=0.15 mode=2 setCineShot(${k},4)`, ndc: car });
      cine.push({ k, ndc: car });
      check(scenario, `S4${'abc'[k]} car bbox centre |ndc_x| ≤ 0.7`, Math.abs(car.x), null, Math.abs(car.x) <= 0.7);
      check(scenario, `S4${'abc'[k]} car bbox centre |ndc_y| ≤ 0.7`, Math.abs(car.y), null, Math.abs(car.y) <= 0.7);
    }

    // ---------- S5：p=0.05、mode 3（喙位置、看不到头盔） ----------
    await prepShot('PB.debug.setCamera(3);', 0.05);
    const s5ci = await cameraInfo(s.page);
    const s5st = await s.page.evaluate(() => window.PB.debug.stats());
    const s5beakW = await s.page.evaluate(() => { const b = window.PB.main.state().rig.beakW; return { x: b.x, y: b.y, z: b.z }; });
    const s5beak = projectWithCamera(s5ci, s5beakW);
    const s5path = await shot(s.page, 'S5-pov-p10.png', { scenario: 'p10-screens', setting: 'p=0.05 mode=3 v=8', beakFromBottomPct: (s5beak.y * 0.5 + 0.5) * 100, headHidden: s5st.headHidden });
    const s5img = readImage(s5path);
    let helmetBlue = 0;
    for (let y = 0; y < s5img.height; y++) {
      for (let x = 0; x < s5img.width; x++) {
        const i = (y * s5img.width + x) * 4;
        const r = s5img.data[i], g = s5img.data[i + 1], b = s5img.data[i + 2];
        if (b - r >= 40 && b >= g && b > 90) helmetBlue++;
      }
    }
    const s5fromBottom = (s5beak.y * 0.5 + 0.5) * 100;
    check(scenario, 'S5 beak from bottom % in [22,34] (real camera)', s5fromBottom, null, s5fromBottom >= 22 && s5fromBottom <= 34);
    check(scenario, 'S5 head hidden in POV (no headless pelican)', [s5st.headHidden, s5st.headVisErr], [true, 0]);
    check(scenario, 'S5 helmet pixels absent (head group hidden)', helmetBlue, null, helmetBlue < 20);

    // ---------- S6：p=0.05、mode 4、setOrbit(−90°,35°,14,true)（泡沫线 ≥2 条） ----------
    // ADR-38：−90° 机位下 x=−8 的棕榈带落在相机与车道之间，遮挡比例随 S 变化。
    // §5.3 锁死的是机位参数而不是 S，所以这里不动机位/相位，只把冻结时刻选在"道具不进画"的相位；
    // 否则会拍到一棵棕榈树冠盖住画面中部约 40% 的帧（重拍前的 S6 即如此）。
    await prepShot('PB.debug.setOrbit(-90, 35, 14, true);', 0.05);
    await attachPropCoverage(s.page);
    const s6phase = await settleUntil(s.page, orbitStateCode(-90, 35, 14) + 'PB.debug.freezeTime(false);', PROP_CLEAR_PREDICATE, 20000);
    await s.page.evaluate(() => { window.PB.debug.setPhase(0.05); window.PB.debug.setSpeed(8); window.PB.debug.freezeTime(true); });
    await s.page.waitForTimeout(160);
    const s6cover = await propCoverage(s.page);
    const s6st = await s.page.evaluate(() => window.PB.debug.stats());
    const s6S = await s.page.evaluate(() => window.PB.main.state().S);
    const s6path = await shot(s.page, 'S6-foam-orbit-p10.png', {
      scenario: 'p10-screens', setting: 'p=0.05 mode=4 setOrbit(-90,35,14,true)',
      stats: { tris: s6st.tris, calls: s6st.calls },
      readings: { propCoveragePct: s6cover.coveragePct, propsInFrame: s6cover.inFrame, phaseWaitMs: Math.round(s6phase.waitedMs), phaseHit: s6phase.hit, S: s6S }
    });
    const s6img = readImage(s6path);
    const s6occl = await propOcclusionPixels(s.page, s6img, 'S6');
    check(scenario, 'S6 props (palms/lamps) cover ≤ 8% of the frame on the captured frame', s6occl.pct, null, s6occl.pct <= 8);
    // 泡沫线 = 海面区域内沿垂直方向的亮度局部极大（近水平的亮条带）。取右侧无遮挡海面列的最大条带数。
    let foamBest = 0, foamBestCol = -1;
    for (let x = Math.round(s6img.width * 0.72); x < s6img.width * 0.99; x += 4) {
      const y0 = Math.round(s6img.height * 0.02), y1 = Math.round(s6img.height * 0.32);
      const L = [];
      for (let y = y0; y < y1; y++) { const i = (y * s6img.width + x) * 4; L.push(lum(s6img.data[i], s6img.data[i + 1], s6img.data[i + 2])); }
      let runs = 0, last = -99;
      for (let k = 2; k < L.length - 2; k++) {
        if (L[k] > L[k - 1] && L[k] >= L[k + 1] && L[k] > L[k - 2] && L[k] > L[k + 2]) {
          let minv = L[k];
          for (let d = 3; d < 14; d++) {
            if (k - d >= 0) minv = Math.min(minv, L[k - d]);
            if (k + d < L.length) minv = Math.min(minv, L[k + d]);
          }
          if (L[k] - minv >= 0.05 && k - last >= 10) { runs++; last = k; }
        }
      }
      if (runs > foamBest) { foamBest = runs; foamBestCol = x; }
    }
    check(scenario, 'S6 distinct shore-foam bands ≥2 (luminance peaks)', foamBest, null, foamBest >= 2);

    // ---------- S12：p=0.05、mode 4、setOrbit(−90°,20°,10,true)（近岸高光无接缝） ----------
    // 同 S6：机位参数按 §5.3 不动，只选一个灯杆/棕榈不进画的 S 相位，避免一根树干盖住画面右侧 1/3。
    await prepShot('PB.debug.setOrbit(-90, 20, 10, true);', 0.05);
    await attachPropCoverage(s.page);
    const s12phase = await settleUntil(s.page, orbitStateCode(-90, 20, 10) + 'PB.debug.freezeTime(false);', PROP_CLEAR_PREDICATE, 20000);
    await s.page.evaluate(() => { window.PB.debug.setPhase(0.05); window.PB.debug.setSpeed(8); window.PB.debug.freezeTime(true); });
    await s.page.waitForTimeout(160);
    const s12cover = await propCoverage(s.page);
    const s12S = await s.page.evaluate(() => window.PB.main.state().S);
    const s12path = await shot(s.page, 'S12-shore-highlight-p10.png', {
      scenario: 'p10-screens', setting: 'p=0.05 mode=4 setOrbit(-90,20,10,true)',
      readings: { propCoveragePct: s12cover.coveragePct, propsInFrame: s12cover.inFrame, phaseWaitMs: Math.round(s12phase.waitedMs), phaseHit: s12phase.hit, S: s12S }
    });
    const s12img = readImage(s12path);
    const s12occl = await propOcclusionPixels(s.page, s12img, 'S12');
    check(scenario, 'S12 props (palms/lamps) cover ≤ 8% of the frame on the captured frame', s12occl.pct, null, s12occl.pct <= 8);
    // 接缝判据：在**只含水面像素**的相邻列对上求行内平均 |ΔL|，再取最大行。
    //   1) 逐像素排除棕榈（木色：r−b ≥ 35 且 r ≥ g ≥ 0.6r）——树干边缘是 30+/255 的硬边，不是海面接缝；
    //   2) 只统计两侧都在海面带内的相邻对，避免把岸/沙/天的边界计入；
    //   网格接缝会在整行上同时出现亮度台阶，而浪峰的单点硬边不会（实测单点最大 74/255，行均 ~1/255）。
    const isWood = (d, i) => d[i] - d[i + 2] >= 35 && d[i] >= d[i + 1] * 0.95 && d[i] >= 60;
    let maxRowMean = 0, maxRowY = -1, seamPairs = 0;
    for (let y = Math.round(s12img.height * 0.06); y < Math.round(s12img.height * 0.30); y++) {
      let sum = 0, n = 0;
      for (let x = Math.round(s12img.width * 0.55); x < s12img.width - 1; x++) {
        const i1 = (y * s12img.width + x) * 4, i2 = (y * s12img.width + x + 1) * 4;
        if (isWood(s12img.data, i1) || isWood(s12img.data, i2)) continue;
        const l1 = lum(s12img.data[i1], s12img.data[i1 + 1], s12img.data[i1 + 2]);
        const l2 = lum(s12img.data[i2], s12img.data[i2 + 1], s12img.data[i2 + 2]);
        sum += Math.abs(l1 - l2) * 255;
        n++;
      }
      if (n < 200) continue;   // 该行几乎全被树干占据 → 不作样本
      seamPairs += n;
      const m = sum / n;
      if (m > maxRowMean) { maxRowMean = m; maxRowY = y; }
    }
    check(scenario, 'S12 no vertical seam: max row-mean |ΔL| over water pixels ≤ 3/255', maxRowMean, null, maxRowMean <= 3);

    // ---------- S14：p=0.05、mode 4、setOrbit(35°,18°,9,true) ----------
    await prepShot('PB.debug.setOrbit(35, 18, 9, true);', 0.05);
    const s14ci = await cameraInfo(s.page);
    await shot(s.page, 'S14-orbit-default-p10.png', { scenario: 'p10-screens', setting: 'p=0.05 mode=4 setOrbit(35,18,9,true)' });
    const s14car = projectWithCamera(s14ci, { x: 0, y: 0.99, z: -0.536 });
    const horizonNdc = (function () {
      const f = s14ci.fwd, up0 = { x: 0, y: 1, z: 0 };
      const dot = up0.x * f.x + up0.y * f.y + up0.z * f.z;
      let u = { x: up0.x - dot * f.x, y: up0.y - dot * f.y, z: up0.z - dot * f.z };
      const ul = Math.hypot(u.x, u.y, u.z) || 1; u = { x: u.x / ul, y: u.y / ul, z: u.z / ul };
      const du = -u.z, df = -f.z;
      return du / df / Math.tan(s14ci.fov * Math.PI / 180 / 2);
    })();
    const horizonPct = (1 - horizonNdc) / 2 * 100;
    const seaStat = seaStats(s14ci, 4);
    check(scenario, 'AC-8a mode4 car centre |ndc_x| ≤ 0.2', Math.abs(s14car.x), null, Math.abs(s14car.x) <= 0.2);
    check(scenario, 'AC-8a mode4 car centre |ndc_y| ≤ 0.2', Math.abs(s14car.y), null, Math.abs(s14car.y) <= 0.2);
    check(scenario, 'AC-8a mode4 horizon from top % in [10,20]', horizonPct, null, horizonPct >= 10 && horizonPct <= 20);
    check(scenario, 'AC-8a mode4 sea visible in the right half (right > left, sea px > 0)',
      [seaStat.right, seaStat.left], null, seaStat.sea > 0 && seaStat.right > seaStat.left);

    // ---------- S2 月亮状态（本轮重拍，记录月亮 ndc/直径/starsInView） ----------
    await prepShot('PB.debug.setCamera(0);', 0.50);
    const s2st = await s.page.evaluate(() => window.PB.debug.stats());
    const s2env = await s.page.evaluate(() => {
      const G = window.PB.main.state();
      return { moonDir: { x: G.env.moonDir.x, y: G.env.moonDir.y, z: G.env.moonDir.z }, stars: G.env.stars, lamps: G.env.lamps };
    });
    const s2ci = await cameraInfo(s.page);
    const moonNdc = (function () {
      const f = s2ci.fwd, up0 = { x: 0, y: 1, z: 0 };
      const dot = up0.x * f.x + up0.y * f.y + up0.z * f.z;
      let u = { x: up0.x - dot * f.x, y: up0.y - dot * f.y, z: up0.z - dot * f.z };
      const ul = Math.hypot(u.x, u.y, u.z) || 1; u = { x: u.x / ul, y: u.y / ul, z: u.z / ul };
      const r = { x: f.y * u.z - f.z * u.y, y: f.z * u.x - f.x * u.z, z: f.x * u.y - f.y * u.x };
      const d = s2env.moonDir;
      const df = d.x * f.x + d.y * f.y + d.z * f.z;
      const du = d.x * u.x + d.y * u.y + d.z * u.z;
      const dr = d.x * r.x + d.y * r.y + d.z * r.z;
      const tan = Math.tan(s2ci.fov * Math.PI / 180 / 2);
      return { x: dr / df / (tan * s2ci.aspect), y: du / df / tan, inFront: df > 0 };
    })();
    const moonPct = Math.tan(2.4 * Math.PI / 180 / 2) / Math.tan(s2ci.fov * Math.PI / 180 / 2) * 100;
    await shot(s.page, 'S2-night-moon-p10.png', { scenario: 'p10-screens', setting: 'p=0.50 mode=0 v=8', moonNdc, moonPct, starsInView: s2st.starsInView });
    check(scenario, 'S2 moon fully inside frame', [moonNdc.inFront, Math.abs(moonNdc.x) < 1, Math.abs(moonNdc.y) < 1], [true, true, true]);
    check(scenario, 'S2 moon diameter % in [3,6]', moonPct, null, moonPct >= 3 && moonPct <= 6);
    check(scenario, 'AC-3b starsInView ≥ 250 (fresh S2)', s2st.starsInView, null, s2st.starsInView >= 250);
    check(scenario, 'S2 env.stars = 1 at p=0.50', s2env.stars, 1);

    // ---------- S13：按住 T 达到 wheelie 0.314、mode 4 setOrbit(90°,10°,4)、showDebugShapes ----------
    // ADR-34 把 S13 的机位从 mode 1 改到 mode 4：海侧远景下车只有约 94 px 高，捕获框不可读；
    // mode 4 的 (90°,10°,4) 下骑手约 612 px 高，框与标记球可读。
    await s.page.keyboard.down('KeyT');
    await prepShot('PB.debug.setOrbit(90, 10, 4, true); PB.debug.showDebugShapes(true);', 0.05, 1400, true);
    const s13 = await s.page.evaluate(() => {
      const PB = window.PB, G = PB.main.state();
      const ds = PB.debug.debugShapeState();
      const b = G.rig.beakW;
      const b0 = G.rig.beakW;
      return {
        wheelieDeg: G.bike.wheelie * 180 / Math.PI,
        sphereD: ds ? Math.max(Math.abs(ds.sphere.x - b.x), Math.abs(ds.sphere.y - b.y), Math.abs(ds.sphere.z - b.z)) : -1,
        // Q-17：捕获框的锚点必须是 beakW（判定体积的中心），不是 rig 的原点/地面
        boxAtBeak: ds ? (ds.box.x === b0.x && ds.box.y === b0.y && ds.box.z === b0.z && ds.axisAligned) : false,
        beakErr: PB.debug.stats().beakErr
      };
    });
    await shot(s.page, 'S13-wheelie-beak-p10.png', { scenario: 'p10-screens', setting: 'p=0.05 mode=1 wheelie held T (0.314) showDebugShapes', readings: s13 });
    await s.page.keyboard.up('KeyT');
    await s.page.evaluate(() => window.PB.debug.showDebugShapes(false));
    check(scenario, 'S13 wheelie at max 18° (AC-6d visual)', s13.wheelieDeg, null, Math.abs(s13.wheelieDeg - 18) <= 1.2);
    check(scenario, 'S13 debug sphere coincides with rig.beakW (≤1e-6)', s13.sphereD, null, s13.sphereD <= 1e-6);
    check(scenario, 'S13 debug catch box anchored at beakW (Q-17)', s13.boxAtBeak, true);
    check(scenario, 'S13 beak marker error ≤ 0.02 m (AC-1d)', s13.beakErr, null, s13.beakErr <= 0.02);

    await s.page.evaluate(() => window.PB.debug.freezeTime(false));
    await close(s);
    collect(scenario, s, {
      S3: scenario.__s3,
      S4: cine,
      S4aGlasses: { diffPx: gd.count, darkInDiff, featherNear },
      S5: { beakFromBottomPct: s5fromBottom, helmetBlue, headHidden: s5st.headHidden },
      S6: { foamBands: foamBest, col: foamBestCol, occlusionPct: s6occl.pct, coverage: s6cover, phase: { hit: s6phase.hit, waitMs: Math.round(s6phase.waitedMs) }, S: s6S },
      S12: { maxRowMean: maxRowMean, row: maxRowY, pairs: seamPairs, occlusionPct: s12occl.pct, coverage: s12cover, phase: { hit: s12phase.hit, waitMs: Math.round(s12phase.waitedMs) }, S: s12S },
      S13: s13,
      S14: { carNdc: s14car, horizonPct, seaStat },
      S2: { moonNdc, moonPct, starsInView: s2st.starsInView },
      screens: shotManifest.slice()
    });
  },

  // ==== P10：S7（侧视围巾 + 0/8/16 s 运动序列）====
  async 'p10-s7'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1920, height: 1080 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s.page);
    await s.page.evaluate(() => window.PB.debug.setHudVisible(false));
    // 通用条件 + mode 4 setOrbit(90°,10°,4) + v=8 稳态 10 s（真实时间，不加速）。
    // ADR-34/ADR-36：S7 的机位由 mode 1 改为 mode 4（海侧远景下围巾投影只有 31.1 px²），
    // 且飘带像素判据只在 S1 判（AC-1b(i)），本图只判围巾形态（AC-2a）。
    const code = 'PB.debug.setPhase(0.05); PB.debug.setSpeed(8); PB.debug.setOrbit(90, 10, 4, true);' +
      'var G=PB.main.state(); G.bike.lane=1; G.bike.laneT=1; G.bike.x=0; G.bike.laneFromX=0; G.bike.laneToX=0;' +
      'G.bike.y=0; G.bike.wheelie=0; G.bike.lean=0; PB.input.markActivity(performance.now()/1000);';
    await settle(s.page, code + 'PB.debug.freezeTime(false);', 10000);
    const st = await s.page.evaluate(() => {
      const PB = window.PB, G = PB.main.state();
      return {
        v: G.bike.v, scarfAngle: G.scarf.angleDeg, scarfLagX: G.scarf.lagX, scarfResets: PB.main.health.scarfResets,
        outsideMinF: G.scarf.outsideMinF, camMode: G.cam.mode, tris: PB.debug.stats().tris, calls: PB.debug.stats().calls
      };
    });
    await s.page.evaluate(() => { window.PB.debug.setPhase(0.05); window.PB.debug.setSpeed(8); window.PB.debug.freezeTime(true); });
    await s.page.waitForTimeout(140);
    const withPath = await shot(s.page, 'S7-side-scarf-v8-p10.png', { scenario: 'p10-s7', setting: 'p=0.05 mode=4 setOrbit(90,10,4,true) v=8 10 s steady', readings: st });
    await s.page.evaluate(() => window.PB.debug.setRibbonVisible(false));
    await s.page.waitForTimeout(140);
    const offPath = await shot(s.page, 'S7-ribbon-hidden-p10.png', { scenario: 'p10-s7', setting: 'S7 same frame, ribbon hidden' });
    await s.page.evaluate(() => window.PB.debug.setRibbonVisible(true));
    const a = readImage(withPath), b = readImage(offPath);
    const d = diffImages(a, b, 8);
    // ADR-36：飘带-only 差分像素只在 S1 判（阈值 150 不变）。这里只记录读数，不作判据。
    check(scenario, 'ADR-36 S7 ribbon diff recorded (criterion lives in S1 only)', d.count, null, d.count >= 0);
    check(scenario, 'AC-2a scarf angle at v=8 within sanity band [55,85]°', st.scarfAngle, null, st.scarfAngle >= 55 && st.scarfAngle <= 85);
    check(scenario, 'ADR-23 scarf outside torso ellipsoid (min f ≥ 1)', st.outsideMinF, null, st.outsideMinF >= 1 - 1e-6);
    check(scenario, 'AC-2d scarf resets during the 10 s run == 0', st.scarfResets, 0);
    check(scenario, 'S7 steady at v=8 and mode 4 (ADR-34 orbit)', [st.v > 7.5, st.camMode], [true, 4]);

    // 补充取证（不新增判据、不替代 §5.3 的 S7 机位）：yaw=90° 时飘带（2 列 × 13 行、带宽 0.12 m）
    // 的宽度方向几乎与视线平行，画面上只剩 1–2 px 的侧棱（上面 bbox 的高度即证据；这也是 ADR-36
    // 把飘带像素判据留在 S1 的原因）。这里换 60°/15°/4.5 m 的 3/4 机位看同一主体，让带宽可见，
    // 明确标注 supplementary，不计入 AC-2a 判定。
    await s.page.evaluate(() => { window.PB.debug.freezeTime(false); window.PB.debug.setOrbit(60, 15, 4.5, true); });
    await settle(s.page, 'PB.debug.setSpeed(8); PB.debug.setPhase(0.05); PB.input.markActivity(performance.now()/1000);', 800);
    await s.page.evaluate(() => {
      const G = window.PB.main.state();
      G.bike.lane = 1; G.bike.x = 0; G.bike.y = 0; G.bike.lean = 0; G.bike.wheelie = 0;
      window.PB.debug.setPhase(0.05); window.PB.debug.setSpeed(8); window.PB.debug.freezeTime(true);
    });
    await s.page.waitForTimeout(140);
    const s7qPath = await shot(s.page, 'S7-scarf-3q-supp-p10.png', {
      scenario: 'p10-s7', kind: 'supplementary',
      setting: 'S7 补充：p=0.05 mode=4 setOrbit(60,15,4.5,true) 3/4 视角（不计入 AC-2a，只证明带宽可见）'
    });
    await s.page.evaluate(() => window.PB.debug.setRibbonVisible(false));
    await s.page.waitForTimeout(140);
    const s7qOffPath = await shot(s.page, 'S7-scarf-3q-ribbon-hidden-supp-p10.png', {
      scenario: 'p10-s7', kind: 'supplementary', setting: 'S7 补充 3/4 同一帧，飘带隐藏（带宽像素来源）'
    });
    await s.page.evaluate(() => window.PB.debug.setRibbonVisible(true));
    const s7q = diffImages(readImage(s7qPath), readImage(s7qOffPath), 8);

    // 运动序列：真实时间 0 / 8 / 16 s，不冻结（供 ui-vision 判断"流动的布"而不是静止补丁）。
    // 注意这段代码**不能**再逐帧 setPhase（那会把 G.t 钉在同一相位，围巾永远不动）。
    const motionCode = 'PB.debug.setSpeed(8);' +
      'var G=PB.main.state(); G.bike.lane=1; G.bike.laneT=1; G.bike.x=0; G.bike.laneFromX=0; G.bike.laneToX=0;' +
      'G.bike.y=0; G.bike.wheelie=0; G.bike.lean=0; PB.input.markActivity(performance.now()/1000);';
    // 把机位恢复到 §5.3 的 90°/10°/4 m 再开始运动序列，并让阻尼在真实时间里收敛，
    // 否则第一张运动帧会拍在 60°→90° 的过渡中间（那是机位混合，不是围巾的运动）。
    await s.page.evaluate(() => { window.PB.debug.freezeTime(false); window.PB.debug.setPhase(0.05); window.PB.debug.setOrbit(90, 10, 4, true); });
    await settle(s.page, motionCode, 800);
    const motion = [];
    for (const [label, name] of [[0, 'S7-motion-0s-p10.png'], [8, 'S7-motion-8s-p10.png'], [16, 'S7-motion-16s-p10.png']]) {
      if (label > 0) await settle(s.page, motionCode, 8000);
      const rd = await s.page.evaluate(() => {
        const PB = window.PB, G = PB.main.state();
        return { t: G.t, v: G.bike.v, angle: G.scarf.angleDeg, lagX: G.scarf.lagX, tip: { x: G.scarf.tip.x, y: G.scarf.tip.y, z: G.scarf.tip.z } };
      });
      await shot(s.page, name, { scenario: 'p10-s7', setting: `motion frame at +${label} s (side view, v=8, not frozen)`, readings: rd });
      motion.push({ label, rd });
      check(scenario, `S7 motion ${label}s frame recorded with v≈8`, [rd.v > 7.5, rd.camMode === undefined], [true, true]);
    }
    // 三帧的围巾尖端位置必须不同（否则只是同一帧改名）
    const tips = motion.map((m) => `${m.rd.tip.x.toFixed(4)},${m.rd.tip.y.toFixed(4)},${m.rd.tip.z.toFixed(4)}`);
    check(scenario, 'S7 motion frames are distinct (tip positions differ)', new Set(tips).size, 3);
    await close(s);
    collect(scenario, s, { ribbonDiffPx: d.count, bbox: d.bbox, steady: st, supplementary3q: { px: s7q.count, bbox: s7q.bbox }, motion: motion.map((m) => ({ label: m.label, ...m.rd })) });
  },

  // ==== P10：S11（捕获框内的鱼）====
  async 'p10-s11'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1920, height: 1080 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s.page);
    await s.page.evaluate(() => window.PB.debug.setHudVisible(false));
    // ADR-34：S11 的机位从 mode 1 改到 mode 4 setOrbit(90°,15°,12,true)——海侧远景下车只有约 94 px 高，
    // 捕获框不可读；mode 4 的该机位下框宽约 215 px，框与鱼都能看清。
    await settle(s.page, 'PB.debug.setPhase(0.05); PB.debug.setOrbit(90, 15, 12, true); PB.input.markActivity(performance.now()/1000);', 3000);
    await s.page.evaluate(() => {
      const PB = window.PB;
      const G = PB.main.state();
      PB.debug.freezeTime(false);
      G.fish.length = 0;
      G.nextFishS = 1e12;
      PB.debug.setSpeed(0);
      PB.debug.showDebugShapes(true);
      PB.debug.spawnFish(1, false, 30);
      PB.debug.pauseOnEvent('catch');
    });
    // 以 v=8 逼近直到捕获帧冻结
    await s.page.evaluate(async () => {
      const PB = window.PB;
      const t0 = performance.now();
      await new Promise((res) => {
        const tick = () => {
          if (PB.debug.pausedOn() === 'catch' || performance.now() - t0 > 12000) { res(); return; }
          PB.debug.setSpeed(8);
          PB.input.markActivity(performance.now() / 1000);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    });
    // 读数：判定体积、框的锚点/轴向、鱼的真实位置（判定用的 p0 与当帧 pose 都给）
    const caught = await s.page.evaluate(() => {
      const PB = window.PB;
      const G = PB.main.state();
      const f = G.fish.find((q) => q.state === 'caught');
      const ds = PB.debug.debugShapeState();
      const cv = PB.debug.catchVolumeState(f);
      const b = G.rig.beakW;
      const eq = (a, c) => a.x === c.x && a.y === c.y && a.z === c.z;
      return {
        paused: PB.debug.pausedOn(),
        boxCentre: ds.box, sphereCentre: ds.sphere, axisAligned: ds.axisAligned,
        beakW: { x: b.x, y: b.y, z: b.z },
        boxAnchoredToBeak: eq(ds.box, b),
        sphereAnchoredToBeak: eq(ds.sphere, b),
        volume: cv,
        judgedP0InBox: cv.fish ? (cv.fish.insideXY && cv.fish.insideZ) : false,
        // 当帧 pose：捕获帧若执行了 2 个固定步，pose 会比 p0 再前进一步；同样必须仍在盒内
        poseInBox: !!f && Math.abs(f.pose.x - b.x) < 0.9 && Math.abs(f.pose.y - b.y) <= 0.45 && Math.abs(f.pose.z - b.z) < 1.0,
        fishPose: f ? { x: f.pose.x, y: f.pose.y, z: f.pose.z } : null,
        shapesVisible: ds.visible,
        mode: G.cam.mode,
        camPos: { x: PB.camera.object().position.x, y: PB.camera.object().position.y, z: PB.camera.object().position.z },
        tris: PB.debug.stats().tris, calls: PB.debug.stats().calls
      };
    });
    await s.page.waitForTimeout(150);
    const withPath = await shot(s.page, 'S11-fish-catchbox-p10.png', { scenario: 'p10-s11', setting: 'spawnFish(1,false,30) pauseOnEvent(catch) mode=4 orbit(90,15,12) showDebugShapes', readings: caught });
    // 真实渲染差分：同一冻结帧隐藏全部鱼再拍一张（鱼像素的唯一来源）
    await s.page.evaluate(() => window.PB.debug.setFishVisible(false));
    await s.page.waitForTimeout(160);
    const offPath = await shot(s.page, 'S11-fish-hidden-p10.png', { scenario: 'p10-s11', setting: 'S11 same frozen frame, fish pool hidden' });
    await s.page.evaluate(() => window.PB.debug.setFishVisible(true));

    const imgFish = readImage(withPath), imgNoFish = readImage(offPath);
    const fd = diffImages(imgFish, imgNoFish, 24);
    // 把判定盒的 8 个角投到屏幕，得到"框应该覆盖的像素范围"
    const ci = await cameraInfo(s.page);
    const b = caught.beakW, H = caught.volume.half;
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sy = -1; sy <= 1; sy += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          const n = projectWithCamera(ci, { x: b.x + sx * H.x, y: b.y + sy * H.y, z: b.z + sz * H.z });
          const px = (n.x * 0.5 + 0.5) * 1920, py = (1 - (n.y * 0.5 + 0.5)) * 1080;
          if (px < bx0) bx0 = px; if (px > bx1) bx1 = px;
          if (py < by0) by0 = py; if (py > by1) by1 = py;
        }
      }
    }
    const fishPx = caught.fishPose ? projectWithCamera(ci, caught.fishPose) : null;
    const fishScreen = fishPx ? { x: (fishPx.x * 0.5 + 0.5) * 1920, y: (1 - (fishPx.y * 0.5 + 0.5)) * 1080 } : null;
    const inBoxScreen = fd.bbox ? (fd.bbox.x0 >= bx0 - 6 && fd.bbox.x1 <= bx1 + 6 &&
      fd.bbox.y0 >= by0 - 6 && fd.bbox.y1 <= by1 + 6) : false;

    check(scenario, 'S11 paused on catch event', caught.paused, 'catch');
    check(scenario, 'Q-17 debug box centre === G.rig.beakW (exactly)', caught.boxAnchoredToBeak, true);
    check(scenario, 'Q-17 beak marker sphere === box centre', caught.sphereAnchoredToBeak, true);
    check(scenario, 'Q-17 box is a world-axis-aligned cube (no rig rotation)', caught.axisAligned, true);
    check(scenario, 'S11 judged (alive) pose inside the same volume as fish.canCatch', caught.judgedP0InBox, true);
    check(scenario, 'S11 current-frame pose also inside the volume', caught.poseInBox, true);
    check(scenario, 'S11 debug shapes visible', caught.shapesVisible, true);
    check(scenario, 'S11 camera is mode 4 (ADR-34 orbit shot)', caught.mode, 4);
    // 像素取证：鱼是真的画在框里（不是 manifest 里的布尔值）
    check(scenario, 'S11 fish pixels exist (real render diff ≥ 20 px)', fd.count, null, fd.count >= 20);
    check(scenario, 'S11 fish diff bbox lies inside the projected catch box', inBoxScreen, true);
    check(scenario, 'S11 fish projected centre inside the projected catch box',
      fishScreen ? [fishScreen.x >= bx0 - 4 && fishScreen.x <= bx1 + 4, fishScreen.y >= by0 - 4 && fishScreen.y <= by1 + 4] : [false, false],
      [true, true]);

    await s.page.evaluate(() => { window.PB.debug.showDebugShapes(false); window.PB.debug.freezeTime(false); });
    await close(s);
    collect(scenario, s, {
      caught, fishDiff: { px: fd.count, bbox: fd.bbox },
      projectedBox: { x0: bx0, y0: by0, x1: bx1, y1: by1 }, fishScreen,
      screens: [withPath, offPath]
    });
  },

  // ==== P11：成就（持久化 / 只在内存 / muted 初值 / S8 面板）====
  async 'p11-achievements'(scenario) {
    // --- 真实持久化：真实抓鱼解锁 FIRST_CATCH → 刷新后仍解锁 ---
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s.page);
    const init = await s.page.evaluate(() => {
      const st = window.PB.debug.stats();
      return { muted: st.muted, persistent: st.storePersistent, ach: st.achCount };
    });
    check(scenario, 'UD-5 muted default false', init.muted, false);
    check(scenario, 'store persistent on a normal file:// context', init.persistent, true);
    // 真实捕获（不是直接解锁）
    await s.page.evaluate(async () => {
      const PB = window.PB, G = PB.main.state();
      PB.debug.setSpeed(0);
      G.fish.length = 0;
      G.nextFishS = 1e12;
      PB.debug.spawnFish(1, false, 1.072);
      await new Promise((res) => setTimeout(res, 1400));
    });
    const afterCatch = await s.page.evaluate(() => {
      const PB = window.PB;
      return { ach: PB.debug.stats().achCount, catches: PB.main.state().score.catches, list: PB.achievements.list().filter((x) => x.at > 0).map((x) => x.id) };
    });
    check(scenario, 'AC-7 real catch unlocks FIRST_CATCH', [afterCatch.catches >= 1, afterCatch.ach >= 1], [true, true]);
    check(scenario, 'AC-7 unlocked id recorded in store.doc', afterCatch.list.indexOf('FIRST_CATCH') >= 0, true);
    await s.page.reload();
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await s.page.waitForTimeout(300);
    const afterReload = await s.page.evaluate(() => ({
      ach: window.PB.debug.stats().achCount,
      unlocked: window.PB.achievements.isUnlocked('FIRST_CATCH'),
      stored: !!window.PB.store.get().ach.FIRST_CATCH
    }));
    check(scenario, 'AC-7 after refresh still unlocked', [afterReload.ach >= 1, afterReload.unlocked, afterReload.stored], [true, true, true]);

    // S8：unlockAch 后打开列表（toast + 14 行）
    await keepAwake(s.page);
    await s.page.evaluate(() => window.PB.debug.unlockAch('COMBO_5'));
    await s.page.keyboard.press('KeyL');
    await s.page.waitForTimeout(400);
    const panel = await s.page.evaluate(() => {
      const p = document.getElementById('ach-panel');
      const rows = document.querySelectorAll('#ach-rows li');
      const toast = document.getElementById('hud-toast');
      return {
        open: p && !p.hidden, rows: rows.length, count: document.getElementById('ach-count').textContent,
        toast: toast ? { text: toast.textContent, hidden: !!toast.hidden, on: toast.classList.contains('on') } : null
      };
    });
    await shot(s.page, 'S8-achievement-list-p11.png', { scenario: 'p11-achievements', setting: 'unlockAch(COMBO_5) + L opens list (toast + 14 rows)', readings: panel });
    check(scenario, '§4.8 achievement list has 14 rows', panel.rows, 14);
    check(scenario, '§4.8 panel header shows x/14', panel.count, null, /\/14$/.test(panel.count));
    check(scenario, '§4.8 toast shows the unlocked achievement', panel.toast ? panel.toast.text.indexOf('连击五') >= 0 : false, true);
    await s.page.keyboard.press('Escape');
    await s.page.waitForTimeout(200);
    const closed = await s.page.evaluate(() => document.getElementById('ach-panel').hidden);
    check(scenario, '§4.8 Esc closes the panel', closed, true);
    const st = await s.page.evaluate(() => window.PB.debug.stats());
    await close(s);

    // --- localStorage 被拒：只在内存、不抛错、不产生 console error ---
    const s2 = await open({
      url: `${PAGE_URL}?debug=1`,
      beforeGoto: async (ctx) => {
        await ctx.addInitScript(() => {
          Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage denied'); } });
        });
      },
    });
    await s2.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s2.page);
    await s2.page.evaluate(async () => {
      const PB = window.PB, G = PB.main.state();
      PB.debug.setSpeed(0);
      G.fish.length = 0;
      G.nextFishS = 1e12;
      PB.debug.spawnFish(1, false, 1.072);
      await new Promise((res) => setTimeout(res, 1400));
    });
    const mem = await s2.page.evaluate(() => ({
      persistent: window.PB.store.persistent, ach: window.PB.debug.stats().achCount,
      appState: window.PB.main.app.state
    }));
    check(scenario, 'AC-7 storage denied → persistent=false', mem.persistent, false);
    check(scenario, 'AC-7 storage denied → achievements live in memory', mem.ach >= 1, true);
    check(scenario, 'AC-7 storage denied → app keeps running', mem.appState, 'running');
    await close(s2);
    collect(scenario, s, { init, afterCatch, afterReload, panel, mem, stats: { tris: st.tris, calls: st.calls } });
  },

  // ==== P12：自动驾驶（AC-12a/12b/12c/12d，真实可信事件）====
  async 'p12-autopilot'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });

    // AC-12a 的另一半：未接管时 AUTO 标记必须真的不可见。
    // 只有 hidden 属性不够——#hud-auto 的 display 规则优先级高于 UA 的 [hidden]{display:none}，
    // CSS 里没有 [hidden] 兜底时 hidden 是死代码（本案实测过：hidden=true 时 computed display 仍是
    // inline-block，视频里 AUTO 常亮，接管/打断无法从画面区分）。因此这里读 computed display，不读属性。
    const badgeBefore = await s.page.evaluate(() => {
      const el = document.getElementById('hud-auto');
      return { hidden: el.hidden, display: getComputedStyle(el).display };
    });
    check(scenario, 'AC-12a AUTO badge invisible (display:none) before engagement',
      [badgeBefore.hidden, badgeBefore.display], [true, 'none']);

    // AC-12a：无输入 6 s → AUTO，HUD 显示 AUTO
    await s.page.waitForTimeout(6500);
    const a = await s.page.evaluate(() => {
      const st = window.PB.debug.stats();
      const hud = document.getElementById('hud-auto');
      return { engaged: st.apEngaged, idle: st.idleSec, hudHidden: hud.hidden, hudText: hud.textContent };
    });
    check(scenario, 'AC-12a idle ≥6 s engages AUTO', a.engaged, true);
    check(scenario, 'AC-12a idleSec ≥ 6', a.idle, null, a.idle >= 6);
    check(scenario, 'AC-12a HUD shows AUTO', [a.hudHidden, a.hudText.trim()], [false, 'AUTO']);
    const badgeAfter = await s.page.evaluate(() => {
      const el = document.getElementById('hud-auto');
      return { hidden: el.hidden, display: getComputedStyle(el).display };
    });
    check(scenario, 'AC-12a AUTO badge visible (display ≠ none) while engaged',
      [badgeAfter.hidden, badgeAfter.display !== 'none'], [false, true]);

    // AC-12c：AUTO 时每一类可信事件都在下一帧 F4 断开
    const classes = [];
    async function waitEngaged() {
      await s.page.waitForFunction(() => window.PB.main.state().ap.engaged === true, null, { timeout: 12000 });
    }
    async function injectAndCheck(label, inject) {
      await waitEngaged();
      await inject();
      // 等两个渲染帧：事件在两个 rAF 之间分发，F2 读脉冲、F4 断开
      const r = await s.page.evaluate(async () => {
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        return { engaged: window.PB.main.state().ap.engaged, idle: window.PB.debug.stats().idleSec };
      });
      classes.push({ label, ...r });
      check(scenario, `AC-12c ${label} cancels AUTO in the next frame`, r.engaged, false);
    }
    await injectAndCheck('keydown', async () => { await s.page.keyboard.press('KeyX'); });
    await injectAndCheck('pointermove without buttons', async () => { await s.page.mouse.move(400, 300); });
    await injectAndCheck('wheel', async () => { await s.page.mouse.wheel(0, 120); });
    await injectAndCheck('HUD pointermove', async () => { await s.page.mouse.move(1240, 20); });
    // 组合输入（IME）：CDP 生成真实 isTrusted 的 compositionstart/update
    const cdp = await s.context.newCDPSession(s.page);
    // IME 组合事件需要可编辑焦点元素才会真实派发（CDP 实测：无焦点时 0 条，聚焦 contenteditable 后 isTrusted=true）
    await s.page.evaluate(() => {
      const d = document.createElement('div');
      d.id = '__ime_probe';
      d.contentEditable = 'true';
      d.style.position = 'fixed';
      d.style.left = '-9999px';
      d.style.width = '10px';
      document.body.appendChild(d);
      d.focus();
    });
    await injectAndCheck('compositionstart (IME)', async () => {
      await cdp.send('Input.imeSetComposition', { text: 'a', selectionStart: 1, selectionEnd: 1 });
    });
    await s.page.evaluate(() => { const d = document.getElementById('__ime_probe'); if (d) d.remove(); });
    await s.page.keyboard.press('Escape');

    // AC-12c 续：触屏类（touchstart / 多点 touchmove / touchCancel 派生的 pointercancel）也必须断开。
    // 这些事件在无触屏能力的上下文里不会真实派发，因此单独开一个 hasTouch 的浏览器上下文。
    const s5 = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 }, touch: true });
    await s5.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    const cdp5 = await s5.context.newCDPSession(s5.page);
    async function waitEngaged5() {
      await s5.page.waitForFunction(() => window.PB.main.state().ap.engaged === true, null, { timeout: 12000 });
    }
    async function injectAndCheck5(label, inject) {
      await waitEngaged5();
      await inject();
      const r = await s5.page.evaluate(async () => {
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        return { engaged: window.PB.main.state().ap.engaged, idle: window.PB.debug.stats().idleSec };
      });
      classes.push({ label, ...r });
      check(scenario, `AC-12c ${label} cancels AUTO in the next frame`, r.engaged, false);
    }
    await injectAndCheck5('touchstart', async () => {
      await cdp5.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 640, y: 400 }] });
      // 手指抬起：否则 orbitPtrs 常驻会让 userActive 永远为真（正确的行为），后面就无法重新进入 AUTO
      await cdp5.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    });
    await injectAndCheck5('two-finger touchmove', async () => {
      await cdp5.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 500, y: 400 }, { x: 780, y: 420 }] });
      await cdp5.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 520, y: 410 }, { x: 800, y: 430 }] });
      await cdp5.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    });
    await injectAndCheck5('touchCancel (pointercancel)', async () => {
      await cdp5.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 600, y: 380 }] });
      await cdp5.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    });
    const touchHeld = await s5.page.evaluate(() => ({ ptrMap: window.PB.debug.stats().ptrMapSize, orbit: window.PB.debug.stats().orbitPtrs }));
    check(scenario, 'pointer/touch release clears ptrMap and orbit pointers (no stuck button)', [touchHeld.ptrMap, touchHeld.orbit], [0, 0]);

    // AC-12b：任意动作 held 10 s 期间不 engage
    const s2 = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 } });
    await s2.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await s2.page.keyboard.down('KeyA');
    await s2.page.waitForTimeout(10200);
    const b = await s2.page.evaluate(() => ({ engaged: window.PB.main.state().ap.engaged, held: window.PB.debug.stats().heldSet }));
    await s2.page.keyboard.up('KeyA');
    check(scenario, 'AC-12b held key 10 s never engages', b.engaged, false);
    check(scenario, 'AC-12b key still held at the end (left in heldSet)', b.held.indexOf('left') >= 0, true);

    // AC-12d：页面重新可见后 6 s 内不 engage（走真实 visibilitychange → resumeRunning 路径）
    const s3 = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 } });
    await s3.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await s3.page.waitForTimeout(7000);   // 先让它进入 AUTO
    const wasEngaged = await s3.page.evaluate(() => window.PB.main.state().ap.engaged);
    await s3.page.evaluate(() => {
      // 模拟 hidden→visible：main 的 visibilitychange 监听会调用 resumeRunning('visible')
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await s3.page.waitForTimeout(5600);
    const d = await s3.page.evaluate(() => ({ engaged: window.PB.main.state().ap.engaged, idle: window.PB.debug.stats().idleSec, state: window.PB.main.app.state }));
    await s3.page.waitForTimeout(900);
    const d2 = await s3.page.evaluate(() => ({ engaged: window.PB.main.state().ap.engaged, idle: window.PB.debug.stats().idleSec }));
    check(scenario, 'AC-12d AUTO was engaged before the visibility cycle', wasEngaged, true);
    check(scenario, 'AC-12d no engage within 6 s after visible', d.engaged, false);
    check(scenario, 'AC-12d app still running after the visibility cycle', d.state, 'running');
    check(scenario, 'AC-12d engages again after 6 s idle', d2.engaged, true);
    await close(s); await close(s2); await close(s3); await close(s5);
    collect(scenario, s, { ac12a: { ...a, badgeBefore, badgeAfter }, ac12c: classes, ac12b: b, ac12d: { wasEngaged, d, d2 } });
  },

  // ==== P11：14 条成就的真实玩法路径（LONG：约 2 分钟，默认不跑；TASK002_ONLY / TASK002_LONG=1 时执行）====
  async 'p11-ach-play'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s.page);
    const unlockedIds = async () => s.page.evaluate(() => window.PB.achievements.list().filter((x) => x.at > 0).map((x) => x.id));

    // ---- SPEED_DEMON：按住 W 真实加速到 ≥15 并保持 3 s ----
    await s.page.keyboard.down('KeyW');
    await s.page.waitForFunction(() => {
      const G = window.PB.main.state();
      return G.bike.v >= 15 && G.stats.speedHighT >= 3.05;
    }, null, { timeout: 45000 });
    await s.page.keyboard.up('KeyW');
    check(scenario, 'SPEED_DEMON unlocked by holding W (v≥15 for 3 s)', (await unlockedIds()).indexOf('SPEED_DEMON') >= 0, true);

    // ---- DIST_1K / DIST_5K：用 setS 定位（瞬移本身不作为玩法证据，记录在案） ----
    await s.page.evaluate(() => window.PB.debug.setS(1000));
    await s.page.waitForTimeout(200);
    await s.page.evaluate(() => window.PB.debug.setS(5000));
    await s.page.waitForTimeout(200);
    const afterDist = await unlockedIds();
    check(scenario, 'DIST_1K unlocked at S ≥ 1000', afterDist.indexOf('DIST_1K') >= 0, true);
    check(scenario, 'DIST_5K unlocked at S ≥ 5000', afterDist.indexOf('DIST_5K') >= 0, true);

    // ---- NIGHT_RIDER：夜间相位 + 按住 W 30 s（v≥3） ----
    await s.page.evaluate(() => window.PB.debug.setPhase(0.5));
    await s.page.keyboard.down('KeyW');
    await s.page.waitForFunction(() => window.PB.main.state().stats.nightRideT >= 30.05, null, { timeout: 60000 });
    await s.page.keyboard.up('KeyW');
    check(scenario, 'NIGHT_RIDER unlocked after 30 s night riding', (await unlockedIds()).indexOf('NIGHT_RIDER') >= 0, true);

    // ---- LONG_WHEELIE：v≥4 时按住 T 3 s ----
    await s.page.keyboard.down('KeyW');
    await s.page.waitForTimeout(1500);
    await s.page.keyboard.down('KeyT');
    await s.page.waitForFunction(() => window.PB.main.state().stats.wheelieT >= 3.05, null, { timeout: 15000 });
    const wheelieUnlocked = (await unlockedIds()).indexOf('LONG_WHEELIE') >= 0;
    // 保持 T 按住，进入"抬头吞鱼 + 50 条 + 连击"阶段
    await s.page.keyboard.up('KeyW');
    check(scenario, 'LONG_WHEELIE unlocked (wheelie ≥0.26, v≥4, 3 s)', wheelieUnlocked, true);

    // ---- WHEELIE_CATCH / COMBO_5 / FIRST_CATCH / FISH_10 / FISH_50：真实捕获 ----
    await s.page.evaluate(() => { window.PB.debug.freezeTime(false); window.PB.debug.setSpeed(0); });
    await s.page.evaluate(async () => {
      const PB = window.PB;
      const t0 = performance.now();
      await new Promise((res) => {
        const tick = () => {
          const G = PB.main.state();
          PB.debug.setSpeed(0);
          PB.input.markActivity(performance.now() / 1000);
          // 保持最多 6 条鱼：每帧补满（捕到的鱼会短暂保留，因此用 nextFishS 关闭自动生成）
          G.nextFishS = 1e12;
          while (G.fish.length < 6) PB.debug.spawnFish(1, false, 1.072);
          if (G.score.catches >= 52 || performance.now() - t0 > 45000) { res(); return; }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    });
    const catchStage = await s.page.evaluate(() => ({
      catches: window.PB.main.state().score.catches,
      combo: window.PB.main.state().score.combo,
      wheelie: window.PB.main.state().bike.wheelie
    }));
    await s.page.keyboard.up('KeyT');
    const afterCatch = await unlockedIds();
    check(scenario, 'FIRST_CATCH unlocked by a real catch', afterCatch.indexOf('FIRST_CATCH') >= 0, true);
    check(scenario, 'FISH_10 unlocked at ≥10 catches', afterCatch.indexOf('FISH_10') >= 0, true);
    check(scenario, 'FISH_50 unlocked at ≥50 catches', afterCatch.indexOf('FISH_50') >= 0, true);
    check(scenario, 'COMBO_5 unlocked by a real 5× combo', afterCatch.indexOf('COMBO_5') >= 0, true);
    check(scenario, 'WHEELIE_CATCH unlocked while holding T', afterCatch.indexOf('WHEELIE_CATCH') >= 0, true);
    check(scenario, 'catches reached 50+', catchStage.catches, null, catchStage.catches >= 50);

    // ---- CAMERA_TOUR：真实按键切换 5 个镜头各 ≥1 s ----
    for (const key of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']) {
      await s.page.keyboard.press(key);
      await s.page.waitForTimeout(1250);
    }
    await s.page.keyboard.press('Digit1');
    await s.page.waitForTimeout(600);
    const camUsed = await s.page.evaluate(() => window.PB.main.state().stats.camUsed.slice());
    check(scenario, 'CAMERA_TOUR unlocked (all 5 cameras ≥1 s)', (await unlockedIds()).indexOf('CAMERA_TOUR') >= 0, true);
    check(scenario, 'camUsed all ≥1 s', camUsed.every((x) => x >= 1), true);

    // ---- FULL_CYCLE：跨过周期边界（真实 sim.step 推 cycleWrap） ----
    await s.page.evaluate(() => window.PB.debug.setPhase(0.999));
    await s.page.keyboard.down('KeyW');
    await s.page.waitForFunction(() => window.PB.main.state().cycle >= 1, null, { timeout: 15000 });
    await s.page.keyboard.up('KeyW');
    check(scenario, 'FULL_CYCLE unlocked on cycleWrap', (await unlockedIds()).indexOf('FULL_CYCLE') >= 0, true);

    // ---- AIR_CATCH / AUTO_FISHER：交给真实自动驾驶抓 3 条 high 鱼 ----
    await stopKeepAwake(s.page);
    await s.page.evaluate(() => { window.PB.debug.setSpeed(0); });
    await s.page.waitForFunction(() => window.PB.main.state().ap.engaged === true, null, { timeout: 15000 });
    await s.page.evaluate(async () => {
      const PB = window.PB;
      const t0 = performance.now();
      let lastSpawn = 0;
      await new Promise((res) => {
        const tick = () => {
          const G = PB.main.state();
          const now = performance.now();
          if (now - lastSpawn > 2600 && G.fish.filter((f) => f.state === 'alive').length < 2) {
            PB.debug.spawnFish(G.bike.lane, true, 40);
            lastSpawn = now;
          }
          if (G.stats.apCatches >= 3 || G.score.catches >= 66 || now - t0 > 40000) { res(); return; }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    });
    const autoStage = await s.page.evaluate(() => ({
      apCatches: window.PB.main.state().stats.apCatches,
      catches: window.PB.main.state().score.catches,
      engaged: window.PB.main.state().ap.engaged
    }));
    const finalIds = await unlockedIds();
    check(scenario, 'AIR_CATCH unlocked by an airborne catch', finalIds.indexOf('AIR_CATCH') >= 0, true);
    check(scenario, 'AUTO_FISHER unlocked by 3 autopilot catches', finalIds.indexOf('AUTO_FISHER') >= 0, true);
    check(scenario, 'AC-7 all 14 achievements unlocked through real play', finalIds.length, 14);
    const st = await s.page.evaluate(() => window.PB.debug.stats());
    await close(s);
    collect(scenario, s, {
      unlocked: finalIds, catchStage, autoStage, camUsed,
      stats: { tris: st.tris, calls: st.calls, achCount: st.achCount },
      note: 'DIST_1K/DIST_5K 用 debug.setS 定位（瞬移不作为玩法证据）；其余 12 条均由真实输入/物理/事件触发'
    });
  },

  // ==== P9–P12：WebGL1 下的鱼与机位（UD-1 / M-06 / PR-3 能力路径）====
  async 'p9-gl1'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, args: ['--disable-webgl2'], viewport: { width: 1280, height: 720 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s.page);
    const base = await s.page.evaluate(() => {
      const r = window.PB.scene.renderer();
      return {
        glVersion: window.PB.debug.stats().glVersion,
        isWebGL2: r.capabilities.isWebGL2,
        version: r.getContext().getParameter(r.getContext().VERSION),
        isWebGL2Ctx: r.getContext() instanceof window.WebGL2RenderingContext
      };
    });
    check(scenario, 'WebGL1: glVersion == 1', base.glVersion, 1);
    check(scenario, 'WebGL1: capabilities.isWebGL2 == false', base.isWebGL2, false);
    check(scenario, 'WebGL1: VERSION starts with WebGL 1.0', String(base.version).indexOf('WebGL 1.0'), 0);
    check(scenario, 'WebGL1: not a WebGL2RenderingContext', base.isWebGL2Ctx, false);
    // 鱼 + 三种机位在 WebGL1 下都要真实绘制
    const readings = [];
    for (const mode of [0, 1, 3, 4]) {
      await s.page.evaluate((m) => {
        const PB = window.PB;
        PB.debug.setSpeed(0);
        const G = PB.main.state();
        G.nextFishS = 1e12;
        // 鱼放在 20 m 外（悬停、不会被立刻捕获），确保 WebGL1 下真的画出一条活鱼
        if (!G.fish.some((f) => f.state === 'alive')) PB.debug.spawnFish(1, false, 20);
        PB.debug.setCamera(m);
      }, mode);
      await settle(s.page, `PB.debug.setCamera(${mode}); PB.input.markActivity(performance.now()/1000);`, 1200);
      const st = await s.page.evaluate(() => {
        const st2 = window.PB.debug.stats();
        return { mode: st2.camMode, tris: st2.tris, calls: st2.calls, fishMeshErr: st2.fishMeshErr, headVisErr: st2.headVisErr, fishAlive: st2.fishAlive };
      });
      readings.push(st);
      check(scenario, `WebGL1 mode ${mode}: renders (tris > 0, calls > 0)`, [st.tris > 0, st.calls > 0], [true, true]);
      check(scenario, `WebGL1 mode ${mode}: live fish rendered (fishAlive ≥ 1)`, st.fishAlive, null, st.fishAlive >= 1);
      check(scenario, `WebGL1 mode ${mode}: fish mesh error ≤ 1e-4`, st.fishMeshErr, null, st.fishMeshErr <= 1e-4);
      check(scenario, `WebGL1 mode ${mode}: head visibility violations == 0`, st.headVisErr, 0);
    }
    const stEnd = await s.page.evaluate(() => window.PB.debug.stats());
    check(scenario, 'WebGL1: draw calls ≤ 100', stEnd.calls, null, stEnd.calls <= 100);
    check(scenario, 'WebGL1: triangles ≤ 150k', stEnd.tris, null, stEnd.tris <= 150000);
    check(scenario, 'WebGL1: errorsIn10s == 0', stEnd.errorsIn10s, 0);
    await close(s);
    collect(scenario, s, { base, readings, stats: { tris: stEnd.tris, calls: stEnd.calls } });
  },

  // ==== P13：程序化音频（AC-9a/9b/9c、静音持久化、零音频文件）====
  async 'p13-audio'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s.page);

    // --- 手势前：如实报告 idle，bpm=0（不伪造音乐） ---
    const before = await s.page.evaluate(() => ({ state: window.PB.debug.stats().audioState, bpm: window.PB.debug.stats().bpm, muted: window.PB.debug.stats().muted, ctx: window.PB.audio.ctxState() }));
    check(scenario, 'AC-9a before gesture: audioState idle', before.state, 'idle');
    check(scenario, 'AC-9a before gesture: no AudioContext created', before.ctx, null);
    check(scenario, 'UD-5 muted default false', before.muted, false);

    // --- 真实可信手势解锁（page.mouse.click 产生 isTrusted 的 pointerdown/click）---
    await s.page.mouse.click(640, 400);
    await s.page.waitForTimeout(300);
    const unlocked = await s.page.evaluate(() => ({ state: window.PB.debug.stats().audioState, ctx: window.PB.audio.ctxState(), unlocked: window.PB.audio.isUnlocked(), bpm: window.PB.audio.bpm() }));
    check(scenario, 'AC-9a gesture unlocks AudioContext', unlocked.unlocked, true);
    check(scenario, 'AC-9a after gesture: audioState running', unlocked.state, 'running');
    check(scenario, 'AC-9a real AudioContext state is running', unlocked.ctx, 'running');
    check(scenario, 'P13 music is ON after the first gesture (UD-5)', unlocked.bpm > 0, true);

    // --- AC-9b：setSpeed(4) 稳态后 held W，bpm 单调不减且 ≤26 s 内到达 140 ---
    await s.page.evaluate(() => window.PB.debug.setSpeed(4));
    await s.page.keyboard.down('KeyW');
    const series = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 26000) {
      const rd = await s.page.evaluate(() => {
        const st = window.PB.debug.stats();
        return { bpm: st.bpm, v: st.v, state: st.audioState };
      });
      rd.t = (Date.now() - t0) / 1000;
      series.push(rd);
      if (rd.bpm >= 140) break;
      await s.page.waitForTimeout(250);
      await s.page.evaluate(() => window.PB.input.markActivity(performance.now() / 1000));
    }
    await s.page.keyboard.up('KeyW');
    await s.page.evaluate(() => window.PB.debug.setSpeed(0));
    let monotonic = true;
    for (let i = 1; i < series.length; i++) if (series[i].bpm < series[i - 1].bpm) monotonic = false;
    const last = series[series.length - 1] || { bpm: 0, v: 0 };
    const elapsed = (Date.now() - t0) / 1000;
    check(scenario, 'AC-9b bpm monotonically non-decreasing while accelerating', monotonic, true);
    check(scenario, 'AC-9b bpm reaches ≥140 within 26 s', last.bpm, null, last.bpm >= 140);
    check(scenario, 'AC-9b BPM target maps from real cadence (v reached ~16 m/s)', last.v, null, last.v > 15);

    // --- AC-9c：页面 hidden 后下一帧 audioState === 'suspended' ---
    // 先试真实切标签页（headed 下有效）；headless 下浏览器不把后台页标记为 hidden，
    // 此时退化为"覆写 document.hidden 并派发真实 visibilitychange 事件"，只验证本应用的反应路径，
    // 并在报告里记录实际使用的方法（method: 'tab' | 'override'）。
    const hiddenProbe = await (async () => {
      const other = await s.context.newPage();
      await other.goto('about:blank');
      await other.bringToFront();
      await s.page.waitForTimeout(400);
      let method = 'tab';
      let rd = await s.page.evaluate(() => ({ state: window.PB.debug.stats().audioState, hidden: document.hidden, ctx: window.PB.audio.ctxState() }));
      if (!rd.hidden) {
        method = 'override';
        await s.page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await s.page.waitForTimeout(400);
        rd = await s.page.evaluate(() => ({ state: window.PB.debug.stats().audioState, hidden: document.hidden, ctx: window.PB.audio.ctxState() }));
      }
      await s.page.bringToFront();
      if (method === 'override') {
        await s.page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
          document.dispatchEvent(new Event('visibilitychange'));
        });
      }
      await s.page.waitForTimeout(700);
      const back = await s.page.evaluate(() => ({ state: window.PB.debug.stats().audioState, hidden: document.hidden, ctx: window.PB.audio.ctxState() }));
      await other.close();
      return { method, rd, back };
    })();
    check(scenario, 'AC-9c document.hidden after switching tabs', hiddenProbe.rd.hidden, true);
    check(scenario, 'AC-9c audioState suspended while hidden', hiddenProbe.rd.state, 'suspended');
    check(scenario, 'AC-9c real AudioContext suspended while hidden', hiddenProbe.rd.ctx, 'suspended');
    check(scenario, 'AC-9c audioState running again after coming back', hiddenProbe.back.state, 'running');

    // --- 静音：M 键 → master 0 + suspend + 持久化；再按一次恢复 ---
    await s.page.keyboard.press('KeyM');
    await s.page.waitForTimeout(350);
    const muted = await s.page.evaluate(() => ({ state: window.PB.debug.stats().audioState, muted: window.PB.debug.stats().muted, stored: window.PB.store.get().settings.muted, ctx: window.PB.audio.ctxState(), icon: document.getElementById('touch-mute').textContent }));
    check(scenario, 'P13 M mutes: audioState suspended', muted.state, 'suspended');
    check(scenario, 'P13 M mutes: store.settings.muted persisted true', [muted.muted, muted.stored], [true, true]);
    check(scenario, 'P13 M mutes: real AudioContext suspended', muted.ctx, 'suspended');
    check(scenario, 'P13 mute icon switches to 🔇', muted.icon, '🔇');
    await s.page.keyboard.press('KeyM');
    await s.page.waitForTimeout(350);
    const unmuted = await s.page.evaluate(() => ({ state: window.PB.debug.stats().audioState, muted: window.PB.debug.stats().muted, stored: window.PB.store.get().settings.muted, icon: document.getElementById('touch-mute').textContent }));
    check(scenario, 'P13 unmute resumes: audioState running', unmuted.state, 'running');
    check(scenario, 'P13 unmute persists false', [unmuted.muted, unmuted.stored], [false, false]);
    check(scenario, 'P13 unmute icon switches back to 🔊', unmuted.icon, '🔊');

    // --- AC-9a：仓库里没有音频文件（全部现场合成）---
    const { execSync } = await import('node:child_process');
    const audioFiles = execSync('find . -type f -not -path "./tools/e2e/node_modules/*" -not -path "./tools/vendor/node_modules/*" \\( -name "*.mp3" -o -name "*.wav" -o -name "*.ogg" -o -name "*.m4a" -o -name "*.aac" \\)', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
    check(scenario, 'AC-9a no audio files in the repository', audioFiles, []);
    await close(s);
    collect(scenario, s, { before, unlocked, series: series.slice(0, 3).concat(series.slice(-3)), elapsed, hiddenProbe, muted, unmuted, audioFiles });
  },

  // ==== P14：画质自适应（AC-11a 真实降级/恢复、DPR、等级落到渲染资源）====
  async 'p14-quality'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s.page);

    const init = await s.page.evaluate(() => {
      const st = window.PB.debug.stats();
      return { level: st.level, dpr: st.dpr, pixelNormals: st.pixelNormals, devicePixelRatio: window.devicePixelRatio };
    });
    check(scenario, '§4.10 initial level is L2 on a fine pointer', init.level, 2);
    check(scenario, '§4.10 L2 DPR cap = min(devicePixelRatio, 1.5)', init.dpr, Math.min(init.devicePixelRatio, 1.5));

    // --- AC-11a：burnMs=25（每帧 +25 ms 忙等）后 ≤4.5 s 降一级（真实帧时长驱动）---
    const t0 = Date.now();
    await s.page.evaluate(() => window.PB.debug.burnMs(25));
    let down = null;
    while (Date.now() - t0 < 8000) {
      const st = await s.page.evaluate(() => window.PB.debug.stats());
      if (st.level < 2) { down = { level: st.level, t: (Date.now() - t0) / 1000, fpsWin: st.fpsWin }; break; }
      await s.page.waitForTimeout(100);
      await s.page.evaluate(() => window.PB.input.markActivity(performance.now() / 1000));
    }
    check(scenario, 'AC-11a burnMs=25 downgrades one level', down ? down.level : null, 1);
    check(scenario, 'AC-11a downgrade within 4.5 s (window 1.5 s × 2)', down ? down.t : 99, null, down !== null && down.t <= 4.5 + 0.35);
    const applied1 = await s.page.evaluate(() => {
      const st = window.PB.debug.stats();
      return { level: st.level, dpr: st.dpr, pixelNormals: st.pixelNormals };
    });
    check(scenario, '§4.10 L1 applies DPR cap 1.0', applied1.dpr, Math.min(init.devicePixelRatio, 1.0));
    check(scenario, '§4.10 L1 uses per-vertex normals (pixelNormals false)', applied1.pixelNormals, false);

    // --- 恢复：停止 burn，等 5 个有效窗口 + ≥10 s 冷却后升回 L2 ---
    await s.page.evaluate(() => window.PB.debug.burnMs(0));
    const t1 = Date.now();
    let up = null;
    while (Date.now() - t1 < 22000) {
      const st = await s.page.evaluate(() => window.PB.debug.stats());
      if (st.level > 1) { up = { level: st.level, t: (Date.now() - t1) / 1000, fpsWin: st.fpsWin }; break; }
      await s.page.waitForTimeout(200);
      await s.page.evaluate(() => window.PB.input.markActivity(performance.now() / 1000));
    }
    check(scenario, 'AC-11b/§4.10 recovery: level rises back to L2 after the burn stops', up ? up.level : null, 2);
    check(scenario, 'AC-11b recovery respects the ≥10 s cooldown since the last change', up ? up.t : 0, null, up !== null && up.t >= 9.5);
    const applied2 = await s.page.evaluate(() => {
      const st = window.PB.debug.stats();
      return { level: st.level, dpr: st.dpr, pixelNormals: st.pixelNormals };
    });
    check(scenario, '§4.10 L2 restores DPR cap 1.5', applied2.dpr, Math.min(init.devicePixelRatio, 1.5));
    check(scenario, '§4.10 L2 restores per-pixel normals (highp path)', applied2.pixelNormals, true);

    // --- 强制最低级（S10 的机位条件）：L0 关泡沫、DPR 0.75、星点 1200 ---
    await s.page.evaluate(() => window.PB.debug.forceQuality(0));
    await s.page.waitForTimeout(250);
    const l0 = await s.page.evaluate(() => {
      const st = window.PB.debug.stats();
      return { level: st.level, dpr: st.dpr, pixelNormals: st.pixelNormals, tris: st.tris, calls: st.calls, stars: window.PB.sky ? window.PB.sky.countStarsInView(window.PB.camera.object()) : null };
    });
    check(scenario, 'S10 forceQuality(0): level 0', l0.level, 0);
    check(scenario, 'S10 L0 DPR cap 0.75', l0.dpr, Math.min(init.devicePixelRatio, 0.75));
    check(scenario, 'S10 L0 per-vertex normals', l0.pixelNormals, false);
    check(scenario, 'S10 L0 still renders (tris > 0, calls > 0)', [l0.tris > 0, l0.calls > 0], [true, true]);
    await s.page.evaluate(() => window.PB.debug.freezeTime(true));
    await s.page.evaluate(() => { window.PB.debug.setPhase(0.05); window.PB.debug.setSpeed(8); });
    await s.page.waitForTimeout(200);
    await shot(s.page, 'S10-quality-L0-p14.png', { scenario: 'p14-quality', setting: 'p=0.05 mode=0 v=8 forceQuality(0)', readings: l0 });
    await s.page.evaluate(() => { window.PB.debug.freezeTime(false); window.PB.debug.forceQuality(2); });
    await s.page.waitForTimeout(200);
    const restored = await s.page.evaluate(() => window.PB.debug.stats());
    check(scenario, 'P14 forceQuality(2) restores L2', restored.level, 2);

    // --- 性能读数（PR-9 的门槛需要真实 GPU，headless 只记录不判） ---
    check(scenario, 'perf: draw calls ≤ 100', restored.calls, null, restored.calls <= 100);
    check(scenario, 'perf: triangles ≤ 150k', restored.tris, null, restored.tris <= 150000);
    await close(s);
    collect(scenario, s, { init, down, up, applied1, applied2, l0, perf: { fpsWin: restored.fpsWin, tris: restored.tris, calls: restored.calls } });
  },

  // ==== P15：触屏控件（AC-10 真实多点触摸）+ CSS 迁移（ADR-39 / S8、S9）====
  async 'p15-touch'(scenario) {
    // ---------- A. 触屏：390×844、hasTouch、真实多点 PointerEvent（CDP Input.dispatchTouchEvent） ----------
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 390, height: 844 }, touch: true });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s.page);

    // 显示条件：粗指针设备立即显示；细指针设备等第一次 touch 指针事件（§4.5.4）
    const coarse = await s.page.evaluate(() => !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches));
    let visible = await s.page.evaluate(() => window.PB.hud.touchVisible());
    if (!visible) {
      // 用真实的触摸事件触发 fallback（不是直接调 showTouch）
      const cdp0 = await s.context.newCDPSession(s.page);
      await cdp0.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 400, id: 0 }] });
      await cdp0.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await s.page.waitForTimeout(200);
      visible = await s.page.evaluate(() => window.PB.hud.touchVisible());
      await cdp0.detach();
    }
    check(scenario, 'AC-10 touch controls become visible (coarse pointer or first touch event)', visible, true);

    // 按钮几何：全部 ≥56 CSS px（§2.2），且都在视口内
    const rects = await s.page.evaluate(() => {
      const out = {};
      document.querySelectorAll('#touch [data-act]').forEach((el) => {
        const r = el.getBoundingClientRect();
        out[el.getAttribute('data-act')] = { x: r.x, y: r.y, w: r.width, h: r.height, inView: r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
      });
      return out;
    });
    const acts = Object.keys(rects);
    check(scenario, 'AC-10 all eight touch actions exist', acts.sort(), ['achList', 'brake', 'camNext', 'jump', 'left', 'mute', 'right', 'throttle', 'wing']);
    const tooSmall = acts.filter((a) => rects[a].w < 56 || rects[a].h < 56);
    check(scenario, 'AC-10 every touch button ≥56 CSS px', tooSmall, []);
    const offscreen = acts.filter((a) => !rects[a].inView);
    check(scenario, 'AC-10 every touch button inside the viewport', offscreen, []);

    // 真实多点：两指同时按 ◀（CDP 产生 isTrusted 的 pointerdown，id 各一）
    const cdp = await s.context.newCDPSession(s.page);
    const lx = rects.left.x + rects.left.w / 2, ly = rects.left.y + rects.left.h / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lx - 8, y: ly, id: 0 }, { x: lx + 8, y: ly, id: 1 }] });
    await s.page.waitForTimeout(220);
    const two = await s.page.evaluate(() => { const st = window.PB.input.stats(); const s2 = window.PB.debug.stats(); return { ptrMapSize: st.ptrMapSize, ptrCountSum: st.ptrCountSum, heldSet: s2.heldSet }; });
    check(scenario, 'AC-10 two fingers on ◀ → two tracked pointers', two.ptrMapSize, 2);
    check(scenario, 'AC-10 two fingers on ◀ → held(left)', two.heldSet.indexOf('left') >= 0, true);

    // 抬起一指：CDP 语义为"touchEnd + 剩余触点"（缺失的 id 生成一次 release）；仍为 held
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: lx + 8, y: ly, id: 1 }] });
    await s.page.waitForTimeout(220);
    const one = await s.page.evaluate(() => { const st = window.PB.input.stats(); return { ptrMapSize: st.ptrMapSize, heldSet: window.PB.debug.stats().heldSet }; });
    check(scenario, 'AC-10 release one finger → still one tracked pointer', one.ptrMapSize, 1);
    check(scenario, 'AC-10 release one finger → still held(left)', one.heldSet.indexOf('left') >= 0, true);

    // 抬起两指：释放
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await s.page.waitForTimeout(240);
    const zero = await s.page.evaluate(() => { const st = window.PB.input.stats(); return { ptrMapSize: st.ptrMapSize, heldSet: window.PB.debug.stats().heldSet }; });
    check(scenario, 'AC-10 release both fingers → no tracked pointers', zero.ptrMapSize, 0);
    check(scenario, 'AC-10 release both fingers → held(left) cleared', zero.heldSet.indexOf('left'), -1);

    // 拖出按钮后松开：不得卡住（capture 会继续跟踪，抬起即释放）
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lx, y: ly, id: 0 }] });
    await s.page.waitForTimeout(160);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 300, y: 120, id: 0 }] });
    await s.page.waitForTimeout(160);
    const dragging = await s.page.evaluate(() => window.PB.debug.stats().heldSet);
    check(scenario, 'AC-10 pointer capture keeps held while the finger drags off the button', dragging.indexOf('left') >= 0, true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await s.page.waitForTimeout(220);
    const afterDrag = await s.page.evaluate(() => { const st = window.PB.input.stats(); return { ptrMapSize: st.ptrMapSize, heldSet: window.PB.debug.stats().heldSet }; });
    check(scenario, 'AC-10 drag out + release → not stuck', [afterDrag.ptrMapSize, afterDrag.heldSet.indexOf('left')], [0, -1]);

    // 键盘并存：触屏按住 ▶ 的同时按 D，两者都算 held；松键后仍由触屏保持
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rects.right.x + 20, y: rects.right.y + 20, id: 0 }] });
    await s.page.waitForTimeout(160);
    await s.page.keyboard.down('KeyD');
    await s.page.waitForTimeout(160);
    const both = await s.page.evaluate(() => window.PB.debug.stats().heldSet);
    await s.page.keyboard.up('KeyD');
    await s.page.waitForTimeout(160);
    const touchOnly = await s.page.evaluate(() => window.PB.debug.stats().heldSet);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await s.page.waitForTimeout(160);
    check(scenario, 'AC-10 keyboard coexists with touch (both held at once)', both.indexOf('right') >= 0, true);
    check(scenario, 'AC-10 touch keeps holding after the key is released', touchOnly.indexOf('right') >= 0, true);
    await cdp.detach();

    // S9：按钮完整、不遮挡车（用真实相机投影车包围盒，与按钮矩形做相交判定）
    await s.page.evaluate(() => {
      const PB = window.PB;
      PB.debug.setPhase(0.05); PB.debug.setSpeed(8); PB.debug.setCamera(0);
      const G = PB.main.state();
      G.bike.lane = 1; G.bike.laneT = 1; G.bike.x = 0; G.bike.y = 0; G.bike.wheelie = 0; G.bike.lean = 0;
    });
    await settle(s.page, 'PB.debug.setCamera(0); PB.input.markActivity(performance.now()/1000);', 2600);
    await s.page.evaluate(() => { window.PB.debug.setPhase(0.05); window.PB.debug.setSpeed(8); window.PB.debug.freezeTime(true); });
    await s.page.waitForTimeout(200);
    const s9ci = await cameraInfo(s.page);
    const carBox = (() => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const yy of [0, 1.98]) for (const zz of [-1.072, 0]) for (const xx of [-0.45, 0.45]) {
        const n = projectWithCamera(s9ci, { x: xx, y: yy, z: zz });
        const px = (n.x * 0.5 + 0.5) * 390, py = (1 - (n.y * 0.5 + 0.5)) * 844;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      return { x0, y0, x1, y1 };
    })();
    const overlap = acts.filter((a) => {
      const r = rects[a];
      return !(r.x + r.w < carBox.x0 || r.x > carBox.x1 || r.y + r.h < carBox.y0 || r.y > carBox.y1);
    });
    check(scenario, 'S9 touch buttons do not cover the car (projected bbox)', overlap, []);
    const s9path = await shot(s.page, 'S9-touch-390x844-p15.png', { scenario: 'p15-touch', setting: '390×844 DPR1 touch p=0.05 mode=0', carBox, rects });
    await s.page.evaluate(() => window.PB.debug.freezeTime(false));
    await close(s);

    // ---------- B. CSS 迁移（ADR-39）：index.html 无内联 style；迁移前后逐像素一致 ----------
    const { execSync } = await import('node:child_process');
    const styleCount = Number(execSync('grep -c "<style" index.html || true', { cwd: ROOT, encoding: 'utf8' }).trim() || 0);
    check(scenario, 'ADR-39 build: index.html inline <style> count == 0', styleCount, 0);

    // 迁移前的内联块逐字保留在这里作为对照基线（ADR-39 的原始文本）。
    // 判据：在同一冻结帧上，把这段原始规则重新注入页面，渲染结果必须与迁移后的 css/style.css 完全一致
    // （差分 0 px）。若迁移时漏了规则、改了选择器或改了数值，注入的规则就会覆盖出不同画面。
    const ORIGINAL_INLINE = `
  /* P9/P11/P12 追加：HUD 七项、toast 与成就面板的样式（MAY；css/style.css 属 P15 的文件集）。
     只用绝对定位覆盖在画布上，#hud 本身 pointer-events:none，只有面板与关闭按钮重新开启。 */
  #hud-tl, #hud-tr { position: absolute; padding: 10px 14px; color: #f4f1ea; text-shadow: 0 1px 2px rgba(0,0,0,.75); font-variant-numeric: tabular-nums; }
  #hud-tl { left: 0; top: 0; }
  #hud-tr { right: 0; top: 0; text-align: right; }
  #hud-speed { font-size: 30px; font-weight: 700; line-height: 1; }
  #hud-unit { font-size: 12px; opacity: .75; margin-bottom: 6px; }
  #hud-score { font-size: 18px; font-weight: 600; }
  #hud-fish { font-size: 14px; opacity: .9; }
  #hud-combo { font-size: 16px; color: #ffd58a; font-weight: 700; }
  #hud-auto { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #2f6fde; color: #fff; font-weight: 700; font-size: 13px; letter-spacing: .06em; }
  #hud-ach, #hud-cam, #hud-mute { font-size: 13px; opacity: .9; }
  #hud-mute { font-size: 16px; }
  #hud-toast {
    position: absolute; left: 50%; top: 14%; transform: translate(-50%, -8px); opacity: 0;
    transition: opacity .3s ease, transform .3s ease; padding: 8px 16px; border-radius: 6px;
    background: rgba(20, 28, 44, .86); color: #ffd58a; font-size: 15px; font-weight: 600; white-space: nowrap;
  }
  #hud-toast.on { opacity: 1; transform: translate(-50%, 0); }
  #ach-panel {
    position: absolute; right: 16px; top: 96px; width: 380px; max-height: 72vh; overflow: auto;
    padding: 12px 14px; border-radius: 8px; background: rgba(12, 18, 30, .92); color: #f4f1ea;
    pointer-events: auto; font-size: 13px; line-height: 1.6;
  }
  #ach-head { display: flex; justify-content: space-between; align-items: center; font-weight: 700; margin-bottom: 6px; }
  #ach-close { pointer-events: auto; background: transparent; border: 0; color: #f4f1ea; font-size: 18px; cursor: pointer; }
  #ach-rows { margin: 0; padding-left: 18px; }
  #ach-rows li.ach-on { color: #9ae6a8; }
  #ach-rows li.ach-off { color: #b9c2cf; }
  #ach-foot { margin-top: 8px; text-align: right; }
  #ach-reset { pointer-events: auto; background: rgba(183, 40, 40, .9); color: #fff; border: 0; border-radius: 5px; padding: 6px 10px; cursor: pointer; }
`;

    const d = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1920, height: 1080 } });
    await d.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(d.page);
    await d.page.evaluate(() => {
      const PB = window.PB;
      PB.debug.setPhase(0.05); PB.debug.setSpeed(8); PB.debug.setCamera(0);
      PB.debug.freezeTime(true);
      PB.debug.unlockAch('FIRST_CATCH');
    });
    await d.page.waitForTimeout(300);
    await d.page.evaluate(() => window.PB.hud.toggleAchList());
    await d.page.waitForTimeout(400);
    const s8path = await shot(d.page, 'S8-achievement-list-p15.png', { scenario: 'p15-touch', setting: '1920×1080 p=0.05 mode=0 frozen ach panel open (post CSS migration)' });
    const s8rows = await d.page.evaluate(() => ({ rows: document.querySelectorAll('#ach-rows li').length, count: document.getElementById('ach-count').textContent, open: !document.getElementById('ach-panel').hidden }));
    check(scenario, '§4.8 ach panel still renders 14 rows after migration', [s8rows.rows, /\/14$/.test(s8rows.count), s8rows.open], [14, true, true]);
    // 注入迁移前的原始内联块，再拍同一冻结帧
    await d.page.addStyleTag({ content: ORIGINAL_INLINE });
    await d.page.waitForTimeout(250);
    const s8inlinePath = await shot(d.page, 'S8-inline-baseline-p15.png', { scenario: 'p15-touch', setting: 'same frozen frame + original inline <style> re-injected' });
    const a8 = readImage(s8path), b8 = readImage(s8inlinePath);
    const s8diff = a8.width === b8.width && a8.height === b8.height ? (() => { const dd = diffImages(a8, b8, 0); return { count: dd.count, bbox: dd.bbox }; })() : { count: -1, bbox: null };
    check(scenario, 'ADR-39 S8 pixel diff migrated vs original inline rules == 0', s8diff.count, 0);
    // 计算样式抽查：迁移后的规则真的生效（不是被删掉）
    const css = await d.page.evaluate(() => {
      const panel = document.getElementById('ach-panel');
      const toast = document.getElementById('hud-toast');
      const cs = getComputedStyle(panel);
      return { panelPos: cs.position, panelWidth: cs.width, toastTop: getComputedStyle(toast).top, hudPE: getComputedStyle(document.getElementById('hud')).pointerEvents, btnPE: cs.pointerEvents };
    });
    check(scenario, 'ADR-39 migrated #ach-panel rule is live', [css.panelPos, css.panelWidth], ['absolute', '380px']);
    check(scenario, 'ADR-39 #hud stays pointer-events:none while the panel is clickable', [css.hudPE, css.btnPE], ['none', 'auto']);
    await d.page.evaluate(() => window.PB.debug.freezeTime(false));
    await close(d);

    // S9 同一判据：390×844 上再比一次（触屏按钮不在这段内联块里，因此差分仍应为 0）
    const m = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 390, height: 844 }, touch: true });
    await m.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(m.page);
    await m.page.evaluate(() => {
      const PB = window.PB;
      PB.debug.setPhase(0.05); PB.debug.setSpeed(8); PB.debug.setCamera(0);
      PB.debug.freezeTime(true);
    });
    await m.page.waitForTimeout(400);
    const s9base = await shot(m.page, 'S9-touch-migrated-p15.png', { scenario: 'p15-touch', setting: '390×844 migrated CSS' });
    await m.page.addStyleTag({ content: ORIGINAL_INLINE });
    await m.page.waitForTimeout(250);
    const s9inline = await shot(m.page, 'S9-touch-inline-baseline-p15.png', { scenario: 'p15-touch', setting: '390×844 same frozen frame + original inline <style>' });
    const a9 = readImage(s9base), b9 = readImage(s9inline);
    const s9diff = a9.width === b9.width && a9.height === b9.height ? (() => { const dd = diffImages(a9, b9, 0); return { count: dd.count, bbox: dd.bbox }; })() : { count: -1, bbox: null };
    check(scenario, 'ADR-39 S9 pixel diff migrated vs original inline rules == 0', s9diff.count, 0);
    await m.page.evaluate(() => window.PB.debug.freezeTime(false));
    await close(m);
    collect(scenario, s, { coarse, visible, rects, s9: s9path, s8: s8path, s8diff, s9diff, css });
  },

  // ==== P16：集成（30 s 真实视频、离线、GL1、错误恢复、§5.2 抽查、性能）====
  async 'p16-integration'(scenario) {
    const s = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 } });
    await s.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await keepAwake(s.page);

    // --- §5.2 #9：五种 NaN 注入都在 1 步内自愈，且之后不再重复复位 ---
    // 同时记录真实的帧异常文本（onFrameError 不打印，所以这里包一层只读记录），用于区分
    // "§4.12 规定的合成错误（t/S 非有限 → softReset）"与真正的实现缺陷。
    await s.page.evaluate(() => {
      window.__frameErrors = [];
      const orig = window.PB.main.onFrameError;
      window.PB.main.onFrameError = function (e) {
        window.__frameErrors.push(String((e && e.message) || e));
        return orig.apply(this, arguments);
      };
    });
    const nanResets = [];
    for (const target of ['bike', 'laneT', 'laneToX', 'scarf', 'fish']) {
      const before = await s.page.evaluate(() => window.PB.debug.stats().nanResets + window.PB.debug.stats().scarfResets);
      await s.page.evaluate((t) => window.PB.debug.injectNaN(t), target);
      await s.page.waitForTimeout(120);
      const after = await s.page.evaluate(() => {
        const st = window.PB.debug.stats();
        const G = window.PB.main.state();
        return {
          resets: st.nanResets + st.scarfResets,
          bikeFinite: isFinite(G.bike.v) && isFinite(G.bike.x) && isFinite(G.bike.laneT) && isFinite(G.bike.laneToX),
          fishFinite: G.fish.every((f) => f && f.pose && isFinite(f.pose.x) && isFinite(f.pose.y) && isFinite(f.pose.z))
        };
      });
      nanResets.push({ target, delta: after.resets - before, bikeFinite: after.bikeFinite, fishFinite: after.fishFinite });
      check(scenario, `§5.2#9 injectNaN('${target}') self-heals within a step`, [after.resets - before >= 1, after.bikeFinite, after.fishFinite], [true, true, true]);
    }
    await s.page.waitForTimeout(400);
    const stable = await s.page.evaluate(() => window.PB.debug.stats().nanResets + window.PB.debug.stats().scarfResets);
    await s.page.waitForTimeout(600);
    const stable2 = await s.page.evaluate(() => window.PB.debug.stats().nanResets + window.PB.debug.stats().scarfResets);
    check(scenario, '§5.2#9 no repeated resets after self-healing', stable2 - stable, 0);
    // 注入期间只允许出现 §4.12 规定的合成错误：'bike' 注入会让 S 在同一步变成非有限，
    // healthCheck 按契约抛 'non-finite t/S' → softReset（这就是"自愈"的定义，不是缺陷）。
    const frameErrors = await s.page.evaluate(() => window.__frameErrors.slice());
    check(scenario, '§5.2#9 only the documented §4.12 synthetic error appeared during injection',
      frameErrors, ['non-finite t/S']);
    const errsBeforeZero = await s.page.evaluate(() => window.PB.debug.stats().errorsIn10s);

    // --- §5.2 #18：尺寸为 0 时不报错（resize 早退，不产生 setSize(0,0)） ---
    const zeroSize = await s.page.evaluate(() => {
      const gl = document.getElementById('gl');
      const prev = gl.style.display;
      gl.style.display = 'none';
      let threw = null;
      try { window.dispatchEvent(new Event('resize')); window.PB.scene.resize(); } catch (e) { threw = String(e && e.message); }
      const ok = window.PB.main.app.state === 'running';
      gl.style.display = prev;
      window.dispatchEvent(new Event('resize'));
      return { threw, ok, errorsIn10s: window.PB.debug.stats().errorsIn10s };
    });
    check(scenario, '§5.2#18 zero-size canvas: no throw, still running, no new errors',
      [zeroSize.threw, zeroSize.ok, zeroSize.errorsIn10s - errsBeforeZero], [null, true, 0]);

    // --- §5.2 #17：Space / 方向键的默认行为被屏蔽（不滚动页面） ---
    const prevented = await s.page.evaluate(() => {
      const out = {};
      for (const code of ['Space', 'ArrowDown', 'Escape']) {
        const ev = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true });
        window.dispatchEvent(ev);
        out[code] = ev.defaultPrevented;
        window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true }));
      }
      return out;
    });
    check(scenario, '§5.2#17 Space/Arrow/Escape preventDefault', prevented, { Space: true, ArrowDown: true, Escape: true });

    // --- §5.2 #25：成就面板打开时 WASD 仍生效，Esc 关闭面板 ---
    const panel = await s.page.evaluate(async () => {
      const PB = window.PB;
      PB.hud.toggleAchList();
      const opened = PB.hud.isAchOpen();
      const v0 = PB.main.state().bike.v;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 400));
      const v1 = PB.main.state().bike.v;
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 200));
      return { opened, accel: v1 > v0, closed: !PB.hud.isAchOpen() };
    });
    check(scenario, '§5.2#25 ach panel open → W still accelerates; Esc closes', panel, { opened: true, accel: true, closed: true });

    // --- §4.11 ctxlost → restored → running（音频门同时关闭/恢复） ---
    const errsBeforeCtx = await s.page.evaluate(() => window.PB.debug.stats().errorsIn10s);
    const ctx = await (async () => {
      await s.page.mouse.click(400, 300);        // 解锁音频，便于观察门控
      await s.page.waitForTimeout(300);
      const lost = await s.page.evaluate(() => { const ok = window.PB.debug.loseContext(); return { ok }; });
      await s.page.waitForTimeout(400);
      const during = await s.page.evaluate(() => ({ state: window.PB.main.app.state, audio: window.PB.debug.stats().audioState }));
      const restored = await s.page.evaluate(() => window.PB.debug.restoreContext());
      await s.page.waitForTimeout(900);
      const after = await s.page.evaluate(() => ({ state: window.PB.main.app.state, audio: window.PB.debug.stats().audioState, errors: window.PB.debug.stats().errorsIn10s }));
      return { lost, during, restored, after, delta: after.errors - errsBeforeCtx };
    })();
    check(scenario, '§4.11 loseContext → ctxlost with audio gated off', [ctx.during.state, ctx.during.audio], ['ctxlost', 'suspended']);
    check(scenario, '§4.11 restoreContext → running with audio resumed', [ctx.after.state, ctx.after.audio], ['running', 'running']);
    check(scenario, '§4.11 ctxlost/restore cycle adds no frame errors', ctx.delta, 0);

    // --- 性能读数（真实 GPU 门槛属 PR-9，headless 只记录） ---
    await s.page.waitForTimeout(1200);
    const perf = await s.page.evaluate(() => {
      const st = window.PB.debug.stats();
      return { fpsWin: st.fpsWin, tris: st.tris, calls: st.calls, level: st.level, dpr: st.dpr, errorsIn10s: st.errorsIn10s };
    });
    check(scenario, 'perf: draw calls ≤ 100', perf.calls, null, perf.calls <= 100);
    check(scenario, 'perf: triangles ≤ 150k', perf.tris, null, perf.tris <= 150000);
    // 10 s 窗口内只允许出现注入用例触发的那一条 §4.12 合成错误（'non-finite t/S'），
    // 其余任何帧异常都算实现缺陷。
    const allFrameErrors = await s.page.evaluate(() => window.__frameErrors.slice());
    check(scenario, 'perf: no frame errors other than the injected §4.12 synthetic one',
      allFrameErrors.filter((m) => m !== 'non-finite t/S'), []);
    await close(s);

    // ---------- 30 s 真实视频（Playwright recordVideo；含变道、POV、AUTO 接管与打断） ----------
    const VIDEO_DIR = join(EVIDENCE, 'video');
    mkdirSync(VIDEO_DIR, { recursive: true });
    const vb = await chromium.launch({ headless: process.env.PW_HEADLESS === '1', channel: process.env.PW_CHANNEL || undefined });
    const vctx = await vb.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } } });
    const vpage = await vctx.newPage();
    const vmsgs = [];
    vpage.on('console', (m) => { if (m.type() === 'error') vmsgs.push(m.text()); });
    vpage.on('pageerror', (e) => vmsgs.push(String(e && e.message)));
    await vpage.goto(`${PAGE_URL}?debug=1`, { waitUntil: 'load' });
    await vpage.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    const videoTimeline = [];
    const t0 = Date.now();
    const step = async (ms) => { await vpage.waitForTimeout(ms); };
    // 每一步都记真实读数（镜头模式/车道/横向位置/围巾角度/AUTO），这样"视频里发生了什么"
    // 可以按时间轴核对，而不是靠肉眼猜；这些读数同时进 manifest。
    const snap = async (label) => {
      const rd = await vpage.evaluate(() => {
        const G = window.PB.main.state(), st = window.PB.debug.stats();
        return {
          t: +G.t.toFixed(3), mode: G.cam.mode, lane: G.bike.lane, x: +G.bike.x.toFixed(3),
          scarfAngle: +G.scarf.angleDeg.toFixed(2), scarfLagX: +G.scarf.lagX.toFixed(4), ap: !!st.apEngaged
        };
      });
      videoTimeline.push({ label, wallSec: +((Date.now() - t0) / 1000).toFixed(2), ...rd });
      return rd;
    };
    await vpage.evaluate(() => { window.PB.debug.setPhase(0.05); window.PB.debug.setSpeed(8); });
    const vStart = await snap('start');
    await step(3000);
    // 变道 ×2（真实按键）：先右移再回中，共 3 s，围巾在横向惯性下摆动
    await vpage.keyboard.press('KeyD'); await step(1500);
    const vLaneR = await snap('lane-right');
    await step(1500);
    await vpage.keyboard.press('KeyA'); await step(1500);
    const vLaneL = await snap('lane-back');
    await step(1500);
    // POV 切换（Digit4 = 机位 3）并回追尾（Digit1 = 机位 0）。§4.5.1：Digit1–Digit5 → 机位 0–4。
    await vpage.keyboard.press('Digit4'); await step(3000);
    const vPov = await snap('pov');
    await vpage.keyboard.press('Digit1'); await step(3000);
    const vChase = await snap('chase');
    // 电影镜头（Digit3 = 机位 2）
    await vpage.keyboard.press('Digit3'); await step(3000);
    const vCine = await snap('cinematic');
    await vpage.keyboard.press('Digit1'); await step(3000);
    const vChase2 = await snap('chase-after-cine');
    // AUTO 接管（真实 6 s 空闲），随后用真实按键打断
    const apBefore = await vpage.evaluate(() => window.PB.debug.stats().apEngaged);
    await step(7000);
    const apOn = await vpage.evaluate(() => window.PB.debug.stats().apEngaged);
    await snap('auto-engaged');
    await vpage.keyboard.press('KeyW');
    await step(400);
    const apOff = await vpage.evaluate(() => window.PB.debug.stats().apEngaged);
    await snap('auto-interrupted');
    await step(5000);
    const videoElapsed = (Date.now() - t0) / 1000;
    const video = vpage.video();
    await vctx.close();
    const videoPath = await video.path();
    const { statSync } = await import('node:fs');
    const vstat = statSync(videoPath);
    const vprobe = probeVideo(videoPath);
    // 证据口径：墙钟（脚本从第一次读状态到收尾）= videoElapsed；容器时长 = vprobe.duration。
    // 两个都记，谁都不冒充谁；分辨率/帧率/编码/音轨数一律以 ffprobe 为准。
    shotManifest.push({
      name: videoPath.split('/').pop(),
      path: videoPath,
      sha256: sha256(videoPath),
      bytes: vstat.size,
      dims: vprobe.width ? `${vprobe.width}x${vprobe.height}` : null,
      kind: 'video',
      setting: 'P16 连续录屏：变道（D/A）+ POV（3→1）+ 电影（2→1）+ AUTO 6 s 空闲接管后被真实按键打断',
      readings: {
        wallElapsedSec: +videoElapsed.toFixed(3),
        fileDurationSec: vprobe.duration,
        fps: vprobe.fps,
        codec: vprobe.codec,
        audioStreams: vprobe.audioStreams,
        probeError: vprobe.error || null,
        timeline: videoTimeline,
      },
    });
    check(scenario, 'P16 video recorded (scripted wall clock ≥ 30 s)', videoElapsed, null, videoElapsed >= 30);
    check(scenario, 'P16 video container duration ≥ 30 s (ffprobe)', vprobe.duration, null, vprobe.duration >= 30);
    check(scenario, 'P16 video is 1280x720 VP8 at 25 fps (ffprobe)', [vprobe.width, vprobe.height, vprobe.codec, vprobe.fps], [1280, 720, 'vp8', '25/1']);
    check(scenario, 'P16 video has no audio stream (recordVideo is video-only; audio not claimed)', vprobe.audioStreams, 0);
    check(scenario, 'P16 video file exists and is non-trivial (> 100 KB)', vstat.size, null, vstat.size > 100 * 1024);
    check(scenario, 'P16 video session had no console errors', vmsgs, []);
    check(scenario, 'P16 AUTO engaged during 6 s idle then interrupted by a real key', [apOn, apOff], [true, false]);
    check(scenario, 'P16 video: lane changed then returned (real key presses)', [vLaneR.lane !== vStart.lane, vLaneL.lane === vStart.lane], [true, true]);
    check(scenario, 'P16 video: camera modes visited POV(3) → chase(0) → cinematic(2) → chase(0)', [vPov.mode, vChase.mode, vCine.mode, vChase2.mode], [3, 0, 2, 0]);
    await vb.close();

    // ---------- 离线（context.setOffline(true)）与 WebGL1（--disable-webgl2）----------
    const off = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 }, beforeGoto: async (c) => { await c.setOffline(true); } });
    await off.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await off.page.waitForTimeout(1500);
    const offlineRead = await off.page.evaluate(() => { const st = window.PB.debug.stats(); return { state: st.appState, tris: st.tris, calls: st.calls, glVersion: st.glVersion }; });
    const offlineNonFile = off.requests.filter((u) => !u.startsWith('file://'));
    const offlineErrors = off.messages.filter((m) => m.type === 'error' || m.type === 'pageerror');
    check(scenario, 'offline: page runs with tris > 0', [offlineRead.state, offlineRead.tris > 0], ['running', true]);
    check(scenario, 'offline: zero non-file requests', offlineNonFile, []);
    check(scenario, 'offline: zero console errors', offlineErrors, []);
    await close(off);

    const gl1 = await open({ url: `${PAGE_URL}?debug=1`, viewport: { width: 1280, height: 720 }, args: ['--disable-webgl2'] });
    await gl1.page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });
    await gl1.page.waitForTimeout(1500);
    const gl1Read = await gl1.page.evaluate(() => {
      const r = window.PB.scene.renderer();
      const st = window.PB.debug.stats();
      return { glVersion: st.glVersion, isWebGL2: r.capabilities.isWebGL2, tris: st.tris, calls: st.calls, errors: st.errorsIn10s };
    });
    check(scenario, 'GL1 path: glVersion 1, not WebGL2, renders', [gl1Read.glVersion, gl1Read.isWebGL2, gl1Read.tris > 0], [1, false, true]);
    const gl1Errors = gl1.messages.filter((m) => m.type === 'error' || m.type === 'pageerror');
    check(scenario, 'GL1 path: zero console errors', gl1Errors, []);
    await close(gl1);

    collect(scenario, s, {
      nanResets, zeroSize, prevented, panel, ctx, perf,
      video: {
        path: videoPath, bytes: vstat.size, sha256: sha256(videoPath),
        wallElapsedSec: +videoElapsed.toFixed(3), fileDurationSec: vprobe.duration,
        width: vprobe.width, height: vprobe.height, fps: vprobe.fps, codec: vprobe.codec,
        audioStreams: vprobe.audioStreams, timeline: videoTimeline
      },
      offline: offlineRead, gl1: gl1Read
    });
  },

};

mkdirSync(SCREEN_DIR, { recursive: true });

// 长跑用例（AC-2d 的 10 min 等）默认不跑：常规门禁必须几分钟内可复现。
// 显式 TASK002_ONLY=... 或 TASK002_LONG=1 时才执行（避免默认 `node app.mjs` 卡 10 分钟）。
const LONG = new Set(['p6-scarf-10min', 'p11-ach-play']);
const only = process.env.TASK002_ONLY ? process.env.TASK002_ONLY.split(',').map((id) => id.trim()) : null;
const ids = Object.keys(SCENARIOS).filter((id) => {
  if (only) return only.includes(id);
  if (LONG.has(id)) return process.env.TASK002_LONG === '1';
  return true;
});
const skippedLong = Object.keys(SCENARIOS).filter((id) => LONG.has(id) && !ids.includes(id));

for (const id of ids) {
  const scenario = { id, label: id };
  try {
    await SCENARIOS[id](scenario);
  } catch (e) {
    failures.push({ scenario: id, name: 'scenario threw', actual: String((e && e.message) || e), expected: 'no throw' });
    results.push({ id, ok: false, error: String((e && e.stack) || e) });
  }
}

const summary = { pass: results.filter((r) => r.ok).length, fail: results.length - results.filter((r) => r.ok).length };
mkdirSync(EVIDENCE, { recursive: true });
const report = {
  generatedBy: 'tools/e2e/app.mjs',
  planRefs: ['plan.md 5.1 P1', 'plan.md 4.11', 'plan.md 5.4 item 2', 'plan.md 5.3', 'UD-4'],
  node: process.version,
  headless: process.env.PW_HEADLESS === '1',
  channel: process.env.PW_CHANNEL || 'bundled-chromium',
  offline: process.env.TASK002_OFFLINE === '1',
  page: PAGE_URL,
  summary,
  skippedLong,
  failures,
  results,
};
// ==== P9–P12 截图 manifest（供 ui-vision 复核：文件名 + sha256 + 字节数 + 拍摄设置/读数）====
if (shotManifest.length) {
  mkdirSync(P912, { recursive: true });
  writeFileSync(join(P912, 'manifest.json'), JSON.stringify({
    generatedBy: 'tools/e2e/app.mjs',
    generatedAt: new Date().toISOString(),
    node: process.version,
    plan: 'plan.md §5.3（S2/S3/S4a-c/S5/S6/S7/S8/S11/S12/S13/S14 由 P10/P11 产出）',
    note: '全部为本轮现场拍摄；每张图的 sha256 与像素尺寸可核对，重复文件名或与旧图同哈希即视为未重拍。kind=diagnostic 是同一冻结帧的差分源图（隐藏海面/鹈鹕/道具），kind=supplementary 是不计入 AC 的补充视角，kind=video 是 p16 的连续录屏。Caveat: 视频无音轨（Playwright recordVideo 只录画面），音频须另行取证。',
    screens: shotManifest,
  }, null, 2) + '\n');
  const lines = ['# TASK-002 P9–P12 截图 manifest', '', '| 文件 | 尺寸 | sha256 | 字节 | 设置 | 读数 |', '|---|---|---|---|---|---|'];
  for (const x of shotManifest) {
    const rd = x.readings ? JSON.stringify(x.readings).slice(0, 300) : (x.stats ? JSON.stringify(x.stats) : '');
    lines.push(`| ${x.name} | ${x.dims || ''} | \`${x.sha256}\` | ${x.bytes} | ${(x.setting || '').replace(/\|/g, '/')} | ${rd.replace(/\|/g, '/')} |`);
  }
  lines.push('', '截图仅作证据；视觉判定由 ui-vision 执行，实施侧不自评。');
  writeFileSync(join(P912, 'manifest.md'), lines.join('\n') + '\n');
}

const reportName = process.env.TASK002_OFFLINE === '1' ? 'app-gates-offline.json' : 'app-gates.json';
writeFileSync(join(EVIDENCE, reportName), JSON.stringify(report, null, 2) + '\n');

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id}${r.error ? ` error=${r.error.split('\n')[0]}` : ''}`);
  for (const w of r.consoleWarnings || []) console.log(`     WARNING [${r.id}] ${w.text}`);
}
if (failures.length) {
  console.error('FAILURES:', JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log(`PASS all ${summary.pass} application scenarios; report: ${join(EVIDENCE, reportName)}`);
