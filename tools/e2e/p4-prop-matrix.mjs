// TASK-002 P4 定向回归：跳跃积分（AC-6c / §4.5.2）与道具实例矩阵误差预算（§5.2 第 19 条 / ADR-21）。
// Build-time only (UD-4). 打开真实 index.html（file:// + ?debug=1），读数全部来自真实绘制路径：
//   - 道具 z 从 InstancedMesh.instanceMatrix.array 直读（即上传给 GPU 的 Float32 缓冲），
//     不与任何第二份镜像比较；源坐标由 §1.1 回收公式在同一 G.S 上重算（同一个 PB.world.propZ）。
//   - 判据（ADR-21 / AMD-P4-001）：
//       ① 双精度源层：非回绕帧 |Δz_src − ΔS| ≤ 1e-6
//       ② float32 层逐样本：z_inst === Math.fround(z_src)
//       ③ float32 层逐帧：|Δz_inst − ΔS| ≤ ½ulp32(z_src,k) + ½ulp32(z_src,k−1) + 1e-6
//       ④ 回绕帧当且仅当 floor((i·spacing − S)/span) 变化：|Δz_src − (ΔS − span)| ≤ 1e-6
//          且 z_src,k−1 + ΔS > 20；回绕以外违反 ③ 即判跳变
//   - 常数上界 2^-15 只作合理性检查（|z| < 480 ⇒ 单端 ½ulp ≤ 2^-16，两端 ≤ 2^-15），不是判据。
// Usage: node p4-prop-matrix.mjs        (headed)
//        PW_HEADLESS=1 node p4-prop-matrix.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const PAGE_URL = pathToFileURL(join(ROOT, 'index.html')).href;
const EVIDENCE = process.env.TASK002_EVIDENCE_P4 ||
  join(homedir(), '.evidence', 'task-002', 'implementation', 'P4-adjudication');
const LABEL = process.env.TASK002_P4_LABEL || 'run';
const OUT_DIR = join(EVIDENCE, LABEL);
const SCREEN_DIR = join(OUT_DIR, 'screens');

mkdirSync(SCREEN_DIR, { recursive: true });

const failures = [];
function check(name, actual, ok, detail) {
  if (!ok) failures.push({ name, actual, detail: detail || '' });
  return ok;
}

const browser = await chromium.launch({ headless: process.env.PW_HEADLESS === '1' });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const requests = [];
const messages = [];
page.on('request', (r) => requests.push(r.url()));
page.on('console', (m) => messages.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => messages.push({ type: 'pageerror', text: String(e && e.message) }));

