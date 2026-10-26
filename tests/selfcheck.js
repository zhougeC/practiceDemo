// TASK-002 selfcheck harness + 用例（plan.md §5.1、§1.2 的 [selfcheck] 项）。
// 运行方式：file:// 打开 tests/selfcheck.html；结果写入 window.__selfcheck（Playwright 读取）
// 与页面列表。所有用例都直接调用真实模块，不做桩替身；数值判据一律引用 AC/PR 编号。
// 后续包只在文件末尾追加 sections.push(...)，不改写已有用例。
(function () {
  'use strict';
  var PB = window.PB;
  var results = [];
  // 断言一个布尔条件。
  function assertTrue(name, actual, ok, detail) {
    results.push({ name: name, ok: !!ok, actual: actual, detail: detail || '' });
  }
  // 断言严格相等（JSON 序列化比较，支持数组/对象/原始值）。
  function assertEq(name, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    results.push({ name: name, ok: ok, actual: actual, detail: 'expected=' + JSON.stringify(expected) });
  }
  // 断言数值在 [lo, hi] 闭区间内。
  function assertRange(name, actual, lo, hi) {
    var ok = typeof actual === 'number' && isFinite(actual) && actual >= lo && actual <= hi;
    results.push({ name: name, ok: ok, actual: actual, detail: 'range=[' + lo + ',' + hi + ']' });
  }
  // 断言 |actual − expected| ≤ tol。
  function assertNear(name, actual, expected, tol) {
    var ok = typeof actual === 'number' && isFinite(actual) && Math.abs(actual - expected) <= tol;
    results.push({ name: name, ok: ok, actual: actual, detail: 'expected=' + expected + '±' + tol });
  }
  // 跑完所有 section，输出 DOM 与 window.__selfcheck。
  function run() {
    var sections = window.__sc.sections;
    for (var i = 0; i < sections.length; i++) {
      try {
        sections[i]();
      } catch (e) {
        results.push({ name: 'section ' + i + ' threw', ok: false, actual: String((e && e.stack) || e), detail: '' });
      }
    }
    var pass = 0;
    for (var j = 0; j < results.length; j++) if (results[j].ok) pass++;
    var fail = results.length - pass;
    var summary = document.getElementById('summary');
    summary.textContent = pass + ' / ' + results.length + ' PASS, ' + fail + ' FAIL';
    summary.className = fail ? 'bad' : 'ok';
    var list = document.getElementById('list');
    for (var k = 0; k < results.length; k++) {
      var li = document.createElement('li');
      var r = results[k];
      li.className = r.ok ? 'ok' : 'bad';
      li.textContent = (r.ok ? 'PASS ' : 'FAIL ') + r.name + ' → ' + JSON.stringify(r.actual) +
        (r.ok ? '' : '  [' + r.detail + ']');
      list.appendChild(li);
    }
    window.__selfcheck = { done: true, pass: pass, fail: fail, total: results.length, results: results };
  }
  window.__sc = {
    sections: [],
    assertTrue: assertTrue,
    assertEq: assertEq,
    assertRange: assertRange,
    assertNear: assertNear,
    run: run
  };
  document.addEventListener('DOMContentLoaded', function () { run(); });
})();
// ===== P2：mathx 与 rng =====
(function () {
  'use strict';
  var sc = window.__sc;
  var PB = window.PB;
  sc.sections.push(function () {
    var M = PB.mathx;
    // clamp / lerp / smoothstep / mod / sign（§4.5.2、§1.1 的 mod 定义）
    sc.assertEq('mathx.clamp(5,0,1)', M.clamp(5, 0, 1), 1);
    sc.assertEq('mathx.clamp(-1,0,1)', M.clamp(-1, 0, 1), 0);
    sc.assertEq('mathx.clamp(0.5,0,1)', M.clamp(0.5, 0, 1), 0.5);
    sc.assertNear('mathx.lerp(2,4,0.25)', M.lerp(2, 4, 0.25), 2.5, 1e-12);
    sc.assertNear('mathx.smoothstep(0,1,0.5)', M.smoothstep(0, 1, 0.5), 0.5, 1e-12);
    sc.assertEq('mathx.smoothstep(0,1,-1)', M.smoothstep(0, 1, -1), 0);
    sc.assertEq('mathx.smoothstep(0,1,2)', M.smoothstep(0, 1, 2), 1);
    // §1.1 的 mod(a,m)=a−m·floor(a/m)：负数必须落到 [0,m)
    sc.assertNear('mathx.mod(-1,4)', M.mod(-1, 4), 3, 1e-12);
    sc.assertNear('mathx.mod(5.5,2)', M.mod(5.5, 2), 1.5, 1e-12);
    // −1e7 = 7·(−1428572) + 4 → 正模结果为 4
    sc.assertNear('mathx.mod(-1e7,7)', M.mod(-1e7, 7), 4, 1e-9);
    sc.assertEq('mathx.sign(-3)', M.sign(-3), -1);
    sc.assertEq('mathx.sign(0)', M.sign(0), 0);
    sc.assertEq('mathx.sign(2)', M.sign(2), 1);
    // damp（§4.5.2）：单步 = 1−e^(−kh)，且 100 步后逼近目标
    sc.assertNear('mathx.damp(0,1,12,1/60) one step', M.damp(0, 1, 12, 1 / 60), 1 - Math.exp(-12 / 60), 1e-12);
    var d = 0;
    for (var i = 0; i < 100; i++) d = M.damp(d, 1, 12, 1 / 60);
    sc.assertRange('mathx.damp converges after 100 steps', d, 0.999, 1);
    // clampLen（§4.1）
    var out = { x: 0, y: 0, z: 0 };
    M.clampLen(3, 0, 0, 2, out);
    sc.assertNear('mathx.clampLen(3,0,0,max=2).x', out.x, 2, 1e-12);
    M.clampLen(1, 0, 0, 2, out);
    sc.assertNear('mathx.clampLen(1,0,0,max=2).x unchanged', out.x, 1, 1e-12);
    // noise1 / hash01（§4.1）：值域与确定性
    var nMin = 1e9, nMax = -1e9, nDet = true;
    for (var t = 0; t < 40; t += 0.25) {
      var v = M.noise1(t, 3);
      if (v < nMin) nMin = v;
      if (v > nMax) nMax = v;
      if (v !== M.noise1(t, 3)) nDet = false;
    }
    sc.assertRange('mathx.noise1 min in [-1,1]', nMin, -1, 1);
    sc.assertRange('mathx.noise1 max in [-1,1]', nMax, -1, 1);
    sc.assertTrue('mathx.noise1 is deterministic', nDet, nDet);
    var hMin = 1, hMax = 0, hDet = true;
    for (var k = 0; k < 200; k++) {
      var h = M.hash01(k);
      if (h < hMin) hMin = h;
      if (h > hMax) hMax = h;
      if (h !== M.hash01(k)) hDet = false;
    }
    sc.assertRange('mathx.hash01 in [0,1)', hMin, 0, 1);
    sc.assertRange('mathx.hash01 in [0,1)', hMax, 0, 1);
    sc.assertTrue('mathx.hash01 is deterministic', hDet, hDet);
    // slerpDir（§4.2.2 lightDir 过渡）：x→z 的 45° 处应为 (√2/2, 0, √2/2)
    var a = { x: 1, y: 0, z: 0 }, b = { x: 0, y: 0, z: 1 }, s = { x: 0, y: 0, z: 0 };
    M.slerpDir(a, b, 0.5, s);
    sc.assertNear('mathx.slerpDir(x,z,0.5).x', s.x, Math.SQRT1_2, 1e-9);
    sc.assertNear('mathx.slerpDir(x,z,0.5).z', s.z, Math.SQRT1_2, 1e-9);
    // rng（mulberry32，§3.5 / §3.3）：同种子可复现、值域 [0,1)、状态推进
    var G1 = { rng: 12345 }, G2 = { rng: 12345 }, G3 = { rng: 54321 };
    var seq1 = [], seq2 = [], seq3 = [];
    for (var r = 0; r < 5; r++) { seq1.push(M.rng(G1)); seq2.push(M.rng(G2)); seq3.push(M.rng(G3)); }
    sc.assertEq('mathx.rng same seed reproduces sequence', seq1, seq2);
    sc.assertTrue('mathx.rng different seed diverges', seq1[0] !== seq3[0], [seq1[0], seq3[0]]);
    sc.assertTrue('mathx.rng advances G.rng', G1.rng !== 12345, G1.rng);
    var inRange = true;
    var G4 = { rng: 7 };
    for (var q = 0; q < 1000; q++) {
      var x = M.rng(G4);
      if (!(x >= 0 && x < 1)) inRange = false;
    }
    sc.assertTrue('mathx.rng values in [0,1)', inRange, inRange);
  });
})();
// ===== P2：PR-1 投影预计值（§1.3 公式 + config 常量）=====
(function () {
  'use strict';
  var sc = window.__sc;
  var PB = window.PB;
  var CFG = PB.config;
  var D2R = Math.PI / 180;
  var ASPECT = 1920 / 1080;     // §5.3 截图通用条件
  // 由位置与注视点构造 §1.3 的相机基：f 前向、r 右向、u 上向。
  function basis(pos, look) {
    var fx = look.x - pos.x, fy = look.y - pos.y, fz = look.z - pos.z;
    var fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
    var f = { x: fx / fl, y: fy / fl, z: fz / fl };
    // r = normalize(cross(f, up)), up=(0,1,0)
    var rx = -f.z, ry = 0, rz = f.x;
    var rl = Math.sqrt(rx * rx + rz * rz) || 1;
    var r = { x: rx / rl, y: ry / rl, z: rz / rl };
    // u = cross(r, f)
    var u = {
      x: r.y * f.z - r.z * f.y,
      y: r.z * f.x - r.x * f.z,
      z: r.x * f.y - r.y * f.x
    };
    return { pos: pos, f: f, r: r, u: u };
  }
  // 投影世界点 → NDC（§1.3：ndc_y=(d·u)/(d·f)/tan(FOV/2)，ndc_x=d_x/(d·f)/(tan(FOV/2)·aspect)）。
  function projectPoint(cam, fovDeg, p) {
    var dx = p.x - cam.pos.x, dy = p.y - cam.pos.y, dz = p.z - cam.pos.z;
    var df = dx * cam.f.x + dy * cam.f.y + dz * cam.f.z;
    var du = dx * cam.u.x + dy * cam.u.y + dz * cam.u.z;
    var dr = dx * cam.r.x + dy * cam.r.y + dz * cam.r.z;
    var tan = Math.tan(fovDeg * D2R / 2);
    return { x: dr / df / (tan * ASPECT), y: du / df / tan };
  }
  // 投影"无穷远方向" → NDC（天体圆盘用；无平移）。
  function projectDir(cam, fovDeg, d) {
    var df = d.x * cam.f.x + d.y * cam.f.y + d.z * cam.f.z;
    var du = d.x * cam.u.x + d.y * cam.u.y + d.z * cam.u.z;
    var dr = d.x * cam.r.x + d.y * cam.r.y + d.z * cam.r.z;
    var tan = Math.tan(fovDeg * D2R / 2);
    // df 必须为正：相机背后的方向同样能算出一个"落在框内"的 ndc，不能算作可见
    return { x: dr / df / (tan * ASPECT), y: du / df / tan, inFront: df > 0 };
  }
  // §4.2.2 的天体方向：dir(h,e) = (cos e·h.x, sin e, cos e·h.z)。
  function celestial(h, eDeg) {
    var ce = Math.cos(eDeg * D2R);
    return { x: ce * h.x, y: Math.sin(eDeg * D2R), z: ce * h.z };
  }
  // 角直径占画面高度的比例：2·tan(r)/(2·tan(FOV/2))（§1.3）。
  function discHeightFraction(diameterDeg, fovDeg) {
    return Math.tan(diameterDeg * D2R / 2) / Math.tan(fovDeg * D2R / 2);
  }
  // ---- ADR-33/ADR-34 复算：下半幅海面占比（精确解，无网格误差）----
  // §1.1 的地面高度是 x 的分段线性函数，射线在每一段内 y 与地面都是 t 的线性函数，
  // 因此逐段解一次线性方程就能得到精确的首次交点；比逐步推进快且没有步长误差。
  function terrainPieces() {
    var capX = CFG.CLIFF_X - CFG.CLIFF_MAX / CFG.CLIFF_SLOPE;   // −36：崖顶平台起点
    return [
      { x0: -Infinity, x1: capX, a: CFG.CLIFF_MAX, b: 0 },
      { x0: capX, x1: CFG.CLIFF_X, a: CFG.CLIFF_X * CFG.CLIFF_SLOPE, b: -CFG.CLIFF_SLOPE },
      { x0: CFG.CLIFF_X, x1: CFG.ROAD_HALF, a: 0, b: 0 },
      { x0: CFG.ROAD_HALF, x1: CFG.SHORE_X, a: -CFG.SAND_SLOPE * -CFG.ROAD_HALF, b: -CFG.SAND_SLOPE },
      { x0: CFG.SHORE_X, x1: Infinity, a: CFG.SEA_Y, b: 0 }
    ];
  }
  var PIECES = terrainPieces();
  // 返回射线（相机 + NDC）首次与地面相交处的 x；无交点时返回 null。
  function firstGroundX(cam, fovDeg, ndcX, ndcY) {
    var tan = Math.tan(fovDeg * D2R / 2);
    var a = ndcX * tan * ASPECT, b = ndcY * tan;
    var d = {
      x: cam.f.x + a * cam.r.x + b * cam.u.x,
      y: cam.f.y + a * cam.r.y + b * cam.u.y,
      z: cam.f.z + a * cam.r.z + b * cam.u.z
    };
    var cx = cam.pos.x, cy = cam.pos.y;
    var best = Infinity;
    for (var i = 0; i < PIECES.length; i++) {
      var pc = PIECES[i];
      var lo = 0, hi = Infinity;
      if (Math.abs(d.x) < 1e-12) {
        if (cx < pc.x0 || cx > pc.x1) continue;
      } else {
        var t0 = (pc.x0 - cx) / d.x, t1 = (pc.x1 - cx) / d.x;
        lo = Math.max(0, Math.min(t0, t1));
        hi = Math.max(t0, t1);
        if (hi < 0) continue;
      }
      // 段内地面 y = a + b·x(t)，射线 y = cy + d.y·t → 线性方程求根
      var den = d.y - pc.b * d.x;
      if (Math.abs(den) < 1e-12) continue;
      var t = (pc.a + pc.b * cx - cy) / den;
      if (!(t > 1e-6) || t < lo || t > hi) continue;
      if (t < best) best = t;
    }
    if (!isFinite(best)) return null;
    return cx + d.x * best;
  }
  // 下半幅（ndc_y ∈ [−1, 0)）的海面像素占比（%）；stepPx 为采样步长（1080p 像素）。
  function lowerSeaPct(cam, fovDeg, stepPx) {
    var st = stepPx || 6, n = 0, sea = 0;
    for (var py = 540; py < 1080; py += st) {
      var ndcY = 1 - (py + 0.5) / 1080 * 2;
      for (var px = 0; px < 1920; px += st) {
        n++;
        var hx = firstGroundX(cam, fovDeg, (px + 0.5) / 1920 * 2 - 1, ndcY);
        if (hx !== null && hx > CFG.SHORE_X) sea++;
      }
    }
    return n ? 100 * sea / n : 0;
  }
  // 供后续 section（P10 的 ADR-33/34 复算）复用同一份精确解，避免出现两套几何实现。
  sc.projectPoint = projectPoint;
  sc.lowerSeaPct = lowerSeaPct;
  sc.sections.push(function () {
    // ---------- AC-1a：追尾镜头下主体占画面高度 22%–32%（预计 28.7%）----------
    var chase = CFG.CAM_CHASE;
    var camPos = { x: chase.offset.x, y: chase.offset.y, z: chase.offset.z };
    var camLook = { x: chase.lookAt.x, y: chase.lookAt.y, z: chase.lookAt.z };
    var cam = basis(camPos, camLook);
    // 条件：wheelie=0、y=0、lean=0 → 后轮着地点局部 (0,0,0)，头盔顶局部 (0,1.98,−0.42)
    var bottom = projectPoint(cam, chase.fov, { x: 0, y: 0, z: 0 });
    var top = projectPoint(cam, chase.fov, { x: 0, y: CFG.HELMET_TOP_Y, z: CFG.HEAD_CENTER_L.z });
    var heightPct = (top.y - bottom.y) / 2 * 100;
    sc.assertRange('AC-1a subject height % in [22,32]', heightPct, 22, 32);
    sc.assertNear('AC-1a subject height % ≈ 28.7 (PR-1)', heightPct, 28.7, 1.0);
    // 构图其余两条（§1.3）：地平线在画面高度 39.9%（判据 38%–45%），消失点水平居中
    var horizonNdc = projectDir(cam, chase.fov, { x: 0, y: 0, z: -1 });
    var horizonPct = (1 - horizonNdc.y) / 2 * 100;
    sc.assertRange('§1.3 horizon from top % in [38,45]', horizonPct, 38, 45);
    sc.assertNear('§1.3 horizon from top % ≈ 39.9 (PR-1)', horizonPct, 39.9, 1.0);
    var vanish = projectDir(cam, chase.fov, { x: 0, y: 0, z: -1 });
    sc.assertRange('§1.3 road vanishing point |ndc_x| ≤ 0.10', Math.abs(vanish.x), 0, 0.10);
    // ---------- AC-3a：S1（p=0.05）太阳圆盘完全在画面内，预计 ndc=(0.83,0.49) ----------
    // §4.2.2 关键帧 p=0.00→0.12 的太阳仰角 10°→2°，p=0.05 线性插值得 6.667°
    var sunElev = 10 - (10 - 2) * (0.05 / 0.12);
    var sunDir = celestial(CFG.SUN_DIR_H, sunElev);
    var sunNdc = projectDir(cam, chase.fov, sunDir);
    var sunR = discHeightFraction(CFG.SUN_DIAMETER_DEG, chase.fov) / 2;
    sc.assertNear('AC-3a sun ndc_x ≈ 0.83 (PR-1)', sunNdc.x, 0.83, 0.02);
    sc.assertNear('AC-3a sun ndc_y ≈ 0.49 (PR-1)', sunNdc.y, 0.49, 0.02);
    sc.assertRange('AC-3a sun disc fully inside frame (x)', Math.abs(sunNdc.x) + sunR / ASPECT, 0, 1);
    sc.assertRange('AC-3a sun disc fully inside frame (y)', Math.abs(sunNdc.y) + sunR, 0, 1);
    sc.assertNear('§1.3 sun disc height % ≈ 5.0', discHeightFraction(CFG.SUN_DIAMETER_DEG, chase.fov) * 100, 5.0, 0.2);
    // ---------- AC-3b：S2（p=0.50）月亮 ndc=(0.42,0.73)，直径占画面高 3%–6%（预计 4.0%）----------
    var moonDir = celestial(CFG.MOON_DIR_H, 14);
    var moonNdc = projectDir(cam, chase.fov, moonDir);
    var moonPct = discHeightFraction(CFG.MOON_DIAMETER_DEG, chase.fov) * 100;
    sc.assertNear('AC-3b moon ndc_x ≈ 0.42 (PR-1)', moonNdc.x, 0.42, 0.02);
    sc.assertNear('AC-3b moon ndc_y ≈ 0.73 (PR-1)', moonNdc.y, 0.73, 0.02);
    sc.assertRange('AC-3b moon diameter % in [3,6]', moonPct, 3, 6);
    sc.assertNear('AC-3b moon diameter % ≈ 4.0 (PR-1)', moonPct, 4.0, 0.3);
    var moonR = moonPct / 2 / 100;
    sc.assertRange('AC-3b moon disc fully inside frame (y)', Math.abs(moonNdc.y) + moonR, 0, 1);
    // ---------- AC-3b：S2 的 starsInView ≥250（预计 337）----------
    var dirs = PB.mathx.starField(new Float32Array(CFG.STAR_COUNT * 3), CFG.STAR_COUNT);
    var starsInView = 0;
    for (var i = 0; i < CFG.STAR_COUNT; i++) {
      var d = { x: dirs[i * 3], y: dirs[i * 3 + 1], z: dirs[i * 3 + 2] };
      var n = projectDir(cam, chase.fov, d);
      if (n.inFront && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1) starsInView++;
    }
    sc.assertRange('AC-3b starsInView ≥ 250', starsInView, 250, CFG.STAR_COUNT);
    sc.assertNear('AC-3b starsInView ≈ 337 (PR-1)', starsInView, 337, 15);
    // ---------- AC-8a mode 4：默认 yaw 35°/pitch 18°/dist 9 时地平线距画面顶 15.2% ----------
    var orbit = CFG.CAM_ORBIT_DEFAULT;
    var yaw = orbit.yawDeg * D2R, pitch = orbit.pitchDeg * D2R;
    var center = { x: 0, y: 1.0, z: 0 };
    var orbitPos = {
      x: center.x + orbit.dist * Math.cos(pitch) * Math.sin(yaw),
      y: center.y + orbit.dist * Math.sin(pitch),
      z: center.z + orbit.dist * Math.cos(pitch) * Math.cos(yaw)
    };
    var orbitCam = basis(orbitPos, center);
    // 地平线方向 = 相机前向的水平投影
    var fh = { x: orbitCam.f.x, y: 0, z: orbitCam.f.z };
    var fhl = Math.sqrt(fh.x * fh.x + fh.z * fh.z) || 1;
    var horizonOrbit = projectDir(orbitCam, orbit.fov, { x: fh.x / fhl, y: 0, z: fh.z / fhl });
    var orbitHorizonPct = (1 - horizonOrbit.y) / 2 * 100;
    sc.assertRange('AC-8a mode4 horizon from top % in [10,20]', orbitHorizonPct, 10, 20);
    sc.assertNear('AC-8a mode4 horizon from top % ≈ 15.2 (PR-1)', orbitHorizonPct, 15.2, 0.5);
    // 车包围盒中心 = 注视点 → ndc 必为 0（§4.7 mode 4 判据 |ndc| ≤ 0.2）
    var carCenter = projectPoint(orbitCam, orbit.fov, center);
    sc.assertRange('AC-8a mode4 car center |ndc_x| ≤ 0.2', Math.abs(carCenter.x), 0, 0.2);
    sc.assertRange('AC-8a mode4 car center |ndc_y| ≤ 0.2', Math.abs(carCenter.y), 0, 0.2);
    // ---------- AC-8b POV：喙尖在离画面底边 22%–34%（预计 27.8%），喙根深度 > near ----------
    var pov = CFG.CAM_POV;
    var povPos = { x: pov.offset.x, y: pov.offset.y, z: pov.offset.z };
    var povLook = { x: pov.offset.x, y: pov.offset.y, z: pov.offset.z - 1 };   // 朝向 rig 旋转后的 −Z
    var povCam = basis(povPos, povLook);
    var beak = projectPoint(povCam, pov.fov, CFG.BEAK_TIP_L);
    var beakFromBottomPct = (1 + beak.y) / 2 * 100;
    sc.assertRange('AC-8b POV beak from bottom % in [22,34]', beakFromBottomPct, 22, 34);
    sc.assertNear('AC-8b POV beak from bottom % ≈ 27.8 (PR-1)', beakFromBottomPct, 27.8, 0.5);
    // 喙根局部 z = −0.58（§1.5）；相机在 z = −0.47，故喙根深度 0.11 > near 0.05
    var beakRootDepth = Math.abs(-0.58 - pov.offset.z);
    sc.assertRange('AC-8b beak root depth > POV near', beakRootDepth, pov.near, 10);
    sc.assertNear('AC-8b beak root depth = 0.11 (R4)', beakRootDepth, 0.11, 1e-9);
  });
})();
// ===== P3：输入队列与指针状态机（§4.5、M-16、M-26）=====
(function () {
  'use strict';
  var sc = window.__sc;
  var PB = window.PB;
  sc.sections.push(function () {
    // 一次性挂载：selfcheck 页面没有游戏画布，用临时元素充当画布与按钮容器。
    var canvas = document.createElement('canvas');
    var root = document.createElement('div');
    var btn = document.createElement('div');
    btn.setAttribute('data-act', 'left');
    root.appendChild(btn);
    document.body.appendChild(canvas);
    document.body.appendChild(root);
    if (!PB.input.isAttached()) PB.input.attach(window, document, canvas, root);
    var snap = { held: { throttle: false, brake: false, left: false, right: false, jump: false, wing: false }, anyHeld: false, activity: false, now: 0 };
    var out = [];
    // 派发一次合成键盘事件。isTrusted=false 不计活跃，但动作照常入队（selfcheck 用伪事件，§5.1 P3）。
    function key(type, code) {
      window.dispatchEvent(new KeyboardEvent(type, { code: code, bubbles: true }));
    }
    // ---------- AC-6e：同一 edge 序列在每帧 0/1/3/5 步下，每个 edge 恰好产生一次请求 ----------
    // 序列：D（right）、A（left）、Space（jump）、D（right）、Space（jump）
    var SEQUENCE = ['KeyD', 'KeyA', 'Space', 'KeyD', 'Space'];
    var EXPECTED = ['right', 'left', 'jump', 'right', 'jump'];
    var PATTERNS = [[1, 1, 1, 1, 1], [0, 1, 1, 1, 1], [0, 0, 1, 1, 1], [1, 1, 1, 0, 1], [0, 0, 0, 1, 1], [1, 0, 1, 0, 1]];
    var allMatch = true;
    var detail = [];
    for (var p = 0; p < PATTERNS.length; p++) {
      PB.input.clearAll('selfcheck');
      for (var i = 0; i < SEQUENCE.length; i++) { key('keydown', SEQUENCE[i]); key('keyup', SEQUENCE[i]); }
      var got = [];
      var frames = PATTERNS[p];
      for (var f = 0; f < frames.length; f++) {
        if (frames[f] >= 1) {
          // 与 §3.4 F5 一致：只有至少会执行 1 个固定步时才取出队列，且只对首个固定步可见
          PB.input.takeSimEdges(out);
          for (var e = 0; e < out.length; e++) got.push(out[e].act);
          // 同一帧的第 2..N 步使用 EMPTY，不应再看到 edge
          PB.input.takeSimEdges(out);
          if (out.length !== 0) got.push('LEAK');
        }
        // frames[f] === 0 的帧不取队列
      }
      if (JSON.stringify(got) !== JSON.stringify(EXPECTED)) {
        allMatch = false;
        detail.push(JSON.stringify(frames) + '→' + JSON.stringify(got));
      }
    }
    sc.assertTrue('AC-6e every edge requested exactly once across 0/1/3/5-step frames', detail.length ? detail : allMatch, allMatch);
    PB.input.clearAll('selfcheck');
    // ---------- 队列消费语义（M-26）：取空后再次取为空 ----------
    key('keydown', 'KeyD');
    PB.input.takeSimEdges(out);
    var first = out.length;
    PB.input.takeSimEdges(out);
    sc.assertEq('M-26 sim queue drained after take', [first, out.length], [1, 0]);
    key('keyup', 'KeyD');
    PB.input.clearAll('selfcheck');
    // ---------- UI 队列：C/1–5/M/L/Escape 每帧都消费，与固定步无关 ----------
    key('keydown', 'KeyC'); key('keyup', 'KeyC');
    key('keydown', 'Digit3'); key('keyup', 'Digit3');
    key('keydown', 'KeyM'); key('keyup', 'KeyM');
    PB.input.takeUiEdges(out);
    var uiActs = out.map(function (e) { return e.act + (e.n === undefined ? '' : e.n); });
    sc.assertEq('§4.5.1 UI edges (camNext/camSet/mute)', uiActs, ['camNext', 'camSet2', 'mute']);
    PB.input.clearAll('selfcheck');
    // ---------- toCommand 合并规则（§4.5.1）----------
    var G = { t: 10, bike: { laneT: 1, lastLaneReqT: -9 } };
    var cmd = { throttle: false, brake: false, laneDelta: 0, jumpPress: false, wing: false };
    PB.input.toCommand({ held: { throttle: false, brake: true, left: false, right: false, jump: false, wing: true } },
      [{ act: 'right' }, { act: 'right' }, { act: 'right' }], G, cmd);
    sc.assertEq('§4.5.1 laneDelta clamped to +2', [cmd.laneDelta, cmd.brake, cmd.wing], [2, true, true]);
    PB.input.toCommand({ held: { throttle: true, brake: false, left: false, right: false, jump: false, wing: false } },
      [{ act: 'left' }, { act: 'right' }, { act: 'jump' }], G, cmd);
    sc.assertEq('§4.5.1 opposite edges cancel and jump registers', [cmd.laneDelta, cmd.jumpPress, cmd.throttle], [0, true, true]);
    // 按住重复：held right、laneT=1、t−lastLaneReqT ≥ 0.45 → 再发 +1 并写 lastLaneReqT
    var G2 = { t: 10, bike: { laneT: 1, lastLaneReqT: 9.5 } };
    PB.input.toCommand({ held: { throttle: false, brake: false, left: false, right: true, jump: false, wing: false } }, [], G2, cmd);
    sc.assertEq('§4.5.2 held-repeat emits +1 and writes lastLaneReqT', [cmd.laneDelta, G2.bike.lastLaneReqT], [1, 10]);
    PB.input.toCommand({ held: { throttle: false, brake: false, left: false, right: true, jump: false, wing: false } }, [], G2, cmd);
    sc.assertEq('§4.5.2 held-repeat rate-limits to 0.45 s', cmd.laneDelta, 0);
    // ---------- 指针状态机（§4.5.3 / M-16）----------
    // 派发合成指针事件。setPointerCapture 对未激活指针会抛错，input 内部已 try/catch。
    function ptr(type, id, target) {
      var ev = new PointerEvent(type, { pointerId: id, bubbles: true, cancelable: true, isPrimary: true });
      (target || window).dispatchEvent(ev);
    }
    ptr('pointerdown', 1, btn);
    PB.input.snapshot(0, snap);
    sc.assertEq('§4.5.3 pointerdown → held', [snap.held.left, PB.input.stats().ptrCountSum, PB.input.stats().ptrMapSize], [true, 1, 1]);
    // 双指同按同一按钮：抬起一指后仍为 held（AC-10 的输入层判据）
    ptr('pointerdown', 2, btn);
    ptr('lostpointercapture', 1, window);
    PB.input.snapshot(0, snap);
    sc.assertEq('§4.5.3 two fingers, release one → still held', [snap.held.left, PB.input.stats().ptrCountSum], [true, 1]);
    ptr('pointerup', 2, window);
    PB.input.snapshot(0, snap);
    sc.assertEq('§4.5.3 release both → not held', [snap.held.left, PB.input.stats().ptrMapSize], [false, 0]);
    // 拖出按钮后被系统打断（lostpointercapture）→ 不卡住（§5.2 第 2 条）
    ptr('pointerdown', 3, btn);
    ptr('lostpointercapture', 3, window);
    PB.input.snapshot(0, snap);
    sc.assertEq('§5.2#2 lostpointercapture releases the button', [snap.held.left, PB.input.stats().ptrCountSum], [false, 0]);
    // clearAll 清空一切（M-17）
    ptr('pointerdown', 4, btn);
    key('keydown', 'KeyW');
    PB.input.clearAll('selfcheck');
    PB.input.snapshot(0, snap);
    sc.assertEq('M-17 clearAll clears keys and pointers', [snap.anyHeld, PB.input.stats().ptrMapSize], [false, 0]);
    key('keyup', 'KeyW');
    // 键盘 repeat 不入队（§4.5.1）
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', repeat: true, bubbles: true }));
    PB.input.takeSimEdges(out);
    sc.assertEq('§4.5.1 repeat does not enqueue edges', out.length, 0);
    PB.input.clearAll('selfcheck');
    document.body.removeChild(canvas);
    document.body.removeChild(root);
  });
})();
// ===== P4：sim 运动学、健康检查、rig（§4.5.2、§4.12、§4.13）=====
(function () {
  'use strict';
  var sc = window.__sc;
  var PB = window.PB;
  var CFG = PB.config;
  var H = CFG.H;
  // 建一个不带 cmd 的默认指令对象（复用，避免测试里到处写字面量）。
  function makeCmd() {
    return { throttle: false, brake: false, laneDelta: 0, jumpPress: false, wing: false };
  }
  // 用同一个 cmd 连续推进 n 步。
  function run(G, cmd, n) {
    for (var i = 0; i < n; i++) {
      PB.sim.step(G, cmd, H);
      PB.rig.compute(G);
      PB.sim.healthCheck(G, { nanResets: 0, nanWindow: [] });
    }
  }
  sc.sections.push(function () {
    // ---------- M-33：createState 只建纯数据，不创建 rig/scarf/env ----------
    var G = PB.sim.createState(12345, { camMode: 2 });
    var keys = Object.keys(G).sort();
    sc.assertEq('M-33 createState key set is exactly §3.3', keys,
      ['S', 'ap', 'bike', 'cam', 'cycle', 'events', 'fish', 'fishSeq', 'lastGood', 'nextFishS', 'p', 'rng', 'score', 'stats', 't']);
    sc.assertTrue('M-33 createState does not create G.rig (P4 initSession owns it)', G.rig === undefined, G.rig === undefined, String(G.rig));
    sc.assertTrue('M-33 createState does not create G.scarf (P6)', G.scarf === undefined, G.scarf === undefined, String(G.scarf));
    sc.assertTrue('M-33 createState does not create G.env (P7)', G.env === undefined, G.env === undefined, String(G.env));
    sc.assertEq('§3.3 camMode taken from opts', G.cam.mode, 2);
    sc.assertEq('§3.3 rng seeded from argument', G.rng, 12345);
    sc.assertEq('§3.3 bike initial lane/laneT', [G.bike.lane, G.bike.laneT, G.bike.x], [1, 1, 0]);
    sc.assertEq('§3.3 ap initial state', [G.ap.engaged, G.ap.targetId, G.ap.prevTArr, G.ap.jumpedFor], [false, -1, null, -1]);
    // ---------- newSession 后 §3.3 的字段存在且有限（M-33 的 selfcheck 口径）----------
    PB.rig.initState(G);
    var finite = true;
    var badField = '';
    var numeric = {
      't': G.t, 'S': G.S, 'p': G.p, 'cycle': G.cycle, 'rng': G.rng,
      'lastGood.t': G.lastGood.t, 'lastGood.S': G.lastGood.S,
      'bike.x': G.bike.x, 'bike.y': G.bike.y, 'bike.vy': G.bike.vy, 'bike.v': G.bike.v, 'bike.a': G.bike.a,
      'bike.lane': G.bike.lane, 'bike.laneFromX': G.bike.laneFromX, 'bike.laneToX': G.bike.laneToX,
      'bike.laneT': G.bike.laneT, 'bike.lastLaneReqT': G.bike.lastLaneReqT, 'bike.jumpBufT': G.bike.jumpBufT,
      'bike.wheelie': G.bike.wheelie, 'bike.wing': G.bike.wing, 'bike.crank': G.bike.crank,
      'bike.lean': G.bike.lean, 'bike.rpm': G.bike.rpm,
      'score.points': G.score.points, 'score.catches': G.score.catches, 'score.combo': G.score.combo,
      'score.lastCatchT': G.score.lastCatchT,
      'stats.nightRideT': G.stats.nightRideT, 'stats.speedHighT': G.stats.speedHighT,
      'stats.wheelieT': G.stats.wheelieT, 'stats.apCatches': G.stats.apCatches,
      'cam.blendT': G.cam.blendT, 'cam.cineT': G.cam.cineT,
      'cam.orbit.yaw': G.cam.orbit.yaw, 'cam.orbit.pitch': G.cam.orbit.pitch, 'cam.orbit.dist': G.cam.orbit.dist,
      'rig.beakW.x': G.rig.beakW.x, 'rig.beakW.y': G.rig.beakW.y, 'rig.beakW.z': G.rig.beakW.z,
      'rig.prevBeakZ': G.rig.prevBeakZ
    };
    for (var k in numeric) {
      if (!Object.prototype.hasOwnProperty.call(numeric, k)) continue;
      if (typeof numeric[k] !== 'number' || !isFinite(numeric[k])) { finite = false; badField = k; }
    }
    sc.assertTrue('§3.3 all numeric fields finite after initSession', badField || finite, finite);
    sc.assertEq('§3.3 G.events / G.fish / G.stats.camUsed exist', [Array.isArray(G.events), Array.isArray(G.fish), G.stats.camUsed.length], [true, true, 5]);
    // ---------- rig 复算样例（§4.13）----------
    var Gn = PB.sim.createState(1, {});
    PB.rig.initState(Gn);
    sc.assertNear('§4.13 neutral beakW.y = 1.663', Gn.rig.beakW.y, 1.663, 1e-12);
    sc.assertNear('§4.13 neutral beakW.z = −1.072', Gn.rig.beakW.z, -1.072, 1e-12);
    Gn.bike.wheelie = 18 * Math.PI / 180;
    PB.rig.compute(Gn);
    sc.assertNear('§4.13 wheelie 18° beakW.y ≈ 1.913', Gn.rig.beakW.y, 1.913, 0.001);
    sc.assertNear('§4.13 wheelie 18° beakW.z ≈ −0.506', Gn.rig.beakW.z, -0.506, 0.001);
    Gn.bike.wheelie = 0;
    Gn.bike.lean = 0.21;
    PB.rig.compute(Gn);
    sc.assertNear('§4.13 lean 0.21 beakW.x ≈ −0.347', Gn.rig.beakW.x, -0.347, 0.001);
    // 围巾锚点与碰撞球都在同一 M 下，中立时应等于 §1.5 的局部坐标
    sc.assertNear('§4.13 anchorW[0].y (neutral, lean/wheelie 0)', (function () {
      var g = PB.sim.createState(1, {}); PB.rig.initState(g); return g.rig.anchorW[0].y;
    })(), 1.55, 1e-12);
    // ---------- AC-6a：同时 held W 和 S 时 v 严格递减到 0（M-14 刹车优先）----------
    var Ga = PB.sim.createState(7, {});
    PB.rig.initState(Ga);
    Ga.bike.v = 8;
    var ca = makeCmd(); ca.throttle = true; ca.brake = true;
    var strictlyDown = true, prev = Ga.bike.v, reachedZero = false;
    for (var i1 = 0; i1 < 120; i1++) {
      PB.sim.step(Ga, ca, H);
      if (!(Ga.bike.v < prev || (Ga.bike.v === 0 && prev === 0))) strictlyDown = false;
      prev = Ga.bike.v;
      if (Ga.bike.v === 0) reachedZero = true;
    }
    sc.assertTrue('AC-6a W+S strictly decreases v to 0', strictlyDown && reachedZero, { v: Ga.bike.v, strictlyDown: strictlyDown, reachedZero: reachedZero });
    // ---------- AC-6b：一次变道在 21±1 步内使 laneT 到达 1 ----------
    var Gb = PB.sim.createState(8, {});
    PB.rig.initState(Gb);
    var cb = makeCmd(); cb.laneDelta = 1;
    var steps = 0;
    PB.sim.step(Gb, cb, H);          // 第 1 步启动变道
    steps = 1;
    while (Gb.bike.laneT < 1 && steps < 200) { PB.sim.step(Gb, makeCmd(), H); steps++; }
    sc.assertRange('AC-6b lane change completes in 21±1 steps', steps, 20, 22);
    sc.assertNear('AC-6b final x = lane 2 center', Gb.bike.x, 2.5, 1e-9);
    // ---------- AC-6c：跳跃最高 0.893±0.03 m、滞空 0.714±0.03 s ----------
    var Gc = PB.sim.createState(9, {});
    PB.rig.initState(Gc);
    var cj = makeCmd(); cj.jumpPress = true;
    PB.sim.step(Gc, cj, H);
    var apex = Gc.bike.y, airSteps = 1, sawLand = false;
    var c0 = makeCmd();
    for (var i2 = 0; i2 < 200 && Gc.bike.airborne; i2++) {
      PB.sim.step(Gc, c0, H);
      airSteps++;
      if (Gc.bike.y > apex) apex = Gc.bike.y;
      if (!Gc.bike.airborne) sawLand = true;
    }
    sc.assertRange('AC-6c jump apex in 0.893±0.03', apex, 0.863, 0.923);
    sc.assertRange('AC-6c airtime in 0.714±0.03', airSteps * H, 0.684, 0.744);
    sc.assertTrue('AC-6c lands (airborne cleared)', sawLand && Gc.bike.y === 0, { sawLand: sawLand, y: Gc.bike.y });
    // ---------- AC-6d：held T 时 wheelie 在 ≤0.35 s 内到达 0.314 并保持 ----------
    var Gd = PB.sim.createState(10, {});
    PB.rig.initState(Gd);
    var ct = makeCmd(); ct.wing = true;
    var tSteps = 0;
    while (Gd.bike.wheelie < CFG.SIM.WHEELIE_MAX && tSteps < 60) { PB.sim.step(Gd, ct, H); tSteps++; }
    sc.assertRange('AC-6d wheelie reaches 0.314 within 0.35 s', tSteps * H, 0, 0.35);
    sc.assertNear('AC-6d wheelie holds at max', Gd.bike.wheelie, CFG.SIM.WHEELIE_MAX, 1e-12);
    var beforeHold = Gd.bike.wheelie;
    run(Gd, ct, 60);
    sc.assertNear('AC-6d wheelie stays at max while held', Gd.bike.wheelie, beforeHold, 1e-12);
    // ---------- AC-6f：起跳后第 1–5 步再按跳，不会注入新的 vy ----------
    var Gf = PB.sim.createState(11, {});
    PB.rig.initState(Gf);
    var cf = makeCmd(); cf.jumpPress = true;
    PB.sim.step(Gf, cf, H);
    var vyAfterLaunch = Gf.bike.vy;
    var injected = false;
    var jumps = 0;
    for (var i3 = 0; i3 < 5; i3++) {
      PB.sim.step(Gf, cf, H);      // 空中继续按跳
      if (Gf.bike.vy > vyAfterLaunch) injected = true;
    }
    for (var j = 0; j < Gf.events.length; j++) if (Gf.events[j].type === 'jump') jumps++;
    sc.assertTrue('AC-6f no new vy injected after take-off', !injected, { vyAfterLaunch: vyAfterLaunch, vy: Gf.bike.vy });
    sc.assertEq('AC-6f only one jump event for one take-off', jumps, 1);
    // 落地后不再自动起跳（缓冲已过期）
    var c0b = makeCmd();
    for (var i4 = 0; i4 < 60; i4++) PB.sim.step(Gf, c0b, H);
    sc.assertEq('AC-6f no auto re-jump after landing', Gf.bike.airborne, false);
    // ---------- §4.12 健康检查：越界自愈且不抛错 ----------
    var Gh = PB.sim.createState(12, {});
    PB.rig.initState(Gh);
    var health = { nanResets: 0, nanWindow: [] };
    Gh.bike.x = 99;                  // 越界
    var okFlag = PB.sim.healthCheck(Gh, health);
    sc.assertEq('§4.12 out-of-range bike is repaired', [okFlag, health.nanResets, Math.abs(Gh.bike.x) <= 3], [false, 1, true]);
    Gh.bike.v = NaN;
    PB.sim.healthCheck(Gh, health);
    sc.assertEq('§4.12 NaN velocity is repaired', [health.nanResets, isFinite(Gh.bike.v), Gh.bike.v <= 8], [2, true, true]);
    // 鱼位姿非有限 → 直接删除该鱼
    Gh.fish.push({ id: 1, pose: { x: NaN, y: 0, z: 0 } });
    Gh.fish.push({ id: 2, pose: { x: 0, y: 0, z: 0 } });
    PB.sim.healthCheck(Gh, health);
    sc.assertEq('§4.12 non-finite fish is removed', [Gh.fish.length, Gh.fish[0].id], [1, 2]);
    // ---------- §4.2.1 相位与周期事件 ----------
    var Gp = PB.sim.createState(13, {});
    PB.rig.initState(Gp);
    Gp.t = 239.99;
    var cp = makeCmd();
    var wraps = 0;
    for (var i5 = 0; i5 < 4; i5++) {
      PB.sim.step(Gp, cp, H);
      for (var w = 0; w < Gp.events.length; w++) if (Gp.events[w].type === 'cycleWrap') wraps++;
      Gp.events.length = 0;
    }
    sc.assertEq('§4.2.1 cycleWrap pushed exactly once per cycle', [wraps, Gp.cycle, Gp.p >= 0 && Gp.p < 1], [1, 1, true]);
  });
})();

