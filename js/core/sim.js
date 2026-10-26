// TASK-002 P4: 一局状态与运动学（plan.md §3.3 状态 schema、§4.5.2 运动学、§4.12 健康检查、M-33）。
// createState 只建纯数据，不调用任何模块（M-33）；step 只写 bike/t/S/p/cycle 与事件。
// 本文件不引用 scarf / daynight / fish 模块（P6/P7/P9 才接线），因此 selfcheck 可以在没有它们的页面上跑。
(function (PB) {
  'use strict';

  var CFG = PB.config;
  var SIM = CFG.SIM;
  var S = PB.sim = {};

  /**
   * 建一局纯数据状态（§3.3 的"createState 建立的纯数据字段"逐项）。
   * 只分配对象与数组，不调用任何其他模块（M-33）；G.rig / G.scarf / G.env 由 initSession 的
   * 对应模块创建，本函数不得提前建这些键。
   *
   * @param {number} seed 随机数种子（uint32）
   * @param {{camMode?: number}} [opts] 选项；camMode 取自 store.settings.cam
   * @returns {object} 新的 G
   */
  S.createState = function (seed, opts) {
    var camMode = (opts && typeof opts.camMode === 'number') ? opts.camMode : 0;
    return {
      t: 0,                       // 模拟时间（秒）
      S: 0,                       // 累计路程（米，单调递增）
      p: 0,                       // 昼夜相位 [0,1)
      cycle: 0,                   // floor(t/240)
      lastGood: { t: 0, S: 0 },   // 数值健康检查的恢复基准
      rng: seed >>> 0,            // mulberry32 状态；只经 PB.mathx.rng 读取并推进
      bike: {
        x: 0,                     // 横向位置 [−3,3]
        y: 0,                     // 离地高度 [0,1.5]
        vy: 0,
        v: 0,                     // 纵向速度 [0,16]
        a: 0,
        lane: 1,                  // 车道 0/1/2
        laneFromX: 0,
        laneToX: 0,
        laneT: 1,                 // 变道进度 [0,1]
        lastLaneReqT: -9,
        airborne: false,
        jumpBufT: 0,              // 起跳缓冲 [0,0.12]
        wheelie: 0,               // 抬轮角 [0,0.314]
        wing: 0,                  // 展翅 [0,1]
        crank: 0,                 // 曲柄角 [0,2π)
        lean: 0,                  // 倾角 [−0.21,0.21]
        rpm: 0
      },
      fish: [],                   // 长度 ≤6；元素结构见 §3.3（P9 起填充）
      fishSeq: 0,
      nextFishS: 40,
      score: { points: 0, catches: 0, combo: 0, lastCatchT: -99 },
      stats: { nightRideT: 0, speedHighT: 0, wheelieT: 0, camUsed: [0, 0, 0, 0, 0], apCatches: 0 },
      ap: { engaged: false, nextDecT: 0, targetId: -1, laneGoal: 1, prevTArr: Infinity, jumpedFor: -1, nextDriftT: 8 },
      cam: {
        mode: camMode,
        blendT: 1,
        headHidden: false,
        orbit: { yaw: 0.6109, pitch: 0.3142, dist: 9, lastInteractT: -99, frozen: false },
        cineShot: 0,
        cineT: 0
      },
      events: []                  // 每帧末由 main 清空（F14）
    };
  };

  /**
   * 把 c 以最多 rate·h 的步长推向 t（线性速率，用于抬轮/展翅）。
   * @param {number} c 当前值
   * @param {number} t 目标值
   * @param {number} maxStep 本步最大变化量
   * @returns {number} 新值
   */
  function approach(c, t, maxStep) {
    if (c < t) return Math.min(t, c + maxStep);
    if (c > t) return Math.max(t, c - maxStep);
    return t;
  }

  /**
   * 踏频（§3.5）：v·60/(2.136·2.8)。
   * @param {number} v 速度 m/s
   * @returns {number} 每分钟转数
   */
  S.cadenceRpm = function (v) { return v * 60 / SIM.CADENCE_DIV; };

  /**
   * 推入一个事件（事件对象允许每帧新建，M-31）。
   * @param {object} G 一局状态
   * @param {object} evt 事件
   * @returns {void}
   */
  function emit(G, evt) { G.events.push(evt); }

  /**
   * 一个固定步（§4.5.2 / §4.2.1）。顺序固定：纵向 → 变道 → 倾斜 → 跳跃 → 抬轮/展翅 →
   * 踏频 → 时间与相位。顺序不可调换：倾斜依赖本步的横向位移，跳跃依赖本步的缓冲递减。
   *
   * @param {object} G 一局状态
   * @param {{throttle:boolean, brake:boolean, laneDelta:number, jumpPress:boolean, wing:boolean}} cmd 本步指令
   * @param {number} h 步长（秒）
   * @returns {void}
   */
  S.step = function (G, cmd, h) {
    var b = G.bike;

    // 步骤1：纵向速度与路程。刹车优先于油门（M-14），无输入时用 0.4+0.004v² 的阻力滑行。
    var a;
    if (cmd.brake) a = -SIM.BRAKE_DECEL;
    else if (cmd.throttle) a = SIM.THROTTLE_ACC * (1 - b.v / SIM.V_MAX);
    else a = -(SIM.DRAG_BASE + SIM.DRAG_QUAD * b.v * b.v);
    b.a = a;
    b.v += a * h;
    if (b.v < 0) b.v = 0;
    else if (b.v > SIM.V_MAX) b.v = SIM.V_MAX;
    G.S += b.v * h;

    // 步骤2：变道。只有目标车道与当前不同才启动一次新变道（重复请求不叠加）。
    var x0 = b.x;
    if (cmd.laneDelta) {
      var target = b.lane + cmd.laneDelta;
      if (target < 0) target = 0;
      else if (target > 2) target = 2;
      if (target !== b.lane) {
        b.laneFromX = b.x;
        b.laneToX = (target - 1) * SIM.LANE_HALF;
        b.lane = target;
        b.laneT = 0;
        b.lastLaneReqT = G.t;
        emit(G, { type: 'laneChange', lane: target });
      }
    }
    // 步骤3：推进变道进度并按 smoothstep 插值横向位置（AC-6b：0.35 s 内完成）
    if (b.laneT < 1) {
      b.laneT += h / SIM.LANE_TIME;
      if (b.laneT > 1) b.laneT = 1;
      b.x = b.laneFromX + (b.laneToX - b.laneFromX) * PB.mathx.smoothstep(0, 1, b.laneT);
      if (b.laneT === 1) b.x = b.laneToX;
    }

    // 步骤4：倾角。参考横向速度 dx/h 归一化到 7.1 m/s 后映射到 ±0.21 rad，再指数阻尼。
    var dx = b.x - x0;
    var leanTarget = -SIM.LEAN_MAX * Math.max(-1, Math.min(1, dx / h / SIM.LEAN_DX_REF));
    b.lean = PB.mathx.damp(b.lean, leanTarget, SIM.LEAN_K, h);

    // 步骤5：跳跃。jumpPress 只写缓冲；缓冲在每步递减；离地判定只发生在落地状态。
    if (cmd.jumpPress) b.jumpBufT = SIM.JUMP_BUF;
    b.jumpBufT = Math.max(0, b.jumpBufT - h);
    if (!b.airborne && b.jumpBufT > 0) {
      b.vy = SIM.JUMP_V0;
      b.airborne = true;
      b.jumpBufT = 0;
      emit(G, { type: 'jump' });
    }
    if (b.airborne) {
      // 步骤5a：等加速位移用"本步平均速度"，等价于 vy−=gh 后再 y+=vy·h 的精确形式，
      // 使 AC-6c 的最高点/滞空与 v0²/(2g)、2v0/g 一致（Q-03 记录了字面欧拉序的偏差）。
      b.y += b.vy * h - 0.5 * SIM.GRAVITY * h * h;
      b.vy -= SIM.GRAVITY * h;
      if (b.y <= 0) {
        b.y = 0;
        b.vy = 0;
        b.airborne = false;
        emit(G, { type: 'land' });
      }
    }

    // 步骤6：抬轮与展翅（§4.5.2）。wing held 同时驱动两者，松开后以更快速率回落。
    var on = !!cmd.wing;
    b.wheelie = approach(b.wheelie, on ? SIM.WHEELIE_MAX : 0, (on ? SIM.WHEELIE_UP : SIM.WHEELIE_DOWN) * h);
    b.wing = approach(b.wing, on ? 1 : 0, (on ? SIM.WING_UP : SIM.WING_DOWN) * h);

    // 步骤7：踏频与曲柄角（模 2π，避免长时间累积丢精度）
    b.rpm = S.cadenceRpm(b.v);
    b.crank = PB.mathx.mod(b.crank + Math.PI * 2 * b.rpm / 60 * h, Math.PI * 2);

    // 步骤8：时间、昼夜相位与周期事件（§4.2.1）
    G.t += h;
    var c = Math.floor(G.t / SIM.CYCLE_SECONDS);
    if (c > G.cycle) {
      G.cycle = c;
      emit(G, { type: 'cycleWrap' });
    }
    G.p = G.t / SIM.CYCLE_SECONDS - c;
  };

  /**
   * 车辆复位（§4.12 resetBike）。只修车辆字段，不动 t/S/鱼/围巾。
   * @param {object} G 一局状态
   * @returns {void}
   */
  S.resetBike = function (G) {
    var b = G.bike;
    var laneOk = (b.lane === 0 || b.lane === 1 || b.lane === 2) ? b.lane : 1;
    b.lane = laneOk;
    b.x = (laneOk - 1) * SIM.LANE_HALF;
    b.laneFromX = b.x;
    b.laneToX = b.x;
    b.laneT = 1;
    b.y = 0;
    b.vy = 0;
    b.airborne = false;
    b.jumpBufT = 0;
    b.v = isFinite(b.v) ? Math.max(0, Math.min(8, b.v)) : 0;
    b.a = 0;
    b.wheelie = 0;
    b.wing = 0;
    b.lean = 0;
    b.crank = isFinite(b.crank) ? PB.mathx.mod(b.crank, Math.PI * 2) : 0;
    b.rpm = S.cadenceRpm(b.v);
    b.lastLaneReqT = G.t;
  };

  /**
   * 数值健康检查（§4.12 M-20）。每个固定步调用一次；失败时自愈并计数，
   * 只有 t/S 非有限或 nan-storm 才抛合成错误交给 main.onFrameError。
   *
   * @param {object} G 一局状态
   * @param {{nanResets:number, nanWindow:number[]}} health 会话级计数器（由 main 拥有）
   * @returns {boolean} 是否健康
   */
  S.healthCheck = function (G, health) {
    var b = G.bike;
    var ok = isFinite(b.x) && isFinite(b.y) && isFinite(b.vy) && isFinite(b.v) && isFinite(b.a) &&
      isFinite(b.laneFromX) && isFinite(b.laneToX) && isFinite(b.laneT) && isFinite(b.wheelie) &&
      isFinite(b.wing) && isFinite(b.crank) && isFinite(b.lean) && isFinite(b.jumpBufT) && isFinite(b.rpm) &&
      Math.abs(b.x) <= 3 && b.y >= -0.01 && b.y <= 1.5 && b.v >= 0 && b.v <= SIM.V_MAX &&
      b.laneT >= 0 && b.laneT <= 1 && (b.lane === 0 || b.lane === 1 || b.lane === 2);

    if (!ok) {
      // 步骤1：车辆字段越界或非有限 → 复位并计数（复位本身不抛错，避免一次坏值放大成 fatal）
      S.resetBike(G);
      health.nanResets++;
      recordNan(G, health);
    }

    // 步骤2：鱼的位置数据必须有限；非有限直接从数组删除（鱼模块只读 G.fish，删除是安全的）
    for (var i = G.fish.length - 1; i >= 0; i--) {
      var f = G.fish[i];
      if (!f || !f.pose || !isFinite(f.pose.x) || !isFinite(f.pose.y) || !isFinite(f.pose.z)) {
        G.fish.splice(i, 1);
        health.nanResets++;
        recordNan(G, health);
      }
    }

    // 步骤3：t/S 非有限时回到 lastGood 并抛合成错误（交 main 走 fatal/softReset 路径）
    if (!isFinite(G.t) || !isFinite(G.S)) {
      G.t = G.lastGood.t;
      G.S = G.lastGood.S;
      throw new Error('non-finite t/S');
    }

    G.lastGood.t = G.t;
    G.lastGood.S = G.S;
    return ok;
  };

  /**
   * 记录一次自愈并做 nan-storm 判定：10 s 内 ≥20 次则抛合成错误（§4.12）。
   * @param {object} G 一局状态（用 G.t 作为单调时钟）
   * @param {{nanWindow:number[]}} health 会话级计数器
   * @returns {void}
   */
  function recordNan(G, health) {
    health.nanWindow.push(G.t);
    while (health.nanWindow.length && G.t - health.nanWindow[0] > 10) health.nanWindow.shift();
    if (health.nanWindow.length >= 20) throw new Error('nan-storm');
  }
})(window.PB = window.PB || {});
