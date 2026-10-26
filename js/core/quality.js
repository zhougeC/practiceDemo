// TASK-002 P14: 画质自适应（plan.md §4.10、M-19、AC-11a/11b/11c）。
// 四级离散（L0…L3）+ 滞回：窗口 1.5 s 按 rawDtMs 计；连续 2 个有效窗口 <45 fps 降一级，
// 连续 5 个有效窗口 >57 fps 且距上次变化 ≥10 s 升一级；升级后 10 s 内又降级 → 60 s 内禁止升级。
// 本文件属 js/core/*：不引用 THREE、不访问 DOM（M-07）；时间由调用方以 nowSec 传入，
// 真正应用等级（DPR/网格/星点/雾）由 PB.scene.applyQuality 完成。
(function (PB) {
  'use strict';

  var Q = PB.config.QUALITY;
  var S = PB.quality = {};

  var level = Q.FINE_INIT;      // 当前等级 0..3
  var lastChangeT = 0;          // 上次任意等级变化的时刻（秒）；create 时置为启动时刻
  var lastUpT = -1e9;           // 上次升级的时刻（秒）
  var upBlockUntil = -1e9;      // 振荡封锁到期时刻（秒）
  var winSum = 0;               // 当前窗口累计的原始帧时长（ms）
  var winCount = 0;             // 当前窗口的帧数
  var discarded = false;        // 当前窗口是否被要求丢弃（discardWindow）
  var goodWins = 0, badWins = 0;
  var changes = [];             // 等级变化记录 [{t, from, to}]（AC-11c 的 60 s ≤2 次判据）
  var lastFps = 0;

  /**
   * 建控制器（boot 时一次）。初始等级由调用方按指针类型决定（粗指针 L1，其他 L2）。
   * lastChangeT 取启动时刻：AC-11b 要求"距上一次任意等级变化（含启动）≥10 s 才升级"。
   *
   * @param {number} initialLevel 初始等级 0..3
   * @param {number} nowSec 启动时刻（秒）
   * @returns {number} 实际采用的初始等级
   */
  S.create = function (initialLevel, nowSec) {
    level = Math.max(0, Math.min(3, initialLevel | 0));
    lastChangeT = nowSec;
    lastUpT = -1e9;
    upBlockUntil = -1e9;
    winSum = 0; winCount = 0; discarded = false;
    goodWins = 0; badWins = 0;
    changes = [];
    lastFps = 0;
    return level;
  };

  /**
   * @returns {number} 当前等级 0..3
   */
  S.level = function () { return level; };

  /**
   * 丢弃当前正在累计的窗口（§4.10：调用过 discardWindow 的窗口丢弃）。
   * main 在 resumeRunning 时调用：恢复瞬间的帧时长不代表稳态负载。
   *
   * @param {number} nowSec 当前时刻（秒，本函数不使用，保留以匹配 §3.5 签名）
   * @returns {void}
   */
  S.discardWindow = function (nowSec) {
    discarded = true;
  };

  /**
   * 强制设定等级（调试钩子 forceQuality；不计入升级冷却，但刷新 lastChangeT）。
   *
   * @param {number} l 等级 0..3
   * @param {number} nowSec 当前时刻（秒）
   * @returns {number} 实际采用的等级
   */
  S.force = function (l, nowSec) {
    var next = Math.max(0, Math.min(3, l | 0));
    if (next !== level) changes.push({ t: nowSec, from: level, to: next });
    level = next;
    lastChangeT = nowSec;
    goodWins = 0; badWins = 0;
    winSum = 0; winCount = 0; discarded = false;
    return level;
  };

  /**
   * 结算一个窗口并给出新等级。
   *
   * 判定顺序（与 §4.10 逐条对应）：
   * 1) 窗口内出现过 >250 ms 的原始帧 → 整窗丢弃（这类帧来自切后台/编译停顿，不代表稳态）；
   * 2) 被 discardWindow 标记 → 丢弃；
   * 3) 距上次等级变化 <2 s → 丢弃（避免刚换级就用旧负载再判一次）；
   * 4) fps <45 记一个坏窗口，>57 记一个好窗口，中间区间两个计数都清零（滞回）；
   * 5) 坏窗口 ≥2 → 降一级；若这次降级发生在升级后 10 s 内 → 60 s 内禁止升级；
   * 6) 好窗口 ≥5 且距上次变化 ≥10 s 且不在封锁期 → 升一级。
   *
   * @param {number} fps 本窗口的平均帧率
   * @param {number} nowSec 当前时刻（秒）
   * @returns {number|null} 变化后的等级；未变化时返回 null
   */
  function closeWindow(fps, nowSec) {
    lastFps = fps;
    // 步骤3：距上次变化太近 → 丢弃，不计入任何计数
    if (nowSec - lastChangeT < Q.MIN_SINCE_CHANGE_S) { goodWins = 0; badWins = 0; return null; }
    if (fps < Q.DOWN_FPS) { badWins++; goodWins = 0; }
    else if (fps > Q.UP_FPS) { goodWins++; badWins = 0; }
    else { goodWins = 0; badWins = 0; }

    // 步骤5：降级
    if (badWins >= Q.DOWN_WINS && level > 0) {
      var from = level;
      level--;
      badWins = 0;
      // 升级后短时间内又降级 → 判为振荡，封锁升级 60 s（§4.10 防振荡）
      if (nowSec - lastUpT < Q.OSC_AFTER_S) upBlockUntil = nowSec + Q.OSC_BLOCK_S;
      changes.push({ t: nowSec, from: from, to: level });
      lastChangeT = nowSec;
      return level;
    }

    // 步骤6：升级
    if (goodWins >= Q.UP_WINS && level < 3 && nowSec - lastChangeT >= Q.MIN_SINCE_UP_S && nowSec >= upBlockUntil) {
      var f2 = level;
      level++;
      goodWins = 0;
      lastUpT = nowSec;
      lastChangeT = nowSec;
      changes.push({ t: nowSec, from: f2, to: level });
      return level;
    }
    return null;
  }

  /**
   * 喂入一帧的原始耗时（F11）。窗口满 1.5 s 时结算一次。
   *
   * @param {number} rawMs 本帧原始耗时（毫秒，未截断）
   * @param {number} nowSec 当前时刻（秒）
   * @returns {number|null} 需要应用的等级；无变化时 null
   */
  S.sample = function (rawMs, nowSec) {
    if (!isFinite(rawMs) || rawMs <= 0) return null;
    // 步骤1：超长原始帧（切后台、着色器编译、GC 长停顿）整窗作废
    if (rawMs > Q.LONG_FRAME_MS) {
      winSum = 0; winCount = 0;
      discarded = false;
      return null;
    }
    winSum += rawMs;
    winCount++;
    if (winSum < Q.WINDOW_MS) return null;

    var fps = winCount * 1000 / winSum;
    var wasDiscarded = discarded;
    winSum = 0; winCount = 0; discarded = false;
    // 步骤2：被显式丢弃的窗口不参与判定
    if (wasDiscarded) return null;
    return closeWindow(fps, nowSec);
  };

  /**
   * 只读读数（调试/测试用）：窗口计数、上次窗口 fps、变化记录。
   *
   * @returns {{level:number, goodWins:number, badWins:number, lastFps:number, lastChangeT:number, upBlockUntil:number, changes:Array<{t:number,from:number,to:number}>}}
   */
  S.stats = function () {
    return {
      level: level, goodWins: goodWins, badWins: badWins, lastFps: lastFps,
      lastChangeT: lastChangeT, upBlockUntil: upBlockUntil,
      changes: changes.map(function (c) { return { t: c.t, from: c.from, to: c.to }; })
    };
  };
})(window.PB = window.PB || {});