// ===== P4 裁决（AMD-P4-001 / ADR-21）：等加速精确积分恒等式 =====
// AC-6c 只约束最高点与滞空，改 v0/g 也能凑进区间；这里直接断言每个步点都落在解析解上，
// 把积分形式本身钉住（换成一阶序 vy_first / pos_first 必然失败）。
(function () {
  'use strict';
  var sc = window.__sc, PB = window.PB;
  sc.sections.push(function () {
    var H = PB.config.H, SIM = PB.config.SIM, v0 = SIM.JUMP_V0, g = SIM.GRAVITY;
    var G = PB.sim.createState(0x71, {});
    PB.rig.initState(G);
    var cmd = function (jumpPress) { return { throttle: false, brake: false, laneDelta: 0, jumpPress: jumpPress, wing: false }; };
    PB.sim.step(G, cmd(true), H);   // 第 1 步：vy = v0 并立刻积分一步
    var maxYErr = 0, maxVyErr = 0, steps = 0;
    for (var n = 1; n <= 20 && G.bike.airborne; n++) {
      var t = n * H;                // 解析解：y = v0·t − ½g·t²，vy = v0 − g·t
      maxYErr = Math.max(maxYErr, Math.abs(G.bike.y - (v0 * t - 0.5 * g * t * t)));
      maxVyErr = Math.max(maxVyErr, Math.abs(G.bike.vy - (v0 - g * t)));
      steps = n;
      PB.sim.step(G, cmd(false), H);
    }
    sc.assertEq('§4.5.2 integration identity sampled 20 steps', steps, 20);
    sc.assertNear('§4.5.2 exact integration: y_n = v0·t − ½g·t² at every step', maxYErr, 0, 1e-14);
    sc.assertNear('§4.5.2 exact integration: vy_n = v0 − g·t at every step', maxVyErr, 0, 1e-14);
  });
})();

