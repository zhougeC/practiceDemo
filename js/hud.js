// TASK-002 P1: HUD 与三态 overlay（plan.md §4.11 M-13、§3.5 hud 签名）。
// 本包只实现 overlay（三态互斥、只有一个 overlay 元素）；速度/得分等 HUD 项由 P9/P11 追加。
(function (PB) {
  'use strict';

  var CFG = PB.config;
  var S = PB.hud = {};

  var overlayEl = null;
  var msgEl = null;
  var actionsEl = null;
  var lastKey = '';        // 上一次写入的 overlay 状态签名，避免每帧重建 DOM（M-31）

  /**
   * 取 overlay 相关 DOM。index.html 提供容器，hud 只写内容，不创建结构，
   * 这样 §4.11 的"只有一个 overlay"在 DOM 层也成立。
   *
   * @returns {{root: HTMLElement, msg: HTMLElement, actions: HTMLElement}|null} 缺失时为 null
   */
  function els() {
    if (overlayEl && msgEl && actionsEl) return { root: overlayEl, msg: msgEl, actions: actionsEl };
    overlayEl = document.getElementById('overlay');
    msgEl = document.getElementById('ov-msg');
    actionsEl = document.getElementById('ov-actions');
    if (!overlayEl || !msgEl || !actionsEl) return null;
    return { root: overlayEl, msg: msgEl, actions: actionsEl };
  }

  /**
   * 生成一个 overlay 按钮。事件用 addEventListener 绑定，按钮本身不进入输入队列
   * （overlay 处于 fatal/ctxlost 时输入全部关闭，§4.11 表格）。
   *
   * @param {string} label 按钮文案
   * @param {function(): void} onClick 点击回调
   * @returns {HTMLButtonElement} 未挂载的按钮
   */
  function makeButton(label, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ov-btn';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  /**
   * 按当前应用状态写 overlay（§4.11 表格逐字文案）。
   * 三态互斥：running 隐藏；ctxlost 与 fatal 各自只有一份文案，不会叠加。
   * 只在状态签名变化时重建 DOM（M-31：稳态帧不新建对象）。
   *
   * @param {{state: string, ctxLostAt: number, fatalKind?: string, fatalMessage?: string}} app 应用状态
   * @returns {void}
   */
  S.updateOverlay = function (app) {
    var el = els();
    if (!el) return;

    // 步骤1：按状态算目标文案与动作集合，先算签名用于去抖。
    var text = '';
    var actions = [];
    var visible = true;

    if (app.state === 'running') {
      visible = false;
    } else if (app.state === 'ctxlost') {
      text = CFG.OVERLAY_TEXT.ctxlost;
      // 步骤2：ctxlost 满 8 s 才追加[重新加载]（§4.11），未满时只有文案。
      if (performance.now() - app.ctxLostAt >= CFG.CTX_LOST_BUTTON_MS) {
        actions.push(CFG.OVERLAY_TEXT.reload);
      }
    } else if (app.state === 'fatal') {
      var kind = app.fatalKind;
      if (kind === 'noWebGL') {
        text = CFG.OVERLAY_TEXT.noWebGL;
      } else if (kind === 'vendorMissing') {
        text = CFG.OVERLAY_TEXT.vendorMissing;
      } else {
        // fatal(runtime)：前缀 + ≤120 字符摘要，附[重试]与[重新加载]（§4.11）。
        var summary = String(app.fatalMessage || 'unknown');
        if (summary.length > CFG.OVERLAY_ERR_MAX) summary = summary.slice(0, CFG.OVERLAY_ERR_MAX);
        text = CFG.OVERLAY_TEXT.runtimePrefix + summary;
        actions.push(CFG.OVERLAY_TEXT.retry, CFG.OVERLAY_TEXT.reload);
      }
    }

    // 步骤3：签名不变则只更新可见性，不重建按钮（避免每帧丢弃/新建 DOM 节点）。
    var key = visible ? (app.state + '|' + (app.fatalKind || '') + '|' + text + '|' + actions.join(',')) : 'hidden';
    if (key === lastKey) return;
    lastKey = key;

    if (!visible) {
      el.root.hidden = true;
      el.msg.textContent = '';
      el.actions.textContent = '';
      return;
    }

    el.root.hidden = false;
    el.msg.textContent = text;
    el.actions.textContent = '';
    for (var i = 0; i < actions.length; i++) {
      var label = actions[i];
      // 步骤4：两个按钮的回调各自独立。重试走 main.retryRuntime，重新加载走 location.reload。
      el.actions.appendChild(makeButton(label, label === CFG.OVERLAY_TEXT.retry
        ? function () { PB.main.retryRuntime(); }
        : function () { window.location.reload(); }));
    }
  };

  /**
   * 强制下一次 updateOverlay 重建 DOM（用于 fatal→running 等需要清空按钮的转移）。
   *
   * @returns {void}
   */
  S.invalidateOverlay = function () { lastKey = ''; };

  // ==== P9/P10/P11/P12 追加：HUD 七项、静音状态、toast 与成就面板（§1.5、§4.8）====
  // 只写 DOM 文本，不做任何模拟/状态写入（M-23）；DOM 更新节流到 10 Hz（§3.4 F12）。
  var HUD_MS = 100;
  var CAM_NAMES = ['追尾', '侧视', '电影', '第一人称', '环绕'];   // 机位名（HUD 文案属 MAY）
  var TOAST_MS = 3500, TOAST_FADE_MS = 300;
  var refsCache = null;
  var lastHudMs = -1e9;
  var toastQueue = [];
  var toastActive = null;
  var wired = false;

  /**
   * 取 HUD/面板的 DOM 引用（懒绑定；index.html 提供结构，hud 只写内容）。
   * @returns {object|null} 引用集合；缺失关键节点时为 null
   */
  function refs() {
    if (refsCache) return refsCache;
    refsCache = {
      speed: document.getElementById('hud-speed'),
      score: document.getElementById('hud-score'),
      fish: document.getElementById('hud-fish'),
      combo: document.getElementById('hud-combo'),
      auto: document.getElementById('hud-auto'),
      ach: document.getElementById('hud-ach'),
      cam: document.getElementById('hud-cam'),
      mute: document.getElementById('hud-mute'),
      toast: document.getElementById('hud-toast'),
      panel: document.getElementById('ach-panel'),
      rows: document.getElementById('ach-rows'),
      count: document.getElementById('ach-count'),
      reset: document.getElementById('ach-reset')
    };
    if (!refsCache.speed) return null;
    return refsCache;
  }

  /**
   * 只在文本变化时写 DOM（避免每帧丢弃子节点，M-31）。
   * @param {HTMLElement} el 目标节点
   * @param {string} text 文本
   * @returns {void}
   */
  function setText(el, text) {
    if (!el || el.__t === text) return;
    el.__t = text;
    el.textContent = text;
  }

  /**
   * 一次性绑定面板上的重置按钮（confirm 之后再清空成就；§4.8 的"先 confirm"）。
   * @param {object} r refs()
   * @returns {void}
   */
  function wire(r) {
    if (wired || !r) return;
    if (r.reset) {
      r.reset.addEventListener('click', function () {
        if (!window.confirm('确定重置全部成就？')) return;
        PB.achievements.reset();
        S.refreshAchList();
      });
    }
    wired = true;
  }

  /**
   * HUD 更新（F12，10 Hz 节流）。七项 MUST：速度 km/h、得分、鱼数、combo（≥2 显示 ×n）、AUTO 标记、
   * 成就 x/14、当前镜头名；另加静音图标状态（§1.5）。
   * @param {object} G 一局状态
   * @returns {void}
   */
  S.update = function (G) {
    if (!G) return;
    var now = performance.now();
    if (now - lastHudMs < HUD_MS) return;
    lastHudMs = now;
    var r = refs();
    if (!r) return;
    wire(r);
    setText(r.speed, String(Math.round(G.bike.v * 3.6)));
    setText(r.score, String(G.score.points));
    setText(r.fish, String(G.score.catches));
    if (G.score.combo >= 2) {
      if (r.combo.hidden) r.combo.hidden = false;
      setText(r.combo, '×' + G.score.combo);
    } else if (!r.combo.hidden) {
      r.combo.hidden = true;
    }
    setText(r.ach, PB.achievements.count() + '/' + CFG.ACH.LIST.length);
    setText(r.cam, CAM_NAMES[G.cam.mode] || '');
    S.updateMute();
    if (r.auto.hidden === G.ap.engaged) r.auto.hidden = !G.ap.engaged;
    toastTick(now, r);
  };

  // ==== P15 追加：触屏控件的显隐与静音图标（§4.5.4）====
  // 显示条件：matchMedia('(pointer:coarse)') 为真，或第一次收到 pointerType === 'touch' 的指针事件。
  // 键盘输入始终并存：显示触屏按钮不会改变 keyHeld/ptrCount 的任何语义（M-16）。
  var touchOn = false;

  /**
   * 打开触屏控件（幂等）。只加一个 class，不改任何布局数值（尺寸全部在 css/style.css 里）。
   * @returns {void}
   */
  function showTouch() {
    if (touchOn) return;
    touchOn = true;
    var hud = document.getElementById('hud');
    if (hud) hud.classList.add('touch');
    S.updateMute();
  }

  /**
   * @returns {boolean} 触屏控件当前是否可见
   */
  S.touchVisible = function () { return touchOn; };

  /**
   * 触屏探测（boot 时调用一次）。粗指针设备立即显示；细指针设备等第一次 touch 指针事件。
   * @returns {void}
   */
  S.initTouch = function () {
    if (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) { showTouch(); return; }
    var onPtr = function (e) {
      if (!e || e.pointerType !== 'touch') return;
      showTouch();
      window.removeEventListener('pointerdown', onPtr, true);
      window.removeEventListener('pointermove', onPtr, true);
    };
    window.addEventListener('pointerdown', onPtr, true);
    window.addEventListener('pointermove', onPtr, true);
  };

  /**
   * 同步静音图标（HUD 文本项与触屏 🔊 按钮读同一份 store 状态，M-29 唯一写者）。
   * @returns {void}
   */
  S.updateMute = function () {
    var icon = PB.store.get().settings.muted ? '🔇' : '🔊';
    var r = refs();
    if (r) setText(r.mute, icon);
    var btn = document.getElementById('touch-mute');
    if (btn) setText(btn, icon);
  };

  /**
   * 事件消费（F7）：成就事件入 toast 队列。事件对象由生产者新建，hud 只读不写。
   * @param {Array<object>} events 本帧事件
   * @returns {void}
   */
  S.onEvents = function (events) {
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.type !== 'achievement') continue;
      var meta = null;
      for (var k = 0; k < CFG.ACH.LIST.length; k++) {
        if (CFG.ACH.LIST[k].id === e.id) { meta = CFG.ACH.LIST[k]; break; }
      }
      toastQueue.push('成就解锁：' + (meta ? meta.name : e.id));
      // 列表打开时立即刷新，让新解锁的行马上变绿（DOM 只在面板打开时存在）
      if (refs() && refs().panel && !refs().panel.hidden) S.refreshAchList();
    }
  };

  /**
   * toast 推进：同屏 1 条、每条 3.5 s、进出各 0.3 s（§4.8）。由 update 的 10 Hz 节拍驱动。
   * @param {number} now 当前毫秒
   * @param {object} r refs()
   * @returns {void}
   */
  function toastTick(now, r) {
    if (!r.toast) return;
    if (!toastActive && toastQueue.length) {
      toastActive = { text: toastQueue.shift(), t0: now, outAt: 0 };
      r.toast.textContent = toastActive.text;
      r.toast.hidden = false;
      r.toast.classList.add('on');
      return;
    }
    if (!toastActive) return;
    if (!toastActive.outAt && now - toastActive.t0 >= TOAST_MS) {
      toastActive.outAt = now;
      r.toast.classList.remove('on');
    }
    if (toastActive.outAt && now - toastActive.outAt >= TOAST_FADE_MS) {
      r.toast.hidden = true;
      toastActive = null;
    }
  }

  /**
   * 打开/关闭成就面板（L 或 🏆）。
   * @returns {void}
   */
  S.toggleAchList = function () {
    var r = refs();
    if (!r || !r.panel) return;
    if (r.panel.hidden) {
      r.panel.hidden = false;
      S.refreshAchList();
    } else {
      r.panel.hidden = true;
    }
  };

  /**
   * 关闭成就面板（Esc / ×）。
   * @returns {void}
   */
  S.closeAchList = function () {
    var r = refs();
    if (r && r.panel) r.panel.hidden = true;
  };

  /**
   * @returns {boolean} 成就面板是否打开
   */
  S.isAchOpen = function () {
    var r = refs();
    return !!(r && r.panel && !r.panel.hidden);
  };

  /**
   * 重建 14 行列表（状态/名称/提示/解锁时间；顶部 x/14）。只在面板打开或解锁时调用。
   * @returns {void}
   */
  S.refreshAchList = function () {
    var r = refs();
    if (!r || !r.rows) return;
    var list = PB.achievements.list();
    setText(r.count, PB.achievements.count() + '/' + CFG.ACH.LIST.length);
    r.rows.textContent = '';
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var li = document.createElement('li');
      li.className = it.at ? 'ach-on' : 'ach-off';
      var time = it.at ? new Date(it.at).toLocaleTimeString('zh-CN', { hour12: false }) : '—';
      li.textContent = (it.at ? '✓ ' : '· ') + it.name + ' — ' + it.hint + ' — ' + time;
      r.rows.appendChild(li);
    }
  };
})(window.PB = window.PB || {});
