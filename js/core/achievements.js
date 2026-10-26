// TASK-002 P11: 十四个成就（plan.md §4.8 M-21、AC-7）。
// 唯一持久化通道是注入的 storeApi（M-29）：本模块不直接读写 localStorage。
// 解锁幂等：同一 id 一旦解锁就不再写库、不再推事件（AC-7「每条只发一次 achievement 事件」）；
// softReset 不会重新锁上（解锁集合来自 store.doc，会话级内存镜像只在 init 时重建）。
(function (PB) {
  'use strict';

  var CFG = PB.config;
  var A = CFG.ACH;
  var S = PB.achievements = {};

  var store = null;
  var unlocked = Object.create(null);   // id → 解锁时间（毫秒）

  /**
   * 绑定 store 并从 store.doc 重建解锁集合（boot 时调用一次；重复调用等价于重新装载）。
   * @param {{get: function(): object, update: function(function(object): void): void, flush: function(): void}} storeApi PB.store
   * @returns {void}
   */
  S.init = function (storeApi) {
    store = storeApi;
    unlocked = Object.create(null);
    var doc = store.get();
    var ach = doc && doc.ach ? doc.ach : {};
    for (var id in ach) {
      if (Object.prototype.hasOwnProperty.call(ach, id) && ach[id]) unlocked[id] = ach[id];
    }
  };

  /**
   * @param {string} id 成就 id
   * @returns {boolean} 是否已解锁
   */
  S.isUnlocked = function (id) { return !!unlocked[id]; };

  /**
   * @returns {number} 已解锁数量
   */
  S.count = function () {
    var n = 0;
    for (var i = 0; i < A.LIST.length; i++) if (unlocked[A.LIST[i].id]) n++;
    return n;
  };

  /**
   * 列表数据（HUD 面板用，按 §4.8 的 14 行顺序）。允许分配：只在面板打开/刷新时调用。
   * @returns {Array<{id:string,name:string,hint:string,at:number}>} 14 行
   */
  S.list = function () {
    var out = [];
    for (var i = 0; i < A.LIST.length; i++) {
      var it = A.LIST[i];
      out.push({ id: it.id, name: it.name, hint: it.hint, at: unlocked[it.id] || 0 });
    }
    return out;
  };

  /**
   * 解锁一个成就（§4.8）。已解锁直接返回 false（不写库、不发事件）；
   * 否则先写内存镜像再写库，最后推 achievement 事件，保证事件与持久化一一对应。
   * @param {string} id 成就 id
   * @param {object} G 一局状态（用于推事件；可省略）
   * @returns {boolean} 本次是否新解锁
   */
  S.unlock = function (id, G) {
    if (!store || unlocked[id]) return false;
    var at = Date.now();
    unlocked[id] = at;
    store.update(function (d) {
      if (!d.ach || typeof d.ach !== 'object') d.ach = {};
      d.ach[id] = at;
    });
    store.flush();
    if (G && G.events) G.events.push({ type: 'achievement', id: id });
    return true;
  };

  /**
   * 每个固定步的累积型条件（§4.8 的 SPEED_DEMON / NIGHT_RIDER / LONG_WHEELIE / DIST_* / CAMERA_TOUR）。
   * 累积量写在 G.stats（createState 已建这些字段），失败时按原文清零。
   *
   * @param {object} G 一局状态
   * @param {number} h 固定步长（秒）
   * @returns {void}
   */
  S.step = function (G, h) {
    var st = G.stats, b = G.bike;
    // 步骤1：风驰 —— v ≥ 15 累积，否则清零；≥3 s 解锁
    if (b.v >= A.SPEED_V) st.speedHighT += h; else st.speedHighT = 0;
    if (st.speedHighT >= A.SPEED_T) S.unlock('SPEED_DEMON', G);
    // 步骤2：夜骑者 —— 夜间相位且 v ≥ 3 时累积（§4.8 未规定清零，按字面只累加）
    if (G.p >= 0.32 && G.p < 0.72 && b.v >= A.NIGHT_V) st.nightRideT += h;
    if (st.nightRideT >= A.NIGHT_T) S.unlock('NIGHT_RIDER', G);
    // 步骤3：独轮秀 —— wheelie ≥ 0.26 且 v ≥ 4 累积，否则清零；≥3 s 解锁
    if (b.wheelie >= A.WHEELIE_RAD && b.v >= A.WHEELIE_V) st.wheelieT += h; else st.wheelieT = 0;
    if (st.wheelieT >= A.WHEELIE_T) S.unlock('LONG_WHEELIE', G);
    // 步骤4：里程
    if (G.S >= 1000) S.unlock('DIST_1K', G);
    if (G.S >= 5000) S.unlock('DIST_5K', G);
    // 步骤5：导演 —— 5 个镜头的 camUsed 都 ≥ 1.0（camUsed 的唯一写者是 camera）
    var cu = st.camUsed;
    if (cu[0] >= A.CAM_T && cu[1] >= A.CAM_T && cu[2] >= A.CAM_T && cu[3] >= A.CAM_T && cu[4] >= A.CAM_T) {
      S.unlock('CAMERA_TOUR', G);
    }
  };

  /**
   * 事件型条件（§4.8 的 catch / cycleWrap 系列），在 F7 读取本帧事件后评估。
   * 可安全重复调用：unlock 幂等，统计量只按事件增量累加。
   *
   * @param {object} G 一局状态（读 G.events、G.score、G.stats.apCatches）
   * @returns {void}
   */
  S.onEvents = function (G) {
    var ev = G.events, sc = G.score;
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      if (e.type === 'catch') {
        // 步骤1：抓鱼类成就。顺序固定：初次 → 数量 → 连击 → 空中/抬轮 → 自动驾驶
        S.unlock('FIRST_CATCH', G);
        if (sc.catches >= 10) S.unlock('FISH_10', G);
        if (sc.catches >= 50) S.unlock('FISH_50', G);
        if (sc.combo >= 5) S.unlock('COMBO_5', G);
        if (e.air) S.unlock('AIR_CATCH', G);
        if (e.wheelie) S.unlock('WHEELIE_CATCH', G);
        if (e.auto) {
          G.stats.apCatches += 1;
          if (G.stats.apCatches >= A.AP_CATCHES) S.unlock('AUTO_FISHER', G);
        }
      } else if (e.type === 'cycleWrap') {
        // 步骤2：日夜轮回 —— 收到一次周期回绕事件即解锁
        S.unlock('FULL_CYCLE', G);
      }
    }
  };

  /**
   * 重置成就（面板按钮；§4.8 要求先 confirm，确认逻辑在 hud）。清空持久化与内存镜像，
   * 使条件在下一次评估时自然重新触发。
   * @returns {void}
   */
  S.reset = function () {
    if (!store) return;
    store.update(function (d) { d.ach = {}; });
    store.flush();
    unlocked = Object.create(null);
  };
})(window.PB = window.PB || {});