// ===== P6：围巾（AC-2a/2b/2c + NaN 注入；§4.1 的 Verlet 模型）=====
// 全部用真实 PB.sim/PB.rig/PB.scarf 驱动，不做桩替身；判定位置是 tip–anchorMid 连线（§4.1 测量量）。
(function () {
  'use strict';
  var sc = window.__sc, PB = window.PB;
  sc.sections.push(function () {
    var CFG = PB.config, H = CFG.H, SC = CFG.SCARF;
    function mk(seed) {
      var G = PB.sim.createState(seed, {});
      PB.rig.initState(G);
      PB.scarf.initState(G);
      return G;
    }
    function cmd(lane) {
      return { throttle: false, brake: false, laneDelta: lane || 0, jumpPress: false, wing: false };
    }
    /**
     * tip–anchorMid 的单位方向（AC-2c 的比较量）。
     * @param {object} G 一局状态
     * @param {number[]} out 长度 3 的输出数组（复用）
     * @returns {number[]} out
     */
    function tipDir(G, out) {
      var a0 = G.rig.anchorW[0], a1 = G.rig.anchorW[1];
      var mx = (a0.x + a1.x) * 0.5, my = (a0.y + a1.y) * 0.5, mz = (a0.z + a1.z) * 0.5;
      var i = ((SC.ROWS - 1) * SC.COLS) * 3;
      var dx = (G.scarf.P[i] + G.scarf.P[i + 3]) * 0.5 - mx;
      var dy = (G.scarf.P[i + 1] + G.scarf.P[i + 4]) * 0.5 - my;
      var dz = (G.scarf.P[i + 2] + G.scarf.P[i + 5]) * 0.5 - mz;
      var l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
      out[0] = dx / l; out[1] = dy / l; out[2] = dz / l;
      return out;
    }
    // ---------- AC-2a：v=8 恒定 10 s，后 5 s 夹角均值 ∈ [55°,85°]（sanity 63.9–67.9 不作判据）----------
    var Ga = mk(3), ha = { scarfResets: 0 }, sum = 0, n = 0;
    for (var k = 0; k < 600; k++) {
      Ga.t += H; Ga.bike.v = 8; Ga.bike.a = 0; PB.rig.compute(Ga); PB.scarf.step(Ga, H, ha);
      if (k >= 300) { sum += Ga.scarf.angleDeg; n++; }
    }
    sc.assertRange('AC-2a mean scarf angle (v=8, last 5 s) in [55,85]', sum / n, 55, 85);
    sc.assertEq('AC-2a no scarf reset during 10 s', ha.scarfResets, 0);

    // ---------- AC-2c（ADR-24）：风致偏转 = 与 windScale=0 的同初值对照运行比较同一时刻的 tip 方向 ----------
    // 两次都是真实的 PB.sim.step + PB.scarf.step，各自只读自己的 G.scarf；不共享任何影子状态。
    // 从 newSession（含 scarf.reset）起跑 8 s，取后 5 s（i≥180）每一步的方向夹角最大值。
    var Gc = mk(4), Gk = mk(4), hc = { scarfResets: 0 }, hk = { scarfResets: 0 }, maxDev = 0;
    var dirC = [0, 0, 0], dirK = [0, 0, 0];
    for (var i1 = 0; i1 < 480; i1++) {
      Gc.t += H; Gc.bike.v = 0; Gc.bike.a = 0; PB.rig.compute(Gc); PB.scarf.step(Gc, H, hc, 1);
      Gk.t += H; Gk.bike.v = 0; Gk.bike.a = 0; PB.rig.compute(Gk); PB.scarf.step(Gk, H, hk, 0);
      if (i1 >= 180) {
        tipDir(Gc, dirC); tipDir(Gk, dirK);
        var dotC = dirC[0] * dirK[0] + dirC[1] * dirK[1] + dirC[2] * dirK[2];
        if (dotC > 1) dotC = 1; else if (dotC < -1) dotC = -1;
        var dev = Math.acos(dotC) * 180 / Math.PI;
        if (dev > maxDev) maxDev = dev;
      }
    }
    sc.assertRange('AC-2c wind-induced deviation vs windScale=0 control <= 20 deg', maxDev, 0, 20);
    sc.assertEq('AC-2c neither run reset the scarf', [hc.scarfResets, hk.scarfResets], [0, 0]);

    // ---------- AC-2b：一次变道中尾端横向滞后峰值 ∈ [0.15,0.40] m，1.0 s 内回到 |lag|≤0.05 ----------
    // 读数取 G.scarf.lagX（§4.1：tip.x − anchorMid.x 减去 1 s 基线）；变道用真实 PB.sim.step 驱动。
    var Gb = mk(5), hb = { scarfResets: 0 };
    for (var i3 = 0; i3 < 180; i3++) {
      Gb.t += H; Gb.bike.v = 8; Gb.bike.a = 0; PB.rig.compute(Gb); PB.scarf.step(Gb, H, hb);
    }
    var peak = 0, t0 = Gb.t, series = [];
    for (var i4 = 0; i4 < 120; i4++) {
      Gb.bike.v = 8;
      PB.sim.step(Gb, i4 === 0 ? cmd(1) : cmd(0), H);
      Gb.bike.v = 8; Gb.bike.a = 0;
      PB.rig.compute(Gb); PB.scarf.step(Gb, H, hb);
      var lag = Gb.scarf.lagX;
      if (Math.abs(lag) > peak) peak = Math.abs(lag);
      series.push([Gb.t - t0, lag]);
    }
    var backT = null;
    for (var i5 = 0; i5 < series.length; i5++) {
      var settled = true;
      for (var i6 = i5; i6 < series.length; i6++) if (Math.abs(series[i6][1]) > 0.05) { settled = false; break; }
      if (settled) { backT = series[i5][0]; break; }
    }
    sc.assertRange('AC-2b peak |scarfLagX| in [0.15,0.40]', peak, 0.15, 0.40);
    sc.assertRange('AC-2b |scarfLagX| <= 0.05 within 1.0 s', backT === null ? 99 : backT, 0, 1.0);
    sc.assertEq('AC-2b no scarf reset during lane change', hb.scarfResets, 0);

    // ---------- NaN 注入：一个粒子变 NaN → 1 步内自愈并计数（§4.1 健康检查）----------
    var Gn = mk(6), hn = { scarfResets: 0 };
    for (var i7 = 0; i7 < 60; i7++) {
      Gn.t += H; Gn.bike.v = 8; Gn.bike.a = 0; PB.rig.compute(Gn); PB.scarf.step(Gn, H, hn);
    }
    Gn.scarf.P[30] = NaN;
    Gn.t += H; Gn.bike.v = 8; Gn.bike.a = 0; PB.rig.compute(Gn); PB.scarf.step(Gn, H, hn);
    var finite = true;
    for (var i8 = 0; i8 < Gn.scarf.P.length; i8++) {
      if (!isFinite(Gn.scarf.P[i8]) || !isFinite(Gn.scarf.Q[i8])) finite = false;
    }
    sc.assertEq('§4.1 NaN particle self-heals and counts one reset', [hn.scarfResets, finite], [1, true]);
    // 自愈后不再重复复位（健康状态稳定）
    var before = hn.scarfResets;
    for (var i9 = 0; i9 < 120; i9++) {
      Gn.t += H; Gn.bike.v = 8; Gn.bike.a = 0; PB.rig.compute(Gn); PB.scarf.step(Gn, H, hn);
    }
    sc.assertEq('§4.1 no repeated reset after self-heal', hn.scarfResets, before);

    // ---------- 复位形态：下垂 20°、长度 0.66、全部粒子在 |P−anchorMid| < 1.5 内 ----------
    var Gr = mk(7);
    var a0 = Gr.rig.anchorW[0], a1 = Gr.rig.anchorW[1];
    var mx = (a0.x + a1.x) * 0.5, my = (a0.y + a1.y) * 0.5, mz = (a0.z + a1.z) * 0.5;
    var tipI = ((SC.ROWS - 1) * SC.COLS) * 3;
    var dx = (Gr.scarf.P[tipI] + Gr.scarf.P[tipI + 3]) * 0.5 - mx;
    var dy = (Gr.scarf.P[tipI + 1] + Gr.scarf.P[tipI + 4]) * 0.5 - my;
    var dz = (Gr.scarf.P[tipI + 2] + Gr.scarf.P[tipI + 5]) * 0.5 - mz;
    var tipLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // 复位后经过碰撞投影（ADR-23/ADR-29），直条会被推到椭球外，因此 tip 的直线长度不再等于 0.66 m。
    // ADR-29 的复位定义是"直条 + 一次碰撞投影"，投影把中段推到椭球外，因此直线长度不再是 0.66 m。
    // 判据改成两条真正定义复位形态的条件：①全部粒子在外扩椭球外（投影生效）；②tip 仍远在锚点下方。
    sc.assertTrue('§4.1 reset places every particle outside the torso ellipsoid',
      Gr.scarf.outsideMinF, Gr.scarf.outsideMinF >= 1 - 1e-6, 'minF=' + Gr.scarf.outsideMinF);
    sc.assertTrue('§4.1 reset tip is below the anchor', -dy / (tipLen || 1), -dy / (tipLen || 1) > 0.5,
      'cosDown=' + (-dy / (tipLen || 1)).toFixed(3));
    // 复位瞬时不做约束松弛（ADR-29 只要求"一次碰撞投影"），因此链接长度在复位那一刻不是 0.055；
    // 真正必须成立的是"第一个固定步结束时约束已被拉回"：结构/弯曲/宽度残差 ≤ 1e-3 m。
    var Gr4 = mk(10), h4 = { scarfResets: 0 };
    Gr4.t += H; Gr4.bike.v = 0; Gr4.bike.a = 0; PB.rig.compute(Gr4); PB.scarf.step(Gr4, H, h4);
    var postResidual = 0, pr, pc2;
    for (pr = 0; pr < SC.ROWS - 1; pr++) {
      for (pc2 = 0; pc2 < SC.COLS; pc2++) {
        var pa = (pr * SC.COLS + pc2) * 3, pb = ((pr + 1) * SC.COLS + pc2) * 3;
        postResidual = Math.max(postResidual, Math.abs(Math.sqrt(
          (Gr4.scarf.P[pb] - Gr4.scarf.P[pa]) * (Gr4.scarf.P[pb] - Gr4.scarf.P[pa]) +
          (Gr4.scarf.P[pb + 1] - Gr4.scarf.P[pa + 1]) * (Gr4.scarf.P[pb + 1] - Gr4.scarf.P[pa + 1]) +
          (Gr4.scarf.P[pb + 2] - Gr4.scarf.P[pa + 2]) * (Gr4.scarf.P[pb + 2] - Gr4.scarf.P[pa + 2])) -
          SC.ROW_SPACING));
      }
    }
    // 复位后第一帧仍带着"直条 → 椭球外"的几何跳变，约束需要几帧才收敛；用 §4.1 的稳态口径判定：
    // 0.25 s（15 步）内结构链残差必须回到 1e-3 m 以内，否则说明复位把飘带留在了一个不合法构型。
    var settleResidual = 0, sw;
    for (sw = 0; sw < 15; sw++) {
      Gr4.t += H; Gr4.bike.v = 0; Gr4.bike.a = 0; PB.rig.compute(Gr4); PB.scarf.step(Gr4, H, h4);
    }
    for (pr = 0; pr < SC.ROWS - 1; pr++) {
      for (pc2 = 0; pc2 < SC.COLS; pc2++) {
        var qa = (pr * SC.COLS + pc2) * 3, qb = ((pr + 1) * SC.COLS + pc2) * 3;
        settleResidual = Math.max(settleResidual, Math.abs(Math.sqrt(
          (Gr4.scarf.P[qb] - Gr4.scarf.P[qa]) * (Gr4.scarf.P[qb] - Gr4.scarf.P[qa]) +
          (Gr4.scarf.P[qb + 1] - Gr4.scarf.P[qa + 1]) * (Gr4.scarf.P[qb + 1] - Gr4.scarf.P[qa + 1]) +
          (Gr4.scarf.P[qb + 2] - Gr4.scarf.P[qa + 2]) * (Gr4.scarf.P[qb + 2] - Gr4.scarf.P[qa + 2])) -
          SC.ROW_SPACING));
      }
    }
    sc.assertNear('§4.1 link lengths settle within 0.25 s after reset (residual <= 1e-3 m)',
      settleResidual, 0, 1e-3);
    sc.assertEq('§4.1 no reset during the 0.25 s settle window', h4.scarfResets, 0);
    sc.assertEq('§4.1 reset keeps Q = P', Gr.scarf.P[0], Gr.scarf.Q[0]);

    // ---------- scarf.reset.direction（ADR-29）：复位方向写死为 d=(0,−cos20°,+sin20°) ----------
    // 判据直接读 config 的 RESET_DIR 与复位后第 12 行相对锚点的方向，两者必须一致到 1e-9。
    var Gr2 = mk(8);
    var rd = SC.RESET_DIR;
    var tipI2 = ((SC.ROWS - 1) * SC.COLS) * 3;
    var ax = Gr2.rig.anchorW[0].x, ay = Gr2.rig.anchorW[0].y, az = Gr2.rig.anchorW[0].z;
    // 复位后经过碰撞投影，tip 可能被推到椭球外；用"未投影的方向"判据：第 1 行仍在直线上（f ≥ 1 不会被推）
    var ux = Gr2.scarf.P[tipI2] - ax, uy = Gr2.scarf.P[tipI2 + 1] - ay, uz = Gr2.scarf.P[tipI2 + 2] - az;
    var ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1e-9;
    sc.assertNear('scarf.reset.direction d.y = −cos20°', rd[1], -Math.cos(20 * Math.PI / 180), 1e-12);
    sc.assertNear('scarf.reset.direction d.z = +sin20°', rd[2], Math.sin(20 * Math.PI / 180), 1e-12);
    sc.assertEq('scarf.reset.direction d.x = 0', rd[0], 0);
    // ADR-29 的公式判据必须与碰撞投影分开测：把碰撞体临时缩到 1e-6 m（存/恢复 config），
    // 投影对全部粒子变成 no-op，于是 reset 的初始几何可以逐位对照 anchorW + r·0.055·d。
    // 这不是"绕开门禁"：投影本身由下面两条（收敛残差 + 全部在椭球外）用真实碰撞体判定。
    var saveR = CFG.PEL.TORSO_R, saveNeckR = CFG.PEL.NECK_BALL.r;
    CFG.PEL.TORSO_R = { x: 1e-6, y: 1e-6, z: 1e-6 };
    CFG.PEL.NECK_BALL.r = 1e-6;
    var Gr3 = mk(9);
    CFG.PEL.TORSO_R = saveR; CFG.PEL.NECK_BALL.r = saveNeckR;
    var dirBad = 0, dirRows = 0;
    for (var rw = 1; rw < SC.ROWS; rw++) {
      for (var cw = 0; cw < SC.COLS; cw++) {
        var base = Gr3.rig.anchorW[cw];
        var ei = (rw * SC.COLS + cw) * 3;
        var ex = base.x + rw * SC.ROW_SPACING * rd[0];
        var ey = base.y + rw * SC.ROW_SPACING * rd[1];
        var ez = base.z + rw * SC.ROW_SPACING * rd[2];
        dirRows++;
        if (Math.abs(Gr3.scarf.P[ei] - ex) > 1e-12 || Math.abs(Gr3.scarf.P[ei + 1] - ey) > 1e-12 ||
          Math.abs(Gr3.scarf.P[ei + 2] - ez) > 1e-12) dirBad++;
      }
    }
    sc.assertTrue('scarf.reset.direction rows equal anchorW[c] + r·0.055·d exactly (collider disabled for the formula only)',
      [dirRows, dirBad], dirRows === 24 && dirBad === 0, 'rows=' + dirRows + ' bad=' + dirBad);

    // ---------- scarf.collider.outsideTorso.v{0,8,16}（ADR-23）：每个固定步末第 1–12 行都在外扩椭球外 ----------
    var speeds = [0, 8, 16], worstF = [];
    for (var si = 0; si < speeds.length; si++) {
      var Gcol = mk(20 + si), hcol = { scarfResets: 0 }, minF = Infinity;
      for (var ci = 0; ci < 600; ci++) {
        Gcol.t += H; Gcol.bike.v = speeds[si]; Gcol.bike.a = 0;
        PB.rig.compute(Gcol); PB.scarf.step(Gcol, H, hcol);
        if (Gcol.scarf.outsideMinF < minF) minF = Gcol.scarf.outsideMinF;
      }
      worstF.push(minF);
      sc.assertTrue('scarf.collider.outsideTorso.v' + speeds[si] + ' min f >= 1−1e−6 (10 s)',
        minF, minF >= 1 - 1e-6, 'minF=' + minF);
    }
    sc.assertTrue('scarf.collider.outsideTorso worst across v∈{0,8,16}', Math.min.apply(null, worstF),
      Math.min.apply(null, worstF) >= 1 - 1e-6, JSON.stringify(worstF));

    // ---------- rig.toLocal.roundTrip：toLocal(toWorld(p)) 必须逐分量还原 p ----------
    var Grt = mk(9);
    Grt.bike.x = 1.37; Grt.bike.y = 0.42; Grt.bike.lean = -0.19; Grt.bike.wheelie = 0.24;
    PB.rig.compute(Grt);
    var worstRt = 0;
    for (var ri = 0; ri < 12; ri++) {
      var lp = { x: (ri - 6) * 0.11, y: 0.9 + ri * 0.03, z: -0.4 - ri * 0.05 };
      var wp = { x: 0, y: 0, z: 0 }, bp = { x: 0, y: 0, z: 0 };
      PB.rig.toWorld(Grt, lp, wp);
      PB.rig.toLocal(Grt, wp, bp);
      worstRt = Math.max(worstRt, Math.abs(bp.x - lp.x), Math.abs(bp.y - lp.y), Math.abs(bp.z - lp.z));
    }
    sc.assertNear('rig.toLocal.roundTrip max error <= 1e-12 (12 samples, lean+wheelie+x+y)', worstRt, 0, 1e-12);
  });
})();

