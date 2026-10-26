// TASK-002 P7: 昼夜相位、关键帧与光照参数（plan.md §4.2、UD-2、ADR-08、§3.5 daynight 签名）。
// 本模块是 G.env 的唯一分配者（§3.6）；sample 只写预分配字段，稳态帧不新建对象（M-31）。
// core 不得引用 THREE（M-07），因此颜色在这里做 sRGB→线性换算，render 层用 setRGB 直接写入线性值。
(function (PB) {
  'use strict';
  var CFG = PB.config, M = PB.mathx, D = CFG.DAY, SIM = CFG.SIM;
  var S = PB.daynight = {};
  var D2R = Math.PI / 180;

  /**
   * sRGB 分量 → 线性空间（与 three 的 ColorManagement 同一公式；M-03 要求色值在线性空间参与插值）。
   * @param {number} c sRGB 分量 0..1
   * @returns {number} 线性分量
   */
  function toLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

  /**
   * 十六进制色 → 线性三元组。
   * @param {string} hex '#RRGGBB'
   * @param {{r:number,g:number,b:number}} out 输出（复用）
   * @returns {{r:number,g:number,b:number}} out
   */
  function hexLin(hex, out) {
    var n = parseInt(hex.slice(1), 16);
    out.r = toLinear(((n >> 16) & 255) / 255);
    out.g = toLinear(((n >> 8) & 255) / 255);
    out.b = toLinear((n & 255) / 255);
    return out;
  }

  // 关键帧预计算（模块加载时一次）。列顺序见 config.CFG.DAY.KEYS 的注释（§4.2.2 表格逐行）。
  var KEYS = (function () {
    var rows = D.KEYS, out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      out.push({
        p: r[0], sunEl: r[1], moonEl: r[2],
        zenith: hexLin(r[3], { r: 0, g: 0, b: 0 }),
        horizon: hexLin(r[4], { r: 0, g: 0, b: 0 }),
        light: hexLin(r[5], { r: 0, g: 0, b: 0 }),
        lightI: r[6],
        hemiSky: hexLin(r[7], { r: 0, g: 0, b: 0 }),
        hemiGround: hexLin(r[8], { r: 0, g: 0, b: 0 }),
        hemiI: r[9],
        stars: r[10], lamps: r[11], specPow: r[12], specI: r[13]
      });
    }
    return out;
  })();

  // 当前分段（sample 与 lightDir 共用的临时量；不进入任何状态）
  var _a = null, _b = null, _u = 0, _eSun = 0, _eMoon = 0;
  var _sun = { x: 0, y: 0, z: 0 }, _moon = { x: 0, y: 0, z: 0 };

  /**
   * 找到 p 所在的关键帧区间并算出插值系数与两个仰角（分段线性，§4.2.2）。
   * @param {number} p 相位 [0,1)
   * @returns {void}
   */
  function locate(p) {
    var i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    _a = KEYS[i];
    _b = KEYS[i + 1];
    var span = _b.p - _a.p;
    _u = span > 0 ? (p - _a.p) / span : 0;
    if (_u < 0) _u = 0; else if (_u > 1) _u = 1;
    _eSun = _a.sunEl + (_b.sunEl - _a.sunEl) * _u;
    _eMoon = _a.moonEl + (_b.moonEl - _a.moonEl) * _u;
  }

  /**
   * 天体方向（§4.2.2）：dir(h, e) = (cos e·h.x, sin e, cos e·h.z)。
   * @param {{x:number,y:number,z:number}} h 水平方向（已归一化）
   * @param {number} eDeg 仰角（度）
   * @param {{x:number,y:number,z:number}} out 输出（复用）
   * @returns {{x:number,y:number,z:number}} out
   */
  function dirOf(h, eDeg, out) {
    var ce = Math.cos(eDeg * D2R);
    out.x = ce * h.x;
    out.y = Math.sin(eDeg * D2R);
    out.z = ce * h.z;
    return out;
  }

  /**
   * 线性三元组插值。
   * @param {{r:number,g:number,b:number}} a 起点
   * @param {{r:number,g:number,b:number}} b 终点
   * @param {number} u 系数
   * @param {{r:number,g:number,b:number}} out 输出（复用）
   * @returns {{r:number,g:number,b:number}} out
   */
  function mix3(a, b, u, out) {
    out.r = a.r + (b.r - a.r) * u;
    out.g = a.g + (b.g - a.g) * u;
    out.b = a.b + (b.b - a.b) * u;
    return out;
  }

  /**
   * 主光方向（§4.2.2，全相位定义）：太阳/月亮各自把仰角夹到 ≥3°，再按区间取或 slerp。
   * 区间：[0,0.16) 太阳；[0.16,0.24) 太阳→月亮；[0.24,0.74) 月亮；
   * [0.74,0.86) 月亮→太阳；[0.86,1) 太阳。
   *
   * @param {number} p 相位 [0,1)
   * @param {{x:number,y:number,z:number}} out 输出（复用）
   * @returns {{x:number,y:number,z:number}} out
   */
  S.lightDir = function (p, out) {
    locate(p);
    var minE = D.LIGHT_MIN_ELEV_DEG;
    dirOf(CFG.SUN_DIR_H, Math.max(_eSun, minE), _sun);
    dirOf(CFG.MOON_DIR_H, Math.max(_eMoon, minE), _moon);
    var t1 = D.TRANS_SUN_MOON, t2 = D.TRANS_MOON_SUN;
    if (p < t1[0]) {
      out.x = _sun.x; out.y = _sun.y; out.z = _sun.z;
    } else if (p < t1[1]) {
      M.slerpDir(_sun, _moon, M.smoothstep(0, 1, (p - t1[0]) / (t1[1] - t1[0])), out);
    } else if (p < t2[0]) {
      out.x = _moon.x; out.y = _moon.y; out.z = _moon.z;
    } else if (p < t2[1]) {
      M.slerpDir(_moon, _sun, M.smoothstep(0, 1, (p - t2[0]) / (t2[1] - t2[0])), out);
    } else {
      out.x = _sun.x; out.y = _sun.y; out.z = _sun.z;
    }
    return out;
  };

  /**
   * 相位（§4.2.1）：p = t/240 − floor(t/240)。
   * @param {number} t 模拟时间（秒）
   * @returns {number} p ∈ [0,1)
   */
  S.phaseOf = function (t) { return M.mod(t, SIM.CYCLE_SECONDS) / SIM.CYCLE_SECONDS; };

  /**
   * 采样一个相位到 Env（§4.2.3）。只写 out 的字段，不分配（M-31）。
   * lightColor 按 §4.2.3 存"线性色 × 强度"，海面 shader 直接用它；场景灯用 base = lightColor/lightI。
   * uPhase / uNoiseOff / uFoamPhase 由 ocean 模块每帧写入（§4.2.3 的例外），uTwinkleT 由 sky 写入。
   *
   * @param {number} t 模拟时间（秒）
   * @param {object} out Env（由 initState 预分配）
   * @returns {object} out
   */
  S.sample = function (t, out) {
    var p = S.phaseOf(t);
    locate(p);
    out.p = p;
    dirOf(CFG.SUN_DIR_H, _eSun, out.sunDir);
    dirOf(CFG.MOON_DIR_H, _eMoon, out.moonDir);
    S.lightDir(p, out.lightDir);
    mix3(_a.light, _b.light, _u, out.lightColor);
    out.lightI = _a.lightI + (_b.lightI - _a.lightI) * _u;
    // §4.2.3：lightColor = 线性色 × 强度（海面 shader 的唯一定义）
    out.lightColor.r *= out.lightI;
    out.lightColor.g *= out.lightI;
    out.lightColor.b *= out.lightI;
    mix3(_a.hemiSky, _b.hemiSky, _u, out.hemiSky);
    mix3(_a.hemiGround, _b.hemiGround, _u, out.hemiGround);
    out.hemiI = _a.hemiI + (_b.hemiI - _a.hemiI) * _u;
    // ambient = hemiSky × hemiI（§4.2.3，海面使用）
    out.ambient.r = out.hemiSky.r * out.hemiI;
    out.ambient.g = out.hemiSky.g * out.hemiI;
    out.ambient.b = out.hemiSky.b * out.hemiI;
    mix3(_a.zenith, _b.zenith, _u, out.zenith);
    mix3(_a.horizon, _b.horizon, _u, out.horizon);
    out.stars = _a.stars + (_b.stars - _a.stars) * _u;
    out.lamps = _a.lamps + (_b.lamps - _a.lamps) * _u;
    out.specPow = _a.specPow + (_b.specPow - _a.specPow) * _u;
    out.specI = _a.specI + (_b.specI - _a.specI) * _u;
    out.nightMix = out.stars;
    out.fogNear = D.FOG_NEAR;
    out.fogFar = D.FOG_FAR_BY_LEVEL[D.LEVEL_INIT];
    return out;
  };

  /**
   * 建 G.env 并采样一次（§3.6 initSession 第 3 步；Env 的唯一分配者）。
   * @param {object} G 一局状态
   * @returns {void}
   */
  S.initState = function (G) {
    G.env = {
      p: 0,
      sunDir: { x: 0, y: 0, z: 0 },
      moonDir: { x: 0, y: 0, z: 0 },
      lightDir: { x: 0, y: 0, z: 0 },
      lightColor: { r: 0, g: 0, b: 0 },
      lightI: 0,
      hemiSky: { r: 0, g: 0, b: 0 },
      hemiGround: { r: 0, g: 0, b: 0 },
      hemiI: 0,
      ambient: { r: 0, g: 0, b: 0 },
      zenith: { r: 0, g: 0, b: 0 },
      horizon: { r: 0, g: 0, b: 0 },
      stars: 0,
      lamps: 0,
      specPow: 0,
      specI: 0,
      nightMix: 0,
      fogNear: D.FOG_NEAR,
      fogFar: D.FOG_FAR_BY_LEVEL[D.LEVEL_INIT],
      uPhase: new Float32Array(4),
      uNoiseOff: 0,
      uFoamPhase: 0,
      uTwinkleT: 0
    };
    S.sample(G.t, G.env);
  };
})(window.PB = window.PB || {});
