// TASK-002 P2: 纯数学工具（plan.md §3.5 mathx 行、M-07 不得引用 THREE/DOM）。
// 这里只放无状态纯函数与"由调用方传入状态"的随机数推进器；不含任何模块状态、不读 DOM。
// 数值约定：角度用弧度；向量用 (x, y, z) 三个分量参数 + out 对象，避免每次分配（M-31）。
(function (PB) {
  'use strict';
  var M = PB.mathx = {};
  // 把值夹到闭区间。
  M.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  // 线性插值。t 不做 clamp（调用方按语义决定是否先 clamp）。
  M.lerp = function (a, b, t) { return a + (b - a) * t; };
  // 三次平滑插值（Hermite）。用于变道位置、镜头混合等需要 C1 连续的地方（§4.5.2、§4.7）。
  M.smoothstep = function (e0, e1, x) {
    if (e1 === e0) return x < e0 ? 0 : 1;
    var t = (x - e0) / (e1 - e0);
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  };
  // 正模。JS 的 % 对负数返回负值，而道具回收公式（§1.1）与相位取模（M-27）要求结果落在 [0,m)。
  M.mod = function (a, m) { return a - m * Math.floor(a / m); };
  // 符号函数。
  M.sign = function (v) { return v > 0 ? 1 : (v < 0 ? -1 : 0); };
  // 指数阻尼（§4.5.2 的 damp）：c 以速率 k 逼近 t，步长 h。 用 1-exp(-kh) 而不是 k*h，保证不同 h 下收敛速度一致（固定步长下同样成立）。
  M.damp = function (c, t, k, h) { return c + (t - c) * (1 - Math.exp(-k * h)); };
  // 三维向量限长（§4.1 的 clampLen）：长度超过 max 时按比例缩到 max，否则原样返回。 结果写入 out，避免分配。
  M.clampLen = function (x, y, z, max, out) {
    var len = Math.sqrt(x * x + y * y + z * z);
    if (len > max && len > 0) {
      var s = max / len;
      out.x = x * s; out.y = y * s; out.z = z * s;
    } else {
      out.x = x; out.y = y; out.z = z;
    }
    return out;
  };
  // mulberry32 单步推进（§3.3：G.rng 是 uint32 状态，只经本函数读取并推进）。 状态写回 G.rng，因此同一种子在同一调用序列下完全可复现（AC-5d、AC-12e 依赖确定性）。
  M.rng = function (G) {
    G.rng = (G.rng + 0x6D2B79F5) >>> 0;
    var t = G.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // 确定性整数散列 → [0,1)。用于道具高度等"每次加载都相同"的伪随机量（§1.5 棕榈高度）。 不用 G.rng：道具外观不能随模拟进度变化，也不能消耗 rng 状态。
  M.hash01 = function (i) {
    var x = (i | 0) + 0x9E3779B9;
    x = Math.imul(x ^ (x >>> 16), 0x21F0AAAD);
    x = Math.imul(x ^ (x >>> 15), 0x735A2D97);
    x = x ^ (x >>> 15);
    return (x >>> 0) / 4294967296;
  };
  // 一维值噪声，晶格间距 2 s，值域 [-1,1]（§4.1 风场的 n1/n2）。 用 smoothstep 插值保证一阶连续，避免围巾受高频抖动。
  M.noise1 = function (t, seed) {
    var x = t / 2;
    var i = Math.floor(x);
    var f = x - i;
    var a = M.hash01(i * 7919 + seed * 104729) * 2 - 1;
    var b = M.hash01((i + 1) * 7919 + seed * 104729) * 2 - 1;
    var u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
  // 单位向量球面插值（§4.2.2 lightDir 在太阳/月亮之间过渡）。 夹角接近 0 时退化为线性插值并归一化，避免 acos 数值噪声导致除零。
  M.slerpDir = function (a, b, t, out) {
    var d = M.clamp(a.x * b.x + a.y * b.y + a.z * b.z, -1, 1);
    var omega = Math.acos(d);
    if (omega < 1e-4) {
      out.x = M.lerp(a.x, b.x, t); out.y = M.lerp(a.y, b.y, t); out.z = M.lerp(a.z, b.z, t);
    } else {
      var s = Math.sin(omega);
      var wa = Math.sin((1 - t) * omega) / s;
      var wb = Math.sin(t * omega) / s;
      out.x = a.x * wa + b.x * wb; out.y = a.y * wa + b.y * wb; out.z = a.z * wa + b.z * wb;
    }
    var len = Math.sqrt(out.x * out.x + out.y * out.y + out.z * out.z) || 1;
    out.x /= len; out.y /= len; out.z /= len;
    return out;
  };
  // 生成星点方向（§4.2.4）：55% 的仰角在 [4°,24°] 均匀，45% 的 sin e 在 [sin24°,1] 均匀， 方位角均匀；随后用独立种子做 Fisher–Yates 打乱，使 drawRange 前缀是均匀子集。 生成规则必须与 selfcheck 的 PR-1 计数（S2 预计 337 颗）一致，因此放在 core 而不是 render 层。
  M.starField = function (out, count) {
    var state = 7;                        // §4.2.4 分布种子
    var rnd = function () {
      state = (state + 0x6D2B79F5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    var D2R = Math.PI / 180;
    var sinLow = Math.sin(24 * D2R);
    for (var i = 0; i < count; i++) {
      var e;
      if (rnd() < 0.55) {
        e = (4 + 20 * rnd()) * D2R;
      } else {
        e = Math.asin(sinLow + (1 - sinLow) * rnd());
      }
      var az = rnd() * Math.PI * 2;
      var ce = Math.cos(e);
      out[i * 3] = ce * Math.sin(az);
      out[i * 3 + 1] = Math.sin(e);
      out[i * 3 + 2] = ce * Math.cos(az);
    }
    // Fisher–Yates（种子 11）：让 drawRange 截断后的前缀仍是均匀子集
    var st = 11;
    var rnd2 = function () {
      st = (st + 0x6D2B79F5) >>> 0;
      var t = st;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (var j = count - 1; j > 0; j--) {
      var k = Math.floor(rnd2() * (j + 1));
      var tx = out[j * 3], ty = out[j * 3 + 1], tz = out[j * 3 + 2];
      out[j * 3] = out[k * 3]; out[j * 3 + 1] = out[k * 3 + 1]; out[j * 3 + 2] = out[k * 3 + 2];
      out[k * 3] = tx; out[k * 3 + 1] = ty; out[k * 3 + 2] = tz;
    }
    return out;
  };
})(window.PB = window.PB || {});