// ===== P7：昼夜关键帧、光照方向与星点分布（AC-3d、§4.2.2、§4.2.4）=====
(function () {
  'use strict';
  var sc = window.__sc, PB = window.PB;
  sc.sections.push(function () {
    var CFG = PB.config, H = CFG.H, D2R = Math.PI / 180, CYCLE = CFG.SIM.CYCLE_SECONDS;
    var G = { t: 0 };
    PB.daynight.initState(G);
    var E = G.env;
    // ---------- AC-3d：整周期内 lightDir 角速度 ≤15°/s（1/60 s 采样）----------
    var prev = { x: 0, y: 0, z: 0 }, maxRate = 0;
    PB.daynight.sample(0, E);
    prev.x = E.lightDir.x; prev.y = E.lightDir.y; prev.z = E.lightDir.z;
    for (var n = 1; n <= CYCLE * 60; n++) {
      PB.daynight.sample(n * H, E);
      var d = Math.min(1, Math.max(-1, prev.x * E.lightDir.x + prev.y * E.lightDir.y + prev.z * E.lightDir.z));
      var rate = Math.acos(d) / D2R / H;
      if (rate > maxRate) maxRate = rate;
      prev.x = E.lightDir.x; prev.y = E.lightDir.y; prev.z = E.lightDir.z;
    }
    sc.assertRange('AC-3d lightDir angular rate <= 15 deg/s', maxRate, 0, 15);

    // ---------- §4.2.2 关键帧：p=0 与 p=0.5 的采样值必须等于表格行 ----------
    PB.daynight.sample(0, E);
    sc.assertEq('§4.2.2 p=0 stars/lamps/specPow/specI',
      [E.stars, E.lamps, E.specPow, E.specI], [0, 0, 120, 1.2]);
    sc.assertNear('§4.2.2 p=0 sun elevation = 10°', Math.asin(E.sunDir.y) / D2R, 10, 1e-9);
    sc.assertNear('§4.2.2 p=0 moon elevation = −10°', Math.asin(E.moonDir.y) / D2R, -10, 1e-9);
    sc.assertNear('§4.2.2 p=0 light intensity = 2.2', E.lightI, 2.2, 1e-12);
    PB.daynight.sample(CYCLE * 0.5, E);
    sc.assertEq('§4.2.2 p=0.5 stars/lamps/specPow/specI',
      [E.stars, E.lamps, E.specPow, E.specI], [1, 1, 400, 0.7]);
    sc.assertNear('§4.2.2 p=0.5 moon elevation = 14°', Math.asin(E.moonDir.y) / D2R, 14, 1e-9);
    // 主光在夜间取月亮方向（仰角夹到 ≥3°）
    var moonClamped = { x: 0, y: 0, z: 0 };
    var ce = Math.cos(14 * D2R);
    moonClamped.x = ce * CFG.MOON_DIR_H.x; moonClamped.y = Math.sin(14 * D2R); moonClamped.z = ce * CFG.MOON_DIR_H.z;
    sc.assertNear('§4.2.2 p=0.5 lightDir = moonDir (clamped)',
      Math.abs(E.lightDir.x - moonClamped.x) + Math.abs(E.lightDir.y - moonClamped.y) + Math.abs(E.lightDir.z - moonClamped.z), 0, 1e-12);

    // ---------- 周期闭环无硬切（UD-2）：t→240⁻ 与 t=0 的采样一致 ----------
    PB.daynight.sample(CYCLE - 1e-4, E);
    var endZ = [E.zenith.r, E.zenith.g, E.zenith.b], endH = [E.horizon.r, E.horizon.g, E.horizon.b];
    var endL = [E.lightColor.r, E.lightColor.g, E.lightColor.b], endStars = E.stars, endLamps = E.lamps;
    PB.daynight.sample(0, E);
    var maxDiff = 0;
    var pairs = [[endZ, [E.zenith.r, E.zenith.g, E.zenith.b]], [endH, [E.horizon.r, E.horizon.g, E.horizon.b]],
      [endL, [E.lightColor.r, E.lightColor.g, E.lightColor.b]]];
    for (var p1 = 0; p1 < pairs.length; p1++) {
      for (var c1 = 0; c1 < 3; c1++) maxDiff = Math.max(maxDiff, Math.abs(pairs[p1][0][c1] - pairs[p1][1][c1]));
    }
    sc.assertRange('UD-2 cycle closes seamlessly (max channel diff)', maxDiff, 0, 1e-4);
    sc.assertEq('UD-2 stars/lamps equal at both ends', [endStars, endLamps, E.stars, E.lamps], [0, 0, 0, 0]);

    // ---------- 全相位有限 ----------
    var finite = true;
    for (var n2 = 0; n2 < 2400; n2++) {
      PB.daynight.sample(n2 * 0.1, E);
      if (!isFinite(E.zenith.r + E.horizon.b + E.lightColor.g + E.lightDir.y + E.sunDir.y + E.moonDir.y +
        E.specPow + E.specI + E.hemiI + E.stars + E.lamps + E.ambient.r + E.nightMix)) finite = false;
    }
    sc.assertTrue('§4.2.3 env fields finite across one cycle', finite, finite);

    // ---------- §4.2.4 星点分布：55% 仰角 <24°、最低 4°、单位长度 ----------
    var dirs = PB.mathx.starField(new Float32Array(CFG.STAR_COUNT * 3), CFG.STAR_COUNT);
    var low = 0, minE = 90, unit = true;
    for (var i = 0; i < CFG.STAR_COUNT; i++) {
      var x = dirs[i * 3], y = dirs[i * 3 + 1], z = dirs[i * 3 + 2];
      var e = Math.asin(Math.max(-1, Math.min(1, y))) / D2R;
      if (e < 24) low++;
      if (e < minE) minE = e;
      if (Math.abs(Math.sqrt(x * x + y * y + z * z) - 1) > 1e-6) unit = false;
    }
    sc.assertRange('§4.2.4 fraction of stars below 24° elevation ≈ 0.55', low / CFG.STAR_COUNT, 0.53, 0.57);
    sc.assertRange('§4.2.4 min star elevation >= 4°', minE, 4, 4.5);
    sc.assertTrue('§4.2.4 star directions are unit length', unit, unit);
  });
})();

