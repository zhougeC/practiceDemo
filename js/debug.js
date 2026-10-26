// TASK-002 P1: PB.debug 钩子与 stats()（plan.md §5.3、§3.5 debug 行）。
// 只在 ?debug=1 时挂载（§5.3）；后续包只追加钩子与 stats 字段，不改写本包已有字段的来源。
// 本包只提供已经真实存在的读数：应用状态、GL 版本、DPR、三角面/draw call、fps、store 状态、静音。
// 尚未接线的子系统（围巾、鱼、自动驾驶等）不产出字段，也不返回假值。
(function (PB) {
  'use strict';
  var CFG = PB.config;
  var S = PB.debug = {};
  var enabled = false;
  var frameMsSum = 0;
  var frameCount = 0;
  var fps = 0;              // 最近一次整秒窗口的帧率
  var fpsWin = 0;           // 最近一次整秒窗口的帧率（§5.5 的 fpsWin 读数）
  // 判定是否处于调试模式。只看 URL 查询参数 ?debug=1，不看 localStorage， 避免调试开关在无持久化环境下失效（§5.3）。
  function detect() {
    try {
      return /(?:^|[?&])debug=1(?:&|$)/.test(window.location.search || '');
    } catch (e) {
      return false;
    }
  }
  // 记录一帧的原始耗时，用于 fps / fpsWin 读数（§5.5 的测量口径）。 以 1 s 为窗口结算，结算时把均值同时写入 fps 与 fpsWin。
  S.recordFrame = function (rawDtMs) {
    if (!isFinite(rawDtMs) || rawDtMs <= 0) return;
    frameMsSum += rawDtMs;
    frameCount++;
    if (frameMsSum >= 1000) {
      fps = frameCount * 1000 / frameMsSum;
      fpsWin = fps;
      frameMsSum = 0;
      frameCount = 0;
    }
  };
  // 采集当前可用的读数。每个字段都从唯一写者实时读取，不做缓存快照， 因此 stats() 的返回值总是与当前帧状态一致（§5.3）。 调试钩子只在 ?debug=1 时挂载（§5.3），非调试模式返回 null。
  S.stats = function () {
    if (!enabled) return null;
    var renderer = PB.scene.renderer();
    var app = PB.main.app;
    var info = renderer ? renderer.info : null;
    var inputStats = PB.input.stats();
    var G = PB.main.state();
    return {
      fps: fps,
      fpsWin: fpsWin,
      // DPR 与三角面/draw call 直接取渲染器真实值，避免另存一份（M-23）
      dpr: renderer ? renderer.getPixelRatio() : 0,
      tris: info ? info.render.triangles : 0,
      calls: info ? info.render.calls : 0,
      appState: app.state,
      glVersion: app.glVersion,
      storePersistent: PB.store.persistent,
      muted: PB.store.get().settings.muted,
      // P3 追加：输入状态（§5.3 的 heldSet / ptrMapSize / ptrCountSum / orbitPtrs）
      heldSet: inputStats.heldSet,
      ptrMapSize: inputStats.ptrMapSize,
      ptrCountSum: inputStats.ptrCountSum,
      orbitPtrs: inputStats.orbitPtrs,
      nanResets: PB.main.health.nanResets,
      softResets: PB.main.health.softResets,
      errorsIn10s: PB.main.health.errors.length,
      // P4 追加：一局状态读数（全部来自唯一写者，不做缓存快照）
      t: G ? G.t : null,
      S: G ? G.S : null,
      p: G ? G.p : null,
      v: G ? G.bike.v : null,
      a: G ? G.bike.a : null,
      x: G ? G.bike.x : null,
      y: G ? G.bike.y : null,
      vy: G ? G.bike.vy : null,
      lane: G ? G.bike.lane : null,
      laneT: G ? G.bike.laneT : null,
      wheelieDeg: G ? G.bike.wheelie * 180 / Math.PI : null,
      wingAmt: G ? G.bike.wing : null,
      rpm: G ? G.bike.rpm : null,
      camMode: G ? G.cam.mode : null,
      // P5/P6 追加：角色与围巾（AC-1d / AC-2b / AC-2d 的读数）
      beakErr: frameReadings.beakErr,
      footPedalErr: frameReadings.footPedalErr,
      scarfTipAngleDeg: G && G.scarf ? G.scarf.angleDeg : null,
      scarfLagX: G && G.scarf ? G.scarf.lagX : null,
      scarfResets: PB.main.health.scarfResets,
      // 碰撞外置读数（ADR-23）：第 1–12 行粒子在外扩椭球中的最小判据值 f，f ≥ 1 表示全部在体外
      scarfOutsideMinF: G && G.scarf ? G.scarf.outsideMinF : null,
      // P7/P8 追加：天空与光照一致性（AC-3b / AC-3c）
      starsInView: frameReadings.starsInView,
      lightDirErr: frameReadings.lightDirErr,
      pixelNormals: PB.ocean.pixelNormals(),
      // P9/P10/P11/P12 追加（§5.3 的 stats() 字段）
      level: PB.quality.level(),          // P14：画质控制器当前等级
      apEngaged: G ? G.ap.engaged : false,
      idleSec: PB.autopilot.idleSec(),
      fishAlive: frameReadings.fishAlive,
      fishMeshErr: frameReadings.fishMeshErr,
      headVisErr: frameReadings.headVisErr,
      headHidden: frameReadings.headHidden,
      dHead: frameReadings.dHead,
      achCount: PB.achievements.count(),
      // P13：音频读数来自唯一写者（未解锁时 bpm=0、audioState='idle'，不伪造音乐）
      bpm: PB.audio.bpm(),
      audioState: PB.audio.state(),
      frozen: frozen
    };
  };
  // 挂载调试钩子。只在 ?debug=1 时由 main.boot 调用； 非调试模式下 PB.debug 只保留 recordFrame（主循环仍需统计 fps）。
  S.attach = function () {
    enabled = detect();
    return enabled;
  };
  S.enabled = function () { return enabled; };
  var loseExtCached = null;   // 首次取得后缓存：上下文丢失后 getExtension 返回 null，缓存是恢复的唯一途径
  // 取 WEBGL_lose_context 扩展。该扩展是浏览器提供的标准调试手段（§5.3 的 loseContext/ restoreContext 钩子），只在 ?debug=1 时可用。 结果缓存：上下文丢失后同一上下文的 getExtension 会失败，必须复用丢失前取得的扩展对象。
  function loseExt() {
    if (!enabled) return null;
    if (loseExtCached) return loseExtCached;
    var renderer = PB.scene.renderer();
    if (!renderer) return null;
    var gl = renderer.getContext();
    loseExtCached = gl ? gl.getExtension('WEBGL_lose_context') : null;
    return loseExtCached;
  }
  // 主动丢失上下文，用于验证 ctxlost → 8 s 按钮 → restored 的恢复路径（§4.11、§5.2 第 20 条）。 只触发浏览器的标准丢失流程，不伪造事件，因此 main 的事件处理走真实路径。
  S.loseContext = function () {
    var ext = loseExt();
    if (!ext) return false;
    ext.loseContext();
    return true;
  };
  // 恢复上下文，用于验证 restored → resumeRunning 的路径（§4.11）。
  S.restoreContext = function () {
    var ext = loseExt();
    if (!ext) return false;
    ext.restoreContext();
    return true;
  };
  var throwArmed = 0;

  // 注入一次帧内异常（§5.3 钩子 throwOnce / §5.2 第 15 条）：下一次 main.frame 在 try 内抛出，
  // 走真实的 onFrameError 路径（10 s 内 3 次 → fatal(runtime)）。返回后由 main 消费一次。
  S.throwOnce = function () {
    if (!enabled) return;
    throwArmed++;
  };

  // 供 main.frame 消费一次注入（返回 true 表示本帧应抛错）。非调试模式恒为 false。
  S.takeThrow = function () {
    if (throwArmed > 0) { throwArmed--; return true; }
    return false;
  };

  // 直接把速度设到指定值（§5.3 钩子 setSpeed）。只改 bike.v，不改其它字段， 因此下一次 sim.step 会按正常物理继续演化。
  S.setSpeed = function (v) {
    var G = PB.main.state();
    if (!G) return;
    G.bike.v = Math.max(0, Math.min(CFG.SIM.V_MAX, Number(v) || 0));
  };
  // 直接把累计路程设到指定值（§5.3 钩子 setS）。用于道具/相位精度检查； 瞬移本身不作为判据（§5.2 第 19 条）。
  S.setS = function (value) {
    var G = PB.main.state();
    if (!G) return;
    var next = Number(value);
    if (!isFinite(next)) return;
    G.S = next;
    G.lastGood.S = next;
  };
  // 直接把抬轮角设到指定弧度（§5.3 钩子 setWheelie）。夹到 [0, 0.314]， 保证调试不会造出 sim 健康检查会立刻复位的状态。
  S.setWheelie = function (rad) {
    var G = PB.main.state();
    if (!G) return;
    var v = Number(rad);
    if (!isFinite(v)) return;
    G.bike.wheelie = Math.max(0, Math.min(CFG.SIM.WHEELIE_MAX, v));
  };
  // 读取棕榈实例当前的 z 列表：直接读 instanceMatrix.array（上传给 GPU 的 Float32 实例缓冲）。
  // 只有真正写进实例矩阵的值才算证据（§5.1 P4 的 [browser] 项 / ADR-21）；本模块不再提供任何镜像读数。
  S.propZs = function () {
    var out = [];
    for (var i = 0; i < CFG.WORLD.PALM_COUNT; i++) out.push(PB.world.palmZAt(i));
    return out;
  };

  // ==== P5–P8 追加：F13 读数与调试钩子 ====
  // 每帧读数（只在 ?debug=1 时由 main.frame 的 F13 写入；stats() 读最近一帧）
  var frameReadings = { beakErr: 0, footPedalErr: 0, lightDirErr: 0, starsInView: 0, fishMeshErr: 0, headVisErr: 0, dHead: 0, headHidden: false, fishAlive: 0 };
  var frozen = false;
  var _ld = { x: 0, y: 0, z: 0 };

  /**
   * F13 读数（§3.4）：AC-1d 的喙误差、§1.5 的脚-踏板误差、AC-3c 的三方光向差、AC-3b 的视锥内星点数。
   * 全部读真实渲染对象（matrixWorld / uniform / DirectionalLight），不做镜像。
   * @param {object} G 一局状态
   * @returns {void}
   */
  S.assertFrame = function (G) {
    if (!enabled) return;
    frameReadings.beakErr = PB.pelican.beakError(G);
    frameReadings.footPedalErr = PB.pelican.footPedalError(G);
    var env = G.env;
    var od = PB.ocean.uniformLightDir();
    PB.scene.lightDir(_ld);
    var e = 0;
    if (od) {
      e = Math.max(
        Math.abs(od.x - env.lightDir.x), Math.abs(od.y - env.lightDir.y), Math.abs(od.z - env.lightDir.z),
        Math.abs(_ld.x - env.lightDir.x), Math.abs(_ld.y - env.lightDir.y), Math.abs(_ld.z - env.lightDir.z),
        Math.abs(_ld.x - od.x), Math.abs(_ld.y - od.y), Math.abs(_ld.z - od.z)
      );
    }
    frameReadings.lightDirErr = e;
    frameReadings.starsInView = PB.sky.countStarsInView(PB.camera.object());

    // P9：AC-5a(i) —— 每条鱼的真实渲染节点 matrixWorld 平移与 f.pose 的最大偏差（≤1e-4）
    var worst = 0, alive = 0;
    for (var i = 0; i < G.fish.length; i++) {
      var f = G.fish[i];
      if (f.state === 'alive') alive++;
      var node = PB.fishview.nodeAt(i);
      if (!node || !node.matrixWorld) continue;
      var el = node.matrixWorld.elements;
      var dx = Math.abs(el[12] - f.pose.x), dy = Math.abs(el[13] - f.pose.y), dz = Math.abs(el[14] - f.pose.z);
      var d = Math.max(dx, dy, dz);
      if (d > worst) worst = d;
    }
    frameReadings.fishMeshErr = worst;
    frameReadings.fishAlive = alive;
    // P10：AC-8b —— 头部可见性不变式的累计违例与最近一帧的 dHead
    frameReadings.headVisErr = PB.camera.headViolations();
    frameReadings.dHead = PB.camera.distanceToHead();
    frameReadings.headHidden = !!G.cam.headHidden;
    // P9：pauseOnEvent —— 本帧出现指定事件时冻结时间，供截图定格（§5.3 的 S11）
    if (pauseType) {
      for (var k = 0; k < G.events.length; k++) {
        if (G.events[k].type === pauseType) {
          frozen = true;
          pausedOnType = pauseType;
          pauseType = null;
          break;
        }
      }
    }
    updateDebugShapes(G);
    // P14：burnMs 的忙等放在渲染之后、帧结束之前，因此下一帧的 rawDtMs 真实变长（AC-11a）
    if (burnMsPerFrame > 0) {
      var t0 = performance.now();
      while (performance.now() - t0 < burnMsPerFrame) { /* 故意空转：制造真实帧耗时 */ }
    }
  };

  /**
   * 冻结模拟时间（§5.3 截图通用条件）。冻结期间 dt = 0：物理/相位/围巾都不推进，渲染继续。
   * @param {boolean} b 是否冻结
   * @returns {void}
   */
  S.freezeTime = function (b) { if (enabled) frozen = !!b; };

  /**
   * @returns {boolean} 当前是否冻结时间
   */
  S.frozen = function () { return frozen; };

  /**
   * 飘带可见性（AC-1b(i) 的渲染差分钩子）：转调 pelican，只改 mesh.visible。
   * @param {boolean} v 是否可见
   * @returns {void}
   */
  S.setRibbonVisible = function (v) {
    if (enabled) PB.pelican.setRibbonVisible(v);
  };

  /**
   * 墨镜可见性（AC-1b(iii) 的渲染差分钩子，S4a/P10）：转调 pelican，只隐藏镜片与镜框。
   * @param {boolean} v 是否可见
   * @returns {void}
   */
  S.setGlassesVisible = function (v) {
    if (enabled) PB.pelican.setGlassesVisible(v);
  };

  /**
   * 直接设置昼夜相位（§4.2.1）：G.t = cycle·240 + p·240，不产生 cycleWrap。
   * @param {number} p 相位 [0,1)
   * @returns {void}
   */
  S.setPhase = function (p) {
    var G = PB.main.state();
    if (!G) return;
    var v = Number(p);
    if (!isFinite(v)) return;
    v = PB.mathx.clamp(v, 0, 0.999999);
    G.t = G.cycle * CFG.SIM.CYCLE_SECONDS + v * CFG.SIM.CYCLE_SECONDS;
    G.p = v;
    G.lastGood.t = G.t;
  };

  // ==== P9/P10/P11 追加：鱼、机位、成就与截图辅助钩子（§5.3）====
  var pauseType = null;         // pauseOnEvent 等待的事件类型（消费一次）
  var pausedOnType = null;      // 已经因该事件冻结（供测试确认）
  var shapeGroup = null, shapeBox = null, shapeSphere = null;

  /**
   * 在指定车道/高度/距离生成一条鱼（§5.3 spawnFish）。只调用 PB.fish.spawn，不写渲染对象。
   * @param {number} lane 车道 0..2
   * @param {boolean} high 是否高鱼
   * @param {number} dist 相对 G.S 的前方距离（米）
   * @returns {object|null} 新鱼
   */
  S.spawnFish = function (lane, high, dist) {
    if (!enabled) return null;
    var G = PB.main.state();
    if (!G) return null;
    return PB.fish.spawn(G, lane, high, dist);
  };

  /**
   * 等待某个事件类型出现时冻结时间（S11：pauseOnEvent('catch')）。只在 assertFrame 中消费一次。
   * @param {string} type 事件类型（如 'catch'）
   * @returns {void}
   */
  S.pauseOnEvent = function (type) {
    if (enabled) pauseType = String(type || '');
  };

  /**
   * @returns {string|null} 已因 pauseOnEvent 冻结的事件类型（未发生时为 null）
   */
  S.pausedOn = function () { return pausedOnType; };

  /**
   * 切换机位（§5.3 setCamera）。走真实的 camera.setMode（含 0.6 s 混合与 store 持久化）。
   * @param {number} i 机位 0..4
   * @returns {void}
   */
  S.setCamera = function (i) {
    if (!enabled) return;
    var G = PB.main.state();
    if (!G) return;
    PB.camera.setMode(i, G);
  };

  /**
   * 直接定位电影镜头（§5.3 setCineShot）。同时把机位切到 mode 2；t 是该镜头内的秒数（0..8）。
   * @param {number} k 镜头 0..2
   * @param {number} t 镜头内时间（秒）
   * @returns {void}
   */
  S.setCineShot = function (k, t) {
    if (!enabled) return;
    var G = PB.main.state();
    if (!G) return;
    if (G.cam.mode !== 2) PB.camera.setMode(2, G);
    G.cam.cineShot = Math.max(0, Math.min(2, k | 0));
    G.cam.cineT = Math.max(0, Math.min(CFG.CAM_CINE.shotSec, Number(t) || 0));
  };

  /**
   * 设置环绕机位（§5.3 setOrbit）。角度按度数传入（S6 写作 −90°,35°,14,true），内部转弧度。
   * @param {number} yawDeg 方位角（度）
   * @param {number} pitchDeg 俯仰（度，5..75）
   * @param {number} dist 距离（米，3..25）
   * @param {boolean} frozen 是否冻结自动环绕
   * @returns {void}
   */
  S.setOrbit = function (yawDeg, pitchDeg, dist, frozenOrbit) {
    if (!enabled) return;
    var G = PB.main.state();
    if (!G) return;
    if (G.cam.mode !== 4) PB.camera.setMode(4, G);
    var D2R = Math.PI / 180;
    G.cam.orbit.yaw = PB.mathx.clamp(Number(yawDeg) || 0, -180, 180) * D2R;
    G.cam.orbit.pitch = PB.mathx.clamp(Number(pitchDeg) || 18,
      CFG.CAM_ORBIT_DEFAULT.pitchMinDeg, CFG.CAM_ORBIT_DEFAULT.pitchMaxDeg) * D2R;
    G.cam.orbit.dist = PB.mathx.clamp(Number(dist) || 9, CFG.CAM_ORBIT_DEFAULT.distMin, CFG.CAM_ORBIT_DEFAULT.distMax);
    G.cam.orbit.frozen = !!frozenOrbit;
    G.cam.orbit.lastInteractT = performance.now() / 1000;
  };

  /**
   * 解锁一个成就（仅用于 S8 的面板演示；其余成就必须由真实条件触发）。
   * @param {string} id 成就 id
   * @returns {void}
   */
  S.unlockAch = function (id) {
    if (!enabled) return;
    PB.achievements.unlock(id, PB.main.state());
  };

  /**
   * 打开/关闭调试形体（§5.3 showDebugShapes）：捕获框与喙尖标记球。
   * 捕获框必须画成**判定用的同一个体积**（§4.4.3 / AC-5a(iv)）：`fish.canCatch` 比较的是
   * 世界坐标下 `|pose.x − beakW.x| < CATCH_X`、`|pose.y − beakW.y| ≤ CATCH_Y`、`|pose.z − beakW.z|`，
   * 即"以 beakW 为心、轴向与世界轴对齐"的盒子。因此这里不能拿 rig.M（其平移是后轮着地点/地面）当锚点，
   * 也不能把盒子随 rig 旋转——那画出来的是另一个体积，S11 会与真实判定对不上（Q-17）。
   * @param {boolean} b 是否显示
   * @returns {void}
   */
  S.showDebugShapes = function (b) {
    if (!enabled) return;
    if (!shapeGroup) {
      var F = CFG.FISH;
      shapeGroup = new THREE.Group();
      shapeBox = new THREE.Group();
      shapeBox.matrixAutoUpdate = false;   // 矩阵每帧由 updateDebugShapes 写成"平移 beakW + 无旋转"
      var box = new THREE.BoxGeometry(2 * F.CATCH_X, 2 * F.CATCH_Y, 2 * F.CATCH_Z);
      shapeBox.add(new THREE.LineSegments(new THREE.EdgesGeometry(box),
        new THREE.LineBasicMaterial({ color: 0x22ff88 })));
      shapeGroup.add(shapeBox);
      shapeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff3300 }));
      shapeGroup.add(shapeSphere);
      shapeGroup.visible = false;
      PB.scene.scene().add(shapeGroup);
    }
    shapeGroup.visible = !!b;
  };

  /**
   * 每帧把调试形体摆到当前判定体积上（assertFrame 调用）。
   * 捕获框 = 世界轴对齐、中心 `G.rig.beakW`、半尺寸 `CFG.FISH.CATCH_{X,Y,Z}`（与 `fish.canCatch` 同源）；
   * 标记球落在 beakW 本身，因此球心与框心永远重合，可用来目检"框有没有跟着头动"。
   * @param {object} G 一局状态
   * @returns {void}
   */
  function updateDebugShapes(G) {
    if (!shapeGroup || !shapeGroup.visible) return;
    var b = G.rig.beakW;
    shapeBox.matrix.makeTranslation(b.x, b.y, b.z);
    shapeBox.matrixWorldNeedsUpdate = true;
    shapeSphere.position.set(b.x, b.y, b.z);
  }

  /**
   * 调试用：隐藏/恢复全部鱼（S11 做真实渲染差分，取证"鱼确实画在捕获框里"）。
   * @param {boolean} v false 为隐藏
   * @returns {void}
   */
  S.setFishVisible = function (v) {
    if (enabled) PB.fishview.setHidden(!v);
  };

  /**
   * 判定体积的只读读数（S11 的脚本判定与人工复核用）：框中心、半尺寸，以及一条给定鱼
   * 是否真的落在与 `fish.canCatch` 相同的三个条件里（不含跨平面补充判据，那条只影响高速穿帧）。
   * @param {object} f 鱼（可选；给了就同时返回它的包含判定）
   * @returns {{center:{x:number,y:number,z:number}, half:{x:number,y:number,z:number}, fish:object|null}|null}
   */
  S.catchVolumeState = function (f) {
    if (!enabled) return null;
    var G = PB.main.state();
    if (!G) return null;
    var F = CFG.FISH, b = G.rig.beakW;
    var out = {
      center: { x: b.x, y: b.y, z: b.z },
      half: { x: F.CATCH_X, y: F.CATCH_Y, z: F.CATCH_Z },
      fish: null
    };
    if (f && f.pose) {
      out.fish = {
        pose: { x: f.pose.x, y: f.pose.y, z: f.pose.z },
        dx: Math.abs(f.pose.x - b.x), dy: Math.abs(f.pose.y - b.y), dz: Math.abs(f.pose.z - b.z),
        insideXY: Math.abs(f.pose.x - b.x) < F.CATCH_X && Math.abs(f.pose.y - b.y) <= F.CATCH_Y,
        insideZ: Math.abs(f.pose.z - b.z) < F.CATCH_Z
      };
    }
    return out;
  };

  /**
   * 显示/隐藏 HUD（§5.3 截图通用条件：HUD 隐藏）。只切 #hud 的 display，不改任何状态；
   * overlay 与成就面板也在 #hud 内，因此只用于截图/像素判定场景。
   * @param {boolean} b 是否可见
   * @returns {void}
   */
  S.setHudVisible = function (b) {
    if (!enabled) return;
    var el = document.getElementById('hud');
    if (el) el.style.display = b ? '' : 'none';
  };

  // ==== P10 追加：路灯亮度冻结（S3b 的真实渲染差分）====
  // lampForce 为 null 表示"跟随 G.env.lamps"；数字表示冻结在该亮度。
  // 真正的写入点仍是 PB.world.setLamps（唯一写者），main 的 F8 每帧经 lampValue 取值。
  var lampForce = null;

  /**
   * 冻结路灯亮度（§5.3 钩子 forceLamps；S3b 用）。
   * @param {number|null} x 0..1 的亮度；null/undefined 恢复 G.env.lamps 驱动
   * @returns {void}
   */
  S.forceLamps = function (x) {
    if (!enabled) return;
    if (x === null || x === undefined) { lampForce = null; return; }
    var v = Number(x);
    if (!isFinite(v)) return;
    lampForce = v < 0 ? 0 : (v > 1 ? 1 : v);
  };

  /**
   * 供 main 的 F8 取值：有冻结值时返回冻结值，否则返回环境亮度。
   * @param {number} envLamps G.env.lamps
   * @returns {number} 本帧要写入 world.setLamps 的亮度
   */
  S.lampValue = function (envLamps) {
    return lampForce === null ? envLamps : lampForce;
  };

  // ==== P14 追加：画质与性能注入 ====
  var burnMsPerFrame = 0;

  /**
   * 强制画质等级（§5.3 钩子 forceQuality）。走真实的应用路径（scene.applyQuality）。
   * @param {number} l 等级 0..3
   * @returns {void}
   */
  S.forceQuality = function (l) {
    if (!enabled) return;
    var lvl = PB.quality.force(Number(l), performance.now() / 1000);
    PB.scene.applyQuality(lvl);
  };

  /**
   * 每帧额外消耗 ms 毫秒（§5.3 钩子 burnMs；AC-11a 的降级触发）。
   * 在 F13 的 assertFrame 里忙等，因此下一帧的 rawDtMs 会真实变长，画质窗口看到的是真实帧时长。
   * @param {number} ms 每帧忙等毫秒数；0 取消
   * @returns {void}
   */
  S.burnMs = function (ms) {
    if (!enabled) return;
    var v = Number(ms);
    burnMsPerFrame = isFinite(v) && v > 0 ? v : 0;
  };

  /**
   * 注入一个非有限值（§5.3 钩子 injectNaN；§5.2 第 9 条）。
   * 只改一个字段，之后由真实的 sim.healthCheck / scarf 复位路径自愈。
   * @param {string} target bike | scarf | fish | laneT | laneToX
   * @returns {boolean} 是否真的注入
   */
  S.injectNaN = function (target) {
    if (!enabled) return false;
    var G = PB.main.state();
    if (!G) return false;
    if (target === 'bike') { G.bike.v = NaN; return true; }
    if (target === 'laneT') { G.bike.laneT = NaN; return true; }
    if (target === 'laneToX') { G.bike.laneToX = NaN; return true; }
    if (target === 'scarf') {
      // 第 1 行的第一个粒子位置写 NaN：scarf.step 的有限性检查会复位并累加 scarfResets
      if (!G.scarf || !G.scarf.P) return false;
      G.scarf.P[0] = NaN;
      return true;
    }
    if (target === 'fish') {
      // 先确保场上有一条结构完整的鱼（直接 push 半个对象会让 fish.step 在自愈前就读到 undefined 字段，
      // 那不是"数值健康检查自愈"的语义），再把它的里程 s 写成 NaN：
      // pose 由 s 计算，因此当步 pose 就变成非有限，healthCheck 会把这条鱼删除并计数。
      if (!G.fish.length) PB.fish.spawn(G, 1, false, 30);
      if (!G.fish.length) return false;
      G.fish[0].s = NaN;
      return true;
    }
    return false;
  };

  /**
   * 调试形体的世界坐标读数（S11/S13 的脚本判定用）。
   * @returns {{visible:boolean, sphere:{x:number,y:number,z:number}, box:{x:number,y:number,z:number}}|null}
   */
  S.debugShapeState = function () {
    if (!shapeGroup) return null;
    return {
      visible: shapeGroup.visible,
      sphere: { x: shapeSphere.position.x, y: shapeSphere.position.y, z: shapeSphere.position.z },
      // 框的平移分量 = 判定体积中心（矩阵只含平移，不含旋转，见 updateDebugShapes）
      box: { x: shapeBox.matrix.elements[12], y: shapeBox.matrix.elements[13], z: shapeBox.matrix.elements[14] },
      // 框是否为"无旋转的世界轴对齐盒"：旋转部分的三个对角元必须都是 1、其余为 0
      axisAligned: shapeBox.matrix.elements[0] === 1 && shapeBox.matrix.elements[5] === 1 &&
        shapeBox.matrix.elements[10] === 1 && shapeBox.matrix.elements[1] === 0 && shapeBox.matrix.elements[2] === 0 &&
        shapeBox.matrix.elements[4] === 0 && shapeBox.matrix.elements[6] === 0 &&
        shapeBox.matrix.elements[8] === 0 && shapeBox.matrix.elements[9] === 0
    };
  };
})(window.PB = window.PB || {});
