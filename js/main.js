// TASK-002 P1: 应用入口与状态机（plan.md §4.11 M-13、§3.4 帧序、§3.6 生命周期）。
// 本包实现：boot 检测顺序、三态互斥、ctxlost 恢复路径、fatal 路径、帧循环骨架（F0/F1/F13/F14）
// 与调试挂载。尚未接线的帧步（F2–F12）本包不调用，也不留占位函数（§5.1「只接线已存在的模块」）。
(function (PB) {
  'use strict';
  var CFG = PB.config;
  var S = PB.main = {};
  // app 由 main 独占写（M-23）：state / ctxLostAt / postRestoreFrames / last / acc / glVersion
  S.app = {
    state: 'boot',          // boot | running | ctxlost | fatal
    ctxLostAt: 0,
    postRestoreFrames: 0,
    last: 0,
    acc: 0,
    glVersion: 0,
    fatalKind: null,        // noWebGL | vendorMissing | runtime
    fatalMessage: ''
  };
  // health 是会话级计数器，softReset 不触碰（M-28）
  S.health = {
    errors: [],             // 最近 10 s 内的帧错误时间戳
    nanResets: 0,
    scarfResets: 0,
    softResets: 0,
    nanWindow: []
  };
  var canvas = null;
  var rafId = 0;
  var running = false;
  // F2/F3 的复用对象（M-31：稳态帧不新建对象；只有 edge 是事件对象，允许新建）
  var inp = { held: { throttle: false, brake: false, left: false, right: false, jump: false, wing: false }, anyHeld: false, activity: false, now: 0 };
  var uiQ = [];
  var lastInputRepairs = 0;
  // F5 的复用对象：sim edge 数组与 Cmd（M-31 稳态不新建）
  var simEdges = [];
  var EMPTY_EDGES = [];
  var cmd = { throttle: false, brake: false, laneDelta: 0, jumpPress: false, wing: false };
  var G = null;                 // 一局状态（P4 起由 newSession 创建，M-33）

  /**
   * 把 §4.9 的门写给音频模块（M-18）：gate = (app.state === 'running') && !document.hidden。
   * 调用点只有状态变化处：enterFatal、resumeRunning、ctxlost、visibilitychange。
   * audio 不读 app，所以这里必须每次变化都推一次。
   *
   * @returns {void}
   */
  function syncAudioGate() {
    PB.audio.setGate(S.app.state === 'running' && !document.hidden);
  }
  // 进入 fatal。三态互斥由调用点保证：置 state 后不会再进入 ctxlost， 且 running 循环停止（§4.11 表格「循环：停」）。
  function enterFatal(kind, message) {
    S.app.state = 'fatal';
    S.app.fatalKind = kind;
    S.app.fatalMessage = message || '';
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    // M-17：进入 fatal 必须清空输入，避免恢复后残留按住状态
    PB.input.clearAll('fatal');
    syncAudioGate();                 // §4.11 表格：fatal 时音频门关闭（M-18）
    PB.hud.invalidateOverlay();
    PB.hud.updateOverlay(S.app);
  }
  // 回到 running 的唯一入口（M-32）。调用者只有三处：visible 且原本 running、 webglcontextrestored、fatal(runtime) 的[重试]。 步骤：重置计时基准 → 清空输入 → 丢弃画质窗口 → 隐藏 overlay → 重算音频门。 本包尚无 input/quality/audio 模块，因此只执行已接线的步骤；后续包在对应位置追加调用， 不得改变本函数的顺序（§4.11）。
  S.resumeRunning = function (reason) {
    S.app.state = 'running';
    S.app.last = performance.now();
    S.app.acc = 0;
    // 步骤2（§4.11）：清空输入并标记活动，使页面重新可见后 6 s 内不会进入 AUTO（AC-12d）
    PB.input.clearAll(reason);
    PB.input.markActivity(S.app.last / 1000);
    // 步骤3（§4.10）：恢复瞬间的帧时长不代表稳态负载，丢弃当前画质窗口
    PB.quality.discardWindow(S.app.last / 1000);
    // 步骤4（§4.9 M-18）：重算音频门
    syncAudioGate();
    PB.hud.invalidateOverlay();
    PB.hud.updateOverlay(S.app);
    if (!running) {
      running = true;
      rafId = requestAnimationFrame(frame);
    }
  };
  // fatal(runtime) 的[重试]：清空 errors 计数后重新进入 running（§4.11「重试」）。 不改动 health.nanResets / scarfResets（M-28 的会话级计数）。
  S.retryRuntime = function () {
    if (S.app.state !== 'fatal' || S.app.fatalKind !== 'runtime') return;
    S.health.errors.length = 0;
    S.resumeRunning('retry');
  };
  // 帧内异常处理（§4.11 onFrameError）。10 s 内累计 3 次、或处于恢复后 3 帧内， 进入 fatal(runtime)；否则记为软错误并继续运行。
  S.onFrameError = function (e) {
    var now = performance.now();
    S.health.errors.push(now);
    // 步骤1：只保留 10 s 窗口内的错误时间戳（§4.11）
    while (S.health.errors.length && now - S.health.errors[0] > CFG.ERROR_WINDOW_MS) S.health.errors.shift();
    // 步骤2：恢复后 3 帧内再抛错，说明恢复不完整，直接 fatal（§4.11 ctxlost→fatal 分支）
    if (S.app.postRestoreFrames > 0 || S.health.errors.length >= CFG.ERROR_STRIKES) {
      enterFatal('runtime', String((e && e.message) || e));
      return;
    }
    // 步骤3：未达阈值 → 软复位并继续运行（§4.11）。会话重建只经 newSession（M-33）。
    S.softReset();
    S.health.softResets++;
  };
  // 注册窗口与画布级监听（§4.11 hidden / ctxlost / restored / resize / pagehide）。
  function attachListeners() {
    // §4.9 音频解锁：第一次 isTrusted 的 pointerdown / keydown / touchend / click 时创建 AudioContext。
    // 用 capture + passive，不改变任何默认行为；unlock 自身幂等，所以不需要移除监听。
    var unlockEvents = ['pointerdown', 'keydown', 'touchend', 'click'];
    for (var u = 0; u < unlockEvents.length; u++) {
      (function (type) {
        window.addEventListener(type, function (ev) {
          if (ev && ev.isTrusted) PB.audio.unlock();
        }, { capture: true, passive: true });
      })(unlockEvents[u]);
    }
    // hidden：不改变 state，只丢弃计时基准，回来后首帧不补跑物理（§5.2 第 5 条）。
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        S.app.last = 0;
        S.app.acc = 0;
        syncAudioGate();          // §4.9：hidden 时音频门关闭（AC-9c）
      } else if (S.app.state === 'running') {
        S.resumeRunning('visible');
      } else {
        syncAudioGate();
      }
    });
    // ctxlost：preventDefault 才能收到 restored；fatal 时忽略（§4.11）
    canvas.addEventListener('webglcontextlost', function (e) {
      if (S.app.state === 'fatal') return;
      e.preventDefault();
      S.app.state = 'ctxlost';
      S.app.ctxLostAt = performance.now();
      PB.input.clearAll('ctxlost');   // M-17
      syncAudioGate();                // §4.11 表格：ctxlost 时音频门关闭（M-18）
      PB.hud.invalidateOverlay();
      PB.hud.updateOverlay(S.app);
    });
    // restored：预编译两种海面材质属 P8；本包只恢复状态并走 resumeRunning（§4.11）
    canvas.addEventListener('webglcontextrestored', function () {
      if (S.app.state === 'fatal') return;
      S.app.postRestoreFrames = CFG.POST_RESTORE_FRAMES;
      PB.ocean.precompile();     // P8：恢复后两种海面材质必须已就绪（§4.11）
      S.resumeRunning('restored');
    });
    window.addEventListener('resize', function () {
      PB.scene.resize();
    });
    // pagehide：flush 持久化；clearAll 属 P3（§3.5 teardown）
    window.addEventListener('pagehide', function () {
      PB.store.flush();
    });
  }
  // 帧循环（§3.4 的 F0–F14；本包只接线 F0、F1、F13、F14）。 整帧包在 try/catch 中，异常交给 onFrameError（§4.11）。
  function frame(now) {
    rafId = requestAnimationFrame(frame);
    try {
      // F0：非 running 时只更新 overlay 并返回；ctxlost 下 rAF 继续空转，fatal 时循环已停。
      if (S.app.state !== 'running') {
        PB.hud.updateOverlay(S.app);
        return;
      }
      // F1：算 dt。last 为 0（首帧或刚恢复）时不产生大步长。
      var rawDtMs = S.app.last ? now - S.app.last : 0;
      S.app.last = now;
      var dt = Math.min(rawDtMs / 1000, CFG.DT_MAX);
      if (dt < 0) dt = 0;
      PB.debug.recordFrame(rawDtMs);
      // P7 追加：freezeTime(true) 时冻结模拟时间（截图用；渲染与镜头仍每帧执行，§5.3）
      if (PB.debug.frozen()) dt = 0;
      // 调试注入的帧内异常（§5.3 throwOnce）：走真实 try/catch → onFrameError 路径
      if (PB.debug.takeThrow()) throw new Error('debug throwOnce');

      var nowSec = now / 1000;
      // F2：输入快照（held / anyHeld / activity 脉冲，读后清除）
      PB.input.snapshot(nowSec, inp);
      // 指针计数自检的修复折算进 health.nanResets（§4.5.3 的"输入修复"）
      var rep = PB.input.repairCount();
      if (rep !== lastInputRepairs) {
        S.health.nanResets += rep - lastInputRepairs;
        lastInputRepairs = rep;
      }
      // F3：UI edge 每帧消费，与固定步数无关（P10/P11/P12 的消费者在此接入；mute 属 P13）
      PB.input.takeUiEdges(uiQ);
      S.dispatchUi(uiQ);
      // F4：自动驾驶仲裁（先断开，再判断是否接管；§4.6.2）。F4 只在 running 帧执行（F0 已过滤）。
      PB.autopilot.arbitrate(G, inp, nowSec);
      // F5：固定步长循环。只有在 acc 至少够一步时才取出 sim 队列，
      // 否则 edge 留在队列里等下一次（M-26 / AC-6e）；第 2..N 步使用 EMPTY。
      S.app.acc += dt;
      if (S.app.acc < 0) S.app.acc = 0;
      var n = 0;
      var stepEdges = EMPTY_EDGES;
      if (S.app.acc >= CFG.H) stepEdges = PB.input.takeSimEdges(simEdges);
      while (S.app.acc >= CFG.H && n < CFG.MAX_STEPS) {
        // F5 指令：全有或全无——AUTO 时每步都由 autopilot.command 生成，否则用输入队列（§4.6.2）
        if (G.ap.engaged) PB.autopilot.command(G, CFG.H, cmd);
        else PB.input.toCommand(inp, n === 0 ? stepEdges : EMPTY_EDGES, G, cmd);
        PB.sim.step(G, cmd, CFG.H);
        PB.rig.compute(G);
        PB.fish.step(G, CFG.H);                      // P9：生成 → pose → 判定 → 迁移（读本步 G.rig）
        PB.scarf.step(G, CFG.H, S.health);           // P6：锚点读 G.rig（§4.1）
        PB.achievements.step(G, CFG.H);              // P11：累积型条件（§4.8）
        PB.sim.healthCheck(G, S.health);
        S.app.acc -= CFG.H;
        n++;
      }
      if (n === CFG.MAX_STEPS && S.app.acc >= CFG.H) S.app.acc = 0;   // 接受时间膨胀（M-09）
      // F6：昼夜采样（P7，§3.4）——只写 G.env
      PB.daynight.sample(G.t, G.env);
      // F7：事件消费（读后由 F14 清空）。成就先于 HUD，使同一帧的 toast 能读到新解锁状态（§3.4）。
      PB.achievements.onEvents(G);
      PB.audio.onEvents(G.events);              // P13：catch/jump/land/laneChange/achievement 音效
      PB.hud.onEvents(G.events);
      S.updateBest(G);
      // F8：环境 → 天空 → 海面 → 世界 → 角色 → 鱼（顺序见 §3.4）
      PB.scene.applyEnvironment(G.env);
      PB.sky.update(G);
      PB.ocean.update(G);
      PB.world.update(G);
      PB.world.setLamps(PB.debug.lampValue(G.env.lamps));   // P7：路灯亮度（P10 起可被 forceLamps 冻结）
      PB.pelican.update(G);
      PB.pelican.setNight(G.env.nightMix);  // P7：blob 阴影夜间因子
      PB.fishview.update(G);                // P9：只读 f.pose（M-10）
      // F9：镜头（5 种机位 + 混合 + POV 头部可见性，§4.7）
      PB.camera.update(G, dt);
      // F10：音频参数（BPM 目标、环境声、pad 截止；不创建节点）
      PB.audio.update(G, dt);
      // F11：画质自适应（窗口 1.5 s；返回新等级时应用一次，§4.10）
      var lvl = PB.quality.sample(rawDtMs, nowSec);
      if (lvl !== null) PB.scene.applyQuality(lvl);
      // F12：HUD（10 Hz 节流，§3.4）
      PB.hud.update(G);
      // F13：渲染
      var renderer = PB.scene.renderer();
      if (renderer) renderer.render(PB.scene.scene(), PB.camera.object());
      if (PB.debug.enabled()) PB.debug.assertFrame(G);   // F13：AC-1d/3c/3b 的读数（仅调试模式）
      // F14：清空事件（消费者在 F7 读取，属 P9/P11/P13）
      G.events.length = 0;
      if (S.app.postRestoreFrames > 0) S.app.postRestoreFrames--;
    } catch (e) {
      S.onFrameError(e);
    }
  }
  // 建一局新会话（M-33 唯一初始化路径）：先 sim.createState 建纯数据，再 initSession 按 §3.6 顺序 调用已接线模块的 initState。boot 与 softReset 都只能经本函数到达会话创建。
  S.newSession = function () {
    G = PB.sim.createState(CFG.SEED, { camMode: PB.store.get().settings.cam });
    S.initSession(G);
  };
  // 软复位（§4.11 / §3.5）：重建会话；health 是会话级计数器，不受影响（M-28）。鱼视图全部隐藏（§3.5）。
  S.softReset = function () {
    S.newSession();
    PB.fishview.hideAll();
  };
  /**
   * F3 的 UI edge 分发（§3.4）：按入队顺序处理，与固定步数无关。
   * 已接线的消费者：camNext/camSet → camera.setMode（P10）、mute → audio.setMuted + store（P13）、
   * achList/esc → 成就面板（P11）、触屏按钮（P15）复用同一批动作名。
   *
   * @param {Array<{act:string, n?:number}>} q 本帧 UI edge
   * @returns {void}
   */
  S.dispatchUi = function (q) {
    for (var i = 0; i < q.length; i++) {
      var e = q[i];
      if (e.act === 'camNext') {
        PB.camera.setMode((G.cam.mode + 1) % 5, G);
      } else if (e.act === 'camSet') {
        PB.camera.setMode(e.n, G);
      } else if (e.act === 'mute') {
        // 步骤1：翻转静音 → 音频模块立即生效（master 增益置 0 并经 shouldRun 挂起，§4.9）
        var next = !PB.store.get().settings.muted;
        PB.audio.setMuted(next);
        // 步骤2：唯一持久化点（M-29）；下次加载沿用（UD-5）
        PB.store.update(function (d) { d.settings.muted = next; });
        PB.hud.updateMute();
      } else if (e.act === 'achList') {
        PB.hud.toggleAchList();
      } else if (e.act === 'esc') {
        if (PB.hud.isAchOpen()) PB.hud.closeAchList();
      }
    }
  };
  /**
   * 最佳成绩（§3.5 main.updateBest）：只在超过已存最好成绩时经 store 写入（M-29）。
   * 写入频率受成绩增长限制，不在稳态帧路径上分配。
   *
   * @param {object} G 一局状态
   * @returns {void}
   */
  var lastBestT = -99;
  S.updateBest = function (G) {
    var best = PB.store.get().best;
    var pts = G.score.points, dist = G.S;
    // 得分只在真的变高时写；里程每帧都在增长，按 1 s 节流写库，避免稳态帧触发 localStorage 写入（M-31）。
    var needPts = pts > best.points;
    var needDist = dist > best.distance && (G.t - lastBestT >= 1);
    if (!needPts && !needDist) return;
    lastBestT = G.t;
    PB.store.update(function (d) {
      if (pts > d.best.points) d.best.points = pts;
      if (dist > d.best.distance) d.best.distance = dist;
    });
  };
  // 按 §3.6 的固定顺序初始化会话内的模块状态：rig（P4）→ scarf（P6，读 G.rig.anchorW）→ daynight（P7，Env 唯一分配者）。
  // 顺序不得调整；后续包（如 P9 的 fish 视图）只能追加到末尾。
  S.initSession = function (session) {
    PB.rig.initState(session);
    PB.scarf.initState(session);      // P6：依赖已就绪的 G.rig.anchorW（§3.6 第 2 步）
    PB.daynight.initState(session);   // P7：Env 的唯一分配者（§3.6 第 3 步）
  };
  S.state = function () { return G; };
  // 启动。检测顺序严格按 §4.11： 1) THREE 未定义 → fatal(vendorMissing)；2) 预创建上下文 → fatal(noWebGL)；3) 建 renderer。 boot 只调用一次；重复调用直接返回。
  S.boot = function () {
    if (S.app.state !== 'boot') return;
    canvas = document.getElementById('gl');
    if (!canvas) {
      enterFatal('runtime', 'missing canvas element #gl');
      return;
    }
    PB.debug.attach();
    PB.store.load();
    PB.achievements.init(PB.store);   // P11：解锁集合来自 store.doc（softReset 不重锁）
    // 步骤1：vendor 缺失优先判定，避免把"文件没复制"误报成"不支持 WebGL"（§4.11 第 1 条）
    if (typeof THREE === 'undefined') {
      enterFatal('vendorMissing');
      return;
    }
    // 步骤2/3：建上下文与 renderer；NoWebGLError → fatal(noWebGL)，版本矛盾 → fatal(runtime)
    try {
      var init = PB.scene.init(canvas);
      S.app.glVersion = init.glVersion;
    } catch (e) {
      if (e && e.name === 'NoWebGLError') {
        enterFatal('noWebGL');
      } else {
        enterFatal('runtime', String((e && e.message) || e));
      }
      return;
    }
    // 输入挂载必须在 resumeRunning 之前：resumeRunning 会调用 input.clearAll / markActivity
    PB.input.attach(window, document, canvas, document.getElementById('hud'));
    // 渲染侧单例与一局状态（§3.6：renderer/scene/各 mesh/相机在 boot 创建）
    PB.world.init(PB.scene.scene());
    PB.camera.init();
    PB.pelican.init(PB.scene.scene());
    PB.sky.init(PB.scene.scene());
    PB.ocean.init(PB.scene.scene());
    PB.fishview.init(PB.scene.scene());   // P9：鱼池（6 条，几何在 boot 预建）
    S.newSession();
    PB.ocean.precompile();     // 两种海面材质预编译（§4.11 / PR-4）
    // P13：静音镜像先于任何手势解锁写入（store 是唯一持久化点，UD-5）
    PB.audio.setMuted(PB.store.get().settings.muted);
    // P14：初始等级 = 粗指针 L1、其他 L2（§4.10）；lastChangeT = 启动时刻
    var coarse = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
    var initLvl = PB.quality.create(coarse ? CFG.QUALITY.COARSE_INIT : CFG.QUALITY.FINE_INIT, performance.now() / 1000);
    PB.scene.applyQuality(initLvl);
    PB.scene.watchResolution();   // §4.10：换显示器/浏览器缩放时重算 DPR
    PB.hud.initTouch();           // P15：粗指针设备或首次 touch 指针后显示触屏控件
    attachListeners();
    S.resumeRunning('boot');
  };
  // §3.2：main.js 最后加载，在 DOMContentLoaded 时启动（脚本在 body 末尾，DOM 已就绪时直接启动）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { S.boot(); });
  } else {
    S.boot();
  }
})(window.PB = window.PB || {});