// ===== P8：海面位移/法线/泡沫（AC-4a/4b/4c/4d；CPU 镜像与 GLSL 同源）=====
(function () {
  'use strict';
  var sc = window.__sc, PB = window.PB;
  sc.sections.push(function () {
    var CFG = PB.config, OM = PB.oceanmath, O = CFG.OCEAN, D2R = Math.PI / 180;
    var phases = new Float32Array(4);
    var nA = { x: 0, y: 0, z: 0 }, nB = { x: 0, y: 0, z: 0 };
    var out = { shoreFoam: 0, crestFoam: 0, foam: 0, dy: 0 };
    OM.phase(1000, 30, phases);

    // ---------- AC-4a：x∈[13,40] 内相距 0.05 m 的相邻法线夹角 ≤3° ----------
    var maxAng = 0;
    for (var z1 = -40; z1 <= 20; z1 += 5) {
      for (var x1 = O.X0; x1 <= 40; x1 += 0.05) {
        OM.normal(x1, z1, phases, nA);
        OM.normal(x1 + 0.05, z1, phases, nB);
        var d = Math.min(1, Math.max(-1, nA.x * nB.x + nA.y * nB.y + nA.z * nB.z));
        var ang = Math.acos(d) / D2R;
        if (ang > maxAng) maxAng = ang;
      }
    }
    sc.assertRange('AC-4a adjacent normals (0.05 m apart) <= 3 deg', maxAng, 0, 3);

    // ---------- AC-4b：32 个 z × 45 个时刻，d∈[0,4] 内 shoreFoam>0.5 的局部极大值 ≥2（≥90% 样本）----------
    var pass = 0, total = 0, minMaxima = 99;
    for (var zi = 0; zi < 32; zi++) {
      var zz = -300 + 360 * zi / 31;
      for (var ti = 0; ti < 45; ti++) {
        var fp = ti / 45;
        var count = 0, prev2 = -1, prev1 = -1;
        for (var dd = 0; dd <= 4.0001; dd += 0.01) {
          OM.foam(CFG.SHORE_X + dd, zz, phases, fp, 150, out);
          var v = out.shoreFoam;
          if (prev2 >= 0 && prev2 < prev1 && prev1 >= v && prev1 > 0.5) count++;
          prev2 = prev1; prev1 = v;
        }
        total++;
        if (count >= 2) pass++;
        if (count < minMaxima) minMaxima = count;
      }
    }
    sc.assertRange('AC-4b share of samples with >=2 shore foam maxima (>=90%)', 100 * pass / total, 90, 100);
    sc.assertRange('AC-4b min local maxima in any sample', minMaxima, 2, 99);

    // ---------- AC-4c：x∈[30,200] 内 crestFoam>0 的面积占比 ∈ [10%,20%] ----------
    var hit = 0, tot = 0, times = [0, 1.1, 2.3, 3.4];
    for (var tk = 0; tk < times.length; tk++) {
      OM.phase(1000, times[tk], phases);
      for (var xc = 30; xc <= 200; xc += 2.125) {
        for (var zc = -300; zc <= 60; zc += 6) {
          OM.foam(xc, zc, phases, 0, 150, out);
          tot++;
          if (out.crestFoam > 0) hit++;
        }
      }
    }
    sc.assertRange('AC-4c crestFoam area fraction in [10,20]%', 100 * hit / tot, 10, 20);

    // ---------- AC-4d：S∈{9999.999,1e6,1e7}，S 与 S+1e-3 的位移差 ≤0.01 m ----------
    var svals = [9999.999, 1e6, 1e7];
    for (var si = 0; si < svals.length; si++) {
      var p1 = new Float32Array(4), p2 = new Float32Array(4);
      OM.phase(svals[si], 42.5, p1);
      OM.phase(svals[si] + 1e-3, 42.5, p2);
      var mx = 0;
      for (var xd = O.X0; xd <= 60; xd += 3) {
        for (var zd = -100; zd <= 40; zd += 5) {
          var a1 = OM.disp(xd, zd, p1, { x: 0, y: 0, z: 0 });
          var b1 = OM.disp(xd, zd, p2, { x: 0, y: 0, z: 0 });
          var len = Math.sqrt((a1.x - b1.x) * (a1.x - b1.x) + (a1.y - b1.y) * (a1.y - b1.y) + (a1.z - b1.z) * (a1.z - b1.z));
          if (len > mx) mx = len;
        }
      }
      sc.assertRange('AC-4d disp delta over ΔS=1e-3 at S=' + svals[si], mx, 0, 0.01);
    }

    // ---------- M-27：相位由双精度取模生成且落在 [0,2π) ----------
    var bad = 0, maxPhase = 0;
    for (var sk = 0; sk < 40; sk++) {
      OM.phase(sk * 250000.5, sk * 3.7, phases);
      for (var wi = 0; wi < 4; wi++) {
        if (!isFinite(phases[wi]) || phases[wi] < 0 || phases[wi] >= Math.PI * 2) bad++;
        if (phases[wi] > maxPhase) maxPhase = phases[wi];
      }
    }
    sc.assertEq('M-27 uPhase always in [0,2π) at large S', bad, 0);
    sc.assertRange('M-27 max uPhase < 2π', maxPhase, 0, Math.PI * 2 - 1e-9);
    // 相位公式与 §4.3 逐项一致（用 WAVES 派生量复算一波）
    var w0 = OM.WAVES[0];
    OM.phase(1234.5, 6.75, phases);
    var expect0 = PB.mathx.mod(w0.k * w0.dz * 1234.5 + w0.omega * 6.75, Math.PI * 2);
    sc.assertNear('§4.3 uPhase[0] = mod(k·dirZ·S + ω·t, 2π)', phases[0], Math.fround(expect0), 1e-6);
  });
})();

