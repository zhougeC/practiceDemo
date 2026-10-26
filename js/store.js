// TASK-002 P1: 唯一持久化读写点（plan.md M-29、§3.6 store.doc、§4.8 持久化）。
// 所有 localStorage 访问都在本文件；其他模块只能经 PB.store.update / flush 写入。
// localStorage 不可用（隐私模式、file:// 限制、配额）时 persistent=false，只在内存中保存，
// 且任何调用都不得抛异常（AC-7 要求"store 只在内存时不抛异常"）。
(function (PB) {
  'use strict';
  var CFG = PB.config;
  var S = PB.store = {};
  var doc = null;              // 内存中的文档副本（唯一写入口径）
  var persistent = false;      // localStorage 是否真实可用
  var storage = null;          // 可用的 Storage；不可用时为 null
  // 深拷贝 store.doc 的默认值。用 JSON 往返而不是共享常量对象， 避免调用方误改 CFG.STORE_DEFAULT 造成跨会话污染。
  function defaultDoc() { return JSON.parse(JSON.stringify(CFG.STORE_DEFAULT)); }
  // 把任意读入对象补齐成完整 schema。缺字段用默认值填，类型不符的字段整体回退默认值， 保证后续读者（achievements/hud/main）无需再判空。
  function normalize(raw) {
    var base = defaultDoc();
    if (!raw || typeof raw !== 'object') return base;
    if (raw.ach && typeof raw.ach === 'object' && !Array.isArray(raw.ach)) base.ach = raw.ach;
    if (raw.best && typeof raw.best === 'object') {
      if (isFinite(raw.best.points)) base.best.points = Number(raw.best.points);
      if (isFinite(raw.best.distance)) base.best.distance = Number(raw.best.distance);
    }
    if (raw.settings && typeof raw.settings === 'object') {
      // muted 初值 false（UD-5）：只有显式 true/false 才采纳
      if (typeof raw.settings.muted === 'boolean') base.settings.muted = raw.settings.muted;
      // cam 必须落在 §4.7 的 5 个机位内，越界视为损坏
      if (raw.settings.cam === 0 || raw.settings.cam === 1 || raw.settings.cam === 2 ||
          raw.settings.cam === 3 || raw.settings.cam === 4) base.settings.cam = raw.settings.cam;
    }
    if (typeof raw.v === 'number') base.v = raw.v;
    return base;
  }
  // 探测并持有可用的 Storage。用一次真实写入/删除探测，而不是只看 window.localStorage 是否存在， 因为 file:// 与隐私模式下对象存在但写入会抛 QuotaExceededError。
  function probeStorage() {
    try {
      var ls = window.localStorage;
      if (!ls) return null;
      var probeKey = CFG.STORE_KEY + '.probe';
      ls.setItem(probeKey, '1');
      ls.removeItem(probeKey);
      return ls;
    } catch (e) { return null; }   // 任何异常都视为不可用：不打印、不抛错，走内存路径
  }
  // 读取持久化文档。启动时调用一次（PB.main.boot）；重复调用会重新读盘并覆盖内存副本。
  S.load = function () {
    storage = probeStorage();
    persistent = storage !== null;
    if (!persistent) {
      doc = defaultDoc();
      return doc;
    }
    try {
      var text = storage.getItem(CFG.STORE_KEY);
      doc = normalize(text ? JSON.parse(text) : null);
    } catch (e) {
      // 解析失败（手工改坏、版本迁移）按缺省处理，不阻断启动
      doc = defaultDoc();
    }
    return doc;
  };
  // 以回调方式修改文档，修改后立即持久化。回调收到可变的 doc 副本， 返回值被忽略；回调抛错时文档保持不变（先在副本上改，成功后再提交）。
  S.update = function (fn) {
    if (!doc) doc = defaultDoc();
    var draft;
    try { draft = JSON.parse(JSON.stringify(doc)); fn(draft); }
    catch (e) { return; }        // 回调出错则放弃本次修改，保持内存与磁盘一致
    doc = normalize(draft);
    S.flush();
  };
  // 把内存文档写回 localStorage。persistent=false 时是空操作（AC-7）。 写入失败（配额/权限）时降级为内存模式，不抛错。
  S.flush = function () {
    if (!persistent || !storage) return;
    try {
      storage.setItem(CFG.STORE_KEY, JSON.stringify(doc));
    } catch (e) { persistent = false; storage = null; }   // 写入失败即降级为内存模式，不重复抛错
  };
  S.get = function () { if (!doc) doc = defaultDoc(); return doc; };
  Object.defineProperty(S, 'doc', { get: function () { return S.get(); }, enumerable: true });
  Object.defineProperty(S, 'persistent', { get: function () { return persistent; }, enumerable: true });
})(window.PB = window.PB || {});
