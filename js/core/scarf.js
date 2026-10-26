// TASK-002 P6: 围巾 Verlet 带状网格（plan.md §4.1、AC-2a/2b/2c/2d、ADR-07）。
// 2 列 × 13 行 = 26 粒子；第 0 行固定在 G.rig.anchorW（§1.5 的两个锚点），
// 其余粒子在"跑步机视图坐标"下积分（纵向惯性加虚拟加速度 (0,0,+a)）。
// 测量量（tip/anchorMid/angleDeg/lagX）由本模块写进 G.scarf，selfcheck 与 stats() 都读同一份。
(function (PB) {
  'use strict';
  var CFG = PB.config, SC = CFG.SCARF, M = PB.mathx, PEL = CFG.PEL;
  var S = PB.scarf = {};
  var ROWS = SC.ROWS, COLS = SC.COLS, PARTICLES = ROWS * COLS;
  var SUB_H = CFG.H / SC.SUBSTEPS;          // 子步 h_s = 1/240
  // 躯干椭球的 Rx=+25° 的三角函数：碰撞与 outsideMinF 每个粒子都要用，模块加载时算一次
  var _crx = Math.cos(PEL.TORSO_RX), _srx = Math.sin(PEL.TORSO_RX);

  /**
   * 粒子索引：行优先（row*COLS + col），每个粒子 3 个分量。
   * @param {number} r 行
   * @param {number} c 列
   * @returns {number} 数组下标
   */
  function ix(r, c) { return (r * COLS + c) * 3; }

  // 约束表（结构 / 剪切 / 弯曲 / 宽度），刚度 1；模块加载时建一次，不随会话变化
  var CONS = (function () {
    var list = [];
    var r, c;
    var width = Math.abs(CFG.RIG.ANCHOR_L[1].x - CFG.RIG.ANCHOR_L[0].x);   // 0.12
    var diag = Math.sqrt(SC.ROW_SPACING * SC.ROW_SPACING + width * width);
    for (r = 0; r < ROWS - 1; r++) {
      for (c = 0; c < COLS; c++) list.push(ix(r, c), ix(r + 1, c), SC.ROW_SPACING);   // 结构
      list.push(ix(r, 0), ix(r + 1, 1), diag);                                          // 剪切（两向对角）
      list.push(ix(r, 1), ix(r + 1, 0), diag);
    }
    for (r = 0; r < ROWS - 2; r++) {
      for (c = 0; c < COLS; c++) list.push(ix(r, c), ix(r + 2, c), SC.ROW_SPACING * 2); // 弯曲（隔一行）
    }
    for (r = 0; r < ROWS; r++) list.push(ix(r, 0), ix(r, 1), width);                    // 宽度（结构）
    return list;
  })();

  // lagX 的基线（§4.1："该段运动前 1 s 的 lagX 均值"）：只把锚点横向静止时的样本写进窗口，
  // 因此变道期间基线冻结在"运动前 1 s"的值，变道结束后 lagX 会随尾端归位自然回到 0（AC-2b 的第二条）。
  var LAG_N = 60;
  var lagRing = new Float64Array(LAG_N);
  var lagHead = 0, lagFilled = 0, lagSum = 0, lagBase = 0;
  var anchorPrevX = 0, anchorPrevValid = false;
  var ANCHOR_MOVE_EPS = 0.12;      // 锚点横向速度阈值（m/s）：低于它视为"静止"，样本可入窗口

  // M-31：稳态帧不新建对象
  var _n = { x: 0, y: 0, z: 0 };
  var _w = { x: 0, y: 0, z: 0 };
  var _vel = { x: 0, y: 0, z: 0 };
  var _acc = { x: 0, y: 0, z: 0 };
  var _tmp = { x: 0, y: 0, z: 0 };
  // 碰撞用的世界/局部坐标暂存（M-31：稳态帧不新建对象）
  var _wp = { x: 0, y: 0, z: 0 };
  var _lp = { x: 0, y: 0, z: 0 };
  var wind = { x: 0, y: 0, z: 0 };

  /**
   * 把粒子放到静止形态（ADR-29）：第 r 行第 c 列粒子 P = anchorW[c] + r·0.055·d，
   * 其中 d = RESET_DIR = (0,−cos20°,+sin20°)（从竖直向下朝 +Z 偏 20°，跑步机视图坐标）。
   * 随后做一次碰撞投影（约束 + 碰撞体外推，不做积分），再令 Q = P。
   *
   * @param {object} G 一局状态（需要 G.rig.anchorW 与 G.scarf）
   * @returns {void}
   */
  S.reset = function (G) {
    var P = G.scarf.P, Q = G.scarf.Q;
    var a0 = G.rig.anchorW[0], a1 = G.rig.anchorW[1];
    var d = SC.RESET_DIR;
    var dy = d[1] * SC.ROW_SPACING, dz = d[2] * SC.ROW_SPACING;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var base = c === 0 ? a0 : a1;
        var i = ix(r, c);
        P[i] = base.x; P[i + 1] = base.y + dy * r; P[i + 2] = base.z + dz * r;
        Q[i] = P[i]; Q[i + 1] = P[i + 1]; Q[i + 2] = P[i + 2];
      }
    }
    // 复位姿态必须不穿碰撞体：直条从锚点垂下会进入躯干椭球（§1.5，ADR-23）。
    // 按 ADR-29 的原文执行"一次碰撞投影"：对全部粒子各做一次最近点外推（不做积分、不做约束松弛），
    // 然后令 Q = P。只做一次而不是迭代到收敛，是因为原文写的是"一次"；两种读法的读数差异
    // 记录在 impl-notes 的 Q-13（收敛松弛会把飘带放到另一个吸引子，AC-2b 读数随之不同）。
    collide(P, G);
    pinAnchors(G);
    for (var i2 = 0; i2 < PARTICLES * 3; i2++) Q[i2] = P[i2];
    lagHead = 0; lagFilled = 0; lagSum = 0; lagBase = 0;
    anchorPrevValid = false;
    G.scarf.lagX = 0;
    measure(G, true);
    G.scarf.outsideMinF = outsideMinF(G);
  };

  /**
   * 风场（§4.1）：s_w = 0.25 + 0.75·min(1, v/6)；
   * wRel = (s_w·(1.2 sin0.7t + 0.6 n1), 0.3·s_w·n2, v + 1.5·s_w·gust)，gust ∈ [0,1]。
   *
   * @param {number} t 模拟时间（秒）
   * @param {number} v 车速（m/s）
   * @returns {{x:number,y:number,z:number}} 复用对象 wind
   */
  function windAt(t, v) {
    var sw = 0.25 + 0.75 * Math.min(1, v / 6);
    var gust = 0.5 + 0.5 * Math.sin(0.37 * t) * Math.sin(1.13 * t);
    wind.x = sw * (1.2 * Math.sin(0.7 * t) + 0.6 * M.noise1(t, SC.NOISE_SEED_A));
    wind.y = 0.3 * sw * M.noise1(t, SC.NOISE_SEED_B);
    wind.z = v + SC.WIND_GUST_Z * sw * gust;
    return wind;
  }

  /**
   * 把第 0 行重新钉到锚点（每个子步末尾调用；锚点是唯一的位置来源，M-25）。
   * @param {object} G 一局状态
   * @returns {void}
   */
  function pinAnchors(G) {
    var P = G.scarf.P, Q = G.scarf.Q, a0 = G.rig.anchorW[0], a1 = G.rig.anchorW[1];
    P[0] = a0.x; P[1] = a0.y; P[2] = a0.z;
    P[3] = a1.x; P[4] = a1.y; P[5] = a1.z;
    // 钉住的粒子速度为 0：Q 同步到 P，否则高速下车速带来的锚点位移会让 |P−Q| 越过 0.2（§4.1 健康判据）
    Q[0] = P[0]; Q[1] = P[1]; Q[2] = P[2];
    Q[3] = P[3]; Q[4] = P[4]; Q[5] = P[5];
  }

  /**
   * 一条距离约束（位置投影，刚度 1；第 0 行视为无限质量）。
   * @param {Float64Array} P 位置数组
   * @param {number} i0 端点 0 下标
   * @param {number} i1 端点 1 下标
   * @param {number} rest 静止长度
   * @returns {void}
   */
  function satisfy(P, i0, i1, rest) {
    var dx = P[i1] - P[i0], dy = P[i1 + 1] - P[i0 + 1], dz = P[i1 + 2] - P[i0 + 2];
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-9) return;
    var k = (d - rest) / d;
    var pin0 = i0 < COLS * 3;            // 行 0 的两个粒子
    var pin1 = i1 < COLS * 3;
    if (pin0 && pin1) return;
    if (pin0) {
      P[i1] -= dx * k; P[i1 + 1] -= dy * k; P[i1 + 2] -= dz * k;
    } else if (pin1) {
      P[i0] += dx * k; P[i0 + 1] += dy * k; P[i0 + 2] += dz * k;
    } else {
      var h = k * 0.5;
      P[i0] += dx * h; P[i0 + 1] += dy * h; P[i0 + 2] += dz * h;
      P[i1] -= dx * h; P[i1 + 1] -= dy * h; P[i1 + 2] -= dz * h;
    }
  }

  /**
   * 碰撞体外推（§1.5 的碰撞体，ADR-23）：躯干是与渲染躯干同参数的椭球（半轴加 ε=0.005），
   * 颈仍是球 r=0.07。椭球判定在 rig 局部坐标做（rig.toLocal），因此 lean/wheelie/x/y 都自动生效，
   * 与渲染用同一份 G.rig.M（M-25：不出现第二个变换来源）。
   *
   * 投影方式：先在局部系把点沿"局部径向"缩到椭球面上（f = 1 的等值面），再变换回世界。
   * 局部径向不是椭球的法向，但对外扩了 ε 的椭球是稳定且单调的投影（每次迭代都把 f 拉回 ≥1）。
   * 第 0 行是固定点，不参与投影。
   *
   * @param {Float64Array} P 位置数组（世界坐标）
   * @param {object} G 一局状态（读 G.rig.M / G.rig.neckW）
   * @returns {void}
   */
  function collide(P, G) {
    var rx = PEL.TORSO_R.x + SC.TORSO_EPS;
    var ry = PEL.TORSO_R.y + SC.TORSO_EPS;
    var rz = PEL.TORSO_R.z + SC.TORSO_EPS;
    var i, lx, ly, lz, f, k;
    for (i = COLS * 3; i < PARTICLES * 3; i += 3) {
      _wp.x = P[i]; _wp.y = P[i + 1]; _wp.z = P[i + 2];
      PB.rig.toLocal(G, _wp, _lp);
      // 步骤1：把点转到躯干椭球的规范坐标（先去掉中心平移，再逆 Rx(+25°)）
      lx = _lp.x - PEL.TORSO.x;
      var cy = _lp.y - PEL.TORSO.y, cz = _lp.z - PEL.TORSO.z;
      var ly0 = cy * _crx + cz * _srx;
      var lz0 = -cy * _srx + cz * _crx;
      // 步骤2：判据值 f = Σ(x/半轴)²；f ≥ 1 即在体外（含表面），不动
      f = (lx / rx) * (lx / rx) + (ly0 / ry) * (ly0 / ry) + (lz0 / rz) * (lz0 / rz);
      if (f < 1) {
        // 步骤3：求椭球上的最近点（精确解）。对 e(t) = Σ aᵢ²vᵢ²/(aᵢ²+t)² − 1 做二分，
        // 解出的 t 给出最近点 (aᵢ²vᵢ/(aᵢ²+t))；最近点位移最小，因此不会像"沿径向缩放"那样把
        // 深埋的粒子瞬移到椭球另一侧（那会让结构链突然拉长 0.18 m，见 impl-notes Q-13）。
        var r2x = rx * rx, r2y = ry * ry, r2z = rz * rz;
        var tlo = -Math.min(r2x, r2y, r2z) * (1 - 1e-9), thi = 0, tt, i80;
        for (i80 = 0; i80 < 80; i80++) {
          tt = 0.5 * (tlo + thi);
          var ee = r2x * lx * lx / ((r2x + tt) * (r2x + tt)) +
                   r2y * ly0 * ly0 / ((r2y + tt) * (r2y + tt)) +
                   r2z * lz0 * lz0 / ((r2z + tt) * (r2z + tt)) - 1;
          if (ee > 0) tlo = tt; else thi = tt;
        }
        tt = 0.5 * (tlo + thi);
        _lp.x = PEL.TORSO.x + r2x * lx / (r2x + tt);
        var ny = r2y * ly0 / (r2y + tt), nz = r2z * lz0 / (r2z + tt);
        _lp.y = PEL.TORSO.y + ny * _crx - nz * _srx;
        _lp.z = PEL.TORSO.z + ny * _srx + nz * _crx;
        PB.rig.toWorld(G, _lp, _wp);
        P[i] = _wp.x; P[i + 1] = _wp.y; P[i + 2] = _wp.z;
      }
    }
    // 颈球（§1.5）：与躯干椭球分开判定，球心取 G.rig.neckW（同一份 rig 变换）
    var c = G.rig.neckW, r = PEL.NECK_BALL.r;
    for (i = COLS * 3; i < PARTICLES * 3; i += 3) {
      var dx = P[i] - c.x, dy = P[i + 1] - c.y, dz = P[i + 2] - c.z;
      var d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r * r) {
        var d = Math.sqrt(d2) || 1e-9;
        var s = r / d;
        P[i] = c.x + dx * s; P[i + 1] = c.y + dy * s; P[i + 2] = c.z + dz * s;
      }
    }
  }

  /**
   * 第 1–12 行全部粒子在外扩椭球中的最小判据值 f（f ≥ 1 表示全部在体外）。
   * 这是 `scarf.collider.outsideTorso.*` 与 `stats().scarfOutsideMinF` 的读数来源：
   * 直接由真实粒子与 §1.5 的碰撞体参数算出，不读任何缓存的投影结果。
   *
   * @param {object} G 一局状态
   * @returns {number} 最小 f（无粒子时为 Infinity）
   */
  function outsideMinF(G) {
    var rx = PEL.TORSO_R.x + SC.TORSO_EPS;
    var ry = PEL.TORSO_R.y + SC.TORSO_EPS;
    var rz = PEL.TORSO_R.z + SC.TORSO_EPS;
    var P = G.scarf.P, minF = Infinity;
    for (var i = COLS * 3; i < PARTICLES * 3; i += 3) {
      _wp.x = P[i]; _wp.y = P[i + 1]; _wp.z = P[i + 2];
      PB.rig.toLocal(G, _wp, _lp);
      var lx = _lp.x - PEL.TORSO.x;
      var cy = _lp.y - PEL.TORSO.y, cz = _lp.z - PEL.TORSO.z;
      var ly = cy * _crx + cz * _srx;
      var lz = -cy * _srx + cz * _crx;
      var f = (lx / rx) * (lx / rx) + (ly / ry) * (ly / ry) + (lz / rz) * (lz / rz);
      if (f < minF) minF = f;
    }
    return minF;
  }

  /**
   * 计算测量量：anchorMid、tip、angleDeg、lagX（§4.1 的"测量量"三条）。
   * angleDeg = (tip − anchorMid) 与 (0,−1,0) 的夹角；lagX = tip.x − anchorMid.x 减去 1 s 基线。
   *
   * @param {object} G 一局状态
   * @param {boolean} [initLag] 为真时把当前横向偏移直接作为基线（reset 用，避免首帧跳变）
   * @returns {void}
   */
  function measure(G, initLag, hStep) {
    var P = G.scarf.P;
    var a0 = G.rig.anchorW[0], a1 = G.rig.anchorW[1];
    var mx = (a0.x + a1.x) * 0.5, my = (a0.y + a1.y) * 0.5, mz = (a0.z + a1.z) * 0.5;
    var i0 = ix(ROWS - 1, 0), i1 = ix(ROWS - 1, 1);
    var tx = (P[i0] + P[i1]) * 0.5, ty = (P[i0 + 1] + P[i1 + 1]) * 0.5, tz = (P[i0 + 2] + P[i1 + 2]) * 0.5;
    G.scarf.tip.x = tx; G.scarf.tip.y = ty; G.scarf.tip.z = tz;

    var dx = tx - mx, dy = ty - my, dz = tz - mz;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
    // 与 (0,−1,0) 的夹角：cos = −dy/len
    var cosA = -dy / len;
    if (cosA > 1) cosA = 1; else if (cosA < -1) cosA = -1;
    G.scarf.angleDeg = Math.acos(cosA) * 180 / Math.PI;

    var raw = tx - mx;
    if (initLag) {
      for (var k = 0; k < LAG_N; k++) lagRing[k] = raw;
      lagHead = 0; lagFilled = LAG_N; lagSum = raw * LAG_N; lagBase = raw;
      anchorPrevX = mx; anchorPrevValid = true;
      G.scarf.lagX = 0;
      return;
    }
    // 锚点横向速度：变道期间（含 lean 回正带来的锚点移动）基线冻结，静止时才更新
    var vAnchor = anchorPrevValid && hStep > 0 ? (mx - anchorPrevX) / hStep : 0;
    anchorPrevX = mx; anchorPrevValid = true;
    if (Math.abs(vAnchor) <= ANCHOR_MOVE_EPS) {
      lagSum -= lagRing[lagHead];
      lagRing[lagHead] = raw;
      lagSum += raw;
      lagHead = (lagHead + 1) % LAG_N;
      if (lagFilled < LAG_N) lagFilled++;
      lagBase = lagSum / lagFilled;
    }
    G.scarf.lagX = raw - lagBase;
  }

  /**
   * 一个固定步：SUBSTEPS 个子步的 Verlet 积分 + 6 次约束迭代 + 碰撞，然后写测量量。
   * 数值健康检查按 §4.1：任一 P/Q 非有限、|P−Q| > 0.2、|P−anchorMid| ≥ 1.5 → reset 并计数。
   *
   * @param {object} G 一局状态（读 G.t/G.bike.v/G.bike.a/G.rig，写 G.scarf）
   * @param {number} h 固定步长（秒）
   * @param {{scarfResets:number}} [health] 会话级计数器（main.health；selfcheck 可传自己的）
   * @param {number} [windScale] 风场缩放（默认 1；只有 AC-2c 的无风对照运行传 0，ADR-22/ADR-24）
   * @returns {void}
   */
  S.step = function (G, h, health, windScale) {
    var P = G.scarf.P, Q = G.scarf.Q;
    var v = G.bike.v, a = G.bike.a;
    var hs = h / SC.SUBSTEPS;
    var t0 = G.t - h;
    var ws = (typeof windScale === 'number' && isFinite(windScale)) ? windScale : 1;
    var s, r, c, i, it;

    for (s = 0; s < SC.SUBSTEPS; s++) {
      var tSub = t0 + (s + 1) * hs;
      windAt(tSub, v);
      var flutterOn = Math.min(1, v / 4);

      // 步骤1：Verlet 积分（§4.1 的四行伪代码逐项；阻力为二次律 C_Q·‖u‖·u，ADR-22）
      for (r = 1; r < ROWS; r++) {
        for (c = 0; c < COLS; c++) {
          i = ix(r, c);
          M.clampLen((P[i] - Q[i]) * SC.DAMP, (P[i + 1] - Q[i + 1]) * SC.DAMP, (P[i + 2] - Q[i + 2]) * SC.DAMP,
            SC.MAX_VEL * hs, _vel);
          // 相对速度 u = wRel·windScale − vel/h_s。windScale 只影响气动项，重力与纵向惯性照常
          var rx = wind.x * ws - _vel.x / hs;
          var ry = wind.y * ws - _vel.y / hs;
          var rz = wind.z * ws - _vel.z / hs;
          // 二次阻力：C_Q·‖u‖·u（每粒子每子步一次 sqrt；|u| 上限约 1e2，不会溢出）
          var us = Math.sqrt(rx * rx + ry * ry + rz * rz);
          var kq = SC.CQ * us;
          _acc.x = kq * rx;
          _acc.y = -SC.GRAVITY + kq * ry;
          _acc.z = a + kq * rz;
          // 抖动：沿带面法向（行方向 × 列方向），幅度随行号与车速增长；随 windScale 一起关掉（AC-2c 对照）
          if (flutterOn > 0 && ws > 0) {
            ribbonNormal(P, r, _n);
            var amp = SC.FLUTTER_AMP * (r / (ROWS - 1)) *
              Math.sin(Math.PI * 2 * (SC.FLUTTER_BASE_HZ + SC.FLUTTER_V_HZ * v) * tSub + 0.9 * r) * flutterOn * ws;
            _acc.x += _n.x * amp; _acc.y += _n.y * amp; _acc.z += _n.z * amp;
          }
          M.clampLen(_vel.x + _acc.x * hs * hs, _vel.y + _acc.y * hs * hs, _vel.z + _acc.z * hs * hs,
            SC.MAX_DISP, _tmp);
          Q[i] = P[i]; Q[i + 1] = P[i + 1]; Q[i + 2] = P[i + 2];
          P[i] += _tmp.x; P[i + 1] += _tmp.y; P[i + 2] += _tmp.z;
        }
      }

      // 步骤2：约束迭代（结构/剪切/弯曲/宽度，刚度 1），每子步 SC.ITER 次；
      // 每次迭代的最后一步把第 1–12 行投到碰撞体外（第 0 行是固定点，不投影；ADR-23）
      for (it = 0; it < SC.ITER; it++) {
        for (var k = 0; k < CONS.length; k += 3) satisfy(P, CONS[k], CONS[k + 1], CONS[k + 2]);
        pinAnchors(G);
        collide(P, G);
      }
      pinAnchors(G);
    }

    // 步骤3：健康检查（§4.1）。失败只复位本模块状态并计数，不抛错（§4.12 的自愈语义）
    if (!healthy(G)) {
      S.reset(G);
      if (health && typeof health.scarfResets === 'number') health.scarfResets++;
    }
    measure(G, false, h);
    G.scarf.outsideMinF = outsideMinF(G);
  };

  /**
   * 带面法向（行方向 × 列方向）。最后一行没有下一行，退化为与上一行求方向。
   * @param {Float64Array} P 位置数组
   * @param {number} r 行号（≥1）
   * @param {{x:number,y:number,z:number}} out 输出（复用）
   * @returns {{x:number,y:number,z:number}} out
   */
  function ribbonNormal(P, r, out) {
    var a = ix(r, 0), b = ix(r, 1);
    var c0 = r + 1 < ROWS ? ix(r + 1, 0) : ix(r - 1, 0);
    var rx = P[c0] - P[a], ry = P[c0 + 1] - P[a + 1], rz = P[c0 + 2] - P[a + 2];
    var cx = P[b] - P[a], cy = P[b + 1] - P[a + 1], cz = P[b + 2] - P[a + 2];
    out.x = ry * cz - rz * cy;
    out.y = rz * cx - rx * cz;
    out.z = rx * cy - ry * cx;
    var len = Math.sqrt(out.x * out.x + out.y * out.y + out.z * out.z);
    if (len < 1e-9) { out.x = 0; out.y = 0; out.z = 0; } else { out.x /= len; out.y /= len; out.z /= len; }
    return out;
  }

  /**
   * 数值健康检查（§4.1）：全部 P/Q 有限、|P−Q| ≤ 0.2、|P − anchorMid| < 1.5。
   * @param {object} G 一局状态
   * @returns {boolean} 是否健康
   */
  function healthy(G) {
    var P = G.scarf.P, Q = G.scarf.Q;
    var a0 = G.rig.anchorW[0], a1 = G.rig.anchorW[1];
    var mx = (a0.x + a1.x) * 0.5, my = (a0.y + a1.y) * 0.5, mz = (a0.z + a1.z) * 0.5;
    for (var i = 0; i < PARTICLES * 3; i += 3) {
      if (!isFinite(P[i]) || !isFinite(P[i + 1]) || !isFinite(P[i + 2])) return false;
      if (!isFinite(Q[i]) || !isFinite(Q[i + 1]) || !isFinite(Q[i + 2])) return false;
      var dx = P[i] - Q[i], dy = P[i + 1] - Q[i + 1], dz = P[i + 2] - Q[i + 2];
      if (dx * dx + dy * dy + dz * dz > SC.MAX_PQ * SC.MAX_PQ) return false;
      var ax = P[i] - mx, ay = P[i + 1] - my, az = P[i + 2] - mz;
      if (ax * ax + ay * ay + az * az >= SC.MAX_ANCHOR_DIST * SC.MAX_ANCHOR_DIST) return false;
    }
    return true;
  }

  /**
   * 建 G.scarf 并复位（§3.6 initSession 第 2 步，依赖已就绪的 G.rig.anchorW）。
   * @param {object} G 一局状态
   * @returns {void}
   */
  S.initState = function (G) {
    G.scarf = {
      P: new Float64Array(PARTICLES * 3),
      Q: new Float64Array(PARTICLES * 3),
      tip: { x: 0, y: 0, z: 0 },
      lagX: 0,
      angleDeg: 0,
      // 碰撞外置读数（ADR-23）：第 1–12 行全部粒子在外扩椭球中的最小判据值 f，f ≥ 1 即全部在体外
      outsideMinF: Infinity
    };
    S.reset(G);
  };

  /**
   * 粒子数与行/列（渲染与 selfcheck 读同一份布局）。
   * @returns {{particles:number, rows:number, cols:number}} 布局
   */
  S.layout = function () { return { particles: PARTICLES, rows: ROWS, cols: COLS }; };
})(window.PB = window.PB || {});