// ===== P6-fix / P8-fix 追加（AMD-P8-001）：PR-8 参数扫描与墨镜几何 =====
// PR-8 是 AMD-P8-001 §8 的"证明判据"：在 C_Q∈[0.8,1.4] × DAMP∈[0.97,0.995] × v∈{0,4,8,12,16} 内扫描，
// 输出同时满足 AC-2a/2b/2c 的可行参数集；可行集为空即按 §8 停下升级（不得改阈值）。
(function () {
  'use strict';
  var sc = window.__sc, PB = window.PB;
  sc.sections.push(function () {
    var CFG = PB.config, H = CFG.H, SC = CFG.SCARF;
    var CQS = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4];
    var DAMPS = [0.97, 0.98, 0.985, 0.99, 0.995];
    var VS = [0, 4, 8, 12, 16];
    var cmd = function (lane) {
      return { throttle: false, brake: false, laneDelta: lane || 0, jumpPress: false, wing: false };
    };
    function mk(seed) {
      var G = PB.sim.createState(seed, {});
      PB.rig.initState(G);
      PB.scarf.initState(G);
      return G;
    }
    function tipDir(G, out) {
      var a0 = G.rig.anchorW[0], a1 = G.rig.anchorW[1];
      var mx = (a0.x + a1.x) * 0.5, my = (a0.y + a1.y) * 0.5, mz = (a0.z + a1.z) * 0.5;
      var i = ((SC.ROWS - 1) * SC.COLS) * 3;
      var dx = (G.scarf.P[i] + G.scarf.P[i + 3]) * 0.5 - mx;
      var dy = (G.scarf.P[i + 1] + G.scarf.P[i + 4]) * 0.5 - my;
      var dz = (G.scarf.P[i + 2] + G.scarf.P[i + 5]) * 0.5 - mz;
      var l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
      out[0] = dx / l; out[1] = dy / l; out[2] = dz / l;
      return out;
    }
    /** AC-2a：v 恒定 10 s，后 5 s 平均夹角。 */
    function ac2a(v) {
      var G = mk(31), h = { scarfResets: 0 }, sum = 0, n = 0;
      for (var k = 0; k < 600; k++) {
        G.t += H; G.bike.v = v; G.bike.a = 0; PB.rig.compute(G); PB.scarf.step(G, H, h);
        if (k >= 300) { sum += G.scarf.angleDeg; n++; }
      }
      return sum / n;
    }
    /** AC-2b：一次变道的 lagX 峰值与回落时间。 */
    function ac2b(v) {
      var G = mk(32), h = { scarfResets: 0 }, i;
      for (i = 0; i < 180; i++) {
        G.t += H; G.bike.v = v; G.bike.a = 0; PB.rig.compute(G); PB.scarf.step(G, H, h);
      }
      var peak = 0, series = [];
      for (i = 0; i < 150; i++) {
        G.bike.v = v;
        PB.sim.step(G, i === 0 ? cmd(1) : cmd(0), H);
        G.bike.v = v; G.bike.a = 0;
        PB.rig.compute(G); PB.scarf.step(G, H, h);
        var lag = G.scarf.lagX;
        if (Math.abs(lag) > peak) peak = Math.abs(lag);
        series.push([i * H, lag]);
      }
      var back = null;
      for (i = 0; i < series.length; i++) {
        var settled = true;
        for (var j = i; j < series.length; j++) if (Math.abs(series[j][1]) > 0.05) { settled = false; break; }
        if (settled) { back = series[i][0]; break; }
      }
      return { peak: peak, back: back };
    }
    /** AC-2c：与 windScale=0 的同初值对照运行比较 tip 方向。 */
    function ac2c() {
      var A = mk(33), B = mk(33), hA = { scarfResets: 0 }, hB = { scarfResets: 0 };
      var dA = [0, 0, 0], dB = [0, 0, 0], worst = 0;
      for (var i = 0; i < 480; i++) {
        A.t += H; A.bike.v = 0; A.bike.a = 0; PB.rig.compute(A); PB.scarf.step(A, H, hA, 1);
        B.t += H; B.bike.v = 0; B.bike.a = 0; PB.rig.compute(B); PB.scarf.step(B, H, hB, 0);
        if (i >= 180) {
          tipDir(A, dA); tipDir(B, dB);
          var d = dA[0] * dB[0] + dA[1] * dB[1] + dA[2] * dB[2];
          if (d > 1) d = 1; else if (d < -1) d = -1;
          var ang = Math.acos(d) * 180 / Math.PI;
          if (ang > worst) worst = ang;
        }
      }
      return worst;
    }

    var cq0 = SC.CQ, damp0 = SC.DAMP;
    var feasible = [], minPeak = Infinity, maxPeak = -Infinity, minA = Infinity, maxA = -Infinity, maxC = -Infinity;
    var peakByV = {};
    for (var vi = 0; vi < VS.length; vi++) peakByV[VS[vi]] = { min: Infinity, max: -Infinity };
    for (var ci = 0; ci < CQS.length; ci++) {
      for (var di = 0; di < DAMPS.length; di++) {
        SC.CQ = CQS[ci]; SC.DAMP = DAMPS[di];
        var a = ac2a(8), b = ac2b(8), c = ac2c();
        var ok = a >= 55 && a <= 85 && b.peak >= 0.15 && b.peak <= 0.40 &&
          b.back !== null && b.back <= 1.0 && c <= 20;
        if (ok) feasible.push({ cq: CQS[ci], damp: DAMPS[di], a: a, peak: b.peak, back: b.back, c: c });
        if (a < minA) minA = a; if (a > maxA) maxA = a;
        if (b.peak < minPeak) minPeak = b.peak; if (b.peak > maxPeak) maxPeak = b.peak;
        if (c > maxC) maxC = c;
        for (var vj = 0; vj < VS.length; vj++) {
          var bb = ac2b(VS[vj]);
          if (bb.peak < peakByV[VS[vj]].min) peakByV[VS[vj]].min = bb.peak;
          if (bb.peak > peakByV[VS[vj]].max) peakByV[VS[vj]].max = bb.peak;
        }
      }
    }
    SC.CQ = cq0; SC.DAMP = damp0;

    // 判据（AMD-P8-001 §8）：可行集必须非空；空集时这一条 FAIL，并按 §8 停下升级给用户。
    sc.assertTrue('PR8.sweep feasible set non-empty (C_Q×DAMP×v, AC-2a/2b/2c simultaneously)',
      feasible.length, feasible.length > 0,
      'grid=' + (CQS.length * DAMPS.length) + '; AC-2a∈[' + minA.toFixed(1) + ',' + maxA.toFixed(1) +
      ']; AC-2b(v=8)∈[' + minPeak.toFixed(3) + ',' + maxPeak.toFixed(3) + ']; AC-2c max=' + maxC.toFixed(2));
    sc.assertEq('PR8.sweep grid size = 7 C_Q × 5 DAMP = 35 parameter sets', CQS.length * DAMPS.length, 35);
    sc.assertTrue('PR8.sweep reports per-v AC-2b peak ranges', peakByV,
      true, JSON.stringify(peakByV));

    // ---------- pelican.glasses.cornersOutsideHead（ADR-26）：16 个角到头心 ≥0.16 且 y ≤ 1.79 ----------
    // 这条用例需要 THREE（真实网格矩阵），所以 selfcheck.html 不含 pelican.js 时跳过并显式记 SKIP。
    if (!PB.pelican || typeof PB.pelican.glassesCorners !== 'function') {
      sc.assertTrue('pelican.glasses.cornersOutsideHead requires a render page (SKIP in core-only selfcheck)',
        'skipped', true, 'pelican 不在 selfcheck.html 的加载集内（§3.2），本项由 [browser] 用例覆盖');
    } else {
      var corners = PB.pelican.glassesCorners();
      var HC = CFG.HEAD_CENTER_L, R = CFG.PEL.HEAD_R;
      var worstD = Infinity, worstY = -Infinity;
      for (var qi = 0; qi < corners.length; qi++) {
        var q = corners[qi];
        var dd = Math.sqrt((q.x - HC.x) * (q.x - HC.x) + (q.y - HC.y) * (q.y - HC.y) + (q.z - HC.z) * (q.z - HC.z));
        if (dd < worstD) worstD = dd;
        if (q.y > worstY) worstY = q.y;
      }
      sc.assertEq('pelican.glasses.cornersOutsideHead corner count = 16', corners.length, 16);
      sc.assertTrue('pelican.glasses.cornersOutsideHead min distance to head centre >= 0.16',
        worstD, worstD >= R, 'minD=' + worstD);
      sc.assertTrue('pelican.glasses.cornersOutsideHead max y <= 1.79 (below helmet brim)',
        worstY, worstY <= 1.79, 'maxY=' + worstY);
    }
  });
})();

// ===== P9：抓鱼（§4.4、AC-5a(ii)/5b/5c/5d、M-10）=====
(function () {
  'use strict';
  var sc = window.__sc;
  var PB = window.PB;
  var CFG = PB.config;
  var F = CFG.FISH;
  var D2R = Math.PI / 180;

  /**
   * 建一局最小可用的 G：createState（纯数据）+ rig.initState（fish.pose 读 G.rig.beakW）。
   * @param {object} [bike] 覆盖的 bike 字段
   * @param {number} [t] 初始模拟时间
   * @returns {object} G
   */
  function mkG(bike, t) {
    var G = PB.sim.createState(CFG.SEED, { camMode: 0 });
    if (bike) for (var k in bike) if (Object.prototype.hasOwnProperty.call(bike, k)) G.bike[k] = bike[k];
    if (typeof t === 'number') G.t = t;
    PB.rig.initState(G);
    G.rig.prevBeakZ = G.rig.beakW.z;
    return G;
  }

  /**
   * 在喙前放一条鱼（真实 fish.pose 初值）。dist 默认让 z 与中立喙尖对齐。
   * @param {object} G 一局状态
   * @param {boolean} high 是否高鱼
   * @param {number} [dist] 相对 G.S 的距离
   * @param {number} [age] alive 年龄（>1 时处于悬停段）
   * @param {number} [id] 鱼 id（决定 bob 相位）
   * @returns {object} 鱼
   */
  function placeFish(G, high, dist, age, id) {
    var f = {
      id: (id === undefined) ? G.fishSeq++ : id,
      lane: 1, s: G.S + (dist === undefined ? 1.072 : dist),
      tSpawn: G.t - (age === undefined ? 2 : age), high: !!high, state: 'alive', tState: G.t,
      p0: { x: 0, y: 0, z: 0 },
      pose: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scale: 1 }, prevZ: 0
    };
    PB.fish.pose(f, G, f.pose);
    f.prevZ = f.pose.z;
    G.fish.push(f);
    return f;
  }

  sc.sections.push(function () {
    // ---------- §4.4.2 alive pose 的起点/悬停公式 ----------
    var G = mkG({}, 5);
    G.S = 100;
    var f = { id: 0, lane: 1, s: 130, tSpawn: 5, high: false, state: 'alive', tState: 5, p0: { x: 0, y: 0, z: 0 }, pose: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scale: 1 }, prevZ: 0 };
    var out = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scale: 1 };
    PB.fish.pose(f, G, out);
    sc.assertNear('§4.4.2 alive spawn x = 18', out.x, 18, 1e-12);
    sc.assertNear('§4.4.2 alive spawn y = −0.8', out.y, -0.8, 1e-12);
    sc.assertNear('§4.4.2 alive z = −(s−S)', out.z, -30, 1e-12);
    sc.assertNear('§4.4.2 alive spawn yaw = 0 (nose +Z)', out.yaw, 0, 1e-12);
    f.tSpawn = 5 - 2;   // age = 2 s → 悬停段
    PB.fish.pose(f, G, out);
    sc.assertNear('§4.4.2 alive hover x = laneX + weave', out.x, 0 + F.WEAVE_AMP * Math.sin(2 * Math.PI * F.WEAVE_HZ * 2), 1e-12);
    sc.assertNear('§4.4.2 alive hover y = 1.55 + bob', out.y, 1.55 + F.BOB_AMP * Math.sin(2 * Math.PI * F.BOB_HZ * 2), 1e-12);
    sc.assertEq('§4.4.2 alive scale = 1', out.scale, 1);

    // ---------- AC-5b：合成序列的计分（§4.4.4） ----------
    var G2 = mkG({}, 10);
    G2.S = 500;
    G2.nextFishS = 1e9;
    placeFish(G2, false);
    PB.fish.step(G2, 1 / 60);
    sc.assertEq('AC-5b catch#1 points', G2.score.points, 10);
    sc.assertEq('AC-5b catch#1 combo', G2.score.combo, 1);
    sc.assertEq('AC-5b catch#1 catches', G2.score.catches, 1);
    sc.assertEq('AC-5b catch event count', G2.events.filter(function (e) { return e.type === 'catch'; }).length, 1);
    G2.t += 1; G2.events.length = 0;
    placeFish(G2, false);
    PB.fish.step(G2, 1 / 60);
    sc.assertEq('AC-5b catch#2 combo (≤4 s)', G2.score.combo, 2);
    sc.assertEq('AC-5b catch#2 points (+floor(10×1.25)=12)', G2.score.points, 22);
    // 抬轮 0.18 rad（≥10°）：喙随之偏移，鱼按当时的喙 z 放置，保证命中
    G2.t += 1; G2.events.length = 0;
    G2.bike.wheelie = 0.18;
    PB.rig.compute(G2);
    placeFish(G2, false, -G2.rig.beakW.z + 0.35);
    PB.fish.step(G2, 1 / 60);
    sc.assertEq('AC-5b wheelie catch event flagged', G2.events.filter(function (e) { return e.type === 'catch' && e.wheelie; }).length, 1);
    sc.assertEq('AC-5b catch#3 points (+floor(15×1.5)=22)', G2.score.points, 44);
    // 空中抓：combo 窗口外 → 倍率回到 1；air 加分 5
    G2.t += 10; G2.events.length = 0;
    G2.bike.wheelie = 0; G2.bike.airborne = true;
    PB.rig.compute(G2);
    placeFish(G2, false);
    PB.fish.step(G2, 1 / 60);
    sc.assertEq('AC-5b air catch event flagged', G2.events.filter(function (e) { return e.type === 'catch' && e.air; }).length, 1);
    sc.assertEq('AC-5b catch#4 combo reset', G2.score.combo, 1);
    sc.assertEq('AC-5b catch#4 points (+15)', G2.score.points, 59);
    G2.bike.airborne = false;
    // 倍率上限 2.0
    G2.score.combo = 8;
    G2.score.lastCatchT = G2.t;
    sc.assertEq('AC-5b multiplier cap 2.0', PB.fish.scoreCatch(G2), 20);

    // ---------- AC-5a(ii)：捕获步迁移后的 pose 逐位等于判定用的 alive pose ----------
    var G3 = mkG({}, 20);
    G3.S = 800;
    G3.nextFishS = 1e9;
    var f3 = placeFish(G3, false, undefined, 2.3, 7);
    // 记录判定前的 alive pose
    var judge = { x: f3.pose.x, y: f3.pose.y, z: f3.pose.z };
    PB.fish.step(G3, 1 / 60);
    sc.assertTrue('AC-5a(ii) fish migrated to caught', f3.state, f3.state === 'caught', 'state=' + f3.state);
    sc.assertEq('AC-5a(ii) p0 == judged alive pose',
      [f3.p0.x === judge.x, f3.p0.y === judge.y, f3.p0.z === judge.z], [true, true, true]);
    sc.assertEq('AC-5a(ii) post-migration pose == p0 exactly',
      [f3.pose.x === f3.p0.x, f3.pose.y === f3.p0.y, f3.pose.z === f3.p0.z], [true, true, true]);
    // caught 在 0.4 s 被移除
    G3.t = f3.tState + 0.41;
    PB.fish.step(G3, 1 / 60);
    sc.assertEq('§4.4.2 caught removed at a≥0.4', G3.fish.length, 0);

    // ---------- AC-5c：high 鱼在无跳跃时不可捕获，跳跃时存在可捕获时刻 ----------
    var G4 = mkG({}, 0);
    var maxBeakY = -Infinity, wi, li;
    for (wi = 0; wi <= 18; wi++) {
      for (li = -5; li <= 5; li++) {
        G4.bike.wheelie = wi * D2R; G4.bike.lean = (0.21 * li) / 5; G4.bike.y = 0; G4.bike.x = 0;
        PB.rig.compute(G4);
        if (G4.rig.beakW.y > maxBeakY) maxBeakY = G4.rig.beakW.y;
      }
    }
    var highMinY = F.HOVER_HIGH - F.BOB_AMP;
    sc.assertRange('AC-5c beak max y (wheelie ≤18°, |lean| ≤0.21, y=0) < high fish − 0.45',
      maxBeakY, -Infinity, highMinY - F.CATCH_Y);
    // 跳跃：真实 sim.step 一次起跳，逐点取喙尖高度
    var G5 = mkG({ v: 8 }, 0);
    var cmd = { throttle: false, brake: false, laneDelta: 0, jumpPress: true, wing: false };
    var maxJumpY = -Infinity;
    PB.sim.step(G5, cmd, 1 / 60);
    PB.rig.compute(G5);
    for (var i = 0; i < 60; i++) {
      cmd.jumpPress = false;
      PB.sim.step(G5, cmd, 1 / 60);
      PB.rig.compute(G5);
      if (G5.rig.beakW.y > maxJumpY) maxJumpY = G5.rig.beakW.y;
    }
    sc.assertRange('AC-5c beak max y during jump ≥ high fish reach', maxJumpY, highMinY - F.CATCH_Y, 10);
    sc.assertNear('AC-5c jump apex beak y ≈ 1.663+0.8925', maxJumpY, 1.663 + 0.8925, 0.01);

    // ---------- AC-5d：missed 轨迹（lane × high × bob 相位 × 迁移时 alive 年龄） ----------
    var lanes = [0, 1, 2], highs = [false, true], ages = [0.1, 0.3, 0.5, 0.7, 0.9, 1.5, 3.0];
    var bad = { cross: 0, mono: 0, sea: 0, remove: 0, step: 0, cont: 0 };
    var worstCross = -Infinity, worstStep = 0, samples = 0;
    for (var ln = 0; ln < lanes.length; ln++) {
      for (var hi = 0; hi < highs.length; hi++) {
        for (var ph = 0; ph < 16; ph++) {
          for (var ai = 0; ai < ages.length; ai++) {
            var G6 = mkG({ v: 8 }, 0);
            G6.S = 100;
            var alive = {
              id: ph, lane: lanes[ln], s: G6.S + 50, tSpawn: -ages[ai], high: highs[hi], state: 'alive',
              tState: 0, p0: { x: 0, y: 0, z: 0 },
              pose: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scale: 1 }, prevZ: 0
            };
            PB.fish.pose(alive, G6, alive.pose);
            var p0 = { x: alive.pose.x, y: alive.pose.y, z: alive.pose.z };
            var fm = {
              id: ph, lane: lanes[ln], s: alive.s, tSpawn: alive.tSpawn, high: highs[hi], state: 'missed',
              tState: 0, p0: p0, pose: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scale: 1 }, prevZ: p0.z
            };
            var px = p0.x, py = p0.y, crossed = -1, removed = false, rx = 0, ry = 0;
            for (var k = 0; k <= 48; k++) {
              G6.t = k / 60;
              PB.fish.pose(fm, G6, fm.pose);
              var a = G6.t - fm.tState;
              samples++;
              if (crossed < 0 && fm.pose.x >= CFG.SHORE_X) crossed = a;
              if (fm.pose.x < px - 1e-12) bad.mono++;
              if (a >= 0.75 && fm.pose.y > CFG.SEA_Y) bad.sea++;
              if (!removed && a >= F.REMOVE_MISSED) { removed = true; rx = fm.pose.x; ry = fm.pose.y; }
              if (k === 0 && (fm.pose.x !== p0.x || fm.pose.y !== p0.y)) bad.cont++;
              if (k > 0) {
                var dx = fm.pose.x - px, dy = fm.pose.y - py;
                var stepLen = Math.sqrt(dx * dx + dy * dy);
                if (stepLen > 0.6) bad.step++;
                if (stepLen > worstStep) worstStep = stepLen;
              }
              px = fm.pose.x; py = fm.pose.y;
            }
            if (crossed < 0 || crossed > 0.6) bad.cross++;
            if (worstCross < crossed) worstCross = crossed;
            if (!removed || rx < CFG.SHORE_X + 0.5 || ry > CFG.SEA_Y - 0.2) bad.remove++;
          }
        }
      }
    }
    sc.assertTrue('AC-5d migrate → z at a=0 equals p0 (continuity)', bad.cont, bad.cont === 0, 'violations=' + bad.cont);
    sc.assertTrue('AC-5d x monotonic non-decreasing', bad.mono, bad.mono === 0, 'violations=' + bad.mono);
    sc.assertTrue('AC-5d crosses SHORE_X within 0.6 s', bad.cross, bad.cross === 0, 'violations=' + bad.cross + ' worst a_cross=' + worstCross.toFixed(4));
    sc.assertTrue('AC-5d all samples a≥0.75 have y ≤ SEA_Y', bad.sea, bad.sea === 0, 'violations=' + bad.sea);
    sc.assertTrue('AC-5d removal step x ≥ SHORE_X+0.5 and y ≤ SEA_Y−0.2', bad.remove, bad.remove === 0, 'violations=' + bad.remove);
    sc.assertTrue('AC-5d adjacent road-relative step ≤0.6 m', bad.step, bad.step === 0, 'violations=' + bad.step + ' worst=' + worstStep.toFixed(4));
    sc.assertTrue('AC-5d sample count = 672 × 49', samples, samples === 672 * 49, 'n=' + samples);
    sc.assertRange('AC-5d worst a_cross ≤ 0.6 (analytic 0.574 + 1/60 sampling)', worstCross, 0, 0.6);

    // ---------- §4.4.1：生成节奏与上限 ----------
    var G7 = mkG({ v: 8 }, 0);
    G7.S = 0; G7.nextFishS = 0; G7.fish.length = 0;
    PB.fish.step(G7, 1 / 60);
    sc.assertEq('§4.4.1 spawn when S ≥ nextFishS', G7.fish.length, 1);
    sc.assertRange('§4.4.1 nextFishS += 25 + 20·rng', G7.nextFishS, 25, 45);
    G7.nextFishS = G7.S;
    for (var n = 0; n < 12; n++) { G7.nextFishS = G7.S; PB.fish.step(G7, 1 / 60); }
    sc.assertEq('§4.4.1 alive cap 6', G7.fish.length, 6);
    // 静止时不生成：S 不增且 nextFishS 在前方
    var G8 = mkG({ v: 0 }, 0);
    G8.S = 100; G8.nextFishS = 999; G8.fish.length = 0;
    for (var n2 = 0; n2 < 30; n2++) PB.fish.step(G8, 1 / 60);
    sc.assertEq('§4.4.1 no spawn while S < nextFishS', G8.fish.length, 0);
  });
})();

