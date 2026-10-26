// TASK-002 P3: 输入（plan.md §4.5、M-16 指针按 id 映射、M-26 两条 edge 队列、M-17 清空时机、M-34 可信事件）。
// 本文件只做"事件 → 状态"的收集与排队：不读 G 的模拟状态（toCommand 的 G 由调用方传入），
// 不碰 DOM 布局，也不决定镜头/音频行为（那些由 main.dispatchUi 分派）。
(function (PB) {
  'use strict';
  var S = PB.input = {};
  // 动作集合（§4.5.1）。HELD 类有"按住"语义；UI 类只在按下时入 UI 队列。
  var HELD_ACTS = { throttle: 1, brake: 1, left: 1, right: 1, jump: 1, wing: 1 };
  var UI_ACTS = { camNext: 1, camSet: 1, mute: 1, achList: 1, esc: 1 };
  // 按下即产生 sim edge 的动作（§4.5.1 队列列）
  var SIM_EDGE_ACTS = { left: 1, right: 1, jump: 1 };
  // e.code → 动作（§4.5.1 表格逐字）
  var KEY_ACT = {
    KeyW: 'throttle', ArrowUp: 'throttle',
    KeyS: 'brake', ArrowDown: 'brake',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    Space: 'jump',
    KeyT: 'wing',
    KeyC: 'camNext',
    Digit1: 'camSet', Digit2: 'camSet', Digit3: 'camSet', Digit4: 'camSet', Digit5: 'camSet',
    KeyM: 'mute',
    KeyL: 'achList',
    Escape: 'esc'
  };
  var keyHeld = { throttle: 0, brake: 0, left: 0, right: 0, jump: 0, wing: 0 };
  var pressedCodes = Object.create(null);      // 已按下的 e.code，用于过滤 repeat 与重复计数
  var ptrMap = new Map();                      // pointerId → act（M-16）
  var ptrEls = new Map();                      // pointerId → 捕获元素（仅用于 clearAll 释放捕获）
  var ptrCount = { throttle: 0, brake: 0, left: 0, right: 0, jump: 0, wing: 0 };
  var uiQ = [];                                // UI edge 队列（每帧 F3 消费，M-26）
  var simQ = [];                               // sim edge 队列（只对首个固定步可见，M-26）
  var orbitPtrs = new Map();                   // pointerId → {x, y}（§4.5.3 画布手势）
  var wheelAccum = 0;                          // 滚轮累计（供 P10 的 orbit 镜头消费）
  var lastActivity = -Infinity;                // 最近一次可信输入的时间（秒）
  var activityPulse = false;                   // 帧内活动脉冲（F2 读取并清除）
  var repairs = 0;                             // 指针计数自检修复次数（main 折算进 health.nanResets）
  var attached = false;
  var win = null, doc = null, canvasEl = null, touchRootEl = null;
  var nowFn = function () { return performance.now() / 1000; };
  // 标记一次可信输入活动（§4.6.1）。写入的是"最近活动时间"与"本帧活动脉冲"， 自动驾驶在 F4 读脉冲后于本帧物理之前断开（AC-12c）。
  S.markActivity = function (nowSec) {
    lastActivity = nowSec;
    activityPulse = true;
  };
  S.activityAt = function () { return lastActivity; };
  // 生成一个 sim edge。edge 是事件对象，允许每帧新建（M-31 允许事件对象）。
  function simEdge(act) { return { act: act }; }
  // 生成一个 UI edge。camSet 需要携带机位号，其余动作只需动作名。
  function uiEdge(act, n) {
    return n === undefined ? { act: act } : { act: act, n: n };
  }
  // 键盘按下。步骤与约束见 §4.5.1： - isComposing 时只计活跃，不入任何队列（输入法组合输入不能触发动作） - repeat 只计活跃，不入队、不重复计数（长按不会连发） - 首次按下时：held 类计数 +1；sim 类入 sim 队列；UI 类入 UI 队列
  function onKeyDown(e) {
    if (e.isTrusted) S.markActivity(nowFn());
    var act = KEY_ACT[e.code];
    if (!act) return;
    // Space/方向键/Escape 必须 preventDefault：否则会滚动页面或触发浏览器行为（§4.5.1）
    if (e.code === 'Space' || e.code === 'Escape' || e.code.indexOf('Arrow') === 0) {
      if (e.preventDefault) e.preventDefault();
    }
    if (e.isComposing) return;
    if (e.repeat) return;
    if (pressedCodes[e.code]) return;
    pressedCodes[e.code] = true;
    if (HELD_ACTS[act]) keyHeld[act]++;
    if (SIM_EDGE_ACTS[act]) simQ.push(simEdge(act));
    if (UI_ACTS[act]) {
      if (act === 'camSet') {
        // Digit1–Digit5 → 机位 0–4（§4.5.1）
        uiQ.push(uiEdge('camSet', Number(e.code.slice(5)) - 1));
      } else {
        uiQ.push(uiEdge(act));
      }
    }
  }
  // 键盘抬起：只在确实按下过时递减，避免 blur 后补发 keyup 造成负数。
  function onKeyUp(e) {
    if (e.isTrusted) S.markActivity(nowFn());
    var act = KEY_ACT[e.code];
    if (!act) return;
    if (!pressedCodes[e.code]) return;
    delete pressedCodes[e.code];
    if (HELD_ACTS[act]) keyHeld[act] = Math.max(0, keyHeld[act] - 1);
  }
  // 指针按下。§4.5.3 的状态机： - 同一个 pointerId 重复按下直接返回（浏览器偶发重复事件） - 按钮类动作：setPointerCapture（失败不致命，包 try/catch）→ ptrMap + ptrCount +1 - left/right/jump 额外入 sim 队列；UI 类按钮只入 UI 队列，不计入 ptrCount
  function onPointerDown(e) {
    if (e.isTrusted) S.markActivity(nowFn());
    if (ptrMap.has(e.pointerId)) return;
    var btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (btn) {
      var act = btn.getAttribute('data-act');
      if (UI_ACTS[act]) {
        // 屏幕上的 🎥/🔊/🏆/× ：按下即入 UI 队列，不参与 held 计数（§4.5.1）
        uiQ.push(act === 'camSet' ? uiEdge('camSet', Number(btn.getAttribute('data-n')) || 0) : uiEdge(act));
        if (e.preventDefault) e.preventDefault();
        return;
      }
      if (!HELD_ACTS[act]) return;
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 捕获失败不影响计数路径 */ }
      ptrMap.set(e.pointerId, act);
      ptrEls.set(e.pointerId, btn);
      ptrCount[act]++;
      if (SIM_EDGE_ACTS[act]) simQ.push(simEdge(act));
      if (e.preventDefault) e.preventDefault();
      return;
    }
    // 画布：一指 orbit、两指 pinch（§4.5.3）。位置由 P10 的镜头读取，这里只记录。
    if (canvasEl && e.target === canvasEl) {
      try { canvasEl.setPointerCapture(e.pointerId); } catch (err) { /* 同上 */ }
      orbitPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }
  // 指针移动：只更新已跟踪的 orbit 指针位置；按钮状态由 capture 维持，不因移动改变。
  function onPointerMove(e) {
    if (e.isTrusted) S.markActivity(nowFn());
    var p = orbitPtrs.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
  }
  // 释放指针。pointerup / pointercancel / lostpointercapture 共用同一路径（§4.5.3）： 未跟踪的 id 直接返回；否则按 ptrCount 减 1（不低于 0）并删除映射。
  function releasePointer(e) {
    if (e.isTrusted) S.markActivity(nowFn());
    var act = ptrMap.get(e.pointerId);
    if (act !== undefined) {
      ptrMap.delete(e.pointerId);
      ptrEls.delete(e.pointerId);
      ptrCount[act] = Math.max(0, ptrCount[act] - 1);
    }
    orbitPtrs.delete(e.pointerId);
  }
  // 滚轮：累计 deltaY 供 orbit 镜头消费；同时计活跃（§4.6.1 wheel 属可信事件集合）。
  function onWheel(e) {
    if (e.isTrusted) S.markActivity(nowFn());
    wheelAccum += e.deltaY || 0;
  }
  // 组合输入：只计活跃，不入队列（§4.5.1 与 §4.6.1）。
  function onComposition(e) {
    if (e.isTrusted) S.markActivity(nowFn());
  }
  // 清空全部输入状态（§3.5 / M-17）。调用者：blur、visibilitychange→hidden、pagehide、 webglcontextlost、进入 fatal、resumeRunning。 释放所有指针捕获（try/catch，浏览器可能已自行释放）；两条队列一并清空。
  S.clearAll = function (reason) {
    for (var id in keyHeld) if (Object.prototype.hasOwnProperty.call(keyHeld, id)) keyHeld[id] = 0;
    pressedCodes = Object.create(null);
    ptrMap.forEach(function (act, pointerId) {
      var el = ptrEls.get(pointerId);
      if (el && el.releasePointerCapture) {
        try { el.releasePointerCapture(pointerId); } catch (e) { /* 浏览器可能已自行释放 */ }
      }
    });
    ptrMap.clear();
    ptrEls.clear();
    for (var k in ptrCount) if (Object.prototype.hasOwnProperty.call(ptrCount, k)) ptrCount[k] = 0;
    orbitPtrs.forEach(function (p, pointerId) {
      if (canvasEl && canvasEl.releasePointerCapture) {
        try { canvasEl.releasePointerCapture(pointerId); } catch (e) { /* 同上 */ }
      }
    });
    orbitPtrs.clear();
    uiQ.length = 0;
    simQ.length = 0;
    wheelAccum = 0;
    S.lastClearReason = reason || '';
  };
  // 每帧 F2 的快照：写入 held/anyHeld/activity，并清掉 activity 脉冲（读后清除）。 同时做指针计数自检（§4.5.3）：Σ ptrCount 与 ptrMap.size 不一致时按 ptrMap 重建， 并累加 repairs（main 在 F2 折算进 health.nanResets，记为"输入修复"）。
  S.snapshot = function (nowSec, out) {
    var sum = 0;
    for (var a in ptrCount) if (Object.prototype.hasOwnProperty.call(ptrCount, a)) sum += ptrCount[a];
    if (sum !== ptrMap.size) {
      // 步骤1：计数与映射不一致 → 以映射为真值重建，避免按钮"卡住"（§4.5.3）
      for (var b in ptrCount) if (Object.prototype.hasOwnProperty.call(ptrCount, b)) ptrCount[b] = 0;
      ptrMap.forEach(function (act) { ptrCount[act]++; });
      repairs++;
    }
    // 步骤2：held = 键盘计数 > 0 或 指针计数 > 0（§4.5.3）
    var any = false;
    for (var act in keyHeld) {
      if (!Object.prototype.hasOwnProperty.call(keyHeld, act)) continue;
      var on = keyHeld[act] > 0 || ptrCount[act] > 0;
      out.held[act] = on;
      if (on) any = true;
    }
    out.anyHeld = any;
    // 步骤3：活动脉冲读后清除；activityAt 仍保留绝对时间供 6 s 空闲判定（§4.6.1）
    out.activity = activityPulse;
    activityPulse = false;
    out.now = nowSec;
    return out;
  };
  // 取出 UI 队列（F3 每帧消费，与固定步数无关）。
  S.takeUiEdges = function (outArr) {
    outArr.length = 0;
    for (var i = 0; i < uiQ.length; i++) outArr.push(uiQ[i]);
    uiQ.length = 0;
    return outArr;
  };
  // 取出 sim 队列（只在本帧至少会执行 1 个固定步时调用，见 §3.4 F5）。 取出后队列清空，因此同一 edge 只对首个固定步可见（M-26 / AC-6e）。
  S.takeSimEdges = function (outArr) {
    outArr.length = 0;
    for (var i = 0; i < simQ.length; i++) outArr.push(simQ[i]);
    simQ.length = 0;
    return outArr;
  };
  // 把"输入快照 + 本步 edge"翻译成 sim 的 Cmd（§4.5.1 合并规则）： laneDelta = clamp(#right − #left, −2, 2)；任一 jump edge → jumpPress； 按住重复变道：恰好一个方向 held、laneT === 1、距上次请求 ≥0.45 s 时再发 ±1。 发出变道请求时写 G.bike.lastLaneReqT（§3.5 toCommand 的副作用）。
  S.toCommand = function (inp, edges, G, out) {
    var left = 0, right = 0, jump = false;
    for (var i = 0; i < edges.length; i++) {
      var act = edges[i].act;
      if (act === 'left') left++;
      else if (act === 'right') right++;
      else if (act === 'jump') jump = true;
    }
    var delta = right - left;
    // 按住重复（§4.5.2 末条）：方向键长按按 0.45 s 节奏重复请求变道
    var hl = inp.held.left ? 1 : 0;
    var hr = inp.held.right ? 1 : 0;
    if (hl + hr === 1 && G.bike.laneT === 1 && G.t - G.bike.lastLaneReqT >= 0.45) {
      delta += hr ? 1 : -1;
      G.bike.lastLaneReqT = G.t;
    }
    out.throttle = !!inp.held.throttle;
    out.brake = !!inp.held.brake;
    out.laneDelta = Math.max(-2, Math.min(2, delta));
    out.jumpPress = jump;
    out.wing = !!inp.held.wing;
    return out;
  };
  S.takeWheel = function () {
    var v = wheelAccum;
    wheelAccum = 0;
    return v;
  };
  // 指针计数自检的累计修复次数。main 在 F2 读取差值并折算进 health.nanResets； 单独提供是因为 S.stats() 会新建对象，不能出现在稳态帧路径上（M-31）。
  S.repairCount = function () { return repairs; };
  S.orbitPointers = function () { return orbitPtrs; };
  // 供 debug.stats() 使用的只读读数（§5.3 的 heldSet/ptrMapSize/ptrCountSum/orbitPtrs）。 不消费任何队列、不清活动脉冲，因此可以在任意时刻调用。
  S.stats = function () {
    var heldSet = [];
    for (var act in keyHeld) {
      if (!Object.prototype.hasOwnProperty.call(keyHeld, act)) continue;
      if (keyHeld[act] > 0 || ptrCount[act] > 0) heldSet.push(act);
    }
    var sum = 0;
    for (var a in ptrCount) if (Object.prototype.hasOwnProperty.call(ptrCount, a)) sum += ptrCount[a];
    return {
      heldSet: heldSet,
      ptrMapSize: ptrMap.size,
      ptrCountSum: sum,
      orbitPtrs: orbitPtrs.size,
      repairs: repairs,
      lastActivitySec: isFinite(lastActivity) ? lastActivity : null
    };
  };
  // 注册全部输入监听（§3.5 input.attach）。只调用一次；重复调用直接返回。 监听分三层： 1) 动作层（keydown/keyup、按钮 pointerdown）：决定 held 与两条队列； 2) 可信活动层（window capture + passive，§4.6.1 / M-34）：任何 isTrusted 输入都刷新活动时间， 即使 HUD/面板 stopPropagation 也拦不住（capture 在捕获阶段先跑）； 3) 清理层（pointerup/cancel/lostpointercapture、blur、visibilitychange、pagehide）。
  S.attach = function (windowObj, documentObj, canvas, touchRoot) {
    if (attached) return;
    attached = true;
    win = windowObj; doc = documentObj; canvasEl = canvas; touchRootEl = touchRoot;
    nowFn = function () { return win.performance.now() / 1000; };
    win.addEventListener('keydown', onKeyDown, { capture: true });
    win.addEventListener('keyup', onKeyUp, { capture: true });
    // 可信活动层：passive 只为"读"，不改变默认行为（§4.6.1）
    var activityEvents = ['keydown', 'keyup', 'compositionstart', 'compositionupdate', 'compositionend',
      'pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'wheel', 'touchstart', 'touchmove', 'touchend'];
    for (var i = 0; i < activityEvents.length; i++) {
      (function (type) {
        win.addEventListener(type, function (e) { if (e.isTrusted) S.markActivity(nowFn()); }, { capture: true, passive: true });
      })(activityEvents[i]);
    }
    if (touchRootEl) {
      touchRootEl.addEventListener('pointerdown', onPointerDown, { capture: true });
      touchRootEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    if (canvasEl) {
      canvasEl.addEventListener('pointerdown', onPointerDown, { capture: true });
      canvasEl.addEventListener('pointermove', onPointerMove, { capture: true });
      canvasEl.addEventListener('wheel', onWheel, { capture: true, passive: true });
      canvasEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    // 释放路径挂 window：拖出按钮后松开、系统打断（lostpointercapture）都能清掉（§5.2 第 2 条）
    win.addEventListener('pointerup', releasePointer, { capture: true });
    win.addEventListener('pointercancel', releasePointer, { capture: true });
    win.addEventListener('lostpointercapture', releasePointer, { capture: true });
    win.addEventListener('blur', function () { S.clearAll('blur'); });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) S.clearAll('hidden'); });
    win.addEventListener('pagehide', function () { S.clearAll('pagehide'); });
  };
  // 供测试与调试判断是否已挂载。
  S.isAttached = function () { return attached; };
})(window.PB = window.PB || {});
