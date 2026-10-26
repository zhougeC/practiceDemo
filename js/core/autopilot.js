// TASK-002 P12: 自动驾驶（plan.md §4.6、M-15/M-34、UD-3 字面口径、AC-12a–12e）。
// 全有或全无：要么全部手动，要么全部自动，不做部分接管（§4.6.2）。
// 活跃判定只认可信事件（input 的 capture 层已把 isTrusted 输入统一折算成 activity 脉冲与 lastActivity）；
// 指针按住等价于 held（ptrMap 只记录 held 类动作），画布拖动/捏合由 orbitPointers 覆盖。
(function (PB) {
  'use strict';

  var CFG = PB.config;
  var A = CFG.AP;
  var S = PB.autopilot = {};

  var idleSec = 0;   // 最近一次可信输入距今的秒数（stats().idleSec 读数）

  /**
   * 仲裁（F4，物理之前执行；§4.6.2）。
   * 顺序写死：先断开（用户活跃且正在 AUTO），再判断是否接管。因此"任意可信输入"在本帧物理之前生效，
   * AC-12c 的"下一帧 F4 断开"成立。
   *
   * @param {object} G 一局状态（写 G.ap、G.stats.apCatches）
   * @param {{activity:boolean, anyHeld:boolean, now:number}} inp F2 的输入快照
   * @param {number} now 当前时间（秒）
   * @returns {void}
   */
  S.arbitrate = function (G, inp, now) {
    var since = now - PB.input.activityAt();
    if (!isFinite(since) || since < 0) since = 1e9;   // 从未有过可信输入 → 视为很久以前
    idleSec = since;

    // 步骤1：活跃判定。held 覆盖键盘与指针按钮（ptrMap 的动作必然计入 ptrCount → anyHeld）；
    // orbitPtrs.size 覆盖画布上的单指/双指（它们不进入 ptrMap）。两者都满足 M-34 的字面口径。
    var userActive = inp.activity || inp.anyHeld || PB.input.orbitPointers().size > 0 || since < A.IDLE_SEC;

    // 步骤2：断开。清空目标/闸门，使下一次接管从头决策（§4.6.2 第 1 条）
    if (userActive && G.ap.engaged) {
      G.ap.engaged = false;
      G.ap.targetId = -1;
      G.ap.prevTArr = Infinity;
      G.ap.jumpedFor = -1;
      return;
    }
    // 步骤3：接管。F4 只在 running 帧被调用（F0 已过滤其他状态），因此不需要读 main.app。
    if (!userActive && !G.ap.engaged) {
      G.ap.engaged = true;
      G.stats.apCatches = 0;      // §4.8 AUTO_FISHER：engage 时清零
      G.ap.nextDecT = G.t;        // 立即允许第一次选目标
    }
  };

  /**
   * 选新目标（§4.6.3）：在 alive、未越过喙、d ∈ (6,60) 的鱼中按 d 升序找第一条满足
   * |lane − 鱼 lane|·0.35 ≤ d/max(v,1) 的鱼。单次遍历取最小 d 的可行者（等价于升序首条），不排序、不分配。
   *
   * @param {object} G 一局状态
   * @returns {object|null} 选中的鱼
   */
  function pick(G) {
    var b = G.bike, beakZ = G.rig.beakW.z;
    var best = null, bestD = Infinity;
    var vmax = Math.max(b.v, 1);
    for (var i = 0; i < G.fish.length; i++) {
      var f = G.fish[i];
      if (f.state !== 'alive') continue;
      if (f.pose.z > beakZ) continue;            // 已越过喙
      var d = f.s - G.S;
      if (d <= A.D_MIN || d >= A.D_MAX) continue;
      if (d >= bestD) continue;                  // 已有更近的可行目标
      if (Math.abs(f.lane - b.lane) * A.LANE_TOL > d / vmax) continue;
      best = f; bestD = d;
    }
    return best;
  }

  /**
   * 每个固定步输出一条 Cmd（§4.6.3）。每步先做目标保留，再按 0.25 s 节奏选目标，最后给车道/速度/起跳。
   * 副作用只写 G.ap（以及 Cmd 的 out 字段）；起跳由 sim 在下一步消费（jumpPress → jumpBufT）。
   *
   * @param {object} G 一局状态
   * @param {number} h 固定步长（秒；本函数不用，保留签名一致性）
   * @param {{throttle:boolean, brake:boolean, laneDelta:number, jumpPress:boolean, wing:boolean}} out 复用的 Cmd
   * @returns {object} out
   */
  S.command = function (G, h, out) {
    var ap = G.ap, b = G.bike;
    var f = null, i;

    // 步骤1：目标保留。只有"不在数组里 / 已非 alive / 已越过喙"才释放；d ≤ 6 不是释放条件。
    if (ap.targetId !== -1) {
      for (i = 0; i < G.fish.length; i++) {
        if (G.fish[i].id === ap.targetId) { f = G.fish[i]; break; }
      }
      if (!f || f.state !== 'alive' || f.pose.z > G.rig.beakW.z) {
        ap.targetId = -1;
        ap.prevTArr = Infinity;     // 不让上一个目标的 tArr 参与新目标的跨阈值判断
        ap.nextDecT = G.t;          // 下一步立即重选
        f = null;
      }
    }

    // 步骤2：选新目标（仅当无目标且到达决策时刻）。锁定后不重选；无目标时按 6+4·rng 的节奏漂移车道。
    if (!f && ap.targetId === -1 && G.t >= ap.nextDecT) {
      ap.nextDecT = G.t + A.DEC_T;
      f = pick(G);
      if (f) {
        ap.targetId = f.id;
        ap.laneGoal = f.lane;
        ap.prevTArr = Infinity;
      } else if (G.t >= ap.nextDriftT) {
        ap.laneGoal = Math.floor(PB.mathx.rng(G) * 3);
        ap.nextDriftT = G.t + A.DRIFT_T + A.DRIFT_VAR * PB.mathx.rng(G);
      }
    }

    // 步骤3：车道。只有变道完成（laneT === 1）且目标车道不同才发一次请求，避免叠加。
    out.laneDelta = (b.laneT === 1 && ap.laneGoal !== b.lane) ? PB.mathx.sign(ap.laneGoal - b.lane) : 0;

    // 步骤4：速度。有目标时维持 [9.5, 11]，无目标时以 8 m/s 巡航（误差 ±0.5 内不动作）。
    out.throttle = false;
    out.brake = false;
    if (f) {
      if (b.v < A.V_LOW) out.throttle = true;
      else if (b.v > A.V_HIGH) out.brake = true;
    } else if (Math.abs(b.v - A.V_CRUISE) > A.V_DEAD) {
      if (b.v < A.V_CRUISE) out.throttle = true; else out.brake = true;
    }

    // 步骤5：起跳。只对 high 鱼执行；tArr 由喙与鱼的 z 差除以速度得到。
    // 两条分支覆盖"选中时已在窗口内"与"随时间跨过 0.357 阈值"；jumpedFor 门闩保证同一目标只起跳一次。
    out.jumpPress = false;
    out.wing = false;
    if (f && f.high) {
      var tArr = (G.rig.beakW.z - f.pose.z) / Math.max(b.v, 0.5);
      var fire = (ap.jumpedFor !== ap.targetId) &&
        ((ap.prevTArr === Infinity && tArr > A.TARR_LO && tArr <= A.TARR_HI) ||
         (ap.prevTArr !== Infinity && ap.prevTArr > A.TARR_HI && tArr <= A.TARR_HI));
      if (fire) {
        out.jumpPress = true;
        ap.jumpedFor = ap.targetId;
      }
      ap.prevTArr = tArr;
    }

    // 步骤6：下一次选目标的时刻由步骤2保证 ≤ 0.25 s 间隔；这里不再改动，避免与 AC-12e 的相位论证冲突。
    return out;
  };

  /**
   * @returns {number} 最近一次可信输入距今的秒数（stats().idleSec）
   */
  S.idleSec = function () { return idleSec; };
})(window.PB = window.PB || {});