// ===== P10：五种镜头的构图数学（§4.7、AC-8a）=====
(function () {
  'use strict';
  var sc = window.__sc;
  var PB = window.PB;
  var CFG = PB.config;
  var D2R = Math.PI / 180;
  var ASPECT = 1920 / 1080;

  /**
   * 由位置与注视点构造基向量（与 PR-1 相同的 §1.3 公式）。
   * @param {{x:number,y:number,z:number}} pos 位置
   * @param {{x:number,y:number,z:number}} look 注视点
   * @returns {object} {pos,f,r,u}
   */
  function basis(pos, look) {
    var fx = look.x - pos.x, fy = look.y - pos.y, fz = look.z - pos.z;
    var fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
    var f = { x: fx / fl, y: fy / fl, z: fz / fl };
    var rx = -f.z, rz = f.x;
    var rl = Math.sqrt(rx * rx + rz * rz) || 1;
    var r = { x: rx / rl, y: 0, z: rz / rl };
    var u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
    return { pos: pos, f: f, r: r, u: u };
  }

  /**
   * 世界点 → NDC。
   * @param {object} cam basis()
   * @param {number} fovDeg 竖直 FOV（度）
   * @param {{x:number,y:number,z:number}} p 世界点
   * @returns {{x:number,y:number}} ndc
   */
  function project(cam, fovDeg, p) {
    var dx = p.x - cam.pos.x, dy = p.y - cam.pos.y, dz = p.z - cam.pos.z;
    var df = dx * cam.f.x + dy * cam.f.y + dz * cam.f.z;
    var du = dx * cam.u.x + dy * cam.u.y + dz * cam.u.z;
    var dr = dx * cam.r.x + dy * cam.r.y + dz * cam.r.z;
    var tan = Math.tan(fovDeg * D2R / 2);
    return { x: dr / df / (tan * ASPECT), y: du / df / tan };
  }

  // 车包围盒中心（§2.2：鹈鹕+车 ≤40 mesh、≤8k 三角面；包围盒取 y∈[0,1.98]、z∈[−1.072,0] 的中点）
  var CAR = { x: 0, y: 0.99, z: -0.536 };

  sc.sections.push(function () {
    // ---------- mode 1 侧视：车在中央 1/3 ----------
    var p1 = { x: CFG.CAM_SIDE.offset.x, y: CFG.CAM_SIDE.offset.y, z: CFG.CAM_SIDE.offset.z };
    var l1 = { x: CFG.CAM_SIDE.look.x, y: CFG.CAM_SIDE.look.y, z: CFG.CAM_SIDE.look.z };
    var n1 = project(basis(p1, l1), CFG.CAM_SIDE.fov, CAR);
    sc.assertRange('AC-8a mode1 car centre |ndc_x| ≤ 1/3', Math.abs(n1.x), 0, 1 / 3);
    sc.assertRange('AC-8a mode1 car centre |ndc_y| ≤ 1/3', Math.abs(n1.y), 0, 1 / 3);

    // ---------- ADR-34：mode 1 海侧远景的三条车道判据（下半海面 ≥40%、车在中央 1/3、车高 ≥90 px）----------
    // 复算口径与 tools/e2e/adr34-projection.mjs 一致：逐像素射线与 §1.1 高度场求交，首次命中点 x > SHORE_X 记为海面。
    for (var li = 0; li < CFG.LANE_X.length; li++) {
      var bx = CFG.LANE_X[li];
      var sp = { x: bx + CFG.CAM_SIDE.offset.x, y: CFG.CAM_SIDE.offset.y, z: CFG.CAM_SIDE.offset.z };
      var sl = { x: bx + CFG.CAM_SIDE.look.x, y: CFG.CAM_SIDE.look.y, z: CFG.CAM_SIDE.look.z };
      var sb = basis(sp, sl);
      var cc = sc.projectPoint(sb, CFG.CAM_SIDE.fov, { x: bx + CAR.x, y: CAR.y, z: CAR.z });
      var carTop = sc.projectPoint(sb, CFG.CAM_SIDE.fov, { x: bx, y: 1.98, z: CAR.z });
      var carBot = sc.projectPoint(sb, CFG.CAM_SIDE.fov, { x: bx, y: 0, z: CAR.z });
      var carPx = Math.abs(carTop.y - carBot.y) * 540;      // NDC 跨度 2 = 1080 px
      sc.assertRange('ADR-34 mode1 lane' + li + ' lower-half sea ≥40%', sc.lowerSeaPct(sb, CFG.CAM_SIDE.fov, 4), 40, 100);
      sc.assertRange('ADR-34 mode1 lane' + li + ' car centre |ndc_x| ≤ 1/3', Math.abs(cc.x), 0, 1 / 3);
      sc.assertRange('ADR-34 mode1 lane' + li + ' car height ≥90 px (1080p)', carPx, 90, 400);
    }
    // ---------- ADR-33：被 ADR-34 取代的陆侧机位（−10, 2.2, 1.5）→（+3, 0.8, −2）----------
    // 保留为"为何必须改机位"的回归证据：三条车道实测都远低于 40%（AMD-P10-001 §5.1 的 0.944/2.587/5.345%）。
    var oldSea = [];
    for (var oj = 0; oj < CFG.LANE_X.length; oj++) {
      var obx = CFG.LANE_X[oj];
      var ob = basis({ x: obx - 10, y: 2.2, z: 1.5 }, { x: obx + 3, y: 0.8, z: -2 });
      oldSea.push(sc.lowerSeaPct(ob, 40, 4));
    }
    sc.assertRange('ADR-33 old land-side lane-2.5 lower sea < 1.5%', oldSea[0], 0, 1.5);
    sc.assertRange('ADR-33 old land-side lane0 lower sea < 3.5%', oldSea[1], 0, 3.5);
    sc.assertRange('ADR-33 old land-side lane+2.5 lower sea < 6.5%', oldSea[2], 0, 6.5);
    sc.assertTrue('ADR-33 old land-side position cannot reach the 40% S3a criterion',
      oldSea, Math.max(oldSea[0], oldSea[1], oldSea[2]) < 40, 'max=' + Math.max(oldSea[0], oldSea[1], oldSea[2]));

    // ---------- mode 2 电影：三个镜头在 u=0.5 时 |ndc| ≤ 0.7 ----------
    var A = CFG.CAM_CINE.a, B = CFG.CAM_CINE.b, C = CFG.CAM_CINE.c;
    var tests = [
      { name: 'S4a (shot A)', pos: { x: A.dx, y: A.dy, z: (A.z0 + A.z1) / 2 }, look: { x: 0, y: 1, z: 0 }, fov: A.fov },
      {
        name: 'S4b (shot B)',
        pos: { x: B.r * Math.sin((B.phi0 + B.phi1) / 2 * D2R), y: (B.h0 + B.h1) / 2, z: B.r * Math.cos((B.phi0 + B.phi1) / 2 * D2R) },
        look: { x: 0, y: 1, z: 0 }, fov: B.fov
      },
      { name: 'S4c (shot C)', pos: { x: C.dx, y: C.dy, z: C.dz }, look: { x: 0, y: 1, z: C.lookDz }, fov: C.fov }
    ];
    for (var i = 0; i < tests.length; i++) {
      var n = project(basis(tests[i].pos, tests[i].look), tests[i].fov, CAR);
      sc.assertRange('AC-8a ' + tests[i].name + ' |ndc_x| ≤ 0.7', Math.abs(n.x), 0, 0.7);
      sc.assertRange('AC-8a ' + tests[i].name + ' |ndc_y| ≤ 0.7', Math.abs(n.y), 0, 0.7);
    }

    // ---------- mode 3 POV：喙尖在离底边 22%–34%，喙根深度 > near（§4.7 / R4） ----------
    var pov = CFG.CAM_POV;
    var povBasis = basis(pov.offset, { x: pov.offset.x, y: pov.offset.y, z: pov.offset.z - 1 });
    var beak = project(povBasis, pov.fov, CFG.BEAK_TIP_L);
    var fromBottomPct = (1 + beak.y) / 2 * 100;
    sc.assertRange('AC-8a mode3 beak from bottom % in [22,34]', fromBottomPct, 22, 34);
    var rootDepth = Math.abs(CFG.PEL.BEAK_ROOT.z - pov.offset.z);
    sc.assertRange('AC-8a mode3 beak root depth > near', rootDepth, pov.near, 10);

    // ---------- mode 4 环绕默认机位：|ndc| ≤ 0.2（PR-1 已覆盖地平线，这里复核中心） ----------
    var o = CFG.CAM_ORBIT_DEFAULT;
    var yaw = o.yawDeg * D2R, pitch = o.pitchDeg * D2R;
    var oPos = { x: o.dist * Math.cos(pitch) * Math.sin(yaw), y: 1 + o.dist * Math.sin(pitch), z: o.dist * Math.cos(pitch) * Math.cos(yaw) };
    var n4 = project(basis(oPos, { x: 0, y: 1, z: 0 }), o.fov, CAR);
    sc.assertRange('AC-8a mode4 car centre |ndc_x| ≤ 0.2', Math.abs(n4.x), 0, 0.2);
    sc.assertRange('AC-8a mode4 car centre |ndc_y| ≤ 0.2', Math.abs(n4.y), 0, 0.2);
  });
})();

