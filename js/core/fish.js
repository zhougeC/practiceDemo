// TASK-002 P9: 抓鱼（plan.md §4.4、§1.5 鱼、M-10、AC-5a–5d）。
// 唯一位置来源是 fish.pose：捕获判定、状态迁移、当步重算与渲染（fishview 只读 f.pose）都走这一个函数，
// 因此不存在"画面位置"和"判定位置"两套坐标（M-10）。本文件属 core，不得引用 THREE 或 DOM（M-07）。
(function (PB) {
  'use strict';

  var CFG = PB.config;
  var F = CFG.FISH;
  var S = PB.fish = {};

  /**
   * 鱼的位置与朝向（§4.4.2 的唯一 pose 函数）。三种状态各自闭式，不调用 rng、不读其他模块状态。
   * 朝向约定：鼻朝局部 +Z；yaw 绕世界 Y 轴，pitch 为绕局部 X 的抬头角（供 fishview 使用）。
   *
   * @param {object} f 鱼（需要 state、tState、tSpawn、p0、s、lane、high、id）
   * @param {object} G 一局状态（读 G.t、G.S、G.rig.beakW、G.bike.v）
   * @param {{x:number,y:number,z:number,yaw:number,pitch:number,scale:number}} out 输出（复用 f.pose）
   * @returns {object} out
   */
  S.pose = function (f, G, out) {
    var a = G.t - f.tState;
    var M = PB.mathx;

    if (f.state === 'caught') {
      // 步骤1：捕获插值。0.12 s 内从 p0 直线飞向"喙尖下方 0.05 m"，随后 0.15→0.4 s 缩到 0。
      // 用 smoothstep 保证起点（u=0）逐位等于 p0：a=0 时 lerp(p0, b, 0) = p0（AC-5a(ii) 的前提）。
      var b = G.rig.beakW;
      var u = M.smoothstep(0, 1, a / F.CHASE_T);
      out.x = M.lerp(f.p0.x, b.x, u);
      out.y = M.lerp(f.p0.y, b.y - F.CHASE_DY, u);
      out.z = M.lerp(f.p0.z, b.z, u);
      out.scale = 1 - M.smoothstep(F.FADE_A0, F.FADE_A1, a);
      // 朝向：鼻尖指向喙尖（捕获方向）。相对速度取 p0→喙的差，不经差分，因此 0.12 s 内稳定。
      var cx = b.x - f.p0.x, cy = (b.y - F.CHASE_DY) - f.p0.y, cz = b.z - f.p0.z;
      setAim(out, cx, cy, cz);
      return out;
    }

    if (f.state === 'missed') {
      // 步骤2：missed 轨迹是闭式、确定性的（§4.4.2）：x 在 0.62 s 内匀速冲到 SHORE_X+1.5，
      // y 走抛体（v0=1.5、g=18），z 仍随跑步机取 z = −(s − S)，因此"道路相对位置"只由前两项决定。
      var Dx = Math.max(F.MISS_XT - f.p0.x, 0.5);
      out.x = f.p0.x + Dx * Math.min(a / F.MISS_T, 1);
      out.y = f.p0.y + F.MISS_VY0 * a - 0.5 * F.MISS_G * a * a;
      out.z = -(f.s - G.S);
      out.scale = 1;
      // 朝向：道路相对速度的解析式（x 分量在 0.62 s 后为 0，y 分量随时间线性减小）。
      var mvx = a < F.MISS_T ? Dx / F.MISS_T : 0;
      setAim(out, mvx, F.MISS_VY0 - F.MISS_G * a, 0);
      return out;
    }

    // 步骤3：alive。前 1 s 从海面 (18, −0.8) 抛入车道（先快后慢的二次缓入 + 4.8·u(1−u) 的抛物线拱起），
    // 之后在线道上做 ±0.15 m 摆尾与 0.18 m 上下浮动；hoverY 的相位用 f.id 错开，避免同相位重叠。
    var age = G.t - f.tSpawn;
    var laneX = (f.lane - 1) * CFG.SIM.LANE_HALF;
    var hz = 2 * Math.PI * F.BOB_HZ * age + f.id;
    var hoverY = (f.high ? F.HOVER_HIGH : F.HOVER_LOW) + F.BOB_AMP * Math.sin(hz);
    if (age < F.SPAWN_T) {
      var s = age / F.SPAWN_T;
      out.x = M.lerp(F.SPAWN_X, laneX, 1 - (1 - s) * (1 - s));
      out.y = M.lerp(F.SPAWN_Y, hoverY, s) + F.ARC_UP * s * (1 - s);
    } else {
      out.x = laneX + F.WEAVE_AMP * Math.sin(2 * Math.PI * F.WEAVE_HZ * age);
      out.y = hoverY;
    }
    out.z = -(f.s - G.S);
    out.scale = 1;
    // 悬停时鼻朝 +Z（yaw = pitch = 0），与 §4.4.2 的"alive 悬停时朝 +Z"一致
    out.yaw = 0;
    out.pitch = 0;
    return out;
  };

  /**
   * 由"道路相对速度"写朝向：yaw 绕 Y、pitch 绕 X。速度为零时保留上一次朝向（不产生 NaN）。
   * @param {object} out pose 输出
   * @param {number} vx 道路相对 x 速度
   * @param {number} vy 道路相对 y 速度
   * @param {number} vz 道路相对 z 速度（已扣掉 −v·h 的道路位移）
   * @returns {void}
   */
  function setAim(out, vx, vy, vz) {
    var h = Math.sqrt(vx * vx + vz * vz);
    if (h < 1e-9 && Math.abs(vy) < 1e-9) return;
    out.yaw = Math.atan2(vx, vz);
    out.pitch = -Math.atan2(vy, h);
  }

  /**
   * 造一条新鱼并计算首帧 pose（生成与 debug 的 spawnFish 共用，避免第二套初始化）。
   * @param {object} G 一局状态
   * @param {number} lane 车道 0..2
   * @param {boolean} high 是否高鱼
   * @param {number} dist 相对 G.S 的前方距离（米）
   * @returns {object} 新鱼
   */
  S.make = function (G, lane, high, dist) {
    var f = {
      id: G.fishSeq++,
      lane: lane,
      s: G.S + dist,
      tSpawn: G.t,
      high: !!high,
      state: 'alive',
      tState: G.t,
      p0: { x: 0, y: 0, z: 0 },
      pose: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scale: 1 },
      prevZ: 0
    };
    S.pose(f, G, f.pose);
    // p0 记录出生位置：迁移时会被 p0 覆盖，这里只保证字段始终有限（§3.3 的元素结构）
    f.p0.x = f.pose.x; f.p0.y = f.pose.y; f.p0.z = f.pose.z;
    f.prevZ = f.pose.z;
    return f;
  };

  /**
   * 调试钩子用：在指定车道/高度/距离生成一条鱼（§5.3 spawnFish）。不推进 nextFishS，
   * 因此不会干扰常规生成节奏；上限仍是 6 条（与 §3.3 的数组长度约束一致）。
   * @param {object} G 一局状态
   * @param {number} lane 车道 0..2
   * @param {boolean} high 是否高鱼
   * @param {number} dist 相对 G.S 的前方距离（米）
   * @returns {object|null} 新鱼（满 6 条时返回 null）
   */
  S.spawn = function (G, lane, high, dist) {
    if (G.fish.length >= F.MAX) return null;
    var l = Math.max(0, Math.min(2, lane | 0));
    var d = isFinite(dist) ? Number(dist) : F.AHEAD;
    var f = S.make(G, l, high, d);
    G.fish.push(f);
    return f;
  };

  /**
   * 捕获判定（§4.4.3 第 2 步）：以喙尖为球心、在局部轴向的半箱判定，外加"本步跨过喙平面"的补充判据。
   * 跨平面判据用 f.prevZ 与 G.rig.prevBeakZ 的符号差，避免高速时穿帧漏判。
   * @param {object} f 鱼（alive，且 f.pose 为本步 pose）
   * @param {object} G 一局状态
   * @returns {boolean} 是否命中
   */
  S.canCatch = function (f, G) {
    var p = f.pose, b = G.rig.beakW;
    if (Math.abs(p.x - b.x) >= F.CATCH_X) return false;
    if (Math.abs(p.y - b.y) > F.CATCH_Y) return false;
    if (Math.abs(p.z - b.z) < F.CATCH_Z) return true;
    return (f.prevZ - G.rig.prevBeakZ) * (p.z - b.z) <= 0;
  };

  /**
   * 计分（§4.4.4）：基础 10、空中 +5、抬轮 +5；连击按 4 s 窗口累加，倍率上限 2.0，向下取整。
   * @param {object} G 一局状态（写 G.score）
   * @returns {number} 本次得分
   */
  S.scoreCatch = function (G) {
    var sc = G.score;
    var bonus = 0;
    if (G.bike.airborne) bonus += F.AIR_BONUS;
    if (G.bike.wheelie >= F.WHEELIE_RAD) bonus += F.WHEELIE_BONUS;
    if (G.t - sc.lastCatchT <= F.COMBO_WINDOW) sc.combo += 1; else sc.combo = 1;
    var mult = Math.min(1 + F.COMBO_STEP * (sc.combo - 1), F.MULT_MAX);
    var pts = Math.floor((F.BASE + bonus) * mult);
    sc.points += pts;
    sc.catches += 1;
    sc.lastCatchT = G.t;
    return pts;
  };

  /**
   * 一个固定步（§4.4.1 + §4.4.3）。顺序固定：生成 → 对每条鱼"算 pose → 判定 → 迁移 → 当步重算" → 移除检查 → 对齐 prevBeakZ。
   * 生成、迁移、计分都只写 G.fish / G.score / G.events，不写渲染对象（M-23）。
   * @param {object} G 一局状态（需要已就绪的 G.rig；由 main 的 F5 在 rig.compute 之后调用）
   * @param {number} h 固定步长（秒；本函数不直接用，保留签名一致性）
   * @returns {void}
   */
  S.step = function (G, h) {
    var i, f;

    // 步骤1：生成。只有路程越过 nextFishS 且数组未满 6 条时才生成；静止（S 不增）时永不生成。
    // lane 与 high 的两次 rng 调用顺序写死（§4.4.1），保证同种子下 AC-5d/AC-12e 可复现。
    if (G.S >= G.nextFishS && G.fish.length < F.MAX) {
      var lane = Math.floor(PB.mathx.rng(G) * 3);
      var high = PB.mathx.rng(G) < F.HIGH_PROB;
      G.fish.push(S.make(G, lane, high, F.AHEAD));
      G.nextFishS += F.SPACING_MIN + F.SPACING_VAR * PB.mathx.rng(G);
    }

    // 步骤2：逆序遍历（迁移/移除都作用在当前元素上，逆序可安全 splice）
    for (i = G.fish.length - 1; i >= 0; i--) {
      f = G.fish[i];
      if (f.state === 'alive') {
        // 步骤2a：判定前必须先用同一个 pose 算出本步位置（M-10）
        S.pose(f, G, f.pose);
        if (S.canCatch(f, G)) {
          // 步骤2b：命中 → p0 取"判定用的 alive pose"的拷贝，tState 记本步时刻。
          // 随后当步重算 pose（u=0，逐位等于 p0），因此 AC-5a(ii) 的"迁移后 f.pose == 判定 pose"成立。
          f.p0.x = f.pose.x; f.p0.y = f.pose.y; f.p0.z = f.pose.z;
          f.state = 'caught';
          f.tState = G.t;
          S.scoreCatch(G);
          G.events.push({
            type: 'catch', fishId: f.id, air: !!G.bike.airborne,
            wheelie: G.bike.wheelie >= F.WHEELIE_RAD, auto: !!G.ap.engaged
          });
          S.pose(f, G, f.pose);
        } else if (f.pose.z > F.STALE_Z || G.t - f.tSpawn > F.STALE_T) {
          // 步骤2c：越过镜头 3 m 或存活 14 s 未抓到 → 转 missed（p0 取当前 pose），当步重算并推事件
          f.p0.x = f.pose.x; f.p0.y = f.pose.y; f.p0.z = f.pose.z;
          f.state = 'missed';
          f.tState = G.t;
          G.events.push({ type: 'miss', fishId: f.id });
          S.pose(f, G, f.pose);
        }
        // 步骤2d：本步 pose 的 z 作为下一次跨平面判定的上一步值
        f.prevZ = f.pose.z;
      } else {
        // 步骤3：非 alive 的鱼每步只重算 pose 并做移除检查（caught 0.4 s、missed 0.8 s）
        S.pose(f, G, f.pose);
        var a = G.t - f.tState;
        if ((f.state === 'caught' && a >= F.REMOVE_CAUGHT) ||
            (f.state === 'missed' && a >= F.REMOVE_MISSED)) {
          G.fish.splice(i, 1);
        }
      }
    }

    // 步骤4：所有鱼处理完后对齐 prevBeakZ（§4.4.3 末句）。下一固定步的跨平面判定从这里取上一步的喙 z。
    G.rig.prevBeakZ = G.rig.beakW.z;
  };
})(window.PB = window.PB || {});