await page.goto(`${PAGE_URL}?debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.PB && window.PB.main && window.PB.main.app.state === 'running', null, { timeout: 15000 });

// ---------- 1) 跳跃积分：真实 sim.step，确定性 ----------
const jump = await page.evaluate(() => {
  const H = window.PB.config.H;
  const SIM = window.PB.config.SIM;
  const G = window.PB.sim.createState(0x51, {});
  window.PB.rig.initState(G);
  const cmd = { throttle: false, brake: false, laneDelta: 0, jumpPress: true, wing: false };
  const idle = { throttle: false, brake: false, laneDelta: 0, jumpPress: false, wing: false };
  window.PB.sim.step(G, cmd, H);
  let apex = G.bike.y, steps = 1, vyMax = G.bike.vy, sawLand = false;
  let maxIdentityY = 0, maxIdentityVy = 0;
  for (let k = 1; k < 300 && G.bike.airborne; k++) {
    // 与解析解逐点比对：y(t)=v0 t − ½g t²，vy(t)=v0 − g t
    const t = k * H;
    maxIdentityY = Math.max(maxIdentityY, Math.abs(G.bike.y - (SIM.JUMP_V0 * t - 0.5 * SIM.GRAVITY * t * t)));
    maxIdentityVy = Math.max(maxIdentityVy, Math.abs(G.bike.vy - (SIM.JUMP_V0 - SIM.GRAVITY * t)));
    window.PB.sim.step(G, idle, H);
    steps++;
    if (G.bike.y > apex) apex = G.bike.y;
    if (G.bike.vy > vyMax) vyMax = G.bike.vy;
    if (!G.bike.airborne) sawLand = true;
  }
  return {
    H, v0: SIM.JUMP_V0, g: SIM.GRAVITY,
    apex, airSteps: steps, airtime: steps * H, sawLand, finalY: G.bike.y, vyMax,
    analyticApex: SIM.JUMP_V0 * SIM.JUMP_V0 / (2 * SIM.GRAVITY),
    analyticAirtime: 2 * SIM.JUMP_V0 / SIM.GRAVITY,
    maxIdentityY, maxIdentityVy,
  };
});

check('AC-6c apex in 0.893±0.03', jump.apex, jump.apex >= 0.863 && jump.apex <= 0.923, 'range=[0.863,0.923]');
check('AC-6c airtime in 0.714±0.03', jump.airtime, jump.airtime >= 0.684 && jump.airtime <= 0.744, 'range=[0.684,0.744]');
check('AC-6c lands with y=0', jump.finalY, jump.sawLand && jump.finalY === 0, 'y=' + jump.finalY);
check('§4.5.2 integrator identity on y (every step)', jump.maxIdentityY, jump.maxIdentityY <= 1e-14, 'maxErr=' + jump.maxIdentityY);
check('§4.5.2 integrator identity on vy (every step)', jump.maxIdentityVy, jump.maxIdentityVy <= 1e-14, 'maxErr=' + jump.maxIdentityVy);

// 诊断（非门禁）：把 §4.5.2 修订前的两种一阶序在同一常量下并列算一遍，供裁决复核。
const literalOrders = await page.evaluate(() => {
  const H = window.PB.config.H;
  const SIM = window.PB.config.SIM;
  const v0 = SIM.JUMP_V0;
  const g = SIM.GRAVITY;
  function run(order) {
    let y = 0, vy = v0, apex = 0, steps = 0;
    for (let k = 1; k < 400; k++) {
      if (order === 'vy_first') { vy -= g * H; y += vy * H; }
      else if (order === 'pos_first') { y += vy * H; vy -= g * H; }
      else { y += vy * H - 0.5 * g * H * H; vy -= g * H; }
      steps = k;
      if (y > apex) apex = y;
      if (y <= 0) break;
    }
    return { order, apex, airtime: steps * H, steps };
  }
  return ['vy_first', 'pos_first', 'exact'].map(run).concat([{
    order: 'analytic', apex: v0 * v0 / (2 * g), airtime: 2 * v0 / g, steps: null,
  }]);
});
const acLo = 0.863, acHi = 0.923, airLo = 0.684, airHi = 0.744;
for (const r of literalOrders) {
  r.apexInAC = r.apex >= acLo && r.apex <= acHi;
  r.airtimeInAC = r.airtime >= airLo && r.airtime <= airHi;
}

// ---------- 2) 道具：源坐标（§1.1 公式）vs 实例矩阵（真实绘制缓冲） ----------
const prop = await page.evaluate(() => new Promise((resolve) => {
  const W = window.PB.config.WORLD;
  const N = W.PALM_COUNT;
  const SP = W.PALM_SPACING;
  const SPAN = N * SP;
  const AHEAD = W.PROP_AHEAD;

  // ulp32(x) = 2^(floor(log2|x|) − 23)，x=0 取 2^-149（按 binary32 指数域直接取）
  const fbuf = new Float32Array(1);
  const ubuf = new Uint32Array(fbuf.buffer);
  function ulp32(x) {
    const a = Math.abs(x);
    if (a === 0) return Math.pow(2, -149);
    fbuf[0] = a;
    const e = (ubuf[0] >>> 23) & 0xff;
    if (e === 0) return Math.pow(2, -149);
    if (e === 0xff) return NaN;
    return Math.pow(2, e - 127 - 23);
  }
  const bucket = (i, S) => Math.floor((i * SP - S) / SPAN);

  const starts = [
    { id: 'S~1e4', S0: 9999.0, target: 10000 },
    { id: 'S~1e6', S0: 999990.0, target: 1000000 },
    { id: 'S~1e7', S0: 9999990.0, target: 10000000 },
  ];
  const runs = [];
  let ri = 0;

  function runOne() {
    const cfg = starts[ri];
    window.PB.debug.setSpeed(16);
    window.PB.debug.setS(cfg.S0);
    let prevInst = null, prevSrc = null, prevBucket = null, prevS = null;
    let frames = 0, samples = 0, wraps = 0;
    let maxSrcErr = 0, maxRoundErr = 0, maxRoundCount = 0;
    let maxDeltaErr = 0, maxDeltaRatio = 0, maxWrapErr = 0;
    let worst = null;
    const bad = [];

    function tick() {
      const S = window.PB.main.state().S;
      const src = [], inst = [], bkt = [];
      for (let i = 0; i < N; i++) {
        src.push(window.PB.world.propZ(i, SP, SPAN, S));
        inst.push(window.PB.world.palmZAt(i));
        bkt.push(bucket(i, S));
      }
      // ② 逐样本：实例矩阵必须逐位等于源坐标的最近 float32
      for (let i = 0; i < N; i++) {
        const rounded = Math.fround(src[i]);
        if (inst[i] !== rounded) {
          bad.push({ i, kind: 'round', inst: inst[i], src: src[i], rounded });
          maxRoundCount++;
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
            // ④ 回绕帧：位移等于 ΔS − span，且回绕点确在镜头后方 +20 m
            const e = Math.abs((src[i] - prevSrc[i]) - (dS - SPAN));
            if (e > maxWrapErr) maxWrapErr = e;
            if (e > 1e-6) bad.push({ i, kind: 'wrap-delta', e, dS });
            if (!(prevSrc[i] + dS > AHEAD)) bad.push({ i, kind: 'wrap-point', prev: prevSrc[i], dS });
            continue;
          }
          samples++;
          // ① 双精度源层
          const se = Math.abs((src[i] - prevSrc[i]) - dS);
          if (se > maxSrcErr) maxSrcErr = se;
          if (se > 1e-6) bad.push({ i, kind: 'src-delta', se, dS });
          // ③ float32 逐帧上界：逐端点 ½ulp32 + 1e-6
          const bound = 0.5 * ulp32(src[i]) + 0.5 * ulp32(prevSrc[i]) + 1e-6;
          const err = Math.abs((inst[i] - prevInst[i]) - dS);
          if (err > maxDeltaErr) maxDeltaErr = err;
          const ratio = err / bound;
          if (ratio > maxDeltaRatio) maxDeltaRatio = ratio;
          if (ratio > 1) bad.push({ i, kind: 'delta', err, bound, dS, dz: inst[i] - prevInst[i] });
          if (!worst || ratio > worst.ratio) {
            worst = { i, S, inst: inst[i], prevInst: prevInst[i], dz: inst[i] - prevInst[i], dS, err, bound, ratio };
          }
        }
      }
      prevInst = inst; prevSrc = src; prevBucket = bkt; prevS = S;
      if (++frames < 150) requestAnimationFrame(tick);
      else {
        runs.push({
          id: cfg.id, n: N, startS: cfg.S0, endS: S, target: cfg.target, frames, samples, wraps,
          maxSrcErr, maxRoundErr, maxRoundCount, maxDeltaErr, maxDeltaRatio, maxWrapErr,
          worst, badCount: bad.length, bad: bad.slice(0, 5),
        });
        if (++ri < starts.length) requestAnimationFrame(runOne); else resolve(runs);
      }
    }
    requestAnimationFrame(tick);
  }
  runOne();
}));

// 常数合理性上界（非判据）：|z| < 480 ⇒ 单端 ½ulp ≤ 2^-16，两端 ≤ 2^-15
const SANITY_BOUND = Math.pow(2, -15);

for (const r of prop) {
  check(`${r.id} samples > 100`, r.samples, r.samples > 100, 'samples=' + r.samples);
  check(`${r.id} crossed target S`, r.endS, r.endS > r.target, `endS=${r.endS} target=${r.target}`);
  // 150 帧、约 37 m 行程、span=500 m ⇒ 窗口内只有 0..2 个实例会跨越 +20 的回绕点；
  // 这里只要求回绕支路被真实走到（≥1 次），且每次回绕都满足 ④（见下一条）。
  check(`${r.id} wrap branch exercised (>=1 wrap in the window)`, r.wraps, r.wraps >= 1, 'wraps=' + r.wraps);
  check(`${r.id} ① source dz = ΔS (±1e-6)`, r.maxSrcErr, r.maxSrcErr <= 1e-6, 'max=' + r.maxSrcErr);
  check(`${r.id} ② instance === Math.fround(source)`, r.maxRoundCount, r.maxRoundCount === 0, 'violations=' + r.maxRoundCount);
  check(`${r.id} ③ |Δz_inst − ΔS| ≤ ½ulp+½ulp+1e-6`, r.maxDeltaRatio, r.maxDeltaRatio <= 1, 'maxRatio=' + r.maxDeltaRatio);
  check(`${r.id} ④ wrap delta = ΔS − span (±1e-6)`, r.maxWrapErr, r.maxWrapErr <= 1e-6, 'max=' + r.maxWrapErr);
  check(`${r.id} no violated sample`, r.badCount, r.badCount === 0, JSON.stringify(r.bad));
  check(`${r.id} sanity: max|Δz_inst − ΔS| < 2^-15`, r.maxDeltaErr, r.maxDeltaErr < SANITY_BOUND, 'max=' + r.maxDeltaErr);
  // 诊断：字面 1e-6 套到矩阵上会怎样（记录，不作为门禁）
  r.literal1e6OnMatrix = r.maxDeltaErr <= 1e-6;
}

// ---------- 3) 真实键盘跳跃（旁证，含 rAF 采样误差） ----------
const livePromise = page.evaluate(() => new Promise((resolve) => {
  const G = window.PB.main.state();
  G.bike.y = 0; G.bike.vy = 0; G.bike.airborne = false; G.bike.jumpBufT = 0;
  const samples = [];
  let t0 = null;
  function tick(ts) {
    samples.push(G.bike.y);
    if (t0 === null) t0 = ts;
    if (ts - t0 < 1500) requestAnimationFrame(tick);
    else resolve({ samples: samples.length, maxY: Math.max.apply(null, samples) });
  }
  requestAnimationFrame(tick);
}));
await page.keyboard.down('Space');
await page.waitForTimeout(40);
await page.keyboard.up('Space');
const live = await livePromise;

// ---------- 4) 绘制路径真实存在 ----------
const render = await page.evaluate(() => {
  const s = window.PB.debug.stats();
  const r = window.PB.scene.renderer();
  const info = r ? r.info.render : null;
  return { stats: s, calls: info ? info.calls : null, triangles: info ? info.triangles : null };
});

const nonFile = requests.filter((u) => !u.startsWith('file://'));
const errors = messages.filter((m) => m.type === 'error' || m.type === 'pageerror');
check('non-file requests', nonFile, nonFile.length === 0, JSON.stringify(nonFile));
check('console errors + pageerror', errors, errors.length === 0, JSON.stringify(errors));

await page.screenshot({ path: join(SCREEN_DIR, 'p4-prop-matrix.png') });
await context.close();
await browser.close();

const report = {
  generatedBy: 'tools/e2e/p4-prop-matrix.mjs',
  label: LABEL,
  planRefs: ['AC-6c', 'plan.md 4.5.2', 'plan.md 5.2 item 19', 'plan.md 1.1', 'ADR-21', 'AMD-P4-001'],
  jump,
  literalOrders,
  prop,
  sanityBound: SANITY_BOUND,
  liveJump: live,
  render,
  consoleWarnings: messages.filter((m) => m.type === 'warning'),
  consoleErrors: errors,
  nonFileRequests: nonFile,
  failures,
  pass: failures.length === 0,
};
writeFileSync(join(OUT_DIR, 'p4-prop-matrix.json'), JSON.stringify(report, null, 2) + '\n');

console.log(JSON.stringify({
  label: LABEL,
  pass: report.pass,
  jump: {
    apex: jump.apex, airtime: jump.airtime, analyticApex: jump.analyticApex,
    analyticAirtime: jump.analyticAirtime, airSteps: jump.airSteps,
    maxIdentityY: jump.maxIdentityY, maxIdentityVy: jump.maxIdentityVy,
  },
  prop: prop.map((r) => ({
    id: r.id, samples: r.samples, wraps: r.wraps, maxSrcErr: r.maxSrcErr,
    maxRoundCount: r.maxRoundCount, maxDeltaErr: r.maxDeltaErr, maxDeltaRatio: r.maxDeltaRatio,
    maxWrapErr: r.maxWrapErr, literal1e6OnMatrix: r.literal1e6OnMatrix,
  })),
  render: { calls: render.calls, triangles: render.triangles, glVersion: render.stats && render.stats.glVersion },
  failures,
}, null, 2));
if (failures.length) process.exit(1);