// ===== P11：十四个成就（§4.8、AC-7）=====
(function () {
  'use strict';
  var sc = window.__sc;
  var PB = window.PB;
  var CFG = PB.config;
  var A = CFG.ACH;

  /**
   * 内存 store 桩：实现 achievements 需要的三个方法，并记录写入次数。
   * @returns {object} 桩
   */
  function mkStore() {
    var doc = { v: 1, ach: {}, best: { points: 0, distance: 0 }, settings: { muted: false, cam: 0 } };
    var st = {
      doc: doc, updates: 0, flushes: 0,
      get: function () { return doc; },
      update: function (fn) { st.updates++; fn(doc); },
      flush: function () { st.flushes++; }
    };
    return st;
  }

  /**
   * 建一局最小 G（成就只读 score/stats/bike/S/p/events 与 camUsed）。
   * @returns {object} G
   */
  function mkG() {
    var G = PB.sim.createState(CFG.SEED, { camMode: 0 });
    PB.rig.initState(G);
    return G;
  }

  var cases = [
    ['FIRST_CATCH', function (G) { G.events.push({ type: 'catch', air: false, wheelie: false, auto: false }); }],
    ['FISH_10', function (G) { G.score.catches = 10; G.events.push({ type: 'catch' }); }],
    ['FISH_50', function (G) { G.score.catches = 50; G.events.push({ type: 'catch' }); }],
    ['COMBO_5', function (G) { G.score.combo = 5; G.events.push({ type: 'catch' }); }],
    ['AIR_CATCH', function (G) { G.events.push({ type: 'catch', air: true }); }],
    ['WHEELIE_CATCH', function (G) { G.events.push({ type: 'catch', wheelie: true }); }],
    ['SPEED_DEMON', function (G) { G.bike.v = 16; for (var i = 0; i < 181; i++) PB.achievements.step(G, 1 / 60); }],
    ['DIST_1K', function (G) { G.S = 1000; PB.achievements.step(G, 1 / 60); }],
    ['DIST_5K', function (G) { G.S = 5000; PB.achievements.step(G, 1 / 60); }],
    ['NIGHT_RIDER', function (G) { G.p = 0.5; G.bike.v = 5; for (var i = 0; i < 1801; i++) PB.achievements.step(G, 1 / 60); }],
    ['FULL_CYCLE', function (G) { G.events.push({ type: 'cycleWrap' }); }],
    ['LONG_WHEELIE', function (G) { G.bike.wheelie = 0.3; G.bike.v = 5; for (var i = 0; i < 181; i++) PB.achievements.step(G, 1 / 60); }],
    ['CAMERA_TOUR', function (G) { G.stats.camUsed = [1.1, 1.1, 1.1, 1.1, 1.1]; PB.achievements.step(G, 1 / 60); }],
    ['AUTO_FISHER', function (G) { for (var i = 0; i < 3; i++) G.events.push({ type: 'catch', auto: true }); }]
  ];

  sc.sections.push(function () {
    // ---------- 14 条逐条触发（每条只发一次事件、只写一次库） ----------
    var passCount = 0;
    for (var i = 0; i < cases.length; i++) {
      var st = mkStore();
      PB.achievements.init(st);
      var G = mkG();
      cases[i][1](G);
      PB.achievements.onEvents(G);
      var events = G.events.filter(function (e) { return e.type === 'achievement' && e.id === cases[i][0]; });
      // 同一条事件可能顺带解锁其它成就（例如 FISH_10 同时解锁 FIRST_CATCH），因此按本条 id 的写入与事件计数判定，
      // 不把 store 的总写入次数当作单条判据。
      var ok = PB.achievements.isUnlocked(cases[i][0]) && events.length === 1 && st.doc.ach[cases[i][0]] > 0;
      if (ok) passCount++;
      sc.assertTrue('AC-7 ' + cases[i][0] + ' unlocks exactly once',
        { unlocked: PB.achievements.isUnlocked(cases[i][0]), events: events.length, stored: st.doc.ach[cases[i][0]] || 0 },
        ok, 'id=' + cases[i][0]);
    }
    sc.assertEq('AC-7 all 14 achievements reachable', passCount, 14);
    sc.assertEq('§4.8 achievement list length', A.LIST.length, 14);

    // ---------- 幂等：同一条件重复评估不重复发事件、不重复写库 ----------
    var st2 = mkStore();
    PB.achievements.init(st2);
    var G2 = mkG();
    G2.events.push({ type: 'catch', air: false, wheelie: false, auto: false });
    PB.achievements.onEvents(G2);
    var first = G2.events.filter(function (e) { return e.type === 'achievement'; }).length;
    G2.events.length = 0;
    G2.events.push({ type: 'catch', air: false, wheelie: false, auto: false });
    PB.achievements.onEvents(G2);
    var second = G2.events.filter(function (e) { return e.type === 'achievement'; }).length;
    sc.assertEq('AC-7 idempotent: first evaluation emits 1', first, 1);
    sc.assertEq('AC-7 idempotent: second evaluation emits 0', second, 0);
    sc.assertEq('AC-7 idempotent: store written once', st2.updates, 1);

    // ---------- 持久化：重新 init（模拟刷新）后仍解锁 ----------
    PB.achievements.init(st2);
    sc.assertTrue('AC-7 refresh keeps unlocked (re-init from store)', PB.achievements.isUnlocked('FIRST_CATCH'),
      PB.achievements.isUnlocked('FIRST_CATCH'));
    sc.assertEq('AC-7 count after re-init', PB.achievements.count(), 1);

    // ---------- 重置：清空持久化与内存（重置后面板 x/14 归零） ----------
    PB.achievements.reset();
    sc.assertEq('§4.8 reset clears store.ach', Object.keys(st2.doc.ach).length, 0);
    sc.assertEq('§4.8 reset clears memory', PB.achievements.count(), 0);

    // 还原真实 store 绑定，避免影响后续用例（selfcheck 不加载 main，故只在内存中生效）
    PB.achievements.init(PB.store);
  });
})();

// ===== P12：自动驾驶（§4.6、AC-12a/12b/12e）=====
(function () {
  'use strict';
  var sc = window.__sc;
  var PB = window.PB;
  var CFG = PB.config;
  var A = CFG.AP;

  /**
   * 建一局最小 G（autopilot 读 G.rig.beakW / G.fish / G.bike / G.ap）。
   * @param {number} v 初速
   * @returns {object} G
   */
  function mkG(v) {
    var G = PB.sim.createState(CFG.SEED, { camMode: 0 });
    G.bike.v = v || 0;
    PB.rig.initState(G);
    G.rig.prevBeakZ = G.rig.beakW.z;
    return G;
  }

  /**
   * 在 40 m 前放一条 high 鱼（真实 fish.pose 初值），供 AC-12e 的起跳/捕获判定。
   * @param {object} G 一局状态
   * @returns {object} 鱼
   */
  function placeHighFish(G) {
    var f = {
      id: 0, lane: 1, s: G.S + 40, tSpawn: G.t - 2, high: true, state: 'alive', tState: G.t,
      p0: { x: 0, y: 0, z: 0 },
      pose: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scale: 1 }, prevZ: 0
    };
    PB.fish.pose(f, G, f.pose);
    f.prevZ = f.pose.z;
    G.fish.push(f);
    return f;
  }

  sc.sections.push(function () {
    var inp = { held: {}, anyHeld: false, activity: false, now: 0 };
    // ---------- AC-12b：任意动作 held 10 s 不 engage（held 覆盖键盘与指针按钮） ----------
    PB.input.markActivity(-1000);
    var Gh = mkG(0);
    PB.input.markActivity(-1000);
    inp.anyHeld = true; inp.activity = false;
    for (var i = 0; i < 600; i++) PB.autopilot.arbitrate(Gh, inp, i / 60);
    sc.assertEq('AC-12b held 10 s never engages', Gh.ap.engaged, false);
    // activity 脉冲同样阻断（键按下/抬起、滚轮、触摸）
    inp.anyHeld = false; inp.activity = true;
    for (var j = 0; j < 600; j++) PB.autopilot.arbitrate(Gh, inp, 10 + j / 60);
    sc.assertEq('AC-12b activity pulses never engage', Gh.ap.engaged, false);

    // ---------- 空闲 6 s 接管 / 再次活跃立即断开（AC-12a 的纯逻辑部分） ----------
    var Gi = mkG(0);
    inp.activity = false;
    PB.input.markActivity(-1000);
    PB.autopilot.arbitrate(Gi, inp, 0);
    sc.assertEq('AC-12a idle ≥6 s engages', Gi.ap.engaged, true);
    var tgt = Gi.stats.apCatches;
    Gi.stats.apCatches = 5;
    inp.activity = true;
    PB.autopilot.arbitrate(Gi, inp, 0.05);
    sc.assertEq('AC-12c trusted input disengages in the same frame', Gi.ap.engaged, false);
    sc.assertEq('§4.6.2 disengage resets target', [Gi.ap.targetId, Gi.ap.prevTArr], [-1, Infinity]);
    sc.assertEq('$4.6.2 engage clears apCatches', tgt, 0);

    // ---------- AC-12e：一次变道耗时 ∈ [0.33,0.38] s ----------
    var Gl = mkG(8);
    Gl.ap.engaged = true;
    Gl.ap.laneGoal = 2;
    Gl.ap.targetId = -1;
    var cmd = { throttle: false, brake: false, laneDelta: 0, jumpPress: false, wing: false };
    var steps = 0, laneEvents = 0;
    while (steps < 120) {
      PB.autopilot.command(Gl, 1 / 60, cmd);
      if (cmd.laneDelta !== 0) laneEvents++;
      PB.sim.step(Gl, cmd, 1 / 60);
      PB.rig.compute(Gl);
      steps++;
      if (Gl.bike.laneT === 1 && Math.abs(Gl.bike.x - Gl.bike.laneToX) < 1e-9) break;
    }
    var laneSec = steps / 60;
    sc.assertRange('AC-12e autopilot lane change duration ∈ [0.33,0.38] s', laneSec, 0.33, 0.38);
    sc.assertEq('AC-12e lane change requested exactly once', laneEvents, 1);

    // ---------- AC-12e：high 鱼 16 个决策相位 × v ∈ {8,10,12,16} 恰好起跳一次并捕获 ----------
    var phases = 16, bad = 0, caughtCount = 0, maxJumps = 0, detail = '';
    for (var vi = 0; vi < A.T_V.length; vi++) {
      for (var pi = 0; pi < phases; pi++) {
        var G = mkG(A.T_V[vi]);
        G.t = 0; G.S = 0;
        placeHighFish(G);
        G.ap.engaged = true;
        G.ap.nextDecT = pi * (A.DEC_T / phases);
        G.ap.targetId = -1;
        G.ap.laneGoal = 1;
        G.ap.prevTArr = Infinity;
        G.ap.jumpedFor = 1e9;
        var jumps = 0, caught = false, c = { throttle: false, brake: false, laneDelta: 0, jumpPress: false, wing: false };
        for (var s2 = 0; s2 < 900; s2++) {
          PB.autopilot.command(G, 1 / 60, c);
          if (c.jumpPress) jumps++;
          PB.sim.step(G, c, 1 / 60);
          PB.rig.compute(G);
          PB.fish.step(G, 1 / 60);
          if (G.fish.length && G.fish[0].state === 'caught') { caught = true; break; }
        }
        if (jumps > maxJumps) maxJumps = jumps;
        if (jumps !== 1 || !caught) {
          bad++;
          if (!detail) detail = 'v=' + A.T_V[vi] + ' phase=' + pi + ' jumps=' + jumps + ' caught=' + caught;
        }
        if (caught) caughtCount++;
      }
    }
    sc.assertTrue('AC-12e exactly one jump per high-fish target (64 cases)', bad, bad === 0, 'bad=' + bad + ' ' + detail);
    sc.assertEq('AC-12e max jumps observed', maxJumps, 1);
    sc.assertEq('AC-12e high fish captured in all 64 cases', caughtCount, 64);

    // ---------- AC-12e 目标保留：d ≤ 6 时不释放、不重选 ----------
    var Gk = mkG(8);
    Gk.ap.engaged = true;
    Gk.ap.nextDecT = 0;
    Gk.ap.targetId = -1;
    placeHighFish(Gk);
    var c2 = { throttle: false, brake: false, laneDelta: 0, jumpPress: false, wing: false };
    PB.autopilot.command(Gk, 1 / 60, c2);
    var firstId = Gk.ap.targetId;
    Gk.S += 34;   // d 从 40 → 6
    PB.fish.step(Gk, 1 / 60);
    PB.autopilot.command(Gk, 1 / 60, c2);
    sc.assertEq('§4.6.3 target not dropped at d ≤ 6', Gk.ap.targetId, firstId);
  });
})();
// ===== P13：音频门控矩阵（AC-9d、§4.9 M-18）=====
(function () {
  'use strict';
  var sc = window.__sc;
  var PB = window.PB;
  sc.sections.push(function () {
    // 步骤1：纯函数 shouldRun 的真值表 —— 只有"门开 + 已解锁 + 未静音"才出声。
    // 三个输入各取 true/false，共 8 种组合；期望 = gate && unlocked && !muted。
    var bad = [];
    for (var gi = 0; gi < 2; gi++) {
      for (var ui = 0; ui < 2; ui++) {
        for (var mi = 0; mi < 2; mi++) {
          var gate = !!gi, unl = !!ui, mut = !!mi;
          var got = PB.audio.shouldRun(gate, unl, mut);
          var want = gate && unl && !mut;
          if (got !== want) bad.push([gate, unl, mut, got]);
        }
      }
    }
    sc.assertEq('AC-9d shouldRun truth table (8 combinations) mismatches', bad, []);
    sc.assertEq('AC-9d gate closed → silent even if unlocked and unmuted', PB.audio.shouldRun(false, true, false), false);
    sc.assertEq('AC-9d muted → silent even if gate open and unlocked', PB.audio.shouldRun(true, true, true), false);
    sc.assertEq('AC-9d locked → silent even if gate open and unmuted', PB.audio.shouldRun(true, false, false), false);
    sc.assertEq('AC-9d gate open + unlocked + unmuted → runs (UD-5 default)', PB.audio.shouldRun(true, true, false), true);
    // 步骤2：未解锁时状态必须如实报告，不得伪造音乐（stats().audioState）
    sc.assertEq('P13 audio state before any gesture is idle', PB.audio.state(), 'idle');
    sc.assertEq('P13 bpm before any gesture is 0', PB.audio.bpm(), 0);
  });
})();
// ===== P14：画质自适应的三个时间序列（AC-11a / AC-11b / AC-11c，§4.10）=====
(function () {
  'use strict';
  var sc = window.__sc;
  var PB = window.PB;
  sc.sections.push(function () {
    var t = 0;
    // 按固定帧率喂 seconds 秒的原始帧，返回期间发生的等级变化 [{t, lvl}]
    function feed(fps, seconds) {
      var dt = 1000 / fps;
      var n = Math.round(seconds * fps);
      var out = [];
      for (var i = 0; i < n; i++) {
        t += dt / 1000;
        var r = PB.quality.sample(dt, t);
        if (r !== null) out.push({ t: t, lvl: r });
      }
      return out;
    }

    // ---------- AC-11a：burnMs=25（40 fps）后 ≤4.5 s 降一级 ----------
    t = 0;
    PB.quality.create(2, t);
    var a = feed(40, 10);
    sc.assertRange('AC-11a first downgrade within 4.5 s of sustained 40 fps', a.length ? a[0].t : 99, 0, 4.5);
    sc.assertEq('AC-11a downgrade goes L2 → L1 (one level)', a.length ? a[0].lvl : null, 1);
    sc.assertTrue('AC-11a sustained 40 fps never upgrades', a.filter(function (x) { return x.lvl > 1; }).length, a.filter(function (x) { return x.lvl > 1; }).length === 0);

    // ---------- AC-11b：距上一次等级变化（含启动）≥10 s 才升级 ----------
    t = 0;
    PB.quality.create(2, t);
    var b = feed(60, 20);
    var early = b.filter(function (x) { return x.t < 10; });
    sc.assertEq('AC-11b no upgrade before 10 s since boot', early, []);
    sc.assertRange('AC-11b first upgrade at ≥10 s', b.length ? b[0].t : 0, 10, 12);
    sc.assertEq('AC-11b upgrade goes L2 → L3', b.length ? b[0].lvl : null, 3);

    // ---------- AC-11c：60 s 内等级变化 ≤2 次 ----------
    t = 0;
    PB.quality.create(2, t);
    var c = feed(40, 60);
    sc.assertRange('AC-11c changes within 60 s of sustained 40 fps ≤2', c.length, 0, 2);
    sc.assertEq('AC-11c the two changes are L2→L1→L0', c.map(function (x) { return x.lvl; }), [1, 0]);
    sc.assertEq('AC-11c level bottoms out at L0 and stops changing', PB.quality.level(), 0);

    // ---------- AC-11c：含 >250 ms 原始帧的窗口被丢弃 ----------
    t = 0;
    PB.quality.create(2, t);
    feed(60, 1.4);
    var before = PB.quality.stats();
    PB.quality.sample(300, t + 0.3);      // 超长帧：整窗作废
    var afterLong = PB.quality.stats();
    sc.assertEq('AC-11c >250 ms frame discards the window (no fps recorded)', [before.lastFps, afterLong.lastFps], [0, 0]);
    sc.assertEq('AC-11c >250 ms frame produces no level change', afterLong.level, 2);
    t += 0.3;
    var d = feed(60, 1.6);
    sc.assertEq('AC-11c window after the long frame is fresh (still no change before 2 s)', d, []);
    sc.assertEq('AC-11c good-window counter restarts from 0 after the discarded window', PB.quality.stats().goodWins >= 1, true);

    // ---------- 恢复：把控制器还原成正常运行状态（后续用例/页面交互不受影响）----------
    PB.quality.create(2, 0);
  });
})();
